import {
  activeWonders,
  autoAssignWorkers,
  buildOptions,
  buyCost,
  canFoundCity,
  costFor,
  canHelpWonder,
  canTradeRoute,
  cityAt,
  cityById,
  computeCity,
  foundCity,
  inciteCost,
  processCityTurn,
  routeBonus,
  sellPrice,
  whyNoSale,
  dropLostSquares,
  slotAvailable,
  arrangeCity,
  weakestWorked,
  type CityTurnEvent,
  shieldsAfterChange,
} from "./cities.js";
import { maybeSpawnBarbarians } from "./barbarians.js";
import { captureCity, checkElimination, resolveCombat } from "./combat.js";
import {
  atPeace,
  atWar,
  bordersOpen,
  clearTrespass,
  detectContacts,
  forgiveTrespass,
  hasContact,
  meetAround,
  metRelation,
  mindsTrespass,
  setBordersOpen,
  setRelation,
  trespassers,
  trespassOn,
  trespassRecord,
  warnTrespass,
} from "./diplomacy.js";
import { discoverExplored } from "./map/geography.js";
import { findPath, stepDir } from "./pathfind.js";
import { landOwner } from "./territory.js";
import { addTrade, endTrades, missingResources, settleTrades, whyNoTrade } from "./resources.js";
import { ADVANCE_BY_ID, advance, advancesFor, availableAdvances, researchCost } from "./rules/advances.js";
import { building } from "./rules/buildings.js";
import { government, GOVERNMENTS } from "./rules/governments.js";
import { WONDERS } from "./rules/wonders.js";
import { newSpaceship, shipStats } from "./rules/spaceship.js";
import { MOVE_FRAC, TERRAIN_RULES, WARMING_LIMIT, WARMING_THRESHOLD } from "./rules/terrain.js";
import { HEALING, unitType } from "./rules/units.js";
import { nextInt } from "./rng.js";
import { CITY_RADIUS, getTile, NEIGHBOURS, Terrain, wrapX, type City, type CityFocus, type GameState, type Player, type Production, type Specialist, type Unit, type WorkKind } from "./types.js";
import { FOCI } from "./rules/focus.js";
import { applyMove, attrition, cargo, checkMove, createUnit, fullMoves, lastActions, maxHp, unitById, whyNoWork, workOptions } from "./units.js";
import { traitAnarchyCap, traitFriendlyVillages, traitMoves } from "./traits.js";
import { recomputeVisibility, revealAround, unitSight } from "./visibility.js";

/**
 * Everything that changes a game comes through here as a Command. Human
 * input, the AI and replays all speak the same vocabulary, and a seed plus
 * the command log reproduces a game exactly.
 */
export type Command =
  | { type: "move"; unit: number; dx: number; dy: number }
  | { type: "fortify"; unit: number }
  | { type: "sentry"; unit: number }
  /** A wounded unit makes camp until healed (K): it heals as in a fortress, and wakes once whole or when anyone comes near. */
  | { type: "camp"; unit: number }
  | { type: "skip"; unit: number } // space: done for this turn
  | { type: "wait"; unit: number } // w: come back to it later
  | { type: "work"; unit: number; work: WorkKind }
  | { type: "disband"; unit: number }
  | { type: "home"; unit: number } // the city the unit stands in supports it from now on
  | { type: "pillage"; unit: number } // wreck the best improvement on the unit's square
  | { type: "found"; unit: number; name?: string }
  | { type: "setProduction"; city: number; production: Production }
  | { type: "toggleTile"; city: number; slot: number }
  | { type: "workTile"; city: number; slot: number; specialist?: number } // a free citizen (that specialist, else the last), else the worker on the weakest square, moves here
  | { type: "arrangeCity"; city: number } // every citizen on the best squares
  | { type: "setFocus"; city: number; focus: CityFocus } // what the city works its squares for, then arranged for it
  | { type: "setFoci"; city: number; foci: CityFocus[] } // any foci together (none: the old balance), then arranged for them
  | { type: "setSpecialist"; city: number; index: number; specialist: Specialist }
  | { type: "buy"; city: number }
  | { type: "sell"; city: number; building: string } // an improvement for its cost in gold, one a city a turn
  | { type: "renameCity"; city: number; name: string }
  | { type: "setRates"; tax: number; lux: number; sci: number }
  | { type: "research"; advance: string }
  | { type: "revolution" }
  | { type: "setGovernment"; government: string }
  | { type: "goto"; unit: number; x: number; y: number }
  | { type: "activate"; unit: number }
  | { type: "helpWonder"; unit: number } // caravan in a city building a wonder
  | { type: "tradeRoute"; unit: number } // caravan in a city far from its home
  | { type: "diplomat"; unit: number; action: DiplomatAction; x: number; y: number } // against the foreign city at (x, y) next door
  | { type: "declareWar"; player: number; reason?: "trespass" }
  | { type: "makePeace"; player: number } // a treaty, from war or from first contact (the other side's answer is the caller's to ask)
  | { type: "offerPeace"; player: number } // a computer leader proposes a treaty; `player` answers with makePeace or not at all
  | { type: "openBorders"; player: number } // both civilizations' units may cross each other's land
  | { type: "closeBorders"; player: number }
  | { type: "shareMaps"; player: number } // each side learns the land the other has explored
  | { type: "tribute"; player: number; amount: number } // `player` gives in to a demand and pays the current player
  | { type: "demandLeave"; player: number } // ask `player` to take its units off the current player's land
  | { type: "giveGold"; player: number; amount: number } // a gift; it also forgives their trespass so far
  | { type: "withdraw"; player: number } // `player`'s units on the current player's land each set off for the nearest square outside it (a leader who agreed to leave)
  | { type: "giveAdvance"; player: number; advance: string }
  | { type: "exchangeAdvances"; player: number; give: string; receive: string }
  | { type: "tradeResources"; player: number; give?: string; receive?: string } // we let `player` have `give`, it lets us have `receive`: a swap, a gift, or one bought (its gold given first)
  | { type: "endTrade"; player: number } // call off every resource trade with `player`
  | { type: "launch" } // the spaceship, once it can fly
  | { type: "cheat"; cheat: Cheat } // the debug menu; logged like any order so saves still replay
  | { type: "endTurn" };

