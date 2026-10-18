import { citizenLook, type CitizenLook, type CitizenMood } from "@civ/renderer-api";
import { C, shade } from "./palette.js";
import { CITIZEN_SHEET } from "./sprites/index.js";
import { CLEAR, OWNER, OWNER_DARK, SPRITE_CLEAR, spriteIndices } from "./sprites/sheet.js";
import { Surface } from "./surface.js";

/** A citizen's size; they stand 8 pixels apart. */
export const CITIZEN_W = 7;
export const CITIZEN_H = 13;

type Pair = readonly [number, number];

/** Clothes show the mood (yellow happy, white content, red unhappy) or the trade. */
const CLOTHES: Record<CitizenMood, () => Pair> = {
  happy: () => [C.YELLOW!, shade("plains", 5)],
  content: () => [C.WHITE!, shade("grey", 5)],
  unhappy: () => [C.LRED!, C.RED!],
  entertainer: () => [C.LMAGENTA!, C.MAGENTA!],
  taxman: () => [C.ORANGE!, C.BROWN!],
  scientist: () => [C.LCYAN!, C.CYAN!],
};
/** Skin, light and shade: fair, light, tan, brown, dark, deep. */
const SKINS: (() => Pair)[] = [
  () => [shade("flesh", 7), shade("flesh", 4)],
  () => [shade("flesh", 6), shade("flesh", 3)],
  () => [shade("flesh", 4), shade("flesh", 1)],
  () => [shade("flesh", 2), shade("skin", 5)],
  () => [shade("skin", 6), shade("skin", 2)],
  () => [shade("skin", 3), shade("skin", 0)],
];
/** Hair, dark and light: black, dark brown, brown, auburn, blond, grey. */
const HAIR: (() => Pair)[] = [
  () => [shade("grey", 1), shade("grey", 2)],
  () => [shade("skin", 2), shade("skin", 4)],
  () => [shade("earth", 2), shade("earth", 4)],
  () => [C.BROWN!, shade("earth", 5)],
  () => [shade("sand", 3), shade("sand", 5)],
  () => [shade("grey", 5), shade("grey", 6)],
];
/** Trousers, light and dark: blue, brown, grey, green. */
const LEGS: (() => Pair)[] = [
  () => [shade("ocean", 3), shade("ocean", 1)],
  () => [shade("earth", 2), shade("earth", 0)],
  () => [shade("grey", 3), shade("grey", 1)],
  () => [shade("forest", 4), shade("forest", 2)],
];

const cache = new Map<string, Surface>();

/** One citizen as a 7x13 surface (clear pixels SPRITE_CLEAR), the sheet's stand-in colours swapped for theirs. */
export function citizenSprite(mood: CitizenMood, look: CitizenLook): Surface {
  const key = `${mood}/${look.woman ? 1 : 0}${look.style}${look.skin}${look.hair}${look.legs}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const def = CITIZEN_SHEET.byName.get(look.style ? `${mood}-2` : mood)!;
  const idx = spriteIndices(def);
  const [clothes, clothesDark] = CLOTHES[mood]();
  const [skin, skinShade] = SKINS[look.skin]!();
  const [hair, hairLight] = HAIR[look.hair]!();
  const [legs, legsDark] = LEGS[look.legs]!();
  const swap = new Map<number, number>([
    [CLEAR, SPRITE_CLEAR], [OWNER, clothes], [OWNER_DARK, clothesDark],
    [shade("flesh", 6), skin], [shade("flesh", 4), skinShade],
    [shade("earth", 1), hair], [shade("earth", 3), hairLight],
    [shade("grey", 2), legs], [shade("grey", 1), legsDark],
  ]);
  const s = new Surface(CITIZEN_W, CITIZEN_H);
  const x0 = look.woman ? 8 : 0;
  for (let y = 0; y < CITIZEN_H; y++)
    for (let x = 0; x < CITIZEN_W; x++) {
      const v = idx[y * CITIZEN_SHEET.size + x0 + x]!;
      s.data[y * CITIZEN_W + x] = swap.get(v) ?? v;
    }
  cache.set(key, s);
  return s;
}

/** Draw the i-th citizen of a city with its top left at (x, y). */
export function drawCitizen(s: Surface, x: number, y: number, mood: CitizenMood, city: number, i: number): void {
  s.blit(citizenSprite(mood, citizenLook(city, i)), x, y, SPRITE_CLEAR);
}
