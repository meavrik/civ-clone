import { computeCity, type City, type GameState, type MoodStageKind, type Specialist } from "@civ/core";
import type { IconName } from "./icons.js";
import { hash } from "./hash.js";

/** What a citizen is doing: their mood if they work the land, or their trade as a specialist. */
export type CitizenMood = "happy" | "content" | "unhappy" | Specialist;

/**
 * Who stands in a city's row of citizens: a man or a woman in one of two looks
 * (short hair or a beard; long hair or a bun), their skin, hair and trousers.
 * Each renderer keeps its own colours for the indices.
 */
export interface CitizenLook {
  woman: boolean;
  style: 0 | 1;
  /** Fair, light, tan, brown, dark, deep. */
  skin: number;
  /** Black, dark brown, brown, auburn, blond, grey. */
  hair: number;
  /** Blue, brown, grey, green. */
  legs: number;
}

export const CITIZEN_SKINS = 6;
export const CITIZEN_LEGS = 4;
/** Hair by how often it shows: black and dark brown most, grey and the light colours least. */
const HAIR_ODDS = [0, 0, 0, 1, 1, 1, 2, 2, 3, 4, 5];

/** The i-th person in a city's row, the same each time it is drawn (a hash, never the game RNG). */
export function citizenLook(city: number, i: number): CitizenLook {
  const pick = (salt: number, n: number) => Math.min(n - 1, Math.floor(hash(city, i, salt) * n));
  return {
    woman: hash(city, i, 71) < 0.5,
    style: hash(city, i, 72) < 0.5 ? 0 : 1,
    skin: pick(73, CITIZEN_SKINS),
    hair: HAIR_ODDS[pick(74, HAIR_ODDS.length)]!,
    legs: pick(75, CITIZEN_LEGS),
  };
}

/** The Happy panel's word for each stage of the mood reckoning (`MOOD_STAGES`). */
export const MOOD_STAGE_LABELS: Record<MoodStageKind, string> = { born: "Born", luxury: "Luxury", buildings: "Buildings", soldiers: "Soldiers", wonders: "Wonders" };
/** And its icon, where the panel has no room for words. */
export const MOOD_STAGE_ICONS: Record<MoodStageKind, IconName> = { born: "people", luxury: "gem", buildings: "house", soldiers: "swords", wonders: "star" };

/** What the map flags about one of the viewer's cities: rioting, one lost happy citizen from it (`unrest`), or celebrating. */
export type CityMood = "disorder" | "unrest" | "celebrating";

/** The flag a city flies, from its moods as they stand now (a foreign city's are not ours to know: ask only for the viewer's). */
export function cityMood(state: GameState, city: City): CityMood | null {
  const r = computeCity(state, city);
  if (r.disorder) return "disorder";
  if (r.unhappy > 0 && r.unhappy === r.happy) return "unrest";
  if (city.celebrating) return "celebrating";
  return null;
}