export type DiplomatAction = "steal" | "sabotage" | "incite";

/** Debug menu actions, for the current player. */
export type Cheat = "revealMap" | "gold" | "research" | "allAdvances" | "production" | "moves" | "contact";

/** Gold handed over by the "gold" cheat. */
export const CHEAT_GOLD = 1000;

export type CommandResult = { ok: true } | { ok: false; reason: string };

export type TurnEvent =
  | CityTurnEvent
  | { kind: "discovered"; advance: string }
  | { kind: "chooseResearch" }
  | { kind: "anarchyOver" }
  | { kind: "chooseGovernment" }
  | { kind: "overthrown"; player: number } // riots went on too long under `player`'s Democracy: anarchy
  | { kind: "contact"; player: number }
  | { kind: "warDeclared"; player: number; on: number; reason?: "trespass" } // `player` declares war on `on`
  | { kind: "trespass"; player: number; intruder: number; unit: number; x: number; y: number; warnings: number } // `intruder`'s unit stepped onto `player`'s land
  | { kind: "leaveDemand"; player: number; to: number; warnings: number } // `player` asks `to` to leave its land
  | { kind: "peaceOffer"; player: number; to: number } // `player` offers `to` a peace treaty
  // `by` took `player`'s city: razed (`cityLost`) or held (`cityCaptured`, its id `cityId`), at (x, y), with
  // the gold carried off (`plunder`) and whether it was `player`'s capital, for the window that tells of it.
  | { kind: "cityLost"; name: string; player: number; by: number; x: number; y: number; plunder: number; capital: boolean }
  | { kind: "cityCaptured"; name: string; player: number; by: number; cityId: number; x: number; y: number; plunder: number; capital: boolean }
  | { kind: "unitLost"; unit: string; by: number }
  | { kind: "barbarians"; x: number; y: number; sea: boolean; near: string; player: number } // a band appeared near `player`'s city `near`
  | { kind: "ransom"; amount: number; player: number } // a barbarian leader caught alone
  | { kind: "eliminated"; player: number }
  | { kind: "hut"; result: HutResult; player: number }
  | { kind: "tradeRoute"; from: string; to: string; bonus: number }
  | { kind: "globalWarming" }
  | { kind: "spaceLaunched"; player: number }
  | { kind: "spaceArrived"; player: number }
  | { kind: "spaceLost"; player: number }
  | { kind: "spy"; action: DiplomatAction; detail: string; target: string }
  | { kind: "nuked"; x: number; y: number; by: number; stopped: boolean }
  // A trade of resources ended: `by` could no longer give its side, went to war, or called it off.
  | { kind: "tradeEnded"; a: number; b: number; give: string; take?: string; by: number; why: "lost" | "war" | "ended" };

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
  /** Hit points each side has left after the fight (0 for the loser). */
  attackerHp: number;
  defenderHp: number;
  attackerMaxHp: number;
  defenderMaxHp: number;
  /** The rank the winner rose to in the fight, if it rose. */
  promoted?: string;
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
      if (!availableAdvances(p.advances, advancesFor(state)).some((a) => a.id === cmd.advance)) return { ok: false, reason: "cannot research that yet" };
      p.researching = cmd.advance;
      return { ok: true };
    }
    case "revolution": {
      const p = state.players[state.currentPlayer]!;
      if (p.government === "anarchy") return { ok: false, reason: "already in anarchy" };
      fallIntoAnarchy(state, p);
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
    case "launch": {
      const p = state.players[state.currentPlayer]!;
      const st = shipStats(p.spaceship);
      if (!st.launchable) return { ok: false, reason: "the ship cannot fly yet" };
      p.spaceship.launched = state.turn;
      p.spaceship.arrives = state.turn + st.flightTurns;
      lastTurnEvents.push({ kind: "spaceLaunched", player: p.id });
      return { ok: true };
    }
    case "declareWar": {
      const me = state.currentPlayer;
      if (cmd.player === me || !state.players[cmd.player]) return { ok: false, reason: "no such player" };
      const already = atWar(state, me, cmd.player);
      setRelation(state, me, cmd.player, "war");
      setBordersOpen(state, me, cmd.player, false);
      forgiveTrespass(state, me, cmd.player);
      forgiveTrespass(state, cmd.player, me);
      if (!already) lastTurnEvents.push({ kind: "warDeclared", player: me, on: cmd.player, ...(cmd.reason ? { reason: cmd.reason } : {}) });
      for (const t of endTrades(state, me, cmd.player)) lastTurnEvents.push({ kind: "tradeEnded", ...t, by: me, why: "war" });
      return { ok: true };
    }
    case "makePeace": {
      if (!hasContact(state, state.currentPlayer, cmd.player)) return { ok: false, reason: "no contact" };
      setRelation(state, state.currentPlayer, cmd.player, "peace");
      return { ok: true };
    }
    case "offerPeace": {
      const me = state.currentPlayer;
      if (cmd.player === me || cmd.player === state.barbarians || !hasContact(state, me, cmd.player)) return { ok: false, reason: "no contact" };
      if (atPeace(state, me, cmd.player)) return { ok: false, reason: "already at peace" };
      (state.peaceOffers ??= {})[`${me}>${cmd.player}`] = state.turn;
      lastTurnEvents.push({ kind: "peaceOffer", player: me, to: cmd.player });
      return { ok: true };
    }
    case "openBorders": {
      const me = state.currentPlayer;
      if (cmd.player === me || !atPeace(state, me, cmd.player) || cmd.player === state.barbarians) return { ok: false, reason: "not at peace" };
      if (bordersOpen(state, me, cmd.player)) return { ok: false, reason: "borders already open" };
      setBordersOpen(state, me, cmd.player, true);
      forgiveTrespass(state, me, cmd.player);
      forgiveTrespass(state, cmd.player, me);
      return { ok: true };
    }
    case "closeBorders": {
      if (!bordersOpen(state, state.currentPlayer, cmd.player)) return { ok: false, reason: "borders not open" };
      setBordersOpen(state, state.currentPlayer, cmd.player, false);
      return { ok: true };
    }
    case "shareMaps": {
      const me = state.players[state.currentPlayer]!;
      const them = state.players[cmd.player];
      if (!them || them.id === me.id || !atPeace(state, me.id, them.id)) return { ok: false, reason: "not at peace" };
      for (let i = 0; i < me.explored.length; i++) {
        if (!me.explored[i] && !them.explored[i]) continue;
        me.explored[i] = 1;
        them.explored[i] = 1;
      }
      return { ok: true };
    }
    case "tribute": {
      const me = state.players[state.currentPlayer]!;
      const them = state.players[cmd.player];
      if (!them || them.id === me.id || !hasContact(state, me.id, them.id)) return { ok: false, reason: "no contact" };
      if (cmd.amount <= 0 || cmd.amount > them.gold) return { ok: false, reason: "they cannot pay that" };
      them.gold -= cmd.amount;
      me.gold += cmd.amount;
      (state.tributePaid ??= {})[`${them.id}>${me.id}`] = state.turn;
      return { ok: true };
    }
    case "demandLeave": {
      const me = state.currentPlayer;
      if (!trespassers(state, me, cmd.player).length) return { ok: false, reason: "no one trespasses" };
      const rec = warnTrespass(state, me, cmd.player);
      lastTurnEvents.push({ kind: "leaveDemand", player: me, to: cmd.player, warnings: rec.warnings });
      return { ok: true };
    }
    case "withdraw": {
      const me = state.currentPlayer;
      const theirs = trespassers(state, me, cmd.player);
      if (!theirs.length) return { ok: false, reason: "no one trespasses" };
      let sent = 0;
      for (const u of theirs) {
        const exit = exitSquare(state, u, me);
        if (!exit) continue;
        u.order = { kind: "goto", x: exit.x, y: exit.y };
        sent++;
      }
      if (!sent) return { ok: false, reason: "no way out" };
      forgiveTrespass(state, me, cmd.player);
      return { ok: true };
    }
    case "giveGold": {
      const me = state.players[state.currentPlayer]!;
      const them = state.players[cmd.player];
      if (!them || !hasContact(state, me.id, them.id)) return { ok: false, reason: "no contact" };
      if (cmd.amount <= 0 || cmd.amount > me.gold) return { ok: false, reason: "not enough gold" };
      me.gold -= cmd.amount;
      them.gold += cmd.amount;
      forgiveTrespass(state, them.id, me.id);
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
    case "tradeResources": {
      const me = state.currentPlayer;
      const why = whyNoTrade(state, me, cmd.player, cmd.give, cmd.receive);
      if (why) return { ok: false, reason: why };
      if (cmd.give) addTrade(state, me, cmd.player, cmd.give, cmd.receive);
      else addTrade(state, cmd.player, me, cmd.receive!);
      return { ok: true };
    }
    case "endTrade": {
      const ended = endTrades(state, state.currentPlayer, cmd.player);
      if (!ended.length) return { ok: false, reason: "no trade" };
      for (const t of ended) lastTurnEvents.push({ kind: "tradeEnded", ...t, by: state.currentPlayer, why: "ended" });
      return { ok: true };
    }
    case "cheat":
      return applyCheat(state, cmd.cheat);
    case "setProduction":
    case "toggleTile":
    case "workTile":
    case "arrangeCity":
    case "setFocus":
    case "setFoci":
    case "setSpecialist":
    case "buy":
    case "sell":
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
      runGoto(state, u, path);
      if (u.order.kind === "goto" || u.movesLeft === 0) selectNextUnit(state, u.id);
      return { ok: true };
    }
    case "activate":
      u.order = { kind: "none" };
      if (u.movesLeft > 0) state.activeUnit = u.id;
      return { ok: true };
    case "fortify":
      if (unitType(u.type).domain !== "land") return { ok: false, reason: "only land units fortify" };
      // Settlers never fortify (their F builds a fortress), as in the original; old saves let them.
      if (unitType(u.type).flags?.includes("settler") && !state.looseSettlers) return { ok: false, reason: "settlers do not fortify" };
      u.order = { kind: "fortifying" };
      selectNextUnit(state, u.id);
      return { ok: true };
    case "sentry":
      u.order = { kind: "sentry" };
      selectNextUnit(state, u.id);
      return { ok: true };
    case "camp": {
      const why = whyNoCamp(state, u);
      if (why) return { ok: false, reason: why };
      u.order = { kind: "camp" };
      selectNextUnit(state, u.id);
      return { ok: true };
    }
    case "home": {
      const c = cityAt(state, u.x, u.y);
      if (!c || c.owner !== u.owner) return { ok: false, reason: "not in our city" };
      if (u.homeCity === c.id) return { ok: false, reason: "already home" };
      u.homeCity = c.id;
      return { ok: true };
    }
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
      if (turns === undefined) return { ok: false, reason: whyNoWork(state, u, cmd.work) ?? `cannot ${cmd.work} here` };
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
    case "pillage": {
      const what = pillageTarget(state, u);
      if (!what) return { ok: false, reason: "nothing to pillage" };
      if (u.movesLeft <= 0) return { ok: false, reason: "no-moves" };
      getTile(state.map, u.x, u.y)![what] = false;
      u.movesLeft = 0;
      u.order = { kind: "none" };
      selectNextUnit(state, u.id);
      return { ok: true };
    }
    case "helpWonder": {
      const city = cityAt(state, u.x, u.y);
      if (!city) return { ok: false, reason: "not in a city" };
      const why = canHelpWonder(state, u, city);
      if (why) return { ok: false, reason: why };
      city.shields += unitType(u.type).cost;
      removeUnit(state, u);
      return { ok: true };
    }
    case "tradeRoute": {
      const city = cityAt(state, u.x, u.y);
      if (!city) return { ok: false, reason: "not in a city" };
      return establishRoute(state, u, city);
    }
    case "diplomat":
      return spy(state, u, cmd.action, cmd.x, cmd.y);
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
  if (unitType(u.type).flags?.includes("nuclear")) {
    const tx = wrapX(state.map, u.x + dx);
    const ty = u.y + dy;
    const hostile = state.units.some((o) => o.owner !== u.owner && o.x === tx && o.y === ty) || state.cities.some((c) => c.owner !== u.owner && c.x === tx && c.y === ty);
    if (hostile) return detonate(state, u, tx, ty);
  }
  // A diplomat at a foreign gate, guarded or not, acts through the diplomat command: it never
  // walks in or fights. Barbarians keep nothing worth a diplomat's while.
  if (unitType(u.type).flags?.includes("diplomat") && u.movesLeft > 0) {
    const gate = cityAt(state, wrapX(state.map, u.x + dx), u.y + dy);
    if (gate && gate.owner !== u.owner) return { ok: false, reason: gate.owner === state.barbarians ? "barbarian city" : "diplomat" };
  }
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
      attackerHp: c.attacker.hp,
      defenderHp: c.defender.hp,
      attackerMaxHp: maxHp(state, c.attacker.type),
      defenderMaxHp: maxHp(state, c.defender.type),
      ...(c.promoted ? { promoted: c.promoted.name } : {}),
    };
    if (!c.attackerWon) lastTurnEvents.push({ kind: "unitLost", unit: unitType(u.type).name, by: c.defender.owner });
    if (c.ransom) lastTurnEvents.push({ kind: "ransom", amount: c.ransom, player: u.owner });
    recomputeVisibility(state, u.owner);
    for (const id of c.destroyed) if (id === state.activeUnit) state.activeUnit = null;
    if (!state.units.includes(u) || u.movesLeft === 0) selectNextUnit(state, u.id);
    return { ok: true };
  }
  if (!r.ok) return { ok: false, reason: r.reason };
  if (r.enemyCity) {
    const city = state.cities.find((c) => c.x === wrapX(state.map, u.x + dx) && c.y === u.y + dy)!;
    if (!atWar(state, u.owner, city.owner)) {
      // A caravan calling at a peaceful foreign city opens a trade route instead of entering.
      if (unitType(u.type).flags?.includes("caravan")) return establishRoute(state, u, city);
      return { ok: false, reason: "treaty" };
    }
    if (unitType(u.type).domain !== "land") return { ok: false, reason: "only land units take cities" };
    const prevOwner = city.owner;
    const { name, id, x, y } = city;
    const capital = city.buildings.includes("palace");
    const cap = captureCity(state, u, city);
    const taken = { name, player: prevOwner, by: u.owner, x, y, plunder: cap.plunder, capital };
    lastTurnEvents.push(cap.captured ? { kind: "cityCaptured", cityId: id, ...taken } : { kind: "cityLost", ...taken });
    if (cap.shipLost) lastTurnEvents.push({ kind: "spaceLost", player: prevOwner });
    for (const dead of checkElimination(state)) lastTurnEvents.push({ kind: "eliminated", player: dead });
    // The city's land, and the sight of it, leaves its old owner at once.
    if (state.players[prevOwner]?.alive && !state.narrowSight) recomputeVisibility(state, prevOwner);
  }
  const wasOn = trespassOn(state, u);
  applyMove(state, u, dx, dy, r);
  revealAround(state, u.owner, u.x, u.y, unitSight(state, u));
  for (const c of cargo(state, u)) revealAround(state, u.owner, c.x, c.y, 1);
  enterHut(state, u);
  recomputeVisibility(state, u.owner);
  noteTrespass(state, u, wasOn);
  const met = detectContacts(state, u.owner);
  for (const id of met) lastTurnEvents.push({ kind: "contact", player: id });
  // Meeting a new civilization stops the unit there for the turn, so both sides see whom they met.
  if (met.length && !state.farContact) u.movesLeft = 0;
  if (u.movesLeft === 0 || r.board !== undefined) selectNextUnit(state, u.id);
  return { ok: true };
}

