/**
 * Gold between civilizations (asked for 2026-10-27: every gift and every price in an audience was 50
 * gold, "make the money tribute more sophisticated and not just 50 for everything"). What gold is worth
 * to a realm grows with its treasury and its people (`goldScale` in diplomacy.ts), so the same gift means
 * much to a young realm and little to a great one; the leaders' prices are shares of it (the AI's
 * `peacePrice` and the like), and a gift is weighed by it (`Gift.share`).
 */
export const GOLD_WORTH = {
  /** What gold is worth to a realm: this much... */
  base: 20,
  /** ...and this share of its treasury... */
  treasury: 0.5,
  /** ...and this much for each of its citizens. */
  perCitizen: 5,
} as const;

/**
 * Goodwill: gold given within `turns` turns, worth `share` of what gold is worth to the receiver all
 * told, leaves its leader a step warmer toward the giver (the AI's `attitude`). Not in saves before
 * version 37 (`noGoodwill`).
 */
export const GOODWILL = {
  turns: 20,
  share: 0.5,
} as const;

/**
 * Pacts and alliances (asked for 2026-10-29: "add alliance against other civ option", "add a
 * non-aggression pact option"; since save version 41). A non-aggression pact binds both sides for
 * `pactTurns`: neither may declare war on the other until it runs out. An alliance binds its two
 * members against a third civilization: both at war with it, neither at war with the other, neither
 * minding the other's units on its land, until one makes peace with the enemy or the enemy falls.
 */
export const PACTS = {
  pactTurns: 20,
} as const;
