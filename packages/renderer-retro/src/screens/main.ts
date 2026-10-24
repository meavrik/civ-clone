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
import { drawText, drawTextCentered, drawTextPlate, drawTextRinged, drawTextWrapped, FONT_HEIGHT, textPlateWidth, textWidth, wrapText } from "../font.js";
import { drawBorderSide, drawBurst, drawFortress, drawGrassShield, drawHpBar, drawIrrigation, drawMine, drawPollution, drawRailroad, drawRoad, drawUnit, drawUnitFlash, unitSprite } from "../overlays.js";
import { C, shade, slotColor, PALETTE } from "../palette.js";
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

/**
 * The main screen may be drawn wider than the original's 320 (the mobile app fills a phone held
 * sideways): the panel keeps its place at the left, the menu bar runs the whole width, and the map
 * shows more squares across. Everything below takes the width from the surface it draws on.
 */
export function viewAcross(screenW: number): number {
  return Math.ceil((screenW - PANEL_W) / TILE);
}

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
  s.rect(0, 0, s.width, BAR_H, shade("panel", 6));
  s.hline(0, BAR_H - 1, s.width, shade("panel", 2));
  menuBarLayout().forEach(({ x, w }, i) => {
    const on = i === open;
    if (on) s.rect(x - 4, 0, w + 8, BAR_H - 1, shade("azure", 2));
    drawText(s, x, 1, MENU_BAR[i]!, on ? C.WHITE! : C.BLACK!);
  });
}

import { borderSides, cityLook, cityMood, fieldSides, isDeepWater, researchOutlook, type Callout, MENU_BAR, ownerAt, settlerSites, shownActive, territory, tileIcons, WORK_ICON, type MainScreenView, type CityMood } from "@civ/renderer-api";
import { drawIcon, drawIconLine, drawIconsWrapped, drawMark, ICON, iconLineWidth } from "../icons.js";

export { PLAYER_COLORS, slotColor } from "../palette.js";
/** A player's colour: their civilization's slot, never their seat. */
export function playerColor(state: GameState, owner: number): number {
  return slotColor(state.players[owner]?.color ?? 0);
}

export const MINIMAP_COLOR: Record<Terrain, () => number> = {
  [Terrain.Ocean]: () => shade("ocean", 7),
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
  return isDeepWater(map, x, y, explored) ? shade("ocean", 4) : MINIMAP_COLOR[map.tiles[y * map.width + x]!.terrain]();
}

/** Screen position of a map tile relative to the viewport, or null if off-screen. */
/** Pixel shift of the whole viewport while the camera glides between tiles. */
export function panOffset(view: MainScreenView): [number, number] {
  return [Math.round((view.panX ?? 0) * TILE), Math.round((view.panY ?? 0) * TILE)];
}

export function tileToScreen(state: GameState, view: MainScreenView, x: number, y: number, across = VIEW_TILES_X): [number, number] | null {
  const w = state.map.width;
  let tx = (((x - view.originX) % w) + w) % w;
  if (tx > w - 1) tx -= w; // a unit sliding out past the left edge, under the panel
  const ty = y - view.originY;
  if (tx > across || ty <= -1 || ty > VIEW_TILES_Y) return null;
  const [ox, oy] = panOffset(view);
  return [Math.round(VIEW_X + tx * TILE - ox), Math.round(VIEW_Y + ty * TILE - oy)];
}