/**
 * A unit just stepped onto the land of a civilization that minds it (at peace,
 * no open borders): that civilization asks its owner to leave. The first
 * step in counts as their first warning; the UI hears of every entry.
 */
function noteTrespass(state: GameState, u: Unit, wasOn: number): void {
  const on = trespassOn(state, u);
  if (on < 0 || on === wasOn) return;
  const rec = trespassRecord(state, on, u.owner) ?? warnTrespass(state, on, u.owner);
  lastTurnEvents.push({ kind: "trespass", player: on, intruder: u.owner, unit: u.id, x: u.x, y: u.y, warnings: rec.warnings });
}

/** Open a route from the caravan's home city to `city`, paying the one-off bonus; the caravan is spent. */
function establishRoute(state: GameState, u: Unit, city: City): CommandResult {
  const why = canTradeRoute(state, u, city);
  if (why) return { ok: false, reason: why };
  const home = cityById(state, u.homeCity!)!;
  const bonus = routeBonus(state, home, city);
  home.routes.push(city.id);
  city.routes.push(home.id);
  const p = state.players[u.owner]!;
  p.gold += bonus;
  p.science += bonus;
  lastTurnEvents.push({ kind: "tradeRoute", from: home.name, to: city.name, bonus });
  removeUnit(state, u);
  return { ok: true };
}

