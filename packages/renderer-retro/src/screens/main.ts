import {
  atWar,
  canFoundCity,
  cityAt,
  formatYear,
  GOVERNMENTS,
  getTile,
  maxHp,
  moveAllowance,
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
  specialOf,
} from "@civ/core";
import { drawText, drawTextCentered, drawTextRinged, drawTextWrapped, FONT_HEIGHT, textWidth, wrapText } from "../font.js";
import { drawBorderSide, drawBurst, drawFortress, drawHpBar, drawIrrigation, drawMine, drawPollution, drawRailroad, drawRoad, drawUnit, drawUnitFlash, unitSprite } from "../overlays.js";
import { C, shade, slotColor } from "../palette.js";
import { SCREEN_H, SCREEN_W, Surface } from "../surface.js";
import { drawHut, drawSpecial, fogSquare, terrainSquare, TILE } from "../tiles.js";
import { SPRITE_CLEAR } from "../sprites/sheet.js";
import { darker } from "../sprites/index.js";
import { BAD, DIM, drawStone, drawSwatch, INK, NOTE } from "../widgets.js";
import { drawCity } from "./map-city.js";
import { techLabel } from "./research.js";

/**
 * Main map screen layout, as in the original: a menu bar across the top, a
 * left-hand status column and a tile viewport below it. The column is 80px
 * wide, which fits an 80x50 minimap at one pixel per tile (a bigger world's
 * pixels each stand for a block of squares, see `minimapScale`).
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

/** The menu bar: a light grey strip matching the status column, the open title in the selection's blue. */
export function drawMenuBar(s: Surface, open?: number): void {
  s.rect(0, 0, SCREEN_W, BAR_H, shade("panel", 6));
  s.hline(0, BAR_H - 1, SCREEN_W, shade("panel", 2));
  menuBarLayout().forEach(({ x, w }, i) => {
    const on = i === open;
    if (on) s.rect(x - 4, 0, w + 8, BAR_H - 1, shade("azure", 2));
    drawText(s, x, 1, MENU_BAR[i]!, on ? C.WHITE! : C.BLACK!);
  });
}

import { borderSides, fieldSides, isDeepWater, researchOutlook, type Callout, MENU_BAR, ownerAt, shownActive, territory, tileIcons, WORK_ICON, type MainScreenView } from "@civ/renderer-api";
import { drawIcon, drawIconLine, drawIconsWrapped, ICON, iconLineWidth } from "../icons.js";

export { PLAYER_COLORS, slotColor } from "../palette.js";
/** A player's colour: their civilization's slot, never their seat. */
export function playerColor(state: GameState, owner: number): number {
  return slotColor(state.players[owner]?.color ?? 0);
}

export const MINIMAP_COLOR: Record<Terrain, () => number> = {
  [Terrain.Ocean]: () => shade("sea", 0),
  [Terrain.Grassland]: () => shade("meadow", 6),
  [Terrain.Plains]: () => shade("wheat", 3),
  [Terrain.Forest]: () => shade("leaf", 2),
  [Terrain.Hills]: () => shade("mound", 6),
  [Terrain.Mountains]: () => shade("rock", 2),
  [Terrain.Desert]: () => shade("dune", 7),
  [Terrain.Tundra]: () => shade("heath", 7),
  [Terrain.Arctic]: () => shade("ice", 7),
  [Terrain.Swamp]: () => shade("mire", 3),
  [Terrain.Jungle]: () => shade("canopy", 1),
};

