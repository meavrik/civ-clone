import { advance, researchCost, type GameState } from "@civ/core";
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