/**
 * A diplomat next to a foreign city steals an advance, wrecks its production
 * or an improvement, or buys the city outright. The diplomat is spent, and
 * a victim at peace takes it as an act of war.
 */
function spy(state: GameState, u: Unit, action: DiplomatAction, x: number, y: number): CommandResult {
  if (!unitType(u.type).flags?.includes("diplomat")) return { ok: false, reason: "only diplomats do that" };
  if (u.movesLeft <= 0) return { ok: false, reason: "no moves left" };
  const city = cityAt(state, x, y);
  if (!city || city.owner === u.owner || city.owner === state.barbarians) return { ok: false, reason: "no foreign city there" };
  const dx = Math.abs(city.x - u.x);
  if (Math.min(dx, state.map.width - dx) > 1 || Math.abs(city.y - u.y) > 1) return { ok: false, reason: "not next to the city" };
  const me = state.players[u.owner]!;
  const victim = state.players[city.owner]!;
  let detail: string;
  switch (action) {
    case "steal": {
      const options = victim.advances.filter((a) => !me.advances.includes(a));
      if (options.length === 0) return { ok: false, reason: "they know nothing we do not" };
      const a = options[nextInt(state.rng, options.length)]!;
      discover(state, me.id, a);
      detail = advance(a).name;
      break;
    }
    case "sabotage": {
      const targets = city.buildings.filter((b) => b !== "palace");
      if (targets.length > 0 && nextInt(state.rng, 2) === 0) {
        const b = targets[nextInt(state.rng, targets.length)]!;
        city.buildings = city.buildings.filter((id) => id !== b);
        detail = building(b).name;
      } else {
        city.shields = 0;
        detail = "production";
      }
      break;
    }
    case "incite": {
      const cost = inciteCost(state, city);
      if (!Number.isFinite(cost)) return { ok: false, reason: "a capital cannot be bought" };
      if (me.gold < cost) return { ok: false, reason: `it would cost ${cost} gold` };
      me.gold -= cost;
      city.owner = me.id;
      city.disorder = false;
      city.unrest = 0;
      city.celebrating = false;
      for (const o of state.units) if (o.owner === victim.id && o.x === city.x && o.y === city.y) o.owner = me.id;
      for (const dead of checkElimination(state)) lastTurnEvents.push({ kind: "eliminated", player: dead });
      detail = city.name;
      break;
    }
  }
  if (victim.alive && !atWar(state, me.id, victim.id)) {
    setRelation(state, me.id, victim.id, "war");
    setBordersOpen(state, me.id, victim.id, false);
    forgiveTrespass(state, me.id, victim.id);
    forgiveTrespass(state, victim.id, me.id);
    lastTurnEvents.push({ kind: "warDeclared", player: victim.id, on: me.id });
  }
  lastTurnEvents.push({ kind: "spy", action, detail, target: city.name });
  removeUnit(state, u);
  recomputeVisibility(state, me.id);
  // A city bought away takes its land, and the sight of it, from its old owner at once.
  if (action === "incite" && victim.alive && !state.narrowSight) recomputeVisibility(state, victim.id);
  return { ok: true };
}

