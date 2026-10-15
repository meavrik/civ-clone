import {
  advance,
  ADVANCES,
  BUILDINGS,
  GOVERNMENTS,
  government,
  researchCost,
  UNIT_TYPES,
  WONDERS,
  type GameState,
} from "@civ/core";
import { drawText, drawTextCentered } from "../font.js";
import { C, shade } from "../palette.js";
import { SCREEN_H, SCREEN_W, Surface } from "../surface.js";
import { drawBox, drawPanel } from "../widgets.js";

/** "Wise men discover ..." — full-screen announcement listing what the advance enables. */
export function drawDiscoveryScreen(s: Surface, state: GameState, advanceId: string): void {
  const a = advance(advanceId);
  s.fill(shade("ui", 0));
  drawPanel(s, 20, 20, SCREEN_W - 40, SCREEN_H - 40);
  drawTextCentered(s, SCREEN_W / 2, 30, "Wise men discover:", shade("ui", 5));
  drawTextCentered(s, SCREEN_W / 2, 44, a.name, C.WHITE!, C.BLACK!);
  s.hline(40, 58, SCREEN_W - 80, shade("ui", 0));

  const ink = shade("ui", 7);
  const dim = shade("ui", 5);
  let y = 66;
  const lines: string[] = [];
  const units = UNIT_TYPES.filter((u) => u.requires === advanceId).map((u) => u.name);
  const buildings = BUILDINGS.filter((b) => b.requires === advanceId).map((b) => b.name);
  const wonders = WONDERS.filter((w) => w.requires === advanceId).map((w) => w.name);
  const obsolete = WONDERS.filter((w) => w.obsolete === advanceId).map((w) => w.name);
  const next = ADVANCES.filter((n) => n.requires.includes(advanceId)).map((n) => n.name);
  if (a.government) lines.push(`Government: ${government(a.government).name}`);
  if (units.length) lines.push(`Units: ${units.join(", ")}`);
  if (buildings.length) lines.push(`Improvements: ${buildings.join(", ")}`);
  if (wonders.length) lines.push(`Wonders: ${wonders.join(", ")}`);
  if (obsolete.length) lines.push(`Obsolete: ${obsolete.join(", ")}`);
  if (next.length) lines.push(`Leads to: ${next.join(", ")}`);
  for (const line of lines) {
    for (const wrapped of wrap(line, 44)) {
      drawText(s, 40, y, wrapped, ink);
      y += 9;
    }
    y += 2;
  }
  const p = state.players[state.currentPlayer]!;
  drawText(s, 40, SCREEN_H - 44, `${p.advances.length} advances known`, dim);
  drawTextCentered(s, SCREEN_W / 2, SCREEN_H - 32, "Press any key", dim);
}

/** Science advisor: research progress and the pick-next menu lives on top of this. */
export function drawScienceScreen(s: Surface, state: GameState): void {
  const p = state.players[state.currentPlayer]!;
  s.fill(shade("ui", 1));
  drawPanel(s, 10, 10, SCREEN_W - 20, SCREEN_H - 20);
  drawTextCentered(s, SCREEN_W / 2, 16, "Science Advisor", shade("ui", 7));
  const ink = shade("ui", 7);
  const dim = shade("ui", 5);
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
  drawTextCentered(s, SCREEN_W / 2, SCREEN_H - 20, "A: choose research   Esc: back", dim);
}

/** Tax / luxury / science rate screen, adjusted with the keyboard. */
export function drawRatesScreen(s: Surface, state: GameState): void {
  const p = state.players[state.currentPlayer]!;
  const gov = GOVERNMENTS[p.government]!;
  s.fill(shade("ui", 1));
  drawPanel(s, 40, 40, SCREEN_W - 80, 110);
  drawTextCentered(s, SCREEN_W / 2, 46, `Rates (${gov.name}, max ${gov.maxRate * 10}%)`, shade("ui", 7));
  const rows: [string, number, number][] = [
    ["Tax", p.taxRate, C.YELLOW!],
    ["Luxury", p.luxRate, C.LMAGENTA!],
    ["Science", p.sciRate, C.LCYAN!],
  ];
  let y = 64;
  for (const [label, val, color] of rows) {
    drawText(s, 52, y, label, shade("ui", 5));
    drawBox(s, 110, y, 120, 8, val, 10, color);
    drawText(s, 236, y, `${val * 10}%`, shade("ui", 7));
    y += 18;
  }
  drawTextCentered(s, SCREEN_W / 2, 124, "Left/Right: tax   Up/Down: luxury", shade("ui", 5));
  drawTextCentered(s, SCREEN_W / 2, 134, "Science takes the rest.  Esc: done", shade("ui", 5));
}

function wrap(text: string, cols: number): string[] {
  const words = text.split(" ");
  const out: string[] = [];
  let line = "";
  for (const w of words) {
    if ((line + " " + w).trim().length > cols) {
      out.push(line.trim());
      line = w;
    } else line = `${line} ${w}`;
  }
  if (line.trim()) out.push(line.trim());
  return out;
}
