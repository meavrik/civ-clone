import { C, shade } from "./palette.js";
import type { Surface } from "./surface.js";

/**
 * A fishery (`Tile.fishery`, laid by a Fishing Boat; since save version 53), drawn over its sea square at the fine
 * grain: two timber stakes and the line of a net hung between them, sagging under the water, its floats bobbing on
 * it red and white. Our own drawing, until the user's picture of one comes.
 */
export function drawFishery(s: Surface, dx: number, dy: number): void {
  const k = s.k;
  const x0 = dx * k;
  const y0 = dy * k;
  const n = 16 * k; // fine pixels a square
  const at = (f: number) => Math.round(f * n);
  const stake = shade("earth", 3);
  const stakeDark = shade("earth", 1);
  const rope = shade("earth", 2);
  // The stakes, lit on the left.
  for (const sx of [at(0.16), at(0.84)]) {
    s.frect(x0 + sx, y0 + at(0.42), 1, at(0.38), stake);
    s.frect(x0 + sx + 1, y0 + at(0.42), 1, at(0.38), stakeDark);
  }
  // The net's line, sagging between them, and its floats along it.
  const left = at(0.16) + 1;
  const right = at(0.84);
  const top = at(0.48);
  const sag = at(0.2);
  const yAt = (x: number) => top + Math.round(sag * Math.sin((Math.PI * (x - left)) / (right - left)));
  for (let x = left; x <= right; x++) if ((x - left) % 2 === 0) s.fset(x0 + x, y0 + yAt(x), rope);
  const floats = 5;
  for (let i = 1; i <= floats; i++) {
    const x = Math.round(left + ((right - left) * i) / (floats + 1));
    const y = yAt(x) - 1;
    const c = i % 2 ? C.LRED! : C.WHITE!;
    s.frect(x0 + x - 1, y0 + y, 2, 2, c);
    s.frect(x0 + x - 1, y0 + y + 2, 2, 1, shade("earth", 0));
  }
}
