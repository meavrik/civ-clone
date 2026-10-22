import { advance, GOVERNMENTS, researchCost, type GameState } from "@civ/core";
import { drawText, drawTextCentered } from "../font.js";
import { C, shade } from "../palette.js";
import { SCREEN_H, SCREEN_W, Surface } from "../surface.js";
import { DIM, drawBox, drawWindow, INK } from "../widgets.js";

/** Science advisor: research progress and what we know; A opens the tech tree to pick the next research. */
export function drawScienceScreen(s: Surface, state: GameState): void {
  const p = state.players[state.currentPlayer]!;
  s.fill(C.BLACK!);
  drawWindow(s, 10, 10, SCREEN_W - 20, SCREEN_H - 20, "Science Advisor", { centred: true });
  const ink = INK;
  const dim = DIM;
  const cost = researchCost(p.advances.length, p.difficulty);
  drawText(s, 20, 34, `Researching: ${p.researching ? advance(p.researching).name : "(nothing)"}`, ink);
  drawBox(s, 20, 44, 200, 8, p.science, cost, C.LCYAN!);
  drawText(s, 226, 44, `${p.science}/${cost}`, dim);
  drawText(s, 20, 60, "Known:", dim);
  let y = 70;
  let x = 20;
  for (const id of p.advances) {
    drawText(s, x, y, advance(id).name, ink);
    y += 8;
    if (y > SCREEN_H - 30) {
      y = 70;
      x += 100;
    }
  }
  drawTextCentered(s, SCREEN_W / 2, SCREEN_H - 20, "A: tech tree   Esc: back", dim);
}

/** The rates screen's bars: tax, luxury and science, one under another, each 10 steps across. */
const RATE_BAR = { x: 110, y: 64, w: 120, h: 8, pitch: 18 };
export const RATE_ROWS = ["tax", "lux", "sci"] as const;
export type RateRow = (typeof RATE_ROWS)[number];

/**
 * The rates bar under a point (a little round it counts too) and the rate, 0-10, that point stands
 * for; null off the bars. `held`: a finger sliding along a bar keeps it past either end.
 */
export function ratesAt(px: number, py: number, held = false): { row: RateRow; value: number } | null {
  const row = RATE_ROWS[Math.floor((py - RATE_BAR.y + (RATE_BAR.pitch - RATE_BAR.h) / 2) / RATE_BAR.pitch)];
  if (!row || (!held && (px < RATE_BAR.x - 8 || px > RATE_BAR.x + RATE_BAR.w + 8))) return null;
  return { row, value: Math.max(0, Math.min(10, Math.round(((px - RATE_BAR.x) / RATE_BAR.w) * 10))) };
}

/** Tax / luxury / science rate screen, adjusted with the keyboard (or a touch on a bar, `ratesAt`). */
export function drawRatesScreen(s: Surface, state: GameState): void {
  const p = state.players[state.currentPlayer]!;
  const gov = GOVERNMENTS[p.government]!;
  s.fill(C.BLACK!);
  drawWindow(s, 40, 40, SCREEN_W - 80, 110, `Rates (${gov.name}, max ${gov.maxRate * 10}%)`, { centred: true });
  const rows: [string, number, number][] = [
    ["Tax", p.taxRate, C.YELLOW!],
    ["Luxury", p.luxRate, C.LMAGENTA!],
    ["Science", p.sciRate, C.LCYAN!],
  ];
  let y = RATE_BAR.y;
  for (const [label, val, color] of rows) {
    drawText(s, 52, y, label, DIM);
    drawBox(s, RATE_BAR.x, y, RATE_BAR.w, RATE_BAR.h, val, 10, color);
    drawText(s, RATE_BAR.x + RATE_BAR.w + 6, y, `${val * 10}%`, INK);
    y += RATE_BAR.pitch;
  }
  drawTextCentered(s, SCREEN_W / 2, 124, "Left/Right: tax   Up/Down: luxury", DIM);
  drawTextCentered(s, SCREEN_W / 2, 134, "Science takes the rest.  Esc: done", DIM);
}
