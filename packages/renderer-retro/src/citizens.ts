import { citizenLook, type CitizenLook, type CitizenMood } from "@civ/renderer-api";
import { shade } from "./palette.js";
import { CITIZEN_SHEET } from "./sprites/index.js";
import { CLEAR, SPRITE_CLEAR, spriteIndices } from "./sprites/sheet.js";
import { Surface } from "./surface.js";

/** A citizen's size in screen pixels (20x26 fine pixels). */
export const CITIZEN_W = 10;
export const CITIZEN_H = 13;
/** How far apart the people of a row stand at most: their bodies keep apart, raised arms and props reach over. */
export const CITIZEN_PITCH = 8;

/** The skin as the sheet draws it: lit, shaded, deepest (flesh 6, 5, 4). */
const DRAWN = [6, 5, 4] as const;
/** Each skin tone in those three places: the sheet's own, four darker down the flesh ramp, and deep brown. */
const SKINS: (() => readonly [number, number, number])[] = [
  () => [shade("flesh", 6), shade("flesh", 5), shade("flesh", 4)],
  () => [shade("flesh", 5), shade("flesh", 4), shade("flesh", 3)],
  () => [shade("flesh", 4), shade("flesh", 3), shade("flesh", 2)],
  () => [shade("flesh", 3), shade("flesh", 2), shade("flesh", 1)],
  () => [shade("flesh", 2), shade("flesh", 1), shade("flesh", 0)],
  () => [shade("skin", 7), shade("skin", 4), shade("hide", 1)],
];
const cache = new Map<string, Surface>();

/**
 * One citizen as a CITIZEN_W x CITIZEN_H surface (clear pixels SPRITE_CLEAR): the user's figure for the
 * mood or trade, a man or a woman, its skin in the person's tone.
 */
export function citizenSprite(mood: CitizenMood, look: CitizenLook): Surface {
  const name = `${mood}-${look.woman ? "f" : "m"}`;
  const key = `${name}/${look.skin}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const idx = spriteIndices(CITIZEN_SHEET.byName.get(name)!);
  const tone = SKINS[look.skin]!();
  const swap = new Map<number, number>([[CLEAR, SPRITE_CLEAR], ...DRAWN.map((n, i) => [shade("flesh", n), tone[i]!] as [number, number])]);
  // As fine as the sheet: CITIZEN_W x CITIZEN_H screen pixels, k fine pixels to each, from the sprite's top left.
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

/** Draw the i-th citizen of a city with its top left at (x, y); `lit`: ringed in that colour (the one the pointer rests on). */
export function drawCitizen(s: Surface, x: number, y: number, mood: CitizenMood, city: number, i: number, lit?: number): void {
  const sprite = citizenSprite(mood, citizenLook(city, i));
  if (lit !== undefined) s.halo(sprite, x, y, SPRITE_CLEAR, lit);
  s.blit(sprite, x, y, SPRITE_CLEAR);
}
