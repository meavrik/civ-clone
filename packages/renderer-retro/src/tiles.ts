import { Terrain, TERRAIN_RULES, type WorldMap } from "@civ/core";
import { coastLevel, coastPatch, DEEP, DEEP_EDGE, fogLevel, fogPatch, landOwner, riverShape, SHORE, strokeDistance, type Explored, type Lifting } from "@civ/renderer-api";
import { FEATURE_SHEET, spriteSurface, TERRAIN_SHEET } from "./sprites/index.js";
import { SPRITE_CLEAR } from "./sprites/sheet.js";
import { C, shade } from "./palette.js";
import { DETAIL, Surface } from "./surface.js";

/**
 * A map square is TILE screen pixels across. Its terrain is drawn as fine as
 * the screen (see `DETAIL`): FINE pixels across, from the terrain sheet, with
 * coasts and rivers blended in here a fine pixel at a time. Everything drawn
 * over the terrain (works, specials, units, cities, fog) stays in screen pixels.
 */
export const TILE = 16;
/** Fine pixels across a square's terrain. */
export const FINE = TILE * DETAIL;

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

/**
 * The terrain sprite for a square (TILE pixels across, FINE fine pixels), the same on every
 * square: the art is lit from the upper left, so it is never mirrored.
 */
export function getTile(terrain: Terrain, _x: number, _y: number): Surface {
  let t = cache.get(terrain);
  if (!t) {
    t = spriteSurface(TERRAIN_SHEET, TERRAIN_SPRITE[terrain]) ?? undefined;
    if (!t) throw new Error(`terrain sheet has no sprite for ${TERRAIN_SPRITE[terrain]}`);
    cache.set(terrain, t);
  }
  return t;
}

/** Open sea, away from any land. */
function deepTile(_x: number, _y: number): Surface {
  let t = cache.get(-1);
  if (!t) {
    t = spriteSurface(TERRAIN_SHEET, "deep_ocean") ?? undefined;
    if (!t) throw new Error("terrain sheet has no sprite for deep_ocean");
    cache.set(-1, t);
  }
  return t;
}

const squareCache = new Map<string, Surface>();

/** Half a river's width in screen pixels at width 1: three pixels of water, more toward the sea. */
const RIVER_HALF = 1.5;
/** The pale bank either side of a river, in screen pixels. */
const RIVER_BANK = 0.9;
/** Share of a river's water that glints. */
const RIVER_GLINT = 0.07;

/**
 * A map square as drawn: its terrain sprite, with the shore and the edge of
 * deep water wandering across its borders (see `coastLevel`), and its river
 * meandering through (see `riverShape`). Land that spills into a water
 * square continues the neighbour's sprite, mirrored at the shared edge so the
 * seam does not show; next to the shore runs a line of surf, then a band of
 * shallows. Rivers show on land only, so a mouth runs on until it meets water.
 * Squares the player has not explored (`explored`) are left out of the blend.
 * Every fine pixel is worked out on its own (FINE x FINE), so shores and rivers
 * are as fine as the terrain art.
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
  const out = Surface.fine(TILE, TILE);
  const sea = getTile(Terrain.Ocean, x, y).data;
  const deep = deepTile(x, y).data;
  const surf = shade("sea", 7);
  const shallow = shade("sea", 2);
  const water = shade("sea", 2);
  const glint = shade("sea", 3);
  const bank = shade("sea", 7);
  const last = FINE - 1;
  for (let j = 0; j < FINE; j++)
    for (let i = 0; i < FINE; i++) {
      const u = (i + 0.5) / FINE;
      const v = (j + 0.5) / FINE;
      const at = j * FINE + i;
      const g = p.mixed ? coastLevel(p, u, v) : p.depth[4]!;
      const k = g < SHORE ? landOwner(p, u, v) : -1;
      let c: number;
      if (!p.mixed) c = plain.data[at]!;
      else if (k >= 0) {
        const dx = (k % 3) - 1;
        const dy = Math.floor(k / 3) - 1;
        const src = getTile(p.terrain[k]!, (((x + dx) % map.width) + map.width) % map.width, y + dy).data;
        c = src[(dy ? last - j : j) * FINE + (dx ? last - i : i)]!;
      } else if (g < SHORE + 0.07) c = surf;
      else if (g < 0.8) c = shallow;
      else if (g < DEEP_EDGE - 0.06) c = sea[at]!;
      else if (g < DEEP_EDGE + 0.06) c = (i + j) & 1 ? sea[at]! : deep[at]!;
      else c = deep[at]!;
      if (river && k >= 0)
        // Distances in screen pixels (dist * TILE), so a river is as wide as it was before the fine grain.
        for (const st of river.strokes) {
          const { dist, width } = strokeDistance(st, u, v);
          if (dist * TILE < width * RIVER_HALF) { c = h(i, j, 9) < RIVER_GLINT ? glint : water; break; }
          if (dist * TILE < width * RIVER_HALF + RIVER_BANK) c = bank;
        }
      out.data[at] = c;
    }
  if (squareCache.size > 4096) squareCache.clear();
  squareCache.set(key, out);
  return out;
}

/** 4x4 ordered dither thresholds, for the fog's drifting edge and the fog lifting off a square. */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((n) => (n + 0.5) / 16);

const fogCache = new Map<string, Surface>();
/** How soft the drifting edge of the fog is (see `fogLevel`): crisp, so only a thin band is dithered. */
const FOG_EDGE = 0.5;

/**
 * The fog drawn over square (x, y), or null when it has none: solid black on
 * an unexplored square, and on an explored square beside one, black drifting
 * in from that side with a ragged edge, dithered out to clear pixels
 * (SPRITE_CLEAR). Fog still lifting off a square just explored (`lifting`)
 * dissolves through the same dither. The edge follows world position, so it
 * runs on across square borders.
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
      out.data[j * TILE + i] = fogLevel(p, u, v, FOG_EDGE) <= BAYER[(j & 3) * 4 + (i & 3)]! ? SPRITE_CLEAR : C.BLACK!;
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
