import {
  building,
  buyCost,
  CITY_RADIUS,
  computeCity,
  formatYear,
  getTile,
  productionName,
  slotAvailable,
  tileYield,
  turnToYear,
  wonder,
  type GameState,
} from "@civ/core";
import type { CityScreenView } from "@civ/renderer-api";
import type { Context2D } from "../context.js";
import { bar, circle, fillRound, panel, paragraph, strokeRound, text } from "../draw.js";
import { paintBadge, paintCity, playerColor } from "../markers.js";
import { paintFortress, paintIrrigation, paintMine, paintPollution, paintRiver, paintRoad, paintSpecial, paintTile } from "../tiles.js";
import { H, TILE, UI, W } from "../theme.js";

/**
 * City screen, 960x600: title bar, citizens row, the 5x5 resource map on
 * the left, totals and improvements in the middle, production and
 * supported units on the right, an exit bar at the bottom.
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

function citizen(ctx: Context2D, x: number, y: number, mood: "happy" | "content" | "unhappy" | "entertainer" | "taxman" | "scientist"): void {
  const skin = mood === "unhappy" ? "#e9a08a" : "#f1c9a5";
  circle(ctx, x, y, 11, skin);
  ctx.strokeStyle = "#2a1d14";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(x, y, 11, 0, Math.PI * 2);
  ctx.stroke();
  circle(ctx, x - 4, y - 2, 1.5, "#2a1d14");
  circle(ctx, x + 4, y - 2, 1.5, "#2a1d14");
  ctx.beginPath();
  if (mood === "happy") ctx.arc(x, y + 2, 5, 0.15 * Math.PI, 0.85 * Math.PI);
  else if (mood === "unhappy") ctx.arc(x, y + 8, 5, 1.15 * Math.PI, 1.85 * Math.PI);
  else { ctx.moveTo(x - 4, y + 5); ctx.lineTo(x + 4, y + 5); }
  ctx.stroke();
  if (mood === "entertainer" || mood === "taxman" || mood === "scientist") {
    const hat = mood === "entertainer" ? UI.lux : mood === "taxman" ? UI.accent : UI.info;
    fillRound(ctx, x - 11, y - 16, 22, 7, 3, hat);
  }
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

  // Citizens.
  let cx = 30;
  for (let i = 0; i < r.happy; i++, cx += 28) citizen(ctx, cx, 62, "happy");
  for (let i = 0; i < r.content; i++, cx += 28) citizen(ctx, cx, 62, "content");
  for (let i = 0; i < r.unhappy; i++, cx += 28) citizen(ctx, cx, 62, "unhappy");
  cx += 10;
  for (const sp of city.specialists) { citizen(ctx, cx, 62, sp); cx += 28; }
  if (r.disorder) text(ctx, W - 24, 52, "CIVIL DISORDER", { size: 16, weight: "bold", color: UI.danger, align: "right" });

  // Resource map.
  const me = state.players[state.currentPlayer]!;
  fillRound(ctx, CITY_MAP_X - 4, CITY_MAP_Y - 4, TILE * 5 + 8, TILE * 5 + 8, 8, "#05080d");
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
      if (slot < 0 || !tile || !me.explored[my * state.map.width + wx]) {
        ctx.fillStyle = UI.bg;
        ctx.fillRect(px, py, TILE, TILE);
        continue;
      }
      paintTile(ctx, px, py, tile, wx, my);
      if (tile.river) paintRiver(ctx, px, py, 0);
      if (tile.irrigation) paintIrrigation(ctx, px, py);
      if (tile.mine) paintMine(ctx, px, py);
      if (tile.road) paintRoad(ctx, px, py, 0, tile.railroad);
      if (tile.special) paintSpecial(ctx, px, py);
      if (tile.fortress) paintFortress(ctx, px, py);
      if (tile.pollution) paintPollution(ctx, px, py);
      const worked = slot === 0 || city.worked.includes(slot);
      if (slot === 0) paintCity(ctx, px, py, city, player.color);
      if (worked) {
        const y = tileYield(state, tile, slot === 0, player.government);
        fillRound(ctx, px + 2, py + TILE - 16, TILE - 4, 14, 4, "rgba(5, 8, 13, 0.8)");
        let ix = px + 6;
        for (let k = 0; k < y.food; k++, ix += 7) circle(ctx, ix + 2, py + TILE - 9, 3, UI.ok);
        for (let k = 0; k < y.shields; k++, ix += 7) { ctx.fillStyle = "#cfd6dd"; ctx.fillRect(ix, py + TILE - 12, 5, 6); }
        for (let k = 0; k < y.trade; k++, ix += 7) circle(ctx, ix + 2, py + TILE - 9, 3, UI.accent);
      } else if (!slotAvailable(state, city, slot)) {
        ctx.fillStyle = "rgba(255, 80, 80, 0.35)";
        ctx.fillRect(px, py, TILE, TILE);
      }
    }
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
  panel(ctx, COL3_X - 12, CITY_MAP_Y - 8, W - COL3_X - 8, 170, 12, UI.card);
  const p = city.production;
  text(ctx, COL3_X, CITY_MAP_Y + 2, "Building", { size: 13, color: UI.dim });
  text(ctx, COL3_X, CITY_MAP_Y + 22, productionName(p), { size: 17, weight: "600" });
  if (p.kind === "unit") paintBadge(ctx, W - 78, CITY_MAP_Y - 2, p.id, player.color, 40);
  bar(ctx, COL3_X, CITY_MAP_Y + 58, W - COL3_X - 32, 12, city.shields, r.productionCost, "#cfd6dd");
  text(ctx, COL3_X, CITY_MAP_Y + 78, `${city.shields} / ${r.productionCost} shields`, { size: 13, color: UI.dim });
  const turns = r.shieldSurplus > 0 ? Math.ceil(Math.max(0, r.productionCost - city.shields) / r.shieldSurplus) : null;
  text(ctx, COL3_X, CITY_MAP_Y + 98, turns === null ? "never at this rate" : `${turns} turn${turns === 1 ? "" : "s"}`, { size: 13, color: UI.dim });
  const cost = buyCost(city);
  text(ctx, COL3_X, CITY_MAP_Y + 124, cost ? `Buy for ${cost} gold` : "Complete", { size: 15, weight: "600", color: player.gold >= cost ? UI.accent : UI.faint });

  // Supported units.
  const supported = state.units.filter((u) => u.homeCity === city.id);
  text(ctx, COL3_X, CITY_MAP_Y + 190, `Units supported: ${supported.length}`, { size: 13, color: UI.dim });
  supported.slice(0, 10).forEach((u, i) => paintBadge(ctx, COL3_X - 8 + (i % 5) * 50, CITY_MAP_Y + 206 + Math.floor(i / 5) * 50, u.type, player.color, 34));

  // Exit bar.
  ctx.fillStyle = UI.panel;
  ctx.fillRect(0, H - HINT_H, W, HINT_H);
  const hint = view.message ?? "Esc exit   ·   C change production   ·   B buy   ·   N rename";
  paragraph(ctx, 24, H - HINT_H + 10, W - 48, hint, { size: 14, color: view.message ? UI.accent : UI.dim }, 1);
  void strokeRound;
  void playerColor;
}
