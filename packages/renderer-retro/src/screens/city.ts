import {
  building,
  buyCost,
  CITY_RADIUS,
  computeCity,
  formatYear,
  getTile,
  productionName,
  radiusTile,
  slotAvailable,
  tileYield,
  turnToYear,
  unitType,
  wonder,
  type City,
  type GameState,
} from "@civ/core";
import { drawText, drawTextCentered, textWidth } from "../font.js";
import { drawFortress, drawIrrigation, drawMine, drawPollution, drawRailroad, drawRoad, unitSprite } from "../overlays.js";
import { C, shade } from "../palette.js";
import { SCREEN_H, SCREEN_W, Surface } from "../surface.js";
import { drawSpecial, fogSquare, terrainSquare, TILE } from "../tiles.js";
import { drawBox, drawPanel } from "../widgets.js";
import { SPRITE_CLEAR } from "../sprites/sheet.js";
import { drawCity } from "./map-city.js";
import { playerColor } from "./main.js";

/**
 * City screen. Layout (320x200):
 *   title bar          0..11
 *   citizens row      13..25
 *   resource map      left, 5x5 tiles (80x80) at (6, 30)
 *   totals + boxes    middle column
 *   production box    right column
 *   improvements list bottom middle
 *   key hints         bottom
 */
export const CITY_MAP_X = 6;
export const CITY_MAP_Y = 30;
const COL2_X = 96;
const COL3_X = 214;

import type { CityScreenView } from "@civ/renderer-api";

export function citySlotAt(px: number, py: number): number | null {
  const tx = Math.floor((px - CITY_MAP_X) / TILE);
  const ty = Math.floor((py - CITY_MAP_Y) / TILE);
  if (tx < 0 || tx > 4 || ty < 0 || ty > 4) return null;
  const dx = tx - 2;
  const dy = ty - 2;
  const slot = CITY_RADIUS.findIndex(([ox, oy]) => ox === dx && oy === dy);
  return slot >= 0 ? slot : null;
}

function yieldIcons(s: Surface, x: number, y: number, food: number, shields: number, trade: number): void {
  // Tiny 3x3 glyphs: green dot food, grey block shields, yellow coin trade. Up to 4 per row.
  let i = 0;
  const put = (color: number, shape: "dot" | "block" | "coin") => {
    const ix = x + 1 + (i % 4) * 4;
    const iy = y + 1 + Math.floor(i / 4) * 4;
    if (shape === "block") s.rect(ix, iy, 3, 3, color);
    else {
      s.set(ix + 1, iy, color);
      s.hline(ix, iy + 1, 3, color);
      s.set(ix + 1, iy + 2, color);
      if (shape === "coin") s.set(ix + 1, iy + 1, C.BLACK!);
    }
    i++;
  };
  for (let k = 0; k < food; k++) put(C.LGREEN!, "dot");
  for (let k = 0; k < shields; k++) put(C.LGREY!, "block");
  for (let k = 0; k < trade; k++) put(C.YELLOW!, "coin");
}

function citizen(s: Surface, x: number, y: number, mood: "happy" | "content" | "unhappy" | "entertainer" | "taxman" | "scientist"): void {
  const skin = shade("flesh", 5);
  const w = 7;
  s.rect(x, y, w, 9, skin);
  s.frame(x, y, w, 9, C.BLACK!);
  s.set(x + 2, y + 3, C.BLACK!);
  s.set(x + 4, y + 3, C.BLACK!);
  if (mood === "happy") { s.set(x + 2, y + 6, C.BLACK!); s.hline(x + 3, y + 7, 1, C.BLACK!); s.set(x + 4, y + 6, C.BLACK!); }
  else if (mood === "content") s.hline(x + 2, y + 6, 3, C.BLACK!);
  else if (mood === "unhappy") { s.set(x + 2, y + 7, C.BLACK!); s.hline(x + 3, y + 6, 1, C.BLACK!); s.set(x + 4, y + 7, C.BLACK!); s.rect(x + 1, y + 1, 5, 1, C.LRED!); }
  else {
    s.hline(x + 2, y + 6, 3, C.BLACK!);
    const hat = mood === "entertainer" ? C.LMAGENTA! : mood === "taxman" ? C.YELLOW! : C.LCYAN!;
    s.rect(x, y - 2, w, 3, hat);
  }
}

