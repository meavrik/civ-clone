import { building, sellPrice, whyNoSale, wonder, type City, type GameState } from "@civ/core";

/**
 * The city screen's Improvements box (asked for 2026-10-25: "show small building icon for each already
 * built, add scroll so could see all building constructed, add for each the option to sell"): a line for
 * each wonder and building the city holds, with its picture, name, upkeep and (a building but the Palace)
 * a Sell button; a list longer than the box scrolls (`CityScreenView.top`).
 */
export interface ImprovementLine {
  id: string;
  name: string;
  wonder: boolean;
  /** Gold a turn (wonders cost none). */
  upkeep: number;
  /** It has a Sell button: a building, not the Palace (whether the city may sell this turn is `whyNoSale`'s). */
  sells: boolean;
}

/** What a city holds, as its Improvements box lists it: its wonders first, then its buildings in the order built. */
export function cityImprovements(city: City): ImprovementLine[] {
  return [
    ...city.wonders.map((id) => ({ id, name: wonder(id).name, wonder: true, upkeep: 0, sells: false })),
    ...city.buildings.map((id) => ({ id, name: building(id).name, wonder: false, upkeep: building(id).upkeep, sells: id !== "palace" })),
  ];
}

/** What lies under a point of the Improvements box: a line (`sell` on its Sell button), or its scroll bar, which moves the list `by` lines (0 on the thumb). */
export type ImprovementHit = { kind: "line"; id: string; sell: boolean } | { kind: "scroll"; by: number };

/** The first line on view of a list of `count` lines, `rows` of them showing: never past either end. */
export function improvementsTop(top: number | undefined, count: number, rows: number): number {
  return Math.max(0, Math.min(top ?? 0, count - rows));
}

/** The list moved `by` lines (the wheel, the bar's arrows, a page on its track), kept within its ends. */
export function scrollImprovements(city: City, top: number | undefined, by: number, rows: number): number {
  const count = cityImprovements(city).length;
  return improvementsTop(improvementsTop(top, count, rows) + by, count, rows);
}

/** What the city screen says beside its citizens of a line pointed at: what selling it brings, or why it cannot be sold. */
export function improvementNote(state: GameState, city: City, id: string): string {
  const why = whyNoSale(state, city, id);
  if (why === "wonder") return `${wonder(id).name}: wonders are never sold`;
  if (why === "palace") return "The Palace is never sold";
  if (why === "sold this turn") return `${city.name} has sold a building this turn`;
  if (why === "not built") return "";
  return `Sell the ${building(id).name} for ${sellPrice(state, city, id)} gold`;
}
