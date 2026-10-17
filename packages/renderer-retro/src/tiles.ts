import { Terrain, TERRAIN_RULES, type WorldMap } from "@civ/core";
import { coastLevel, coastPatch, DEEP, DEEP_EDGE, landOwner, SHORE } from "@civ/renderer-api";
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

const coastCache = new Map<string, Surface>();

/**
 * A map square as drawn: its terrain sprite, with the shore and the edge of
 * deep water wandering across its borders (see `coastLevel`). Land that
 * spills into a water square continues the neighbour's sprite, mirrored at
 * the shared edge so the seam does not show; next to the shore runs a line
 * of surf, then a band of shallows.
 */
export function terrainSquare(map: WorldMap, x: number, y: number): Surface {
  const p = coastPatch(map, x, y);
  const own = p.terrain[4]!;
  if (!p.mixed) return p.depth[4] === DEEP ? deepTile(x, y) : getTile(own, x, y);
  const hit = coastCache.get(p.key);
  if (hit) return hit;
  const out = new Surface(TILE, TILE);
  const sea = getTile(Terrain.Ocean, x, y).data;
  const deep = deepTile(x, y).data;
  const surf = shade("ocean", 7);
  const shallow = shade("ocean", 5);
  const last = TILE - 1;
  for (let j = 0; j < TILE; j++)
    for (let i = 0; i < TILE; i++) {
      const u = (i + 0.5) / TILE;
      const v = (j + 0.5) / TILE;
      const g = coastLevel(p, u, v);
      const at = j * TILE + i;
      const k = g < SHORE ? landOwner(p, u, v) : -1;
      let c: number;
      if (k >= 0) {
        const dx = (k % 3) - 1;
        const dy = Math.floor(k / 3) - 1;
        const src = getTile(p.terrain[k]!, (((x + dx) % map.width) + map.width) % map.width, y + dy).data;
        c = src[(dy ? last - j : j) * TILE + (dx ? last - i : i)]!;
      } else if (g < SHORE + 0.07) c = surf;
      else if (g < 0.8) c = shallow;
      else if (g < DEEP_EDGE - 0.06) c = sea[at]!;
      else if (g < DEEP_EDGE + 0.06) c = (i + j) & 1 ? sea[at]! : deep[at]!;
      else c = deep[at]!;
      out.data[at] = c;
    }
  if (coastCache.size > 4096) coastCache.clear();
  coastCache.set(p.key, out);
  return out;
}

/** River overlay — drawn on top of the base tile. Mask bits: N=1 E=2 S=4 W=8. */
export function drawRiver(s: Surface, dx: number, dy: number, mask: number): void {
  const c = shade("ocean", 4);
  const cx = dx + 7;
  const cy = dy + 7;
  s.rect(cx, cy, 2, 2, c);
  if (mask & 1) s.rect(cx, dy, 2, 8, c);
  if (mask & 4) s.rect(cx, cy, 2, 9, c);
  if (mask & 8) s.rect(dx, cy, 8, 2, c);
  if (mask & 2) s.rect(cx, cy, 9, 2, c);
  if (mask === 0) s.rect(cx - 2, cy - 1, 6, 3, c);
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
