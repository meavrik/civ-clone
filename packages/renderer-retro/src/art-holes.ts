import type { ArtBox } from "@civ/renderer-api";
import { DIMMED } from "./palette.js";
import { SPRITE_CLEAR } from "./sprites/sheet.js";
import type { Surface } from "./surface.js";

/**
 * Holes in a picture laid over the canvas (`ArtSpot.holes`) where the fine pixels `on` of a grid `fw` by `fh`
 * fine pixels lie, its top left at screen (x, y), `k` fine pixels a screen pixel: a box a run of them along a
 * row, runs alike in rows one after another one box.
 */
export function runHoles(fw: number, fh: number, k: number, x: number, y: number, on: (i: number, j: number) => boolean): ArtBox[] {
  const out: ArtBox[] = [];
  let last: { key: string; boxes: ArtBox[] } | null = null;
  for (let j = 0; j < fh; j++) {
    const runs: [number, number][] = [];
    for (let i = 0; i < fw; i++) {
      if (!on(i, j)) continue;
      const run = runs[runs.length - 1];
      if (run && run[1] === i) run[1] = i + 1;
      else runs.push([i, i + 1]);
    }
    const key = runs.join(" ");
    if (!runs.length) last = null;
    else if (last && last.key === key) for (const b of last.boxes) b.h += 1 / k;
    else {
      const boxes = runs.map(([a, b]) => ({ x: x + a / k, y: y + j / k, w: (b - a) / k, h: 1 / k }));
      out.push(...boxes);
      last = { key, boxes };
    }
  }
  return out;
}

/** Where sprite `sprite` blitted at screen (dx, dy) leaves its pixels, as holes for a picture under it. */
export function spriteHoles(sprite: Surface, dx: number, dy: number): ArtBox[] {
  return runHoles(sprite.fw, sprite.fh, sprite.k, dx, dy, (i, j) => sprite.fget(i, j) !== SPRITE_CLEAR);
}

/** The fine pixels of a box of a surface as they were (`fineCopy`), to tell later what was drawn over them (`drawnOver`). */
export interface FineCopy { x: number; y: number; w: number; h: number; data: Uint8Array }

/** A copy of the fine pixels of `s` under the box (x, y) `w` by `h` screen pixels. */
export function fineCopy(s: Surface, x: number, y: number, w: number, h: number): FineCopy {
  const k = s.k, fw = w * k, fh = h * k;
  const data = new Uint8Array(fw * fh);
  for (let j = 0; j < fh; j++) for (let i = 0; i < fw; i++) data[j * fw + i] = s.fget(x * k + i, y * k + j);
  return { x, y, w, h, data };
}

/**
 * Holes where `s` has changed since `copy` was taken: what a screen drew over a picture's place after laying the
 * picture there (a unit's shield, a burst, a route's dot), which shows over it as it would over a drawn one. A pixel
 * only darkened (`DIMMED`: the dusk of fireworks) is the same ground, not a mark.
 */
export function drawnOver(s: Surface, copy: FineCopy): ArtBox[] {
  const k = s.k, fw = copy.w * k;
  const x0 = copy.x * k, y0 = copy.y * k;
  const inside = (fx: number, fy: number) => fx >= 0 && fy >= 0 && fx < s.fw && fy < s.fh;
  const changed = (now: number, was: number) => now !== was && now !== DIMMED[was];
  return runHoles(fw, copy.h * k, k, copy.x, copy.y, (i, j) => inside(x0 + i, y0 + j) && changed(s.fget(x0 + i, y0 + j), copy.data[j * fw + i]!));
}
