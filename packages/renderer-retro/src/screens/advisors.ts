import {
  advance,
  civ,
  civInfluence,
  computeCity,
  computeScore,
  formatYear,
  GOVERNMENTS,
  hasContact,
  productionName,
  turnToYear,
  unitType,
  type GameState,
} from "@civ/core";
import { drawText, drawTextCentered, textWidth } from "../font.js";
import { drawUnitFigure } from "../overlays.js";
import { C, shade } from "../palette.js";
import { SCREEN_H, SCREEN_W, Surface } from "../surface.js";
import { BAD, DIM, drawPage, drawSwatch, GOOD, INK, NOTE } from "../widgets.js";
import { drawIconLine } from "../icons.js";
import { regardWords, standing } from "@civ/renderer-api";
import { PLAYER_COLORS } from "./main.js";

function frame(s: Surface, title: string): void {
  drawPage(s, title, "F1 Cities F2 Army F3 Foreign F4 Science F5 Score F6 Ship");
}

/** F1: every city with size, production and status. */
export function drawDomesticAdvisor(s: Surface, state: GameState): void {
  frame(s, "Domestic Advisor");
  const me = state.currentPlayer;
  const ink = INK;
  const dim = DIM;
  drawText(s, 12, 24, "City", dim);
  drawText(s, 90, 24, "Size", dim);
  drawText(s, 120, 24, "Food", dim);
  drawText(s, 150, 24, "Shld", dim);
  drawText(s, 180, 24, "Trade", dim);
  drawText(s, 212, 24, "Building", dim);
  let y = 34;
  for (const c of state.cities.filter((c) => c.owner === me)) {
    const r = computeCity(state, c);
    drawText(s, 12, y, c.name, r.disorder ? BAD : c.celebrating ? GOOD : ink);
    drawText(s, 90, y, String(c.size), ink);
    drawText(s, 120, y, `${r.foodSurplus >= 0 ? "+" : ""}${r.foodSurplus}`, r.foodSurplus < 0 ? BAD : ink);
    drawText(s, 150, y, String(r.shieldSurplus), ink);
    drawText(s, 180, y, String(r.trade), ink);
    drawText(s, 212, y, c.choosing ? "Nothing chosen" : productionName(c.production), c.choosing ? NOTE : ink);
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
  const ink = INK;
  for (const [type, n] of [...counts.entries()].sort((a, b) => b[1] - a[1])) {
    drawUnitFigure(s, type, x, y, PLAYER_COLORS[state.players[me]!.color % PLAYER_COLORS.length]!);
    const t = unitType(type);
    drawText(s, x + 20, y, `${n} ${t.name}`, ink);
    drawText(s, x + 20, y + 8, `${t.attack}/${t.defense}/${t.moves}`, DIM);
    y += 18;
    if (y > SCREEN_H - 40) { y = 26; x += 150; }
  }
  if (counts.size === 0) drawText(s, 12, y, "No units.", DIM);
}

/** Rivals the Foreign Minister's page holds on two lines each; more, up to nine, take a line each (leader and regard on their cards). */
const FOREIGN_FULL_ROWS = 6;
const FOREIGN_TIGHT_ROW = 13;
const FOREIGN_TIGHT_STATS = 82;

/** F3: known civilizations, how we stand with each, and their influence (the culture of their cities) against ours. */
export function drawForeignAdvisor(s: Surface, state: GameState): void {
  frame(s, "Foreign Minister");
  const me = state.currentPlayer;
  const ink = INK;
  const dim = DIM;
  let y = 26;
  drawIconLine(s, 12, y, `Our influence {culture}${civInfluence(state, me)}`, dim);
  y += 12;
  const known = state.players.filter((p) => p.id !== me && p.id !== state.barbarians && hasContact(state, me, p.id));
  const tight = known.length > FOREIGN_FULL_ROWS;
  for (const p of known) {
    const c = civ(p.civ);
    const st = standing(state, p.id);
    const color = PLAYER_COLORS[p.color % PLAYER_COLORS.length]!;
    const cities = state.cities.filter((x) => x.owner === p.id).length;
    const stats = `${GOVERNMENTS[p.government]?.name ?? p.government}  {city}${cities} {bulb}${p.advances.length} {purse}${p.gold} {culture}${civInfluence(state, p.id)}`;
    const treaty = p.alive ? st.text : "destroyed";
    const treatyInk = p.alive && st.tone === "war" ? BAD : dim;
    drawSwatch(s, 12, y - 1, color);
    if (tight) {
      drawText(s, 22, y, c.name, p.alive ? ink : dim);
      drawIconLine(s, FOREIGN_TIGHT_STATS, y, stats, dim);
      drawText(s, SCREEN_W - 10 - textWidth(treaty), y, treaty, treatyInk);
      y += FOREIGN_TIGHT_ROW;
      continue;
    }
    drawText(s, 22, y, `${c.leader} of the ${c.name}`, p.alive ? ink : dim);
    drawText(s, 200, y, treaty, treatyInk);
    y += 9;
    drawIconLine(s, 22, y, stats, dim);
    const regard = p.alive ? regardWords(state, p.id) : "";
    if (regard) drawText(s, 200, y, `They ${regard}`, regard === "admire us" ? GOOD : BAD);
    y += 12;
  }
  if (!known.length) drawText(s, 12, y, "We have not met any other civilizations.", dim);
  drawText(s, 12, SCREEN_H - 30, "Enter: talk to a civilization", dim);
}

/** F5: score so far and the civilizations ranking. */
export function drawScoreScreen(s: Surface, state: GameState): void {
  frame(s, `Score, ${formatYear(turnToYear(state.turn))}`);
  const ink = INK;
  const dim = DIM;
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
    drawSwatch(s, 12, y, PLAYER_COLORS[p.color % PLAYER_COLORS.length]!);
    drawText(s, 22, y, p.name, ink);
    drawText(s, 120, y, String(score), ink);
    y += 9;
  }
  void advance;
}
