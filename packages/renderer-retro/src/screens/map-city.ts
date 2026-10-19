import type { City } from "@civ/core";
import { drawText, textWidth } from "../font.js";
import { C } from "../palette.js";
import { SPRITE_CLEAR } from "../sprites/sheet.js";
import { FEATURE_SHEET, ownerBox, spriteSurface } from "../sprites/index.js";
import type { Surface } from "../surface.js";

/**
 * City marker on the map: buildings from the features sheet on the owner's
 * colour box, ringed by crenellated stone walls when built (the buildings rise
 * over them), a white shield in the corner
 * when units are inside (`garrisoned`), the population in a dark label, and
 * a red flag in disorder.
 */
export function drawCity(s: Surface, dx: number, dy: number, city: City, color: number, garrisoned = false): void {
  s.blit(ownerBox(color), dx, dy, SPRITE_CLEAR);
  if (city.buildings.includes("city_walls")) {
    const walls = spriteSurface(FEATURE_SHEET, "walls", color);
    if (walls) s.blit(walls, dx, dy, SPRITE_CLEAR);
  }
  const town = spriteSurface(FEATURE_SHEET, "city", color);
  if (town) s.blit(town, dx, dy, SPRITE_CLEAR);
  if (garrisoned) {
    const shield = spriteSurface(FEATURE_SHEET, "garrison", color);
    if (shield) s.blit(shield, dx, dy, SPRITE_CLEAR);
  }
  const n = String(city.size);
  const w = textWidth(n) + 2;
  const lx = dx + 8 - Math.floor(w / 2);
  s.rect(lx, dy + 9, w, 7, C.BLACK!);
  drawText(s, lx + 1, dy + 9, n, C.WHITE!);
  if (city.disorder) {
    s.vline(dx + 13, dy + 1, 5, C.BLACK!);
    s.rect(dx + 11, dy + 1, 2, 3, C.LRED!);
  }
}
