import type { City } from "@civ/core";
import type { CityMood } from "@civ/renderer-api";
import { drawShield, gridRect, SHIELD_AT } from "../overlays.js";
import { C } from "../palette.js";
import { SPRITE_CLEAR } from "../sprites/sheet.js";
import { darker, FEATURE_SHEET, spriteSurface } from "../sprites/index.js";
import type { Surface } from "../surface.js";

/**
 * City marker on the map, as fine as the terrain: the town from the features sheet standing free on
 * its square (the keep flies the owner's banner), inside its wall ring when walls are built (back
 * half behind the town, front half before it), the owner's shield in the corner when units are
 * inside (`garrisoned`), as a unit wears it, and a flag for the `mood` (`cityMood`, the viewer's own
 * cities only): red in disorder, yellow one lost happy citizen from it, green while the city
 * celebrates. The population goes on the name plate under the square (`drawCityLabel`).
 */
export function drawCity(s: Surface, dx: number, dy: number, city: City, color: number, garrisoned = false, mood: CityMood | null = null): void {
  const walled = city.buildings.includes("city_walls");
  const sprite = (name: string) => spriteSurface(FEATURE_SHEET, name, color);
  const back = walled ? sprite("walls") : null;
  if (back) s.blit(back, dx, dy, SPRITE_CLEAR);
  const town = sprite("city");
  if (town) s.blit(town, dx, dy, SPRITE_CLEAR);
  const front = walled ? sprite("walls_front") : null;
  if (front) s.blit(front, dx, dy, SPRITE_CLEAR);
  if (garrisoned) drawShield(s, dx, dy, SHIELD_AT, SHIELD_AT, color, darker(color));
  if (mood) {
    const flag = mood === "disorder" ? C.LRED! : mood === "unrest" ? C.YELLOW! : C.LGREEN!;
    gridRect(s, dx, dy, 26, 1, 1, 11, C.BLACK!);
    gridRect(s, dx, dy, 27, 1, 4, 3, flag);
    gridRect(s, dx, dy, 27, 4, 3, 2, darker(flag));
  }
}
