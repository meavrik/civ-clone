import {
  building,
  buyCost,
  CITY_RADIUS,
  computeCity,
  cityCulture,
  cultureRate,
  formatYear,
  getTile,
  nextBorderLevel,
  productionName,
  slotAvailable,
  slotInLand,
  tileYield,
  turnToYear,
  wonder,
  type City,
  type GameState,
} from "@civ/core";
import { cityUnits, fieldSides, type IconName } from "@civ/renderer-api";
import { drawText, drawTextCentered, drawTextWrapped, FONT_HEIGHT, textWidth } from "../font.js";
import { drawFortress, drawIrrigation, drawMine, drawPollution, drawRailroad, drawRoad, unitSprite } from "../overlays.js";
import { C, shade } from "../palette.js";
import { SCREEN_H, SCREEN_W, Surface } from "../surface.js";
import { drawSpecial, fogSquare, terrainSquare, TILE } from "../tiles.js";
import { BAD, DIM, drawButton, drawStone, drawTitleStrip, drawWindow, GOLD, GOOD, INK, stipple, TITLE_H } from "../widgets.js";
import { CITIZEN_H, drawCitizen } from "../citizens.js";
import { drawIcon, drawIconLine, drawMark, ICON } from "../icons.js";
import { SPRITE_CLEAR } from "../sprites/sheet.js";
import { drawCity } from "./map-city.js";
import { playerColor } from "./main.js";

/** Height of a box's title strip and the line under it. */
const BOX_HEAD = TITLE_H + 1;

/**
 * City screen (320x200): stone windows on black, each with a blue title strip.
 *   title and citizens      across the top
 *   resources | map | improvements
 *   food store | units | production
 *   key hints and Exit      along the bottom
 */
const TOP = { y: 1, h: 28 };
const ROW1 = { y: 30, h: 84 };
const ROW2 = { y: 116, h: 71 };
const LEFT = { x: 1, w: 106 };
const MID = { x: 108, w: 84 };
const RIGHT = { x: 193, w: 126 };
const BAR_Y = 188;

export const CITY_MAP_X = MID.x + 2;
export const CITY_MAP_Y = ROW1.y + 2;

import type { CityButton, CityScreenView } from "@civ/renderer-api";

const EXIT = { x: SCREEN_W - 34, y: BAR_Y + 1, w: 33, h: 11 };

/** The production box's buttons, under its title strip, and View on the bottom bar beside Exit. */
const CITY_BUTTONS: Record<CityButton, { x: number; y: number; w: number; h: number; label: string }> = {
  change: { x: RIGHT.x + 3, y: ROW2.y + BOX_HEAD + 2, w: 50, h: 11, label: "Change" },
  buy: { x: RIGHT.x + RIGHT.w - 51, y: ROW2.y + BOX_HEAD + 2, w: 48, h: 11, label: "Buy" },
  view: { x: EXIT.x - 36, y: BAR_Y + 1, w: 33, h: 11, label: "View" },
};

export function cityButtonAt(px: number, py: number): CityButton | null {
  for (const [id, b] of Object.entries(CITY_BUTTONS) as [CityButton, (typeof CITY_BUTTONS)[CityButton]][])
    if (px >= b.x && px < b.x + b.w && py >= b.y && py < b.y + b.h) return id;
  return null;
}

/** The bottom bar, Exit button and all, leaves the city. */
export function cityExitHit(_px: number, py: number): boolean {
  return py >= BAR_Y && py < SCREEN_H;
}

export function citySlotAt(px: number, py: number): number | null {
  const tx = Math.floor((px - CITY_MAP_X) / TILE);
  const ty = Math.floor((py - CITY_MAP_Y) / TILE);
  if (tx < 0 || tx > 4 || ty < 0 || ty > 4) return null;
  const dx = tx - 2;
  const dy = ty - 2;
  const slot = CITY_RADIUS.findIndex(([ox, oy]) => ox === dx && oy === dy);
  return slot >= 0 ? slot : null;
}

/** Top-left of the i-th unit's sprite in the units box (`cityUnits`); what it costs is drawn under it. */
export function cityUnitSlot(i: number): { x: number; y: number } {
  return { x: MID.x + 3 + (i % 4) * 20, y: ROW2.y + BOX_HEAD + 3 + Math.floor(i / 4) * 27 };
}
const UNIT_SLOTS = 8;

