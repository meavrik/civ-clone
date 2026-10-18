import {
  atWar,
  canFoundCity,
  cityAt,
  formatYear,
  GOVERNMENTS,
  getTile,
  maxHp,
  moveAllowance,
  NEIGHBOURS,
  Terrain,
  TERRAIN_NAMES,
  TERRAIN_RULES,
  tileYield,
  turnToYear,
  unitAt,
  unitById,
  unitType,
  workOptions,
  wrapX,
  type GameState,
} from "@civ/core";
import { coastPatch, DEEP, fogPatch, isDeepWater, knownSquare, MENU_BAR, researchOutlook, riverShape, territory, shownActive, type Callout, tileIcons, WORK_ICON, type IconName, type MainScreenView } from "@civ/renderer-api";
import { paintCoast } from "../coast.js";
import { Clouds } from "../fog.js";
import { paintBorders } from "../borders.js";
import { drawIconLine, iconParagraph, paintIcon } from "../icons.js";
import type { Context2D } from "../context.js";
import { circle, fillRound, measure, panel, paragraph, strokeRound, text, wrap } from "../draw.js";
import { paintBadge, paintBurst, paintCity, paintCityLabel, paintHitFlash, paintHpBar, paintUnit, playerColor } from "../markers.js";
import { paintFog, paintFortress, paintHut, paintIrrigation, paintMine, paintPollution, paintRiver, paintRoad, paintSpecial, paintTile } from "../tiles.js";
import { BAR_H, COMBAT, H, ICON, PANEL_W, SEA, TERRAIN, TILE, UI, VIEW_TILES_X, VIEW_TILES_Y, VIEW_X, VIEW_Y, W } from "../theme.js";

/** The main map: a 48px-tile viewport right of a 240px panel, the same split as the retro layout. */

const MINIMAP_X = 40;
const MINIMAP_Y = BAR_H + 14;
const BAR_X0 = 20;
const BAR_GAP = 30;

/** Left edge and width of each menu bar title. */
function menuBarLayout(ctx: Context2D): { x: number; w: number }[] {
  let x = BAR_X0;
  return MENU_BAR.map((t) => {
    const w = measure(ctx, t, 15, "600");
    const r = { x, w };
    x += w + BAR_GAP;
    return r;
  });
}

export function menuBarHit(ctx: Context2D, px: number, py: number): number {
  if (py < 0 || py >= BAR_H) return -1;
  return menuBarLayout(ctx).findIndex(({ x, w }) => px >= x - BAR_GAP / 2 && px < x + w + BAR_GAP / 2);
}

export function menuBarAnchor(ctx: Context2D, index: number): { x: number; y: number } {
  const t = menuBarLayout(ctx)[index] ?? { x: BAR_X0, w: 0 };
  return { x: Math.max(4, t.x - 12), y: BAR_H + 2 };
}

/** The menu bar: a dark strip with the titles; the open one sits on a highlight. */
export function drawMenuBar(ctx: Context2D, open?: number): void {
  ctx.fillStyle = "rgba(14, 19, 26, 0.97)";
  ctx.fillRect(0, 0, W, BAR_H);
  ctx.fillStyle = UI.panelEdge;
  ctx.fillRect(0, BAR_H - 1, W, 1);
  menuBarLayout(ctx).forEach(({ x, w }, i) => {
    const on = i === open;
    if (on) fillRound(ctx, x - 10, 4, w + 20, BAR_H - 8, 6, UI.selection);
    text(ctx, x, 7, MENU_BAR[i]!, { size: 15, weight: "600", color: on ? UI.ink : "#c9d3de" });
  });
}
const MINIMAP_SCALE = 2;

/** A square's colour on the minimap and the world map; open sea is darker than water along a coast. */
export function mapColor(map: GameState["map"], x: number, y: number, explored?: ArrayLike<number>): string {
  return isDeepWater(map, x, y, explored) ? SEA.deep.base : TERRAIN[map.tiles[y * map.width + x]!.terrain].base;
}

