import citizensArt from "../art/citizens.art.js";
import featuresArt from "../art/features.art.js";
import iconsArt from "../art/icons.art.js";
import terrainArt from "../art/terrain.art.js";
import unitsArt from "../art/units.art.js";
import { C } from "../palette.js";
import { Surface } from "../surface.js";
import { CLEAR, OWNER, OWNER_DARK, parseSheet, SPRITE_CLEAR, spriteIndices, type Sheet } from "./sheet.js";

/** The sheets the retro renderer draws from; each parses (and validates) once, at load. */
export const UNIT_SHEET = parseSheet("units", 16, unitsArt, ["flesh", "earth", "grey"]);
export const TERRAIN_SHEET = parseSheet("terrain", 16, terrainArt, ["grass", "earth", "stone"]);
export const FEATURE_SHEET = parseSheet("features", 16, featuresArt, ["earth", "stone", "grey"]);
/** 8x8 pictures for the info panels and the badges on working units. */
export const ICON_SHEET = parseSheet("icons", 8, iconsArt, ["grey", "earth", "stone"]);
/** The city screen's citizens, a man and a woman to each sprite (see citizens.ts). */
export const CITIZEN_SHEET = parseSheet("citizens", 16, citizensArt, ["flesh", "earth", "grey"]);
export const SHEETS: Record<string, Sheet> = { units: UNIT_SHEET, terrain: TERRAIN_SHEET, features: FEATURE_SHEET, icons: ICON_SHEET, citizens: CITIZEN_SHEET };

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
  const s = new Surface(sheet.size, sheet.size);
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
  const out = new Surface(src.width, src.height);
  for (let y = 0; y < src.height; y++)
    for (let x = 0; x < src.width; x++) out.data[y * src.width + x] = src.data[y * src.width + (src.width - 1 - x)]!;
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