/**
 * A nuclear strike on (x, y): every unit within one tile dies, a city there
 * loses half its people, and the land is left with fallout. A city with
 * SDI Defense within three tiles shoots the missile down. Needs a war.
 */
function detonate(state: GameState, u: Unit, x: number, y: number): CommandResult {
  const owners = new Set<number>();
  for (const o of state.units) if (o.x === x && o.y === y) owners.add(o.owner);
  for (const c of state.cities) if (c.x === x && c.y === y) owners.add(c.owner);
  for (const owner of owners) if (owner !== u.owner && !atWar(state, u.owner, owner)) return { ok: false, reason: "treaty" };
  const shielded = state.cities.some((c) => c.owner !== u.owner && c.buildings.includes("sdi_defense") && Math.abs(c.y - y) <= 3 && Math.min(Math.abs(c.x - x), state.map.width - Math.abs(c.x - x)) <= 3);
  if (shielded) {
    lastTurnEvents.push({ kind: "nuked", x, y, by: u.owner, stopped: true });
    removeUnit(state, u);
    return { ok: true };
  }
  const dead = new Set<number>();
  for (const o of state.units) {
    if (o.id === u.id) continue;
    const ddx = Math.abs(o.x - x);
    if (Math.min(ddx, state.map.width - ddx) <= 1 && Math.abs(o.y - y) <= 1) dead.add(o.id);
  }
  for (const id of [...dead]) for (const o of state.units) if (o.aboard === id) dead.add(o.id);
  state.units = state.units.filter((o) => !dead.has(o.id) && o.id !== u.id);
  const city = cityAt(state, x, y);
  if (city) {
    city.size = Math.max(1, Math.floor(city.size / 2));
    autoAssignWorkers(state, city);
  }
  for (const [ddx, ddy] of [[0, 0], ...NEIGHBOURS] as const) {
    const t = getTile(state.map, x + ddx, y + ddy);
    if (t && t.terrain !== Terrain.Ocean) t.pollution = true;
  }
  lastTurnEvents.push({ kind: "nuked", x, y, by: u.owner, stopped: false });
  for (const dead of checkElimination(state)) lastTurnEvents.push({ kind: "eliminated", player: dead });
  for (const p of state.players) if (p.alive) recomputeVisibility(state, p.id);
  if (state.activeUnit !== null && !state.units.some((o) => o.id === state.activeUnit)) state.activeUnit = null;
  selectNextUnit(state, u.id);
  return { ok: true };
}

/** What a pillage order would wreck on a land soldier's square, the most valuable first; null when nothing is there or it stands in a city. */
export function pillageTarget(state: GameState, u: Unit): "irrigation" | "mine" | "railroad" | "road" | "fortress" | null {
  const type = unitType(u.type);
  if (type.domain !== "land" || type.attack === 0 || u.aboard !== null || cityAt(state, u.x, u.y)) return null;
  const t = getTile(state.map, u.x, u.y)!;
  if (t.irrigation) return "irrigation";
  if (t.mine) return "mine";
  if (t.railroad) return "railroad";
  if (t.road) return "road";
  if (t.fortress) return "fortress";
  return null;
}

/** A unit is spent (disbanded, consumed): drop it and move on to the next one. */
function removeUnit(state: GameState, u: Unit): void {
  state.units = state.units.filter((x) => x.id !== u.id);
  recomputeVisibility(state, u.owner);
  selectNextUnit(state, u.id);
}

/** Walk a goto order as far as this turn's moves allow. Stops on anything unexpected. */
/**
 * The nearest land square outside `owner`'s land (and any other land that minds `u`'s civilization)
 * that unit `u` can walk to, searching ring by ring to eight squares out; null when none. Where a unit
 * asked off someone's land goes: the player's own units (`withdraw` in the web app) and a computer
 * leader's after agreeing to the player's demand (the `withdraw` command).
 */
