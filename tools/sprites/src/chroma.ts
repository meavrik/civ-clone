/**
 * A sheet drawn on a green screen (the militia's won and lost moves, 2026-10-30: pure green behind the figures, no
 * transparency) made clear behind its figures, the figures' own pixels untouched: a pixel is as green as its green
 * exceeds its red and blue (nothing in the art is green: skin, cloth, wood and outlines all have less green than red).
 * Up to `KEEP` it is the figure's, as it is; from `CLEAR` on, the screen, made clear; between, an edge blended with the
 * screen, made that much clear and its green brought down to its red or blue, whichever is higher, so no green fringe
 * shows on the map. In place, RGBA.
 */
export const KEEP = 30;
export const CLEAR = 160;

export function keyGreen(data: Uint8Array): void {
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]!, g = data[i + 1]!, b = data[i + 2]!;
    const green = g - Math.max(r, b);
    if (green <= KEEP) continue;
    if (green >= CLEAR) { data[i] = data[i + 1] = data[i + 2] = data[i + 3] = 0; continue; }
    data[i + 1] = Math.max(r, b);
    data[i + 3] = Math.round((data[i + 3]! * (CLEAR - green)) / (CLEAR - KEEP));
  }
}