/** A square's minimap colour; open sea is darker than water along a coast. */
export function minimapColor(map: GameState["map"], x: number, y: number, explored?: ArrayLike<number>): number {
  return isDeepWater(map, x, y, explored) ? shade("sea", 0) : MINIMAP_COLOR[map.tiles[y * map.width + x]!.terrain]();
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
  // Fog goes on last, over the borders; borders over every square, as their corners reach into the next one.
  const fogs: [Surface, number, number][] = [];
  const terr = view.borders ? territory(state) : null;
  for (let ty = 0; ty <= VIEW_TILES_Y; ty++) {
    const my = view.originY + ty;
    const dy = VIEW_Y + ty * TILE - oy;
    for (let tx = 0; tx <= VIEW_TILES_X; tx++) {
      const mx = (((view.originX + tx) % map.width) + map.width) % map.width;
      const dx = VIEW_X + tx * TILE - ox;
      if (my < 0 || my >= map.height) {
        s.rect(dx, dy, TILE, TILE, C.BLACK!);
        continue;
      }
      // Unexplored squares are black; the black drifts a little way into explored squares beside them.
      const fog = fogSquare(map, me.explored, mx, my, view.lifting);
      if (!me.explored[my * map.width + mx]) {
        s.blit(fog!, dx, dy);
        continue;
      }
      const tile = map.tiles[my * map.width + mx]!;
      const ground = terrainSquare(map, mx, my, me.explored);
      s.blit(ground, dx, dy);
      if (tile.irrigation) drawIrrigation(s, dx, dy, ground, tile.terrain, mx, my, fieldSides(map, me.explored, mx, my));
      // Every square, as roads between two of its neighbours cut across its corners.
      drawRoad(s, dx, dy, map, me.explored, mx, my);
      drawRailroad(s, dx, dy, map, me.explored, mx, my);
      if (tile.mine) drawMine(s, dx, dy);
      if (tile.special) drawSpecial(s, dx, dy, tile);
      if (tile.hut) drawHut(s, dx, dy);
      if (tile.fortress) drawFortress(s, dx, dy);
      if (tile.pollution) drawPollution(s, dx, dy);
      if (fog) fogs.push([fog, dx, dy]);
    }
  }
  if (terr)
    for (let ty = 0; ty <= VIEW_TILES_Y; ty++)
      for (let tx = 0; tx <= VIEW_TILES_X; tx++) {
        const mx = (((view.originX + tx) % map.width) + map.width) % map.width;
        const my = view.originY + ty;
        if (my < 0 || my >= map.height || !me.explored[my * map.width + mx]) continue;
        const owner = ownerAt(terr, mx, my);
        if (owner < 0) continue;
        const color = playerColor(state, owner);
        for (const b of borderSides(terr, mx, my)) drawBorderSide(s, VIEW_X + tx * TILE - ox, VIEW_Y + ty * TILE - oy, b.side, b.startOut, b.endOut, color, darker(color));
      }
  for (const [fog, dx, dy] of fogs) s.blit(fog, dx, dy, SPRITE_CLEAR);

  // Cities on explored tiles. Foreign cities and units wait for fog lifting off their square to thin.
  const fogged = (idx: number, owner: number) => owner !== state.currentPlayer && (view.lifting?.get(idx) ?? 0) >= 0.5;
  // A city with units inside shows a shield: always on our own, on others' while we see the square.
  const held = new Set(state.units.map((u) => u.y * map.width + u.x));
  const shownCities = state.cities.filter((c) => me.explored[c.y * map.width + c.x] && !fogged(c.y * map.width + c.x, c.owner));
  for (const c of shownCities) {
    const idx = c.y * map.width + c.x;
    const pos = tileToScreen(state, view, c.x, c.y);
    if (pos) drawCity(s, pos[0], pos[1], c, playerColor(state, c.owner), held.has(idx) && (c.owner === state.currentPlayer || me.visible[idx] === 1));
  }
  // Their names under them, as the original showed them; drawn before the units so no unit is hidden by a name.
  for (const c of shownCities) {
    const pos = tileToScreen(state, view, c.x, c.y);
    if (pos) drawCityLabel(s, pos[0] + (TILE >> 1), pos[1] + TILE + 1, c.name, playerColor(state, c.owner));
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
    if (!me.visible[idx] || drawn.has(idx) || fogged(idx, u.owner)) continue;
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

  if (view.callout) drawCallout(s, state, view, view.callout);

  // Letterbox the bottom half-row like the original's hard panel edge.
  void VIEW_H;
}

/** A city's name centred under its square: the owner's colour ringed in black, so it reads on any ground. */
function drawCityLabel(s: Surface, cx: number, y: number, name: string, color: number): void {
  drawTextRinged(s, cx - Math.floor(textWidth(name) / 2), y, name, color, C.BLACK!);
}

const CALLOUT_W = 150;

/** A note beside a square of the map: a stone box above it (below it near the top), its point at the square. */
function drawCallout(s: Surface, state: GameState, view: MainScreenView, c: Callout): void {
  const pos = tileToScreen(state, view, c.x, c.y);
  if (!pos) return;
  const lines = wrapText(c.text, CALLOUT_W - 8).slice(0, 4);
  const w = Math.max(...lines.map(textWidth)) + 9;
  const h = lines.length * FONT_HEIGHT + 5;
  const cx = pos[0] + (TILE >> 1);
  const x = Math.max(VIEW_X + 1, Math.min(SCREEN_W - 1 - w, cx - (w >> 1)));
  const above = pos[1] - 5 - h >= VIEW_Y + 1;
  const y = above ? pos[1] - 5 - h : pos[1] + TILE + 5;
  s.frame(x, y, w, h, C.BLACK!);
  drawStone(s, x + 1, y + 1, w - 2, h - 2);
  lines.forEach((l, i) => drawText(s, x + 5, y + 3 + i * FONT_HEIGHT, l, INK));
  // The point: a black-rimmed wedge from the box's edge toward the square.
  const px = Math.max(x + 5, Math.min(x + w - 6, cx));
  for (let i = 0; i < 4; i++) {
    const row = above ? y + h - 1 + i : y - i;
    s.hline(px - (3 - i), row, 2 * (3 - i) + 1, C.BLACK!);
    if (i < 3) s.hline(px - (2 - i), row, 2 * (2 - i) + 1, shade("panel", 5));
  }
}

const TEXT_X = 3;
const TEXT_W = PANEL_W - 6;
const PANEL_BOTTOM = SCREEN_H - 2;

/** News in blue, wars in red. */
const NEWS = NOTE;
const WAR = BAD;

/** A groove across the status column between its boxes: a dark line over a light one. */
function groove(s: Surface, y: number): void {
  s.hline(1, y, PANEL_W - 2, shade("panel", 2));
  s.hline(1, y + 1, PANEL_W - 2, shade("panel", 7));
}

const ownerFlag = drawSwatch;

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
  const yld = tileYield(state, t, cityAt(state, x, y) !== undefined, state.players[state.currentPlayer]!.government, state.currentPlayer);
  const features = tileIcons(t).map((i) => `{${i}}`);
  if (t.special) features.unshift("{star}");
  // Yields stay together, then the extra (movement) and the features, each a group that may wrap.
  return [`{food}${yld.food} {shield}${yld.shields} {trade}${yld.trade}`, extra, features.join("")].filter(Boolean).join("  ");
}

