import { hash } from "@civ/renderer-api";
import { drawTextLargeRinged, FONT_HEIGHT, textWidthLarge } from "./font.js";
import { C, DIMMED, shade } from "./palette.js";
import type { Surface } from "./surface.js";

/**
 * Fireworks over a city just taken (asked for 2026-10-27: a celebration "+ animation if player won"):
 * dusk falls over the map (the city kept lit, as the window that follows keeps it), rockets climb from
 * the city one after another trailing sparks, and burst above it in rings of sparks that spread, droop
 * and fade. Gold, the conqueror's colour and the bright EGA colours, a rocket each; everything placed by
 * a hash of the rocket, never the game's RNG, so a frame at `t` is always the same picture. Drawn on the
 * fine grid, in screen pixels about the city's square.
 */

/** Rockets in the show. */
export const ROCKETS = 9;
/** When each rocket leaves (share of the show), how long it climbs, how long its burst lasts. */
const LAUNCH_GAP = 0.058;
const RISE = 0.085;
const BURST = 0.38;
/** Sparks in a burst's outer ring, and its inner one. */
const SPARKS = 24;
const INNER = 12;
/** How long dusk takes to fall (share of the show); it stays, the window after it darkening the map as much. */
const DUSK = 0.1;
/** The dither the dusk falls through, as the fog's edge does. */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((n) => (n + 0.5) / 16);

/** A rocket's colours, bright to dim. */
type Colours = readonly [number, number, number];

function rocketColours(i: number, color: number, dark: number): Colours {
  const sets: Colours[] = [
    [shade("wheat", 7), shade("wheat", 5), shade("wheat", 2)],
    [C.WHITE!, color, dark],
    [C.WHITE!, C.LCYAN!, C.CYAN!],
    [C.YELLOW!, C.LRED!, C.RED!],
    [C.WHITE!, C.LMAGENTA!, C.MAGENTA!],
    [shade("wheat", 7), C.YELLOW!, C.ORANGE!],
    [C.WHITE!, C.LGREEN!, C.GREEN!],
  ];
  return sets[i % sets.length]!;
}

/** A block of fine pixels `n` across about fine (x, y), kept inside `clip` (fine pixels). */
function dot(s: Surface, x: number, y: number, n: number, color: number, clip: Clip): void {
  const x0 = Math.round(x - n / 2);
  const y0 = Math.round(y - n / 2);
  if (x0 < clip.x0 || y0 < clip.y0 || x0 + n > clip.x1 || y0 + n > clip.y1) return;
  s.frect(x0, y0, n, n, color);
}

type Clip = { x0: number; y0: number; x1: number; y1: number };

/**
 * The show at `t` (0..1) over the square whose top left is screen (sx, sy), in the colour of the
 * civilization celebrating (`color`, its darker partner `dark`), on the map's view from (`left`, `top`)
 * to the surface's edges; `cheer` stands under the city's name in large gold capitals from the first
 * burst on (over the bursts when the view's foot is near).
 */
