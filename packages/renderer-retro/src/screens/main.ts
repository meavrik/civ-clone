import {
  atWar,
  canFoundCity,
  formatYear,
  GOVERNMENTS,
  getTile,
  NEIGHBOURS,
  Terrain,
  TERRAIN_NAMES,
  TERRAIN_RULES,
  turnToYear,
  unitById,
  unitType,
  workOptions,
  type GameState,
} from "@civ/core";
import { drawText, drawTextCentered } from "../font.js";
import { drawIrrigation, drawMine, drawRoad, drawUnit, unitSprite } from "../overlays.js";
import { C, shade } from "../palette.js";
import { SCREEN_H, SCREEN_W, Surface } from "../surface.js";
import { drawRiver, drawSpecial, getTile as terrainTile, TILE } from "../tiles.js";
import { drawCity } from "./map-city.js";

/**
 * Main map screen layout: a left-hand status column and a tile viewport.
 * The column is 80px wide, which fits an 80x50 minimap at one pixel per tile.
 */
export const PANEL_W = 80;
export const VIEW_X = PANEL_W;
export const VIEW_W = SCREEN_W - PANEL_W; // 240 = 15 tiles
export const VIEW_H = SCREEN_H; // 200 = 12.5 tiles
export const VIEW_TILES_X = Math.ceil(VIEW_W / TILE);
export const VIEW_TILES_Y = Math.ceil(VIEW_H / TILE);

export interface MainScreenView {
  originX: number;
  originY: number;
  /** Blink phase for the active unit. */
  blink: boolean;
  /** One-line status message under the unit box (e.g. a refused move). */
  message?: string | undefined;
}

export const PLAYER_COLORS = [C.WHITE!, C.LGREEN!, C.LBLUE!, C.YELLOW!, C.LCYAN!, C.LRED!, C.LMAGENTA!, C.LGREY!];
export function playerColor(owner: number): number {
  return PLAYER_COLORS[owner % PLAYER_COLORS.length]!;
}

