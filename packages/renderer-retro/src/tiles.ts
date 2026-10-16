import { Terrain, TERRAIN_RULES } from "@civ/core";
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
