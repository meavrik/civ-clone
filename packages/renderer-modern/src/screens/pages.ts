import {
  advance,
  ADVANCES,
  BUILDINGS,
  civ,
  computeCity,
  computeScore,
  formatYear,
  GOVERNMENTS,
  government,
  hasContact,
  partCount,
  productionName,
  relation,
  researchCost,
  shipStats,
  SPACE_PARTS,
  turnToYear,
  UNIT_TYPES,
  unitType,
  WONDERS,
  type GameState,
} from "@civ/core";
import type { AdvisorKind } from "@civ/renderer-api";
import type { Context2D } from "../context.js";
import { bar, circle, fillRound, page, panel, paragraph, text } from "../draw.js";
import { paintBadge, playerColor } from "../markers.js";
import { H, UI, W } from "../theme.js";

/** The text pages: discovery, science, rates, the advisors, diplomacy and the spaceship. */

const ADVISOR_HINT = "F1 cities · F2 military · F3 foreign · F4 science · F5 score · F6 spaceship · Esc back";

export function drawDiscoveryScreen(ctx: Context2D, state: GameState, advanceId: string): void {
  const a = advance(advanceId);
  const box = page(ctx, W, H, "Wise men discover", "Press any key");
  text(ctx, W / 2, box.y, a.name, { size: 34, weight: "600", color: UI.accent, align: "center" });
  const units = UNIT_TYPES.filter((u) => u.requires === advanceId).map((u) => u.name);
  const buildings = BUILDINGS.filter((b) => b.requires === advanceId).map((b) => b.name);
  const wonders = WONDERS.filter((w) => w.requires === advanceId).map((w) => w.name);
  const obsolete = WONDERS.filter((w) => w.obsolete === advanceId).map((w) => w.name);
  const next = ADVANCES.filter((n) => n.requires.includes(advanceId)).map((n) => n.name);
  const lines: [string, string][] = [];
  if (a.government) lines.push(["Government", government(a.government).name]);
  if (units.length) lines.push(["Units", units.join(", ")]);
  if (buildings.length) lines.push(["Improvements", buildings.join(", ")]);
  if (wonders.length) lines.push(["Wonders", wonders.join(", ")]);
  if (obsolete.length) lines.push(["Obsolete", obsolete.join(", ")]);
  if (next.length) lines.push(["Leads to", next.join(", ")]);
  let y = box.y + 70;
  for (const [label, body] of lines) {
    text(ctx, box.x + 40, y, label, { size: 14, color: UI.dim });
    y += paragraph(ctx, box.x + 180, y, box.w - 220, body, { size: 16 }, 3) + 10;
  }
  const p = state.players[state.currentPlayer]!;
  text(ctx, box.x + 40, H - 92, `${p.advances.length} advances known`, { size: 13, color: UI.dim });
}

export function drawScienceScreen(ctx: Context2D, state: GameState): void {
  const p = state.players[state.currentPlayer]!;
  const box = page(ctx, W, H, "Science Advisor", "A choose research · Esc back");
  const cost = researchCost(p.advances.length, p.difficulty);
  text(ctx, box.x, box.y, `Researching: ${p.researching ? advance(p.researching).name : "nothing"}`, { size: 17, weight: "600" });
  bar(ctx, box.x, box.y + 32, 520, 12, p.science, cost, UI.info);
  text(ctx, box.x + 536, box.y + 30, `${p.science} / ${cost} beakers`, { size: 13, color: UI.dim });
  text(ctx, box.x, box.y + 64, `Known advances (${p.advances.length})`, { size: 14, color: UI.dim });
  const perCol = 16;
  p.advances.forEach((id, i) => {
    const col = Math.floor(i / perCol);
    const row = i % perCol;
    if (col > 3) return;
    text(ctx, box.x + col * 220, box.y + 90 + row * 22, advance(id).name, { size: 14 });
  });
}

