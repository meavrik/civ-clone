import {
  applyCommand,
  attackOdds,
  barbarianUnits,
  CITY_STATE,
  cityStateUnit,
  peaceUntil,
  unitCityState,
  bestDefender,
  boughtOff,
  cargo,
  checkMove,
  cityAt,
  findPath,
  getTile,
  landOwner,
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
/** Odds a city-state's soldier attacks at in the field (since save version 63; the barbarians' `ATTACK_ODDS` before). */
const RAID_ODDS = 0.2;
/** A city-state's soldier goes after an enemy unit in the open this many squares off (since save version 63). */
const HUNT_RANGE = 3;
/** A city-state's soldier that cannot storm the city it raids wrecks what lies this far round it, on its land (since save version 63). */
const LOOT_RANGE = 3;

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
  for (const c of state.cities) if (c.owner === me) (c.cityState !== undefined ? cityStateProduce(state, c) : produce(state, c));
  // The city-states first: their soldiers keep to their own ways (`cityStateTurn`).
  for (const c of state.cities.filter((x) => x.owner === me && x.cityState !== undefined)) cityStateTurn(state, c);
  for (const boat of mine().filter((u) => unitType(u.type).domain === "sea")) sail(state, boat);
  for (const u of mine().filter((u) => isSoldier(u) && u.aboard === null && !unitCityState(state, u))) if (state.units.includes(u)) fight(state, u);
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
  let bestP = -1;
  for (const [dx, dy] of NEIGHBOURS) {
    const x = wrapX(state.map, u.x + dx);
    const y = u.y + dy;
    const t = getTile(state.map, x, y);
    if (!t) continue;
    const city = cityAt(state, x, y);
    const foes = state.units.filter((o) => o.x === x && o.y === y && o.owner !== u.owner);
    // Whoever has paid a city-state off is passed by (a band now strikes at any odds, and the refused move cost it the turn's fight).
    const owner = foes[0]?.owner ?? city?.owner;
    if (!state.swarmingCityStates && owner !== undefined && boughtOff(state, u, owner)) continue;
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

// ---- city-states -------------------------------------------------------------------------

/** A city-state raises defenders until its garrison stands, then attackers (`cityStateUnit`: a step behind the world). */
function cityStateProduce(state: GameState, c: City): void {
  const guards = state.units.filter((o) => o.homeCity === c.id && o.x === c.x && o.y === c.y && isSoldier(o)).length;
  const best = cityStateUnit(state, guards < CITY_STATE.garrison ? "defense" : "attack");
  if (c.production.kind !== "unit" || c.production.id !== best) applyCommand(state, { type: "setProduction", city: c.id, production: { kind: "unit", id: best } });
}

/** A city-state's soldiers' turn. */
function cityStateTurn(state: GameState, c: City): void {
  if (state.swarmingCityStates) swarmTurn(state, c);
  else bandTurn(state, c);
}

/**
 * A city-state's soldiers since save version 71 (asked for 2026-11-05: "city states unit come in massive units - and just
 * walk arownd my cities - make no sense and make each turn very long ... if you need to attack just attack, or reduce the
 * units amount or make them move at batches"). It raises only its garrison and one band (core `cityStateManned`). The
 * garrison holds the city, sallying only at good odds; the band waits there too until all of it stands and the turn is
 * past `grace`, then sets out together for the nearest civilization's city it can reach (`raidTarget`), its owner asked
 * for tribute (`cityStateDemand`), and no other soldier leaves until the last of it has fallen or come home. On the march
 * nothing turns it aside (`press`), and with no city left to raid it goes home and stays. So few soldiers are ever
 * abroad, each going one way, and a raid ends in a fight.
 */
function bandTurn(state: GameState, c: City): void {
  const units = state.units.filter((u) => u.homeCity === c.id && u.owner === c.owner && isSoldier(u) && u.aboard === null);
  const home = units.filter((u) => u.x === c.x && u.y === c.y).sort((a, b) => unitType(b.type).defense - unitType(a.type).defense || a.id - b.id);
  const garrison = new Set(home.slice(0, CITY_STATE.garrison).map((u) => u.id));
  const band = units.filter((u) => !garrison.has(u.id));
  const out = band.filter((u) => u.x !== c.x || u.y !== c.y);
  const ready = state.turn >= CITY_STATE.grace && (out.length > 0 || band.length >= CITY_STATE.band);
  const target = ready ? raidTarget(state, c, out[0] ?? band[0]!) : null;
  const marching = out.length ? out : target ? band : [];
  for (const g of home) {
    if (marching.includes(g)) continue;
    if (!strike(state, g, SALLY_ODDS, SALLY_ODDS) && g.order.kind !== "fortified") applyCommand(state, { type: "fortify", unit: g.id });
  }
  if (!target) {
    for (const u of marching) press(state, u, c, false);
    return;
  }
  const victim = target.owner;
  const demand = () => applyCommand(state, { type: "cityStateDemand", city: c.id, player: victim, target: target.id });
  demand();
  for (const u of marching) press(state, u, target, true);
  if (target.owner === victim && marching.some((u) => state.units.includes(u))) demand();
}

/**
 * A band's soldier on its way to `dest`, the city it raids or (`raiding` false) its home. Raiding it attacks what it comes
 * next to at any odds, the city above all: "if you need to attack just attack". It wrecks the farms, mines, railroads and
 * fortresses it stands on, on the land of whoever has not paid it off, and otherwise walks on. It chases nothing and
 * waits for nothing: what `prowl` did round a city it could not storm kept a band walking there for good.
 */
function press(state: GameState, u: Unit, dest: City, raiding: boolean): void {
  // A goto left standing walks first as the turn begins, spending the moves: one for somewhere else goes now, or a band
  // sent home takes that step forward every turn and never turns round.
  if (u.order.kind === "goto" && (u.order.x !== dest.x || u.order.y !== dest.y)) applyCommand(state, { type: "goto", unit: u.id, x: dest.x, y: dest.y });
  for (let guard = 0; guard < 4 && state.units.includes(u) && u.movesLeft > 0; guard++) {
    if (strike(state, u, raiding ? 0 : RAID_ODDS, raiding ? 0 : STORM_ODDS)) continue;
    if (plunder(state, u, false)) return;
    if (u.x === dest.x && u.y === dest.y) {
      if (u.order.kind !== "fortified") applyCommand(state, { type: "fortify", unit: u.id });
      return;
    }
    const before = u.movesLeft;
    if (!applyCommand(state, { type: "goto", unit: u.id, x: dest.x, y: dest.y }).ok || u.movesLeft === before) return;
  }
}

/**
 * A city-state's soldiers before save version 71 (asked for 2026-10-29: "only produce war units to attack occasionally"):
 * its best defenders hold the city, sallying only at good odds. The rest wait at home until there are `CITY_STATE.raid` of
 * them (and the turn is past `grace`), then set out together for the nearest civilization's city within reach on
 * their land whose owner has not paid them off, its owner first asked for tribute (`cityStateDemand`); on the way
 * they strike what they meet. With no city to raid they go home. Since save version 63 they hunt, pillage and lay waste
 * on the way and at home alike, fortifying only there (`prowl`).
 */
function swarmTurn(state: GameState, c: City): void {
  const units = state.units.filter((u) => u.homeCity === c.id && u.owner === c.owner && isSoldier(u) && u.aboard === null);
  const home = units.filter((u) => u.x === c.x && u.y === c.y).sort((a, b) => unitType(b.type).defense - unitType(a.type).defense || a.id - b.id);
  const garrison = new Set(home.slice(0, CITY_STATE.garrison).map((u) => u.id));
  for (const g of home.filter((u) => garrison.has(u.id))) if (!strike(state, g, SALLY_ODDS, SALLY_ODDS) && g.order.kind !== "fortified") applyCommand(state, { type: "fortify", unit: g.id });
  const spare = units.filter((u) => !garrison.has(u.id));
  const out = spare.filter((u) => u.x !== c.x || u.y !== c.y);
  const target = state.turn >= CITY_STATE.grace && spare.length && (out.length || spare.length >= CITY_STATE.raid) ? raidTarget(state, c, spare[0]!) : null;
  if (!target) {
    for (const u of spare) {
      if (!state.meekCityStates) prowl(state, u, c);
      else if (u.x === c.x && u.y === c.y) { if (u.order.kind !== "fortified") applyCommand(state, { type: "fortify", unit: u.id }); }
      else applyCommand(state, { type: "goto", unit: u.id, x: c.x, y: c.y });
    }
    return;
  }
  // A raid setting out: its target's owner is asked for tribute first (refused when they cannot pay, or paid already).
  // Since save version 50 a raid under way asks too, once its target's owner has come upon the city-state (its city, or
  // its soldiers in sight, so after they march as well), and the core asks the same civilization once in
  // `CITY_STATE.askEvery` turns at most: a band held at home asked every turn before.
  const victim = target.owner;
  const demand = () => applyCommand(state, { type: "cityStateDemand", city: c.id, player: victim, target: target.id });
  if (!state.eagerCityStates || !out.length) demand();
  for (const u of spare) (state.meekCityStates ? raid(state, u, target) : prowl(state, u, target, true));
  if (!state.eagerCityStates && target.owner === victim && spare.some((u) => state.units.includes(u))) demand();
}

/**
 * The city of a civilization a city-state raids: of the three nearest within `CITY_STATE.reach` on its land, not paid
 * off, that `u` can walk to, the nearest, so a band keeps to one target. From save version 63 until 71 the nearest of
 * those it could storm or has something to wreck round (`lootNear`), else the nearest, which moved as the farms went.
 */
function raidTarget(state: GameState, c: City, u: Unit): City | null {
  const land = getTile(state.map, c.x, c.y)!.continent;
  const near = citiesByDistance(state, c.x, c.y).filter((t) =>
    mapDistance(state.map, c.x, c.y, t.x, t.y) <= CITY_STATE.reach && getTile(state.map, t.x, t.y)!.continent === land && peaceUntil(state, c.id, t.owner) === undefined);
  if (state.meekCityStates || !state.swarmingCityStates) {
    for (const t of near.slice(0, 3)) if (findPath(state, u, t.x, t.y)) return t;
    return null;
  }
  const open = near.slice(0, 3).filter((t) => findPath(state, u, t.x, t.y));
  return open.find((t) => canStorm(state, u, t) || lootNear(state, u, t)) ?? open[0] ?? null;
}

/** A raider's turn before save version 63 (`meekCityStates`): strike what it meets (a city at long odds), else march on the target, fortifying where it stops. */
function raid(state: GameState, u: Unit, target: City): void {
  for (let guard = 0; guard < 4 && state.units.includes(u) && u.movesLeft > 0; guard++) {
    if (strike(state, u, ATTACK_ODDS, STORM_ODDS)) continue;
    const before = u.movesLeft;
    if (!applyCommand(state, { type: "goto", unit: u.id, x: target.x, y: target.y }).ok || u.movesLeft === before) {
      if (u.order.kind !== "fortified") applyCommand(state, { type: "fortify", unit: u.id });
      return;
    }
  }
}

/**
 * A city-state's soldier on the move (since save version 63; asked for 2026-11-03: "city-state units - need to also
 * pillage. and more aggresive - more attack, less fortify near units"), toward `dest`, the city it raids (`raid`) or
 * its home. From the grace on it strikes what is next door (a field fight at `RAID_ODDS`, a city at `STORM_ODDS`),
 * goes after a unit in the open within `HUNT_RANGE` it has those odds against, and wrecks the farms, mines, railroads
 * and fortresses it stands on, wherever they lie on the land of whoever has not paid it off (`plunder`). A city it
 * cannot storm (its odds there were under 1% nine times in ten) it lays waste instead of waiting at its gates: it
 * makes for what lies on that city's land within `LOOT_RANGE` of it (`lootNear`), roads too, and wrecks it, stepping
 * out of its defenders' zone of control first when that bars the way along its walls. Stopped short, it wrecks what it
 * stands on or steps next door onto something to wreck, and waits there ready to strike: it fortifies only at home.
 */
function prowl(state: GameState, u: Unit, dest: City, raid = false): void {
  const hostile = state.turn >= CITY_STATE.grace;
  for (let guard = 0; guard < 4 && state.units.includes(u) && u.movesLeft > 0; guard++) {
    if (hostile && strike(state, u, RAID_ODDS, STORM_ODDS)) continue;
    if (hostile && hunt(state, u)) continue;
    const siege = hostile && raid && dest.owner !== u.owner && !canStorm(state, u, dest);
    const wasting = siege && mapDistance(state.map, u.x, u.y, dest.x, dest.y) <= LOOT_RANGE && landOwner(state, u.x, u.y) === dest.owner;
    if (hostile && plunder(state, u, wasting)) return;
    if (u.x === dest.x && u.y === dest.y) {
      if (u.order.kind !== "fortified") applyCommand(state, { type: "fortify", unit: u.id });
      return;
    }
    const loot = siege ? lootNear(state, u, dest) : null;
    const goal = loot ?? [dest.x, dest.y];
    if (goal[0] === u.x && goal[1] === u.y) return;
    const before = u.movesLeft;
    if (applyCommand(state, { type: "goto", unit: u.id, x: goal[0], y: goal[1] }).ok && u.movesLeft < before) continue;
    if (!hostile) return;
    if (plunder(state, u, true)) return;
    if (toPlunder(state, u)) continue;
    // Held by the defenders' zone of control at the gates: a step out of it, toward the loot, to come at it from there.
    if (!loot || !stepToward(state, u, loot)) return;
  }
}

/** One step to the square next door nearest (x, y) that `u` may enter now (`checkMove`: zones of control too), no city; true if it moved. */
function stepToward(state: GameState, u: Unit, [x, y]: [number, number]): boolean {
  let best: [number, number] | null = null;
  let bestD = Infinity;
  for (const [dx, dy] of NEIGHBOURS) {
    const nx = wrapX(state.map, u.x + dx);
    const ny = u.y + dy;
    if (!getTile(state.map, nx, ny) || cityAt(state, nx, ny)) continue;
    const d = mapDistance(state.map, nx, ny, x, y);
    if (d < bestD && checkMove(state, u, dx, dy).ok) { bestD = d; best = [dx, dy]; }
  }
  return best !== null && applyCommand(state, { type: "move", unit: u.id, dx: best[0], dy: best[1] }).ok;
}

/** Whether `u` could storm `city` (`STORM_ODDS` against its best defender), or walk into it empty. */
function canStorm(state: GameState, u: Unit, city: City): boolean {
  const d = bestDefender(state, city.x, city.y, u);
  return !d || attackOdds(state, u, d) >= STORM_ODDS;
}

/**
 * The square of `city`'s land within `LOOT_RANGE` of it with the most to wreck for the walk to it (farms and mines
 * first, then railroads and fortresses, then roads), free of every other unit; its own square if it stands on such;
 * else null.
 */
function lootNear(state: GameState, u: Unit, city: City): [number, number] | null {
  let best: [number, number] | null = null;
  let bestV = -Infinity;
  for (let dy = -LOOT_RANGE; dy <= LOOT_RANGE; dy++)
    for (let dx = -LOOT_RANGE; dx <= LOOT_RANGE; dx++) {
      const x = wrapX(state.map, city.x + dx);
      const y = city.y + dy;
      const t = getTile(state.map, x, y);
      if (!t || cityAt(state, x, y) || landOwner(state, x, y) !== city.owner || !plunderable(state, u, x, y)) continue;
      const worth = t.irrigation || t.mine ? 3 : t.railroad || t.fortress ? 2 : t.road ? 1 : 0;
      if (!worth || state.units.some((o) => o.x === x && o.y === y && o.id !== u.id)) continue;
      const v = worth * 2 - mapDistance(state.map, u.x, u.y, x, y);
      if (v > bestV) { bestV = v; best = [x, y]; }
    }
  return best;
}

/** Whether a city-state's soldier may wreck what lies on square (x, y): another civilization's land, one that has not paid it off. */
function plunderable(state: GameState, u: Unit, x: number, y: number): boolean {
  const owner = landOwner(state, x, y);
  return owner >= 0 && owner !== u.owner && owner !== state.barbarians && !boughtOff(state, u, owner);
}

/** Wreck what the soldier stands on (`pillageTarget`), if it may: anything but a road on the way, a road too once `stuck`. True if it did. */
function plunder(state: GameState, u: Unit, stuck: boolean): boolean {
  const loot = pillageTarget(state, u);
  if (!loot || (loot === "road" && !stuck) || !plunderable(state, u, u.x, u.y)) return false;
  return applyCommand(state, { type: "pillage", unit: u.id }).ok;
}

/** Step next door onto a square it may wreck, farms and mines first; true if it moved. */
function toPlunder(state: GameState, u: Unit): boolean {
  let best: [number, number] | null = null;
  let bestV = 0;
  for (const [dx, dy] of NEIGHBOURS) {
    const x = wrapX(state.map, u.x + dx);
    const y = u.y + dy;
    const t = getTile(state.map, x, y);
    if (!t || cityAt(state, x, y) || !plunderable(state, u, x, y)) continue;
    const v = t.irrigation || t.mine ? 3 : t.railroad || t.fortress ? 2 : t.road ? 1 : 0;
    if (v > bestV && checkMove(state, u, dx, dy).ok) { bestV = v; best = [dx, dy]; }
  }
  return best !== null && applyCommand(state, { type: "move", unit: u.id, dx: best[0], dy: best[1] }).ok;
}

/** Go after the enemy unit in the open within `HUNT_RANGE` (not next door: `strike` has those) it has the best odds against, `RAID_ODDS` at least; true if it drew closer. */
function hunt(state: GameState, u: Unit): boolean {
  const here = getTile(state.map, u.x, u.y)!.continent;
  const seen = new Set<number>();
  let best: { x: number; y: number; p: number; d: number } | null = null;
  for (const o of state.units) {
    if (o.owner === u.owner || o.owner === state.barbarians || o.aboard !== null) continue;
    const d = mapDistance(state.map, u.x, u.y, o.x, o.y);
    if (d <= 1 || d > HUNT_RANGE || seen.has(o.y * state.map.width + o.x)) continue;
    seen.add(o.y * state.map.width + o.x);
    const t = getTile(state.map, o.x, o.y)!;
    if (t.terrain === Terrain.Ocean || t.continent !== here || cityAt(state, o.x, o.y) || boughtOff(state, u, o.owner)) continue;
    const foe = bestDefender(state, o.x, o.y, u);
    if (!foe) continue;
    const p = attackOdds(state, u, foe);
    if (p < RAID_ODDS) continue;
    if (!best || p > best.p || (p === best.p && d < best.d)) best = { x: o.x, y: o.y, p, d };
  }
  if (!best) return false;
  const path = findPath(state, u, best.x, best.y);
  if (!path || path.length > HUNT_RANGE + 2) return false;
  const before = u.movesLeft;
  return applyCommand(state, { type: "goto", unit: u.id, x: best.x, y: best.y }).ok && u.movesLeft < before;
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