export function exitSquare(state: GameState, u: Unit, owner: number): { x: number; y: number } | null {
  for (let r = 1; r <= 8; r++) {
    let best: { x: number; y: number } | null = null;
    let steps = Infinity;
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const x = wrapX(state.map, u.x + dx);
        const y = u.y + dy;
        const t = getTile(state.map, x, y);
        if (!t || t.terrain === Terrain.Ocean) continue;
        const land = landOwner(state, x, y);
        if (land === owner || (land >= 0 && mindsTrespass(state, land, u.owner))) continue;
        const city = cityAt(state, x, y);
        if ((city && city.owner !== u.owner) || state.units.some((o) => o.x === x && o.y === y && o.owner !== u.owner)) continue;
        const path = findPath(state, u, x, y);
        if (path && path.length < steps) { best = { x, y }; steps = path.length; }
      }
    if (best) return best;
  }
  return null;
}

export function runGoto(state: GameState, u: Unit, planned?: [number, number][]): void {
  if (u.order.kind !== "goto") return;
  const { x, y } = u.order;
  if (u.x === x && u.y === y) { u.order = { kind: "none" }; return; }
  // Plan once per call: nothing but this unit moves while it walks; the next turn replans.
  // A goto just validated by the command passes its path in, so it is not searched twice.
  const path = planned ?? findPath(state, u, x, y);
  if (!path || path.length === 0) { u.order = { kind: "none" }; return; }
  for (const step of path) {
    if (u.order.kind !== "goto" || u.movesLeft <= 0) break;
    const [dx, dy] = stepDir(state, u, step);
    const r = checkMove(state, u, dx, dy);
    // An enemy unit or a foreign city in the way: stop and ask the player (an attack or a capture is their call).
    if (!r.ok || r.enemyCity) { u.order = { kind: "none" }; return; }
    const goal: Unit["order"] = u.order;
    const wasOn = trespassOn(state, u);
    applyMove(state, u, dx, dy, r);
    revealAround(state, u.owner, u.x, u.y, unitSight(state, u));
    enterHut(state, u);
    if (r.board !== undefined) return; // boarded: stay sentried on the ship
    u.order = goal; // applyMove clears standing orders
    noteTrespass(state, u, wasOn);
    const met = state.farContact ? [] : meetAround(state, u);
    for (const id of met) lastTurnEvents.push({ kind: "contact", player: id });
    if (u.x === x && u.y === y) { u.order = { kind: "none" }; break; }
    if (met.length) { u.movesLeft = 0; break; } // the meeting stops it here; the walk goes on next turn
  }
  recomputeVisibility(state, u.owner);
}

/** A land unit arriving on a village opens it, whether it walked or followed a goto. */
function enterHut(state: GameState, u: Unit): void {
  const landed = getTile(state.map, u.x, u.y)!;
  if (!landed.hut || unitType(u.type).domain !== "land") return;
  landed.hut = false;
  lastTurnEvents.push({ kind: "hut", result: openHut(state, u), player: u.owner });
}

