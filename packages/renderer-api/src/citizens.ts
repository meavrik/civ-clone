import { cityFoci, computeCity, FOCI, type City, type CityFocus, type GameState, type MoodStageKind, type Specialist } from "@civ/core";
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

/**
 * The people in a city's row, in the order the city screen shows them: those working the land by
 * their mood (happy, content, unhappy), then the specialists in the city's own order.
 */
export function citizenRow(state: GameState, city: City): CitizenMood[] {
  const r = computeCity(state, city);
  return [
    ...Array<CitizenMood>(r.happy).fill("happy"),
    ...Array<CitizenMood>(r.content).fill("content"),
    ...Array<CitizenMood>(r.unhappy).fill("unhappy"),
    ...city.specialists,
  ];
}

/** True for a person who works the land, false for a specialist. */
export function isWorker(who: CitizenMood): who is "happy" | "content" | "unhappy" {
  return who === "happy" || who === "content" || who === "unhappy";
}

/**
 * The trade a specialist takes on when clicked: entertainer, taxman, scientist, as in the original, then
 * back to work on the land (null) while the city has a square free (`canWork`; asked for 2026-10-25: a
 * changed citizen could not go back to work), else round again.
 */
export function nextSpecialist(s: Specialist, canWork = false): Specialist | null {
  return s === "entertainer" ? "taxman" : s === "taxman" ? "scientist" : canWork ? null : "entertainer";
}

/** What each specialist gives the city (two of a kind, `computeCity`). */
export const SPECIALIST_GIVES: Record<Specialist, string> = { entertainer: "+2 luxuries", taxman: "+2 tax", scientist: "+2 science" };

const NAME: Record<CitizenMood, string> = { happy: "Happy", content: "Content", unhappy: "Unhappy", entertainer: "Entertainer", taxman: "Taxman", scientist: "Scientist" };
const AN: Record<Specialist, string> = { entertainer: "an entertainer", taxman: "a taxman", scientist: "a scientist" };

/** Who a person in the city's row is: "Content worker", "Taxman, +2 tax". */
export function citizenRole(who: CitizenMood): string {
  return isWorker(who) ? `${NAME[who]} worker` : `${NAME[who]}, ${SPECIALIST_GIVES[who]}`;
}

/** What the city screen says of a person in its row: who they are, and what a click makes of them (`canWork`: a square is free). */
export function citizenNote(who: CitizenMood, canWork = false): string {
  const next = isWorker(who) ? "entertainer" : nextSpecialist(who, canWork);
  return `${citizenRole(who)}. ${next ? `Click for ${AN[next]}` : "Click to work the land"}`;
}

/** The city screen's word on its row of people while none is pointed at. */
export const CITIZENS_HINT = "Click a citizen to change their job";

/** The four focus toggles in the corners of the city screen's map, clockwise from the top left, and their icons. */
export const FOCUS_CORNERS: readonly { focus: CityFocus; icon: IconName }[] = [
  { focus: "growth", icon: "food" },
  { focus: "production", icon: "shield" },
  { focus: "trade", icon: "coin" },
  { focus: "science", icon: "bulb" },
];

/** What the city screen says of a control under the pointer: the close box, View, Happy, or a focus toggle. */
export function cityControlNote(state: GameState, city: City, control: string): string | null {
  if (control === "exit") return "Leave the city (Esc)";
  if (control === "view") return "See the city (V)";
  if (control === "happy") return "How the citizens feel, stage by stage (H)";
  const f = FOCI.find((r) => r.id === control);
  if (!f) return null;
  const on = cityFoci(state, city).includes(f.id);
  return `${f.name}: ${f.text}. Click to ${on ? "drop it" : "add it"}`;
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
