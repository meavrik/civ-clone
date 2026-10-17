/**
 * Barbarian activity, after FreeCiv's server rules at their "normal" level
 * (its model of the 1991 game): each round a few random squares are tried,
 * and one 5 to 8 squares from the nearest city starts an uprising (on land
 * the victim has explored) or a raid (on the sea near land). Big empires
 * draw them more often and in bigger bands. Every band has a leader.
 */
export const BARBARIANS = {
  /** First round with uprisings and raids (about 1000 BC). */
  onset: 150,
  /** One summons is tried each round per this many squares of map. */
  squaresPerTry: 2000,
  /** The nearest city must be this far from the spot (inclusive, in squares). */
  minDistance: 5,
  maxDistance: 8,
  /**
   * Activity level (FreeCiv's "normal" is 2): a victim with n cities passes
   * the summons n*(rate-1) times in 30, and bands are rate units per step of
   * its size plus 0-2.
   */
  rate: 2,
  /** The victim's cities for the first step up in band size; each next step is 2.2 times bigger plus this. */
  civSize: 10,
  /** Gold paid to the land unit that catches a leader without an escort. */
  ransom: 100,
} as const;
