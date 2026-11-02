import type { HutResult } from "@civ/core";
import { UNIT_ANIMS } from "./unit-anim.js";

/**
 * A village sacked (asked for 2026-11-02: "when unit enter a village hut - add a sack village animation"). Once our unit
 * has walked into a village, before its window opens, the unit strikes at it (its attack round and round where it has
 * one, `UnitAnimator`'s `sacks`), each blow shaking the hut and knocking chips off it; with the last blow what the
 * village held bursts out (gold coins, a scroll of learning; mercenaries, an ambush or an empty village bring nothing
 * out), then the hut goes down into a cloud of its own dust, smoke and embers rising where it stood, and the unit
 * cheers. Only the picture: the rules opened the village as the step was taken (`MainScreenView.sacking`).
 */
export interface Sacking {
  x: number;
  y: number;
  /** Our unit in the village: it strikes, then cheers. */
  unit: number;
  loot: SackLoot;
  /** When each blow lands, ms from the start (`sackBlows`). */
  blows: readonly number[];
  /** How far the show has gone, ms. */
  ms: number;
}

/** What bursts out of a village sacked: gold coins, so many; a scroll; nothing. */
export type SackLoot = { kind: "coins"; count: number } | { kind: "scroll" } | null;

/** The show's timings, ms. */
export const SACK = {
  /** Blows land up to then. */
  blowsMs: 1150,
  /** A unit without an attack of its own strikes first then, then so often. */
  firstMs: 220,
  beatMs: 320,
  /** A blow shakes the hut so long. */
  shakeMs: 170,
  /** From the last blow the hut stands so long, goes down over `fallMs`, and the dust and smoke clear over `settleMs`. */
  holdMs: 140,
  fallMs: 600,
  settleMs: 520,
  /** A key or click cuts it short only after this. */
  skipAfterMs: 400,
  /** The unit steps aside so far (a share of its square), over so long, to strike at the hut beside it. */
  aside: 0.3,
  asideMs: 150,
} as const;

const sum = (ms: readonly number[]) => ms.reduce((a, b) => a + b, 0);

/**
 * When the blows of a unit of `type` land, ms from the start: with an attack of its own (not one that shoots) as that
 * attack's strikes come round, so the hut shakes as the blow lands on it; else on a steady beat.
 */
export function sackBlows(type: string): number[] {
  const attack = UNIT_ANIMS[type]?.attack;
  const out: number[] = [];
  const [first, every] = attack && !attack.shot ? [sum(attack.ms.slice(0, attack.impact)), sum(attack.ms)] : [SACK.firstMs, SACK.beatMs];
  for (let at = first; at <= SACK.blowsMs; at += every) out.push(at);
  return out;
}

/** When the hut starts to go down, ms from the start: a moment after the last blow. The unit cheers from then. */
export function sackFall(blows: readonly number[]): number {
  return (blows[blows.length - 1] ?? 0) + SACK.holdMs;
}

/** How long the whole show lasts, ms. */
export function sackLength(blows: readonly number[]): number {
  return sackFall(blows) + SACK.fallMs + SACK.settleMs;
}

/** What bursts out of a village that held `result`: coins for gold (more for more), a scroll for an advance, else nothing. */
export function sackLoot(result: HutResult): SackLoot {
  if (result.kind === "gold") return { kind: "coins", count: Math.max(4, Math.min(10, Math.round(2 + result.amount / 15))) };
  if (result.kind === "advance") return { kind: "scroll" };
  return null;
}

/**
 * How the hut stands `ms` into the show: shaken sideways (`shake`, -1..1 of the shake's reach), a jolt after each blow
 * dying away, and tottering as it goes; gone down (`down`, 0..1 of its height), slowly, then quicker.
 */
export function sackedHut(sack: Pick<Sacking, "blows" | "ms">): { shake: number; down: number } {
  let shake = 0;
  for (const b of sack.blows) {
    const u = (sack.ms - b) / SACK.shakeMs;
    if (u >= 0 && u < 1) shake += Math.sin(u * Math.PI * 3) * (1 - u);
  }
  const fall = (sack.ms - sackFall(sack.blows)) / SACK.fallMs;
  if (fall > 0 && fall < 1) shake += 0.5 * Math.sin(fall * Math.PI * 5) * (1 - fall);
  return { shake: Math.max(-1, Math.min(1, shake)), down: fall <= 0 ? 0 : Math.min(1, fall) ** 1.7 };
}

/**
 * How far the unit stands aside from the hut `ms` into the show, a share of its square: stepping to the side it came
 * from as the show begins, so the hut stands clear beside it as it strikes, and back to the middle as the dust settles.
 */
export function sackAside(sack: Pick<Sacking, "blows" | "ms">): number {
  const ease = (u: number) => 1 - (1 - Math.max(0, Math.min(1, u))) ** 2;
  const back = sackFall(sack.blows) + SACK.fallMs;
  return SACK.aside * (ease(sack.ms / SACK.asideMs) - ease((sack.ms - back) / SACK.settleMs));
}
