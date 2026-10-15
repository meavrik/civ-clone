import { formatYear, getTile, Terrain, TERRAIN_NAMES, turnToYear, type GameState } from "@civ/core";
import { drawText, drawTextCentered } from "../font.js";
import { C, shade } from "../palette.js";
import { SCREEN_H, SCREEN_W, Surface } from "../surface.js";
import { drawRiver, drawSpecial, getTile as terrainTile, TILE, unitSprite } from "../tiles.js";

/**
 * Main map screen layout: a left-hand status column and a tile viewport.
 * The column is 80px wide, which happens to fit an 80x50 minimap at one
 * pixel per tile — the same trick the 1991 original relied on.
 */
export const PANEL_W = 80;
export const VIEW_X = PANEL_W;
export const VIEW_W = SCREEN_W - PANEL_W; // 240 = 15 tiles
export const VIEW_H = SCREEN_H; // 200 = 12.5 tiles
export const VIEW_TILES_X = Math.ceil(VIEW_W / TILE);
export const VIEW_TILES_Y = Math.ceil(VIEW_H / TILE);

export interface MainScreenView {
  /** Top-left tile of the viewport. */
  originX: number;
  originY: number;
  /** Active unit position, if any. */
  unit?: { x: number; y: number; name: string; moves: string; owner: number };
  /** Blink phase for the active-unit cursor. */
  blink: boolean;
  gold: number;
  taxRate: number;
  luxRate: number;
  sciRate: number;
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
  if (getTile(m, x, y - 1)?.river) mask |= 1;
  if (getTile(m, x + 1, y)?.river) mask |= 2;
  if (getTile(m, x, y + 1)?.river) mask |= 4;
  if (getTile(m, x - 1, y)?.river) mask |= 8;
  // Rivers flow into the sea: treat adjacent ocean as a connection.
  if (getTile(m, x, y - 1)?.terrain === Terrain.Ocean) mask |= 1;
  if (getTile(m, x + 1, y)?.terrain === Terrain.Ocean) mask |= 2;
  if (getTile(m, x, y + 1)?.terrain === Terrain.Ocean) mask |= 4;
  if (getTile(m, x - 1, y)?.terrain === Terrain.Ocean) mask |= 8;
  return mask;
}

export function drawMapViewport(s: Surface, state: GameState, view: MainScreenView): void {
  const { map, explored } = state;
  for (let ty = 0; ty < VIEW_TILES_Y; ty++) {
    const my = view.originY + ty;
    const dy = ty * TILE;
    for (let tx = 0; tx < VIEW_TILES_X; tx++) {
      const mx = (((view.originX + tx) % map.width) + map.width) % map.width;
      const dx = VIEW_X + tx * TILE;
      if (my < 0 || my >= map.height) {
        s.rect(dx, dy, TILE, TILE, C.BLACK!);
        continue;
      }
      if (!explored[my * map.width + mx]) {
        s.rect(dx, dy, TILE, TILE, C.BLACK!);
        continue;
      }
      const tile = map.tiles[my * map.width + mx]!;
      // Clip the bottom half-row by blitting into a clipped region.
      const sprite = terrainTile(tile.terrain, mx, my);
      blitClipped(s, sprite, dx, dy, VIEW_X, 0, VIEW_W, VIEW_H);
      if (tile.river) drawRiver(s, dx, dy, riverMask(state, mx, my));
      if (tile.special) drawSpecial(s, dx, dy, tile.terrain);
    }
  }

  if (view.unit) {
    const ux = (((view.unit.x - view.originX) % map.width) + map.width) % map.width;
    const uy = view.unit.y - view.originY;
    if (ux >= 0 && ux < VIEW_TILES_X && uy >= 0 && uy < VIEW_TILES_Y) {
      const dx = VIEW_X + ux * TILE;
      const dy = uy * TILE;
      if (view.blink) {
        s.blit(unitSprite(playerColor(view.unit.owner)), dx, dy, 0);
      }
    }
  }
}

