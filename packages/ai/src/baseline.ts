import {
  applyCommand,
  atWar,
  advancesFor,
  availableAdvances,
  buildOptions,
  canFoundCity,
  cityAt,
  computeCity,
  findPath,
  getTile,
  NEIGHBOURS,
  nextInt,
  relation,
  Terrain,
  unitById,
  unitType,
  wrapX,
  type GameState,
  type Production,
  type Unit,
} from "@civ/core";
import { barbarianTurn } from "./barbarian.js";

/**
 * Baseline opponent: enough to settle, defend, explore and raid. It issues
 * the same commands a human does, so replays and the AI v2 tournament
 * harness treat it as any other player. Decisions draw on the game RNG so a
 * seeded game stays reproducible.
 */
export function baselineTurn(state: GameState): void {
  const me = state.currentPlayer;
  const p = state.players[me]!;
  if (!p.isAi) return;
  if (me === state.barbarians && !state.simpleBarbarians) { barbarianTurn(state); return; }

  if (me !== state.barbarians) {
    manageDiplomacy(state, me);
    manageCities(state, me);
    if (p.researching === null) {
      const options = availableAdvances(p.advances, advancesFor(state));
      if (options.length) applyCommand(state, { type: "research", advance: options[nextInt(state.rng, options.length)]!.id });
    }
    if (p.government === "anarchy" && p.anarchyTurns === 0) {
      applyCommand(state, { type: "setGovernment", government: p.advances.includes("monarchy") ? "monarchy" : "despotism" });
    }
  }

  // Units: loop until nothing needs orders. Guard against a unit that refuses every order.
  let guard = 0;
  while (state.activeUnit !== null && guard++ < 500) {
    const u = unitById(state, state.activeUnit);
    if (!u) break;
    const before = { x: u.x, y: u.y, moves: u.movesLeft, order: u.order.kind };
    orderUnit(state, u);
    const same = state.activeUnit === u.id && u.x === before.x && u.y === before.y && u.movesLeft === before.moves && u.order.kind === before.order;
    if (same) applyCommand(state, { type: "skip", unit: u.id });
  }
}

function manageDiplomacy(state: GameState, me: number): void {
  for (const other of state.players) {
    if (other.id === me || !other.alive || other.id === state.barbarians) continue;
    const r = relation(state, me, other.id);
    if (r === "none") continue;
    // Occasionally pick a fight with a weaker neighbour; occasionally tire of a war.
    const myStrength = state.units.filter((u) => u.owner === me && unitType(u.type).attack > 0).length;
    const theirStrength = state.units.filter((u) => u.owner === other.id && unitType(u.type).attack > 0).length;
    if (r === "peace" && myStrength > theirStrength + 2 && nextInt(state.rng, 100) < 4) applyCommand(state, { type: "declareWar", player: other.id });
    else if (r === "war" && myStrength < theirStrength && nextInt(state.rng, 100) < 10) applyCommand(state, { type: "makePeace", player: other.id });
  }
}

function manageCities(state: GameState, me: number): void {
  const mine = state.cities.filter((c) => c.owner === me);
  for (const c of mine) {
    const r = computeCity(state, c);
    const defenders = state.units.filter((u) => u.x === c.x && u.y === c.y && u.owner === me && unitType(u.type).defense > 0 && unitType(u.type).attack > 0).length;
    const options = buildOptions(state, c);
    const pick = (pred: (p: Production) => boolean): Production | undefined => options.find(pred);
    let want: Production | undefined;
    if (defenders < 2) want = bestUnit(options, "defense");
    else if (c.size >= 3 && mine.length < 8 && !r.disorder) want = pick((p) => p.kind === "unit" && p.id === "settlers");
    else if (r.disorder || r.unhappy > 0) want = pick((p) => p.kind === "building" && (p.id === "temple" || p.id === "colosseum"));
    else if (nextInt(state.rng, 3) === 0) want = bestUnit(options, "attack");
    else want = pick((p) => p.kind === "building" && ["granary", "library", "marketplace", "barracks", "city_walls", "aqueduct"].includes(p.id));
    if (!want) want = bestUnit(options, "defense");
    if (want && (want.kind !== c.production.kind || want.id !== c.production.id) && c.shields < 5)
      applyCommand(state, { type: "setProduction", city: c.id, production: want });
    // Panic-buy a defender when the city is empty and the treasury allows.
    if (defenders === 0 && c.production.kind === "unit" && state.players[me]!.gold > 60)
      applyCommand(state, { type: "buy", city: c.id });
  }
}

function bestUnit(options: Production[], stat: "attack" | "defense"): Production | undefined {
  let best: Production | undefined;
  let score = -1;
  for (const o of options) {
    if (o.kind !== "unit") continue;
    const t = unitType(o.id);
    if (t.domain !== "land" || t.flags?.includes("settler") || t.flags?.includes("diplomat") || t.flags?.includes("caravan")) continue;
    const s = t[stat] * 10 - t.cost / 10;
    if (t.attack === 0) continue;
    if (s > score) { score = s; best = o; }
  }
  return best;
}

