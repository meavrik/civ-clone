import { civ, GOVERNMENTS, relation, type GameState } from "@civ/core";
import { drawText, drawTextCentered } from "../font.js";
import { C, shade } from "../palette.js";
import { SCREEN_H, SCREEN_W, Surface } from "../surface.js";
import { drawPanel } from "../widgets.js";
import { PLAYER_COLORS } from "./main.js";

/**
 * Audience with a foreign leader. An original stylised portrait (a bust in
 * the civ's colour) with their words below; the menu widget sits on top.
 */
export function drawDiplomacyScreen(s: Surface, state: GameState, player: number, line: string): void {
  const p = state.players[player]!;
  const c = civ(p.civ);
  const color = PLAYER_COLORS[p.color % PLAYER_COLORS.length]!;
  s.fill(shade("ui", 0));
  // Throne-room backdrop.
  for (let y = 0; y < 120; y++) for (let x = 0; x < SCREEN_W; x += 2) s.set(x + (y & 1), y, shade("earth", 1));
  s.rect(0, 120, SCREEN_W, 2, shade("earth", 4));
  // Bust.
  const cx = SCREEN_W / 2;
  s.rect(cx - 30, 70, 60, 50, color); // shoulders
  s.rect(cx - 14, 36, 28, 40, shade("flesh", 5)); // head
  s.rect(cx - 14, 30, 28, 10, shade("earth", 2)); // hair/headdress
  s.rect(cx - 16, 28, 32, 4, C.YELLOW!); // crown band
  s.set(cx - 7, 50, C.BLACK!);
  s.set(cx + 6, 50, C.BLACK!);
  s.hline(cx - 4, 64, 8, shade("flesh", 2));
  s.rect(cx - 6, 76, 12, 6, shade("flesh", 4)); // neck
  drawTextCentered(s, cx, 126, `${c.leader} of the ${c.name} (${GOVERNMENTS[p.government]?.name ?? ""})`, C.WHITE!, C.BLACK!);
  const r = relation(state, state.currentPlayer, player);
  drawTextCentered(s, cx, 136, r === "war" ? "We are at WAR" : "We are at peace", r === "war" ? C.LRED! : shade("ui", 6));
  drawPanel(s, 16, 146, SCREEN_W - 32, 40, true);
  drawText(s, 22, 150, `"${line}"`, shade("ui", 7));
  void SCREEN_H;
}

/** A leader's greeting line, by mood. */
export function leaderLine(state: GameState, player: number): string {
  const p = state.players[player]!;
  const c = civ(p.civ);
  const r = relation(state, state.currentPlayer, player);
  if (r === "war") return `${c.leader} spits: your cities will burn.`;
  const mine = state.units.filter((u) => u.owner === state.currentPlayer).length;
  const theirs = state.units.filter((u) => u.owner === player).length;
  if (theirs > mine * 2) return "Our armies are mighty. Tread carefully.";
  if (mine > theirs * 2) return "We seek only peace with so great a power.";
  return "Greetings. What brings you to our court?";
}
