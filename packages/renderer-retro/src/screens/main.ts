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
  researchCost,
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
import { drawText, drawTextCentered, drawTextWrapped, FONT_HEIGHT, textWidth, wrapText } from "../font.js";
import { drawBurst, drawFortress, drawHpBar, drawIrrigation, drawMine, drawPollution, drawRailroad, drawRoad, drawUnit, drawUnitFlash, unitSprite } from "../overlays.js";
import { C, shade } from "../palette.js";
import { SCREEN_H, SCREEN_W, Surface } from "../surface.js";
import { drawHut, drawRiver, drawSpecial, terrainSquare, TILE } from "../tiles.js";
import { SPRITE_CLEAR } from "../sprites/sheet.js";
import { drawCity } from "./map-city.js";

/**
 * Main map screen layout, as in the original: a menu bar across the top, a
 * left-hand status column and a tile viewport below it. The column is 80px
 * wide, which fits an 80x50 minimap at one pixel per tile.
 */
export const BAR_H = 9;
export const PANEL_W = 80;
export const VIEW_X = PANEL_W;
export const VIEW_Y = BAR_H;
export const VIEW_W = SCREEN_W - PANEL_W; // 240 = 15 tiles
export const VIEW_H = SCREEN_H - BAR_H; // 191 = 12 tiles (the last one cut)
export const VIEW_TILES_X = Math.ceil(VIEW_W / TILE);
export const VIEW_TILES_Y = Math.ceil(VIEW_H / TILE);

const BAR_X0 = 6;
const BAR_GAP = 14;

/** Left edge and width of each menu bar title. */
export function menuBarLayout(): { x: number; w: number }[] {
  let x = BAR_X0;
  return MENU_BAR.map((t) => {
    const w = textWidth(t);
    const r = { x, w };
    x += w + BAR_GAP;
    return r;
  });
}

export function menuBarHit(px: number, py: number): number {
  if (py < 0 || py >= BAR_H) return -1;
  return menuBarLayout().findIndex(({ x, w }) => px >= x - BAR_GAP / 2 && px < x + w + BAR_GAP / 2);
}

export function menuBarAnchor(index: number): { x: number; y: number } {
  const t = menuBarLayout()[index] ?? { x: BAR_X0, w: 0 };
  return { x: Math.max(0, t.x - 6), y: BAR_H };
}

/** The menu bar: parchment strip with the titles, the open one inverted. */
export function drawMenuBar(s: Surface, open?: number): void {
  s.rect(0, 0, SCREEN_W, BAR_H, shade("ui", 6));
  s.hline(0, BAR_H - 1, SCREEN_W, shade("ui", 3));
  menuBarLayout().forEach(({ x, w }, i) => {
    const on = i === open;
    if (on) s.rect(x - 4, 0, w + 8, BAR_H - 1, shade("ui", 1));
    drawText(s, x, 1, MENU_BAR[i]!, on ? shade("ui", 7) : C.BLACK!);
  });
}

import { isDeepWater, MENU_BAR, shownActive, tileIcons, WORK_ICON, type MainScreenView } from "@civ/renderer-api";
import { drawIcon, drawIconLine, drawIconsWrapped, iconLineWidth } from "../icons.js";

/** Palette colour for each colour slot, in CIV_COLORS order: white, green, blue, yellow, cyan, magenta, grey, orange, red. */
export const PLAYER_COLORS = [C.WHITE!, C.LGREEN!, C.LBLUE!, C.YELLOW!, C.LCYAN!, C.LMAGENTA!, C.LGREY!, C.ORANGE!, C.LRED!];
export function slotColor(slot: number): number {
  return PLAYER_COLORS[((slot % PLAYER_COLORS.length) + PLAYER_COLORS.length) % PLAYER_COLORS.length]!;
}
/** A player's colour: their civilization's slot, never their seat. */
export function playerColor(state: GameState, owner: number): number {
  return slotColor(state.players[owner]?.color ?? 0);
}

