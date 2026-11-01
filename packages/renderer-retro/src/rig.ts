import { C, shade } from "./palette.js";
import type { Surface } from "./surface.js";

/**
 * An oil rig (`Tile.rig`, built by a Fishing Boat on oil at sea; since save version 55), drawn over its sea square at
 * the fine grain: a steel deck on four legs standing in the water, foam where they meet it, a lattice derrick on the
 * deck and a small flame at the end of a boom. Our own drawing, until the user's picture of one comes.
 */
export function drawRig(s: Surface, dx: number, dy: number): void {
  const k = s.k;
  const x0 = dx * k;
  const y0 = dy * k;
  const n = 16 * k; // fine pixels a square
  const at = (f: number) => Math.round(f * n);
  const lit = shade("steel", 6);
  const mid = shade("steel", 4);
  const dark = shade("steel", 1);
  const dot = (x: number, y: number, c: number) => s.fset(x0 + x, y0 + y, c);
  const line = (ax: number, ay: number, bx: number, by: number, c: number) => {
    const steps = Math.max(Math.abs(bx - ax), Math.abs(by - ay));
    for (let i = 0; i <= steps; i++) dot(Math.round(ax + ((bx - ax) * i) / steps), Math.round(ay + ((by - ay) * i) / steps), c);
  };
  const deckTop = at(0.56);
  const water = at(0.84);
  // The legs, lit on the left, and the foam round their feet.
  for (const f of [0.28, 0.42, 0.58, 0.72]) {
    const lx = at(f);
    s.frect(x0 + lx, y0 + deckTop + 2, 1, water - deckTop - 2, mid);
    s.frect(x0 + lx + 1, y0 + deckTop + 2, 1, water - deckTop - 2, dark);
    dot(lx - 1, water, C.WHITE!);
    dot(lx + 2, water, C.WHITE!);
    dot(lx, water + 1, shade("ice", 5));
    dot(lx + 1, water + 1, shade("ice", 5));
  }
  // The deck, its top edge lit, its underside dark.
  const left = at(0.24);
  const right = at(0.78);
  s.frect(x0 + left, y0 + deckTop, right - left, 1, lit);
  s.frect(x0 + left, y0 + deckTop + 1, right - left, 1, dark);
  // The derrick: two struts meeting at its crown, braced across.
  const baseL = at(0.36);
  const baseR = at(0.56);
  const top = at(0.16);
  const crown = Math.round((baseL + baseR) / 2);
  line(baseL, deckTop - 1, crown, top, lit);
  line(baseR, deckTop - 1, crown, top, mid);
  for (let y = top + 3; y < deckTop - 1; y += 3) {
    const t = (y - top) / (deckTop - 1 - top);
    const l = Math.round(crown + (baseL - crown) * t);
    const r = Math.round(crown + (baseR - crown) * t);
    line(l + 1, y, r - 1, y, mid);
  }
  dot(crown, top - 1, lit);
  // The flare boom off the deck's right end, and its flame.
  const bx = at(0.86);
  const by = at(0.42);
  line(right - 1, deckTop - 1, bx, by, mid);
  s.frect(x0 + bx, y0 + by - 2, 2, 2, C.YELLOW!);
  dot(bx, by - 3, C.LRED!);
  dot(bx + 1, by - 4, C.LRED!);
}