export function drawMapViewport(s: Surface, state: GameState, view: MainScreenView): void {
  const { map } = state;
  const me = state.players[state.currentPlayer]!;
  const [ox, oy] = panOffset(view);
  const across = viewAcross(s.width);
  const toScreen = (x: number, y: number) => tileToScreen(state, view, x, y, across);
  // Fog goes on last, over the borders; borders over every square, as their corners reach into the next one.
  const fogs: [Surface, number, number][] = [];
  const terr = view.borders ? territory(state) : null;
  for (let ty = 0; ty <= VIEW_TILES_Y; ty++) {
    const my = view.originY + ty;
    const dy = VIEW_Y + ty * TILE - oy;
    for (let tx = 0; tx <= across; tx++) {
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
      if (tile.grassShield && tile.terrain === Terrain.Grassland) drawGrassShield(s, dx, dy, ground);
      // Every square, as roads between two of its neighbours cut across its corners.
      drawRoad(s, dx, dy, map, me.explored, mx, my, ground);
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
      for (let tx = 0; tx <= across; tx++) {
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
    const pos = toScreen(c.x, c.y);
    if (pos) drawCity(s, pos[0], pos[1], c, cityLook(state, c), playerColor(state, c.owner), held.has(idx) && (c.owner === state.currentPlayer || me.visible[idx] === 1));
  }
  // Their names under them, as the original showed them; drawn before the units so no unit is hidden by a name.
  for (const c of shownCities) {
    const pos = toScreen(c.x, c.y);
    if (pos) drawCityLabel(s, pos[0] + (TILE >> 1), pos[1] + TILE + 1, c.name, c.size, playerColor(state, c.owner), c.owner === state.currentPlayer ? cityMood(state, c) : null);
  }
  // Settlers in play: pins on the best squares near them to found a city on (`settlerSites`), under the units.
  const active = shownActive(state, view);
  const settler = active !== null ? state.units.find((u) => u.id === active && u.owner === me.id) : undefined;
  if (settler) for (const site of settlerSites(state, settler.id)) {
    const pos = toScreen(site.x, site.y);
    if (pos) drawSiteMark(s, pos[0], pos[1], site.best);
  }
  // A planned move's route, under the units: a dot on each square on the way.
  if (view.plan) for (const [x, y] of view.plan.route.slice(0, -1)) {
    const pos = toScreen(x, y);
    if (pos) drawRouteDot(s, pos[0] + (TILE >> 1), pos[1] + (TILE >> 1));
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
    const pos = toScreen(u.x, u.y);
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
    const pos = toScreen(m.x, m.y);
    if (!pos) continue;
    drawUnit(s, { type: m.type, order: { kind: "none" } }, pos[0], pos[1], playerColor(state, m.owner), m.stacked === true || moving.some((o) => o.aboard === m.unit));
    const hp = m.hp ?? state.units.find((u) => u.id === m.unit)?.hp;
    const max = m.maxHp ?? maxHp(state, m.type);
    if (hp !== undefined && hp < max) drawHpBar(s, pos[0], pos[1], hp, max);
  }
  // The fight: the attacker lunges in, each blow flashes on the side it lands on, the loser bursts.
  if (battle)
    for (const f of [battle.defender, battle.attacker]) {
      const pos = toScreen(f.x, f.y);
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
    const pos = toScreen(act.order.x, act.order.y);
    if (pos) s.frame(pos[0], pos[1], TILE, TILE, C.YELLOW!);
  }

  // A planned move's end: corners round the square and the note (turns, odds), till the second click.
  if (view.plan) {
    const pos = toScreen(view.plan.x, view.plan.y);
    if (pos) drawTargetCorners(s, pos[0], pos[1]);
    drawCallout(s, state, view, { x: view.plan.x, y: view.plan.y, text: view.plan.text });
  }

  if (view.callout) drawCallout(s, state, view, view.callout);
  else if (view.hint) drawCallout(s, state, view, view.hint);

  // Letterbox the bottom half-row like the original's hard panel edge.
  void VIEW_H;
}

/**
 * A city's size on a plate of the owner's colour and its name after it, centred under its square:
 * the plate edged and the name ringed in black, so they read on any ground; the figures black, or
 * white on a dark colour.
 */
export function drawCityLabel(s: Surface, cx: number, y: number, name: string, size: number, color: number, mood: CityMood | null = null): void {
  const n = String(size);
  const plate = textPlateWidth(n);
  const pennant = mood ? MOOD_PENNANT_W : 0;
  const x0 = cx - Math.floor((pennant + plate + 2 + textWidth(name)) / 2);
  if (mood) drawMoodPennant(s, x0, y, mood);
  const [r, g, b] = PALETTE[color]!;
  const ink = 0.299 * r + 0.587 * g + 0.114 * b > 140 ? C.BLACK! : C.WHITE!;
  drawTextPlate(s, x0 + pennant, y, n, color, C.BLACK!, ink);
  drawTextRinged(s, x0 + pennant + plate + 2, y, name, color, C.BLACK!);
}

/** Screen pixels a mood pennant takes before a city's size plate. */
export const MOOD_PENNANT_W = 5;

/** The fill of a mood pennant: red in disorder, yellow one lost happy citizen from it, green while the city celebrates. */
export function moodColor(mood: CityMood): number {
  return mood === "disorder" ? C.LRED! : mood === "unrest" ? C.YELLOW! : C.LGREEN!;
}

/**
 * A city's mood (`cityMood`, the viewer's own cities only) as a pennant on a pole before its size
 * plate, kept off the city's square, where the town flies its owner's flag: a black pole the height
 * of the plate, the pennant tapering to the right, edged in black.
 */
export function drawMoodPennant(s: Surface, x: number, y: number, mood: CityMood): void {
  const f = Math.max(1, s.k / 2);
  const X = x * s.k;
  const Y = y * s.k - f;
  const fill = moodColor(mood);
  s.frect(X, Y, f, (FONT_HEIGHT * s.k) + 2 * f, C.BLACK!);
  // Rows of the pennant, in fine pixels from the pole: black edge, then the colour, narrowing.
  const rows: [number, number][] = [[7, -1], [7, 5], [7, 5], [6, 4], [6, 4], [5, 3], [4, 2], [3, -1]];
  rows.forEach(([w, inner], r) => {
    s.frect(X + f, Y + r * f, w * f, f, C.BLACK!);
    if (inner > 0) s.frect(X + f, Y + r * f, inner * f, f, r < 3 ? fill : darker(fill));
  });
}

const CALLOUT_W = 150;

/** A note beside a square of the map: a stone box above it (below it near the top), its point at the square. */
function drawCallout(s: Surface, state: GameState, view: MainScreenView, c: Callout): void {
  const pos = tileToScreen(state, view, c.x, c.y, viewAcross(s.width));
  if (!pos) return;
  const lines = wrapText(c.text, CALLOUT_W - 8).slice(0, 4);
  const w = Math.max(...lines.map(textWidth)) + 9;
  const h = lines.length * FONT_HEIGHT + 5;
  const cx = pos[0] + (TILE >> 1);
  const x = Math.max(VIEW_X + 1, Math.min(s.width - 1 - w, cx - (w >> 1)));
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

/**
 * A suggested city site, kept abstract and quiet (asked for 2026-10-23: the pins were "bad"): a dotted
 * edge round the square, a dot of one screen pixel every few along each side, gold for the best site and
 * pale for the others. The mouse over it explains the site (`view.hint`).
 */
const SITE_DOTS = [3, 9, 15, 21, 27];
function drawSiteMark(s: Surface, x: number, y: number, best: boolean): void {
  const c = best ? shade("wheat", 7) : shade("panel", 7);
  const k = s.k;
  const last = TILE * k - 2 * k;
  const dot = (i: number, j: number) => {
    for (let b = 0; b < k; b++) for (let a = 0; a < k; a++) s.fset(x * k + i + a, y * k + j + b, c);
  };
  for (const p of SITE_DOTS) {
    const q = Math.round((p * k) / 2);
    dot(q, k);
    dot(q, last);
    dot(k, q);
    dot(last, q);
  }
}

/** A dot on a planned route: white, ringed in black so it reads on any ground. */
function drawRouteDot(s: Surface, cx: number, cy: number): void {
  s.rect(cx - 2, cy - 2, 4, 4, C.BLACK!);
  s.rect(cx - 1, cy - 1, 2, 2, C.WHITE!);
}

/** The corners of a planned move's square: white brackets edged in black. */
function drawTargetCorners(s: Surface, x: number, y: number): void {
  const L = 5;
  for (const [cx, cy, sx, sy] of [[x, y, 1, 1], [x + TILE - 1, y, -1, 1], [x, y + TILE - 1, 1, -1], [x + TILE - 1, y + TILE - 1, -1, -1]] as const) {
    for (let i = 0; i < L; i++) {
      s.set(cx + i * sx, cy + sy, C.BLACK!);
      s.set(cx + sx, cy + i * sy, C.BLACK!);
    }
    for (let i = 0; i < L; i++) {
      s.set(cx + i * sx, cy, C.WHITE!);
      s.set(cx, cy + i * sy, C.WHITE!);
    }
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
    drawMark(s, have >= 3 ? "move" : have > 0 ? "move_part" : "move_none", (x + i * 5) * 2, (y + 2) * 2);
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
  const shows = zoomedTiles(viewZoom(view), s.width);
  const vh = Math.min(map.height - vy, shows.y);
  const left = toPixel(k, vx);
  const right = toPixel(k, vx + shows.x - 1);
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
  magnifyViewport(s, viewZoom(view));
  drawStatusPanel(s, state, view);
  drawMenuBar(s, view.menuOpen);
}

/** How many times larger the view draws the map's squares (`MainScreenView.zoom`): a whole number, 1 when unset. */
export function viewZoom(view: MainScreenView): number {
  return Math.max(1, Math.floor(view.zoom ?? 1));
}

/** Squares (or parts of one) that show across and down the viewport at a zoom, on a screen `screenW` wide. */
export function zoomedTiles(zoom: number, screenW = SCREEN_W): { x: number; y: number } {
  return { x: Math.ceil((screenW - PANEL_W) / (TILE * zoom)), y: Math.ceil(VIEW_H / (TILE * zoom)) };
}

/** A point on a zoomed viewport as the point of the map drawn at 1:1 under it (anywhere else as it is). */
export function unzoomPoint(view: MainScreenView, px: number, py: number): [number, number] {
  const z = viewZoom(view);
  if (z === 1 || px < VIEW_X || py < VIEW_Y) return [px, py];
  return [VIEW_X + Math.floor((px - VIEW_X) / z), VIEW_Y + Math.floor((py - VIEW_Y) / z)];
}

/**
 * Zoom: the viewport's top-left 1/zoom, drawn as usual, blown up to fill it, fine pixel by fine pixel.
 * In place, from the far corner back: each pixel reads one up and left of it, not yet overwritten.
 */
function magnifyViewport(s: Surface, zoom: number): void {
  if (zoom <= 1) return;
  const x0 = VIEW_X * s.k;
  const y0 = VIEW_Y * s.k;
  for (let y = VIEW_H * s.k - 1; y >= 0; y--) {
    const to = (y0 + y) * s.fw + x0;
    const from = (y0 + Math.floor(y / zoom)) * s.fw + x0;
    for (let x = (s.width - PANEL_W) * s.k - 1; x >= 0; x--) s.data[to + x] = s.data[from + Math.floor(x / zoom)]!;
  }
}