export const MINIMAP_COLOR: Record<Terrain, () => number> = {
  [Terrain.Ocean]: () => shade("ocean", 3),
  [Terrain.Grassland]: () => shade("grass", 4),
  [Terrain.Plains]: () => shade("plains", 4),
  [Terrain.Forest]: () => shade("forest", 3),
  [Terrain.Hills]: () => shade("earth", 4),
  [Terrain.Mountains]: () => shade("stone", 4),
  [Terrain.Desert]: () => shade("sand", 5),
  [Terrain.Tundra]: () => shade("swamp", 5),
  [Terrain.Arctic]: () => shade("snow", 7),
  [Terrain.Swamp]: () => shade("swamp", 3),
  [Terrain.Jungle]: () => shade("jungle", 3),
};

/** A square's minimap colour; open sea is darker than water along a coast. */
export function minimapColor(map: GameState["map"], x: number, y: number): number {
  return isDeepWater(map, x, y) ? shade("ocean", 1) : MINIMAP_COLOR[map.tiles[y * map.width + x]!.terrain]();
}

function riverMask(state: GameState, x: number, y: number): number {
  const m = state.map;
  let mask = 0;
  const dirs = [[0, -1, 1], [1, 0, 2], [0, 1, 4], [-1, 0, 8]] as const;
  for (const [dx, dy, bit] of dirs) {
    const t = getTile(m, x + dx, y + dy);
    if (t && (t.river || t.terrain === Terrain.Ocean)) mask |= bit;
  }
  return mask;
}

function roadMask(state: GameState, x: number, y: number, rail = false): number {
  let mask = 0;
  NEIGHBOURS.forEach(([dx, dy], i) => {
    const n = getTile(state.map, x + dx, y + dy);
    if (n && (rail ? n.railroad : n.road)) mask |= 1 << i;
  });
  return mask;
}

/** Screen position of a map tile relative to the viewport, or null if off-screen. */
/** Pixel shift of the whole viewport while the camera glides between tiles. */
export function panOffset(view: MainScreenView): [number, number] {
  return [Math.round((view.panX ?? 0) * TILE), Math.round((view.panY ?? 0) * TILE)];
}

export function tileToScreen(state: GameState, view: MainScreenView, x: number, y: number): [number, number] | null {
  const w = state.map.width;
  let tx = (((x - view.originX) % w) + w) % w;
  if (tx > w - 1) tx -= w; // a unit sliding out past the left edge, under the panel
  const ty = y - view.originY;
  if (tx > VIEW_TILES_X || ty <= -1 || ty > VIEW_TILES_Y) return null;
  const [ox, oy] = panOffset(view);
  return [Math.round(VIEW_X + tx * TILE - ox), Math.round(VIEW_Y + ty * TILE - oy)];
}

