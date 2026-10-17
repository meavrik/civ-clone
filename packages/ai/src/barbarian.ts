import {
  applyCommand,
  attackOdds,
  barbarianUnits,
  bestDefender,
  cargo,
  cityAt,
  findPath,
  getTile,
  mapDistance,
  NEIGHBOURS,
  pillageTarget,
  Terrain,
  unitType,
  wrapX,
  type City,
  type GameState,
  type Unit,
} from "@civ/core";

/** Odds a barbarian soldier takes a fight in the field at; a city they storm at long odds; one holding a city sallies out only at good ones. */
const ATTACK_ODDS = 0.3;
const STORM_ODDS = 0.1;
const SALLY_ODDS = 0.6;
/** A lone leader this far from every city, with no enemy soldier within three squares, slips away. */
const LEADER_ESCAPE = 8;
/** Beyond this distance from the city it marches on, a band loots the farms and mines it stands on. */
const LOOT_DISTANCE = 3;

/**
 * The barbarians (every game except old saves' simple barbarians). Like the
 * planner it keeps no memory: each turn it reads the board. Boats carry their
 * raiders toward the nearest city and put them ashore beside it, or send them
 * at it straight from the deck; an empty boat sails off. Soldiers storm the
 * nearest city they can walk to and hit anything worth hitting on the way,
 * looting farms and mines while the city is still far off. One soldier holds
 * each barbarian city, which raises the best barbarian unit. The leader keeps
 * to its band; alone it runs, and once clear of every city it slips away.
 */
export function barbarianTurn(state: GameState): void {
  const me = state.currentPlayer;
  const mine = () => state.units.filter((u) => u.owner === me);
  for (const c of state.cities) if (c.owner === me) produce(state, c);
  for (const boat of mine().filter((u) => unitType(u.type).domain === "sea")) sail(state, boat);
  for (const u of mine().filter((u) => isSoldier(u) && u.aboard === null)) if (state.units.includes(u)) fight(state, u);
  for (const u of mine().filter(isLeader)) if (state.units.includes(u)) lead(state, u);
  // A boat whose raiders are ashore, or that carries only their leader, sails off.
  for (const boat of mine().filter((u) => unitType(u.type).domain === "sea")) {
    const aboard = cargo(state, boat);
    if (aboard.some(isSoldier)) continue;
    for (const u of aboard) applyCommand(state, { type: "disband", unit: u.id });
    applyCommand(state, { type: "disband", unit: boat.id });
  }
}

function isLeader(u: Unit): boolean {
  return unitType(u.type).flags?.includes("leader") === true;
}

function isSoldier(u: Unit): boolean {
  const t = unitType(u.type);
  return t.domain === "land" && t.attack > 0;
}

/** A barbarian city raises its best defender until one holds it, then its best attacker. */
function produce(state: GameState, c: City): void {
  const held = state.units.some((o) => o.owner === c.owner && o.x === c.x && o.y === c.y && unitType(o.type).defense >= 2);
  const stat = held ? "attack" : "defense";
  let best: string | null = null;
  let score = -Infinity;
  for (const id of barbarianUnits(state, "build")) {
    const t = unitType(id);
    const s = t[stat] * 10 + (held ? t.defense : t.attack) - t.cost / 100;
    if (s > score) { score = s; best = id; }
  }
  if (best && (c.production.kind !== "unit" || c.production.id !== best))
    applyCommand(state, { type: "setProduction", city: c.id, production: { kind: "unit", id: best } });
}

/** The civilizations' cities, nearest first. */
function citiesByDistance(state: GameState, x: number, y: number): City[] {
  return state.cities
    .filter((c) => c.owner !== state.barbarians)
    .map((c) => ({ c, d: mapDistance(state.map, x, y, c.x, c.y) }))
    .sort((a, b) => a.d - b.d)
    .map((e) => e.c);
}

// ---- boats -------------------------------------------------------------------------------

/** Bring the raiders to the nearest city and put them ashore beside it. */
function sail(state: GameState, boat: Unit): void {
  if (!cargo(state, boat).some(isSoldier)) return;
  const target = citiesByDistance(state, boat.x, boat.y)[0];
  if (!target) return;
  if (landRaiders(state, boat, target, false)) return;
  const berth = harbour(state, boat, target);
  if (berth) applyCommand(state, { type: "goto", unit: boat.id, x: berth[0], y: berth[1] });
  // Ashore beside the city if the boat got there; anywhere once it can get no closer.
  landRaiders(state, boat, target, berth === null || (boat.x === berth[0] && boat.y === berth[1]));
}