function roadMask(state: GameState, x: number, y: number, rail: boolean): number {
  const explored = state.players[state.currentPlayer]!.explored;
  let mask = 0;
  NEIGHBOURS.forEach(([dx, dy], i) => {
    const n = getTile(state.map, x + dx, y + dy);
    if (n && (rail ? n.railroad : n.road) && knownSquare(state.map, explored, x + dx, y + dy)) mask |= 1 << i;
  });
  return mask;
}

function panOffset(view: MainScreenView): [number, number] {
  return [(view.panX ?? 0) * TILE, (view.panY ?? 0) * TILE];
}

export function tileToScreen(state: GameState, view: MainScreenView, x: number, y: number): [number, number] | null {
  const w = state.map.width;
  let tx = (((x - view.originX) % w) + w) % w;
  if (tx > w - 1) tx -= w; // a unit sliding out past the left edge, clipped at the panel
  const ty = y - view.originY;
  if (tx > VIEW_TILES_X || ty <= -1 || ty > VIEW_TILES_Y) return null;
  const [ox, oy] = panOffset(view);
  return [VIEW_X + tx * TILE - ox, VIEW_Y + ty * TILE - oy];
}

export function tileAt(state: GameState, view: MainScreenView, px: number, py: number): { x: number; y: number } | null {
  if (px < VIEW_X || px >= W || py < VIEW_Y || py >= H) return null;
  const [ox, oy] = panOffset(view);
  const ty = view.originY + Math.floor((py - VIEW_Y + oy) / TILE);
  if (ty < 0 || ty >= state.map.height) return null;
  return { x: wrapX(state.map, view.originX + Math.floor((px - VIEW_X + ox) / TILE)), y: ty };
}

export function minimapAt(state: GameState, px: number, py: number): { x: number; y: number } | null {
  const x = Math.floor((px - MINIMAP_X) / MINIMAP_SCALE);
  const y = Math.floor((py - MINIMAP_Y) / MINIMAP_SCALE);
  if (x < 0 || y < 0 || x >= state.map.width || y >= state.map.height) return null;
  return { x, y };
}

