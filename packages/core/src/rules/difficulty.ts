/** What each difficulty level (Chieftain 0 .. Emperor 4) changes for a civilization, as the original's. */
export interface DifficultyRule {
  name: string;
  /** Citizens born content in each city, before the empire's size counts (`contentBase`). */
  content: number;
  /** Gold in the treasury at the start. */
  gold: number;
  /** Settlers at the start for the player (computer players always have two). */
  settlers: number;
  /** Beakers per advance already known: each advance costs this much more than the last. */
  techCost: number;
  /** What the computer players play with at this level (`computerRule`): the fields above are the human's. */
  computer: ComputerRule;
}

/**
 * The computer players at a level (asked for 2026-10-30: "the other civs AI should be more ruthless and more
 * advanced as the difficulty grows"; save version 47). Their economy follows the original's handicaps and
 * advantages: it charged the computer 160% of the human's costs and food box at Chieftain down to 80% at
 * Emperor, 14 down to 10 beakers per advance known, and kept its content citizens fixed whatever the level.
 * Here the same spread is taken from Prince, the level every game was measured at, so a Prince game plays as
 * before: 133% .. 67%. Their temper (`TemperRule`) is how they treat a human player.
 */
export interface ComputerRule {
  /** Percent of the rules' cost a computer player pays for units, improvements, wonders and spaceship parts. */
  cost: number;
  /** Percent of the usual food box a computer player's city fills to grow. */
  food: number;
  /** Beakers per advance already known (the original's 14 - level). */
  techCost: number;
  /** Citizens born content in each city (the human's `content` falls with the level; the computer's does not). */
  content: number;
  /** Gold in the treasury at the start. */
  gold: number;
  /**
   * Points off `cost` and `food` from 1 AD while a human player knows more advances than any computer player
   * (the original's King and Emperor computers caught up with a leading human so; `leaderSpurred`).
   */
  spur: number;
  temper: TemperRule;
}

/**
 * How computer leaders treat a human player at a level (computer players among themselves play alike at every
 * level, so all-AI games measure the same). Prince's numbers are the planner's own before levels counted.
 */
export interface TemperRule {
  /** Times the human's land strength a leader needs to start a war of choice on them (null: never). */
  warRatio: number | null;
  /** Times the human's strength a leader needs to break a peace treaty with them (null: never). */
  treatyRatio: number | null;
  /** No war of choice on a human before this turn. */
  warFrom: number;
  /** Percent a turn a leader with the odds goes to war (twice at three times the strength, twice again when hostile). */
  warChance: number;
  /** A leader friendly toward the human never starts a war of choice on them. */
  sparesFriends: boolean;
  /** A leader fighting only the barbarians (a city-state, a barbarian-held city) may still start a war of choice on the human. */
  twoFronts: boolean;
  /** Times the trespasser's strength a leader needs to go to war after its last warning (null: it only complains). */
  trespassRatio: number | null;
  /** At war, a leader keeps fighting a human it is this many times stronger than whose cities its attackers threaten (null: always takes peace). */
  holdsWar: number | null;
  /** Times the chance a leader at war with a human sends an envoy offering peace. */
  peaceWill: number;
  /** Times the human's strength a leader needs to demand tribute (null: never). */
  tributeRatio: number | null;
  /** Times the share of the human's treasury it demands (the original's parley demands: 0.25 .. 1.25, Prince 0.75). */
  tributeShare: number;
  /** Percent a turn a demand comes once due. */
  tributeChance: number;
  /** Percent of refusals a leader still that much the stronger answers with war. */
  refusalWar: number;
}

export const DIFFICULTY_RULES: DifficultyRule[] = [
  {
    name: "Chieftain", content: 6, gold: 100, settlers: 2, techCost: 8,
    computer: {
      cost: 133, food: 133, techCost: 14, content: 4, gold: 0, spur: 0,
      // The original's Chieftain leaders always took peace.
      temper: { warRatio: null, treatyRatio: null, warFrom: Infinity, warChance: 0, sparesFriends: true, twoFronts: false, trespassRatio: null, holdsWar: null, peaceWill: 5, tributeRatio: null, tributeShare: 1 / 3, tributeChance: 0, refusalWar: 0 },
    },
  },
  {
    name: "Warlord", content: 5, gold: 50, settlers: 2, techCost: 10,
    computer: {
      cost: 117, food: 117, techCost: 13, content: 4, gold: 0, spur: 0,
      temper: { warRatio: 3, treatyRatio: 4, warFrom: 120, warChance: 3, sparesFriends: true, twoFronts: false, trespassRatio: 1, holdsWar: 2, peaceWill: 1.5, tributeRatio: 4, tributeShare: 2 / 3, tributeChance: 5, refusalWar: 25 },
    },
  },
  {
    name: "Prince", content: 4, gold: 0, settlers: 1, techCost: 12,
    computer: {
      cost: 100, food: 100, techCost: 12, content: 4, gold: 0, spur: 0,
      temper: { warRatio: 2, treatyRatio: 3, warFrom: 80, warChance: 5, sparesFriends: true, twoFronts: false, trespassRatio: 0.6, holdsWar: 1.4, peaceWill: 1, tributeRatio: 3, tributeShare: 1, tributeChance: 10, refusalWar: 50 },
    },
  },
  {
    name: "King", content: 3, gold: 0, settlers: 1, techCost: 14,
    computer: {
      cost: 83, food: 83, techCost: 11, content: 4, gold: 0, spur: 17,
      temper: { warRatio: 1.5, treatyRatio: 2, warFrom: 60, warChance: 8, sparesFriends: true, twoFronts: true, trespassRatio: 0.5, holdsWar: 1.2, peaceWill: 0.5, tributeRatio: 2.5, tributeShare: 4 / 3, tributeChance: 15, refusalWar: 75 },
    },
  },
  {
    name: "Emperor", content: 2, gold: 0, settlers: 1, techCost: 16,
    computer: {
      cost: 67, food: 67, techCost: 10, content: 4, gold: 0, spur: 17,
      temper: { warRatio: 1.25, treatyRatio: 1.5, warFrom: 40, warChance: 12, sparesFriends: false, twoFronts: true, trespassRatio: 0.4, holdsWar: 1, peaceWill: 0.25, tributeRatio: 2, tributeShare: 5 / 3, tributeChance: 20, refusalWar: 100 },
    },
  },
];

/** A difficulty level's rules; Prince for anything out of range. */
export function difficultyRule(level: number): DifficultyRule {
  return DIFFICULTY_RULES[level] ?? DIFFICULTY_RULES[2]!;
}
