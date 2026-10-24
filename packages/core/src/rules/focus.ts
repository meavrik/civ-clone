import type { CityFocus, Specialist } from "../types.js";

/**
 * What a city puts its citizens to work for, chosen on the city screen (our departure: the
 * original weighed every city alike). The squares a city works automatically (`autoAssignWorkers`,
 * `arrangeCity`) are ranked by these weights; a focus never starves its city when another square
 * would feed it. Growth is the player's default.
 */
export interface FocusRule {
  id: CityFocus;
  name: string;
  /** A few words for the city screen's menu. */
  text: string;
  /** What a worked square is worth: each food, shield and trade it yields times these. */
  weights: { food: number; shields: number; trade: number };
  /** Citizens left with no square to work become these, as long as the city keeps order. */
  spare: Specialist;
  /** Foci picked together: the spare citizens take these trades in turn (science and trade: scientist, taxman, ...). */
  spares?: readonly Specialist[];
}

export const FOCI: readonly FocusRule[] = [
  { id: "growth", name: "Growth", text: "food first: the city grows", weights: { food: 5, shields: 2, trade: 1 }, spare: "entertainer" },
  { id: "production", name: "Production", text: "shields first", weights: { food: 2, shields: 5, trade: 1 }, spare: "entertainer" },
  { id: "science", name: "Science", text: "trade first, spare citizens study", weights: { food: 2, shields: 1, trade: 5 }, spare: "scientist" },
  { id: "trade", name: "Trade", text: "trade first, spare citizens tax", weights: { food: 2, shields: 1, trade: 5 }, spare: "taxman" },
];

/** The computer players' cities, and every city of a game saved before foci (`balancedWorkers`), weigh squares this way. */
export const BALANCED_WEIGHTS = { food: 3, shields: 2, trade: 1 };

export function focusRule(id: CityFocus): FocusRule {
  return FOCI.find((f) => f.id === id) ?? FOCI[0]!;
}

/**
 * Foci picked together, as one rule: their weights added (none picked: the old balance), their names
 * joined, and the spare citizens put to every trade they ask for in turn.
 */
export function combinedFocus(ids: readonly CityFocus[]): FocusRule {
  const picked = FOCI.filter((f) => ids.includes(f.id));
  if (picked.length === 1) return picked[0]!;
  const weights = picked.length
    ? picked.reduce((w, f) => ({ food: w.food + f.weights.food, shields: w.shields + f.weights.shields, trade: w.trade + f.weights.trade }), { food: 0, shields: 0, trade: 0 })
    : BALANCED_WEIGHTS;
  const spares = [...new Set(picked.map((f) => f.spare).filter((s) => s !== "entertainer"))];
  return {
    id: picked[0]?.id ?? "growth",
    name: picked.length ? picked.map((f) => f.name).join(" + ") : "Balanced",
    text: picked.length ? picked.map((f) => f.text).join("; ") : "food, shields and trade alike",
    weights,
    spare: spares[0] ?? "entertainer",
    ...(spares.length > 1 ? { spares } : {}),
  };
}
