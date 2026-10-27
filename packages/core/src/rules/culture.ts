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
   * Radius 2 is the 21 squares a city works: the capital at three (its palace),
   * another city at four, or at two with a temple (since version 28; the first
   * levels, `slowLevels`, kept young cities to their 8 squares until size six
   * with a temple, which starved them: "unbalanced city and culture growth").
   * Until version 36 the palace's culture (`widePalace`) took the capital
   * there the day it was founded ("influence growth at first city is instant").
   * Radius 3 wants a city of eight with a temple and a library (or a courthouse
   * for one of six); 4 and 5 the great cities of the late game.
   */
  levels: [4, 12, 24, 40],
  /** The levels of saves before version 28 (`slowCulture`). */
  slowLevels: [8, 16, 28, 45],
  /** The palace's culture in saves before version 36 (`wideCapital`; since, its `BuildingRule.culture`). */
  widePalace: 3,
} as const;

/**
 * Influence yields (asked for 2026-10-24: "whales or other resources can't be reached
 * by a city, so think of other value they can provide when in the city's influence"):
 * a special resource inside a city's border but beyond the 21 squares it can work
 * (whales in deep water, anything in its outer rings), claimed by that city and
 * worked by no city, brings it trade each turn: half the resource's own trade,
 * at least `min`. Not in saves before version 28 (`noInfluenceYields`).
 */
export const INFLUENCE_YIELD = {
  min: 1,
  tradeShare: 0.5,
} as const;

/**
 * A civilization's influence is the culture of all its cities (`civInfluence`
 * in territory.ts; our departure, asked for). Other civilizations weigh it
 * against their own (`esteem`), each side counting `floor` more so that the
 * first few cities do not swing it: at `admired` times theirs or more they
 * admire it, at `scorned` times less or worse they scorn it. Computer leaders
 * deal more readily with civilizations they admire (`attitude` in the AI).
 */
export const INFLUENCE = {
  floor: 10,
  admired: 1.5,
  scorned: 2,
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
