import { cityAt, Terrain, unitAt, type GameState } from "@civ/core";
import { cityLook, fieldSides, type MenuState } from "@civ/renderer-api";
import { drawFortress, drawGrassShield, drawIrrigation, drawMine, drawPollution, drawRailroad, drawRoad, drawUnit } from "../overlays.js";
import { C } from "../palette.js";
import { Surface } from "../surface.js";
import { drawHut, drawSpecial, terrainSquare, TILE } from "../tiles.js";
import { SQUARE_PIC } from "../widgets.js";
import { drawCity } from "./map-city.js";
import { playerColor } from "./main.js";

/**
 * Map square (mx, my) as the map draws it for the player in play (its ground, works, resource, village,
 * fort and pollution, the city on it and the unit on top of what the player sees there), `SQUARE_PIC`
 * screen pixels a side (twice the map's), its top left at screen (x, y): the picture at the head of the
 * square's window (`MenuState.square`). Black where the player has not explored.
 */
export function drawSquarePicture(s: Surface, state: GameState, mx: number, my: number, x: number, y: number): void {
  const { map } = state;
  const me = state.players[state.currentPlayer]!;
  const wx = ((mx % map.width) + map.width) % map.width;
  const idx = my * map.width + wx;
  const scale = SQUARE_PIC / TILE;
  if (my < 0 || my >= map.height || !me.explored[idx]) {
    s.rect(x, y, SQUARE_PIC, SQUARE_PIC, C.BLACK!);
    return;
  }
  const one = Surface.fine(TILE, TILE);
  const tile = map.tiles[idx]!;
  const ground = terrainSquare(map, wx, my, me.explored);
  one.blit(ground, 0, 0);
  if (tile.irrigation) drawIrrigation(one, 0, 0, ground, tile.terrain, wx, my, fieldSides(map, me.explored, wx, my));
  if (tile.grassShield && tile.terrain === Terrain.Grassland) drawGrassShield(one, 0, 0, ground);
  drawRoad(one, 0, 0, map, me.explored, wx, my, ground);
  drawRailroad(one, 0, 0, map, me.explored, wx, my);
  if (tile.mine) drawMine(one, 0, 0);
  if (tile.special) drawSpecial(one, 0, 0, tile);
  if (tile.hut) drawHut(one, 0, 0);
  if (tile.fortress) drawFortress(one, 0, 0);
  if (tile.pollution) drawPollution(one, 0, 0);
  const city = cityAt(state, wx, my);
  if (city) drawCity(one, 0, 0, city, cityLook(state, city), playerColor(state, city.owner));
  else if (me.visible[idx]) {
    const units = unitAt(state, wx, my);
    const top = units.find((u) => u.id === state.activeUnit) ?? units[0];
    if (top) drawUnit(one, top, 0, 0, playerColor(state, top.owner), units.length > 1);
  }
  // Each fine pixel of the square as a block of scale x scale.
  const k = s.k;
  for (let j = 0; j < one.fh; j++)
    for (let i = 0; i < one.fw; i++) {
      const c = one.fget(i, j);
      for (let b = 0; b < scale; b++) for (let a = 0; a < scale; a++) s.fset(x * k + i * scale + a, y * k + j * scale + b, c);
    }
}

/** What paints a window's map square (`MenuState.square`, for `drawMenu`), when a game is on to draw it from. */
export function squarePainter(menu: MenuState, state: GameState | undefined): ((s: Surface, x: number, y: number) => void) | undefined {
  const sq = menu.square;
  return sq && state ? (s, x, y) => drawSquarePicture(s, state, sq.x, sq.y, x, y) : undefined;
}
