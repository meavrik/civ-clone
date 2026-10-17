import { cityAt, hasWonder } from "./cities.js";
import { atWar } from "./diplomacy.js";
import { nextFloat } from "./rng.js";
import { newSpaceship } from "./rules/spaceship.js";
import { TERRAIN_RULES } from "./rules/terrain.js";
import { unitType } from "./rules/units.js";
import { getTile, type City, type GameState, type Unit } from "./types.js";
import { firepower, lastActions, maxHp, unitAt, type BattleSide, type UnitBattle } from "./units.js";

export function attackStrength(u: Unit): number {
  let a = unitType(u.type).attack;
  if (u.veteran) a *= 1.5;
  return a;
}

export function defenseStrength(state: GameState, d: Unit, attacker: Unit): number {
  const type = unitType(d.type);
  const tile = getTile(state.map, d.x, d.y)!;
  let s = type.defense;
  if (type.domain === "land") s *= TERRAIN_RULES[tile.terrain].defense;
  if (d.veteran) s *= 1.5;
  const city = cityAt(state, d.x, d.y);
  if (tile.fortress && !city && type.domain === "land") s *= 2;
  else if (d.order.kind === "fortified" || city) s *= 1.5;
  const aType = unitType(attacker.type);
  if (city && aType.domain === "land" && (city.buildings.includes("city_walls") || hasWonder(state, city.owner, "great_wall"))) s *= 3;
  return s;
}

/** The unit that would defend a tile: the best defender present. */
export function bestDefender(state: GameState, x: number, y: number, attacker: Unit): Unit | undefined {
  const there = unitAt(state, x, y).filter((o) => o.owner !== attacker.owner);
  if (there.length === 0) return undefined;
  return there.reduce((best, o) => (defenseStrength(state, o, attacker) > defenseStrength(state, best, attacker) ? o : best));
}

export interface CombatResult {
  attackerWon: boolean;
  attacker: Unit;
  defender: Unit;
  /** Units destroyed (ids). */
  destroyed: number[];
  cityCaptured?: City;
  cityDestroyed?: string;
}

/**
 * Chance of winning `need` rounds before losing `lives`, each round won with
 * probability p (a negative-binomial sum).
 */
export function winProbability(p: number, need: number, lives: number): number {
  if (need <= 0) return 1;
  if (lives <= 0 || p <= 0) return 0;
  let term = Math.pow(p, need);
  let total = term;
  for (let k = 1; k < lives; k++) {
    term *= ((need - 1 + k) / k) * (1 - p);
    total += term;
  }
  return Math.min(1, total);
}

/** Chance that `u` beats this defender, counting every round and both sides' hit points. */
export function attackOdds(state: GameState, u: Unit, defender: Unit): number {
  const a = attackStrength(u);
  const d = defenseStrength(state, defender, u);
  const need = Math.ceil(defender.hp / firepower(state, u.type));
  const lives = Math.ceil(u.hp / firepower(state, defender.type));
  return winProbability(a / (a + d), need, lives);
}

/**
 * Resolve an attack from `u` onto the tile at (u.x+dx, u.y+dy).
 * The fight goes in rounds, each won by the attacker with probability
 * A/(A+D); the loser of a round loses the winner's firepower in hit points,
 * until one side has none left. Survivors keep their damage. (With classic
 * combat, 10 hp against firepower 10, one round decides, as in the original.)
 * When a stack outside a city loses its defender the whole stack is lost;
 * inside a city only the defender dies.
 */