function blitClipped(
  dst: Surface,
  src: Surface,
  dx: number,
  dy: number,
  cx: number,
  cy: number,
  cw: number,
  ch: number,
): void {
  for (let y = 0; y < src.height; y++) {
    const ty = dy + y;
    if (ty < cy || ty >= cy + ch) continue;
    for (let x = 0; x < src.width; x++) {
      const tx = dx + x;
      if (tx < cx || tx >= cx + cw) continue;
      dst.data[ty * dst.width + tx] = src.data[y * src.width + x]!;
    }
  }
}

export function playerColor(owner: number): number {
  return [C.WHITE!, C.LGREEN!, C.LBLUE!, C.YELLOW!, C.LCYAN!, C.LRED!, C.LMAGENTA!, C.LGREY!][owner % 8]!;
}

export function drawStatusPanel(s: Surface, state: GameState, view: MainScreenView): void {
  const { map, explored } = state;
  s.rect(0, 0, PANEL_W, SCREEN_H, shade("ui", 1));

  // Minimap: 80x50, one pixel per tile, framed.
  const mmY = 2;
  s.rect(0, mmY, PANEL_W, map.height, C.BLACK!);
  for (let y = 0; y < map.height; y++)
    for (let x = 0; x < map.width; x++) {
      if (!explored[y * map.width + x]) continue;
      const t = map.tiles[y * map.width + x]!;
      s.set(x, mmY + y, MINIMAP_COLOR[t.terrain]());
    }
  // Viewport rectangle on the minimap (wrapping).
  const vx = ((view.originX % map.width) + map.width) % map.width;
  const vw = VIEW_TILES_X;
  const vy = Math.max(0, view.originY);
  const vh = Math.min(map.height - vy, VIEW_TILES_Y);
  for (let x = 0; x < vw; x++) {
    const px = (vx + x) % map.width;
    s.set(px, mmY + vy, C.WHITE!);
    s.set(px, mmY + vy + vh - 1, C.WHITE!);
  }
  for (let y = 0; y < vh; y++) {
    s.set(vx, mmY + vy + y, C.WHITE!);
    s.set((vx + vw - 1) % map.width, mmY + vy + y, C.WHITE!);
  }
  s.hline(0, mmY + map.height, PANEL_W, shade("ui", 0));

  // Empire line: population / year / treasury / rates.
  let y = mmY + map.height + 4;
  const ink = shade("ui", 7);
  const dim = shade("ui", 5);
  drawTextCentered(s, PANEL_W / 2, y, "Pop: 0", ink);
  y += 9;
  drawTextCentered(s, PANEL_W / 2, y, formatYear(turnToYear(state.turn)), ink);
  y += 9;
  drawTextCentered(
    s,
    PANEL_W / 2,
    y,
    `${view.gold}$ ${view.taxRate}.${view.luxRate}.${view.sciRate}`,
    ink,
  );
  y += 12;
  s.hline(2, y, PANEL_W - 4, shade("ui", 0));
  y += 4;

  // Active unit box.
  if (view.unit) {
    s.blit(unitSprite(playerColor(view.unit.owner)), 4, y, 0);
    drawText(s, 24, y, view.unit.name, ink);
    drawText(s, 24, y + 9, `Moves: ${view.unit.moves}`, dim);
    y += 20;
    const t = getTile(map, view.unit.x, view.unit.y);
    if (t) {
      drawText(s, 4, y, `(${TERRAIN_NAMES[t.terrain]})`, dim);
      y += 9;
      if (t.river) {
        drawText(s, 4, y, "(River)", dim);
        y += 9;
      }
    }
  } else {
    drawText(s, 4, y, "End of Turn", ink);
    y += 9;
    drawText(s, 4, y, "Press Enter", dim);
  }

  // Panel edge.
  s.vline(PANEL_W - 1, 0, SCREEN_H, shade("ui", 0));
}

export function drawMainScreen(s: Surface, state: GameState, view: MainScreenView): void {
  s.fill(C.BLACK!);
  drawMapViewport(s, state, view);
  drawStatusPanel(s, state, view);
}