export function drawMapViewport(s: Surface, state: GameState, view: MainScreenView): void {
  const { map } = state;
  const me = state.players[state.currentPlayer]!;
  const [ox, oy] = panOffset(view);
  for (let ty = 0; ty <= VIEW_TILES_Y; ty++) {
    const my = view.originY + ty;
    const dy = VIEW_Y + ty * TILE - oy;
    for (let tx = 0; tx <= VIEW_TILES_X; tx++) {
      const mx = (((view.originX + tx) % map.width) + map.width) % map.width;
      const dx = VIEW_X + tx * TILE - ox;
      if (my < 0 || my >= map.height || !me.explored[my * map.width + mx]) {
        s.rect(dx, dy, TILE, TILE, C.BLACK!);
        continue;
      }
      const tile = map.tiles[my * map.width + mx]!;
      s.blit(terrainSquare(map, mx, my), dx, dy);
      if (tile.river) drawRiver(s, dx, dy, riverMask(state, mx, my));
      if (tile.irrigation) drawIrrigation(s, dx, dy);
      if (tile.mine) drawMine(s, dx, dy);
      if (tile.road) drawRoad(s, dx, dy, roadMask(state, mx, my));
      if (tile.railroad) drawRailroad(s, dx, dy, roadMask(state, mx, my, true));
      if (tile.special) drawSpecial(s, dx, dy, tile.terrain);
      if (tile.hut) drawHut(s, dx, dy);
      if (tile.fortress) drawFortress(s, dx, dy);
      if (tile.pollution) drawPollution(s, dx, dy);
    }
  }

  // Cities on explored tiles.
  for (const c of state.cities) {
    if (!me.explored[c.y * map.width + c.x]) continue;
    const pos = tileToScreen(state, view, c.x, c.y);
    if (pos) drawCity(s, pos[0], pos[1], c, playerColor(state, c.owner));
  }

  // Units: only those on tiles we currently see. Draw one per tile (top of stack).
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
    if (!me.visible[idx] || drawn.has(idx)) continue;
    const pos = tileToScreen(state, view, u.x, u.y);
    if (!pos) continue;
    const stack = units.filter((o) => o.x === u.x && o.y === u.y);
    const top = stack.find((o) => o.id === activeId) ?? stack[0]!;
    drawn.add(idx);
    const isActive = top.id === activeId;
    // Units inside a city are hidden behind it unless active, like the original.
    if (!isActive && state.cities.some((c) => c.x === u.x && c.y === u.y)) continue;
    if (isActive && !view.blink) continue;
    drawUnit(s, top, pos[0], pos[1], playerColor(state, top.owner), stack.length > 1);
    const max = maxHp(state, top.type);
    if (top.hp < max) drawHpBar(s, pos[0], pos[1], top.hp, max);
  }
  for (const m of moving) {
    if (m.aboard !== undefined) continue;
    const pos = tileToScreen(state, view, m.x, m.y);
    if (!pos) continue;
    drawUnit(s, { type: m.type, order: { kind: "none" } }, pos[0], pos[1], playerColor(state, m.owner), m.stacked === true || moving.some((o) => o.aboard === m.unit));
    const hp = m.hp ?? state.units.find((u) => u.id === m.unit)?.hp;
    const max = m.maxHp ?? maxHp(state, m.type);
    if (hp !== undefined && hp < max) drawHpBar(s, pos[0], pos[1], hp, max);
  }
  // The fight: the attacker lunges in, each blow flashes on the side it lands on, the loser bursts.
  if (battle)
    for (const f of [battle.defender, battle.attacker]) {
      const pos = tileToScreen(state, view, f.x, f.y);
      if (!pos) continue;
      const color = playerColor(state, f.owner);
      const gone = f.dying > 0.35 || (f.dying > 0 && Math.floor(f.dying * 24) % 2 === 1);
      if (!gone) {
        if (f.hit > 0.45) drawUnitFlash(s, f.type, color, pos[0], pos[1]);
        else drawUnit(s, { type: f.type, order: { kind: "none" } }, pos[0], pos[1], color, f.stacked);
        drawHpBar(s, pos[0], pos[1], f.hp, f.maxHp);
      }
      if (f.dying > 0) drawBurst(s, pos[0] + 8, pos[1] + 8, f.dying);
    }

  // Goto destination of the active unit.
  const act = activeId !== null ? state.units.find((u) => u.id === activeId) : undefined;
  if (act?.order.kind === "goto") {
    const pos = tileToScreen(state, view, act.order.x, act.order.y);
    if (pos) s.frame(pos[0], pos[1], TILE, TILE, C.YELLOW!);
  }

  // Letterbox the bottom half-row like the original's hard panel edge.
  void VIEW_H;
}

const TEXT_X = 3;
const TEXT_W = PANEL_W - 6;
const PANEL_BOTTOM = SCREEN_H - 2;

function linesLeft(y: number): number {
  return Math.max(0, Math.floor((PANEL_BOTTOM - y) / FONT_HEIGHT));
}

/** A small square of the terrain's colour, standing in for its name where space is short. */
function terrainSwatch(s: Surface, terrain: Terrain, x: number, y: number): void {
  s.rect(x, y, 8, 7, C.BLACK!);
  s.rect(x + 1, y + 1, 6, 5, MINIMAP_COLOR[terrain]());
}

