import {
  advance,
  civ,
  computeCity,
  computeScore,
  formatYear,
  GOVERNMENTS,
  hasContact,
  productionName,
  relation,
  turnToYear,
  unitType,
  type GameState,
} from "@civ/core";
import { drawText, drawTextCentered, textWidth } from "../font.js";
import { unitSprite } from "../overlays.js";
import { C, shade } from "../palette.js";
import { SCREEN_H, SCREEN_W, Surface } from "../surface.js";
import { drawPanel } from "../widgets.js";
import { PLAYER_COLORS } from "./main.js";
import { SPRITE_CLEAR } from "../sprites/sheet.js";

function frame(s: Surface, title: string): void {
  s.fill(shade("ui", 1));
  drawPanel(s, 4, 4, SCREEN_W - 8, SCREEN_H - 8);
  drawTextCentered(s, SCREEN_W / 2, 8, title, shade("ui", 7));
  s.hline(12, 18, SCREEN_W - 24, shade("ui", 0));
  drawTextCentered(s, SCREEN_W / 2, SCREEN_H - 14, "F1 cities  F2 military  F3 foreign  F4 science  F5 score  F6 ship   Esc", shade("ui", 5));
}

/** F1: every city with size, production and status. */
export function drawDomesticAdvisor(s: Surface, state: GameState): void {
  frame(s, "Domestic Advisor");
  const me = state.currentPlayer;
  const ink = shade("ui", 7);
  const dim = shade("ui", 5);
  drawText(s, 12, 24, "City", dim);
  drawText(s, 90, 24, "Size", dim);
  drawText(s, 120, 24, "Food", dim);
  drawText(s, 150, 24, "Shld", dim);
  drawText(s, 180, 24, "Trade", dim);
  drawText(s, 212, 24, "Building", dim);
  let y = 34;
  for (const c of state.cities.filter((c) => c.owner === me)) {
    const r = computeCity(state, c);
    drawText(s, 12, y, c.name, r.disorder ? C.LRED! : ink);
    drawText(s, 90, y, String(c.size), ink);
    drawText(s, 120, y, `${r.foodSurplus >= 0 ? "+" : ""}${r.foodSurplus}`, r.foodSurplus < 0 ? C.LRED! : ink);
    drawText(s, 150, y, String(r.shieldSurplus), ink);
    drawText(s, 180, y, String(r.trade), ink);
    drawText(s, 212, y, productionName(c.production), ink);
    y += 9;
    if (y > SCREEN_H - 26) break;
  }
  if (y === 34) drawText(s, 12, y, "No cities yet. Found one with B.", dim);
}

/** F2: unit counts by type, with where they are supported. */
export function drawMilitaryAdvisor(s: Surface, state: GameState): void {
  frame(s, "Military Advisor");
  const me = state.currentPlayer;
  const counts = new Map<string, number>();
  for (const u of state.units) if (u.owner === me) counts.set(u.type, (counts.get(u.type) ?? 0) + 1);
  let y = 26;
  let x = 12;
  const ink = shade("ui", 7);
  for (const [type, n] of [...counts.entries()].sort((a, b) => b[1] - a[1])) {
    s.blit(unitSprite(type, PLAYER_COLORS[state.players[me]!.color % PLAYER_COLORS.length]!), x, y, SPRITE_CLEAR);
    const t = unitType(type);
    drawText(s, x + 20, y, `${n} ${t.name}`, ink);
    drawText(s, x + 20, y + 8, `${t.attack}/${t.defense}/${t.moves}`, shade("ui", 5));
    y += 18;
    if (y > SCREEN_H - 40) { y = 26; x += 150; }
  }
  if (counts.size === 0) drawText(s, 12, y, "No units.", shade("ui", 5));
}

/** F3: known civilizations and relations. */
export function drawForeignAdvisor(s: Surface, state: GameState): void {
  frame(s, "Foreign Minister");
  const me = state.currentPlayer;
  const ink = shade("ui", 7);
  const dim = shade("ui", 5);
  let y = 26;
  let any = false;
  for (const p of state.players) {
    if (p.id === me || p.id === state.barbarians) continue;
    if (!hasContact(state, me, p.id)) continue;
    any = true;
    const c = civ(p.civ);
    const r = relation(state, me, p.id);
    const color = PLAYER_COLORS[p.color % PLAYER_COLORS.length]!;
    s.rect(12, y, 6, 6, color);
    drawText(s, 22, y, `${c.leader} of the ${c.name}`, p.alive ? ink : dim);
    drawText(s, 200, y, p.alive ? (r === "war" ? "WAR" : "Peace") : "destroyed", r === "war" ? C.LRED! : dim);
    y += 9;
    const cities = state.cities.filter((x) => x.owner === p.id).length;
    drawText(s, 22, y, `${GOVERNMENTS[p.government]?.name ?? p.government}, ${cities} cities, ${p.advances.length} advances, ${p.gold}$`, dim);
    y += 12;
  }
  if (!any) drawText(s, 12, y, "We have not met any other civilizations.", dim);
  drawText(s, 12, SCREEN_H - 30, "Enter: talk to a civilization", dim);
}

/** F5: score so far and the civilizations ranking. */
export function drawScoreScreen(s: Surface, state: GameState): void {
  frame(s, `Score, ${formatYear(turnToYear(state.turn))}`);
  const ink = shade("ui", 7);
  const dim = shade("ui", 5);
  const me = computeScore(state, state.currentPlayer);
  let y = 26;
  const row = (l: string, v: number) => { drawText(s, 12, y, l, dim); drawText(s, 120, y, String(v), ink); y += 9; };
  row("Citizens", me.citizens);
  row("Wonders", me.wonders);
  row("Advances", me.techs);
  row("Peace", me.peace);
  if (me.pollution) row("Pollution", me.pollution);
  row("Total", me.total);
  y += 8;
  drawText(s, 12, y, "Civilizations", dim);
  y += 10;
  const ranking = state.players
    .filter((p) => p.id !== state.barbarians && p.alive)
    .map((p) => ({ p, score: computeScore(state, p.id).total }))
    .sort((a, b) => b.score - a.score);
  for (const { p, score } of ranking) {
    s.rect(12, y + 1, 6, 6, PLAYER_COLORS[p.color % PLAYER_COLORS.length]!);
    drawText(s, 22, y, p.name, ink);
    drawText(s, 120, y, String(score), ink);
    y += 9;
  }
  void textWidth;
  void advance;
}
