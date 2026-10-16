import {
  activeWonders,
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
import { maybeSpawnBarbarians } from "./barbarians.js";
import { captureCity, checkElimination, resolveCombat } from "./combat.js";
import { atWar, detectContacts, hasContact, setRelation } from "./diplomacy.js";
import { findPath, stepDir } from "./pathfind.js";
import { ADVANCE_BY_ID, ADVANCES, advance, availableAdvances, researchCost } from "./rules/advances.js";
import { government, GOVERNMENTS } from "./rules/governments.js";
import { WONDERS } from "./rules/wonders.js";
import { MOVE_FRAC, TERRAIN_RULES } from "./rules/terrain.js";
import { unitType } from "./rules/units.js";
import { nextInt } from "./rng.js";
import { getTile, NEIGHBOURS, Terrain, wrapX, type GameState, type Player, type Production, type Specialist, type Unit } from "./types.js";
import { applyMove, cargo, checkMove, createUnit, fullMoves, unitById, workOptions } from "./units.js";
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
  | { type: "goto"; unit: number; x: number; y: number }
  | { type: "activate"; unit: number }
  | { type: "declareWar"; player: number }
  | { type: "makePeace"; player: number }
  | { type: "giveGold"; player: number; amount: number }
  | { type: "giveAdvance"; player: number; advance: string }
  | { type: "exchangeAdvances"; player: number; give: string; receive: string }
  | { type: "endTurn" };

export type CommandResult = { ok: true } | { ok: false; reason: string };

export type TurnEvent =
  | CityTurnEvent
  | { kind: "discovered"; advance: string }
  | { kind: "chooseResearch" }
  | { kind: "anarchyOver" }
  | { kind: "chooseGovernment" }
  | { kind: "contact"; player: number }
  | { kind: "warDeclared"; player: number }
  | { kind: "cityLost"; name: string; player: number }
  | { kind: "cityCaptured"; name: string; player: number }
  | { kind: "unitLost"; unit: string; by: number }
  | { kind: "barbarians" }
  | { kind: "eliminated"; player: number }
  | { kind: "hut"; result: HutResult };

export type HutResult =
  | { kind: "gold"; amount: number }
  | { kind: "advance"; advance: string }
  | { kind: "unit"; unit: string }
  | { kind: "barbarians" }
  | { kind: "empty" };

/** Result of the last move command when it turned into combat (for the UI). */
export interface CombatReport {
  attackerWon: boolean;
  attackerType: string;
  defenderType: string;
  defenderOwner: number;
  x: number;
  y: number;
}
export let lastCombat: CombatReport | null = null;

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
      p.anarchyTurns = noAnarchy(state, p.id) ? 0 : 1 + nextInt(state.rng, 4);
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
    case "declareWar": {
      if (cmd.player === state.currentPlayer || !state.players[cmd.player]) return { ok: false, reason: "no such player" };
      setRelation(state, state.currentPlayer, cmd.player, "war");
      return { ok: true };
    }
    case "makePeace": {
      if (!hasContact(state, state.currentPlayer, cmd.player)) return { ok: false, reason: "no contact" };
      setRelation(state, state.currentPlayer, cmd.player, "peace");
      return { ok: true };
    }
    case "giveGold": {
      const me = state.players[state.currentPlayer]!;
      const them = state.players[cmd.player];
      if (!them || !hasContact(state, me.id, them.id)) return { ok: false, reason: "no contact" };
      if (cmd.amount <= 0 || cmd.amount > me.gold) return { ok: false, reason: "not enough gold" };
      me.gold -= cmd.amount;
      them.gold += cmd.amount;
      return { ok: true };
    }
    case "giveAdvance": {
      const me = state.players[state.currentPlayer]!;
      const them = state.players[cmd.player];
      if (!them || !hasContact(state, me.id, them.id)) return { ok: false, reason: "no contact" };
      if (!me.advances.includes(cmd.advance)) return { ok: false, reason: "we don't know that" };
      if (!them.advances.includes(cmd.advance)) them.advances.push(cmd.advance);
      return { ok: true };
    }
    case "exchangeAdvances": {
      const me = state.players[state.currentPlayer]!;
      const them = state.players[cmd.player];
      if (!them || !hasContact(state, me.id, them.id)) return { ok: false, reason: "no contact" };
      if (!me.advances.includes(cmd.give) || !them.advances.includes(cmd.receive)) return { ok: false, reason: "invalid exchange" };
      if (!them.advances.includes(cmd.give)) them.advances.push(cmd.give);
      discover(state, me.id, cmd.receive);
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
    case "move":
      return moveUnit(state, u, cmd.dx, cmd.dy);
    case "goto": {
      const path = findPath(state, u, cmd.x, cmd.y);
      if (!path) return { ok: false, reason: "no route" };
      u.order = { kind: "goto", x: wrapX(state.map, cmd.x), y: cmd.y };
      runGoto(state, u);
      if (u.order.kind === "goto" || u.movesLeft === 0) selectNextUnit(state, u.id);
      return { ok: true };
    }
    case "activate":
      u.order = { kind: "none" };
      if (u.movesLeft > 0) state.activeUnit = u.id;
      return { ok: true };
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

function moveUnit(state: GameState, u: Unit, dx: number, dy: number): CommandResult {
  lastCombat = null;
  const r = checkMove(state, u, dx, dy);
  if (!r.ok && r.reason === "attack") {
    const defenderOwner = state.units.find((o) => o.owner !== u.owner && o.x === wrapX(state.map, u.x + dx) && o.y === u.y + dy)!.owner;
    if (!atWar(state, u.owner, defenderOwner)) return { ok: false, reason: "treaty" };
    const c = resolveCombat(state, u, dx, dy);
    if ("error" in c) return { ok: false, reason: c.error };
    lastCombat = {
      attackerWon: c.attackerWon,
      attackerType: c.attacker.type,
      defenderType: c.defender.type,
      defenderOwner: c.defender.owner,
      x: wrapX(state.map, u.x + dx),
      y: u.y + dy,
    };
    if (!c.attackerWon) lastTurnEvents.push({ kind: "unitLost", unit: unitType(u.type).name, by: c.defender.owner });
    recomputeVisibility(state, u.owner);
    for (const id of c.destroyed) if (id === state.activeUnit) state.activeUnit = null;
    if (!state.units.includes(u) || u.movesLeft === 0) selectNextUnit(state, u.id);
    return { ok: true };
  }
  if (!r.ok) return { ok: false, reason: r.reason };
  if (r.enemyCity) {
    const city = state.cities.find((c) => c.x === wrapX(state.map, u.x + dx) && c.y === u.y + dy)!;
    if (!atWar(state, u.owner, city.owner)) return { ok: false, reason: "treaty" };
    if (unitType(u.type).domain !== "land") return { ok: false, reason: "only land units take cities" };
    const prevOwner = city.owner;
    const name = city.name;
    const cap = captureCity(state, u, city);
    lastTurnEvents.push(cap.captured ? { kind: "cityCaptured", name, player: prevOwner } : { kind: "cityLost", name, player: prevOwner });
    for (const dead of checkElimination(state)) lastTurnEvents.push({ kind: "eliminated", player: dead });
  }
  applyMove(state, u, dx, dy, r);
  revealAround(state, u.owner, u.x, u.y, unitType(u.type).sight);
  for (const c of cargo(state, u)) revealAround(state, u.owner, c.x, c.y, 1);
  enterHut(state, u);
  recomputeVisibility(state, u.owner);
  for (const met of detectContacts(state, u.owner)) lastTurnEvents.push({ kind: "contact", player: met });
  if (u.movesLeft === 0 || r.board !== undefined) selectNextUnit(state, u.id);
  return { ok: true };
}

/** Walk a goto order as far as this turn's moves allow. Stops on anything unexpected. */
export function runGoto(state: GameState, u: Unit): void {
  if (u.order.kind !== "goto") return;
  const { x, y } = u.order;
  if (u.x === x && u.y === y) { u.order = { kind: "none" }; return; }
  // Plan once per call: nothing but this unit moves while it walks; the next turn replans.
  const path = findPath(state, u, x, y);
  if (!path || path.length === 0) { u.order = { kind: "none" }; return; }
  for (const step of path) {
    if (u.order.kind !== "goto" || u.movesLeft <= 0) break;
    const [dx, dy] = stepDir(state, u, step);
    const r = checkMove(state, u, dx, dy);
    // An enemy unit or a foreign city in the way: stop and ask the player (an attack or a capture is their call).
    if (!r.ok || r.enemyCity) { u.order = { kind: "none" }; return; }
    const goal: Unit["order"] = u.order;
    applyMove(state, u, dx, dy, r);
    revealAround(state, u.owner, u.x, u.y, unitType(u.type).sight);
    enterHut(state, u);
    if (r.board !== undefined) return; // boarded: stay sentried on the ship
    u.order = goal; // applyMove clears standing orders
    if (u.x === x && u.y === y) { u.order = { kind: "none" }; break; }
  }
  recomputeVisibility(state, u.owner);
}

/** A land unit arriving on a village opens it, whether it walked or followed a goto. */
function enterHut(state: GameState, u: Unit): void {
  const landed = getTile(state.map, u.x, u.y)!;
  if (!landed.hut || unitType(u.type).domain !== "land") return;
  landed.hut = false;
  lastTurnEvents.push({ kind: "hut", result: openHut(state, u) });
}

/** Enter a minor tribe's village: gold, an advance, a mercenary unit, or an ambush. */
function openHut(state: GameState, u: Unit): HutResult {
  const p = state.players[u.owner]!;
  const roll = nextInt(state.rng, 100);
  const nearCity = state.cities.some((c) => Math.abs(c.y - u.y) <= 3 && Math.min(Math.abs(c.x - u.x), state.map.width - Math.abs(c.x - u.x)) <= 3);
  if (roll < 40) {
    const amount = 25 + nextInt(state.rng, 4) * 25;
    p.gold += amount;
    return { kind: "gold", amount };
  }
  if (roll < 60) {
    const options = availableAdvances(p.advances);
    if (options.length) {
      const a = options[nextInt(state.rng, options.length)]!.id;
      discover(state, u.owner, a);
      return { kind: "advance", advance: a };
    }
  }
  if (roll < 80) {
    const type = p.advances.includes("horseback_riding") ? "cavalry" : p.advances.includes("bronze_working") ? "phalanx" : "militia";
    createUnit(state, type, u.owner, u.x, u.y, u.homeCity);
    return { kind: "unit", unit: type };
  }
  if (roll < 90 && !nearCity && u.owner !== state.barbarians) {
    for (const [dx, dy] of NEIGHBOURS) {
      const t = getTile(state.map, u.x + dx, u.y + dy);
      if (!t || t.terrain === Terrain.Ocean) continue;
      if (state.units.some((o) => o.x === wrapX(state.map, u.x + dx) && o.y === u.y + dy)) continue;
      createUnit(state, "legion", state.barbarians, u.x + dx, u.y + dy);
      createUnit(state, "legion", state.barbarians, u.x + dx, u.y + dy);
      return { kind: "barbarians" };
    }
  }
  return { kind: "empty" };
}

/** A wonder that spares the owner anarchy (Pyramids, later the United Nations) also opens every government. */
export function noAnarchy(state: GameState, owner: number): boolean {
  return activeWonders(state, owner).some((w) => w.rule.effect.kind === "noAnarchy");
}

/** Governments the player may choose: despotism always, others by advance (or all with a no-anarchy wonder). */
export function governmentsAvailable(state: GameState, owner: number): string[] {
  const p = state.players[owner]!;
  if (noAnarchy(state, owner)) return Object.keys(GOVERNMENTS).filter((g) => g !== "anarchy");
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
  const p = state.players[player]!;
  lastTurnEvents.length = 0;
  lastCombat = null;

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
  for (const c of state.cities) if (c.owner === player) lastTurnEvents.push(...processCityTurn(state, c));
  for (const c of state.cities)
    if (c.owner === player && c.worked.length + c.specialists.length !== c.size) autoAssignWorkers(state, c);

  // Wonder side effects and research.
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
  // The Great Library hands over anything two other civilizations already know.
  if (activeWonders(state, player).some((w) => w.rule.effect.kind === "greatLibrary")) {
    const others = state.players.filter((o) => o.id !== player && o.alive && o.id !== state.barbarians);
    for (const a of ADVANCES) {
      if (p.advances.includes(a.id)) continue;
      if (others.filter((o) => o.advances.includes(a.id)).length < 2) continue;
      discover(state, player, a.id);
      if (p.researching === a.id) p.researching = null;
    }
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
  if (p.government === "anarchy") {
    if (p.anarchyTurns > 0) p.anarchyTurns--;
    if (p.anarchyTurns === 0) lastTurnEvents.push({ kind: "chooseGovernment" });
  }
  for (const dead of checkElimination(state)) lastTurnEvents.push({ kind: "eliminated", player: dead });

  // Next living player; a full round advances the calendar.
  // Barbarians only get a turn while they have units on the map.
  const takesTurn = (id: number) =>
    state.players[id]!.alive && (id !== state.barbarians || state.units.some((u) => u.owner === id));
  let next = player;
  let guard = 0;
  do next = (next + 1) % state.players.length;
  while (!takesTurn(next) && ++guard < state.players.length);
  if (next <= player) {
    state.turn++;
    const before = state.units.length;
    maybeSpawnBarbarians(state);
    if (state.units.length > before) lastTurnEvents.push({ kind: "barbarians" });
  }
  state.currentPlayer = next;
  startTurn(state, next);
}

/** Begin a player's turn: restore moves, continue gotos, wake sentries, pick the first unit. */
/** Movement points a unit starts its turn with: its type's, plus any wonder bonus for ships. */
export function moveAllowance(state: GameState, u: Unit): number {
  let moves = fullMoves(u);
  if (unitType(u.type).domain === "sea")
    for (const w of activeWonders(state, u.owner)) if (w.rule.effect.kind === "seaMoves") moves += w.rule.effect.amount * MOVE_FRAC;
  return moves;
}

export function startTurn(state: GameState, player: number): void {
  for (const u of state.units) if (u.owner === player) u.movesLeft = moveAllowance(state, u);
  wakeSentries(state, player);
  for (const u of state.units) if (u.owner === player && u.order.kind === "goto") runGoto(state, u);
  recomputeVisibility(state, player);
  for (const met of detectContacts(state, player)) lastTurnEvents.push({ kind: "contact", player: met });
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
