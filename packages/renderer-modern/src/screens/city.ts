import {
  building,
  buyCost,
  CITY_RADIUS,
  computeCity,
  formatYear,
  getTile,
  productionName,
  slotAvailable,
  Terrain,
  tileYield,
  turnToYear,
  wonder,
  type GameState,
} from "@civ/core";
import { citizenLook, cityUnits, coastPatch, DEEP, fieldSides, fogPatch, riverShape, type CityButton, type CityScreenView } from "@civ/renderer-api";
import { paintCoast } from "../coast.js";
import { Clouds } from "../fog.js";
import type { Context2D } from "../context.js";
import { bar, circle, fillRound, panel, paragraph, strokeRound, text } from "../draw.js";
import { paintBadge, paintCity, playerColor } from "../markers.js";
import { paintCitizen } from "../citizens.js";
import { paintIcon } from "../icons.js";
import { paintFortress, paintMine, paintPollution, paintRiver, paintRoad, paintSpecial, paintTile } from "../tiles.js";
import { BUTTON, H, TILE, UI, W } from "../theme.js";

/**
 * City screen, 960x600: title bar, citizens row, the 5x5 resource map on
 * the left, totals and improvements in the middle, production and
 * the city's units on the right, an exit bar at the bottom.
 */
export const CITY_MAP_X = 20;
export const CITY_MAP_Y = 92;
const COL2_X = 290;
const COL3_X = 660;
const HINT_H = 36;

export function citySlotAt(px: number, py: number): number | null {
  const tx = Math.floor((px - CITY_MAP_X) / TILE);
  const ty = Math.floor((py - CITY_MAP_Y) / TILE);
  if (tx < 0 || tx > 4 || ty < 0 || ty > 4) return null;
  const slot = CITY_RADIUS.findIndex(([ox, oy]) => ox === tx - 2 && oy === ty - 2);
  return slot >= 0 ? slot : null;
}

export function cityExitHit(_px: number, py: number): boolean {
  return py > H - HINT_H;
}

/** The production card's buttons, under the price. */
const CITY_BUTTONS: Record<CityButton, { x: number; y: number; w: number; h: number; label: string }> = {
  change: { x: COL3_X, y: CITY_MAP_Y + 150, w: 128, h: 34, label: "Change" },
  buy: { x: COL3_X + 140, y: CITY_MAP_Y + 150, w: 128, h: 34, label: "Buy" },
};

export function cityButtonAt(px: number, py: number): CityButton | null {
  for (const [id, b] of Object.entries(CITY_BUTTONS) as [CityButton, (typeof CITY_BUTTONS)[CityButton]][])
    if (px >= b.x && px < b.x + b.w && py >= b.y && py < b.y + b.h) return id;
  return null;
}

/** Top-left of the i-th unit's badge under the production card (`cityUnits`); its cost goes under it. */
function unitSlot(i: number): { x: number; y: number } {
  return { x: COL3_X - 8 + (i % 5) * 50, y: CITY_MAP_Y + 242 + Math.floor(i / 5) * 62 };
}
const UNIT_SLOTS = 15;

/** The unit under a point among the city's units: clicking it wakes it and takes it to the map. */
export function cityUnitAt(state: GameState, view: CityScreenView, px: number, py: number): number | null {
  const city = state.cities.find((c) => c.id === view.city);
  if (!city) return null;
  const units = cityUnits(state, city).slice(0, UNIT_SLOTS);
  for (let i = 0; i < units.length; i++) {
    const { x, y } = unitSlot(i);
    if (px >= x && px < x + TILE && py >= y && py < y + 60) return units[i]!.unit.id;
  }
  return null;
}

/** A pill button: filled when it is the one to press, outlined otherwise, faded when it cannot be pressed. */
function button(ctx: Context2D, b: (typeof CITY_BUTTONS)[CityButton], style: "primary" | "plain" | "off"): void {
  if (style === "primary") fillRound(ctx, b.x, b.y, b.w, b.h, 10, BUTTON.fill);
  else strokeRound(ctx, b.x + 0.5, b.y + 0.5, b.w - 1, b.h - 1, 10, BUTTON.edge, 1.5);
  const color = style === "primary" ? BUTTON.ink : style === "plain" ? BUTTON.label : BUTTON.off;
  text(ctx, b.x + b.w / 2, b.y + 9, b.label, { size: 15, weight: "600", color, align: "center" });
}