export function resolveCombat(state: GameState, u: Unit, dx: number, dy: number): CombatResult | { error: string } {
  const type = unitType(u.type);
  if (type.attack === 0) return { error: "this unit cannot attack" };
  if (u.movesLeft <= 0) return { error: "no moves left" };
  const tx = ((u.x + dx) % state.map.width + state.map.width) % state.map.width;
  const ty = u.y + dy;
  const defender = bestDefender(state, tx, ty, u);
  if (!defender) return { error: "nothing to attack" };
  if (!atWar(state, u.owner, defender.owner)) return { error: "not at war" };
  const targetTile = getTile(state.map, tx, ty)!;
  if (type.domain === "land" && targetTile.terrain === 0 && !cityAt(state, tx, ty)) return { error: "land units cannot attack at sea" };
  if (type.domain === "sea" && targetTile.terrain !== 0 && !cityAt(state, tx, ty)) {
    // Ships bombard the coast at reduced strength only against units on the shore.
  }

  const a = attackStrength(u);
  const d = defenseStrength(state, defender, u);
  const p = a / (a + d);
  const side = (x: Unit): BattleSide => ({ unit: x.id, type: x.type, owner: x.owner, x: x.x, y: x.y, hp: x.hp, maxHp: maxHp(state, x.type), firepower: firepower(state, x.type) });
  const battle: UnitBattle = { kind: "battle", attacker: side(u), defender: side(defender), rounds: [], attackerWon: false, alsoLost: [] };
  const aFp = battle.attacker.firepower;
  const dFp = battle.defender.firepower;
  while (u.hp > 0 && defender.hp > 0) {
    if (nextFloat(state.rng) < p) { defender.hp = Math.max(0, defender.hp - aFp); battle.rounds.push(true); }
    else { u.hp = Math.max(0, u.hp - dFp); battle.rounds.push(false); }
  }
  const attackerWon = defender.hp === 0;
  battle.attackerWon = attackerWon;
  const destroyed: number[] = [];
  const city = cityAt(state, tx, ty);

  if (attackerWon) {
    if (city || targetTile.fortress) destroyed.push(defender.id);
    else for (const o of unitAt(state, tx, ty)) if (o.owner === defender.owner) destroyed.push(o.id);
    if (nextFloat(state.rng) < 0.5) u.veteran = true;
  } else {
    destroyed.push(u.id);
    if (nextFloat(state.rng) < 0.5) defender.veteran = true;
  }
  // Units aboard a sunk ship go down with it.
  for (const id of [...destroyed]) for (const o of state.units) if (o.aboard === id) destroyed.push(o.id);
  battle.alsoLost = destroyed.filter((id) => id !== (attackerWon ? defender.id : u.id));
  lastActions.push(battle);
  state.units = state.units.filter((x) => !destroyed.includes(x.id));
  u.movesLeft = Math.max(0, u.movesLeft - 3);
  if (u.order.kind === "fortified" || u.order.kind === "sentry") u.order = { kind: "none" };

  const result: CombatResult = { attackerWon, attacker: u, defender, destroyed };
  return result;
}

/** Move a land unit into an undefended enemy city: capture or raze it. */
export function captureCity(state: GameState, u: Unit, city: City): { captured: boolean; destroyed: boolean; plunder: number; shipLost: boolean } {
  const loser = state.players[city.owner]!;
  const winner = state.players[u.owner]!;
  const loserCities = state.cities.filter((c) => c.owner === city.owner).length;
  const plunder = Math.floor((loser.gold * city.size) / Math.max(1, loserCities * 3));
  loser.gold -= plunder;
  winner.gold += plunder;
  for (const o of state.units) if (o.homeCity === city.id) o.homeCity = null;
  // Losing the capital grounds a launched spaceship.
  let shipLost = false;
  if (city.buildings.includes("palace") && loser.spaceship.launched !== null && !loser.spaceship.arrived) {
    Object.assign(loser.spaceship, newSpaceship());
    shipLost = true;
  }
  if (city.size <= 1 || u.owner === state.barbarians) {
    for (const o of state.cities) o.routes = o.routes.filter((id) => id !== city.id);
    state.cities = state.cities.filter((c) => c.id !== city.id);
    return { captured: false, destroyed: true, plunder, shipLost };
  }
  city.size -= 1;
  city.owner = u.owner;
  city.buildings = city.buildings.filter((b) => b !== "palace");
  city.worked = [];
  city.specialists = [];
  city.food = 0;
  city.shields = 0;
  city.production = { kind: "unit", id: "militia" };
  city.disorder = false;
  return { captured: true, destroyed: false, plunder, shipLost };
}

/** A player with no cities and no settlers is out of the game. */
export function checkElimination(state: GameState): number[] {
  const out: number[] = [];
  for (const p of state.players) {
    if (!p.alive || p.id === state.barbarians) continue;
    const hasCity = state.cities.some((c) => c.owner === p.id);
    const hasSettler = state.units.some((u) => u.owner === p.id && unitType(u.type).flags?.includes("settler"));
    if (!hasCity && !hasSettler) {
      p.alive = false;
      out.push(p.id);
    }
  }
  return out;
}
