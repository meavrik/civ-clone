import { computeCity } from "./cities.js";
import { wonder } from "./rules/wonders.js";
import type { GameState } from "./types.js";

export interface ScoreBreakdown {
  citizens: number; // happy 2, content 1
  wonders: number;
  peace: number;
  techs: number;
  total: number;
}

/**
 * Score in the spirit of the original: citizens (happy count double),
 * wonders, peace bonus for turns without war, advances. Future techs and
 * pollution penalties can be added when those systems exist.
 */
export function computeScore(state: GameState, owner: number): ScoreBreakdown {
  let citizens = 0;
  let wonders = 0;
  for (const c of state.cities) {
    if (c.owner !== owner) continue;
    const r = computeCity(state, c);
    citizens += r.happy * 2 + r.content;
    wonders += c.wonders.filter((w) => wonder(w)).length * 20;
  }
  const p = state.players[owner]!;
  const atWarWithAnyone = Object.entries(state.relations).some(([k, v]) => v === "war" && k.split(":").map(Number).includes(owner));
  const peace = atWarWithAnyone ? 0 : 3;
  const techs = p.advances.length * 2;
  return { citizens, wonders, peace, techs, total: citizens + wonders + peace + techs };
}

/** Civilization-level rank string shown on the end screen. */
export function rankTitle(score: number): string {
  if (score >= 1000) return "Magnificent";
  if (score >= 600) return "Glorious";
  if (score >= 350) return "Great";
  if (score >= 200) return "Respected";
  if (score >= 100) return "Modest";
  return "Pathetic";
}

export type GameEnd =
  | { kind: "conquest"; winner: number }
  | { kind: "defeat" }
  | { kind: "time" }
  | null;

/** The game ends with one civ standing, the human eliminated, or 2100 AD. */
export function checkGameEnd(state: GameState, finalTurn: number): GameEnd {
  const alive = state.players.filter((p) => p.alive && p.id !== state.barbarians);
  if (!state.players[0]!.alive) return { kind: "defeat" };
  if (alive.length === 1) return { kind: "conquest", winner: alive[0]!.id };
  if (state.turn >= finalTurn) return { kind: "time" };
  return null;
}

/** 2100 AD on the original calendar. */
export const FINAL_TURN = 350 + (2100 - 850);
