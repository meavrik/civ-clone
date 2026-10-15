import {
  autoAssignWorkers,
  buildOptions,
  buyCost,
  canFoundCity,
  cityById,
  foundCity,
  processCityTurn,
  productionCost,
  slotAvailable,
  type CityTurnEvent,
} from "./cities.js";
import { TERRAIN_RULES } from "./rules/terrain.js";
import { unitType } from "./rules/units.js";
import { getTile, type GameState, type Production, type Specialist, type Unit } from "./types.js";
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
  | { type: "found"; unit: number; name?: string }
  | { type: "setProduction"; city: number; production: Production }
  | { type: "toggleTile"; city: number; slot: number }
  | { type: "setSpecialist"; city: number; index: number; specialist: Specialist }
  | { type: "buy"; city: number }
  | { type: "renameCity"; city: number; name: string }
  | { type: "setRates"; tax: number; lux: number; sci: number }
  | { type: "endTurn" };

export type CommandResult = { ok: true } | { ok: false; reason: string };

/** Events raised by the last endTurn, for the UI to report. */
export const lastTurnEvents: CityTurnEvent[] = [];

export function applyCommand(state: GameState, cmd: Command): CommandResult {
  switch (cmd.type) {
    case "endTurn":
      endTurn(state);
      return { ok: true };
    case "setRates": {
      if (cmd.tax + cmd.lux + cmd.sci !== 10 || [cmd.tax, cmd.lux, cmd.sci].some((r) => r < 0)) return { ok: false, reason: "rates must sum to 100%" };
      const p = state.players[state.currentPlayer]!;
      p.taxRate = cmd.tax;
      p.luxRate = cmd.lux;
      p.sciRate = cmd.sci;
      return { ok: true };
    }
    case "setProduction":
    case "toggleTile":
    case "setSpecialist":
    case "buy":
    case "renameCity":
      return applyCityCommand(state, cmd);
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
    case "found": {
      if (!unitType(u.type).flags?.includes("settler")) return { ok: false, reason: "only settlers found cities" };
      const why = canFoundCity(state, u.x, u.y);
      if (why) return { ok: false, reason: why };
      foundCity(state, u.owner, u.x, u.y, cmd.name);
      state.units = state.units.filter((x) => x.id !== u.id);
      recomputeVisibility(state, u.owner);
      selectNextUnit(state, u.id);
      return { ok: true };
    }
  }
}

function applyCityCommand(
  state: GameState,
  cmd: Extract<Command, { city: number }>,
): CommandResult {
  const city = cityById(state, cmd.city);
  if (!city) return { ok: false, reason: "no such city" };
  if (city.owner !== state.currentPlayer) return { ok: false, reason: "not your city" };
  switch (cmd.type) {
    case "setProduction": {
      const allowed = buildOptions(state, city).some((p) => p.kind === cmd.production.kind && p.id === cmd.production.id);
      if (!allowed) return { ok: false, reason: "cannot build that here" };
      // Switching between unit and improvement loses half the box, like the original.
      if (city.production.kind !== cmd.production.kind) city.shields = Math.floor(city.shields / 2);
      city.production = cmd.production;
      return { ok: true };
    }
    case "toggleTile": {
      const i = city.worked.indexOf(cmd.slot);
      if (i >= 0) {
        city.worked.splice(i, 1);
        city.specialists.push("entertainer");
        return { ok: true };
      }
      if (!slotAvailable(state, city, cmd.slot)) return { ok: false, reason: "tile unavailable" };
      if (city.specialists.length === 0) return { ok: false, reason: "no free citizen" };
      city.specialists.pop();
      city.worked.push(cmd.slot);
      return { ok: true };
    }
    case "setSpecialist": {
      if (cmd.index < 0 || cmd.index >= city.specialists.length) return { ok: false, reason: "no such specialist" };
      city.specialists[cmd.index] = cmd.specialist;
      return { ok: true };
    }
    case "buy": {
      const p = state.players[city.owner]!;
      const cost = buyCost(city);
      if (cost === 0) return { ok: false, reason: "already complete" };
      if (p.gold < cost) return { ok: false, reason: "not enough gold" };
      p.gold -= cost;
      city.shields = productionCost(city.production);
      return { ok: true };
    }
    case "renameCity":
      if (!cmd.name.trim()) return { ok: false, reason: "empty name" };
      city.name = cmd.name.trim().slice(0, 14);
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

/** Wake sentried units when an enemy comes adjacent (checked each turn start). */
function wakeSentries(state: GameState, player: number): void {
  for (const u of state.units) {
    if (u.owner !== player || u.order.kind !== "sentry") continue;
    const near = state.units.some(
      (o) =>
        o.owner !== player &&
        Math.abs(o.y - u.y) <= 1 &&
        Math.min(Math.abs(o.x - u.x), state.map.width - Math.abs(o.x - u.x)) <= 1,
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

  // Cities: growth, production, treasury.
  lastTurnEvents.length = 0;
  for (const c of state.cities) if (c.owner === player) lastTurnEvents.push(...processCityTurn(state, c));
  for (const c of state.cities)
    if (c.owner === player && c.worked.length + c.specialists.length !== c.size) autoAssignWorkers(state, c);

  // Single-player loop for now: the same player goes again. Other civs join
  // in phase 5, where this advances through players before incrementing turn.
  state.turn++;
  for (const u of state.units) if (u.owner === player) u.movesLeft = fullMoves(u);
  wakeSentries(state, player);
  recomputeVisibility(state, player);
  selectNextUnit(state, null);
}
