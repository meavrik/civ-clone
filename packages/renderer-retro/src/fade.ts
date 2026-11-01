import type { FineCopy } from "./art-holes.js";
import type { Surface } from "./surface.js";

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((n) => (n + 0.5) / 16);

/**
 * What was drawn over `copy` since it was taken, shown at `opacity` (0..1) through the Bayer dither: each fine pixel
 * drawn since stays where the dither is under `opacity`, else goes back to what it was. The palette has no
 * transparency, so this is how the unit in play's shield and marks fade with its picture (`activeOpacity`).
 */
export function fadeOver(s: Surface, copy: FineCopy, opacity: number): void {
  if (opacity >= 1) return;
  const k = s.k, fw = copy.w * k, fh = copy.h * k;
  const x0 = copy.x * k, y0 = copy.y * k;
  for (let j = 0; j < fh; j++)
    for (let i = 0; i < fw; i++) {
      const fx = x0 + i, fy = y0 + j;
      if (fx < 0 || fy < 0 || fx >= s.fw || fy >= s.fh) continue;
      if (BAYER[(fy & 3) * 4 + (fx & 3)]! >= opacity) s.fset(fx, fy, copy.data[j * fw + i]!);
    }
}
