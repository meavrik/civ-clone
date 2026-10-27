import { building, spacePart, wonder, type GameState, type Production } from "@civ/core";

/**
 * The Building Completed window (asked for 2026-10-24, after the user's template): a city of ours
 * finished an improvement, a wonder or a spaceship part. Since 2026-10-27 (asked for: "make more
 * simplified, place all the text in the title") its title says it all, "Temple is completed in Rome",
 * over a small picture of it (the user's) and View City (the city screen, whose builders then ask what
 * comes next) and Continue (they ask over the map); its effects, upkeep and what it builds on are gone.
 */
export interface BuiltView {
  city: number;
  /** What was finished: an improvement, a wonder or a spaceship part. */
  production: Production;
  /** The lit button: 0 View City, 1 Continue. */
  selected: number;
  /** How far the window has grown on opening, 0..1 (`WINDOW_ENTER_MS`); absent or 1, it stands whole. */
  enter?: number | undefined;
  /**
   * The city's square on the screen under the window, when that is the map (`Renderer.squareRect`): the
   * window stands above it (else below, else beside it) and points at it, the square left lit (asked for
   * 2026-10-25: "smaller, and placed above the relevant built city with an arrow"). Absent, it is centred.
   */
  square?: { x: number; y: number; w: number; h: number } | undefined;
}

export const BUILT_BUTTONS = ["View City", "Continue"] as const;

/** A button of the window, or its close box (which goes on as Continue does); a click on the city it points at is View City. */
export type BuiltHit = "city" | "continue" | "close";

export interface BuiltCard {
  /** All the window says, in its title strip: "Temple is completed in Rome". */
  title: string;
  name: string;
  /** What it is, a sentence (`text` on each rule; the modern renderer's body). */
  text: string;
}

/** What the window says of a city's new improvement, wonder or spaceship part; null for anything else. */
export function builtCard(state: GameState, view: BuiltView): BuiltCard | null {
  const city = state.cities.find((c) => c.id === view.city);
  if (!city) return null;
  const p = view.production;
  const rule = p.kind === "building" ? building(p.id) : p.kind === "wonder" ? wonder(p.id) : p.kind === "spaceship" ? spacePart(p.id) : null;
  if (!rule) return null;
  return { title: `${rule.name} is completed in ${city.name}`, name: rule.name, text: rule.text };
}