export function drawFireworks(s: Surface, sx: number, sy: number, t: number, color: number, dark: number, cheer?: string, left = 0, top = 0): void {
  const k = s.k;
  const clip: Clip = { x0: left * k, y0: top * k, x1: s.fw, y1: s.fh };
  // Dusk over the view, the city's square kept lit.
  const dusk = Math.min(1, t / DUSK);
  if (dusk > 0) {
    const kx0 = sx * k, kx1 = (sx + 16) * k, ky0 = sy * k, ky1 = (sy + 16) * k;
    for (let y = clip.y0; y < clip.y1; y++) {
      const row = y * s.fw;
      const lit = y >= ky0 && y < ky1;
      for (let x = clip.x0; x < clip.x1; x++) {
        if (lit && x >= kx0 && x < kx1) continue;
        if (BAYER[(y & 3) * 4 + (x & 3)]! < dusk) s.data[row + x] = DIMMED[s.data[row + x]!]!;
      }
    }
  }
  // The square's middle, in fine pixels.
  const cx = (sx + 8) * k;
  const cy = (sy + 6) * k;
  for (let i = 0; i < ROCKETS; i++) {
    const start = i * LAUNCH_GAP + hash(i, 1, 41) * 0.02;
    const el = t - start;
    if (el < 0 || el > RISE + BURST) continue;
    const [bright, mid, dim] = rocketColours(i, color, dark);
    // Where it bursts: up to two squares either side, one and a half to four squares up.
    const side = (i % 2 ? 1 : -1) * (0.15 + hash(i, 2, 41) * 0.85);
    const bx = cx + side * 34 * k;
    const by = cy - (24 + hash(i, 3, 41) * 38) * k;
    const lx = cx + (hash(i, 4, 41) - 0.5) * 8 * k;
    if (el < RISE) {
      // Climbing, slowing as it goes, sparks falling off behind it.
      const u = el / RISE;
      const e = 1 - (1 - u) * (1 - u);
      const x = lx + (bx - lx) * e;
      const y = cy + (by - cy) * e;
      for (let j = 1; j <= 5; j++) {
        const back = Math.max(0, e - j * 0.05);
        dot(s, lx + (bx - lx) * back + (hash(i, j, 43) - 0.5) * 3, cy + (by - cy) * back + j, j < 3 ? 2 : 1, j < 3 ? mid : dim, clip);
      }
      dot(s, x, y, 3, bright, clip);
      continue;
    }
    // The burst: a flash at its heart, then rings of sparks flying out, drooping and dimming as they fall.
    const u = (el - RISE) / BURST;
    if (u < 0.12) {
      const r = (3 + u * 40) * k;
      for (let a = 0; a < 12; a++) dot(s, bx + Math.cos((a * Math.PI) / 6) * r, by + Math.sin((a * Math.PI) / 6) * r, 2, C.WHITE!, clip);
      dot(s, bx, by, 6 - Math.round(u * 30), C.WHITE!, clip);
    }
    const reach = (16 + hash(i, 5, 41) * 10) * k;
    const spread = 1 - (1 - u) * (1 - u) * (1 - u);
    const droop = u * u * 10 * k;
    const ink = u < 0.22 ? bright : u < 0.62 ? mid : dim;
    const size = u < 0.3 ? 3 : u < 0.7 ? 2 : 1;
    const turn = hash(i, 6, 41) * Math.PI;
    for (const [n, share, salt] of [[SPARKS, 1, 45], [INNER, 0.5, 49]] as const) {
      for (let j = 0; j < n; j++) {
        // A few sparks die early, so the rings thin as they fade.
        if (u > 0.6 + hash(i, j, salt + 2) * 0.4) continue;
        const a = (j / n) * Math.PI * 2 + turn + (share < 1 ? Math.PI / n : 0);
        const d = reach * share * spread * (0.9 + hash(i, j, salt) * 0.2);
        const fall = droop * (0.6 + share * 0.4);
        const x = bx + Math.cos(a) * d;
        const y = by + Math.sin(a) * d + fall;
        // Its tail, back toward the burst's heart.
        for (const back of [0.78, 0.6]) dot(s, bx + Math.cos(a) * d * back, by + Math.sin(a) * d * back + fall * back, 1, back > 0.7 ? mid : dim, clip);
        dot(s, x, y, share < 1 ? Math.max(1, size - 1) : size, share < 1 && u < 0.3 ? mid : ink, clip);
      }
    }
  }
  if (!cheer || t < RISE) return;
  // The cheer, from the first burst on: under the city's name, clear of the bursts (over them near the view's foot).
  const words = cheer.toUpperCase();
  const w = textWidthLarge(words, 2);
  const x = Math.max(left + 2, Math.min(s.width - w - 2, sx + 8 - (w >> 1)));
  const below = sy + 16 + FONT_HEIGHT + 4;
  const y = below + 2 * FONT_HEIGHT + 2 <= s.height ? below : Math.max(top + 2, sy - 88);
  drawTextLargeRinged(s, x, y, words, shade("wheat", 7), shade("hide", 0));
}
