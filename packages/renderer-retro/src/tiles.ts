import { Terrain } from "@civ/core";
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

function speckle(s: Surface, rampName: string, base: number, salt: number, density = 0.18): void {
  for (let y = 0; y < TILE; y++)
    for (let x = 0; x < TILE; x++) {
      const r = h(x, y, salt);
      if (r < density / 2) s.set(x, y, shade(rampName, base - 1));
      else if (r < density) s.set(x, y, shade(rampName, base + 1));
      else s.set(x, y, shade(rampName, base));
    }
}

function tree(s: Surface, x: number, y: number, ramp: string, trunk: number): void {
  // 5x6 conifer
  s.set(x + 2, y, shade(ramp, 5));
  s.hline(x + 1, y + 1, 3, shade(ramp, 4));
  s.hline(x, y + 2, 5, shade(ramp, 3));
  s.hline(x + 1, y + 3, 3, shade(ramp, 4));
  s.hline(x, y + 4, 5, shade(ramp, 2));
  s.set(x + 2, y + 5, trunk);
}

function bush(s: Surface, x: number, y: number, ramp: string): void {
  s.hline(x + 1, y, 3, shade(ramp, 7));
  s.hline(x, y + 1, 5, shade(ramp, 6));
  s.hline(x, y + 2, 5, shade(ramp, 5));
  s.hline(x + 1, y + 3, 3, shade(ramp, 0));
  s.set(x + 2, y + 4, shade("earth", 1));
}

function build(terrain: Terrain, variant: number): Surface {
  const s = new Surface(TILE, TILE);
  const salt = terrain * 7 + variant;
  switch (terrain) {
    case Terrain.Ocean: {
      speckle(s, "ocean", 3, salt, 0.08);
      // wave crests
      for (let i = 0; i < 3; i++) {
        const x = Math.floor(h(i, variant, 3) * 12);
        const y = 2 + Math.floor(h(variant, i, 4) * 12);
        s.hline(x, y, 3, shade("ocean", 5));
        s.set(x + 1, y - 1, shade("ocean", 6));
      }
      break;
    }
    case Terrain.Grassland:
      speckle(s, "grass", 4, salt, 0.25);
      break;
    case Terrain.Plains:
      speckle(s, "plains", 4, salt, 0.3);
      for (let i = 0; i < 4; i++) {
        const x = Math.floor(h(i, variant, 9) * 14);
        const y = Math.floor(h(variant, i, 10) * 14);
        s.vline(x, y, 2, shade("plains", 2));
      }
      break;
    case Terrain.Forest: {
      speckle(s, "grass", 3, salt, 0.2);
      const spots: [number, number][] = [
        [1, 1],
        [8, 2],
        [4, 7],
        [11, 8],
        [0, 10],
        [7, 10],
      ];
      for (const [x, y] of spots) tree(s, x, y, "forest", shade("earth", 2));
      break;
    }
    case Terrain.Hills: {
      speckle(s, "grass", 4, salt, 0.2);
      // two rounded hills with lit top edge
      const draw = (x: number, y: number, w: number) => {
        for (let r = 0; r < 4; r++) {
          const inset = Math.max(0, 3 - r) ;
          s.hline(x + inset, y + r, w - inset * 2, shade("earth", r === 0 ? 6 : 4 - Math.floor(r / 2)));
        }
      };
      draw(0, 4, 10);
      draw(6, 9, 10);
      break;
    }
    case Terrain.Mountains: {
      speckle(s, "stone", 2, salt, 0.2);
      const peak = (px: number, py: number, hgt: number) => {
        for (let r = 0; r < hgt; r++) {
          const w = 1 + r * 2;
          const x0 = px - r;
          s.hline(x0, py + r, w, shade("stone", 3));
          s.set(x0, py + r, shade("stone", 5)); // lit left face
          s.set(x0 + w - 1, py + r, shade("stone", 1)); // shaded right
          if (r < 2) s.hline(x0, py + r, w, shade("snow", 6));
        }
      };
      peak(5, 2, 8);
      peak(12, 6, 6);
      break;
    }
    case Terrain.Desert:
      speckle(s, "sand", 4, salt, 0.25);
      s.hline(2, 5, 6, shade("sand", 6));
      s.hline(7, 11, 7, shade("sand", 6));
      s.hline(3, 6, 6, shade("sand", 2));
      s.hline(8, 12, 7, shade("sand", 2));
      break;
    case Terrain.Tundra:
      speckle(s, "swamp", 4, salt, 0.3);
      for (let i = 0; i < 5; i++) {
        const x = Math.floor(h(i, variant, 11) * 14);
        const y = Math.floor(h(variant, i, 12) * 14);
        s.hline(x, y, 2, shade("snow", 6));
      }
      break;
    case Terrain.Arctic:
      speckle(s, "snow", 6, salt, 0.2);
      s.hline(1, 4, 5, shade("snow", 3));
      s.hline(9, 10, 5, shade("snow", 3));
      s.hline(2, 3, 4, shade("snow", 7));
      s.hline(10, 9, 4, shade("snow", 7));
      break;
    case Terrain.Swamp:
      speckle(s, "swamp", 3, salt, 0.3);
      for (let i = 0; i < 4; i++) {
        const x = Math.floor(h(i, variant, 13) * 12);
        const y = Math.floor(h(variant, i, 14) * 12);
        s.hline(x, y, 4, shade("ocean", 3));
        s.vline(x + 1, y - 2, 2, shade("swamp", 1));
      }
      break;
    case Terrain.Jungle:
      speckle(s, "jungle", 2, salt, 0.25);
      bush(s, 1, 1, "jungle");
      bush(s, 9, 3, "jungle");
      bush(s, 4, 8, "jungle");
      bush(s, 10, 11, "jungle");
      bush(s, 0, 12, "jungle");
      break;
  }
  return s;
}

const VARIANTS = 4;
const cache = new Map<number, Surface>();

export function getTile(terrain: Terrain, x: number, y: number): Surface {
  const variant = (x * 3 + y * 5) % VARIANTS;
  const key = terrain * VARIANTS + variant;
  let t = cache.get(key);
  if (!t) {
    t = build(terrain, variant);
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

/** Special-resource marker: a small diamond in the tile's lit shade. */
export function drawSpecial(s: Surface, dx: number, dy: number, terrain: Terrain): void {
  const ramp =
    terrain === Terrain.Ocean ? "ocean" : terrain === Terrain.Desert ? "sand" : "plains";
  const c = shade(ramp, 7);
  const o = C.BLACK!;
  const cx = dx + 11;
  const cy = dy + 11;
  s.set(cx, cy - 2, o);
  s.hline(cx - 1, cy - 1, 3, c);
  s.hline(cx - 2, cy, 5, c);
  s.hline(cx - 1, cy + 1, 3, c);
  s.set(cx, cy + 2, o);
  s.set(cx - 2, cy, o);
  s.set(cx + 2, cy, o);
}

