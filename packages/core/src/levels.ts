import { difficultyRule, type ComputerRule, type TemperRule } from "./rules/difficulty.js";
import { turnToYear } from "./calendar.js";
import type { GameState } from "./types.js";

/**
 * The rules a computer player plays with at its level (`DifficultyRule.computer`, since save version 47), or
 * null for a human player, the barbarians (and the city-states they hold) and a game before 47
 * (`evenDifficulty`), which play by the level's own (human) rules.
 */
export function computerRule(state: GameState, owner: number): ComputerRule | null {
  const p = state.players[owner];
  if (!p || !p.isAi || owner === state.barbarians || state.evenDifficulty) return null;
  return difficultyRule(p.difficulty).computer;
}

/**
 * From 1 AD, does a human player know more advances than every computer player? Then the computer players of a
 * level with a `spur` pay less and grow faster (`levelPct`), as the original's caught up with a leading human.
 */
export function leaderSpurred(state: GameState): boolean {
  if (turnToYear(state.turn) < 1) return false;
  let human = -1;
  let computer = -1;
  for (const p of state.players) {
    if (!p.alive || p.id === state.barbarians) continue;
    if (p.isAi) computer = Math.max(computer, p.advances.length);
    else human = Math.max(human, p.advances.length);
  }
  return human > computer && computer >= 0;
}

/** Percent of the rules' build cost (`kind` "cost") or food box ("food") `owner` pays at its level: 100 for a human player. */
export function levelPct(state: GameState, owner: number, kind: "cost" | "food"): number {
  const rule = computerRule(state, owner);
  if (!rule) return 100;
  return rule[kind] - (rule.spur > 0 && leaderSpurred(state) ? rule.spur : 0);
}

/** Beakers `player`'s next advance costs: the advances it knows, plus one, times its level's cost per advance. */
export function researchCostFor(state: GameState, player: number): number {
  const p = state.players[player]!;
  const per = computerRule(state, player)?.techCost ?? difficultyRule(p.difficulty).techCost;
  return (p.advances.length + 1) * per;
}

/** Citizens born content in `owner`'s cities at its level, before the empire's size counts. */
export function levelContent(state: GameState, owner: number): number {
  return computerRule(state, owner)?.content ?? difficultyRule(state.players[owner]!.difficulty).content;
}

/**
 * How computer leaders treat human player `human` (`TemperRule`): by the human's level, or Prince's in a game
 * before save version 47 (the planner's ways before levels counted).
 */
export function temperToward(state: GameState, human: number): TemperRule {
  return difficultyRule(state.evenDifficulty ? 2 : state.players[human]!.difficulty).computer.temper;
}
