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
}

export const DIFFICULTY_RULES: DifficultyRule[] = [
  { name: "Chieftain", content: 6, gold: 100, settlers: 2, techCost: 8 },
  { name: "Warlord", content: 5, gold: 50, settlers: 2, techCost: 10 },
  { name: "Prince", content: 4, gold: 0, settlers: 1, techCost: 12 },
  { name: "King", content: 3, gold: 0, settlers: 1, techCost: 14 },
  { name: "Emperor", content: 2, gold: 0, settlers: 1, techCost: 16 },
];

/** A difficulty level's rules; Prince for anything out of range. */
export function difficultyRule(level: number): DifficultyRule {
  return DIFFICULTY_RULES[level] ?? DIFFICULTY_RULES[2]!;
}