export function drawCityScreen(ctx: Context2D, state: GameState, view: CityScreenView): void {
  const city = state.cities.find((c) => c.id === view.city);
  if (!city) return;
  const player = state.players[city.owner]!;
  const r = computeCity(state, city);
  ctx.fillStyle = UI.bg;
  ctx.fillRect(0, 0, W, H);

  // Title bar.
  ctx.fillStyle = UI.panel;
  ctx.fillRect(0, 0, W, 40);
  text(ctx, W / 2, 9, `${city.name}  ·  population ${city.size}  ·  ${formatYear(turnToYear(state.turn))}`, { size: 18, weight: "600", align: "center" });

  // Citizens, each a person of their own (`citizenLook`).
  let cx = 30;
  let n = 0;
  const cy = 43;
  for (let i = 0; i < r.happy; i++, cx += 28) paintCitizen(ctx, cx, cy, "happy", citizenLook(city.id, n++));
  for (let i = 0; i < r.content; i++, cx += 28) paintCitizen(ctx, cx, cy, "content", citizenLook(city.id, n++));
  for (let i = 0; i < r.unhappy; i++, cx += 28) paintCitizen(ctx, cx, cy, "unhappy", citizenLook(city.id, n++));
  cx += 10;
  for (const sp of city.specialists) { paintCitizen(ctx, cx, cy, sp, citizenLook(city.id, n++)); cx += 28; }
  if (r.disorder) text(ctx, W - 24, 52, "CIVIL DISORDER", { size: 16, weight: "bold", color: UI.danger, align: "right" });

  // Resource map.
  const me = state.players[state.currentPlayer]!;
  fillRound(ctx, CITY_MAP_X - 4, CITY_MAP_Y - 4, TILE * 5 + 8, TILE * 5 + 8, 8, "#05080d");
  // The city and its yields go on after the fog, so they show over it.
  const clouds = new Clouds();
  const marks: (() => void)[] = [];
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
      const wx = ((mx % state.map.width) + state.map.width) % state.map.width;
      if (slot < 0 || !tile) {
        ctx.fillStyle = UI.bg;
        ctx.fillRect(px, py, TILE, TILE);
        continue;
      }
      const fog = fogPatch(state.map, me.explored, wx, my);
      clouds.add(px, py, fog);
      if (fog.cover[4]! >= 1) continue;
      const coast = coastPatch(state.map, wx, my, me.explored);
      const river = riverShape(state.map, wx, my, me.explored);
      const sea = tile.terrain === Terrain.Ocean;
      paintTile(ctx, px, py, tile, wx, my, coast.depth[4] === DEEP, tile.irrigation ? fieldSides(state.map, me.explored, wx, my) : 0);
      if (river && !sea) paintRiver(ctx, px, py, river);
      paintCoast(ctx, px, py, coast, sea ? river : null);
      paintRoad(ctx, px, py, state.map, me.explored, wx, my, false);
      paintRoad(ctx, px, py, state.map, me.explored, wx, my, true);
      if (tile.mine) paintMine(ctx, px, py);
      if (tile.special) paintSpecial(ctx, px, py);
      if (tile.fortress) paintFortress(ctx, px, py);
      if (tile.pollution) paintPollution(ctx, px, py);
      const worked = slot === 0 || city.worked.includes(slot);
      marks.push(() => {
        if (slot === 0) paintCity(ctx, px, py, city, player.color);
        if (worked) {
          const y = tileYield(state, tile, slot === 0, player.government, city.owner);
          fillRound(ctx, px + 2, py + TILE - 16, TILE - 4, 14, 4, "rgba(5, 8, 13, 0.8)");
          let ix = px + 6;
          for (let k = 0; k < y.food; k++, ix += 7) circle(ctx, ix + 2, py + TILE - 9, 3, UI.ok);
          for (let k = 0; k < y.shields; k++, ix += 7) { ctx.fillStyle = "#cfd6dd"; ctx.fillRect(ix, py + TILE - 12, 5, 6); }
          for (let k = 0; k < y.trade; k++, ix += 7) circle(ctx, ix + 2, py + TILE - 9, 3, UI.accent);
        } else if (!slotAvailable(state, city, slot)) {
          ctx.fillStyle = "rgba(255, 80, 80, 0.35)";
          ctx.fillRect(px, py, TILE, TILE);
        }
      });
    }
  clouds.paint(ctx);
  for (const mark of marks) mark();
  text(ctx, CITY_MAP_X, CITY_MAP_Y + TILE * 5 + 12, "Click a tile to work it", { size: 13, color: UI.dim });
  text(ctx, CITY_MAP_X, CITY_MAP_Y + TILE * 5 + 30, "Click the city for the best tiles", { size: 13, color: UI.dim });

  // Totals.
  let y = CITY_MAP_Y;
  const row = (label: string, val: string, color = UI.ink) => {
    text(ctx, COL2_X, y, label, { size: 14, color: UI.dim });
    text(ctx, COL2_X + 150, y, val, { size: 14, color });
    y += 24;
  };
  row("Food", `${r.food} (${r.foodSurplus >= 0 ? "+" : ""}${r.foodSurplus})`, r.foodSurplus < 0 ? UI.danger : UI.ink);
  bar(ctx, COL2_X, y, 300, 10, city.food, r.foodBox, UI.ok);
  y += 22;
  row("Shields", `${r.shields}${r.unitShields ? ` (-${r.unitShields} upkeep)` : ""}`);
  row("Trade", `${r.trade}${r.routes ? ` (${r.routes} from routes)` : ""}${r.corruption ? ` (-${r.corruption} corruption)` : ""}`);
  row("Tax / Lux / Sci", `${r.tax} / ${r.lux} / ${r.science}`);
  row("Upkeep", `${r.buildingUpkeep} gold`);
  if (r.pollution > 0) row("Pollution", `${r.pollution}%`, UI.danger);
  y += 6;
  text(ctx, COL2_X, y, "Improvements", { size: 14, color: UI.dim });
  y += 24;
  const names = [...city.buildings.map((b) => ({ n: building(b).name, w: false })), ...city.wonders.map((w) => ({ n: wonder(w).name, w: true }))];
  names.forEach((it, i) => {
    const col = i % 2;
    const ry = y + Math.floor(i / 2) * 22;
    if (ry > H - HINT_H - 24) return;
    text(ctx, COL2_X + col * 170, ry, it.n, { size: 14, color: it.w ? UI.accent : UI.ink });
  });

  // Production card.
  panel(ctx, COL3_X - 12, CITY_MAP_Y - 8, W - COL3_X - 8, 206, 12, UI.card);
  const p = city.production;
  text(ctx, COL3_X, CITY_MAP_Y + 2, "Building", { size: 13, color: UI.dim });
  text(ctx, COL3_X, CITY_MAP_Y + 22, productionName(p), { size: 17, weight: "600" });
  if (p.kind === "unit") paintBadge(ctx, W - 78, CITY_MAP_Y - 2, p.id, player.color, 40);
  bar(ctx, COL3_X, CITY_MAP_Y + 58, W - COL3_X - 32, 12, city.shields, r.productionCost, "#cfd6dd");
  text(ctx, COL3_X, CITY_MAP_Y + 78, `${city.shields} / ${r.productionCost} shields`, { size: 13, color: UI.dim });
  const turns = r.shieldSurplus > 0 ? Math.ceil(Math.max(0, r.productionCost - city.shields) / r.shieldSurplus) : null;
  text(ctx, COL3_X, CITY_MAP_Y + 98, turns === null ? "never at this rate" : `${turns} turn${turns === 1 ? "" : "s"}`, { size: 13, color: UI.dim });
  const cost = buyCost(state, city);
  text(ctx, COL3_X, CITY_MAP_Y + 124, cost ? `Buy for ${cost} gold` : "Complete", { size: 15, weight: "600", color: player.gold >= cost ? UI.accent : UI.faint });
  button(ctx, CITY_BUTTONS.change, "plain");
  button(ctx, CITY_BUTTONS.buy, cost > 0 && player.gold >= cost ? "primary" : "off");

  // Units in the city, then those it supports elsewhere (faded), each with what it costs the city:
  // a shield beyond the free ones, food for settlers.
  const units = cityUnits(state, city);
  const present = units.filter((u) => u.here).length;
  const upkeep = units.reduce((n, s) => n + s.shields, 0);
  const counts = `Units: ${present} here${units.length > present ? `, ${units.length - present} away` : ""}${upkeep ? ` · ${upkeep} shield${upkeep > 1 ? "s" : ""} a turn` : ""}`;
  text(ctx, COL3_X, CITY_MAP_Y + 226, units.length > UNIT_SLOTS ? `${counts} · ${units.length - UNIT_SLOTS} more` : counts, { size: 13, color: UI.dim });
  units.slice(0, UNIT_SLOTS).forEach(({ unit, here, shields, food }, i) => {
    const { x: ux, y: uy } = unitSlot(i);
    const alpha = ctx.globalAlpha;
    if (!here) ctx.globalAlpha = alpha * 0.4;
    paintBadge(ctx, ux, uy, unit.type, player.color, 34);
    ctx.globalAlpha = alpha;
    const icons = [...(shields ? (["shield"] as const) : []), ...(food ? (["food"] as const) : [])];
    let ix = ux + TILE / 2 - (icons.length * 16 - 2) / 2;
    for (const icon of icons) { paintIcon(ctx, icon, ix, uy + 44, 14); ix += 16; }
  });

  // Exit bar.
  ctx.fillStyle = UI.panel;
  ctx.fillRect(0, H - HINT_H, W, HINT_H);
  const hint = view.message ?? "Esc exit   ·   C change production   ·   B buy   ·   N rename   ·   click a unit to give it orders";
  paragraph(ctx, 24, H - HINT_H + 10, W - 48, hint, { size: 14, color: view.message ? UI.accent : UI.dim }, 1);
  void playerColor;
}