/** What a tile holds, for the inspect box: terrain, yields and features as icons, city, units. Returns the next y. */
export function drawTileInfo(s: Surface, state: GameState, tx: number, ty: number, x: number, y: number): number {
  const me = state.players[state.currentPlayer]!;
  const ink = INK;
  const dim = DIM;
  const idx = ty * state.map.width + wrapX(state.map, tx);
  if (ty < 0 || ty >= state.map.height || !me.explored[idx]) {
    drawText(s, x, y, "Unexplored", dim);
    return y + FONT_HEIGHT;
  }
  const t = state.map.tiles[idx]!;
  const r = TERRAIN_RULES[t.terrain];
  terrainSwatch(s, t.terrain, x, y);
  drawTextWrapped(s, x + 10, y, TEXT_W - 10, specialOf(t) ? `${TERRAIN_NAMES[t.terrain]}: ${specialOf(t)!.name}` : TERRAIN_NAMES[t.terrain], ink, 1);
  y += 9;
  const move = `{boot}${r.moveCost}${r.defense !== 1 ? ` {tower}+${Math.round((r.defense - 1) * 100)}%` : ""}`;
  y += 9 * drawIconsWrapped(s, x, y, TEXT_W, tileIconLine(state, tx, ty, move), ink, Math.min(3, linesLeft(y)));
  const city = cityAt(state, tx, ty);
  if (city && linesLeft(y) > 0) {
    drawIcon(s, "city", x, y);
    ownerFlag(s, x + 9, y, playerColor(state, city.owner));
    drawTextWrapped(s, x + 17, y, TEXT_W - 17, city.name, ink, 1);
    y += 9;
  }
  const units = me.visible[idx] ? unitAt(state, tx, ty) : [];
  if (units.length && linesLeft(y) > 0) {
    const top = units[0]!;
    const label = units.length === 1 ? unitType(top.type).name : `${units.length}x ${unitType(top.type).name}`;
    ownerFlag(s, x, y, playerColor(state, top.owner));
    y += FONT_HEIGHT * drawTextWrapped(s, x + 8, y, TEXT_W - 8, label, ink, 1);
    const jobs = units.flatMap((u) => (u.order.kind === "work" ? [`{${WORK_ICON[u.order.work]}}${u.order.turnsLeft}`] : []));
    if (jobs.length && linesLeft(y) > 0) y += 9 * drawIconsWrapped(s, x, y, TEXT_W, jobs.join("  "), dim, 1);
  }
  return y;
}