/** The unit under a point in the units box, sprite or cost: clicking it wakes it and takes it to the map. */
export function cityUnitAt(state: GameState, view: CityScreenView, px: number, py: number): number | null {
  const city = state.cities.find((c) => c.id === view.city);
  if (!city) return null;
  const units = cityUnits(state, city).slice(0, UNIT_SLOTS);
  for (let i = 0; i < units.length; i++) {
    const { x, y } = cityUnitSlot(i);
    if (px >= x - 1 && px < x + 19 && py >= y - 1 && py < y + 26) return units[i]!.unit.id;
  }
  return null;
}

/** A unit away from the city: every other pixel of its square goes back to stone. */
function ghost(s: Surface, x: number, y: number): void {
  for (let dy = 0; dy < TILE; dy++) for (let dx = dy & 1; dx < TILE; dx += 2) stipple(s, x + dx, y + dy, 1, 1, "panel");
}

function say(s: Surface, x: number, y: number, text: string, color: number): number {
  return drawText(s, x, y, text, color);
}
const LABEL = DIM;

/** One of the city screen's boxes: a window with its title strip. */
function drawBox(s: Surface, x: number, y: number, w: number, h: number, title = "", right = ""): void {
  drawWindow(s, x, y, w, h, title, right ? { right } : {});
}

function yieldIcons(s: Surface, x: number, y: number, food: number, shields: number, trade: number): void {
  // Tiny marks a screen pixel apart (3x3 screen pixels each): food, shields, trade. Up to 4 per row.
  let i = 0;
  const put = (mark: "yield_food" | "yield_shield" | "yield_trade") => {
    drawMark(s, mark, (x + 1 + (i % 4) * 4) * 2, (y + 1 + Math.floor(i / 4) * 4) * 2);
    i++;
  };
  for (let k = 0; k < food; k++) put("yield_food");
  for (let k = 0; k < shields; k++) put("yield_shield");
  for (let k = 0; k < trade; k++) put("yield_trade");
}

/**
 * Icons in a row no wider than `w`, the groups a few pixels apart; when they do not
 * fit side by side they overlap, as the original's city screen stacks its goods.
 */
function iconRow(s: Surface, x: number, y: number, w: number, groups: [IconName, number][]): void {
  const shown = groups.filter(([, n]) => n > 0);
  const n = shown.reduce((t, [, k]) => t + k, 0);
  if (n === 0) return;
  const gap = 3;
  const room = w - ICON - gap * (shown.length - 1);
  const step = n > 1 ? Math.min(ICON + 1, room / (n - 1)) : 0;
  let at = 0;
  shown.forEach(([icon, k], g) => {
    for (let i = 0; i < k; i++, at++) drawIcon(s, icon, x + Math.round(at * step) + g * gap, y);
  });
}

/**
 * A store of goods as rows of icons (food in the granary, shields toward the build):
 * a darker bed the size of the box, filled from the top-left. Big boxes let one icon
 * stand for several units, so the rows never smear into a bar.
 */
function storeGrid(s: Surface, x: number, y: number, w: number, maxRows: number, icon: IconName, have: number, box: number): number {
  const per = Math.max(1, Math.ceil(box / (maxRows * 24)));
  const slots = Math.ceil(box / per);
  const perRow = Math.max(10, Math.ceil(slots / maxRows));
  const rows = Math.ceil(slots / perRow);
  const step = (w - ICON - 2) / (perRow - 1);
  s.rect(x, y, w, rows * (ICON + 1) + 1, shade("panel", 3));
  const filled = Math.min(slots, Math.floor(have / per));
  for (let i = 0; i < filled; i++) drawIcon(s, icon, x + 1 + Math.round((i % perRow) * step), y + 1 + Math.floor(i / perRow) * (ICON + 1));
  return rows * (ICON + 1) + 1;
}