/** Enter a minor tribe's village: gold, an advance, a mercenary unit, or an ambush. */
function openHut(state: GameState, u: Unit): HutResult {
  const p = state.players[u.owner]!;
  const roll = nextInt(state.rng, 100);
  const nearCity = state.cities.some((c) => Math.abs(c.y - u.y) <= 3 && Math.min(Math.abs(c.x - u.x), state.map.width - Math.abs(c.x - u.x)) <= 3);
  if (roll < 40) {
    const amount = (25 + nextInt(state.rng, 4) * 25) * (traitFriendlyVillages(state, u.owner) ? 2 : 1);
    p.gold += amount;
    return { kind: "gold", amount };
  }
  if (roll < 60) {
    const options = availableAdvances(p.advances, advancesFor(state));
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
  if (roll < 90 && !nearCity && u.owner !== state.barbarians && !traitFriendlyVillages(state, u.owner)) {
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

/** The government falls: anarchy for a few turns (none with a wonder that spares them), the rates clamped. */
export function fallIntoAnarchy(state: GameState, p: GameState["players"][number]): void {
  p.government = "anarchy";
  p.anarchyTurns = noAnarchy(state, p.id) ? 0 : Math.min(traitAnarchyCap(state, p.id), 1 + nextInt(state.rng, 4));
  p.pendingGovernment = null;
  clampRates(p);
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
      // Switching between unit and improvement loses half the box, like the original (see `shieldsAfterChange`).
      // A box not yet recorded for this turn (a city founded this turn) counts as it stands.
      if (city.turnShields === undefined || city.turnKind === undefined) {
        city.turnShields = city.shields;
        city.turnKind = city.production.kind;
      }
      city.shields = shieldsAfterChange(state, city, cmd.production);
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
    case "workTile": {
      if (city.worked.includes(cmd.slot)) return { ok: false, reason: "already worked" };
      if (!slotAvailable(state, city, cmd.slot)) return { ok: false, reason: "tile unavailable" };
      if (city.specialists.length > 0) {
        const who = cmd.specialist ?? city.specialists.length - 1;
        if (!Number.isInteger(who) || who < 0 || who >= city.specialists.length) return { ok: false, reason: "no such specialist" };
        city.specialists.splice(who, 1);
        city.worked.push(cmd.slot);
        return { ok: true };
      }
      const weakest = weakestWorked(state, city);
      if (weakest === undefined) return { ok: false, reason: "no free citizen" };
      city.worked[city.worked.indexOf(weakest)] = cmd.slot;
      return { ok: true };
    }
    case "arrangeCity":
      arrangeCity(state, city);
      return { ok: true };
    case "setFocus":
      if (state.balancedWorkers) return { ok: false, reason: "no focus in this game" };
      if (!FOCI.some((f) => f.id === cmd.focus)) return { ok: false, reason: "no such focus" };
      city.focus = cmd.focus;
      arrangeCity(state, city);
      return { ok: true };
    case "setFoci": {
      if (state.balancedWorkers) return { ok: false, reason: "no focus in this game" };
      if (!cmd.foci.every((id) => FOCI.some((f) => f.id === id))) return { ok: false, reason: "no such focus" };
      city.foci = FOCI.filter((f) => cmd.foci.includes(f.id)).map((f) => f.id);
      delete city.focus;
      arrangeCity(state, city);
      return { ok: true };
    }
    case "setSpecialist": {
      if (cmd.index < 0 || cmd.index >= city.specialists.length) return { ok: false, reason: "no such specialist" };
      city.specialists[cmd.index] = cmd.specialist;
      return { ok: true };
    }
    case "buy": {
      const p = state.players[city.owner]!;
      const cost = buyCost(state, city);
      if (cost === 0) return { ok: false, reason: "already complete" };
      if (city.production.kind === "unit") {
        const missing = missingResources(state, city.owner, city.production.id);
        if (missing.length) return { ok: false, reason: `needs:${missing.join(",")}` };
      }
      if (p.gold < cost) return { ok: false, reason: "not enough gold" };
      p.gold -= cost;
      city.shields = costFor(state, city.owner, city.production);
      // Bought shields are the box a change of production is reckoned from.
      city.turnShields = city.shields;
      city.turnKind = city.production.kind;
      return { ok: true };
    }
    case "sell": {
      const why = whyNoSale(state, city, cmd.building);
      if (why) return { ok: false, reason: why };
      state.players[city.owner]!.gold += sellPrice(state, city, cmd.building);
      city.buildings = city.buildings.filter((b) => b !== cmd.building);
      city.soldOn = state.turn;
      // Less culture may pull the border in: its workers leave the squares it no longer holds.
      dropLostSquares(state, city);
      return { ok: true };
    }
    case "renameCity":
      if (!cmd.name.trim()) return { ok: false, reason: "empty name" };
      city.name = cmd.name.trim().slice(0, 14);
      return { ok: true };
  }
}

function applyCheat(state: GameState, cheat: Cheat): CommandResult {
  const p = state.players[state.currentPlayer]!;
  switch (cheat) {
    case "revealMap":
      p.explored.fill(1);
      discoverExplored(state, p.id);
      return { ok: true };
    case "gold":
      p.gold += CHEAT_GOLD;
      return { ok: true };
    case "research": {
      const id = p.researching ?? availableAdvances(p.advances, advancesFor(state))[0]?.id;
      if (id === undefined) return { ok: false, reason: "nothing left to learn" };
      discover(state, p.id, id);
      p.researching = null;
      lastTurnEvents.push({ kind: "chooseResearch" });
      return { ok: true };
    }
    case "allAdvances":
      // Straight into the list: one discovery screen per advance would be a long evening.
      for (const a of advancesFor(state)) if (!p.advances.includes(a.id)) p.advances.push(a.id);
      p.researching = null;
      return { ok: true };
    case "production":
      for (const c of state.cities) if (c.owner === p.id) c.shields = Math.max(c.shields, costFor(state, c.owner, c.production));
      return { ok: true };
    case "moves":
      for (const u of state.units) {
        if (u.owner !== p.id) continue;
        u.movesLeft = moveAllowance(state, u);
        u.hp = maxHp(state, u.type);
      }
      if (state.activeUnit === null) selectNextUnit(state, null);
      return { ok: true };
    case "contact":
      for (const o of state.players)
        if (o.id !== p.id && o.alive && o.id !== state.barbarians && !hasContact(state, p.id, o.id)) setRelation(state, p.id, o.id, metRelation(state));
      return { ok: true };
  }
}

/** Why a unit cannot make camp to heal, or null when it can: it must be wounded, and aircraft land to mend. */
export function whyNoCamp(state: GameState, u: Unit): string | null {
  if (unitType(u.type).domain === "air") return "aircraft cannot camp";
  if (u.hp >= maxHp(state, u.type)) return "not wounded";
  return null;
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

/** Wake sentried and camped units when an enemy comes adjacent, and camped ones once healed (checked each turn start). */
function wakeSentries(state: GameState, player: number): void {
  for (const u of state.units) {
    if (u.owner !== player || (u.order.kind !== "sentry" && u.order.kind !== "camp")) continue;
    if (u.order.kind === "camp" && u.hp >= maxHp(state, u.type)) { u.order = { kind: "none" }; continue; }
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
  lastActions.length = 0;

  // Units that spent the whole turn without moving recover hit points; harsh ground away from home wears them down instead.
  for (const u of state.units) if (u.owner === player && !wearDown(state, u)) heal(state, u);

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
        else if (u.order.work === "railroad") t.railroad = true;
        else if (u.order.work === "fortress") t.fortress = true;
        else if (u.order.work === "clean") t.pollution = false;
        else if (u.order.work === "irrigate") {
          if (rule.irrigate?.becomes !== undefined) t.terrain = rule.irrigate.becomes;
          else t.irrigation = true;
          t.mine = false;
          // Land drained into grassland keeps no first special (the original's grassland has none; its shields lie on the bands).
          if (!state.freecivYields && t.terrain === Terrain.Grassland && !t.secondSpecial && !t.deposit) t.special = false;
        } else if (u.order.work === "mine") {
          if (rule.mine?.becomes !== undefined) t.terrain = rule.mine.becomes;
          else t.mine = true;
          t.irrigation = false;
        }
        u.order = { kind: "none" };
      }
    }
  }

  // Cities: squares lost from their land since, then growth, production, treasury, and the smoke they make.
  for (const c of state.cities) if (c.owner === player) dropLostSquares(state, c);
  for (const c of state.cities) if (c.owner === player) lastTurnEvents.push(...processCityTurn(state, c));
  // Riots that outlast the government's patience topple it (a Democracy's: two turns).
  const patience = government(state.players[player]!.government).revolutionAfter;
  if (patience !== undefined && !state.simpleMoods && state.cities.some((c) => c.owner === player && c.unrest > patience)) {
    fallIntoAnarchy(state, state.players[player]!);
    lastTurnEvents.push({ kind: "overthrown", player });
  }
  for (const c of state.cities) if (c.owner === player && pollute(state, c)) lastTurnEvents.push({ city: c.id, kind: "pollution" });
  for (const c of state.cities)
    if (c.owner === player && c.worked.length + c.specialists.length !== c.size) autoAssignWorkers(state, c);

  // Wonder side effects and research.
  for (const ev of [...lastTurnEvents]) {
    if (ev.kind !== "wonder") continue;
    const w = WONDERS.find((x) => x.name === ev.detail);
    if (w?.effect.kind === "freeAdvances") {
      for (let i = 0; i < w.effect.amount; i++) {
        const next = p.researching && availableAdvances(p.advances, advancesFor(state)).some((a) => a.id === p.researching) ? p.researching : availableAdvances(p.advances, advancesFor(state))[0]?.id;
        if (!next) break;
        discover(state, player, next);
        if (p.researching === next) p.researching = null;
      }
    }
    if (w?.effect.kind === "revealMap") {
      p.explored.fill(1);
      discoverExplored(state, player);
    }
  }
  // The Great Library hands over anything two other civilizations already know.
  if (activeWonders(state, player).some((w) => w.rule.effect.kind === "greatLibrary")) {
    const others = state.players.filter((o) => o.id !== player && o.alive && o.id !== state.barbarians);
    for (const a of advancesFor(state)) {
      if (p.advances.includes(a.id)) continue;
      if (others.filter((o) => o.advances.includes(a.id)).length < 2) continue;
      discover(state, player, a.id);
      if (p.researching === a.id) p.researching = null;
    }
  }
  if (p.researching === null && p.science > 0 && availableAdvances(p.advances, advancesFor(state)).length > 0) lastTurnEvents.push({ kind: "chooseResearch" });
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
  // Barbarians only get a turn while they have units or cities on the map.
  const takesTurn = (id: number) =>
    state.players[id]!.alive && (id !== state.barbarians || state.units.some((u) => u.owner === id) || state.cities.some((c) => c.owner === id));
  let next = player;
  let guard = 0;
  do next = (next + 1) % state.players.length;
  while (!takesTurn(next) && ++guard < state.players.length);
  if (next <= player) {
    state.turn++;
    for (const band of maybeSpawnBarbarians(state)) {
      const near = cityById(state, band.city)!;
      lastTurnEvents.push({ kind: "barbarians", x: band.x, y: band.y, sea: band.sea, near: near.name, player: band.victim });
    }
    if (updateWarming(state)) lastTurnEvents.push({ kind: "globalWarming" });
    for (const pl of state.players) {
      const ship = pl.spaceship;
      if (ship.launched === null || ship.arrives === null || ship.arrived || state.turn < ship.arrives) continue;
      if (nextInt(state.rng, 100) < shipStats(ship).successPct) {
        ship.arrived = true;
        lastTurnEvents.push({ kind: "spaceArrived", player: pl.id });
      } else {
        Object.assign(ship, newSpaceship());
        lastTurnEvents.push({ kind: "spaceLost", player: pl.id });
      }
    }
  }
  state.currentPlayer = next;
  startTurn(state, next);
}

/** Roll for pollution around a city; a fouled tile returns true. */
function pollute(state: GameState, city: City): boolean {
  const chance = computeCity(state, city).pollution;
  if (chance <= 0 || nextInt(state.rng, 100) >= chance) return false;
  const candidates: number[] = [];
  for (const [dx, dy] of CITY_RADIUS) {
    const y = city.y + dy;
    if (y < 0 || y >= state.map.height) continue;
    const i = y * state.map.width + wrapX(state.map, city.x + dx);
    const t = state.map.tiles[i]!;
    if (t.terrain !== Terrain.Ocean && !t.pollution) candidates.push(i);
  }
  if (candidates.length === 0) return false;
  state.map.tiles[candidates[nextInt(state.rng, candidates.length)]!]!.pollution = true;
  return true;
}

/** Pollution pressure builds while many tiles are fouled; at the limit the climate shifts. */
function updateWarming(state: GameState): boolean {
  let polluted = 0;
  for (const t of state.map.tiles) if (t.pollution) polluted++;
  if (polluted > WARMING_THRESHOLD) state.warming += polluted - WARMING_THRESHOLD;
  else state.warming = Math.max(0, state.warming - 2);
  if (state.warming < WARMING_LIMIT) return false;
  state.warming = 0;
  globalWarming(state);
  return true;
}

/** Global warming: about a twelfth of the open land dries out or turns to swamp and jungle. */
export function globalWarming(state: GameState): void {
  for (const t of state.map.tiles) {
    if (nextInt(state.rng, 12) !== 0) continue;
    switch (t.terrain) {
      case Terrain.Grassland: t.terrain = nextInt(state.rng, 2) === 0 ? Terrain.Plains : Terrain.Swamp; break;
      case Terrain.Plains: t.terrain = Terrain.Desert; break;
      case Terrain.Forest: t.terrain = Terrain.Jungle; break;
      default: continue;
    }
    t.irrigation = false;
    t.mine = false;
    t.special = false;
  }
}

/** Begin a player's turn: restore moves, continue gotos, wake sentries, pick the first unit. */
/** Movement points a unit starts its turn with: its type's, plus any wonder bonus for ships. */
/** A rested unit recovers a share of its hit points: more in a fortress or a city, all of them with barracks. */
function heal(state: GameState, u: Unit): void {
  const max = maxHp(state, u.type);
  if (u.hp >= max || u.movesLeft < moveAllowance(state, u)) return;
  const city = cityAt(state, u.x, u.y);
  let share: number = HEALING.field;
  if (city) share = unitType(u.type).domain === "land" && city.buildings.some((b) => building(b).barracks) ? 1 : HEALING.city;
  else if (getTile(state.map, u.x, u.y)?.fortress) share = HEALING.fortress;
  // Camped, it heals as in a fortress at least.
  if (u.order.kind === "camp") share = Math.max(share, HEALING.camp);
  u.hp = Math.min(max, u.hp + Math.max(1, Math.round(max * share)));
}

/** A land unit ending its turn on harsh ground loses hit points (never its last one); false where the ground is safe. */
function wearDown(state: GameState, u: Unit): boolean {
  if (unitType(u.type).domain !== "land" || u.aboard !== null) return false;
  const share = attrition(state, u.owner, u.x, u.y);
  if (share === 0) return false;
  u.hp = Math.max(1, u.hp - Math.max(1, Math.round(maxHp(state, u.type) * share)));
  return true;
}

export function moveAllowance(state: GameState, u: Unit): number {
  let moves = fullMoves(u) + traitMoves(state, u.owner, u.type) * MOVE_FRAC;
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
  clearTrespass(state, player);
  // Resource trades whose giver has lost what it gave, or whose sides are at war, end now.
  for (const { trade, by, why } of settleTrades(state)) lastTurnEvents.push({ kind: "tradeEnded", ...trade, by, why });
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
