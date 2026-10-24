import { citizenLook, type CitizenLook, type CitizenMood } from "@civ/renderer-api";
import { C, shade } from "./palette.js";
import { CITIZEN_SHEET } from "./sprites/index.js";
import { CLEAR, OWNER, OWNER_DARK, SPRITE_CLEAR, spriteIndices } from "./sprites/sheet.js";
import { Surface } from "./surface.js";

/** A citizen's size in screen pixels (16x26 fine pixels). */
export const CITIZEN_W = 8;
export const CITIZEN_H = 13;

/** A part's colours: lit, shaded, and its outline (a dark shade of its own colour, never black). */
type Tones = readonly [number, number, number];

/** Clothes show the mood (yellow happy, white content, red unhappy) or the trade. */
const CLOTHES: Record<CitizenMood, () => Tones> = {
  happy: () => [shade("wheat", 7), shade("wheat", 2), shade("plains", 0)],
  content: () => [shade("marble", 7), shade("marble", 4), shade("marble", 1)],
  unhappy: () => [C.LRED!, C.RED!, shade("brick", 1)],
  entertainer: () => [C.LMAGENTA!, C.MAGENTA!, shade("jewel", 1)],
  taxman: () => [C.ORANGE!, shade("mound", 3), shade("hide", 1)],
  scientist: () => [C.LCYAN!, C.CYAN!, shade("sea", 1)],
};
/** Skin: fair, light, tan, brown, dark, deep. */
const SKINS: (() => Tones)[] = [
  () => [shade("flesh", 7), shade("flesh", 5), shade("flesh", 2)],
  () => [shade("flesh", 6), shade("flesh", 4), shade("flesh", 1)],
  () => [shade("flesh", 5), shade("flesh", 3), shade("flesh", 0)],
  () => [shade("flesh", 3), shade("flesh", 1), shade("skin", 1)],
  () => [shade("skin", 7), shade("skin", 4), shade("skin", 0)],
  () => [shade("skin", 5), shade("skin", 2), shade("skin", 0)],
];
const cache = new Map<string, Surface>();

/**
 * One citizen as a CITIZEN_W x CITIZEN_H surface (clear pixels SPRITE_CLEAR): the sheet's one figure,
 * its head in the person's skin (6/4/2) and its body in the mood's or trade's colour (P/p/r).
 */
export function citizenSprite(mood: CitizenMood, look: CitizenLook): Surface {
  const key = `${mood}/${look.skin}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const def = CITIZEN_SHEET.byName.get("person")!;
  const idx = spriteIndices(def);
  const tones = (stand: readonly number[], to: Tones) => stand.map((from, i) => [from, to[i]!] as [number, number]);
  const swap = new Map<number, number>([
    [CLEAR, SPRITE_CLEAR],
    ...tones([shade("flesh", 6), shade("flesh", 4), shade("flesh", 2)], SKINS[look.skin]!()),
    ...tones([OWNER, OWNER_DARK, C.RED!], CLOTHES[mood]()),
  ]);
  // As fine as the sheet: CITIZEN_W x CITIZEN_H screen pixels, k fine pixels to each, from the sprite's left half.
  const k = CITIZEN_SHEET.k;
  const s = new Surface(CITIZEN_W, CITIZEN_H, undefined, k);
  for (let y = 0; y < s.fh; y++)
    for (let x = 0; x < s.fw; x++) {
      const v = idx[y * CITIZEN_SHEET.size + x]!;
      s.data[y * s.fw + x] = swap.get(v) ?? v;
    }
  cache.set(key, s);
  return s;
}

/** Draw the i-th citizen of a city with its top left at (x, y). */
export function drawCitizen(s: Surface, x: number, y: number, mood: CitizenMood, city: number, i: number): void {
  s.blit(citizenSprite(mood, citizenLook(city, i)), x, y, SPRITE_CLEAR);
}
