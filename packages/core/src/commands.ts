import { TERRAIN_RULES } from "./rules/terrain.js";
import { unitType } from "./rules/units.js";
import { getTile, type GameState, type Unit } from "./types.js";
import { applyMove, checkMove, fullMoves, unitById, workOptions } from "./units.js";
import { recomputeVisibility, revealAround } from "./visibility.js";

/**
 * Everything that changes a game comes through here as a Command. Human
 * input, the AI and replays all speak the same vocabulary, and a seed plus
 * the command log reproduces a game exactly.
 */
export type Command =
  | { type: "move"; unit: number; dx: number; dy: number }
  | { type: "fortify"; unit: number }
  | { type: "sentry"; unit: number }
  | { type: "skip"; unit: number } // space: done for this turn
  | { type: "wait"; unit: number } // w: come back to it later
  | { type: "work"; unit: number; work: "irrigate" | "mine" | "road" }
  | { type: "disband"; unit: number }
  | { type: "endTurn" };

export type CommandResult = { ok: true } | { ok: false; reason: string };

export function applyCommand(state: GameState, cmd: Command): CommandResult {
  if (cmd.type === "endTurn") {
    endTurn(state);
    return { ok: true };
  }
  const u = unitById(state, cmd.unit);
  if (!u) return { ok: false, reason: "no such unit" };
  if (u.owner !== state.currentPlayer) return { ok: false, reason: "not your unit" };

  switch (cmd.type) {
    case "move": {
      const r = checkMove(state, u, cmd.dx, cmd.dy);
      if (!r.ok) return { ok: false, reason: r.reason };
      applyMove(state, u, cmd.dx, cmd.dy, r.cost);
      revealAround(state, u.owner, u.x, u.y, unitType(u.type).sight);
      recomputeVisibility(state, u.owner);
      if (u.movesLeft === 0) selectNextUnit(state, u.id);
      return { ok: true };
    }
    case "fortify":
      if (unitType(u.type).domain !== "land") return { ok: false, reason: "only land units fortify" };
      u.order = { kind: "fortifying" };
      selectNextUnit(state, u.id);
      return { ok: true };
    case "sentry":
      u.order = { kind: "sentry" };
      selectNextUnit(state, u.id);
      return { ok: true };
    case "skip":
      u.movesLeft = 0;
      selectNextUnit(state, u.id);
      return { ok: true };
    case "wait":
      selectNextUnit(state, u.id, true);
      return { ok: true };
    case "work": {
      const opts = workOptions(state, u);
      const turns = opts[cmd.work];
      if (turns === undefined) return { ok: false, reason: `cannot ${cmd.work} here` };
      u.order = { kind: "work", work: cmd.work, turnsLeft: turns };
      u.movesLeft = 0;
      selectNextUnit(state, u.id);
      return { ok: true };
    }
    case "disband":
      state.units = state.units.filter((x) => x.id !== u.id);
      recomputeVisibility(state, u.owner);
      selectNextUnit(state, u.id);
      return { ok: true };
  }
}

/** A unit needs orders if it has moves and no standing order. */
export function needsOrders(u: Unit): boolean {
  return u.movesLeft > 0 && u.order.kind === "none";
}

/**
 * Pick the next unit awaiting orders for the current player, cycling from
 * `after`. With `wait`, the current unit stays eligible and is revisited last.
 */
export function selectNextUnit(state: GameState, after: number | null, wait = false): void {
  const mine = state.units.filter((u) => u.owner === state.currentPlayer && needsOrders(u));
  if (mine.length === 0) {
    state.activeUnit = null;
    return;
  }
  const start = after === null ? -1 : mine.findIndex((u) => u.id === after);
  for (let i = 1; i <= mine.length; i++) {
    const cand = mine[(start + i + mine.length) % mine.length]!;
    if (!wait || cand.id !== after || mine.length === 1) {
      state.activeUnit = cand.id;
      return;
    }
  }
  state.activeUnit = mine[0]!.id;
}

/** Wake a sentried unit when an enemy appears next to it (checked each turn start). */
function wakeSentries(state: GameState, player: number): void {
  for (const u of state.units) {
    if (u.owner !== player || u.order.kind !== "sentry") continue;
    // Enemy adjacency check reuses the ZOC helper via a tiny import cycle-free copy.
    const near = state.units.some(
      (o) => o.owner !== player && Math.abs(o.y - u.y) <= 1 && Math.min(Math.abs(o.x - u.x), state.map.width - Math.abs(o.x - u.x)) <= 1,
    );
    if (near) u.order = { kind: "none" };
  }
}

export function endTurn(state: GameState): void {
  const player = state.currentPlayer;

  // Settler work progresses at the end of the owner's turn.
  for (const u of state.units) {
    if (u.owner !== player) continue;
    if (u.order.kind === "fortifying") u.order = { kind: "fortified" };
    if (u.order.kind === "work") {
      u.order.turnsLeft--;
      if (u.order.turnsLeft <= 0) {
        const t = getTile(state.map, u.x, u.y)!;
        const rule = TERRAIN_RULES[t.terrain];
        if (u.order.work === "road") t.road = true;
        else if (u.order.work === "irrigate") {
          if (rule.irrigate?.becomes !== undefined) t.terrain = rule.irrigate.becomes;
          else t.irrigation = true;
          t.mine = false;
        } else if (u.order.work === "mine") {
          if (rule.mine?.becomes !== undefined) t.terrain = rule.mine.becomes;
          else t.mine = true;
          t.irrigation = false;
        }
        u.order = { kind: "none" };
      }
    }
  }

  // Single-player loop for now: the same player goes again. Other civs join
  // in phase 5, where this advances through players before incrementing turn.
  state.turn++;
  for (const u of state.units) if (u.owner === player) u.movesLeft = fullMoves(u);
  wakeSentries(state, player);
  recomputeVisibility(state, player);
  selectNextUnit(state, null);
}