function drawViewport(ctx: Context2D, state: GameState, view: MainScreenView): void {
  const { map } = state;
  const me = state.players[state.currentPlayer]!;
  ctx.save();
  ctx.beginPath();
  ctx.rect(VIEW_X, VIEW_Y, W - VIEW_X, H - VIEW_Y);
  ctx.clip();
  const [ox, oy] = panOffset(view);
  const clouds = new Clouds();
  const shown: { mx: number; my: number; x: number; y: number }[] = [];
  for (let ty = 0; ty <= VIEW_TILES_Y; ty++) {
    const my = view.originY + ty;
    const dy = VIEW_Y + ty * TILE - oy;
    for (let tx = 0; tx <= VIEW_TILES_X; tx++) {
      const mx = (((view.originX + tx) % map.width) + map.width) % map.width;
      const dx = VIEW_X + tx * TILE - ox;
      if (my < 0 || my >= map.height) {
        ctx.fillStyle = UI.bg;
        ctx.fillRect(dx, dy, TILE, TILE);
        continue;
      }
      // Unexplored squares are clouds; fog drifts a little way into explored squares beside them.
      const fog = fogPatch(map, me.explored, mx, my);
      clouds.add(dx, dy, fog);
      if (fog.cover[4]! >= 1) continue;
      const left = view.lifting?.get(my * map.width + mx);
      if (left) clouds.lift(dx, dy, mx, my, left, map, me.explored, view.lifting!);
      const tile = map.tiles[my * map.width + mx]!;
      shown.push({ mx, my, x: dx, y: dy });
      const coast = coastPatch(map, mx, my, me.explored);
      const river = riverShape(map, mx, my, me.explored);
      paintTile(ctx, dx, dy, tile, mx, my, coast.depth[4] === DEEP);
      // A river goes under the coast pass, so the sea covers it where it bites into the land.
      if (river && tile.terrain !== Terrain.Ocean) paintRiver(ctx, dx, dy, river);
      paintCoast(ctx, dx, dy, coast, tile.terrain === Terrain.Ocean ? river : null);
      if (tile.irrigation) paintIrrigation(ctx, dx, dy);
      if (tile.mine) paintMine(ctx, dx, dy);
      if (tile.road) paintRoad(ctx, dx, dy, roadMask(state, mx, my, false), false);
      if (tile.railroad) paintRoad(ctx, dx, dy, roadMask(state, mx, my, true), true);
      if (tile.special) paintSpecial(ctx, dx, dy);
      if (tile.fortress) paintFortress(ctx, dx, dy);
      if (tile.hut) paintHut(ctx, dx, dy);
      if (tile.pollution) paintPollution(ctx, dx, dy);
      if (!me.visible[my * map.width + mx]) paintFog(ctx, dx, dy);
    }
  }
  // Borders over every square (their corners reach into the next one), under the fog.
  if (view.borders) paintBorders(ctx, territory(state), shown, (owner) => state.players[owner]!.color);
  clouds.paint(ctx);

  // Foreign cities and units wait for fog lifting off their square to thin.
  const fogged = (idx: number, owner: number) => owner !== state.currentPlayer && (view.lifting?.get(idx) ?? 0) >= 0.5;
  // A city with units inside shows a shield: always on our own, on others' while we see the square.
  const held = new Set(state.units.map((u) => u.y * map.width + u.x));
  for (const c of state.cities) {
    const idx = c.y * map.width + c.x;
    if (!me.explored[idx] || fogged(idx, c.owner)) continue;
    const pos = tileToScreen(state, view, c.x, c.y);
    if (pos) paintCity(ctx, pos[0], pos[1], c, state.players[c.owner]!.color, held.has(idx) && (c.owner === state.currentPlayer || me.visible[idx] === 1));
  }

  // A unit sliding between squares is drawn after the rest, where it is now.
  // So is a fight under way: both fighters come from view.battle.
  const moving = view.moving ?? [];
  const battle = view.battle;
  const activeId = shownActive(state, view);
  const slidingIds = new Set(moving.map((m) => m.unit));
  if (battle) { slidingIds.add(battle.attacker.unit); slidingIds.add(battle.defender.unit); }
  const units = slidingIds.size ? state.units.filter((u) => !slidingIds.has(u.id)) : state.units;
  const drawn = new Set<number>();
  for (const u of units) {
    const idx = u.y * map.width + u.x;
    if (!me.visible[idx] || drawn.has(idx) || fogged(idx, u.owner)) continue;
    const pos = tileToScreen(state, view, u.x, u.y);
    if (!pos) continue;
    const stack = units.filter((o) => o.x === u.x && o.y === u.y);
    const top = stack.find((o) => o.id === activeId) ?? stack[0]!;
    drawn.add(idx);
    const isActive = top.id === activeId;
    if (!isActive && state.cities.some((c) => c.x === u.x && c.y === u.y)) continue;
    if (isActive && !view.blink) continue;
    paintUnit(ctx, pos[0], pos[1], top, state.players[top.owner]!.color, { stacked: stack.length > 1, active: isActive });
    const max = maxHp(state, top.type);
    if (top.hp < max) paintHpBar(ctx, pos[0], pos[1], top.hp, max);
  }
  for (const m of moving) {
    if (m.aboard !== undefined) continue;
    const pos = tileToScreen(state, view, m.x, m.y);
    if (!pos) continue;
    const real = state.units.find((u) => u.id === m.unit);
    paintUnit(ctx, pos[0], pos[1], { type: m.type, order: { kind: "none" }, veteran: real?.veteran ?? false }, state.players[m.owner]!.color, {
      stacked: m.stacked === true || moving.some((o) => o.aboard === m.unit),
      active: m.unit === activeId,
    });
    const hp = m.hp ?? real?.hp;
    const max = m.maxHp ?? maxHp(state, m.type);
    if (hp !== undefined && hp < max) paintHpBar(ctx, pos[0], pos[1], hp, max);
  }
  // The fight: the attacker lunges in, each blow flashes on the side it lands on, the loser bursts.
  if (battle)
    for (const f of [battle.defender, battle.attacker]) {
      const pos = tileToScreen(state, view, f.x, f.y);
      if (!pos) continue;
      const fade = Math.max(0, 1 - f.dying * 2.5);
      if (fade > 0) {
        const alpha = ctx.globalAlpha;
        ctx.globalAlpha = alpha * fade;
        const veteran = state.units.find((u) => u.id === f.unit)?.veteran ?? false;
        paintUnit(ctx, pos[0], pos[1], { type: f.type, order: { kind: "none" }, veteran }, state.players[f.owner]!.color, { stacked: f.stacked, active: false });
        if (f.hit > 0) paintHitFlash(ctx, pos[0], pos[1], f.hit);
        paintHpBar(ctx, pos[0], pos[1], f.hp, f.maxHp);
        ctx.globalAlpha = alpha;
      }
      if (f.dying > 0) paintBurst(ctx, pos[0] + TILE / 2, pos[1] + TILE / 2, f.dying);
    }

  for (const c of state.cities) {
    if (!me.explored[c.y * map.width + c.x]) continue;
    const pos = tileToScreen(state, view, c.x, c.y);
    if (pos) paintCityLabel(ctx, pos[0], pos[1], c.name, state.players[c.owner]!.color);
  }

  const act = activeId !== null ? state.units.find((u) => u.id === activeId) : undefined;
  if (act?.order.kind === "goto") {
    const pos = tileToScreen(state, view, act.order.x, act.order.y);
    if (pos) strokeRound(ctx, pos[0] + 2, pos[1] + 2, TILE - 4, TILE - 4, 6, UI.accent, 2);
  }
  if (view.inspect) {
    const pos = tileToScreen(state, view, view.inspect.x, view.inspect.y);
    if (pos) {
      strokeRound(ctx, pos[0] + 1.5, pos[1] + 1.5, TILE - 3, TILE - 3, 6, "#ffffff", 2);
      fillRound(ctx, pos[0] + 1.5, pos[1] + 1.5, TILE - 3, TILE - 3, 6, UI.selection);
    }
  }
  if (view.callout) paintCallout(ctx, state, view, view.callout);
  ctx.restore();
}