export function drawCityScreen(s: Surface, state: GameState, view: CityScreenView): void {
  const city = state.cities.find((c) => c.id === view.city);
  if (!city) return;
  const player = state.players[city.owner]!;
  const r = computeCity(state, city);
  s.fill(C.BLACK!);

  // Title and citizens; the strip turns red while the city riots.
  drawBox(s, LEFT.x, TOP.y, SCREEN_W - 2, TOP.h);
  drawTitleStrip(s, LEFT.x + 2, TOP.y + 2, SCREEN_W - 6, `${city.name} (Pop ${city.size})   ${formatYear(turnToYear(state.turn))}`, { centred: true, ...(r.disorder ? { color: C.RED! } : {}) });
  // Each citizen a person of their own (`citizenLook`), standing on the window's bottom edge.
  let cx = 5;
  let n = 0;
  const cy = TOP.y + TOP.h - 1 - CITIZEN_H;
  for (let i = 0; i < r.happy; i++, cx += 8) drawCitizen(s, cx, cy, "happy", city.id, n++);
  for (let i = 0; i < r.content; i++, cx += 8) drawCitizen(s, cx, cy, "content", city.id, n++);
  for (let i = 0; i < r.unhappy; i++, cx += 8) drawCitizen(s, cx, cy, "unhappy", city.id, n++);
  cx += 4;
  for (const sp of city.specialists) { drawCitizen(s, cx, cy, sp, city.id, n++); cx += 8; }
  if (r.disorder) say(s, SCREEN_W - 6 - textWidth("CIVIL DISORDER"), TOP.y + BOX_HEAD + 4, "CIVIL DISORDER", BAD);

  // Resources: food, shields and trade as rows of icons with what is left or lost, then where the trade goes.
  drawBox(s, LEFT.x, ROW1.y, LEFT.w, ROW1.h, "City Resources");
  const rx = LEFT.x + 3;
  const rw = LEFT.w - 26;
  const num = (y: number, text: string, color: number) => say(s, LEFT.x + LEFT.w - 3 - textWidth(text), y, text, color);
  let y = ROW1.y + BOX_HEAD + 3;
  const surplus = Math.max(0, r.foodSurplus);
  iconRow(s, rx, y, rw, [["food", r.food - surplus], ["food", surplus]]);
  num(y, `${r.foodSurplus > 0 ? "+" : ""}${r.foodSurplus}`, r.foodSurplus < 0 ? BAD : r.foodSurplus > 0 ? GOOD : INK);
  y += 10;
  // Shields that go to unit support, and trade lost to corruption, stand apart at the end of their row.
  const upkeep = Math.min(r.shields, r.unitShields);
  iconRow(s, rx, y, rw, [["shield", r.shields - upkeep], ["shield", upkeep]]);
  if (r.unitShields) num(y, `-${r.unitShields}`, BAD);
  y += 10;
  iconRow(s, rx, y, rw, [["trade", r.trade - r.corruption], ["trade", r.corruption]]);
  if (r.corruption) num(y, `-${r.corruption}`, BAD);
  y += 10;
  iconRow(s, rx, y, LEFT.w - 6, [["coin", r.tax], ["gem", r.lux], ["bulb", r.science]]);
  y += 11;
  say(s, rx, y, "Upkeep", LABEL);
  num(y, `${r.buildingUpkeep}$`, INK);
  y += 9;
  if (r.routes) {
    say(s, rx, y, "Routes", LABEL);
    num(y, `+${r.routes}`, INK);
    y += 9;
  }
  if (r.pollution > 0) {
    drawIcon(s, "pollution", rx, y);
    say(s, rx + ICON + 2, y, "Smog", LABEL);
    num(y, `${r.pollution}%`, BAD);
  }

  // Resource map.
  drawBox(s, MID.x, ROW1.y, MID.w, ROW1.h);
  const me = state.players[state.currentPlayer]!;
  s.rect(CITY_MAP_X - 1, CITY_MAP_Y - 1, 82, 82, C.BLACK!);
  for (let ty = 0; ty < 5; ty++)
    for (let tx = 0; tx < 5; tx++) {
      const dx = tx - 2;
      const dy = ty - 2;
      const px = CITY_MAP_X + tx * TILE;
      const py = CITY_MAP_Y + ty * TILE;
      const slot = CITY_RADIUS.findIndex(([ox, oy]) => ox === dx && oy === dy);
      const mx = city.x + dx;
      const my = city.y + dy;
      const tile = getTile(state.map, mx, my);
      if (slot < 0 || !tile) {
        s.rect(px, py, TILE, TILE, C.BLACK!);
        continue;
      }
      const wx = (mx + state.map.width) % state.map.width;
      const fog = fogSquare(state.map, me.explored, wx, my);
      if (!me.explored[my * state.map.width + wx]) {
        s.blit(fog!, px, py);
        continue;
      }
      const ground = terrainSquare(state.map, wx, my, me.explored);
      s.blit(ground, px, py);
      if (tile.irrigation) drawIrrigation(s, px, py, ground, tile.terrain, wx, my, fieldSides(state.map, me.explored, wx, my));
      drawRoad(s, px, py, state.map, me.explored, wx, my);
      drawRailroad(s, px, py, state.map, me.explored, wx, my);
      if (tile.mine) drawMine(s, px, py);
      if (tile.special) drawSpecial(s, px, py, tile);
      if (tile.fortress) drawFortress(s, px, py);
      if (tile.pollution) drawPollution(s, px, py);
      if (fog) s.blit(fog, px, py, SPRITE_CLEAR);
      const worked = slot === 0 || city.worked.includes(slot);
      if (worked) {
        const y = tileYield(state, tile, slot === 0, player.government, city.owner);
        if (slot === 0) drawCity(s, px, py - 1, city, playerColor(state, city.owner));
        s.rect(px, py + 8, TILE, 8, C.BLACK!);
        yieldIcons(s, px, py + 8, y.food, y.shields, y.trade);
      } else if (!slotInLand(state, city, slot)) {
        // Beyond the city's border (or on a rival's land): shaded, it cannot be worked.
        for (let yy = 0; yy < TILE; yy++) for (let xx = (yy & 1); xx < TILE; xx += 2) s.set(px + xx, py + yy, C.BLACK!);
      } else if (!slotAvailable(state, city, slot)) {
        // Hatch tiles another city works or a foreign unit stands on.
        for (let k = 0; k < TILE; k += 2) s.set(px + k, py + (k % 4 === 0 ? 0 : 1) + ((k * 7) % TILE), C.LRED!);
      }
    }
  // The city's border, where its land meets squares it cannot work.
  const inLand = (dx: number, dy: number): boolean | null => {
    const slot = CITY_RADIUS.findIndex(([ox, oy]) => ox === dx && oy === dy);
    return slot < 0 || !getTile(state.map, city.x + dx, city.y + dy) ? null : slotInLand(state, city, slot);
  };
  const edge = playerColor(state, city.owner);
  for (let ty = 0; ty < 5; ty++)
    for (let tx = 0; tx < 5; tx++) {
      if (inLand(tx - 2, ty - 2) !== true) continue;
      const px = CITY_MAP_X + tx * TILE;
      const py = CITY_MAP_Y + ty * TILE;
      if (inLand(tx - 1, ty - 2) === false) s.rect(px + TILE - 1, py, 1, TILE, edge);
      if (inLand(tx - 3, ty - 2) === false) s.rect(px, py, 1, TILE, edge);
      if (inLand(tx - 2, ty - 1) === false) s.rect(px, py + TILE - 1, TILE, 1, edge);
      if (inLand(tx - 2, ty - 3) === false) s.rect(px, py, TILE, 1, edge);
    }

  // Improvements, wonders in yellow, each building with its upkeep.
  drawBox(s, RIGHT.x, ROW1.y, RIGHT.w, ROW1.h, "Improvements");
  const lines = [
    ...city.wonders.map((w) => ({ name: wonder(w).name, color: GOLD, upkeep: 0 })),
    ...city.buildings.map((b) => ({ name: building(b).name, color: INK, upkeep: building(b).upkeep })),
  ];
  // The last line is the city's culture, unless borders never grow (old saves).
  const fit = Math.floor((ROW1.h - BOX_HEAD - 4) / FONT_HEIGHT) - (state.fixedBorders ? 0 : 1);
  const shown = lines.length > fit ? lines.slice(0, fit - 1) : lines;
  y = ROW1.y + BOX_HEAD + 3;
  for (const l of shown) {
    say(s, RIGHT.x + 4, y, l.name, l.color);
    if (l.upkeep) say(s, RIGHT.x + RIGHT.w - 4 - textWidth(`${l.upkeep}$`), y, `${l.upkeep}$`, LABEL);
    y += FONT_HEIGHT;
  }
  if (shown.length < lines.length) say(s, RIGHT.x + 4, y, `and ${lines.length - shown.length} more`, LABEL);
  if (!lines.length) say(s, RIGHT.x + 4, y, "None yet", LABEL);
  // Culture toward the level where the border grows next (and, in old saves, what a turn adds).
  if (!state.fixedBorders) {
    const cy = ROW1.y + ROW1.h - 3 - FONT_HEIGHT;
    const next = nextBorderLevel(state, city);
    drawIconLine(s, RIGHT.x + 4, cy, `{culture} Culture ${cityCulture(state, city)}${next === null ? "" : `/${next}`}`, INK);
    if (state.accruedCulture) {
      const gain = `+${cultureRate(state, city)}`;
      say(s, RIGHT.x + RIGHT.w - 4 - textWidth(gain), cy, gain, GOOD);
    }
  }

  // Food store: the granary fills toward the next citizen.
  drawBox(s, LEFT.x, ROW2.y, LEFT.w, ROW2.h, "Food", `${city.food}/${r.foodBox}`);
  y = ROW2.y + BOX_HEAD + 2;
  y += storeGrid(s, LEFT.x + 3, y, LEFT.w - 6, 5, "food", city.food, r.foodBox) + 2;
  const grow = r.foodSurplus > 0 ? Math.ceil(Math.max(0, r.foodBox - city.food) / r.foodSurplus) : null;
  say(s, LEFT.x + 3, ROW2.y + ROW2.h - 10, r.foodSurplus < 0 ? "Starving!" : grow === null ? "Not growing" : `Grows in ${grow} turn${grow === 1 ? "" : "s"}`, r.foodSurplus < 0 ? BAD : LABEL);

  // Units in the city, then those it supports elsewhere (half hidden in the stone), each with what
  // it costs the city: a shield beyond the free ones, food for settlers.
  const units = cityUnits(state, city);
  drawBox(s, MID.x, ROW2.y, MID.w, ROW2.h, "Units", String(units.length));
  units.slice(0, UNIT_SLOTS).forEach(({ unit, here, shields, food }, i) => {
    const { x: ux, y: uy } = cityUnitSlot(i);
    s.blit(unitSprite(unit.type, playerColor(state, unit.owner)), ux, uy, SPRITE_CLEAR);
    if (!here) ghost(s, ux, uy);
    let ix = ux;
    if (shields) { drawIcon(s, "shield", ix, uy + 17); ix += ICON; }
    if (food) drawIcon(s, "food", ix, uy + 17);
  });
  if (units.length > UNIT_SLOTS) say(s, MID.x + MID.w - 4 - textWidth(`+${units.length - UNIT_SLOTS}`), ROW2.y + ROW2.h - 10, `+${units.length - UNIT_SLOTS}`, LABEL);

  // Production: what is being built, its shields as icons, how long, and the price to buy it now.
  const p = city.production;
  drawBox(s, RIGHT.x, ROW2.y, RIGHT.w, ROW2.h, productionName(p), `${city.shields}/${r.productionCost}`);
  const cost = buyCost(state, city);
  const { change, buy } = CITY_BUTTONS;
  drawButton(s, change.x, change.y, change.w, change.h, change.label);
  drawButton(s, buy.x, buy.y, buy.w, buy.h, buy.label, cost > 0 && player.gold >= cost);
  y = change.y + change.h + 3;
  let gx = RIGHT.x + 3;
  if (p.kind === "unit") {
    s.blit(unitSprite(p.id, playerColorOf(state, city.owner)), gx, y, SPRITE_CLEAR);
    gx += 19;
  }
  storeGrid(s, gx, y, RIGHT.x + RIGHT.w - 3 - gx, 3, "shield", city.shields, r.productionCost);
  const turns = r.shieldSurplus > 0 ? Math.ceil(Math.max(0, r.productionCost - city.shields) / r.shieldSurplus) : null;
  const by = ROW2.y + ROW2.h - 10;
  say(s, RIGHT.x + 3, by, turns === null ? "Never" : `${turns} turn${turns === 1 ? "" : "s"}`, LABEL);
  const price = cost ? `Buy ${cost}$` : "Complete";
  say(s, RIGHT.x + RIGHT.w - 3 - textWidth(price), by, price, cost && player.gold >= cost ? GOLD : LABEL);

  // Hints, or the latest word, and the way out.
  drawStone(s, 0, BAR_Y, SCREEN_W, SCREEN_H - BAR_Y);
  const { view: viewButton } = CITY_BUTTONS;
  if (view.message) drawTextWrapped(s, 4, BAR_Y + 3, viewButton.x - 8, view.message, C.BLUE!, 1);
  else drawText(s, 4, BAR_Y + 3, "Enter Exit  C Change  B Buy  N Rename  V View", DIM);
  drawButton(s, viewButton.x, viewButton.y, viewButton.w, viewButton.h, viewButton.label);
  s.rect(EXIT.x, EXIT.y, EXIT.w, EXIT.h, C.RED!);
  s.hline(EXIT.x, EXIT.y, EXIT.w, C.LRED!);
  s.vline(EXIT.x, EXIT.y, EXIT.h, C.LRED!);
  drawTextCentered(s, EXIT.x + EXIT.w / 2, EXIT.y + 2, "Exit", C.WHITE!);
}

function playerColorOf(state: GameState, owner: number): number {
  return playerColor(state, owner);
}

export type { City };