export function drawRatesScreen(ctx: Context2D, state: GameState): void {
  const p = state.players[state.currentPlayer]!;
  const gov = GOVERNMENTS[p.government]!;
  const box = page(ctx, W, H, `Rates under ${gov.name} (max ${gov.maxRate * 10}%)`, "Left/Right tax · Up/Down luxury · science takes the rest · Esc done");
  const rows: [string, number, string][] = [["Tax", p.taxRate, UI.accent], ["Luxury", p.luxRate, UI.lux], ["Science", p.sciRate, UI.info]];
  let y = box.y + 40;
  for (const [label, val, color] of rows) {
    text(ctx, box.x + 120, y, label, { size: 17 });
    bar(ctx, box.x + 240, y + 2, 360, 16, val, 10, color);
    text(ctx, box.x + 620, y, `${val * 10}%`, { size: 17, weight: "600" });
    y += 56;
  }
}

function advisorPage(ctx: Context2D, title: string) {
  return page(ctx, W, H, title, ADVISOR_HINT);
}

export function drawAdvisor(ctx: Context2D, state: GameState, which: AdvisorKind): void {
  if (which === "domestic") return drawDomestic(ctx, state);
  if (which === "military") return drawMilitary(ctx, state);
  if (which === "foreign") return drawForeign(ctx, state);
  return drawScore(ctx, state);
}

function drawDomestic(ctx: Context2D, state: GameState): void {
  const box = advisorPage(ctx, "Domestic Advisor");
  const me = state.currentPlayer;
  const cols = [0, 220, 290, 370, 450, 540];
  const heads = ["City", "Size", "Food", "Shields", "Trade", "Building"];
  heads.forEach((h, i) => text(ctx, box.x + cols[i]!, box.y, h, { size: 13, color: UI.dim }));
  let y = box.y + 26;
  const cities = state.cities.filter((c) => c.owner === me);
  for (const c of cities) {
    const r = computeCity(state, c);
    text(ctx, box.x, y, c.name, { size: 14, color: r.disorder ? UI.danger : UI.ink, weight: r.disorder ? "600" : "normal" });
    text(ctx, box.x + cols[1]!, y, String(c.size), { size: 14 });
    text(ctx, box.x + cols[2]!, y, `${r.foodSurplus >= 0 ? "+" : ""}${r.foodSurplus}`, { size: 14, color: r.foodSurplus < 0 ? UI.danger : UI.ink });
    text(ctx, box.x + cols[3]!, y, String(r.shieldSurplus), { size: 14 });
    text(ctx, box.x + cols[4]!, y, String(r.trade), { size: 14 });
    text(ctx, box.x + cols[5]!, y, productionName(c.production), { size: 14 });
    y += 22;
    if (y > box.y + box.h) break;
  }
  if (cities.length === 0) text(ctx, box.x, y, "No cities yet. Found one with B.", { size: 14, color: UI.dim });
}

function drawMilitary(ctx: Context2D, state: GameState): void {
  const box = advisorPage(ctx, "Military Advisor");
  const me = state.currentPlayer;
  const counts = new Map<string, number>();
  for (const u of state.units) if (u.owner === me) counts.set(u.type, (counts.get(u.type) ?? 0) + 1);
  let y = box.y;
  let x = box.x;
  for (const [type, n] of [...counts.entries()].sort((a, b) => b[1] - a[1])) {
    paintBadge(ctx, x - 8, y - 8, type, state.players[me]!.color, 36);
    const t = unitType(type);
    text(ctx, x + 50, y, `${n} × ${t.name}`, { size: 15, weight: "600" });
    text(ctx, x + 50, y + 20, `attack ${t.attack} · defence ${t.defense} · moves ${t.moves}`, { size: 12, color: UI.dim });
    y += 48;
    if (y > box.y + box.h - 40) { y = box.y; x += 300; }
  }
  if (counts.size === 0) text(ctx, box.x, y, "No units.", { size: 14, color: UI.dim });
}

