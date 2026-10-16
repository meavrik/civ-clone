import { formatYear, shipStats, SPACE_PARTS, partCount, turnToYear, type GameState } from "@civ/core";
import { drawText, drawTextCentered } from "../font.js";
import { C, shade } from "../palette.js";
import { SCREEN_H, SCREEN_W, Surface } from "../surface.js";
import { drawBox, drawPanel } from "../widgets.js";
import { PLAYER_COLORS } from "./main.js";

/**
 * F6: the spaceship. Parts on hand against the maximum, how many the
 * structurals carry, the odds and the flight time, and the state of the
 * race against the other civilizations.
 */
export function drawSpaceshipScreen(s: Surface, state: GameState): void {
  s.fill(shade("ui", 1));
  drawPanel(s, 4, 4, SCREEN_W - 8, SCREEN_H - 8);
  const ink = shade("ui", 7);
  const dim = shade("ui", 5);
  drawTextCentered(s, SCREEN_W / 2, 8, "Spaceship", ink);
  s.hline(12, 18, SCREEN_W - 24, shade("ui", 0));
  const me = state.players[state.currentPlayer]!;
  const ship = me.spaceship;
  const st = shipStats(ship);

  let y = 26;
  for (const part of SPACE_PARTS) {
    const n = partCount(ship, part.id);
    drawText(s, 12, y, part.name, dim);
    drawText(s, 120, y, `${n}/${part.max}`, ink);
    drawBox(s, 150, y, 100, 7, n, part.max, part.id === "module" ? C.LGREEN! : part.id === "component" ? C.YELLOW! : C.LGREY!);
    y += 10;
  }
  y += 4;
  const row = (l: string, v: string, color = ink) => { drawText(s, 12, y, l, dim); drawText(s, 120, y, v, color); y += 9; };
  row("Habitats", `${st.habitats} (${st.modules} modules carried)`);
  row("Engines", `${st.components} components carried`);
  row("Success", `${st.successPct}%`, st.successPct >= 60 ? C.LGREEN! : st.successPct > 0 ? C.YELLOW! : C.LRED!);
  row("Flight", `${st.flightTurns} turns`);
  y += 4;
  if (ship.arrived) drawText(s, 12, y, "Our colonists have landed!", C.LGREEN!);
  else if (ship.launched !== null) drawText(s, 12, y, `Launched ${formatYear(turnToYear(ship.launched))}, arrives ${formatYear(turnToYear(ship.arrives ?? ship.launched))}`, C.YELLOW!);
  else if (st.launchable) drawText(s, 12, y, "Ready for launch: press Enter", C.LGREEN!);
  else drawText(s, 12, y, "Needs one habitat (3 modules), a component and structurals to carry them", dim);
  y += 14;

  // Ship silhouette: a column of structurals with modules and components attached.
  const sx = 262;
  const sy = 26;
  s.rect(sx, sy, 12, 4, C.LGREY!);
  for (let i = 0; i < Math.min(ship.structurals, 24); i++) s.rect(sx + 3, sy + 5 + i * 3, 6, 2, shade("stone", 5));
  for (let i = 0; i < Math.min(st.modules, 12); i++) s.rect(sx - 6, sy + 5 + i * 6, 5, 4, C.LGREEN!);
  for (let i = 0; i < Math.min(st.components, 16); i++) s.rect(sx + 13, sy + 5 + i * 4, 5, 3, C.YELLOW!);

  drawText(s, 12, y, "The race", dim);
  y += 10;
  for (const p of state.players) {
    if (p.id === me.id || p.id === state.barbarians || !p.alive) continue;
    const o = p.spaceship;
    const line = o.arrived ? "have landed" : o.launched !== null ? `launched ${formatYear(turnToYear(o.launched))}` : o.structurals + o.components + o.modules > 0 ? "building a ship" : "no ship";
    s.rect(12, y + 1, 6, 6, PLAYER_COLORS[p.color % PLAYER_COLORS.length]!);
    drawText(s, 22, y, `${p.name}: ${line}`, ink);
    y += 9;
    if (y > SCREEN_H - 26) break;
  }
  drawTextCentered(s, SCREEN_W / 2, SCREEN_H - 14, st.launchable && ship.launched === null ? "Enter: launch   Esc: back" : "Esc: back", dim);
}
