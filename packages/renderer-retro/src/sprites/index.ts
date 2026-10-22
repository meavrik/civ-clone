import citiesArt from "../art/cities.art.js";
import citizensArt from "../art/citizens.art.js";
import featuresArt from "../art/features.art.js";
import iconsArt from "../art/icons.art.js";
import portraitsArt from "../art/portraits.art.js";
import resourcesArt from "../art/resources.art.js";
import terrainArt from "../art/terrain.art.js";
import unitsArt from "../art/units.art.js";
import { C } from "../palette.js";
import { DETAIL, Surface } from "../surface.js";
import { CLEAR, OWNER, OWNER_DARK, parseSheet, SPRITE_CLEAR, spriteIndices, type Sheet } from "./sheet.js";

/**
 * The sheets the retro renderer draws from; each parses (and validates) once, at load. Terrain is
 * drawn as fine as the screen (DETAIL pixels to a screen pixel): a square is 16 screen pixels
 * across and its terrain 32. Everything else is drawn in screen pixels.
 */
/** Units stand free on the terrain, as fine as it: 32x32, two pixels to each screen pixel. */
export const UNIT_SHEET = parseSheet("units", 32, unitsArt, ["hide", "steel", "grey"], DETAIL);
export const TERRAIN_SHEET = parseSheet("terrain", 16 * DETAIL, terrainArt, ["grass", "earth", "stone"], DETAIL);
/** City walls, villages and mines, as fine as the terrain: 32x32. */
export const FEATURE_SHEET = parseSheet("features", 32, featuresArt, ["earth", "stone", "grey"], DETAIL);
/** Cities on the map by age and size (`cityLook`), as fine as the terrain: 32x32, named `ancient-village` and so on. */
export const CITY_SHEET = parseSheet("cities", 32, citiesArt, ["town", "skin", "rock"], DETAIL);
/** Special resources, as fine as the terrain they stand on: 32x32, named after the special. */
export const RESOURCE_SHEET = parseSheet("resources", 32, resourcesArt, ["jewel", "hide", "steel"], DETAIL);
/** 8x8 pictures (16x16 fine pixels) for the info panels and the badges on working units. */
export const ICON_SHEET = parseSheet("icons", 16, iconsArt, ["grey", "earth", "stone"], DETAIL);
/** The city screen's citizens, a man and a woman to each sprite (see citizens.ts). */
export const CITIZEN_SHEET = parseSheet("citizens", 32, citizensArt, ["flesh", "earth", "grey"], DETAIL);
/** The setup's rulers: the difficulty levels and each tribe's leader, 48x48 busts (tools/sprites/draw/portraits.ts). */
export const PORTRAIT_SHEET = parseSheet("portraits", 48, portraitsArt, ["flesh", "earth", "brick"], DETAIL);
export const SHEETS: Record<string, Sheet> = { units: UNIT_SHEET, terrain: TERRAIN_SHEET, features: FEATURE_SHEET, cities: CITY_SHEET, resources: RESOURCE_SHEET, icons: ICON_SHEET, citizens: CITIZEN_SHEET, portraits: PORTRAIT_SHEET };

/** An owner colour's darker partner in the EGA set, for shading the box and `p` pixels. */
const DARKER: Record<number, number> = {
  [C.WHITE!]: C.LGREY!, [C.LGREEN!]: C.GREEN!, [C.LBLUE!]: C.BLUE!, [C.YELLOW!]: C.BROWN!,
  [C.LCYAN!]: C.CYAN!, [C.LRED!]: C.RED!, [C.LMAGENTA!]: C.MAGENTA!, [C.LGREY!]: C.DGREY!, [C.ORANGE!]: C.BROWN!,
};
export function darker(fill: number): number {
  return DARKER[fill] ?? fill;
}

const compiled = new Map<string, Surface>();

/** A sprite as a surface (clear pixels are SPRITE_CLEAR), owner pixels in the given colour; null if the sheet lacks it. */
export function spriteSurface(sheet: Sheet, name: string, owner: number = C.WHITE!): Surface | null {
  const key = `${sheet.name}/${name}/${owner}`;
  const hit = compiled.get(key);
  if (hit) return hit;
  const def = sheet.byName.get(name);
  if (!def) return null;
  const s = new Surface(sheet.size / sheet.k, sheet.size / sheet.k, undefined, sheet.k);
  const idx = spriteIndices(def);
  for (let i = 0; i < idx.length; i++) {
    const v = idx[i]!;
    s.data[i] = v === CLEAR ? SPRITE_CLEAR : v === OWNER ? owner : v === OWNER_DARK ? darker(owner) : v;
  }
  compiled.set(key, s);
  return s;
}

/** A left-right mirror image, for variety in repeated terrain. */
export function mirrored(src: Surface): Surface {
  const out = new Surface(src.width, src.height, undefined, src.k);
  const w = src.fw;
  for (let y = 0; y < src.fh; y++)
    for (let x = 0; x < w; x++) out.data[y * w + x] = src.data[y * w + (w - 1 - x)]!;
  return out;
}

const boxes = new Map<number, Surface>();

/** The owner's colour box units and cities stand on: black outline, colour fill, darker inner edge right and bottom. */
export function ownerBox(fill: number): Surface {
  const hit = boxes.get(fill);
  if (hit) return hit;
  const s = new Surface(16, 16);
  s.fill(SPRITE_CLEAR);
  s.rect(1, 1, 14, 14, C.BLACK!);
  s.rect(2, 2, 12, 12, fill);
  s.vline(13, 2, 12, darker(fill));
  s.hline(2, 13, 12, darker(fill));
  boxes.set(fill, s);
  return s;
}