function drawForeign(ctx: Context2D, state: GameState): void {
  const box = advisorPage(ctx, "Foreign Minister");
  const me = state.currentPlayer;
  let y = box.y;
  let any = false;
  for (const p of state.players) {
    if (p.id === me || p.id === state.barbarians || !hasContact(state, me, p.id)) continue;
    any = true;
    const c = civ(p.civ);
    const r = relation(state, me, p.id);
    fillRound(ctx, box.x, y + 3, 12, 12, 3, playerColor(p.color));
    text(ctx, box.x + 22, y, `${c.leader} of the ${c.name}`, { size: 16, weight: "600", color: p.alive ? UI.ink : UI.dim });
    text(ctx, box.x + box.w, y, p.alive ? (r === "war" ? "WAR" : "Peace") : "destroyed", { size: 14, color: r === "war" ? UI.danger : UI.dim, align: "right" });
    y += 22;
    const cities = state.cities.filter((x) => x.owner === p.id).length;
    text(ctx, box.x + 22, y, `${GOVERNMENTS[p.government]?.name ?? p.government} · ${cities} cities · ${p.advances.length} advances · ${p.gold} gold`, { size: 13, color: UI.dim });
    y += 34;
  }
  if (!any) text(ctx, box.x, y, "We have not met any other civilizations.", { size: 14, color: UI.dim });
  text(ctx, box.x, H - 92, "Enter: talk to a civilization", { size: 13, color: UI.dim });
}

function drawScore(ctx: Context2D, state: GameState): void {
  const box = advisorPage(ctx, `Score, ${formatYear(turnToYear(state.turn))}`);
  const me = computeScore(state, state.currentPlayer);
  let y = box.y;
  const row = (l: string, v: number, strong = false) => {
    text(ctx, box.x, y, l, { size: 15, color: UI.dim });
    text(ctx, box.x + 220, y, String(v), { size: 15, weight: strong ? "600" : "normal", align: "right" });
    y += 24;
  };
  row("Citizens", me.citizens);
  row("Wonders", me.wonders);
  row("Advances", me.techs);
  row("Peace", me.peace);
  if (me.pollution) row("Pollution", me.pollution);
  row("Total", me.total, true);
  let ry = box.y;
  text(ctx, box.x + 360, ry, "Civilizations", { size: 14, color: UI.dim });
  ry += 26;
  const ranking = state.players
    .filter((p) => p.id !== state.barbarians && p.alive)
    .map((p) => ({ p, score: computeScore(state, p.id).total }))
    .sort((a, b) => b.score - a.score);
  const top = ranking[0]?.score ?? 1;
  for (const { p, score } of ranking) {
    fillRound(ctx, box.x + 360, ry + 3, 12, 12, 3, playerColor(p.color));
    text(ctx, box.x + 382, ry, p.name, { size: 15 });
    bar(ctx, box.x + 520, ry + 4, 200, 10, score, Math.max(1, top), playerColor(p.color));
    text(ctx, box.x + 730, ry, String(score), { size: 14, align: "left" });
    ry += 26;
  }
}

export function drawDiplomacyScreen(ctx: Context2D, state: GameState, player: number, line: string): void {
  const p = state.players[player]!;
  const c = civ(p.civ);
  const color = playerColor(p.color);
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#1b1410");
  g.addColorStop(1, "#0d0a08");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // Throne room: a lit backdrop and a bust in the civ's colour.
  const spot = ctx.createRadialGradient(W / 2, 200, 20, W / 2, 200, 320);
  spot.addColorStop(0, "rgba(255, 220, 160, 0.25)");
  spot.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = spot;
  ctx.fillRect(0, 0, W, H);
  const cx = W / 2;
  fillRound(ctx, cx - 110, 230, 220, 120, 40, color);
  fillRound(ctx, cx - 24, 196, 48, 44, 10, "#d9a77a");
  circle(ctx, cx, 150, 56, "#f1c9a5");
  fillRound(ctx, cx - 60, 78, 120, 36, 14, UI.accent);
  for (let i = 0; i < 5; i++) circle(ctx, cx - 44 + i * 22, 78, 8, UI.accent);
  circle(ctx, cx - 20, 142, 4, "#2a1d14");
  circle(ctx, cx + 20, 142, 4, "#2a1d14");
  ctx.strokeStyle = "#2a1d14";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx - 16, 172);
  ctx.quadraticCurveTo(cx, 180, cx + 16, 172);
  ctx.stroke();
  text(ctx, cx, 366, `${c.leader} of the ${c.name}`, { size: 26, weight: "600", align: "center", shadow: true });
  text(ctx, cx, 400, GOVERNMENTS[p.government]?.name ?? "", { size: 15, color: UI.dim, align: "center" });
  const r = relation(state, state.currentPlayer, player);
  text(ctx, cx, 424, r === "war" ? "We are at WAR" : "We are at peace", { size: 15, weight: "600", color: r === "war" ? UI.danger : UI.ok, align: "center" });
  panel(ctx, 120, 460, W - 240, 80, 14, UI.card);
  paragraph(ctx, 144, 480, W - 288, `“${line}”`, { size: 18 }, 2);
}

