import { civ, type TraitEffect } from "./rules/civs.js";
import { unitType } from "./rules/units.js";
import type { GameState, WorkKind } from "./types.js";

/** The trait effects `owner` plays with: none for the barbarians, nor in a game with `classicCivs`. */
export function traitEffects(state: GameState, owner: number): TraitEffect[] {
  if (state.classicCivs || owner === state.barbarians) return [];
  return civ(state.players[owner]!.civ).trait?.effects ?? [];
}

/** Total of a percentage effect for `owner` (0 without one). */
export function traitPct(state: GameState, owner: number, kind: "sciencePct" | "taxPct" | "corruptionPct"): number {
  let pct = 0;
  for (const e of traitEffects(state, owner)) if (e.kind === kind) pct += e.pct;
  return pct;
}

/** Unhappy citizens the trait makes content in each of `owner`'s cities. */
export function traitContent(state: GameState, owner: number): number {
  let n = 0;
  for (const e of traitEffects(state, owner)) if (e.kind === "content") n += e.amount;
  return n;
}

/** Percentage change to the food box `owner`'s cities fill to grow (0 without the trait). */
export function traitFoodBoxPct(state: GameState, owner: number): number {
  let pct = 0;
  for (const e of traitEffects(state, owner)) if (e.kind === "foodBoxPct") pct += e.pct;
  return pct;
}

/** Share of the food box a growing city of `owner` keeps, from the trait (0 without one). */
export function traitGrowthKeep(state: GameState, owner: number): number {
  let keep = 0;
  for (const e of traitEffects(state, owner)) if (e.kind === "growth") keep = Math.max(keep, e.keep);
  return keep;
}

/** Does `owner` settle this job in half the time? */
export function traitFastWork(state: GameState, owner: number, work: WorkKind): boolean {
  return traitEffects(state, owner).some((e) => e.kind === "fastWork" && e.work.includes(work));
}

/** Do new units of this type come out veterans for `owner`? */
export function traitVeteran(state: GameState, owner: number, type: string): boolean {
  const t = unitType(type);
  return traitEffects(state, owner).some((e) => e.kind === "veteran" && (e.units?.includes(type) || e.domain === t.domain));
}

/** Extra squares of movement a unit of this type gets from `owner`'s trait. */
export function traitMoves(state: GameState, owner: number, type: string): number {
  const t = unitType(type);
  let n = 0;
  for (const e of traitEffects(state, owner)) if (e.kind === "moves" && (e.units?.includes(type) || e.domain === t.domain)) n += e.amount;
  return n;
}

/** The longest anarchy a revolution brings `owner`, or Infinity without the trait. */
export function traitAnarchyCap(state: GameState, owner: number): number {
  let cap = Infinity;
  for (const e of traitEffects(state, owner)) if (e.kind === "anarchy") cap = Math.min(cap, e.turns);
  return cap;
}

export function traitFriendlyVillages(state: GameState, owner: number): boolean {
  return traitEffects(state, owner).some((e) => e.kind === "friendlyVillages");
}