/** A square's yields and what stands on it, as one icon line: food, shields, trade, then features. */
function tileIconLine(state: GameState, x: number, y: number, extra = ""): string {
  const t = getTile(state.map, x, y)!;
  const yld = tileYield(state, t, cityAt(state, x, y) !== undefined, state.players[state.currentPlayer]!.government);
  const features = tileIcons(t).map((i) => `{${i}}`);
  if (t.special) features.unshift("{star}");
  // Yields stay together, then the extra (movement) and the features, each a group that may wrap.
  return [`{food}${yld.food} {shield}${yld.shields} {trade}${yld.trade}`, extra, features.join("")].filter(Boolean).join("  ");
}

/** What a tile holds, for the inspect box: terrain, yields and features as icons, city, units. Returns the next y. */
export function drawTileInfo(s: Surface, state: GameState, tx: number, ty: number, x: number, y: number): number {
  const me = state.players[state.currentPlayer]!;
  const ink = shade("ui", 7);
  const dim = shade("ui", 5);
  const idx = ty * state.map.width + wrapX(state.map, tx);
  if (ty < 0 || ty >= state.map.height || !me.explored[idx]) {
    drawText(s, x, y, "Unexplored", dim);
    return y + FONT_HEIGHT;
  }
  const t = state.map.tiles[idx]!;
  const r = TERRAIN_RULES[t.terrain];
  terrainSwatch(s, t.terrain, x, y);
  drawTextWrapped(s, x + 10, y, TEXT_W - 10, r.special && t.special ? `${TERRAIN_NAMES[t.terrain]}: ${r.special.name}` : TERRAIN_NAMES[t.terrain], ink, 1);
  y += 9;
  const move = `{boot}${r.moveCost}${r.defense !== 1 ? ` {tower}+${Math.round((r.defense - 1) * 100)}%` : ""}`;
  y += 9 * drawIconsWrapped(s, x, y, TEXT_W, tileIconLine(state, tx, ty, move), ink, Math.min(3, linesLeft(y)));
  const city = cityAt(state, tx, ty);
  if (city && linesLeft(y) > 0) {
    drawIcon(s, "city", x, y);
    drawTextWrapped(s, x + 9, y, TEXT_W - 9, city.name, playerColor(state, city.owner), 1);
    y += 9;
  }
  const units = me.visible[idx] ? unitAt(state, tx, ty) : [];
  if (units.length && linesLeft(y) > 0) {
    const top = units[0]!;
    const label = units.length === 1 ? unitType(top.type).name : `${units.length}x ${unitType(top.type).name}`;
    y += FONT_HEIGHT * drawTextWrapped(s, x, y, TEXT_W, label, playerColor(state, top.owner), 1);
    const jobs = units.flatMap((u) => (u.order.kind === "work" ? [`{${WORK_ICON[u.order.work]}}${u.order.turnsLeft}`] : []));
    if (jobs.length && linesLeft(y) > 0) y += 9 * drawIconsWrapped(s, x, y, TEXT_W, jobs.join("  "), dim, 1);
  }
  return y;
}

/** Moves left as pips: bright for each whole move, half-lit for thirds, dark for spent. Returns the x after them. */
function drawMovePips(s: Surface, x: number, y: number, left: number, allowance: number): number {
  const total = Math.ceil(allowance / 3);
  if (total > 10) return drawIconLine(s, x, y, `{boot}${Math.floor(left / 3)}${left % 3 ? `.${left % 3}` : ""}`, shade("ui", 7));
  for (let i = 0; i < total; i++) {
    const have = left - i * 3;
    const px = x + i * 5;
    s.rect(px, y + 2, 4, 4, shade("ui", 0));
    if (have >= 3) s.rect(px, y + 2, 4, 4, C.YELLOW!);
    else if (have > 0) s.rect(px, y + 4, 4, 2, C.YELLOW!);
  }
  return x + total * 5;
}

