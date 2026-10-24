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

/** Clothes show the mood (yellow happy, blue content, red unhappy) or the trade (a scientist's white coat). */
const CLOTHES: Record<CitizenMood, () => Tones> = {
  happy: () => [shade("wheat", 7), shade("wheat", 2), shade("plains", 0)],
  content: () => [shade("ocean", 7), shade("ocean", 5), shade("ocean", 1)],
  unhappy: () => [C.LRED!, C.RED!, shade("brick", 1)],
  entertainer: () => [C.LMAGENTA!, C.MAGENTA!, shade("jewel", 1)],
  taxman: () => [C.ORANGE!, shade("mound", 3), shade("hide", 1)],
  scientist: () => [shade("marble", 7), shade("marble", 4), shade("marble", 1)],
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
/** Hair, lit, its own colour and its outline: black, dark brown, brown, auburn, blond, grey. */
const HAIR: (() => Tones)[] = [
  () => [shade("grey", 2), shade("grey", 1), shade("grey", 0)],
  () => [shade("skin", 4), shade("skin", 1), shade("skin", 0)],
  () => [shade("earth", 4), shade("earth", 2), shade("earth", 0)],
  () => [shade("brick", 5), shade("brick", 3), shade("brick", 1)],
  () => [shade("sand", 5), shade("sand", 2), shade("plains", 0)],
  () => [shade("grey", 6), shade("grey", 4), shade("grey", 2)],
];
/** Trousers (and a headscarf): blue, brown, grey, green. */
const LEGS: (() => Tones)[] = [
  () => [shade("ocean", 3), shade("ocean", 2), shade("ocean", 0)],
  () => [shade("earth", 3), shade("earth", 1), shade("hide", 0)],
  () => [shade("grey", 4), shade("grey", 3), shade("grey", 1)],
  () => [shade("forest", 4), shade("forest", 2), shade("forest", 0)],
];

const cache = new Map<string, Surface>();

/**
 * One citizen as a CITIZEN_W x CITIZEN_H surface (clear pixels SPRITE_CLEAR), the sheet's stand-in
 * colours swapped for theirs: skin 6/4/2, hair e/c/a, clothes P/p/r, trousers C/B/A (lit, shaded, outline).
 */
export function citizenSprite(mood: CitizenMood, look: CitizenLook): Surface {
  const key = `${mood}/${look.woman ? 1 : 0}${look.style}${look.skin}${look.hair}${look.legs}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const def = CITIZEN_SHEET.byName.get(look.style ? `${mood}-2` : mood)!;
  const idx = spriteIndices(def);
  const tones = (stand: readonly number[], to: Tones) => stand.map((from, i) => [from, to[i]!] as [number, number]);
  const swap = new Map<number, number>([
    [CLEAR, SPRITE_CLEAR],
    ...tones([shade("flesh", 6), shade("flesh", 4), shade("flesh", 2)], SKINS[look.skin]!()),
    ...tones([shade("earth", 4), shade("earth", 2), shade("earth", 0)], HAIR[look.hair]!()),
    ...tones([OWNER, OWNER_DARK, C.RED!], CLOTHES[mood]()),
    ...tones([shade("grey", 2), shade("grey", 1), shade("grey", 0)], LEGS[look.legs]!()),
  ]);
  // As fine as the sheet: CITIZEN_W x CITIZEN_H screen pixels, k fine pixels to each; the woman stands in the sprite's right half.
  const k = CITIZEN_SHEET.k;
  const s = new Surface(CITIZEN_W, CITIZEN_H, undefined, k);
  const x0 = look.woman ? CITIZEN_SHEET.size / 2 : 0;
  for (let y = 0; y < s.fh; y++)
    for (let x = 0; x < s.fw; x++) {
      const v = idx[y * CITIZEN_SHEET.size + x0 + x]!;
      s.data[y * s.fw + x] = swap.get(v) ?? v;
    }
  cache.set(key, s);
  return s;
}

/** Draw the i-th citizen of a city with its top left at (x, y). */
export function drawCitizen(s: Surface, x: number, y: number, mood: CitizenMood, city: number, i: number): void {
  s.blit(citizenSprite(mood, citizenLook(city, i)), x, y, SPRITE_CLEAR);
}