/** A free sea square close to the target that the boat can reach, nearest the city first, then nearest the boat. */
function harbour(state: GameState, boat: Unit, target: City): [number, number] | null {
  const spots: { x: number; y: number; d: number; far: number }[] = [];
  for (let dy = -3; dy <= 3; dy++)
    for (let dx = -3; dx <= 3; dx++) {
      const x = wrapX(state.map, target.x + dx);
      const y = target.y + dy;
      const t = getTile(state.map, x, y);
      if (!t || t.terrain !== Terrain.Ocean) continue;
      if (state.units.some((o) => o.x === x && o.y === y && o.id !== boat.id)) continue;
      spots.push({ x, y, d: Math.max(Math.abs(dx), Math.abs(dy)), far: mapDistance(state.map, boat.x, boat.y, x, y) });
    }
  spots.sort((a, b) => a.d - b.d || a.far - b.far);
  for (const s of spots.slice(0, 6)) if ((s.x === boat.x && s.y === boat.y) || findPath(state, boat, s.x, s.y)) return [s.x, s.y];
  return null;
}

/**
 * Raiders strike from the deck where the odds allow, the rest step ashore on
 * the free square beside the boat nearest the target (within two squares of
 * it unless `anywhere`), and the leader follows them. False when there is
 * nowhere to land.
 */
function landRaiders(state: GameState, boat: Unit, target: City, anywhere: boolean): boolean {
  let landing: [number, number] | null = null;
  let bestD = anywhere ? Infinity : 3;
  for (const [dx, dy] of NEIGHBOURS) {
    const x = wrapX(state.map, boat.x + dx);
    const y = boat.y + dy;
    const t = getTile(state.map, x, y);
    if (!t || t.terrain === Terrain.Ocean || cityAt(state, x, y)) continue;
    if (state.units.some((o) => o.x === x && o.y === y && o.owner !== boat.owner)) continue;
    const d = mapDistance(state.map, x, y, target.x, target.y);
    if (d < bestD) { bestD = d; landing = [dx, dy]; }
  }
  const raiders = cargo(state, boat).filter(isSoldier);
  let acted = false;
  for (const r of raiders) if (strike(state, r, ATTACK_ODDS, STORM_ODDS)) acted = true;
  if (!landing) return acted;
  const [dx, dy] = landing;
  let ashore = false;
  for (const r of raiders) {
    if (!state.units.includes(r) || r.aboard === null) continue;
    if (applyCommand(state, { type: "move", unit: r.id, dx, dy }).ok && state.units.includes(r)) ashore = true;
  }
  if (ashore) for (const l of cargo(state, boat).filter(isLeader)) applyCommand(state, { type: "move", unit: l.id, dx, dy });
  return ashore || acted;
}

// ---- soldiers ----------------------------------------------------------------------------

/**
 * Hit the best target next door: an empty enemy city is walked into, a
 * defended one stormed at `storm` odds or better, anything else attacked at
 * `odds`. True if it acted.
 */
function strike(state: GameState, u: Unit, odds: number, storm: number): boolean {
  if (u.movesLeft <= 0) return false;
  let best: [number, number] | null = null;
  let bestP = 0;
  for (const [dx, dy] of NEIGHBOURS) {
    const x = wrapX(state.map, u.x + dx);
    const y = u.y + dy;
    const t = getTile(state.map, x, y);
    if (!t) continue;
    const city = cityAt(state, x, y);
    const foes = state.units.filter((o) => o.x === x && o.y === y && o.owner !== u.owner);
    if (foes.length === 0) {
      if (city && city.owner !== u.owner && t.terrain !== Terrain.Ocean) return applyCommand(state, { type: "move", unit: u.id, dx, dy }).ok;
      continue;
    }
    if (t.terrain === Terrain.Ocean && !city) continue;
    const d = bestDefender(state, x, y, u);
    if (!d) continue;
    const p = attackOdds(state, u, d);
    if (p < (city ? storm : odds)) continue;
    // Among the fights it would take, a city first, then the best odds.
    const v = p + (city ? 1 : 0);
    if (v > bestP) { bestP = v; best = [dx, dy]; }
  }
  if (!best) return false;
  return applyCommand(state, { type: "move", unit: u.id, dx: best[0], dy: best[1] }).ok;
}

