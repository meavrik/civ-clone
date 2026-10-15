import type { City } from "@civ/core";
import { drawText, textWidth } from "../font.js";
import { C, shade } from "../palette.js";
import type { Surface } from "../surface.js";
import { TILE } from "../tiles.js";

/**
 * City marker on the map: a walled square in the owner's colour with the
 * population number, flag raised when in disorder. Original art.
 */
export function drawCity(s: Surface, dx: number, dy: number, city: City, color: number): void {
  const walled = city.buildings.includes("city_walls");
  s.rect(dx + 1, dy + 1, TILE - 2, TILE - 2, color);
  s.frame(dx + 1, dy + 1, TILE - 2, TILE - 2, C.BLACK!);
  if (walled) {
    s.frame(dx, dy, TILE, TILE, shade("stone", 5));
    for (let k = 0; k < TILE; k += 3) {
      s.set(dx + k, dy, shade("stone", 2));
      s.set(dx + k, dy + TILE - 1, shade("stone", 2));
    }
  }
  const n = String(city.size);
  drawText(s, dx + 8 - Math.floor(textWidth(n) / 2), dy + 4, n, C.BLACK!);
  if (city.disorder) {
    s.vline(dx + 13, dy + 1, 5, C.BLACK!);
    s.rect(dx + 11, dy + 1, 2, 3, C.LRED!);
  }
}