export function drawCityScreen(s: Surface, state: GameState, view: CityScreenView): void {
  const city = state.cities.find((c) => c.id === view.city);
  if (!city) return;
  const player = state.players[city.owner]!;
  const r = computeCity(state, city);
  s.fill(shade("ui", 1));

  // Title.
  s.rect(0, 0, SCREEN_W, 12, shade("ui", 0));
  drawTextCentered(s, SCREEN_W / 2, 2, `${city.name} (Pop ${city.size})  ${formatYear(turnToYear(state.turn))}`, shade("ui", 7));

  // Citizens.
  let cx = 6;
  for (let i = 0; i < r.happy; i++, cx += 9) citizen(s, cx, 15, "happy");
  for (let i = 0; i < r.content; i++, cx += 9) citizen(s, cx, 15, "content");
  for (let i = 0; i < r.unhappy; i++, cx += 9) citizen(s, cx, 15, "unhappy");
  cx += 4;
  for (const sp of city.specialists) { citizen(s, cx, 15, sp); cx += 9; }
  if (r.disorder) drawText(s, 200, 16, "CIVIL DISORDER", C.LRED!);

  // Resource map.
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
      s.blit(terrainSquare(state.map, wx, my, me.explored), px, py);
      if (tile.irrigation) drawIrrigation(s, px, py);
      if (tile.mine) drawMine(s, px, py);
      if (tile.road) drawRoad(s, px, py, 0);
      if (tile.railroad) drawRailroad(s, px, py, 0);
      if (tile.special) drawSpecial(s, px, py, tile.terrain);
      if (tile.fortress) drawFortress(s, px, py);
      if (tile.pollution) drawPollution(s, px, py);
      if (fog) s.blit(fog, px, py, SPRITE_CLEAR);
      const worked = slot === 0 || city.worked.includes(slot);
      if (worked) {
        const y = tileYield(state, tile, slot === 0, player.government);
        s.rect(px, py + 8, TILE, 8, shade("ui", 0));
        yieldIcons(s, px, py + 8, y.food, y.shields, y.trade);
        if (slot === 0) {
          drawCity(s, px, py - 1, city, playerColorOf(state, city.owner));
          s.rect(px, py + 8, TILE, 8, shade("ui", 0));
          yieldIcons(s, px, py + 8, y.food, y.shields, y.trade);
        }
      } else if (!slotAvailable(state, city, slot)) {
        // Hatch unavailable tiles.
        for (let k = 0; k < TILE; k += 2) s.set(px + k, py + (k % 4 === 0 ? 0 : 1) + ((k * 7) % TILE), C.LRED!);
      }
    }
  drawText(s, CITY_MAP_X, CITY_MAP_Y + 84, "Click: work tile", shade("ui", 5));
  drawText(s, CITY_MAP_X, CITY_MAP_Y + 93, "City: best tiles", shade("ui", 5));

  // Totals column.
  const ink = shade("ui", 7);
  const dim = shade("ui", 5);
  let y = CITY_MAP_Y;
  const row = (label: string, val: string, color = ink) => {
    drawText(s, COL2_X, y, label, dim);
    drawText(s, COL2_X + 72, y, val, color);
    y += 9;
  };
  row("Food", `${r.food} (${r.foodSurplus >= 0 ? "+" : ""}${r.foodSurplus})`, r.foodSurplus < 0 ? C.LRED! : ink);
  drawBox(s, COL2_X, y, 110, 7, city.food, r.foodBox, C.LGREEN!);
  y += 10;
  row("Shields", `${r.shields}${r.unitShields ? ` (-${r.unitShields})` : ""}`);
  row("Trade", `${r.trade}${r.routes ? ` (${r.routes} routes)` : ""}${r.corruption ? ` (-${r.corruption})` : ""}`);
  row("Tax/Lux/Sci", `${r.tax}/${r.lux}/${r.science}`);
  row("Upkeep", `${r.buildingUpkeep}$`);
  if (r.pollution > 0) row("Pollution", `${r.pollution}%`, C.LRED!);
  y += 2;
  drawText(s, COL2_X, y, "Improvements", dim);
  y += 9;
  for (const b of city.buildings) {
    drawText(s, COL2_X + 4, y, building(b).name, ink);
    y += 8;
    if (y > 180) break;
  }
  for (const w of city.wonders) {
    drawText(s, COL2_X + 4, y, wonder(w).name, C.YELLOW!);
    y += 8;
    if (y > 180) break;
  }

  // Production column.
  drawPanel(s, COL3_X - 4, CITY_MAP_Y - 2, SCREEN_W - COL3_X, 70);
  const p = city.production;
  const pname = productionName(p);
  drawText(s, COL3_X, CITY_MAP_Y + 2, "Building:", dim);
  drawText(s, COL3_X, CITY_MAP_Y + 11, pname, ink);
  if (p.kind === "unit") s.blit(unitSprite(p.id, playerColorOf(state, city.owner)), SCREEN_W - 24, CITY_MAP_Y + 2, SPRITE_CLEAR);
  drawBox(s, COL3_X, CITY_MAP_Y + 22, SCREEN_W - COL3_X - 8, 8, city.shields, r.productionCost, C.LGREY!);
  drawText(s, COL3_X, CITY_MAP_Y + 32, `${city.shields}/${r.productionCost} shields`, dim);
  const turns = r.shieldSurplus > 0 ? Math.ceil(Math.max(0, r.productionCost - city.shields) / r.shieldSurplus) : null;
  drawText(s, COL3_X, CITY_MAP_Y + 41, turns === null ? "never" : `${turns} turn${turns === 1 ? "" : "s"}`, dim);
  const cost = buyCost(city);
  drawText(s, COL3_X, CITY_MAP_Y + 52, cost ? `Buy: ${cost}$` : "Complete", player.gold >= cost ? ink : dim);

  // Supported units.
  const supported = state.units.filter((u) => u.homeCity === city.id);
  drawText(s, COL3_X, CITY_MAP_Y + 74, `Units: ${supported.length}`, dim);
  supported.slice(0, 10).forEach((u, i) => {
    s.blit(unitSprite(u.type, playerColorOf(state, u.owner)), COL3_X + (i % 5) * 18, CITY_MAP_Y + 84 + Math.floor(i / 5) * 18, SPRITE_CLEAR);
  });

  // Hints.
  s.rect(0, SCREEN_H - 12, SCREEN_W, 12, shade("ui", 0));
  const hint = view.message ?? "Esc: Exit   C: Change   B: Buy   N: Rename";
  drawText(s, 4, SCREEN_H - 10, hint, view.message ? C.YELLOW! : shade("ui", 5));
  void textWidth;
}

function playerColorOf(state: GameState, owner: number): number {
  return playerColor(state, owner);
}

export type { City };
