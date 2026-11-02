import { C, shade } from "./palette.js";
import { SCREEN_H, type Surface } from "./surface.js";

/**
 * A window standing by a square of the map and pointing at it (the Building Completed and conquest windows since
 * 2026-10-25, the square's window since 2026-11-01, asked for: "the tile should be highlited and info window points
 * with an arrow towards the tile"): above the square, else below, right or left of it, a point of the window's stone
 * reaching to a ring round the square, which stays lit while the rest darkens.
 */

type Rect = { x: number; y: number; w: number; h: number };

/** How far the point reaches from the window's edge toward the square's ring. */
export const POINT = 6;
/** The ring round the square: black outside, gold within. */
export const RING = 2;

type Side = "above" | "below" | "right" | "left";
/** Where the window stands: its rect, the side of the square it stands on and where its point ends (null when centred). */
export interface PointedPlace {
  win: Rect;
  side: Side | null;
  /** The point's tip, on the ring's edge. */
  tip: { x: number; y: number } | null;
  /** The window and its point together (what grows on opening). */
  bounds: Rect;
}

/**
 * A window of `size` on a screen `screenW` wide, standing by `square` (screen pixels) and below `top` (the menu
 * bar's foot): above it if there is room, else below, right or left; centred when there is no square or no room.
 */
export function pointedPlace(screenW: number, square: Rect | undefined, size: { w: number; h: number }, top: number): PointedPlace {
  const { w, h } = size;
  const centred = { win: { x: Math.floor((screenW - w) / 2), y: Math.floor((SCREEN_H - h) / 2), w, h }, side: null, tip: null };
  if (!square) return { ...centred, bounds: centred.win };
  const cx = square.x + (square.w >> 1);
  const cy = square.y + (square.h >> 1);
  // The shadow (2 pixels down and right) on the screen.
  const xIn = (x: number) => Math.max(1, Math.min(screenW - w - 3, x));
  const yIn = (y: number) => Math.max(top, Math.min(SCREEN_H - h - 3, y));
  // The point's foot along the window's edge, kept off its corners.
  const along = (c: number, from: number, len: number) => Math.max(from + POINT + 2, Math.min(from + len - POINT - 3, c));
  const reach = RING + POINT;
  const above = square.y - reach - h;
  if (above >= top) {
    const win = { x: xIn(cx - (w >> 1)), y: above, w, h };
    return { win, side: "above", tip: { x: along(cx, win.x, w), y: square.y - RING - 1 }, bounds: { ...win, h: h + POINT } };
  }
  const below = square.y + square.h + reach;
  if (below + h + 2 <= SCREEN_H) {
    const win = { x: xIn(cx - (w >> 1)), y: below, w, h };
    return { win, side: "below", tip: { x: along(cx, win.x, w), y: square.y + square.h + RING }, bounds: { ...win, y: below - POINT, h: h + POINT } };
  }
  const right = square.x + square.w + reach;
  if (right + w + 2 <= screenW) {
    const win = { x: right, y: yIn(cy - (h >> 1)), w, h };
    return { win, side: "right", tip: { x: square.x + square.w + RING, y: along(cy, win.y, h) }, bounds: { ...win, x: right - POINT, w: w + POINT } };
  }
  const left = square.x - reach - w;
  if (left >= 1) {
    const win = { x: left, y: yIn(cy - (h >> 1)), w, h };
    return { win, side: "left", tip: { x: square.x - RING - 1, y: along(cy, win.y, h) }, bounds: { ...win, w: w + POINT } };
  }
  return { ...centred, bounds: centred.win };
}

/** The widest window that stands beside `square` (right or left of it) on a screen `screenW` wide, point and shadow included. */
export function sideRoom(screenW: number, square: Rect): number {
  const reach = RING + POINT;
  return Math.max(screenW - (square.x + square.w + reach) - 2, square.x - reach - 1);
}

/** The square ringed: black outside, gold within, so it shows on any ground. */
export function drawSquareRing(s: Surface, q: Rect): void {
  s.frame(q.x - 2, q.y - 2, q.w + 4, q.h + 4, C.BLACK!);
  s.frame(q.x - 1, q.y - 1, q.w + 2, q.h + 2, shade("wheat", 6));
}

/**
 * The window's point: a wedge of its stone, rimmed in black, from its edge (joining the stone through
 * the frame) to the tip on the square's ring, narrowing a pixel a side each step.
 */
export function drawWindowPoint(s: Surface, p: PointedPlace): void {
  const { side, tip, win } = p;
  if (!side || !tip) return;
  // Step i from the window's edge (0, the frame's line) to the tip (POINT).
  for (let i = 0; i <= POINT; i++) {
    const half = POINT - i;
    const span = (c: number, r: number, color: number) => {
      if (side === "above" || side === "below") {
        const y = side === "above" ? win.y + win.h - 1 + i : win.y - i;
        s.hline(c - r, y, 2 * r + 1, color);
      } else {
        const x = side === "left" ? win.x + win.w - 1 + i : win.x - i;
        s.vline(x, c - r, 2 * r + 1, color);
      }
    };
    const c = side === "above" || side === "below" ? tip.x : tip.y;
    span(c, half, C.BLACK!);
    if (half >= 1) span(c, half - 1, shade("panel", 5));
  }
}
