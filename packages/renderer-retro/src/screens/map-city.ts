import type { City } from "@civ/core";
import { drawTextSmall, smallTextWidth } from "../font.js";
import { drawShield, gridRect, SHIELD_AT } from "../overlays.js";
import { C } from "../palette.js";
import { SPRITE_CLEAR } from "../sprites/sheet.js";
import { darker, FEATURE_SHEET, spriteSurface } from "../sprites/index.js";
import type { Surface } from "../surface.js";

/**
 * City marker on the map, as fine as the terrain: the town from the features sheet standing free on
 * its square (the keep flies the owner's pennant), inside its wall ring when walls are built (back
 * half behind the town, front half before it), the owner's shield in the corner when units are
 * inside (`garrisoned`), as a unit wears it, the population on a plate in the owner's colour, and
 * a red flag in disorder.
 */
export function drawCity(s: Surface, dx: number, dy: number, city: City, color: number, garrisoned = false): void {
  const walled = city.buildings.includes("city_walls");
  const sprite = (name: string) => spriteSurface(FEATURE_SHEET, name, color);
  const back = walled ? sprite("walls") : null;
  if (back) s.blit(back, dx, dy, SPRITE_CLEAR);
  const town = sprite("city");
  if (town) s.blit(town, dx, dy, SPRITE_CLEAR);
  const front = walled ? sprite("walls_front") : null;
  if (front) s.blit(front, dx, dy, SPRITE_CLEAR);
  if (garrisoned) drawShield(s, dx, dy, SHIELD_AT, SHIELD_AT, color, darker(color));
  // The population: small black figures on a plate of the owner's colour, edged in black, at the
  // foot of the square, below the keep.
  const n = String(city.size);
  const w = smallTextWidth(n) + 2;
  const x0 = 16 - Math.ceil(w / 2);
  gridRect(s, dx, dy, x0, 21, w + 2, 11, C.BLACK!);
  gridRect(s, dx, dy, x0 + 1, 22, w, 9, color);
  drawTextSmall(s, dx * 2 + x0 + 2, dy * 2 + 23, n, C.BLACK!);
  if (city.disorder) {
    gridRect(s, dx, dy, 26, 1, 1, 11, C.BLACK!);
    gridRect(s, dx, dy, 27, 1, 4, 3, C.LRED!);
    gridRect(s, dx, dy, 27, 4, 3, 2, C.RED!);
  }
}
