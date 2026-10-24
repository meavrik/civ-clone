import { GOVERNMENTS, type GameState } from "@civ/core";
import { empireIncome, type RateRow, type RatesHit } from "@civ/renderer-api";
import { drawText, textWidth } from "../font.js";
import { drawIcon, drawIconLine, ICON } from "../icons.js";
import { C, shade } from "../palette.js";
import { SCREEN_H, SCREEN_W, type Surface } from "../surface.js";
import { DIM, dimScreen, drawButton, drawCloseBox, drawWindow, FADED, INK, TITLE_H } from "../widgets.js";

/**
 * The rates window (redone 2026-10-24, asked for: the old full-screen bars were "not good"): a stone
 * window over the game, as the game's other windows are, with a row for each of tax, luxuries and
 * science: its icon and name, a - and a + button, ten blocks (filled to the rate, dark past the
 * government's limit) and the figure; under them what the empire's cities bring in a turn at these
 * rates; Done at the foot. Science takes what tax and luxuries leave; moving it takes from tax.
 */

type Rect = { x: number; y: number; w: number; h: number };
const WIN = { w: 236, h: 112 };
export const RATE_ROWS: readonly RateRow[] = ["tax", "lux", "sci"];
const ROW_H = 16;
const BLOCKS = 10;
const BLOCK = { w: 9, pitch: 11, h: 9 };

/** The window, centred on a screen `screenW` wide (the phone's map is wider than 320). */
export function ratesRect(screenW = SCREEN_W): Rect {
  return { x: Math.floor((screenW - WIN.w) / 2), y: Math.floor((SCREEN_H - WIN.h) / 2), ...WIN };
}

/** Where a row's parts stand: its top, the - and + buttons and its first block. */
function rowLayout(o: Rect, i: number) {
  const y = o.y + TITLE_H + 9 + i * ROW_H;
  const minus = { x: o.x + 64, y: y - 1, w: 11, h: 11 };
  const blocks = { x: minus.x + minus.w + 5, y: y, w: BLOCKS * BLOCK.pitch - (BLOCK.pitch - BLOCK.w), h: BLOCK.h };
  const plus = { x: blocks.x + blocks.w + 5, y: y - 1, w: 11, h: 11 };
  return { y, minus, blocks, plus };
}

/** The foot of the window, where the income line runs (Done stood here until 2026-10-24: the close box answers instead). */
function footRect(o: Rect): Rect {
  return { x: o.x + o.w - 52, y: o.y + o.h - 17, w: 46, h: 12 };
}

const inRect = (b: Rect, px: number, py: number) => px >= b.x && px < b.x + b.w && py >= b.y && py < b.y + b.h;

/**
 * The rates bar under a point (a little round it counts too) and the rate, 0-10, that point stands
 * for; null off the bars. `held`: a finger sliding along a bar keeps it past either end (the phone).
 */
export function ratesAt(px: number, py: number, held = false, screenW = SCREEN_W): { row: RateRow; value: number } | null {
  const o = ratesRect(screenW);
  for (let i = 0; i < RATE_ROWS.length; i++) {
    const { blocks } = rowLayout(o, i);
    if (py < blocks.y - 3 || py >= blocks.y + blocks.h + 3) continue;
    if (!held && (px < blocks.x - 6 || px > blocks.x + blocks.w + 6)) return null;
    return { row: RATE_ROWS[i]!, value: Math.max(0, Math.min(BLOCKS, Math.round((px - blocks.x) / BLOCK.pitch + 0.5))) };
  }
  return null;
}