function ratesLine(state: GameState): string {
  const me = state.players[state.currentPlayer]!;
  return `{coin}${me.taxRate}{gem}${me.luxRate}{bulb}${me.sciRate}`;
}

/** Where the status panel's rows fall: whether the rates wrap under the treasury, and the top of the research row. */
function empireRows(state: GameState): { wrapRates: boolean; researchY: number } {
  const me = state.players[state.currentPlayer]!;
  const top = VIEW_Y + 2 + minimapSize(state.map).h + 4;
  const wrapRates = TEXT_X + iconLineWidth(`{purse}${me.gold}`) + 2 + iconLineWidth(ratesLine(state)) > PANEL_W - 2;
  return { wrapRates, researchY: top + 9 * (wrapRates ? 5 : 4) };
}

/** What the status panel holds under a point: the research row (when research is under way) opens the research panel. */
export function statusPanelAt(state: GameState, px: number, py: number): "research" | null {
  if (px < 0 || px >= PANEL_W || !researchOutlook(state).id) return null;
  const { researchY } = empireRows(state);
  return py >= researchY - 1 && py < researchY + 14 ? "research" : null;
}

/**
 * Research: the advance under study by a bulb with the turns still to go, and under them a
 * thin bar of the beakers gathered toward it; nothing while none is picked. Returns the y after it.
 * A click on it opens the research panel (`statusPanelAt`).
 */
function drawResearch(s: Surface, state: GameState, y: number): number {
  const r = researchOutlook(state);
  if (!r.id) return y + 1;
  const node = { id: r.id, name: r.name };
  const turns = `{hourglass}${r.turns === null ? "-" : r.turns}`;
  const tw = iconLineWidth(turns);
  drawIcon(s, "bulb", TEXT_X, y);
  drawTextWrapped(s, TEXT_X + ICON + 1, y, TEXT_W - ICON - tw - 3, techLabel(node), INK, 1);
  drawIconLine(s, TEXT_X + TEXT_W - tw, y, turns, DIM);
  s.rect(TEXT_X, y + 9, TEXT_W, 4, C.BLACK!);
  const fill = Math.round(((TEXT_W - 2) * Math.min(r.have, r.cost)) / r.cost);
  if (fill > 0) s.rect(TEXT_X + 1, y + 10, fill, 2, C.LCYAN!);
  return y + 15;
}

/** Moves left as pips: bright for each whole move, half-lit for thirds, dark for spent. Returns the x after them. */
function drawMovePips(s: Surface, x: number, y: number, left: number, allowance: number): number {
  const total = Math.ceil(allowance / 3);
  if (total > 10) return drawIconLine(s, x, y, `{boot}${Math.floor(left / 3)}${left % 3 ? `.${left % 3}` : ""}`, INK);
  for (let i = 0; i < total; i++) {
    const have = left - i * 3;
    const px = x + i * 5;
    s.rect(px, y + 2, 4, 4, C.BLACK!);
    if (have >= 3) s.rect(px, y + 2, 4, 4, C.YELLOW!);
    else if (have > 0) s.rect(px, y + 4, 4, 2, C.YELLOW!);
  }
  return x + total * 5;
}

/**
 * Squares a minimap pixel stands for along each axis: 1 on the original's
 * 80x50 (or anything narrower), 1.5 on a medium world, 2 on a large one.
 */
export function minimapScale(map: GameState["map"]): number {
  return Math.max(1, map.width / PANEL_W);
}

/** The minimap's size in pixels: the panel's 80 across, and 50 down on every world size. */
export function minimapSize(map: GameState["map"]): { w: number; h: number } {
  const k = minimapScale(map);
  return { w: Math.ceil(map.width / k), h: Math.ceil(map.height / k) };
}

