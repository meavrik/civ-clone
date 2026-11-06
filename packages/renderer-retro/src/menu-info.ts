import type { MenuInfo } from "@civ/renderer-api";
import { drawIconLine, iconLineWidth, wrapIcons } from "./icons.js";
import { C, shade } from "./palette.js";
import { SCREEN_H, type Surface } from "./surface.js";
import { INK, NOTE } from "./stone.js";

/**
 * The build menu's info (asked for 2026-11-02: "on the build menu - add for each building/unit a info icon - when
 * clicked or hover show building/unit info"; `MenuState.info`): a small blue disc with a white i at a row's right end,
 * and the tip it opens beside it, a stone box as the status panel's tips are, the name over a rule and the lines under
 * it, its point reaching to the mark. The tip keeps the font's size on the phone, as the square's window does. The
 * research list's tip hangs from a gold disc with a white arrow, what comes next (`MenuState.more`).
 */

/** The mark's side in screen pixels at the font's size; twice it with words twice the font's (the phone's). */
export const INFO_MARK = 7;

const MARK = [
  "....oooooo....",
  "..oobbbbbboo..",
  ".obbbbwwbbbbo.",
  ".obbbbwwbbbbo.",
  "obbbbbbbbbbbbo",
  "obbbbbbbbbbbbo",
  "obbbbwwwbbbbbo",
  "obbbbbwwbbbbbo",
  "obbbbbwwbbbbbo",
  "obbbbbwwbbbbbo",
  ".obbbbwwbbbbo.",
  ".obbbwwwwbbbo.",
  "..oobbbbbboo..",
  "....oooooo....",
];

const NEXT_MARK = [
  "....oooooo....",
  "..oobbbbbboo..",
  ".obbbbbbbbbbo.",
  ".obbbbwwbbbbo.",
  "obbbbbbwwbbbbo",
  "obbbbbbbwwbbbo",
  "obwwwwwwwwwbbo",
  "obwwwwwwwwwbbo",
  "obbbbbbbwwbbbo",
  "obbbbbbwwbbbbo",
  ".obbbbwwbbbbo.",
  ".obbbbbbbbbbo.",
  "..oobbbbbboo..",
  "....oooooo....",
];

/** A mark's drawing at screen (x, y), `t` times its size (a fine pixel of the drawing to each of the screen's at 1). */
function drawMark(s: Surface, grid: string[], inks: Record<string, number>, x: number, y: number, t: 1 | 2): void {
  // The drawing is two fine pixels to a screen pixel at the font's size.
  const n = (t * s.k) / 2;
  grid.forEach((row, j) => [...row].forEach((ch, i) => {
    if (ch === ".") return;
    for (let b = 0; b < n; b++) for (let a = 0; a < n; a++) s.fset(x * s.k + i * n + a, y * s.k + j * n + b, inks[ch]!);
  }));
}

/** The blue mark; lit while its tip shows. */
export function drawInfoMark(s: Surface, x: number, y: number, t: 1 | 2, lit: boolean): void {
  drawMark(s, MARK, { o: shade("azure", 0), b: shade("azure", lit ? 6 : 4), w: C.WHITE! }, x, y, t);
}

/** The gold mark of what comes next; lit while its tip shows. */
export function drawNextMark(s: Surface, x: number, y: number, t: 1 | 2, lit: boolean): void {
  drawMark(s, NEXT_MARK, { o: shade("plains", 0), b: shade("plains", lit ? 5 : 3), w: C.WHITE! }, x, y, t);
}

/** The tip's widest line before it wraps, and its line's height. */
const TIP_W = 180;
const TIP_LINE = 9;

/** Where the tip for a mark at `mark` stands on a screen `screenW` wide: right of the mark, else left of it, its middle level with the mark. */
export function menuTipRect(info: MenuInfo, mark: { x: number; y: number; w: number; h: number }, screenW: number): { x: number; y: number; w: number; h: number; lines: string[]; right: boolean } {
  const lines = info.lines.flatMap((l) => wrapIcons(l, TIP_W - 10));
  const w = Math.max(iconLineWidth(info.title), ...lines.map((l) => iconLineWidth(l))) + 10;
  const h = 6 + TIP_LINE + (lines.length ? 3 + lines.length * TIP_LINE : 0);
  const right = mark.x + mark.w + 5 + w <= screenW - 2;
  const x = right ? mark.x + mark.w + 5 : Math.max(2, mark.x - 5 - w);
  const mid = mark.y + (mark.h >> 1);
  const y = Math.max(2, Math.min(SCREEN_H - 2 - h, mid - (h >> 1)));
  return { x, y, w, h, lines, right };
}

/**
 * What the tip holds, on its stone box (`rect`, `menuTipRect`, framed in black and laid with stone by the window
 * drawing it): the name in the tip's ink over a rule, its lines under it, and a black-rimmed wedge from its side
 * toward the mark.
 */
export function drawMenuTip(s: Surface, info: MenuInfo, mark: { x: number; y: number; w: number; h: number }, rect: ReturnType<typeof menuTipRect>): void {
  const { x, y, w, h, lines, right } = rect;
  drawIconLine(s, x + 5, y + 3, info.title, NOTE);
  if (lines.length) {
    s.hline(x + 3, y + 4 + TIP_LINE, w - 6, shade("panel", 2));
    s.hline(x + 3, y + 5 + TIP_LINE, w - 6, shade("panel", 7));
    lines.forEach((l, i) => drawIconLine(s, x + 5, y + 7 + TIP_LINE + i * TIP_LINE, l, INK));
  }
  // Pointing at the mark, where the box stands beside it.
  const edge = right ? x : x + w - 1;
  if (right ? edge <= mark.x + mark.w : edge >= mark.x) return;
  const py = Math.max(y + 4, Math.min(y + h - 5, mark.y + (mark.h >> 1)));
  const out = right ? -1 : 1;
  for (let i = 0; i < 4; i++) {
    s.vline(edge + out * i, py - (3 - i), 2 * (3 - i) + 1, C.BLACK!);
    if (i < 3) s.vline(edge + out * i, py - (2 - i), 2 * (2 - i) + 1, shade("panel", 5));
  }
}
