import { C, shade } from "./palette.js";
import type { Surface } from "./surface.js";

/**
 * Inks for text on the stone, every panel in the game: black, a dark grey for what matters
 * less, and darker accents (the bright EGA colours are lost on light grey).
 */
export const INK = C.BLACK!;
export const DIM = shade("panel", 1);
export const FADED = shade("panel", 2);
export const GOOD = shade("grass", 0);
export const BAD = C.RED!;
export const NOTE = C.BLUE!;
export const GOLD = C.BROWN!;

/**
 * Speckle for the stone: -1 a dark speck, 1 a light one, 0 the face. A fixed 64x64
 * pattern laid by screen position, so the grain never crawls as panels redraw.
 */
const SPECKLE = (() => {
  const t = new Int8Array(64 * 64);
  for (let i = 0; i < t.length; i++) {
    let h = Math.imul(i ^ 0x9e3779b9, 0x85ebca6b);
    h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
    h = (h ^ (h >>> 16)) & 15;
    t[i] = h < 3 ? -1 : h < 5 ? 1 : 0;
  }
  return t;
})();

/** Fill a rectangle with a chrome ramp's face (shade 5), speckled with shades 4 and 6. */
export function stipple(s: Surface, x: number, y: number, w: number, h: number, ramp: string): void {
  speckle(s, x, y, w, h, shade(ramp, 4), shade(ramp, 5), shade(ramp, 6));
}

/** Fill a rectangle with `face`, speckled with `dark` and `light` in the stone's grain (any three colours). */
export function speckle(s: Surface, x: number, y: number, w: number, h: number, dark: number, face: number, light: number): void {
  // Laid in fine pixels, so the grain is as fine as the screen.
  const k = s.k;
  const x0 = Math.max(0, x * k);
  const y0 = Math.max(0, y * k);
  const x1 = Math.min(s.fw, (x + w) * k);
  const y1 = Math.min(s.fh, (y + h) * k);
  for (let yy = y0; yy < y1; yy++)
    for (let xx = x0; xx < x1; xx++) {
      const g = SPECKLE[(yy & 63) * 64 + (xx & 63)]!;
      s.data[yy * s.fw + xx] = g < 0 ? dark : g > 0 ? light : face;
    }
}