const MINIMAP_COLOR: Record<Terrain, () => number> = {
  [Terrain.Ocean]: () => shade("ocean", 2),
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

function roadMask(state: GameState, x: number, y: number): number {
  let mask = 0;
  NEIGHBOURS.forEach(([dx, dy], i) => {
    if (getTile(state.map, x + dx, y + dy)?.road) mask |= 1 << i;
  });
  return mask;
}

/** Screen position of a map tile relative to the viewport, or null if off-screen. */
export function tileToScreen(state: GameState, view: MainScreenView, x: number, y: number): [number, number] | null {
  const w = state.map.width;
  const tx = (((x - view.originX) % w) + w) % w;
  const ty = y - view.originY;
  if (tx >= VIEW_TILES_X || ty < 0 || ty >= VIEW_TILES_Y) return null;
  return [VIEW_X + tx * TILE, ty * TILE];
}

export function drawMapViewport(s: Surface, state: GameState, view: MainScreenView): void {
  const { map } = state;
  const me = state.players[state.currentPlayer]!;
  for (let ty = 0; ty < VIEW_TILES_Y; ty++) {
    const my = view.originY + ty;
    const dy = ty * TILE;
    for (let tx = 0; tx < VIEW_TILES_X; tx++) {
      const mx = (((view.originX + tx) % map.width) + map.width) % map.width;
      const dx = VIEW_X + tx * TILE;
      if (my < 0 || my >= map.height || !me.explored[my * map.width + mx]) {
        s.rect(dx, dy, TILE, TILE, C.BLACK!);
        continue;
      }
      const tile = map.tiles[my * map.width + mx]!;
      const sprite = terrainTile(tile.terrain, mx, my);
      s.blit(sprite, dx, dy);
      if (tile.river) drawRiver(s, dx, dy, riverMask(state, mx, my));
      if (tile.irrigation) drawIrrigation(s, dx, dy);
      if (tile.mine) drawMine(s, dx, dy);
      if (tile.road) drawRoad(s, dx, dy, roadMask(state, mx, my));
      if (tile.special) drawSpecial(s, dx, dy, tile.terrain);
    }
  }

  // Cities on explored tiles.
  for (const c of state.cities) {
    if (!me.explored[c.y * map.width + c.x]) continue;
    const pos = tileToScreen(state, view, c.x, c.y);
    if (pos) drawCity(s, pos[0], pos[1], c, playerColor(c.owner));
  }

  // Units: only those on tiles we currently see. Draw one per tile (top of stack).
  const drawn = new Set<number>();
  for (const u of state.units) {
    const idx = u.y * map.width + u.x;
    if (!me.visible[idx] || drawn.has(idx)) continue;
    const pos = tileToScreen(state, view, u.x, u.y);
    if (!pos) continue;
    const stack = state.units.filter((o) => o.x === u.x && o.y === u.y);
    const top = stack.find((o) => o.id === state.activeUnit) ?? stack[0]!;
    drawn.add(idx);
    const isActive = top.id === state.activeUnit;
    // Units inside a city are hidden behind it unless active, like the original.
    if (!isActive && state.cities.some((c) => c.x === u.x && c.y === u.y)) continue;
    if (isActive && !view.blink) continue;
    drawUnit(s, top, pos[0], pos[1], playerColor(top.owner), stack.length > 1);
  }

  // Goto destination of the active unit.
  const act = state.activeUnit !== null ? state.units.find((u) => u.id === state.activeUnit) : undefined;
  if (act?.order.kind === "goto") {
    const pos = tileToScreen(state, view, act.order.x, act.order.y);
    if (pos) s.frame(pos[0], pos[1], TILE, TILE, C.YELLOW!);
  }

  // Letterbox the bottom half-row like the original's hard panel edge.
  s.rect(VIEW_X, VIEW_H, VIEW_W, SCREEN_H - VIEW_H, C.BLACK!);
}

export function drawStatusPanel(s: Surface, state: GameState, view: MainScreenView): void {
  const { map } = state;
  const me = state.players[state.currentPlayer]!;
  s.rect(0, 0, PANEL_W, SCREEN_H, shade("ui", 1));

  // Minimap: 80x50, one pixel per tile.
  const mmY = 2;
  s.rect(0, mmY, PANEL_W, map.height, C.BLACK!);
  for (let y = 0; y < map.height; y++)
    for (let x = 0; x < map.width; x++) {
      if (!me.explored[y * map.width + x]) continue;
      s.set(x, mmY + y, MINIMAP_COLOR[map.tiles[y * map.width + x]!.terrain]());
    }
  for (const u of state.units) if (me.visible[u.y * map.width + u.x]) s.set(u.x, mmY + u.y, playerColor(u.owner));
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

  let y = mmY + map.height + 4;
  const ink = shade("ui", 7);
  const dim = shade("ui", 5);
  void ink;
  const pop = state.cities.filter((c) => c.owner === state.currentPlayer).reduce((n, c) => n + c.size * (c.size + 1) * 5000, 0);
  drawTextCentered(s, PANEL_W / 2, y, pop >= 1000000 ? `${(pop / 1000000).toFixed(1)}M` : `${Math.floor(pop / 1000)},000`, ink);
  y += 9;
  drawTextCentered(s, PANEL_W / 2, y, formatYear(turnToYear(state.turn)), ink);
  y += 9;
  drawTextCentered(s, PANEL_W / 2, y, `${me.gold}$ ${me.taxRate}.${me.luxRate}.${me.sciRate}`, ink);
  y += 9;
  const govName = GOVERNMENTS[me.government]?.name ?? me.government;
  drawTextCentered(s, PANEL_W / 2, y, govName, dim);
  y += 12;
  s.hline(2, y, PANEL_W - 4, shade("ui", 0));
  y += 4;

  const active = state.activeUnit !== null ? unitById(state, state.activeUnit) : undefined;
  if (active) {
    const type = unitType(active.type);
    s.blit(unitSprite(active.type, playerColor(active.owner)), 4, y, 0);
    drawText(s, 24, y, type.name, ink);
    const home = active.homeCity !== null ? state.cities.find((c) => c.id === active.homeCity) : undefined;
    if (home) drawText(s, 24, y + 18, home.name, dim);
    const whole = Math.floor(active.movesLeft / 3);
    const frac = active.movesLeft % 3;
    drawText(s, 24, y + 9, `Moves: ${whole}${frac ? ` ${frac}/3` : ""}`, dim);
    y += home ? 28 : 20;
    const t = getTile(map, active.x, active.y);
    if (t) {
      const r = TERRAIN_RULES[t.terrain];
      drawText(s, 4, y, `(${TERRAIN_NAMES[t.terrain]})`, dim);
      y += 9;
      const extras = [t.river && "River", t.road && "Road", t.irrigation && "Irrigation", t.mine && "Mine", t.special && r.special?.name]
        .filter(Boolean)
        .join(", ");
      if (extras) {
        drawText(s, 4, y, `(${extras})`, dim);
        y += 9;
      }
    }
    const w = workOptions(state, active);
    const keys = [
      unitType(active.type).flags?.includes("settler") && !canFoundCity(state, active.x, active.y) && "B",
      w.irrigate !== undefined && "I", w.mine !== undefined && "M", w.road !== undefined && "R",
    ].filter(Boolean);
    if (keys.length) {
      drawText(s, 4, y, `Orders: ${keys.join(" ")}`, dim);
      y += 9;
    }
  } else {
    drawText(s, 4, y, "End of Turn", ink);
    y += 9;
    drawText(s, 4, y, "Press Enter", dim);
    y += 9;
  }
  const enemies = state.players.filter((p) => p.id !== me.id && p.alive && p.id !== state.barbarians && atWar(state, me.id, p.id));
  if (enemies.length) {
    y += 4;
    drawText(s, 4, y, "At war:", C.LRED!);
    y += 9;
    for (const p of enemies) { drawText(s, 8, y, p.name, playerColor(p.id)); y += 8; }
  }
  if (view.message) {
    y += 4;
    drawText(s, 4, y, view.message, C.YELLOW!);
  }

  s.vline(PANEL_W - 1, 0, SCREEN_H, shade("ui", 0));
}

export function drawMainScreen(s: Surface, state: GameState, view: MainScreenView): void {
  s.fill(C.BLACK!);
  drawMapViewport(s, state, view);
  drawStatusPanel(s, state, view);
}
