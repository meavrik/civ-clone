import type { City } from "@civ/core";
import type { CityEra, CityTier } from "@civ/renderer-api";
import { drawShield, SHIELD_AT } from "../overlays.js";
import { SPRITE_CLEAR } from "../sprites/sheet.js";
import { CITY_SHEET, darker, FEATURE_SHEET, spriteSurface } from "../sprites/index.js";
import type { Surface } from "../surface.js";

/**
 * City marker on the map, as fine as the terrain: the city's icon for its age and size (`cityLook`,
 * from the cities sheet) standing free on its square and flying its owner's flag, inside the wall
 * ring when walls are built (back half behind the town, front half before it), and the owner's
 * shield in the corner when units are inside (`garrisoned`), as a unit wears it. The population and
 * the mood go on the label under the square (`drawCityLabel`).
 */
export function drawCity(s: Surface, dx: number, dy: number, city: City, look: { era: CityEra; tier: CityTier }, color: number, garrisoned = false): void {
  const walled = city.buildings.includes("city_walls");
  const sprite = (name: string) => spriteSurface(FEATURE_SHEET, name, color);
  const back = walled ? sprite("walls") : null;
  if (back) s.blit(back, dx, dy, SPRITE_CLEAR);
  const town = spriteSurface(CITY_SHEET, `${look.era}-${look.tier}`, color);
  if (town) s.blit(town, dx, dy, SPRITE_CLEAR);
  const front = walled ? sprite("walls_front") : null;
  if (front) s.blit(front, dx, dy, SPRITE_CLEAR);
  if (garrisoned) drawShield(s, dx, dy, SHIELD_AT, SHIELD_AT, color, darker(color));
}