function orderUnit(state: GameState, u: Unit): void {
  const type = unitType(u.type);
  const me = u.owner;

  if (type.flags?.includes("settler")) {
    const here = cityAt(state, u.x, u.y);
    const ownCities = state.cities.filter((c) => c.owner === me);
    if (!here && canFoundCity(state, u.x, u.y) === null && goodSite(state, u.x, u.y) && (ownCities.length === 0 || nearestCityDistance(state, me, u.x, u.y) >= 4)) {
      applyCommand(state, { type: "found", unit: u.id });
      return;
    }
    // Walk toward a good site; otherwise wander.
    const site = findSite(state, u);
    if (site) {
      applyCommand(state, { type: "goto", unit: u.id, x: site[0], y: site[1] });
      return;
    }
    wander(state, u);
    return;
  }

  if (type.domain !== "land") {
    wander(state, u);
    return;
  }

  // Barbarians and warring units: head for the nearest enemy city or unit and attack.
  const target = nearestEnemy(state, u);
  if (target) {
    const [tx, ty] = target;
    const dist = Math.max(Math.min(Math.abs(tx - u.x), state.map.width - Math.abs(tx - u.x)), Math.abs(ty - u.y));
    if (dist === 1) {
      let dx = tx - u.x;
      if (dx > 1) dx -= state.map.width;
      if (dx < -1) dx += state.map.width;
      applyCommand(state, { type: "move", unit: u.id, dx, dy: ty - u.y });
      return;
    }
    if (type.attack > 0 && (me === state.barbarians || dist <= 8)) {
      if (findPath(state, u, tx, ty)) {
        applyCommand(state, { type: "goto", unit: u.id, x: tx, y: ty });
        return;
      }
    }
  }

  // Defenders: hold the nearest city that is short of guards.
  const city = cityAt(state, u.x, u.y);
  if (city && city.owner === me) {
    const guards = state.units.filter((o) => o.x === u.x && o.y === u.y && o.owner === me && o.id !== u.id && o.order.kind === "fortified").length;
    if (guards < 2 || type.attack <= type.defense) {
      applyCommand(state, { type: "fortify", unit: u.id });
      return;
    }
  }
  const needy = state.cities.find((c) => c.owner === me && state.units.filter((o) => o.x === c.x && o.y === c.y && o.owner === me).length < 2);
  if (needy && type.defense >= type.attack && findPath(state, u, needy.x, needy.y)) {
    applyCommand(state, { type: "goto", unit: u.id, x: needy.x, y: needy.y });
    return;
  }
  wander(state, u);
}

function goodSite(state: GameState, x: number, y: number): boolean {
  const t = getTile(state.map, x, y)!;
  if (t.terrain !== Terrain.Grassland && t.terrain !== Terrain.Plains && !t.river) return false;
  let land = 0;
  for (const [dx, dy] of NEIGHBOURS) {
    const n = getTile(state.map, x + dx, y + dy);
    if (n && n.terrain !== Terrain.Ocean && n.terrain !== Terrain.Arctic && n.terrain !== Terrain.Mountains) land++;
  }
  return land >= 4;
}

function nearestCityDistance(state: GameState, me: number, x: number, y: number): number {
  let best = 99;
  for (const c of state.cities) {
    if (c.owner !== me) continue;
    const d = Math.max(Math.min(Math.abs(c.x - x), state.map.width - Math.abs(c.x - x)), Math.abs(c.y - y));
    if (d < best) best = d;
  }
  return best;
}

function findSite(state: GameState, u: Unit): [number, number] | null {
  let best: [number, number] | null = null;
  let bestScore = -1;
  for (let dy = -6; dy <= 6; dy++)
    for (let dx = -6; dx <= 6; dx++) {
      const x = wrapX(state.map, u.x + dx);
      const y = u.y + dy;
      if (y < 2 || y >= state.map.height - 2) continue;
      if (canFoundCity(state, x, y) !== null || !goodSite(state, x, y)) continue;
      if (nearestCityDistance(state, u.owner, x, y) < 4) continue;
      const d = Math.max(Math.abs(dx), Math.abs(dy));
      const score = 20 - d + (getTile(state.map, x, y)!.river ? 3 : 0);
      if (score > bestScore && findPath(state, u, x, y)) { bestScore = score; best = [x, y]; }
    }
  return best;
}

function nearestEnemy(state: GameState, u: Unit): [number, number] | null {
  let best: [number, number] | null = null;
  let bestD = 99;
  const consider = (x: number, y: number, owner: number) => {
    if (owner === u.owner || !atWar(state, u.owner, owner)) return;
    const d = Math.max(Math.min(Math.abs(x - u.x), state.map.width - Math.abs(x - u.x)), Math.abs(y - u.y));
    if (d < bestD) { bestD = d; best = [x, y]; }
  };
  for (const c of state.cities) consider(c.x, c.y, c.owner);
  for (const o of state.units) if (unitType(o.type).domain === "land" && o.aboard === null) consider(o.x, o.y, o.owner);
  return best;
}

function wander(state: GameState, u: Unit): void {
  // Prefer unexplored directions; try a few random ones before giving up.
  const p = state.players[u.owner]!;
  const dirs = [...NEIGHBOURS].sort(() => nextInt(state.rng, 3) - 1);
  for (const [dx, dy] of dirs) {
    const ny = u.y + dy;
    if (ny < 0 || ny >= state.map.height) continue;
    const idx = ny * state.map.width + wrapX(state.map, u.x + dx);
    const unexplored = !p.explored[idx];
    if (!unexplored && nextInt(state.rng, 3) !== 0) continue;
    const r = applyCommand(state, { type: "move", unit: u.id, dx, dy });
    if (r.ok) return;
  }
  applyCommand(state, { type: "fortify", unit: u.id });
}