/** The minimap pixel a square falls in, along one axis. */
const toPixel = (k: number, v: number) => Math.floor(v / k);
/** The first square a minimap pixel stands for, along one axis (the next pixel's first ends it). */
const fromPixel = (k: number, p: number) => Math.ceil(p * k);

/**
 * The minimap, one pixel a square on the original's world (a block of squares on a bigger
 * one: the first explored land in it, else its sea, so islands still show): explored squares
 * in their terrain's colour; with borders shown, a line of the owner's colour along the inside
 * edge of the land its cities reach; units we see in their owner's colour; and each known city
 * as a white dot in a cross of its owner's colour (a darker shade inside a border, so the city
 * stands out from the line round it).
 */
function drawMinimap(s: Surface, state: GameState, view: MainScreenView, top: number): void {
  const { map } = state;
  const me = state.players[state.currentPlayer]!;
  const k = minimapScale(map);
  const { w, h } = minimapSize(map);
  s.rect(0, top, PANEL_W, h, C.BLACK!);
  // The square each pixel shows (-1: nothing explored there), and the one its border reads.
  const shown = new Int32Array(w * h).fill(-1);
  const owned = new Int32Array(w * h);
  for (let py = 0; py < h; py++)
    for (let px = 0; px < w; px++) {
      const y0 = fromPixel(k, py);
      const y1 = Math.min(map.height, fromPixel(k, py + 1));
      const x0 = fromPixel(k, px);
      const x1 = Math.min(map.width, fromPixel(k, px + 1));
      let pick = -1;
      for (let y = y0; y < y1 && (pick < 0 || map.tiles[pick]!.terrain === Terrain.Ocean); y++)
        for (let x = x0; x < x1; x++) {
          const i = y * map.width + x;
          if (!me.explored[i]) continue;
          if (pick < 0 || map.tiles[i]!.terrain !== Terrain.Ocean) pick = i;
          if (map.tiles[pick]!.terrain !== Terrain.Ocean) break;
        }
      shown[py * w + px] = pick;
      owned[py * w + px] = pick >= 0 ? pick : y0 * map.width + x0;
      if (pick >= 0) s.set(px, top + py, minimapColor(map, pick % map.width, Math.floor(pick / map.width), me.explored));
    }
  if (view.borders) {
    const terr = territory(state);
    const ownerOf = (px: number, py: number) => {
      if (py < 0 || py >= h) return -1;
      const i = owned[py * w + (((px % w) + w) % w)]!;
      return ownerAt(terr, i % map.width, Math.floor(i / map.width));
    };
    for (let py = 0; py < h; py++)
      for (let px = 0; px < w; px++) {
        if (shown[py * w + px]! < 0) continue;
        const own = ownerOf(px, py);
        if (own < 0) continue;
        if (ownerOf(px - 1, py) !== own || ownerOf(px + 1, py) !== own || ownerOf(px, py - 1) !== own || ownerOf(px, py + 1) !== own)
          s.set(px, top + py, playerColor(state, own));
      }
  }
  for (const u of state.units) if (me.visible[u.y * map.width + u.x]) s.set(toPixel(k, u.x), top + toPixel(k, u.y), playerColor(state, u.owner));
  const put = (px: number, py: number, color: number) => { if (py >= 0 && py < h) s.set(((px % w) + w) % w, top + py, color); };
  // Every cross first, then every dot: on a bigger world cities share neighbouring pixels, and no arm may hide a city.
  const known = state.cities.filter((c) => me.explored[c.y * map.width + c.x]);
  for (const c of known) {
    const color = playerColor(state, c.owner);
    const arm = view.borders ? darker(color) : color;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) put(toPixel(k, c.x) + dx, toPixel(k, c.y) + dy, arm);
  }
  for (const c of known) put(toPixel(k, c.x), toPixel(k, c.y), C.WHITE!);
  // The unit awaiting orders: a blinking yellow box round its pixel, so it can be found from anywhere.
  const pending = shownActive(state, view);
  const unit = pending !== null ? unitById(state, pending) : undefined;
  if (unit && view.blink) {
    const ux = toPixel(k, unit.x);
    const uy = toPixel(k, unit.y);
    for (let d = -2; d <= 2; d++) {
      put(ux + d, uy - 2, C.YELLOW!);
      put(ux + d, uy + 2, C.YELLOW!);
      put(ux - 2, uy + d, C.YELLOW!);
      put(ux + 2, uy + d, C.YELLOW!);
    }
  }
}

