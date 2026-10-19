/**
 * Culture (our departure, asked for: the original's borders never moved). Every
 * city gathers culture each turn, from its people (its influence) and from its
 * temples, libraries, wonders and the like (`BuildingRule.culture`); its border
 * reaches further as the culture mounts (`borderRadius` in territory.ts).
 */
export const CULTURE = {
  /** Every city makes this much a turn, and one more for each `perCitizens` of its people. */
  base: 1,
  perCitizens: 4,
  /** Each wonder in the city. */
  wonder: 3,
  /**
   * A new city's border reaches the squares round it (radius 1); each of these
   * totals reached takes it a square further. Radius 2 is the 21 squares a city
   * works.
   */
  levels: [10, 60, 240, 900],
} as const;