export function drawSpaceshipScreen(ctx: Context2D, state: GameState): void {
  const box = page(ctx, W, H, "Spaceship", "Enter launch (when ready) · Esc back");
  const me = state.players[state.currentPlayer]!;
  const ship = me.spaceship;
  const st = shipStats(ship);
  let y = box.y;
  for (const part of SPACE_PARTS) {
    const n = partCount(ship, part.id);
    text(ctx, box.x, y, part.name, { size: 15, color: UI.dim });
    text(ctx, box.x + 330, y, `${n} / ${part.max}`, { size: 15, align: "right" });
    bar(ctx, box.x + 350, y + 4, 220, 12, n, part.max, part.id === "module" ? UI.ok : part.id === "component" ? UI.accent : "#cfd6dd");
    y += 30;
  }
  y += 12;
  const row = (l: string, v: string, color = UI.ink) => {
    text(ctx, box.x, y, l, { size: 15, color: UI.dim });
    text(ctx, box.x + 200, y, v, { size: 15, color });
    y += 26;
  };
  row("Habitats", `${st.habitats}  (${st.modules} modules carried)`);
  row("Engines", `${st.components} components carried`);
  row("Success", `${st.successPct}%`, st.successPct >= 60 ? UI.ok : st.successPct > 0 ? UI.accent : UI.danger);
  row("Flight", `${st.flightTurns} turns`);
  y += 6;
  const status = ship.arrived ? "Our colonists have landed!"
    : ship.launched !== null ? `Launched ${formatYear(turnToYear(ship.launched))}, arrives ${formatYear(turnToYear(ship.arrives ?? ship.launched))}`
    : st.launchable ? "Ready for launch: press Enter" : "Needs one habitat (3 modules), a component and structurals to carry them";
  y += paragraph(ctx, box.x, y, 560, status, { size: 15, color: ship.arrived ? UI.ok : st.launchable ? UI.ok : UI.dim }, 2) + 16;

  // Silhouette.
  const sx = box.x + 700;
  const sy = box.y + 10;
  fillRound(ctx, sx - 16, sy, 40, 12, 6, "#cfd6dd");
  for (let i = 0; i < Math.min(ship.structurals, 24); i++) fillRound(ctx, sx - 8, sy + 16 + i * 9, 24, 6, 2, "#9aa3ad");
  for (let i = 0; i < Math.min(st.modules, 12); i++) fillRound(ctx, sx - 30, sy + 16 + i * 18, 18, 12, 4, UI.ok);
  for (let i = 0; i < Math.min(st.components, 16); i++) fillRound(ctx, sx + 20, sy + 16 + i * 13, 18, 9, 3, UI.accent);

  text(ctx, box.x, y, "The race", { size: 14, color: UI.dim });
  y += 24;
  for (const p of state.players) {
    if (p.id === me.id || p.id === state.barbarians || !p.alive) continue;
    const o = p.spaceship;
    const line = o.arrived ? "have landed" : o.launched !== null ? `launched ${formatYear(turnToYear(o.launched))}` : o.structurals + o.components + o.modules > 0 ? "building a ship" : "no ship";
    fillRound(ctx, box.x, y + 3, 12, 12, 3, playerColor(p.color));
    text(ctx, box.x + 22, y, `${p.name}: ${line}`, { size: 15 });
    y += 24;
    if (y > box.y + box.h) break;
  }
}