const CALLOUT_W = 300;

/** A note beside a square of the map: a card above it (below it near the top), its point at the square. */
function paintCallout(ctx: Context2D, state: GameState, view: MainScreenView, c: Callout): void {
  const pos = tileToScreen(state, view, c.x, c.y);
  if (!pos) return;
  const size = 14;
  const lineH = Math.round(size * 1.3);
  const lines = wrap(ctx, c.text, CALLOUT_W - 24, size).slice(0, 4);
  const w = Math.max(...lines.map((l) => measure(ctx, l, size))) + 24;
  const h = lines.length * lineH + 14;
  const cx = pos[0] + TILE / 2;
  const x = Math.max(VIEW_X + 4, Math.min(W - 4 - w, cx - w / 2));
  const above = pos[1] - 12 - h >= VIEW_Y + 4;
  const y = above ? pos[1] - 12 - h : pos[1] + TILE + 12;
  panel(ctx, x, y, w, h, 8, UI.card);
  const px = Math.max(x + 14, Math.min(x + w - 14, cx));
  const tip = above ? y + h + 8 : y - 8;
  const base = above ? y + h - 1 : y + 1;
  ctx.beginPath();
  ctx.moveTo(px - 8, base);
  ctx.lineTo(px, tip);
  ctx.lineTo(px + 8, base);
  ctx.closePath();
  ctx.fillStyle = UI.card;
  ctx.fill();
  lines.forEach((l, i) => text(ctx, x + 12, y + 7 + i * lineH, l, { size }));
}