/** What a click on the window asks: a block (that rate), a - or + button (a step), or the close box (done); null elsewhere on the window and off it. */
export function ratesHit(px: number, py: number, screenW = SCREEN_W): RatesHit | null {
  const o = ratesRect(screenW);
  if (px >= o.x + o.w - 3 - (TITLE_H - 2) - 3 && px < o.x + o.w - 3 && py >= o.y + 3 && py < o.y + 3 + TITLE_H) return { kind: "done" };
  for (let i = 0; i < RATE_ROWS.length; i++) {
    const { minus, plus } = rowLayout(o, i);
    if (inRect(minus, px, py)) return { kind: "step", row: RATE_ROWS[i]!, delta: -1 };
    if (inRect(plus, px, py)) return { kind: "step", row: RATE_ROWS[i]!, delta: 1 };
  }
  const bar = ratesAt(px, py, false, screenW);
  return bar ? { kind: "set", ...bar } : null;
}

/** A small square button with a - or a + on it. */
function stepButton(s: Surface, b: Rect, plus: boolean, enabled: boolean): void {
  drawButton(s, b.x, b.y, b.w, b.h, "", enabled);
  const ink = enabled ? INK : FADED;
  const cx = b.x + Math.floor(b.w / 2);
  const cy = b.y + Math.floor(b.h / 2);
  s.hline(cx - 2, cy, 5, ink);
  if (plus) s.vline(cx, cy - 2, 5, ink);
}

export function drawRatesScreen(s: Surface, state: GameState): void {
  const p = state.players[state.currentPlayer]!;
  const gov = GOVERNMENTS[p.government]!;
  const max = gov.maxRate;
  const o = ratesRect(s.width);
  // The window on the game, a shadow under it.
  s.rect(o.x + 3, o.y + o.h, o.w, 2, C.BLACK!);
  s.rect(o.x + o.w, o.y + 3, 2, o.h - 1, C.BLACK!);
  dimScreen(s);
  drawWindow(s, o.x, o.y, o.w, o.h, `Tax Rates: up to ${max * 10}% under ${gov.name}`);
  drawCloseBox(s, o.x + o.w - 3 - (TITLE_H - 2), o.y + 3);

  const rows: { label: string; icon: "coin" | "gem" | "bulb"; value: number; color: number }[] = [
    { label: "Tax", icon: "coin", value: p.taxRate, color: C.YELLOW! },
    { label: "Luxuries", icon: "gem", value: p.luxRate, color: C.LMAGENTA! },
    { label: "Science", icon: "bulb", value: p.sciRate, color: C.LCYAN! },
  ];
  rows.forEach((r, i) => {
    const { y, minus, blocks, plus } = rowLayout(o, i);
    drawIcon(s, r.icon, o.x + 8, y);
    drawText(s, o.x + 8 + ICON + 3, y, r.label, DIM);
    stepButton(s, minus, false, r.value > 0);
    for (let b = 0; b < BLOCKS; b++) {
      const bx = blocks.x + b * BLOCK.pitch;
      if (b >= max) {
        // Past the government's limit: dark, barred.
        s.rect(bx, y, BLOCK.w, BLOCK.h, shade("panel", 2));
        for (let k = 1; k < BLOCK.h; k += 2) s.set(bx + k, y + k, shade("panel", 1));
      } else if (b < r.value) {
        s.rect(bx, y, BLOCK.w, BLOCK.h, r.color);
        s.hline(bx, y, BLOCK.w, C.WHITE!);
        s.vline(bx, y, BLOCK.h, C.WHITE!);
      } else {
        s.rect(bx, y, BLOCK.w, BLOCK.h, shade("panel", 4));
        s.frame(bx, y, BLOCK.w, BLOCK.h, shade("panel", 3));
      }
    }
    stepButton(s, plus, true, r.value < max);
    const figure = `${r.value * 10}%`;
    drawText(s, o.x + o.w - 8 - textWidth(figure), y, figure, INK);
  });

  // What the empire brings in a turn at these rates.
  const income = empireIncome(state, state.currentPlayer);
  const gold = `${income.gold >= 0 ? "+" : ""}${income.gold}`;
  const foot = footRect(o);
  drawIconLine(s, o.x + 8, foot.y + 2, `A turn:  {purse} ${gold}  {gem} ${income.lux}  {bulb} ${income.science}`, DIM);
}