/** One soldier's turn: hold a city, fight, loot or march, until its moves run out. */
function fight(state: GameState, u: Unit): void {
  for (let guard = 0; guard < 4 && state.units.includes(u) && u.movesLeft > 0; guard++) {
    if (keeper(state, u)) {
      if (!strike(state, u, SALLY_ODDS, SALLY_ODDS)) applyCommand(state, { type: "fortify", unit: u.id });
      return;
    }
    if (strike(state, u, ATTACK_ODDS, STORM_ODDS)) continue;
    const target = march(state, u);
    if (target === null) {
      applyCommand(state, { type: "fortify", unit: u.id });
      return;
    }
    // Loot: farms and mines on the way while the city is far off; anything at its gates when it will not fall.
    const loot = pillageTarget(state, u);
    const d = mapDistance(state.map, u.x, u.y, target.x, target.y);
    if (loot && (d > LOOT_DISTANCE ? loot === "irrigation" || loot === "mine" : d <= 1)) {
      applyCommand(state, { type: "pillage", unit: u.id });
      return;
    }
    const before = u.movesLeft;
    if (!applyCommand(state, { type: "goto", unit: u.id, x: target.x, y: target.y }).ok || u.movesLeft === before) {
      applyCommand(state, { type: "fortify", unit: u.id });
      return;
    }
  }
}

/** Is this the soldier that holds the barbarian city it stands in (its best defender)? */
function keeper(state: GameState, u: Unit): boolean {
  const home = cityAt(state, u.x, u.y);
  if (!home || home.owner !== u.owner) return false;
  const guard = state.units
    .filter((o) => o.owner === u.owner && o.x === u.x && o.y === u.y && isSoldier(o))
    .reduce((a, b) => (unitType(b.type).defense > unitType(a.type).defense ? b : a));
  return guard === u;
}

/** The nearest city of a civilization this soldier can walk to (of the three nearest on its continent), else null. */
function march(state: GameState, u: Unit): City | null {
  const here = getTile(state.map, u.x, u.y)!.continent;
  const near = citiesByDistance(state, u.x, u.y).filter((c) => getTile(state.map, c.x, c.y)!.continent === here);
  for (const c of near.slice(0, 3)) if (findPath(state, u, c.x, c.y)) return c;
  return null;
}

// ---- the leader --------------------------------------------------------------------------

/** Keep to the nearest soldier of the band; alone, run from the enemy and slip away once clear. */
function lead(state: GameState, l: Unit): void {
  if (l.aboard !== null) return;
  const here = getTile(state.map, l.x, l.y)!.continent;
  const band = state.units
    .filter((o) => o.owner === l.owner && isSoldier(o) && o.aboard === null && getTile(state.map, o.x, o.y)!.continent === here)
    .sort((a, b) => mapDistance(state.map, l.x, l.y, a.x, a.y) - mapDistance(state.map, l.x, l.y, b.x, b.y))[0];
  if (band) {
    if (band.x !== l.x || band.y !== l.y) applyCommand(state, { type: "goto", unit: l.id, x: band.x, y: band.y });
    return;
  }
  const danger = (x: number, y: number) => {
    let d = Infinity;
    for (const o of state.units) if (o.owner !== l.owner && isSoldier(o)) d = Math.min(d, mapDistance(state.map, x, y, o.x, o.y));
    return d;
  };
  const cityD = (x: number, y: number) => {
    const c = citiesByDistance(state, x, y)[0];
    return c ? mapDistance(state.map, x, y, c.x, c.y) : Infinity;
  };
  if (cityD(l.x, l.y) >= LEADER_ESCAPE && danger(l.x, l.y) > 3) {
    applyCommand(state, { type: "disband", unit: l.id });
    return;
  }
  for (let step = 0; step < 2 && state.units.includes(l) && l.movesLeft > 0; step++) {
    let best: [number, number] | null = null;
    let bestV = danger(l.x, l.y) * 100 + cityD(l.x, l.y);
    for (const [dx, dy] of NEIGHBOURS) {
      const x = wrapX(state.map, l.x + dx);
      const y = l.y + dy;
      const t = getTile(state.map, x, y);
      if (!t || t.terrain === Terrain.Ocean || cityAt(state, x, y)) continue;
      if (state.units.some((o) => o.x === x && o.y === y && o.owner !== l.owner)) continue;
      const v = danger(x, y) * 100 + cityD(x, y);
      if (v > bestV) { bestV = v; best = [dx, dy]; }
    }
    if (!best || !applyCommand(state, { type: "move", unit: l.id, dx: best[0], dy: best[1] }).ok) return;
  }
}