const TEXT_X = 16;
const TEXT_W = PANEL_W - 32;
const LINE = 19;

/** Text cut with "..." to fit a width. */
function fitText(ctx: Context2D, s: string, width: number, size: number): string {
  if (measure(ctx, s, size) <= width) return s;
  let t = s;
  while (t.length > 1 && measure(ctx, `${t}...`, size) > width) t = t.slice(0, -1);
  return `${t}...`;
}

/** A square's yields and what stands on it, as one icon line: food, shields, trade, then features. */
function tileIconLine(state: GameState, x: number, y: number, extra = ""): string {
  const t = getTile(state.map, x, y)!;
  const yld = tileYield(state, t, cityAt(state, x, y) !== undefined, state.players[state.currentPlayer]!.government);
  const features = tileIcons(t).map((i) => `{${i}}`);
  if (t.special) features.unshift("{star}");
  return [`{food} ${yld.food}`, `{shield} ${yld.shields}`, `{trade} ${yld.trade}`, ...(extra ? [extra] : []), features.join(" ")].filter(Boolean).join("  ");
}

/** The inspected square: terrain, then yields, movement and features as icons, its city and units. */
function tileInfo(ctx: Context2D, state: GameState, tx: number, ty: number, y: number, bottom: number): number {
  const me = state.players[state.currentPlayer]!;
  const idx = ty * state.map.width + wrapX(state.map, tx);
  if (ty < 0 || ty >= state.map.height || !me.explored[idx]) {
    text(ctx, TEXT_X, y, "Unexplored", { color: UI.dim });
    return y + LINE;
  }
  const t = state.map.tiles[idx]!;
  const r = TERRAIN_RULES[t.terrain];
  fillRound(ctx, TEXT_X, y + 2, 14, 14, 3, TERRAIN[t.terrain].base);
  text(ctx, TEXT_X + 22, y, t.special && r.special ? `${TERRAIN_NAMES[t.terrain]} · ${r.special.name}` : TERRAIN_NAMES[t.terrain], { weight: "600" });
  y += LINE + 2;
  const move = `{boot} ${r.moveCost}${r.defense !== 1 ? `  {tower} +${Math.round((r.defense - 1) * 100)}%` : ""}`;
  y += iconParagraph(ctx, TEXT_X, y, TEXT_W, tileIconLine(state, tx, ty, move), { size: 14, color: UI.ink }, Math.max(1, Math.floor((bottom - y) / 20)));
  const city = cityAt(state, tx, ty);
  if (city && y < bottom) {
    y += 2;
    drawIconLine(ctx, TEXT_X, y, `{city} ${city.name}`, { size: 14, weight: "600", color: playerColor(state.players[city.owner]!.color) });
    y += LINE;
  }
  const units = me.visible[idx] ? unitAt(state, tx, ty) : [];
  if (units.length && y < bottom) {
    const top = units[0]!;
    const who = top.owner === me.id ? "" : ` (${state.players[top.owner]!.name})`;
    const label = units.length === 1 ? `${unitType(top.type).name}${who}` : `${units.length}× ${unitType(top.type).name}${who}`;
    y += 2;
    y += paragraph(ctx, TEXT_X, y, TEXT_W, label, { size: 14, color: playerColor(state.players[top.owner]!.color) }, 2);
    const jobs = units.flatMap((u) => (u.order.kind === "work" ? [`{${WORK_ICON[u.order.work]}} ${u.order.turnsLeft}`] : []));
    if (jobs.length && y < bottom) y += iconParagraph(ctx, TEXT_X, y, TEXT_W, jobs.join("  "), { size: 13, color: UI.dim }, 1);
  }
  return y;
}