export function drawStatusPanel(s: Surface, state: GameState, view: MainScreenView): void {
  const { map } = state;
  const me = state.players[state.currentPlayer]!;
  s.rect(0, VIEW_Y, PANEL_W, SCREEN_H - VIEW_Y, shade("ui", 1));

  // Minimap: 80x50, one pixel per tile.
  const mmY = VIEW_Y + 2;
  s.rect(0, mmY, PANEL_W, map.height, C.BLACK!);
  for (let y = 0; y < map.height; y++)
    for (let x = 0; x < map.width; x++) {
      if (!me.explored[y * map.width + x]) continue;
      s.set(x, mmY + y, minimapColor(map, x, y));
    }
  for (const u of state.units) if (me.visible[u.y * map.width + u.x]) s.set(u.x, mmY + u.y, playerColor(state, u.owner));
  for (const c of state.cities) if (me.explored[c.y * map.width + c.x]) s.set(c.x, mmY + c.y, C.WHITE!);
  const vx = ((view.originX % map.width) + map.width) % map.width;
  const vy = Math.max(0, view.originY);
  const vh = Math.min(map.height - vy, VIEW_TILES_Y);
  for (let x = 0; x < VIEW_TILES_X; x++) {
    const px = (vx + x) % map.width;
    s.set(px, mmY + vy, C.WHITE!);
    s.set(px, mmY + vy + vh - 1, C.WHITE!);
  }
  for (let y = 0; y < vh; y++) {
    s.set(vx, mmY + vy + y, C.WHITE!);
    s.set((vx + VIEW_TILES_X - 1) % map.width, mmY + vy + y, C.WHITE!);
  }
  s.hline(0, mmY + map.height, PANEL_W, shade("ui", 0));

  // Empire: population, year, treasury and tax/luxury/science, government and research, as icons.
  let y = mmY + map.height + 4;
  const ink = shade("ui", 7);
  const dim = shade("ui", 5);
  const pop = state.cities.filter((c) => c.owner === state.currentPlayer).reduce((n, c) => n + c.size * (c.size + 1) * 5000, 0);
  let x = drawIconLine(s, TEXT_X, y, `{people}${pop >= 1000000 ? `${(pop / 1000000).toFixed(1)}M` : pop >= 1000 ? `${Math.floor(pop / 1000)},000` : String(pop)}`, ink) + 3;
  // Research: a bulb and a bar filling toward the next advance, at the end of the population row.
  if (me.researching && x + 17 <= PANEL_W - 3) {
    drawIcon(s, "bulb", x, y);
    const bw = PANEL_W - 4 - (x + 9);
    const cost = researchCost(me.advances.length, me.difficulty);
    s.rect(x + 9, y + 2, bw, 4, shade("ui", 0));
    s.rect(x + 9, y + 2, Math.round((bw * Math.min(me.science, cost)) / cost), 4, C.LBLUE!);
  }
  y += 9;
  drawIconLine(s, TEXT_X, y, `{calendar} ${formatYear(turnToYear(state.turn))}`, ink);
  y += 9;
  x = drawIconLine(s, TEXT_X, y, `{purse}${me.gold}`, ink) + 2;
  const rates = `{coin}${me.taxRate}{gem}${me.luxRate}{bulb}${me.sciRate}`;
  if (x + iconLineWidth(rates) > PANEL_W - 2) { y += 9; x = TEXT_X; }
  drawIconLine(s, x, y, rates, dim);
  y += 9;
  drawIconLine(s, TEXT_X, y, `{crown}${GOVERNMENTS[me.government]?.name ?? me.government}`, dim);
  y += 11;
  s.hline(2, y, PANEL_W - 4, shade("ui", 0));
  y += 4;

  // Unit box: the unit awaiting orders (moves as pips, its square and orders as icons), or the end of the turn.
  const shown = shownActive(state, view);
  const active = shown !== null ? unitById(state, shown) : undefined;
  if (active) {
    const type = unitType(active.type);
    s.blit(unitSprite(active.type, playerColor(state, active.owner)), 4, y, SPRITE_CLEAR);
    const max = maxHp(state, active.type);
    if (active.hp < max) drawHpBar(s, 4, y, active.hp, max);
    const nameW = PANEL_W - 26 - (active.veteran ? 9 : 0);
    drawTextWrapped(s, 24, y, nameW, type.name, ink, 1);
    if (active.veteran) drawIcon(s, "star", Math.min(24 + textWidth(type.name) + 2, PANEL_W - 11), y);
    drawMovePips(s, 24, y + 9, active.movesLeft, moveAllowance(state, active));
    y += 18;
    const home = active.homeCity !== null ? state.cities.find((c) => c.id === active.homeCity) : undefined;
    if (home) {
      drawIcon(s, "house", TEXT_X, y);
      drawTextWrapped(s, TEXT_X + 9, y, TEXT_W - 9, home.name, dim, 1);
      y += 9;
    }
    const t = getTile(map, active.x, active.y);
    if (t) {
      terrainSwatch(s, t.terrain, TEXT_X, y);
      drawTextWrapped(s, TEXT_X + 10, y, TEXT_W - 10, TERRAIN_NAMES[t.terrain], dim, 1);
      y += 9;
      y += 9 * drawIconsWrapped(s, TEXT_X, y, TEXT_W, tileIconLine(state, active.x, active.y), ink, Math.min(2, linesLeft(y)));
    }
    // Orders this unit can take here: its key, then a picture of the job.
    const w = workOptions(state, active);
    const keys = [
      type.flags?.includes("settler") && !canFoundCity(state, active.x, active.y) && "B{city}",
      w.irrigate !== undefined && "I{irrigate}", w.mine !== undefined && "M{mine}",
      w.road !== undefined ? "R{road}" : w.railroad !== undefined && "R{railroad}",
      w.fortress !== undefined && "F{fortress}", w.clean !== undefined && "P{clean}",
    ].filter(Boolean) as string[];
    if (keys.length) y += 9 * drawIconsWrapped(s, TEXT_X, y, TEXT_W, keys.join("  "), ink, Math.min(2, linesLeft(y)));
  } else if (view.focus === undefined) {
    drawIconLine(s, TEXT_X, y, "{hourglass} End of Turn", ink);
    y += FONT_HEIGHT + 1;
    drawText(s, TEXT_X, y, view.autoEnd ? "(auto)" : "Press Enter", dim);
    y += FONT_HEIGHT;
  }
  y += 3;
  s.hline(2, y, PANEL_W - 4, shade("ui", 0));
  y += 4;

  // Bottom: who we are at war with, kept clear of everything above it.
  const enemies = state.players.filter((p) => p.id !== me.id && p.alive && p.id !== state.barbarians && atWar(state, me.id, p.id));
  let bottom = PANEL_BOTTOM;
  if (enemies.length) {
    // Whole names per line, so a comma never starts one.
    const lines: string[] = [];
    for (const p of enemies) {
      const last = lines.at(-1);
      if (last !== undefined && textWidth(`${last}, ${p.name}`) <= TEXT_W - 10) lines[lines.length - 1] = `${last}, ${p.name}`;
      else lines.push(p.name);
    }
    lines.splice(2);
    bottom = PANEL_BOTTOM - lines.length * FONT_HEIGHT - 2;
    drawIcon(s, "swords", TEXT_X, bottom + 2);
    lines.forEach((line, i) => drawText(s, TEXT_X + 10, bottom + 2 + i * FONT_HEIGHT, line, C.LRED!));
  }

  // Info area: the tile under inspection, else the latest message.
  if (view.inspect) drawTileInfo(s, state, view.inspect.x, view.inspect.y, TEXT_X, y);
  else if (view.message) drawTextWrapped(s, TEXT_X, y, TEXT_W, view.message, C.YELLOW!, Math.max(0, Math.floor((bottom - y) / FONT_HEIGHT)));

  s.vline(PANEL_W - 1, VIEW_Y, SCREEN_H - VIEW_Y, shade("ui", 0));
}

export function drawMainScreen(s: Surface, state: GameState, view: MainScreenView): void {
  s.fill(C.BLACK!);
  drawMapViewport(s, state, view);
  drawStatusPanel(s, state, view);
  drawMenuBar(s, view.menuOpen);
}
