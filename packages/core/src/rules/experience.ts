/**
 * Combat experience (asked for 2026-10-25: "for every unit produced a combat experience factor that
 * will add to the unit strength, and ranks that unit can go up"; our departure: the original had one
 * step, the veteran, won by a coin toss after a fight). Every unit counts its experience (`Unit.xp`):
 * each fight it wins teaches it, one more when its chance was under half. Its rank is the last one
 * whose experience it has, and the rank's power multiplies its attack and its defence, as the
 * veteran's half again did. Barracks and the veteran traits send units out at Veteran.
 * Saves before version 32 load with `simpleVeterans`: a win made a unit a veteran half the time.
 */
export interface RankRule {
  id: RankId;
  name: string;
  /** Experience a unit needs for the rank. */
  xp: number;
  /** Attack and defence times this. */
  power: number;
}

export type RankId = "recruit" | "regular" | "veteran" | "hardened" | "elite";

export const RANKS: readonly RankRule[] = [
  { id: "recruit", name: "Recruit", xp: 0, power: 1 },
  { id: "regular", name: "Regular", xp: 1, power: 1.25 },
  { id: "veteran", name: "Veteran", xp: 3, power: 1.5 },
  { id: "hardened", name: "Hardened", xp: 6, power: 1.75 },
  { id: "elite", name: "Elite", xp: 10, power: 2 },
];

export const EXPERIENCE = {
  /** Learned from every fight won. */
  win: 1,
  /** Learned besides, from a fight won against the odds: when the winner's chance was under `longOdds`. */
  againstOdds: 1,
  longOdds: 0.5,
} as const;

/** The experience of a unit trained as a veteran (Barracks, a trait), and all a veteran had in saves before version 32. */
export const VETERAN_XP = RANKS.find((r) => r.id === "veteran")!.xp;

/** The most experience a unit counts: the top rank's. */
export const MAX_XP = RANKS[RANKS.length - 1]!.xp;

/** Where a unit with this experience stands in `RANKS`: 0 for a recruit. */
export function rankIndex(xp: number): number {
  let i = 0;
  while (i + 1 < RANKS.length && xp >= RANKS[i + 1]!.xp) i++;
  return i;
}

export function rankOf(xp: number): RankRule {
  return RANKS[rankIndex(xp)]!;
}

/** The rank after this one, or null at the top. */
export function nextRank(xp: number): RankRule | null {
  return RANKS[rankIndex(xp) + 1] ?? null;
}

/** What a fight won teaches, the winner's chance of winning it being `odds`. */
export function experienceFor(odds: number): number {
  return EXPERIENCE.win + (odds < EXPERIENCE.longOdds ? EXPERIENCE.againstOdds : 0);
}
