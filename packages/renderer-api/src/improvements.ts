import { building, wonder, type City, type GameState } from "@civ/core";

/**
 * The city screen's Improvements box (asked for 2026-10-25: "show small building icon for each already
 * built, add scroll so could see all building constructed, add for each the option to sell"): a line for
 * each wonder and building the city holds, with its picture, name, upkeep and (a building but the Palace)
 * a button to stop paying for it, or to pay for it again (asked for 2026-10-27 in place of selling: "stop
 * supporting the building - reduce the upkeep and disable building effect"; the core `support` command);
 * a list longer than the box scrolls (`CityScreenView.top`).
 */
export interface ImprovementLine {
  id: string;
  name: string;
  wonder: boolean;
  /** Gold a turn it costs while supported (wonders cost none). */
  upkeep: number;
  /** Unsupported (`City.idle`): no upkeep paid, no effect; shown faded with a Use button. */
  idle: boolean;
  /** It has a Stop (or, idle, a Use) button: a building, not the Palace. */
  toggles: boolean;
}

/** What a city holds, as its Improvements box lists it: its wonders first, then its buildings in the order built, then those it no longer supports. */
export function cityImprovements(city: City): ImprovementLine[] {
  const line = (id: string, idle: boolean): ImprovementLine => ({ id, name: building(id).name, wonder: false, upkeep: building(id).upkeep, idle, toggles: id !== "palace" });
  return [
    ...city.wonders.map((id) => ({ id, name: wonder(id).name, wonder: true, upkeep: 0, idle: false, toggles: false })),
    ...city.buildings.map((id) => line(id, false)),
    ...(city.idle ?? []).map((id) => line(id, true)),
  ];
}

/** What lies under a point of the Improvements box: a line (`toggle` on its Stop or Use button), or its scroll bar, which moves the list `by` lines (0 on the thumb). */
export type ImprovementHit = { kind: "line"; id: string; toggle: boolean } | { kind: "scroll"; by: number };

/** The first line on view of a list of `count` lines, `rows` of them showing: never past either end. */
export function improvementsTop(top: number | undefined, count: number, rows: number): number {
  return Math.max(0, Math.min(top ?? 0, count - rows));
}

/** The list moved `by` lines (the wheel, the bar's arrows, a page on its track), kept within its ends. */
export function scrollImprovements(city: City, top: number | undefined, by: number, rows: number): number {
  const count = cityImprovements(city).length;
  return improvementsTop(improvementsTop(top, count, rows) + by, count, rows);
}

/** What the city screen says beside its citizens of a line pointed at: what stopping its support saves, what supporting it again costs, or that it costs nothing. */
export function improvementNote(_state: GameState, city: City, id: string): string {
  if (city.wonders.includes(id)) return `${wonder(id).name}: wonders cost nothing to keep`;
  if (id === "palace") return "The Palace costs nothing to keep";
  const b = building(id);
  if (city.idle?.includes(id)) return `${b.name} stopped: Use pays ${b.upkeep} gold a turn`;
  if (!city.buildings.includes(id)) return "";
  return `${b.name}: ${b.upkeep} gold a turn. Stop: no cost, no effect`;
}
