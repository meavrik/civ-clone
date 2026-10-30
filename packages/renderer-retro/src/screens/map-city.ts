import type { City } from "@civ/core";
import { cityArt, type ArtBox, type ArtSpot, type CityEra, type CityTier } from "@civ/renderer-api";
import { spriteHoles } from "../art-holes.js";
import { drawShield, SHIELD_AT, shieldHoles } from "../overlays.js";
import { SPRITE_CLEAR } from "../sprites/sheet.js";
import { CITY_SHEET, darker, FEATURE_SHEET, spriteSurface } from "../sprites/index.js";
import type { Surface } from "../surface.js";
import { TILE } from "../tiles.js";

/**
 * City marker on the map, as fine as the terrain: the city's icon for its age and size (`cityLook`,
 * from the cities sheet) standing free on its square and flying its owner's flag, inside the wall
 * ring when walls are built (back half behind the town, front half before it), and the owner's
 * shield in the corner when units are inside (`garrisoned`), as a unit wears it. The population and
 * the mood go on the label under the square (`drawCityLabel`).
 * Given `picture` (the room pictures may show in), a look the user drew (`cityArt`) leaves a spot for its
 * picture (`Surface.art`; the apps lay it there as it is, over the canvas) in place of the icon, the front of
 * the walls and the shield showing through it; the spot is returned, for what the screen draws over it later.
 */
export function drawCity(s: Surface, dx: number, dy: number, city: City, look: { era: CityEra; tier: CityTier }, color: number, garrisoned = false, picture?: { room: ArtBox }): ArtSpot | null {
  const walled = city.buildings.includes("city_walls");
  const sprite = (name: string) => spriteSurface(FEATURE_SHEET, name, color);
  const back = walled ? sprite("walls") : null;
  if (back) s.blit(back, dx, dy, SPRITE_CLEAR);
  const id = `${look.era}-${look.tier}`;
  const front = walled ? sprite("walls_front") : null;
  let spot: ArtSpot | null = null;
  if (picture && cityArt(id)) {
    const holes = [...(front ? spriteHoles(front, dx, dy) : []), ...(garrisoned ? shieldHoles(dx, dy, false) : [])];
    spot = { id, city: true, x: dx, y: dy, w: TILE, h: TILE, clip: picture.room, ...(holes.length ? { holes } : {}) };
    s.art.push(spot);
  } else {
    const town = spriteSurface(CITY_SHEET, id, color);
    if (town) s.blit(town, dx, dy, SPRITE_CLEAR);
  }
  if (front) s.blit(front, dx, dy, SPRITE_CLEAR);
  if (garrisoned) drawShield(s, dx, dy, SHIELD_AT, SHIELD_AT, color, darker(color));
  return spot;
}