/** The map square under a minimap pixel (the middle of the block it stands for), or null off the map. */
export function minimapSquare(map: GameState["map"], px: number, py: number): { x: number; y: number } | null {
  const { w, h } = minimapSize(map);
  if (px < 0 || py < 0 || px >= w || py >= h) return null;
  const k = minimapScale(map);
  return { x: Math.min(map.width - 1, Math.floor((px + 0.5) * k)), y: Math.min(map.height - 1, Math.floor((py + 0.5) * k)) };
}

export function drawStatusPanel(s: Surface, state: GameState, view: MainScreenView): void {
  const { map } = state;
  const me = state.players[state.currentPlayer]!;
  // Light speckled stone under everything, bevelled at its edges like the original's panels.
  const mm = minimapSize(map);
  s.rect(0, VIEW_Y, PANEL_W, SCREEN_H - VIEW_Y, C.BLACK!);
  drawStone(s, 0, VIEW_Y + mm.h + 3, PANEL_W, SCREEN_H - (VIEW_Y + mm.h + 3));

  // Minimap: 80x50, one pixel per tile on the original's world; the viewport framed in white.
  const mmY = VIEW_Y + 2;
  drawMinimap(s, state, view, mmY);
  const k = minimapScale(map);
  const vx = ((view.originX % map.width) + map.width) % map.width;
  const vy = Math.max(0, view.originY);
  const vh = Math.min(map.height - vy, VIEW_TILES_Y);
  const left = toPixel(k, vx);
  const right = toPixel(k, vx + VIEW_TILES_X - 1);
  const topY = mmY + toPixel(k, vy);
  const bottomY = mmY + toPixel(k, vy + vh - 1);
  for (let px = left; px <= right; px++) {
    s.set(px % mm.w, topY, C.WHITE!);
    s.set(px % mm.w, bottomY, C.WHITE!);
  }
  for (let py = topY; py <= bottomY; py++) {
    s.set(left % mm.w, py, C.WHITE!);
    s.set(right % mm.w, py, C.WHITE!);
  }

  // Empire: population, year, treasury and tax/luxury/science, government and research, as icons.
  let y = mmY + mm.h + 4;
  const ink = INK;
  const dim = DIM;
  const pop = state.cities.filter((c) => c.owner === state.currentPlayer).reduce((n, c) => n + c.size * (c.size + 1) * 5000, 0);
  drawIconLine(s, TEXT_X, y, `{people}${pop >= 1000000 ? `${(pop / 1000000).toFixed(1)}M` : pop >= 1000 ? `${Math.floor(pop / 1000)},000` : String(pop)}`, ink);
  y += 9;
  drawIconLine(s, TEXT_X, y, `{calendar} ${formatYear(turnToYear(state.turn))}`, ink);
  y += 9;
  const { wrapRates, researchY } = empireRows(state);
  let x = drawIconLine(s, TEXT_X, y, `{purse}${me.gold}`, ink) + 2;
  if (wrapRates) { y += 9; x = TEXT_X; }
  drawIconLine(s, x, y, ratesLine(state), dim);
  y += 9;
  drawIconLine(s, TEXT_X, y, `{crown}${GOVERNMENTS[me.government]?.name ?? me.government}`, dim);
  y = drawResearch(s, state, researchY);
  groove(s, y);
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
  y += 2;
  groove(s, y);
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
    lines.forEach((line, i) => drawText(s, TEXT_X + 10, bottom + 2 + i * FONT_HEIGHT, line, WAR));
  }

  // Info area: the tile under inspection, else the latest message.
  if (view.inspect) drawTileInfo(s, state, view.inspect.x, view.inspect.y, TEXT_X, y);
  else if (view.message) drawTextWrapped(s, TEXT_X, y, TEXT_W, view.message, NEWS, Math.max(0, Math.floor((bottom - y) / FONT_HEIGHT)));
}

export function drawMainScreen(s: Surface, state: GameState, view: MainScreenView): void {
  s.fill(C.BLACK!);
  drawMapViewport(s, state, view);
  drawStatusPanel(s, state, view);
  drawMenuBar(s, view.menuOpen);
}
