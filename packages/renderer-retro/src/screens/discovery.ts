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

/** Tax / luxury / science rate screen, adjusted with the keyboard. */
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
  let y = 64;
  for (const [label, val, color] of rows) {
    drawText(s, 52, y, label, DIM);
    drawBox(s, 110, y, 120, 8, val, 10, color);
    drawText(s, 236, y, `${val * 10}%`, INK);
    y += 18;
  }
  drawTextCentered(s, SCREEN_W / 2, 124, "Left/Right: tax   Up/Down: luxury", DIM);
  drawTextCentered(s, SCREEN_W / 2, 134, "Science takes the rest.  Esc: done", DIM);
}
