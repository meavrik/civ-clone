import { Terrain, TERRAIN_RULES, type WorldMap } from "@civ/core";
import { cloudTone, coastLevel, coastPatch, DEEP, DEEP_EDGE, fogLevel, fogPatch, landOwner, riverShape, SHORE, strokeDistance, type Explored, type Lifting } from "@civ/renderer-api";
import { FEATURE_SHEET, mirrored, spriteSurface, TERRAIN_SHEET } from "./sprites/index.js";
import { SPRITE_CLEAR } from "./sprites/sheet.js";
import { C, shade } from "./palette.js";
import { Surface } from "./surface.js";

/**
 * Original 16x16 terrain tiles, authored here as code so the whole art set
 * lives in the palette by construction. Index 0 (black) is transparent in
 * overlays only; base tiles are fully opaque.
 *
 * Later phases swap this module for packed sprite sheets from Aseprite; the
 * `getTile` contract stays the same.
 */
export const TILE = 16;

/** Tiny deterministic hash for per-tile texture noise (not game RNG). */
function h(x: number, y: number, salt: number): number {
  let n = (x * 374761393 + y * 668265263 + salt * 1274126177) | 0;
  n = (n ^ (n >>> 13)) * 1274126177;
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

const TERRAIN_SPRITE: Record<Terrain, string> = {
  [Terrain.Ocean]: "ocean",
  [Terrain.Grassland]: "grassland",
  [Terrain.Plains]: "plains",
  [Terrain.Forest]: "forest",
  [Terrain.Hills]: "hills",
  [Terrain.Mountains]: "mountains",
  [Terrain.Desert]: "desert",
  [Terrain.Tundra]: "tundra",
  [Terrain.Arctic]: "arctic",
  [Terrain.Swamp]: "swamp",
  [Terrain.Jungle]: "jungle",
};

const cache = new Map<number, Surface>();

/** The terrain sprite for a square, mirrored on about half the squares so large areas do not tile visibly. */
export function getTile(terrain: Terrain, x: number, y: number): Surface {
  const variant = h(x, y, 1) < 0.5 ? 0 : 1;
  const key = terrain * 2 + variant;
  let t = cache.get(key);
  if (!t) {
    const base = spriteSurface(TERRAIN_SHEET, TERRAIN_SPRITE[terrain]);
    if (!base) throw new Error(`terrain sheet has no sprite for ${TERRAIN_SPRITE[terrain]}`);
    t = variant ? mirrored(base) : base;
    cache.set(key, t);
  }
  return t;
}

/** Open sea, away from any land, mirrored on about half the squares like the rest. */
function deepTile(x: number, y: number): Surface {
  const variant = h(x, y, 1) < 0.5 ? 0 : 1;
  const key = -1 - variant;
  let t = cache.get(key);
  if (!t) {
    const base = spriteSurface(TERRAIN_SHEET, "deep_ocean");
    if (!base) throw new Error("terrain sheet has no sprite for deep_ocean");
    t = variant ? mirrored(base) : base;
    cache.set(key, t);
  }
  return t;
}

const squareCache = new Map<string, Surface>();

/** Half a river's width in pixels at width 1: rivers are two pixels wide, more toward the sea. */
const RIVER_HALF = 1;

/**
 * A map square as drawn: its terrain sprite, with the shore and the edge of
 * deep water wandering across its borders (see `coastLevel`), and its river
 * meandering through (see `riverShape`). Land that spills into a water
 * square continues the neighbour's sprite, mirrored at the shared edge so the
 * seam does not show; next to the shore runs a line of surf, then a band of
 * shallows. Rivers show on land only, so a mouth runs on until it meets water.
 * Squares the player has not explored (`explored`) are left out of the blend.
 */
export function terrainSquare(map: WorldMap, x: number, y: number, explored?: Explored): Surface {
  const p = coastPatch(map, x, y, explored);
  const river = riverShape(map, x, y, explored);
  const own = p.terrain[4]!;
  const plain = p.depth[4] === DEEP ? deepTile(x, y) : getTile(own, x, y);
  if (!p.mixed && !river) return plain;
  const key = river ? `${p.key}|${river.key}` : p.key;
  const hit = squareCache.get(key);
  if (hit) return hit;
  const out = new Surface(TILE, TILE);
  const sea = getTile(Terrain.Ocean, x, y).data;
  const deep = deepTile(x, y).data;
  const surf = shade("ocean", 7);
  const shallow = shade("ocean", 5);
  const water = shade("ocean", 4);
  const last = TILE - 1;
  for (let j = 0; j < TILE; j++)
    for (let i = 0; i < TILE; i++) {
      const u = (i + 0.5) / TILE;
      const v = (j + 0.5) / TILE;
      const at = j * TILE + i;
      const g = p.mixed ? coastLevel(p, u, v) : p.depth[4]!;
      const k = g < SHORE ? landOwner(p, u, v) : -1;
      let c: number;
      if (!p.mixed) c = plain.data[at]!;
      else if (k >= 0) {
        const dx = (k % 3) - 1;
        const dy = Math.floor(k / 3) - 1;
        const src = getTile(p.terrain[k]!, (((x + dx) % map.width) + map.width) % map.width, y + dy).data;
        c = src[(dy ? last - j : j) * TILE + (dx ? last - i : i)]!;
      } else if (g < SHORE + 0.07) c = surf;
      else if (g < 0.8) c = shallow;
      else if (g < DEEP_EDGE - 0.06) c = sea[at]!;
      else if (g < DEEP_EDGE + 0.06) c = (i + j) & 1 ? sea[at]! : deep[at]!;
      else c = deep[at]!;
      if (river && k >= 0)
        for (const st of river.strokes) {
          const { dist, width } = strokeDistance(st, u, v);
          if (dist * TILE < width * RIVER_HALF) { c = water; break; }
        }
      out.data[at] = c;
    }
  if (squareCache.size > 4096) squareCache.clear();
  squareCache.set(key, out);
  return out;
}

/** 4x4 ordered dither thresholds, for fading fog and blending cloud shades without colours in between. */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((n) => (n + 0.5) / 16);

const fogCache = new Map<string, Surface>();
/** How soft the drifting edge of the fog is (see `fogLevel`): crisp, so only a thin band is dithered. */
const FOG_EDGE = 0.5;

/**
 * The fog drawn over square (x, y), or null when it has none: solid clouds on
 * an unexplored square, and on an explored square beside one, clouds drifting
 * in from that side, dithered out to clear pixels (SPRITE_CLEAR). Fog still
 * lifting off a square just explored (`lifting`) dissolves through the same
 * dither. The clouds are dark, with faint lighter billows (a checker where
 * they meet), and follow world position, so they run on across square borders.
 */
export function fogSquare(map: WorldMap, explored: Explored, x: number, y: number, lifting?: Lifting): Surface | null {
  const p = fogPatch(map, explored, x, y, lifting);
  if (p.cover[4]! < 1 && !p.edge) return null;
  const hit = fogCache.get(p.key);
  if (hit) return hit;
  const out = new Surface(TILE, TILE);
  for (let j = 0; j < TILE; j++)
    for (let i = 0; i < TILE; i++) {
      const u = (i + 0.5) / TILE;
      const v = (j + 0.5) / TILE;
      if (fogLevel(p, u, v, FOG_EDGE) <= BAYER[(j & 3) * 4 + (i & 3)]!) { out.data[j * TILE + i] = SPRITE_CLEAR; continue; }
      const tone = cloudTone(x + u, y + v, map.width) + ((i + j) & 1 ? 0.03 : -0.03);
      out.data[j * TILE + i] = shade("fog", tone < 0.7 ? 1 : 2);
    }
  if (fogCache.size > 4096) fogCache.clear();
  fogCache.set(p.key, out);
  return out;
}

/** A special resource: its icon from the features sheet (named after the resource). */
export function drawSpecial(s: Surface, dx: number, dy: number, terrain: Terrain): void {
  const name = TERRAIN_RULES[terrain].special?.name.toLowerCase();
  const icon = name ? spriteSurface(FEATURE_SHEET, name) : null;
  if (icon) { s.blit(icon, dx, dy, SPRITE_CLEAR); return; }
  s.rect(dx + 10, dy + 10, 3, 3, C.YELLOW!);
}

/** A minor tribe's village. */
export function drawHut(s: Surface, dx: number, dy: number): void {
  const hut = spriteSurface(FEATURE_SHEET, "hut");
  if (hut) s.blit(hut, dx, dy, SPRITE_CLEAR);
}
