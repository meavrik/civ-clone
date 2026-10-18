import { bordersOpen, civ, GOVERNMENTS, relation, type GameState } from "@civ/core";
import { drawTextCentered, drawTextWrapped } from "../font.js";
import { C, shade } from "../palette.js";
import { SCREEN_H, SCREEN_W, Surface } from "../surface.js";
import { drawWindow, INK } from "../widgets.js";
import { PLAYER_COLORS } from "./main.js";

/**
 * Audience with a foreign leader. An original stylised portrait (a bust in
 * the civ's colour) with their words below; the menu widget sits on top.
 */
export function drawDiplomacyScreen(s: Surface, state: GameState, player: number, line: string): void {
  const p = state.players[player]!;
  const c = civ(p.civ);
  const color = PLAYER_COLORS[p.color % PLAYER_COLORS.length]!;
  s.fill(shade("earth", 0));
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
  const standing = r === "war" ? "We are at WAR" : bordersOpen(state, state.currentPlayer, player) ? "At peace, our borders open" : "We are at peace";
  drawTextCentered(s, cx, 136, standing, r === "war" ? C.LRED! : C.LGREEN!, C.BLACK!);
  drawWindow(s, 16, 146, SCREEN_W - 32, 40, "");
  drawTextWrapped(s, 22, 150, SCREEN_W - 44, `"${line}"`, INK, 4);
  void SCREEN_H;
}