/** Moves left as pips: bright for each whole move, half-lit for thirds, dark for spent. */
function movePips(ctx: Context2D, x: number, y: number, left: number, allowance: number): void {
  const total = Math.ceil(allowance / 3);
  if (total > 10) { drawIconLine(ctx, x, y - 3, `{boot} ${Math.floor(left / 3)}${left % 3 ? ` ${left % 3}/3` : ""}`, { size: 13, color: UI.dim }); return; }
  for (let i = 0; i < total; i++) {
    const have = left - i * 3;
    const cx = x + 6 + i * 15;
    circle(ctx, cx, y + 6, 5.5, UI.panelEdge);
    if (have >= 3) circle(ctx, cx, y + 6, 5.5, UI.accent);
    else if (have > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(cx - 6, y + 6, 12, 6);
      ctx.clip();
      circle(ctx, cx, y + 6, 5.5, UI.accent);
      ctx.restore();
    }
  }
}

function drawPanel(ctx: Context2D, state: GameState, view: MainScreenView): void {
  const { map } = state;
  const me = state.players[state.currentPlayer]!;
  ctx.fillStyle = UI.panel;
  ctx.fillRect(0, BAR_H, PANEL_W, H - BAR_H);
  ctx.fillStyle = UI.panelEdge;
  ctx.fillRect(PANEL_W - 1, BAR_H, 1, H - BAR_H);

  // Minimap at two pixels per tile.
  const mw = map.width * MINIMAP_SCALE;
  const mh = map.height * MINIMAP_SCALE;
  fillRound(ctx, MINIMAP_X - 4, MINIMAP_Y - 4, mw + 8, mh + 8, 6, "#05080d");
  for (let y = 0; y < map.height; y++)
    for (let x = 0; x < map.width; x++) {
      if (!me.explored[y * map.width + x]) continue;
      ctx.fillStyle = mapColor(map, x, y, me.explored);
      ctx.fillRect(MINIMAP_X + x * MINIMAP_SCALE, MINIMAP_Y + y * MINIMAP_SCALE, MINIMAP_SCALE, MINIMAP_SCALE);
    }
  for (const u of state.units) {
    if (!me.visible[u.y * map.width + u.x]) continue;
    ctx.fillStyle = playerColor(state.players[u.owner]!.color);
    ctx.fillRect(MINIMAP_X + u.x * MINIMAP_SCALE, MINIMAP_Y + u.y * MINIMAP_SCALE, MINIMAP_SCALE, MINIMAP_SCALE);
  }
  for (const c of state.cities) {
    if (!me.explored[c.y * map.width + c.x]) continue;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(MINIMAP_X + c.x * MINIMAP_SCALE - 1, MINIMAP_Y + c.y * MINIMAP_SCALE - 1, MINIMAP_SCALE + 2, MINIMAP_SCALE + 2);
  }
  const vx = ((view.originX % map.width) + map.width) % map.width;
  const vy = Math.max(0, view.originY);
  ctx.strokeStyle = "rgba(255,255,255,0.85)";
  ctx.lineWidth = 1;
  const rw = Math.min(VIEW_TILES_X, map.width - vx) * MINIMAP_SCALE;
  ctx.strokeRect(MINIMAP_X + vx * MINIMAP_SCALE + 0.5, MINIMAP_Y + vy * MINIMAP_SCALE + 0.5, rw, Math.min(VIEW_TILES_Y, map.height - vy) * MINIMAP_SCALE);
  if (vx + VIEW_TILES_X > map.width) ctx.strokeRect(MINIMAP_X + 0.5, MINIMAP_Y + vy * MINIMAP_SCALE + 0.5, (vx + VIEW_TILES_X - map.width) * MINIMAP_SCALE, Math.min(VIEW_TILES_Y, map.height - vy) * MINIMAP_SCALE);

  // Empire: population and year, treasury and tax/luxury/science, government and research, as icons.
  let y = MINIMAP_Y + mh + 14;
  const pop = state.cities.filter((c) => c.owner === state.currentPlayer).reduce((n, c) => n + c.size * (c.size + 1) * 5000, 0);
  const half = PANEL_W / 2 + 4;
  drawIconLine(ctx, TEXT_X, y, `{people} ${pop >= 1000000 ? `${(pop / 1000000).toFixed(1)}M` : pop.toLocaleString("en-US")}`, { size: 14 });
  drawIconLine(ctx, half, y, `{calendar} ${formatYear(turnToYear(state.turn))}`, { size: 14, weight: "600" });
  y += LINE + 4;
  drawIconLine(ctx, TEXT_X, y, `{purse} ${me.gold}`, { size: 14 });
  drawIconLine(ctx, half - 26, y, `{coin}${me.taxRate * 10}  {gem}${me.luxRate * 10}  {bulb}${me.sciRate * 10}`, { size: 12, color: UI.dim });
  y += LINE + 4;
  drawIconLine(ctx, TEXT_X, y, `{crown} ${GOVERNMENTS[me.government]?.name ?? me.government}`, { size: 13, color: UI.accent });
  y += LINE + 4;
  // Research: the advance under study with the turns to go, and a bar of the beakers toward it.
  const research = researchOutlook(state);
  if (research.id) {
    const turns = research.turns === null ? "no science" : `${research.turns} turn${research.turns === 1 ? "" : "s"}`;
    const tw = measure(ctx, turns, 12);
    drawIconLine(ctx, TEXT_X, y, `{bulb} ${fitText(ctx, research.name, PANEL_W - 16 - TEXT_X - tw - 30, 14)}`, { size: 14 });
    text(ctx, PANEL_W - 16 - tw, y + 2, turns, { size: 12, color: UI.dim });
    const bw = PANEL_W - 16 - TEXT_X;
    fillRound(ctx, TEXT_X, y + LINE + 1, bw, 6, 3, UI.panelEdge);
    if (research.have > 0) fillRound(ctx, TEXT_X, y + LINE + 1, Math.max(6, (bw * Math.min(research.have, research.cost)) / research.cost), 6, 3, UI.info);
    y += LINE + 10;
  } else if (research.open) {
    drawIconLine(ctx, TEXT_X, y, "{bulb} Pick research", { size: 14, color: UI.info });
    y += LINE;
  }
  ctx.fillStyle = UI.panelEdge;
  ctx.fillRect(12, y, PANEL_W - 24, 1);
  y += 10;

  // Unit card: badge, name, moves as pips; then its square and its orders as icons.
  const shown = shownActive(state, view);
  const active = shown !== null ? unitById(state, shown) : undefined;
  if (active) {
    const type = unitType(active.type);
    fillRound(ctx, 12, y - 4, PANEL_W - 24, 56, 10, UI.panelLight);
    paintBadge(ctx, 10, y - 4, active.type, state.players[active.owner]!.color, 40);
    text(ctx, 66, y + 2, type.name, { size: 16, weight: "600" });
    if (active.veteran) paintIcon(ctx, "star", 66 + measure(ctx, type.name, 16, "600") + 6, y + 3, 15);
    movePips(ctx, 66, y + 25, active.movesLeft, moveAllowance(state, active));
    const max = maxHp(state, active.type);
    if (active.hp < max) {
      const bw = 56;
      const bx = PANEL_W - 24 - bw;
      paintIcon(ctx, "heart", bx - 18, y + 24, 13);
      fillRound(ctx, bx, y + 28, bw, 6, 3, COMBAT.hpBack);
      const ratio = active.hp / max;
      fillRound(ctx, bx, y + 28, Math.max(6, bw * ratio), 6, 3, ratio > 0.5 ? COMBAT.hpGood : ratio > 0.25 ? COMBAT.hpFair : COMBAT.hpPoor);
    }
    y += 60;
    const home = active.homeCity !== null ? state.cities.find((c) => c.id === active.homeCity) : undefined;
    if (home) { drawIconLine(ctx, TEXT_X, y, `{house} ${home.name}`, { size: 13, color: UI.dim }); y += LINE; }
    const t = getTile(map, active.x, active.y);
    if (t) {
      fillRound(ctx, TEXT_X, y + 2, 14, 14, 3, TERRAIN[t.terrain].base);
      text(ctx, TEXT_X + 22, y, TERRAIN_NAMES[t.terrain], { size: 14, color: UI.dim });
      y += LINE + 2;
      y += iconParagraph(ctx, TEXT_X, y, TEXT_W, tileIconLine(state, active.x, active.y), { size: 14, color: UI.ink }, 2);
    }
    // Orders this unit can take here: a keycap, then a picture of the job.
    const w = workOptions(state, active);
    const keys: [string, IconName][] = [];
    if (type.flags?.includes("settler") && !canFoundCity(state, active.x, active.y)) keys.push(["B", "city"]);
    if (w.irrigate !== undefined) keys.push(["I", "irrigate"]);
    if (w.mine !== undefined) keys.push(["M", "mine"]);
    if (w.road !== undefined) keys.push(["R", "road"]);
    else if (w.railroad !== undefined) keys.push(["R", "railroad"]);
    if (w.fortress !== undefined) keys.push(["F", "fortress"]);
    if (w.clean !== undefined) keys.push(["P", "clean"]);
    let kx = TEXT_X;
    if (keys.length) y += 4;
    for (const [key, icon] of keys) {
      if (kx + 44 > PANEL_W - 12) { kx = TEXT_X; y += 26; }
      fillRound(ctx, kx, y, 20, 20, 5, ICON.keycap);
      strokeRound(ctx, kx + 0.5, y + 0.5, 19, 19, 5, ICON.keyEdge, 1);
      text(ctx, kx + 10, y + 3, key, { size: 13, weight: "600", align: "center" });
      paintIcon(ctx, icon, kx + 23, y + 2, 16);
      kx += 46;
    }
    if (keys.length) y += 22;
  } else if (view.focus === undefined) {
    drawIconLine(ctx, TEXT_X, y, "{hourglass} End of turn", { size: 16, weight: "600" });
    y += LINE + 4;
    text(ctx, TEXT_X, y, view.autoEnd ? "ending automatically" : "press Enter", { size: 13, color: UI.dim });
    y += LINE;
  }
  y += 8;
  ctx.fillStyle = UI.panelEdge;
  ctx.fillRect(12, y, PANEL_W - 24, 1);
  y += 10;

  // War list pinned to the bottom.
  const enemies = state.players.filter((p) => p.id !== me.id && p.alive && p.id !== state.barbarians && atWar(state, me.id, p.id));
  let bottom = H - 12;
  if (enemies.length) {
    const lines = Math.min(2, Math.ceil(enemies.length / 2));
    bottom = H - 14 - lines * 17 - LINE;
    paintIcon(ctx, "swords", TEXT_X, bottom + LINE, 16);
    paragraph(ctx, TEXT_X + 24, bottom + LINE, TEXT_W - 24, enemies.map((p) => p.name).join(", "), { size: 13, color: UI.danger }, lines);
  }

  // Info area: inspected tile or the latest message.
  if (view.inspect) tileInfo(ctx, state, view.inspect.x, view.inspect.y, y, bottom);
  else if (view.message) paragraph(ctx, TEXT_X, y, TEXT_W, view.message, { size: 14, color: UI.accent }, Math.max(0, Math.floor((bottom - y) / 18)));
}

export function drawMainScreen(ctx: Context2D, state: GameState, view: MainScreenView): void {
  ctx.fillStyle = UI.bg;
  ctx.fillRect(0, 0, W, H);
  drawViewport(ctx, state, view);
  drawPanel(ctx, state, view);
  drawMenuBar(ctx, view.menuOpen);
}
