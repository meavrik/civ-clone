import {
  autoAssignWorkers,
  buildOptions,
  buyCost,
  canFoundCity,
  cityById,
  foundCity,
  hasWonder,
  processCityTurn,
  productionCost,
  slotAvailable,
  type CityTurnEvent,
} from "./cities.js";
import { ADVANCE_BY_ID, advance, availableAdvances, researchCost } from "./rules/advances.js";
import { government, GOVERNMENTS } from "./rules/governments.js";
import { WONDERS } from "./rules/wonders.js";
import { TERRAIN_RULES } from "./rules/terrain.js";
import { unitType } from "./rules/units.js";
import { nextInt } from "./rng.js";
import { getTile, type GameState, type Player, type Production, type Specialist, type Unit } from "./types.js";
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
  | { type: "research"; advance: string }
  | { type: "revolution" }
  | { type: "setGovernment"; government: string }
  | { type: "endTurn" };

export type CommandResult = { ok: true } | { ok: false; reason: string };

export type TurnEvent =
  | CityTurnEvent
  | { kind: "discovered"; advance: string }
  | { kind: "chooseResearch" }
  | { kind: "anarchyOver" }
  | { kind: "chooseGovernment" };

/** Events raised by the last endTurn, for the UI to report. */
export const lastTurnEvents: TurnEvent[] = [];

export function applyCommand(state: GameState, cmd: Command): CommandResult {
  switch (cmd.type) {
    case "endTurn":
      endTurn(state);
      return { ok: true };
    case "setRates": {
      if (cmd.tax + cmd.lux + cmd.sci !== 10 || [cmd.tax, cmd.lux, cmd.sci].some((r) => r < 0)) return { ok: false, reason: "rates must sum to 100%" };
      const p = state.players[state.currentPlayer]!;
      const max = government(p.government).maxRate;
      if (cmd.tax > max || cmd.lux > max || cmd.sci > max) return { ok: false, reason: `max rate is ${max * 10}%` };
      p.taxRate = cmd.tax;
      p.luxRate = cmd.lux;
      p.sciRate = cmd.sci;
      return { ok: true };
    }
    case "research": {
      const p = state.players[state.currentPlayer]!;
      if (!availableAdvances(p.advances).some((a) => a.id === cmd.advance)) return { ok: false, reason: "cannot research that yet" };
      p.researching = cmd.advance;
      return { ok: true };
    }
    case "revolution": {
      const p = state.players[state.currentPlayer]!;
      if (p.government === "anarchy") return { ok: false, reason: "already in anarchy" };
      p.government = "anarchy";
      p.anarchyTurns = hasWonder(state, p.id, "pyramids") ? 0 : 1 + nextInt(state.rng, 4);
      p.pendingGovernment = null;
      clampRates(p);
      return { ok: true };
    }
    case "setGovernment": {
      const p = state.players[state.currentPlayer]!;
      if (p.government !== "anarchy" || p.anarchyTurns > 0) return { ok: false, reason: "not ready for a new government" };
      if (!governmentsAvailable(state, p.id).includes(cmd.government)) return { ok: false, reason: "government unknown" };
      p.government = cmd.government;
      clampRates(p);
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

/** Governments the player may choose: despotism always, others by advance (or all with the Pyramids). */
export function governmentsAvailable(state: GameState, owner: number): string[] {
  const p = state.players[owner]!;
  if (hasWonder(state, owner, "pyramids")) return Object.keys(GOVERNMENTS).filter((g) => g !== "anarchy");
  return Object.keys(GOVERNMENTS).filter((g) => {
    if (g === "anarchy") return false;
    if (g === "despotism") return true;
    const a = Object.values(ADVANCE_BY_ID).find((x) => x.government === g);
    return a ? p.advances.includes(a.id) : false;
  });
}

function clampRates(p: Player): void {
  const max = government(p.government).maxRate;
  p.taxRate = Math.min(p.taxRate, max);
  p.luxRate = Math.min(p.luxRate, max);
  p.sciRate = 10 - p.taxRate - p.luxRate;
  if (p.sciRate > max) {
    p.taxRate += p.sciRate - max;
    p.sciRate = max;
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

  // Research.
  const p = state.players[player]!;
  for (const ev of [...lastTurnEvents]) {
    if (ev.kind !== "wonder") continue;
    const w = WONDERS.find((x) => x.name === ev.detail);
    if (w?.effect.kind === "freeAdvances") {
      for (let i = 0; i < w.effect.amount; i++) {
        const next = p.researching && availableAdvances(p.advances).some((a) => a.id === p.researching) ? p.researching : availableAdvances(p.advances)[0]?.id;
        if (!next) break;
        discover(state, player, next);
        if (p.researching === next) p.researching = null;
      }
    }
    if (w?.effect.kind === "revealMap") p.explored.fill(1);
  }
  if (p.researching === null && p.science > 0 && availableAdvances(p.advances).length > 0) lastTurnEvents.push({ kind: "chooseResearch" });
  else if (p.researching !== null) {
    const cost = researchCost(p.advances.length, p.difficulty);
    if (p.science >= cost) {
      p.science -= cost;
      discover(state, player, p.researching);
      p.researching = null;
      lastTurnEvents.push({ kind: "chooseResearch" });
    }
  }

  // Anarchy countdown.
  if (p.government === "anarchy") {
    if (p.anarchyTurns > 0) p.anarchyTurns--;
    if (p.anarchyTurns === 0) lastTurnEvents.push({ kind: "chooseGovernment" });
  }

  // Single-player loop for now: the same player goes again. Other civs join
  // in phase 5, where this advances through players before incrementing turn.
  state.turn++;
  for (const u of state.units) if (u.owner === player) u.movesLeft = fullMoves(u);
  wakeSentries(state, player);
  recomputeVisibility(state, player);
  selectNextUnit(state, null);
}

/** Grant an advance, with its side effects (Darwin's free advances, government unlocks are read from data). */
export function discover(state: GameState, player: number, id: string): void {
  const p = state.players[player]!;
  if (p.advances.includes(id)) return;
  p.advances.push(id);
  lastTurnEvents.push({ kind: "discovered", advance: id });
  void advance(id);
}
