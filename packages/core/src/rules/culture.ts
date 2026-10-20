/**
 * Culture (our departure, asked for: the original's borders never moved). A
 * city's culture is what it holds now: its people (its influence), its temples,
 * libraries and the like (`BuildingRule.culture`) and its wonders. It grows as
 * the city grows and builds them, never by itself turn after turn (asked for),
 * and falls when the city loses people or buildings. Its border reaches further
 * at each level (`borderRadius` in territory.ts).
 */
export const CULTURE = {
  /** Each citizen. */
  perCitizen: 1,
  /** Each wonder in the city. */
  wonder: 4,
  /**
   * A new city's border reaches the squares round it (radius 1); each of these
   * levels reached takes it a square further, so a border grows only as the
   * city both grows and builds (asked for: it grew after two new citizens).
   * Radius 2 is the 21 squares a city works: a city of six with a temple, or
   * the capital at five. Radius 3 wants a full city of ten with a temple,
   * library and courthouse; 4 and 5 the great cities of the late game.
   */
  levels: [8, 16, 28, 45],
} as const;

/**
 * Culture as saves before version 14 had it (`accruedCulture`): gathered every
 * turn (a base, one more for each `perCitizens` of the people, each building's
 * share and each wonder's) toward these totals. Frozen: those games must replay.
 */
export const ACCRUED_CULTURE: {
  base: number;
  perCitizens: number;
  wonder: number;
  buildings: Readonly<Record<string, number>>;
  levels: readonly number[];
} = {
  base: 1,
  perCitizens: 4,
  wonder: 3,
  buildings: { palace: 2, temple: 1, library: 1, courthouse: 1, cathedral: 2, university: 2, colosseum: 1 },
  levels: [10, 60, 240, 900],
};
