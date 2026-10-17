import {
  atWar,
  canFoundCity,
  cityAt,
  formatYear,
  GOVERNMENTS,
  getTile,
  maxHp,
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
import { MENU_BAR, type MainScreenView } from "@civ/renderer-api";
import type { Context2D } from "../context.js";
import { fillRound, measure, panel, paragraph, strokeRound, text } from "../draw.js";
import { paintBadge, paintBurst, paintCity, paintCityLabel, paintHitFlash, paintHpBar, paintUnit, playerColor } from "../markers.js";
import { paintFog, paintFortress, paintHut, paintIrrigation, paintMine, paintPollution, paintRiver, paintRoad, paintSpecial, paintTile } from "../tiles.js";
import { BAR_H, H, PANEL_W, TERRAIN, TILE, UI, VIEW_TILES_X, VIEW_TILES_Y, VIEW_X, VIEW_Y, W } from "../theme.js";

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

function riverMask(state: GameState, x: number, y: number): number {
  let mask = 0;
  const dirs = [[0, -1, 1], [1, 0, 2], [0, 1, 4], [-1, 0, 8]] as const;
  for (const [dx, dy, bit] of dirs) {
    const t = getTile(state.map, x + dx, y + dy);
    if (t && (t.river || t.terrain === Terrain.Ocean)) mask |= bit;
  }
  return mask;
}

function roadMask(state: GameState, x: number, y: number, rail: boolean): number {
  let mask = 0;
  NEIGHBOURS.forEach(([dx, dy], i) => {
    const n = getTile(state.map, x + dx, y + dy);
    if (n && (rail ? n.railroad : n.road)) mask |= 1 << i;
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
  for (let ty = 0; ty <= VIEW_TILES_Y; ty++) {
    const my = view.originY + ty;
    const dy = VIEW_Y + ty * TILE - oy;
    for (let tx = 0; tx <= VIEW_TILES_X; tx++) {
      const mx = (((view.originX + tx) % map.width) + map.width) % map.width;
      const dx = VIEW_X + tx * TILE - ox;
      if (my < 0 || my >= map.height || !me.explored[my * map.width + mx]) {
        ctx.fillStyle = UI.bg;
        ctx.fillRect(dx, dy, TILE, TILE);
        continue;
      }
      const tile = map.tiles[my * map.width + mx]!;
      paintTile(ctx, dx, dy, tile, mx, my);
      if (tile.river) paintRiver(ctx, dx, dy, riverMask(state, mx, my));
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

  for (const c of state.cities) {
    if (!me.explored[c.y * map.width + c.x]) continue;
    const pos = tileToScreen(state, view, c.x, c.y);
    if (pos) paintCity(ctx, pos[0], pos[1], c, state.players[c.owner]!.color);
  }

  // A unit sliding between squares is drawn after the rest, where it is now.
  // So is a fight under way: both fighters come from view.battle.
  const moving = view.moving ?? [];
  const battle = view.battle;
  const slidingIds = new Set(moving.map((m) => m.unit));
  if (battle) { slidingIds.add(battle.attacker.unit); slidingIds.add(battle.defender.unit); }
  const units = slidingIds.size ? state.units.filter((u) => !slidingIds.has(u.id)) : state.units;
  const drawn = new Set<number>();
  for (const u of units) {
    const idx = u.y * map.width + u.x;
    if (!me.visible[idx] || drawn.has(idx)) continue;
    const pos = tileToScreen(state, view, u.x, u.y);
    if (!pos) continue;
    const stack = units.filter((o) => o.x === u.x && o.y === u.y);
    const top = stack.find((o) => o.id === state.activeUnit) ?? stack[0]!;
    drawn.add(idx);
    const isActive = top.id === state.activeUnit;
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
      active: m.unit === state.activeUnit,
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

  const act = state.activeUnit !== null ? state.units.find((u) => u.id === state.activeUnit) : undefined;
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
  ctx.restore();
}

const TEXT_X = 16;
const TEXT_W = PANEL_W - 32;
const LINE = 19;

function tileInfo(ctx: Context2D, state: GameState, tx: number, ty: number, y: number, bottom: number): number {
  const me = state.players[state.currentPlayer]!;
  const idx = ty * state.map.width + wrapX(state.map, tx);
  if (ty < 0 || ty >= state.map.height || !me.explored[idx]) {
    text(ctx, TEXT_X, y, "Unexplored", { color: UI.dim });
    return y + LINE;
  }
  const t = state.map.tiles[idx]!;
  const r = TERRAIN_RULES[t.terrain];
  const city = cityAt(state, tx, ty);
  fillRound(ctx, TEXT_X, y + 2, 14, 14, 3, TERRAIN[t.terrain].base);
  text(ctx, TEXT_X + 22, y, TERRAIN_NAMES[t.terrain], { weight: "600" });
  y += LINE;
  const yld = tileYield(state, t, city !== undefined, me.government);
  text(ctx, TEXT_X, y, `Food ${yld.food}  Shields ${yld.shields}  Trade ${yld.trade}`, { size: 13, color: UI.dim });
  y += LINE - 3;
  text(ctx, TEXT_X, y, `Move ${r.moveCost}${r.defense !== 1 ? `   Defence x${r.defense}` : ""}`, { size: 13, color: UI.dim });
  y += LINE;
  const extras = [
    t.special && r.special?.name, t.river && "River", t.railroad ? "Railroad" : t.road && "Road", t.irrigation && "Irrigation",
    t.mine && "Mine", t.fortress && "Fortress", t.pollution && "Pollution", t.hut && "Village",
  ].filter(Boolean).join(", ");
  if (extras && y < bottom) y += paragraph(ctx, TEXT_X, y, TEXT_W, extras, { size: 13, color: UI.ink }, Math.max(1, Math.floor((bottom - y) / 17)));
  if (city && y < bottom) {
    y += 4;
    y += paragraph(ctx, TEXT_X, y, TEXT_W, `${city.name} (${state.players[city.owner]!.name})`, { size: 14, weight: "600", color: playerColor(state.players[city.owner]!.color) }, 2);
  }
  const units = me.visible[idx] ? unitAt(state, tx, ty) : [];
  if (units.length && y < bottom) {
    const top = units[0]!;
    const who = top.owner === me.id ? "ours" : state.players[top.owner]!.name;
    const label = units.length === 1 ? `${unitType(top.type).name} (${who})` : `${units.length} units: ${unitType(top.type).name} (${who})`;
    y += 4;
    y += paragraph(ctx, TEXT_X, y, TEXT_W, label, { size: 14, color: playerColor(state.players[top.owner]!.color) }, 2);
  }
  return y;
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
      ctx.fillStyle = TERRAIN[map.tiles[y * map.width + x]!.terrain].base;
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

  // Empire line.
  let y = MINIMAP_Y + mh + 14;
  const pop = state.cities.filter((c) => c.owner === state.currentPlayer).reduce((n, c) => n + c.size * (c.size + 1) * 5000, 0);
  text(ctx, PANEL_W / 2, y, pop >= 1000000 ? `${(pop / 1000000).toFixed(1)}M people` : `${pop.toLocaleString("en-US")} people`, { size: 14, align: "center" });
  y += LINE;
  text(ctx, PANEL_W / 2, y, formatYear(turnToYear(state.turn)), { size: 18, weight: "600", align: "center" });
  y += LINE + 4;
  text(ctx, PANEL_W / 2, y, `${me.gold} gold   tax ${me.taxRate * 10}%  lux ${me.luxRate * 10}%  sci ${me.sciRate * 10}%`, { size: 12, color: UI.dim, align: "center" });
  y += LINE - 2;
  text(ctx, PANEL_W / 2, y, GOVERNMENTS[me.government]?.name ?? me.government, { size: 13, color: UI.accent, align: "center" });
  y += LINE + 2;
  ctx.fillStyle = UI.panelEdge;
  ctx.fillRect(12, y, PANEL_W - 24, 1);
  y += 10;

  // Unit card.
  const active = state.activeUnit !== null ? unitById(state, state.activeUnit) : undefined;
  if (active) {
    const type = unitType(active.type);
    fillRound(ctx, 12, y - 4, PANEL_W - 24, 56, 10, UI.panelLight);
    paintBadge(ctx, 10, y - 4, active.type, state.players[active.owner]!.color, 40);
    text(ctx, 66, y + 2, type.name, { size: 16, weight: "600" });
    const whole = Math.floor(active.movesLeft / 3);
    const frac = active.movesLeft % 3;
    const home = active.homeCity !== null ? state.cities.find((c) => c.id === active.homeCity) : undefined;
    const max = maxHp(state, active.type);
    const hp = active.hp < max ? `  ·  ${active.hp}/${max} hp` : "";
    text(ctx, 66, y + 24, `Moves ${whole}${frac ? ` ${frac}/3` : ""}${hp}${home ? `  ·  ${home.name}` : ""}`, { size: 13, color: UI.dim });
    y += 60;
    const t = getTile(map, active.x, active.y);
    if (t) {
      const r = TERRAIN_RULES[t.terrain];
      const extras = [t.river && "River", t.railroad ? "Railroad" : t.road && "Road", t.irrigation && "Irrigation", t.mine && "Mine", t.fortress && "Fortress", t.pollution && "Pollution", t.special && r.special?.name]
        .filter(Boolean)
        .join(", ");
      y += paragraph(ctx, TEXT_X, y, TEXT_W, `${TERRAIN_NAMES[t.terrain]}${extras ? ` · ${extras}` : ""}`, { size: 13, color: UI.dim }, 2);
    }
    const w = workOptions(state, active);
    const keys = [
      unitType(active.type).flags?.includes("settler") && !canFoundCity(state, active.x, active.y) && "B found",
      w.irrigate !== undefined && "I irrigate", w.mine !== undefined && "M mine", w.road !== undefined && "R road", w.railroad !== undefined && "R rail",
      w.fortress !== undefined && "F fort", w.clean !== undefined && "P clean",
    ].filter(Boolean) as string[];
    if (keys.length) y += paragraph(ctx, TEXT_X, y + 2, TEXT_W, keys.join("  "), { size: 12, color: UI.accent }, 2) + 2;
  } else {
    text(ctx, TEXT_X, y, "End of turn", { size: 16, weight: "600" });
    y += LINE + 2;
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
    text(ctx, TEXT_X, bottom + 2, "At war with", { size: 12, color: UI.danger });
    paragraph(ctx, TEXT_X, bottom + LINE, TEXT_W, enemies.map((p) => p.name).join(", "), { size: 13, color: UI.danger }, lines);
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
