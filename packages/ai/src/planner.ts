import {
  advance,
  applyCommand,
  slotInLand,
  atPeace,
  atWar,
  attackOdds,
  attackStrength,
  attrition,
  advancesFor,
  type AdvanceRule,
  availableAdvances,
  bestDefender,
  building,
  buildOptions,
  buyCost,
  canEnter,
  canFoundCity,
  canHelpWonder,
  canTradeRoute,
  cargo,
  cityAt,
  cityDistance,
  coastal,
  computeCity,
  defenseStrength,
  FINAL_TURN,
  findPath,
  firepower,
  freeUnits,
  paysShields,
  getTile,
  government,
  governmentsAvailable,
  esteem,
  hasContact,
  hasWaterNearby,
  peaceOffered,
  relation,
  trespassers,
  trespassRecord,
  MAX_TRADE_ROUTES,
  NEIGHBOURS,
  needsRoads,
  nextInt,
  radiusTile,
  shipStats,
  CITY_RADIUS,
  Terrain,
  TERRAIN_RULES,
  tileTrade,
  tileYield,
  TRADE_ROUTE_MIN_DIST,
  unitById,
  unitSupport,
  unitType,
  wonder,
  wonderBuilt,
  wrapX,
  type City,
  type CityReport,
  type GameState,
  type Player,
  type Production,
  type SpacePart,
  type Spaceship,
  type Unit,
  type UnitTypeRule,
  type WorkKind,
} from "@civ/core";
import { baselineTurn } from "./baseline.js";

/**
 * Planning opponent (AI v3). Once per turn it sizes up the empire — home
 * continent, free city sites at home and overseas, threats around each
 * city, who is worth a war — and then lets that picture drive research
 * beelines, government, tax rates, technology trades, city production,
 * purchases, ferries, campaigns and unit orders. Everything is derived from
 * `GameState` each turn (no memory between calls; a ship's or soldier's goto
 * order is the only plan it keeps, and that is game state) and all
 * randomness comes from `state.rng`, so games replay exactly.
 */
export function plannerTurn(state: GameState): void {
  const me = state.currentPlayer;
  const p = state.players[me]!;
  if (!p.isAi) return;
  if (me === state.barbarians) { baselineTurn(state); return; }

  const ctx = analyse(state, me);
  manageResearch(state, ctx);
  manageGovernment(state, ctx);
  manageDiplomacy(state, ctx);
  guardBorders(state, ctx);
  manageTrade(state, ctx);
  manageSpaceship(state, ctx);
  manageCities(state, ctx);
  manageUpkeep(state, ctx);
  manageRates(state, ctx);
  rebalanceGarrisons(state, ctx);
  assault(state, ctx);

  let guard = 0;
  while (state.activeUnit !== null && guard++ < 600) {
    const u = unitById(state, state.activeUnit);
    if (!u) break;
    const before = { x: u.x, y: u.y, moves: u.movesLeft, order: u.order.kind };
    orderUnit(state, ctx, u);
    const same = state.activeUnit === u.id && u.x === before.x && u.y === before.y && u.movesLeft === before.moves && u.order.kind === before.order;
    if (same) applyCommand(state, { type: "skip", unit: u.id });
  }
}

/** What the planner sees for one civ, for tests and the tournament harness: free sites at home and overseas, the colony plan. */
export function describePlan(state: GameState, me: number): {
  sites: number; overseasSites: number; wantOverseas: boolean; ferries: number;
  atWarWith: number[]; warTarget: { x: number; y: number; owner: number } | null; staging: { x: number; y: number } | null; campaignReady: boolean; attackers: number;
} {
  const ctx = analyse(state, me);
  return {
    sites: ctx.sites().length, overseasSites: ctx.overseasSites().length, wantOverseas: ctx.wantOverseas(), ferries: ctx.ferries,
    atWarWith: ctx.atWarWith,
    warTarget: ctx.warTarget ? { x: ctx.warTarget.x, y: ctx.warTarget.y, owner: ctx.warTarget.owner } : null,
    staging: ctx.staging ? { x: ctx.staging.x, y: ctx.staging.y } : null,
    campaignReady: ctx.campaignReady,
    attackers: ctx.units.filter(isAttacker).length,
  };
}

// ---- empire picture ----------------------------------------------------------

interface Site { x: number; y: number; score: number }

interface Ctx {
  me: number;
  p: Player;
  turn: number;
  cities: City[];
  units: Unit[];
  reports: Map<number, CityReport>;
  /** Owners whose units may be attacked (at war, plus barbarians). */
  enemies: Set<number>;
  atWarWith: number[];
  /** Continent ids where I have cities (or settlers, before the first city). */
  continents: Set<number>;
  /** Hostile land units within 3 tiles of each city. */
  threat: Map<number, number>;
  wanted: Map<number, number>;
  /** The enemy city the campaign is aimed at: reachable over land, near, lightly held, worth the odds. */
  warTarget: City | null;
  /** Our city nearest the target, where attackers gather before they march. */
  staging: City | null;
  /** Enough attackers, and an escort, stand between the staging city and the target to march on it. */
  campaignReady: boolean;
  /** Only foot soldiers can reach the target (rough ground without roads): wheeled units stay out of the march. */
  campaignFoot: boolean;
  /** The square beside the target the army camps on: the best ground to hold while it storms the walls. */
  camp: [number, number] | null;
  /** Defenders marching with (or wanted for) the army, and how many it wants: one for every three attackers. */
  escorts: number;
  escortsWanted: number;
  income: number;
  /** Beakers per turn across the empire; zero means the civ is not getting any trade. */
  science: number;
  /** Lazily computed candidate city sites on my continents. */
  sites: () => Site[];
  wantMoreCities: boolean;
  military: number;
  militaryCap: number;
  armyWanted: number;
  workersWanted: number;
  /** Tile index -> id of the city working it or sitting on it (every civ), kept current as citizens move. */
  tileWorker: Map<number, number>;
  /** Tiles holding a foreign unit. */
  foreignUnitTiles: Set<number>;
  /** Per-city terraforming jobs, computed on demand this turn. */
  jobs: Map<number, Job[]>;
  /** Extra military units to send out looking for land, early on. */
  scoutsWanted: number;
  /** Our continents still hold land we have not seen. */
  landUnexplored: boolean;
  /** Ships wanted for exploring the coasts and seas, and ships we have (or are building). */
  /** Ships wanted for exploring (computed on first use: it searches the sea). */
  seaExplorersWanted: () => number;
  /** Some unknown water is reachable by a trireme (computed on first use). */
  coastFrontier: () => boolean;
  ships: number;
  /** A city of mine building a wonder that still needs a caravan's worth of shields. */
  wonderSite: City | null;
  /** Caravans alive or ordered this turn. */
  caravans: number;
  /** The Apollo Program stands and we can build parts: the race is on. */
  spaceRace: boolean;
  /** A foreign city worth sending a diplomat to, if any. */
  spyTarget: City | null;
  diplomats: number;
  /** Cities already producing an attacker this turn. */
  armyBuilding: number;
  /** Fit coastal sites on continents where we have no city yet (computed on first use). */
  overseasSites: () => Site[];
  /** A coastal city of ours has no room left at home while land waits overseas: ferry settlers out. */
  wantOverseas: () => boolean;
  /** Ships that can carry settlers, alive or being built, and how many we want on ferry duty. */
  ferries: number;
  ferriesWanted: number;
  /** Settlers waiting for (or riding) a ferry, or being built to. */
  overseasSettlers: number;
}

function dist(state: GameState, x1: number, y1: number, x2: number, y2: number): number {
  const dx = Math.abs(x1 - x2);
  return Math.max(Math.min(dx, state.map.width - dx), Math.abs(y1 - y2));
}

function isMilitary(u: Unit): boolean {
  const t = unitType(u.type);
  return t.domain === "land" && t.attack > 0;
}

function isAttacker(u: Unit): boolean {
  const t = unitType(u.type);
  return t.attack > t.defense || (t.attack >= 2 && t.moves >= 2);
}

function isSettler(u: Unit): boolean {
  return unitType(u.type).flags?.includes("settler") === true;
}

/** A ship that can carry settlers (a carrier's deck is for aircraft). */
function isFerry(u: Unit): boolean {
  const t = unitType(u.type);
  return t.domain === "sea" && (t.capacity ?? 0) >= 2 && u.type !== "carrier";
}

function continentOf(state: GameState, x: number, y: number): number {
  return getTile(state.map, x, y)!.continent;
}

function analyse(state: GameState, me: number): Ctx {
  const p = state.players[me]!;
  const cities = state.cities.filter((c) => c.owner === me);
  const units = state.units.filter((u) => u.owner === me);
  const reports = new Map<number, CityReport>();
  let income = 0;
  let science = 0;
  for (const c of cities) {
    const r = computeCity(state, c);
    reports.set(c.id, r);
    income += r.tax - r.buildingUpkeep;
    science += r.science;
  }
  const enemies = new Set<number>([state.barbarians]);
  const atWarWith: number[] = [];
  for (const o of state.players) {
    if (o.id === me || o.id === state.barbarians || !o.alive) continue;
    if (atWar(state, me, o.id)) { enemies.add(o.id); atWarWith.push(o.id); }
  }
  const continents = new Set<number>();
  for (const c of cities) continents.add(getTile(state.map, c.x, c.y)!.continent);
  if (continents.size === 0) for (const u of units) continents.add(getTile(state.map, u.x, u.y)!.continent);
  // A city the barbarians hold on our own land is a war to win back, like any other.
  if (state.cities.some((c) => c.owner === state.barbarians && continents.has(getTile(state.map, c.x, c.y)!.continent))) atWarWith.push(state.barbarians);

  const hostile = state.units.filter((u) => enemies.has(u.owner) && isMilitary(u) && u.aboard === null);
  const threat = new Map<number, number>();
  const wanted = new Map<number, number>();
  const foreignCities = state.cities.filter((c) => c.owner !== me);
  for (const c of cities) {
    let near = 0;
    for (const h of hostile) if (dist(state, h.x, h.y, c.x, c.y) <= 3) near++;
    threat.set(c.id, near);
    // Where every unit costs a shield (no free units under the government) garrisons stay lean unless
    // trouble is near; elsewhere peacetime guards fill the free units the city has.
    const free = freeUnits(state, c);
    let w = 1;
    if (near > 0) w++;
    if (near >= 3) w++;
    if (free > 0) {
      let extra = 0;
      if (c.size >= 5) extra++;
      if (state.turn >= 120 && coastal(state, c)) extra++;
      if (foreignCities.some((f) => dist(state, f.x, f.y, c.x, c.y) <= 6)) extra++;
      w += Math.min(extra, Math.max(0, free - w));
    }
    if (state.turn < 20) w = 1;
    wanted.set(c.id, Math.min(4, w));
  }

  // Campaign target: the enemy city nearest our own, counting its defenders and walls, that our
  // best attacker has a real chance against; and the city of ours where the army gathers for it.
  let warTarget: City | null = null;
  let staging: City | null = null;
  let best = Infinity;
  const attackers = units.filter((u) => isAttacker(u) && unitType(u.type).domain === "land");
  const champion = attackers.reduce<Unit | null>((a, b) => (!a || attackStrength(b) > attackStrength(a) ? b : a), null);
  // Wheels need roads over rough ground: when our best gun cannot get there, the best foot soldier may.
  const footChampion = attackers.filter((u) => !needsRoads(state, unitType(u.type))).reduce<Unit | null>((a, b) => (!a || attackStrength(b) > attackStrength(a) ? b : a), null);
  // The army's own orders are the campaign's memory: a city our attackers already march on or stand
  // beside stays the target while it is still worth it, so they do not chase a new one every turn.
  const committed = new Map<number, number>();
  for (const u of attackers) {
    for (const c of state.cities) {
      if (!atWarWith.includes(c.owner)) continue;
      const marching = u.order.kind === "goto" && u.order.x === c.x && u.order.y === c.y;
      if (marching || dist(state, u.x, u.y, c.x, c.y) <= 1) committed.set(c.id, (committed.get(c.id) ?? 0) + 1);
    }
  }
  const candidates: { c: City; mine: City; v: number; need: number }[] = [];
  for (const c of state.cities) {
    if (!atWarWith.includes(c.owner) || !continents.has(getTile(state.map, c.x, c.y)!.continent)) continue;
    // How many of our best attackers it takes to empty the city in one turn; beyond ten it is not worth it.
    const need = champion ? attackersNeeded(state, champion, c.x, c.y) : 99;
    if (need > 10) continue;
    let near: City | null = null;
    let nearD = 16;
    for (const mine of cities) {
      const d = dist(state, c.x, c.y, mine.x, mine.y);
      if (d < nearD && continentOf(state, mine.x, mine.y) === continentOf(state, c.x, c.y)) { nearD = d; near = mine; }
    }
    if (!near) continue;
    candidates.push({ c, mine: near, need, v: nearD + 2 * need - 6 * Math.min(4, committed.get(c.id) ?? 0) });
  }
  candidates.sort((a, b) => a.v - b.v);
  let need = 3;
  let campaignFoot = false;
  // The army must be able to walk there from the staging city: rival cities and soldiers block the
  // way, and rough ground without roads stops wheels. If only foot soldiers get through, they go alone.
  const walks = (u: Unit, cand: { c: City; mine: City }) => findPath(state, { ...u, x: cand.mine.x, y: cand.mine.y }, cand.c.x, cand.c.y) !== null;
  for (const cand of candidates.slice(0, 3)) {
    if (!champion || walks(champion, cand)) {
      warTarget = cand.c;
      staging = cand.mine;
      need = Math.min(10, Math.max(3, cand.need + 1));
      break;
    }
    if (footChampion && footChampion !== champion && walks(footChampion, cand)) {
      const footNeed = attackersNeeded(state, footChampion, cand.c.x, cand.c.y);
      if (footNeed > 10) continue;
      warTarget = cand.c;
      staging = cand.mine;
      need = Math.min(10, Math.max(3, footNeed + 1));
      campaignFoot = true;
      break;
    }
  }
  void best;
  let campaignReady = false;
  let camp: [number, number] | null = null;
  let escorts = 0;
  let escortsWanted = 0;
  if (warTarget && staging) {
    const t = warTarget;
    // The camp must take every kind of soldier that marches: off the road, mountains take none of them and
    // rough ground no wheels. In a foot-only campaign no wheeled unit marches, so the camp may stand on rough ground.
    const marches = (u: Unit) => !campaignFoot || !needsRoads(state, unitType(u.type));
    const marchers = [...new Set(units.filter((u) => isMilitary(u) && unitType(u.type).domain === "land" && marches(u)).map((u) => u.type))].map(unitType);
    camp = campSquare(state, me, t, staging, marchers);
    const span = dist(state, staging.x, staging.y, t.x, t.y) + 2;
    const gathered = attackers.filter((u) => marches(u) && u.aboard === null && dist(state, u.x, u.y, t.x, t.y) <= span).length;
    escorts = units.filter((u) => marches(u) && isMilitary(u) && !isAttacker(u) && u.aboard === null && !cityAt(state, u.x, u.y) && dist(state, u.x, u.y, t.x, t.y) <= span).length;
    escortsWanted = Math.max(1, Math.ceil(need / 3));
    campaignReady = gathered >= need && escorts >= 1;
  }

  let reachMap: Uint8Array | null = null;
  const reach = () => (reachMap ??= landReach(state, me, cities));
  let cached: Site[] | null = null;
  const sites = () => (cached ??= findSites(state, me, continents, cities, cities.length > 0 ? reach() : null));
  const atWarNow = atWarWith.length > 0;
  const tileWorker = new Map<number, number>();
  for (const c of state.cities) {
    tileWorker.set(c.y * state.map.width + c.x, c.id);
    for (const s of c.worked) {
      const [dx, dy] = CITY_RADIUS[s]!;
      tileWorker.set((c.y + dy) * state.map.width + wrapX(state.map, c.x + dx), c.id);
    }
  }
  const foreignUnitTiles = new Set<number>();
  for (const u of state.units) if (u.owner !== me) foreignUnitTiles.add(u.y * state.map.width + u.x);
  let wonderSite: City | null = null;
  for (const c of cities) if (c.production.kind === "wonder" && wonder(c.production.id).cost - c.shields >= 100) { wonderSite = c; break; }
  const spaceRace = wonderBuilt(state, "apollo_program") && p.advances.includes("space_flight") && p.spaceship.launched === null && !p.spaceship.arrived;
  const spyTarget = findSpyTarget(state, me, cities, continents, enemies);
  // Exploration: unseen land at home keeps a scout out; once Map Making is known, a ship
  // charts the seas while some unknown can still be reached from our ports by a ship we can build.
  let landUnexplored = false;
  for (let i = 0; i < state.map.tiles.length && !landUnexplored; i++) {
    const t = state.map.tiles[i]!;
    if (!p.explored[i] && t.terrain !== Terrain.Ocean && continents.has(t.continent)) landUnexplored = true;
  }
  let frontier: { coast: boolean; open: boolean } | null = null;
  const seaFrontiers = (): { coast: boolean; open: boolean } => {
    if (frontier) return frontier;
    const ports = cities.filter((c) => coastal(state, c)).map((c) => c.y * state.map.width + c.x);
    if (!p.advances.includes("map_making") || !ports.length || state.turn < 30) return (frontier = { coast: false, open: false });
    const coast = seaFrontierFrom(state, me, ports, true) !== null;
    const openSeaShip = p.advances.includes("navigation") || p.advances.includes("magnetism") || p.advances.includes("steam_engine");
    const open = coast || (openSeaShip && seaFrontierFrom(state, me, ports, false) !== null);
    return (frontier = { coast, open });
  };
  const coastFrontier = () => seaFrontiers().coast;
  const seaExplorersWanted = () => (seaFrontiers().open ? (cities.length >= 10 ? 2 : 1) : 0);
  let overseas: Site[] | null = null;
  const overseasSites = () => (overseas ??= findOverseasSites(state, me, reach()));
  let overseasWanted: boolean | null = null;
  const wantOverseas = () => (overseasWanted ??=
    cities.length > 0 && cities.length < 24 && p.advances.includes("map_making") &&
    cities.some((c) => coastal(state, c) && !sitesOn(state, sites(), c.x, c.y)) &&
    overseasSites().length > 0);
  return {
    overseasSites, wantOverseas,
    ferries: units.filter(isFerry).length + cities.filter((c) => c.production.kind === "unit" && isFerry({ type: c.production.id } as Unit)).length,
    ferriesWanted: cities.length >= 12 ? 2 : 1,
    overseasSettlers: 0,
    tileWorker, foreignUnitTiles, jobs: new Map(), wonderSite, spaceRace, spyTarget,
    diplomats: units.filter((u) => unitType(u.type).flags?.includes("diplomat")).length,
    armyBuilding: cities.filter((c) => c.production.kind === "unit" && isAttacker({ type: c.production.id } as Unit)).length,
    caravans: units.filter((u) => unitType(u.type).flags?.includes("caravan")).length,
    me, p, turn: state.turn, cities, units, reports, enemies, atWarWith, continents, threat, wanted, warTarget, staging, campaignReady, campaignFoot, camp, escorts, escortsWanted, income, science, sites,
    wantMoreCities: cities.length < 24,
    military: units.filter(isMilitary).length,
    militaryCap: Math.floor(cities.length * (atWarNow ? 4 : cities.every((c) => freeUnits(state, c) === 0) ? 1.5 : 2)) + 2,
    armyWanted: atWarNow ? 2 + cities.length : Math.ceil(cities.length / 3),
    workersWanted: cities.length >= 3 ? Math.floor(cities.length / 3) : 0,
    scoutsWanted: Math.max(0, (state.turn < 150 ? Math.min(2, 1 + Math.floor(cities.length / 4)) : landUnexplored ? 1 : 0) - units.filter((u) => isMilitary(u) && !cityAt(state, u.x, u.y)).length),
    landUnexplored,
    seaExplorersWanted,
    coastFrontier,
    ships: units.filter((u) => unitType(u.type).domain === "sea").length + cities.filter((c) => c.production.kind === "unit" && unitType(c.production.id).domain === "sea").length,
  };
}

/**
 * The square beside an enemy city to camp the army on: open land (no city,
 * no foreign unit) that every one of `marchers` can enter, the best defence
 * the terrain gives, on the side facing the staging city, off ground that
 * wears the waiting army down.
 */
function campSquare(state: GameState, me: number, target: City, staging: City, marchers: UnitTypeRule[]): [number, number] | null {
  let best: [number, number] | null = null;
  let bestV = -Infinity;
  for (const [dx, dy] of NEIGHBOURS) {
    const x = wrapX(state.map, target.x + dx);
    const y = target.y + dy;
    const t = getTile(state.map, x, y);
    if (!t || t.terrain === Terrain.Ocean || cityAt(state, x, y)) continue;
    if (state.units.some((o) => o.owner !== me && o.x === x && o.y === y)) continue;
    if (marchers.some((ty) => !canEnter(state, ty, t))) continue;
    const v = TERRAIN_RULES[t.terrain].defense * 10 + (t.river ? 3 : 0) + (t.fortress ? 10 : 0) - 100 * attrition(state, me, x, y) - dist(state, x, y, staging.x, staging.y);
    if (v > bestV) { bestV = v; best = [x, y]; }
  }
  return best;
}

/**
 * Who to spy on: the nearest reachable foreign city whose people know
 * several advances we lack. At peace only a clearly weaker civ with a big
 * lead is worth the war that follows.
 */
function findSpyTarget(state: GameState, me: number, cities: City[], continents: Set<number>, enemies: Set<number>): City | null {
  const p = state.players[me]!;
  if (!p.advances.includes("writing") || cities.length < 5) return null;
  const mine = strength(state, me);
  let best: City | null = null;
  let bestD = 15;
  for (const c of state.cities) {
    if (c.owner === me || c.owner === state.barbarians || !hasContact(state, me, c.owner)) continue;
    if (!continents.has(getTile(state.map, c.x, c.y)!.continent)) continue;
    const o = state.players[c.owner]!;
    const lead = o.advances.filter((a) => !p.advances.includes(a)).length;
    const hostile = enemies.has(c.owner);
    if (lead < (hostile ? 1 : 6)) continue;
    if (!hostile && strength(state, c.owner) * 1.5 > mine) continue;
    for (const m of cities) {
      const d = dist(state, c.x, c.y, m.x, m.y);
      if (d < bestD) { bestD = d; best = c; }
    }
  }
  return best;
}

// ---- city sites ----------------------------------------------------------------

const CENTRE_OK = new Set([Terrain.Grassland, Terrain.Plains, Terrain.Hills, Terrain.Desert, Terrain.Forest]);

/** How far (in steps over land) settlers are sent from our cities; land beyond, or behind rival cities, is reached by sea. */
const REACH = 18;

/**
 * How near (squares, either way) a new city may stand to one of ours and to anyone else's (asked for
 * 2026-10-22: settlers founded wherever they stood, often two squares from a city). Saves before
 * version 22 (`packedCities`) keep the old habit: four squares from a listed site, anywhere the rules
 * allow for a settler already standing on a fit square.
 */
export const CITY_SPACING = { own: 4, foreign: 5 };

/** Far enough from every city for a new one of `me`'s. */
export function roomForCity(state: GameState, me: number, x: number, y: number): boolean {
  for (const c of state.cities) {
    const d = dist(state, c.x, c.y, x, y);
    if (state.packedCities ? d < CITY_SPACING.own : d < (c.owner === me ? CITY_SPACING.own : CITY_SPACING.foreign)) return false;
  }
  return true;
}

/**
 * Land our settlers can walk to: breadth-first over land from every city of
 * ours, up to REACH steps, never through a rival's city. 1 marks a square
 * within reach.
 */
function landReach(state: GameState, me: number, cities: City[]): Uint8Array {
  const { width: w, height: h } = state.map;
  const reach = new Uint8Array(w * h);
  const steps = new Int16Array(w * h).fill(-1);
  const rival = new Uint8Array(w * h);
  for (const c of state.cities) if (c.owner !== me) rival[c.y * w + c.x] = 1;
  const queue: number[] = [];
  for (const c of cities) { const i = c.y * w + c.x; steps[i] = 0; reach[i] = 1; queue.push(i); }
  for (let head = 0; head < queue.length; head++) {
    const i = queue[head]!;
    if (steps[i]! >= REACH) continue;
    const x = i % w;
    const y = Math.floor(i / w);
    for (const [dx, dy] of NEIGHBOURS) {
      const ny = y + dy;
      if (ny < 0 || ny >= h) continue;
      const ni = ny * w + wrapX(state.map, x + dx);
      if (steps[ni]! >= 0 || rival[ni] || state.map.tiles[ni]!.terrain === Terrain.Ocean) continue;
      steps[ni] = steps[i]! + 1;
      reach[ni] = 1;
      queue.push(ni);
    }
  }
  return reach;
}

/** Value of founding a city at (x, y): yields of the 21-tile radius plus terrain bonuses; null if unfit. */
export function siteScore(state: GameState, x: number, y: number): number | null {
  const t = getTile(state.map, x, y);
  if (!t || !CENTRE_OK.has(t.terrain)) return null;
  if ((t.terrain === Terrain.Desert || t.terrain === Terrain.Forest) && !t.river) return null;
  let score = 0;
  let land = 0;
  let sea = 0;
  for (let slot = 1; slot < CITY_RADIUS.length; slot++) {
    const [dx, dy] = CITY_RADIUS[slot]!;
    const n = getTile(state.map, x + dx, y + dy);
    if (!n) continue;
    if (n.terrain === Terrain.Ocean) sea++;
    else land++;
    const yld = tileYield(state, n, false, "monarchy");
    score += yld.food * 3 + yld.shields * 2 + yld.trade * 1.5;
    if (n.special) score += 2;
  }
  if (land < 7) return null;
  if (t.river) score += 5;
  if (t.terrain === Terrain.Hills) score += 3;
  if (sea > 0) score += 2;
  return score;
}

function findSites(state: GameState, me: number, continents: Set<number>, cities: City[], reach: Uint8Array | null): Site[] {
  const p = state.players[me]!;
  const { width: w, height: h } = state.map;
  const out: Site[] = [];
  for (let y = 2; y < h - 2; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!p.explored[i]) continue;
      const t = state.map.tiles[i]!;
      if (!continents.has(t.continent) || !CENTRE_OK.has(t.terrain)) continue;
      if (!roomForCity(state, me, x, y) || canFoundCity(state, x, y) !== null) continue;
      let ownNear = 99;
      for (const c of state.cities) if (c.owner === me) ownNear = Math.min(ownNear, dist(state, c.x, c.y, x, y));
      if (reach && !reach[i]) continue;
      const s = siteScore(state, x, y);
      if (s === null) continue;
      const compact = cities.length === 0 ? 0 : ownNear <= 6 ? 6 : ownNear <= 8 ? 2 : -4;
      out.push({ x, y, score: s + compact });
    }
  }
  return out;
}

/** Some free site lies on the same continent as (x, y). */
function sitesOn(state: GameState, sites: Site[], x: number, y: number): boolean {
  const cont = getTile(state.map, x, y)!.continent;
  return sites.some((s) => getTile(state.map, s.x, s.y)!.continent === cont);
}

function hasOcean(state: GameState, x: number, y: number): boolean {
  for (const [dx, dy] of NEIGHBOURS) if (getTile(state.map, x + dx, y + dy)?.terrain === Terrain.Ocean) return true;
  return false;
}

/**
 * Sites for a colony: known land by the sea (a ship puts the settlers
 * straight onto it) on continents where we have no city, or on our own but
 * beyond walking reach of our cities, clear of every city. Land a rival has
 * already settled nearby scores lower.
 */
function findOverseasSites(state: GameState, me: number, reach: Uint8Array): Site[] {
  const p = state.players[me]!;
  const { width: w, height: h } = state.map;
  const out: Site[] = [];
  for (let y = 2; y < h - 2; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!p.explored[i]) continue;
      const t = state.map.tiles[i]!;
      if (t.terrain === Terrain.Ocean || !CENTRE_OK.has(t.terrain)) continue;
      if (!hasOcean(state, x, y)) continue;
      if (reach[i]) continue;
      if (!roomForCity(state, me, x, y) || canFoundCity(state, x, y) !== null) continue;
      let rivals = 0;
      for (const c of state.cities) if (c.owner !== me && dist(state, c.x, c.y, x, y) <= 6) rivals++;
      const s = siteScore(state, x, y);
      if (s === null) continue;
      out.push({ x, y, score: s - 8 * rivals });
    }
  }
  return out;
}

// ---- research ----------------------------------------------------------------------

const GOALS = [
  "bronze_working", "alphabet", "ceremonial_burial", "code_of_laws", "monarchy", "currency", "writing", "pottery",
  "trade", "literacy", "masonry", "mathematics", "iron_working", "philosophy", "horseback_riding", "the_wheel",
  "construction", "astronomy", "university", "the_republic", "feudalism", "chivalry", "banking", "medicine", "weaving",
  "navigation", "invention", "gunpowder", "physics", "theory_of_gravity", "engineering", "bridge_building", "metallurgy",
  "conscription", "magnetism", "democracy", "steam_engine", "railroad", "industrialization", "electricity",
  "the_corporation", "explosives", "chemistry", "refining", "combustion", "steel", "automobile", "electronics", "flight",
  "mass_production", "advanced_flight", "communism", "labor_union", "computers", "rocketry", "atomic_theory",
  "nuclear_fission", "nuclear_power", "space_flight", "plastics", "superconductor", "robotics", "recycling",
  "genetic_engineering", "fusion_power",
  // The extended tree's modern advances (a 1991-tree game has none of them, and reaches Future Tech. instead).
  "the_internet", "renewable_energy", "mobile_phones", "artificial_intelligence", "quantum_computing", "future_tech",
];
const WAR_GOALS = ["bronze_working", "iron_working", "mathematics", "feudalism", "chivalry", "gunpowder"];

/** An advance and everything beneath it in a tree (an advance the tree lacks stands alone). */
const CLOSURES = new Map<readonly AdvanceRule[], Map<string, Set<string>>>();
function closure(id: string, tree: readonly AdvanceRule[]): Set<string> {
  let memo = CLOSURES.get(tree);
  if (!memo) CLOSURES.set(tree, (memo = new Map()));
  let s = memo.get(id);
  if (s) return s;
  s = new Set([id]);
  for (const r of tree.find((a) => a.id === id)?.requires ?? []) for (const x of closure(r, tree)) s.add(x);
  memo.set(id, s);
  return s;
}

/**
 * The available advance that moves toward the first unmet goal. `seaward`
 * (a coastal civ that has run out of land to explore, or met nobody) puts
 * Map Making first so its ships can go and look; `oceanward` (a civ boxed
 * in with no free coast in sight) puts Navigation next, for ships that can
 * cross the open sea.
 */
export function pickResearch(known: string[], tree: readonly AdvanceRule[], atWar: boolean, seaward = false, oceanward = false): string | null {
  const avail = availableAdvances(known, tree);
  if (avail.length === 0) return null;
  const have = new Set(known);
  const goals = [...(seaward ? ["map_making"] : []), ...(oceanward ? ["navigation"] : []), ...(atWar ? WAR_GOALS : []), ...GOALS];
  for (const g of goals) {
    if (have.has(g)) continue;
    const need = closure(g, tree);
    const pick = avail.find((a) => need.has(a.id));
    if (pick) return pick.id;
  }
  return avail[0]!.id;
}

function manageResearch(state: GameState, ctx: Ctx): void {
  if (ctx.p.researching !== null) return;
  const threatened = ctx.atWarWith.length > 0 || [...ctx.threat.values()].some((t) => t > 0);
  const lonely = ctx.turn >= 50 && !state.players.some((o) => o.id !== ctx.me && o.id !== state.barbarians && o.alive && hasContact(state, ctx.me, o.id));
  // Out of room at home: ships are the way to new land.
  const cramped = ctx.cities.length > 0 && ctx.sites().length < 2;
  const seaward = ctx.cities.some((c) => coastal(state, c)) && (!ctx.landUnexplored || lonely || cramped);
  const oceanward = seaward && cramped && ctx.p.advances.includes("map_making") && ctx.overseasSites().length === 0;
  const pick = pickResearch(ctx.p.advances, advancesFor(state), threatened, seaward, oceanward);
  if (pick) applyCommand(state, { type: "research", advance: pick });
}

// ---- government, rates, diplomacy -------------------------------------------------

function bestGovernment(state: GameState, ctx: Ctx): string {
  const avail = governmentsAvailable(state, ctx.me);
  const abroad = ctx.units.filter((u) => isMilitary(u) && !cityAt(state, u.x, u.y)).length;
  if (avail.includes("republic") && ctx.atWarWith.length === 0 && ctx.cities.length >= 6 && abroad <= 1 && ctx.turn >= 100 && ctx.military <= ctx.cities.length * 1.5) return "republic";
  // Under the original's upkeep Monarchy pays a shield for every unit, while Despotism keeps as many free as
  // each city's size: head to head, going from Despotism straight to the Republic won more. Old saves keep Monarchy.
  if (avail.includes("monarchy") && state.looseUpkeep) return "monarchy";
  return "despotism";
}

function manageGovernment(state: GameState, ctx: Ctx): void {
  const p = ctx.p;
  if (p.government === "anarchy") {
    if (p.anarchyTurns === 0) applyCommand(state, { type: "setGovernment", government: bestGovernment(state, ctx) });
    return;
  }
  const best = bestGovernment(state, ctx);
  const rank: Record<string, number> = { despotism: 0, monarchy: 1, republic: 2 };
  const underAttack = [...ctx.threat.values()].some((t) => t > 0);
  if ((rank[best] ?? 0) > (rank[p.government] ?? 0) && !underAttack) applyCommand(state, { type: "revolution" });
}

function manageRates(state: GameState, ctx: Ctx): void {
  const p = ctx.p;
  const max = government(p.government).maxRate;
  let tax = p.taxRate;
  const disorder = [...ctx.reports.values()].filter((r) => r.disorder).length;
  let lux = ctx.cities.length >= 4 && disorder * 3 >= ctx.cities.length ? 2 : 0;
  // Science first: raise taxes only when the treasury is about to run dry, ease them once there is a cushion.
  const floor = 15 + 3 * ctx.cities.length;
  if (p.gold < floor && ctx.income < 1) tax = Math.min(max, tax + 1);
  else if (p.gold > 4 * floor && ctx.income >= 0) tax = Math.max(1, tax - 1);
  let sci = 10 - tax - lux;
  if (sci > max) { sci = max; tax = 10 - lux - sci; }
  if (tax > max) { tax = max; lux = 10 - tax - sci; }
  if (lux > max) return;
  if (tax !== p.taxRate || lux !== p.luxRate || sci !== p.sciRate) applyCommand(state, { type: "setRates", tax, lux, sci });
}

function strength(state: GameState, owner: number): number {
  let s = 0;
  for (const u of state.units) {
    if (u.owner !== owner) continue;
    const t = unitType(u.type);
    if (t.domain === "land") s += t.attack + t.defense;
  }
  return s;
}

/**
 * Would computer civilization `them` accept peace from `me` (another AI or
 * the human player)? Not while it is clearly stronger and its attackers
 * stand near our cities: it means to finish the war.
 */
export function acceptsPeace(state: GameState, them: number, me: number): boolean {
  if (strength(state, them) < strength(state, me) * 1.4) return true;
  const myCities = state.cities.filter((c) => c.owner === me);
  return !state.units.some((u) => u.owner === them && isAttacker(u) && myCities.some((c) => dist(state, u.x, u.y, c.x, c.y) <= 8));
}

/**
 * How computer civilization `them` regards `me`: hostile at war or once it
 * has warned `me` off its land twice. Otherwise it weighs what it holds
 * against `me`, a grievance (one warning), pride (far the stronger) and scorn
 * for `me`'s little influence, against admiration for great influence
 * (`esteem`): nothing against on balance is friendly, one thing wary, two
 * hostile. Read from the state alone, so the player's audience can ask
 * without touching the game.
 */
export type Attitude = "friendly" | "wary" | "hostile";

export function attitude(state: GameState, them: number, me: number): Attitude {
  if (atWar(state, them, me)) return "hostile";
  const grievance = trespassRecord(state, them, me);
  if (grievance && grievance.warnings >= 2) return "hostile";
  const regard = esteem(state, them, me);
  let mood = regard === "admired" ? 1 : regard === "scorned" ? -1 : 0;
  if (grievance) mood--;
  if (strength(state, them) > strength(state, me) * 1.5) mood--;
  return mood >= 0 ? "friendly" : mood === -1 ? "wary" : "hostile";
}

/** Friendly: yes; wary: for a gift; hostile: no. */
function dealAnswer(state: GameState, them: number, me: number): "yes" | "for gold" | "no" {
  const a = attitude(state, them, me);
  return a === "friendly" ? "yes" : a === "wary" ? "for gold" : "no";
}

/** The gift a wary civilization asks before it opens its borders. */
export const BORDERS_PRICE = 50;

/** Would `them` open borders with `me`? Friendly: yes; wary: for a gift of `BORDERS_PRICE` gold; hostile: no. */
export function bordersAnswer(state: GameState, them: number, me: number): "yes" | "for gold" | "no" {
  return dealAnswer(state, them, me);
}

/** The gift a wary civilization asks before it signs a peace treaty. */
export const PEACE_PRICE = 50;

/**
 * Would `them`, met but without a treaty, sign peace with `me`? Friendly: yes;
 * wary: for a gift of `PEACE_PRICE` gold; hostile: no. (At war `acceptsPeace`
 * answers: the fighting decides it.)
 */
export function peaceAnswer(state: GameState, them: number, me: number): "yes" | "for gold" | "no" {
  return dealAnswer(state, them, me);
}

/** Turns before a computer leader offers the same civilization peace again. */
const PEACE_OFFER_GAP = 20;

/** Would `them` swap maps with `me`? Unless hostile. */
export function acceptsMapSwap(state: GameState, them: number, me: number): boolean {
  return attitude(state, them, me) !== "hostile";
}

/**
 * The gold `them` pays when `me` demands tribute: a quarter of its treasury
 * (in tens, at least ten), and only when it is far the weaker (under half
 * `me`'s strength) and has not paid `me` in the last 20 turns. 0 is a refusal.
 */
export function tributeOffer(state: GameState, them: number, me: number): number {
  const paid = state.tributePaid?.[`${them}>${me}`];
  if (paid !== undefined && state.turn - paid < 20) return 0;
  if (strength(state, them) * 2 >= strength(state, me)) return 0;
  const gold = state.players[them]!.gold;
  return gold < 10 ? 0 : Math.max(10, Math.floor(gold / 40) * 10);
}

/** The advance of `me`'s that `them` asks for in a swap: the one its plans want most, then the deepest. */
export function tradeAsk(state: GameState, them: number, me: number): string | null {
  const theirs = state.players[them]!.advances;
  const offer = state.players[me]!.advances.filter((a) => !theirs.includes(a));
  if (!offer.length) return null;
  const war = state.players.some((o) => o.id !== them && o.id !== state.barbarians && atWar(state, them, o.id));
  const tree = advancesFor(state);
  const worth = (id: string) => [advanceRank(id, war), -closure(id, tree).size] as const;
  return offer.reduce((a, b) => {
    const [ra, da] = worth(a);
    const [rb, db] = worth(b);
    return rb < ra || (rb === ra && db < da) ? b : a;
  });
}

/**
 * A human civilization's units on our land, at peace and without open
 * borders: ask them to leave (stepping in counted as the first request), ask
 * once more, then go to war, unless we are far the weaker, when we only
 * complain now and then. Computer civilizations do not mind each other.
 */
function guardBorders(state: GameState, ctx: Ctx): void {
  if (state.noTrespass) return;
  const me = ctx.me;
  for (const o of state.players) {
    if (o.isAi || !o.alive || !trespassers(state, me, o.id).length) continue;
    const rec = trespassRecord(state, me, o.id);
    if (rec && rec.turn === state.turn) continue; // asked this very turn
    if (!rec || rec.warnings < 2) applyCommand(state, { type: "demandLeave", player: o.id });
    else if (strength(state, me) >= strength(state, o.id) * 0.6) applyCommand(state, { type: "declareWar", player: o.id, reason: "trespass" });
    else if (state.turn - rec.turn >= 5) applyCommand(state, { type: "demandLeave", player: o.id });
  }
}

function manageDiplomacy(state: GameState, ctx: Ctx): void {
  const me = ctx.me;
  const mine = strength(state, me);
  const army = ctx.units.filter(isAttacker).length;
  for (const o of state.players) {
    if (o.id === me || o.id === state.barbarians || !o.alive || !hasContact(state, me, o.id)) continue;
    const theirs = strength(state, o.id);
    if (atWar(state, me, o.id)) {
      const reachable = state.cities.some((c) => c.owner === o.id && ctx.continents.has(getTile(state.map, c.x, c.y)!.continent));
      const pointless = !reachable && !state.units.some((u) => u.owner === o.id && ctx.continents.has(getTile(state.map, u.x, u.y)!.continent));
      const stalled = ctx.warTarget === null || ctx.warTarget.owner !== o.id;
      const wantPeace = ((mine < theirs * 0.7 || pointless) && nextInt(state.rng, 100) < 20) || (stalled && nextInt(state.rng, 100) < 8);
      if (!wantPeace) continue;
      // Peace takes two: another computer civilization agrees only when it is not clearly winning, the player
      // when it answers our envoy (saves before version 15 made peace with the player at once).
      if (o.isAi ? acceptsPeace(state, o.id, me) : state.peaceOnContact) applyCommand(state, { type: "makePeace", player: o.id });
      else if (!o.isAi && offerDue(state, me, o.id)) applyCommand(state, { type: "offerPeace", player: o.id });
      continue;
    }
    // A player we think well of, met but without a treaty: now and then our envoy offers one
    // (one envoy a turn at the player's court, whoever sends it).
    if (!o.isAi && relation(state, me, o.id) === "contact" && offerDue(state, me, o.id) && !envoyThisTurn(state, o.id)
      && attitude(state, me, o.id) === "friendly" && nextInt(state.rng, 100) < 10)
      applyCommand(state, { type: "offerPeace", player: o.id });
  }
  // A war of choice against the weakest neighbour we can reach over land: only once the army could
  // already take one of its cities, and only against a clearly weaker civ (wars cost both sides dearly).
  if (ctx.atWarWith.length > 0 || ctx.turn < 80 || ctx.cities.length < 3 || army < Math.max(3, ctx.armyWanted)) return;
  const attackers = ctx.units.filter((u) => isAttacker(u) && unitType(u.type).domain === "land");
  const champion = attackers.reduce<Unit | null>((a, b) => (!a || attackStrength(b) > attackStrength(a) ? b : a), null);
  if (!champion) return;
  let victim: Player | null = null;
  let ratio = 0;
  for (const o of state.players) {
    if (o.id === me || o.id === state.barbarians || !o.alive || !hasContact(state, me, o.id)) continue;
    const theirCities = state.cities.filter((c) => c.owner === o.id);
    // A prize: a city of theirs near one of ours that our army could take, and walk to (wheels need roads on rough ground).
    const prize = theirCities.some((c) => {
      if (!ctx.continents.has(continentOf(state, c.x, c.y)) || attackersNeeded(state, champion, c.x, c.y) >= attackers.length) return false;
      const from = ctx.cities.find((m) => dist(state, c.x, c.y, m.x, m.y) <= 12 && continentOf(state, m.x, m.y) === continentOf(state, c.x, c.y));
      if (!from) return false;
      const walker = needsRoads(state, unitType(champion.type)) ? attackers.find((u) => !needsRoads(state, unitType(u.type))) ?? champion : champion;
      return findPath(state, { ...walker, x: from.x, y: from.y }, c.x, c.y) !== null;
    });
    if (!prize || theirCities.length > ctx.cities.length + 3) continue;
    const r = mine / Math.max(1, strength(state, o.id));
    const need = warOdds(state, me, o);
    if (need === null || r < need || r <= ratio) continue;
    ratio = r;
    victim = o;
  }
  if (!victim) return;
  // A player we scorn (or bear a grudge against besides) is attacked twice as readily.
  const scorn = !victim.isAi && !state.peaceOnContact && attitude(state, me, victim.id) === "hostile" ? 2 : 1;
  if (nextInt(state.rng, 100) < (ratio >= 3 ? 10 : 5) * scorn) applyCommand(state, { type: "declareWar", player: victim.id });
}

/** May our envoy offer `to` peace now? Not within `PEACE_OFFER_GAP` turns of the last offer, nor in saves before version 15. */
function offerDue(state: GameState, me: number, to: number): boolean {
  if (state.peaceOnContact) return false;
  const last = peaceOffered(state, me, to);
  return last === undefined || state.turn - last >= PEACE_OFFER_GAP;
}

/** Has any civilization offered `to` peace this turn? */
function envoyThisTurn(state: GameState, to: number): boolean {
  for (const [k, turn] of Object.entries(state.peaceOffers ?? {})) if (turn === state.turn && k.split(">")[1] === String(to)) return true;
  return false;
}

/**
 * How much stronger than `o` we must be to start a war of choice: twice. A
 * player gets more say (not in saves before version 15): one we regard as
 * friendly (far the weaker, so only one whose influence we admire) is spared,
 * and breaking a peace treaty with one wants three times its strength.
 */
function warOdds(state: GameState, me: number, o: Player): number | null {
  if (o.isAi || state.peaceOnContact) return 2;
  if (attitude(state, me, o.id) === "friendly") return null;
  return atPeace(state, me, o.id) ? 3 : 2;
}

/** How much an advance is worth to us: earlier on our goal list is better; anything off it comes last. */
function advanceRank(id: string, atWar: boolean): number {
  const goals = atWar ? [...WAR_GOALS, ...GOALS] : GOALS;
  const i = goals.indexOf(id);
  return i < 0 ? goals.length : i;
}

/**
 * Swap advances with other computer civilizations we are not at war with:
 * one for one, asking for the advance our plans want most and giving the
 * cheapest we have that they lack. Each pair deals at most every third
 * turn, and a civ makes at most two deals a turn. Human players trade
 * through the diplomacy screen instead.
 */
function manageTrade(state: GameState, ctx: Ctx): void {
  const me = ctx.p;
  let deals = 0;
  const atWarNow = ctx.atWarWith.length > 0;
  for (const o of state.players) {
    if (deals >= 2) break;
    if (o.id === me.id || o.id === state.barbarians || !o.alive || !o.isAi || !hasContact(state, me.id, o.id) || atWar(state, me.id, o.id)) continue;
    if ((ctx.turn + me.id + o.id) % 3 !== 0) continue;
    const want = o.advances.filter((a) => !me.advances.includes(a));
    const spare = me.advances.filter((a) => !o.advances.includes(a));
    if (!want.length || !spare.length) continue;
    const receive = want.reduce((a, b) => (advanceRank(b, atWarNow) < advanceRank(a, atWarNow) ? b : a));
    const tree = advancesFor(state);
    const give = spare.reduce((a, b) => (closure(b, tree).size < closure(a, tree).size ? b : a));
    if (!applyCommand(state, { type: "exchangeAdvances", player: o.id, give, receive }).ok) continue;
    deals++;
    // Research already under way on what we were just given would be wasted: switch to the next goal.
    if (me.researching !== null && me.advances.includes(me.researching)) {
      const threatened = atWarNow || [...ctx.threat.values()].some((t) => t > 0);
      const next = pickResearch(me.advances, advancesFor(state), threatened);
      if (next) applyCommand(state, { type: "research", advance: next });
    }
  }
}

// ---- spaceship -----------------------------------------------------------------------

/** Launch a sound ship, or any ship that can fly once a rival has launched or time runs short. */
function manageSpaceship(state: GameState, ctx: Ctx): void {
  const ship = ctx.p.spaceship;
  const st = shipStats(ship);
  if (!st.launchable) return;
  const rivalFlying = state.players.some((o) => o.id !== ctx.me && o.alive && o.spaceship.launched !== null);
  const lateGame = ctx.turn + st.flightTurns + 10 >= FINAL_TURN;
  const sound = st.successPct >= 60 && st.components >= 4;
  if (sound || (rivalFlying && st.successPct >= 40) || lateGame) applyCommand(state, { type: "launch" });
}

/** The next part worth building: structurals stay a step ahead of what they carry, then habitats, then engines. */
function nextSpacePart(ship: Spaceship, options: Production[]): Production | undefined {
  const can = (id: SpacePart) => options.find((o) => o.kind === "spaceship" && o.id === id);
  if (ship.structurals < ship.components + ship.modules + 1) return can("structural");
  if (ship.modules < 6) return can("module") ?? can("structural");
  if (ship.components < 6) return can("component") ?? can("structural");
  if (ship.structurals < 14) return can("structural");
  if (ship.modules < 9) return can("module");
  if (ship.components < 10) return can("component");
  return undefined;
}

// ---- cities --------------------------------------------------------------------------

function garrison(state: GameState, ctx: Ctx, c: City): Unit[] {
  return ctx.units.filter((u) => u.x === c.x && u.y === c.y && isMilitary(u) && u.aboard === null);
}

/** Military units already marching to a city. */
function incoming(ctx: Ctx, c: City): number {
  return ctx.units.filter((u) => isMilitary(u) && u.order.kind === "goto" && u.order.x === c.x && u.order.y === c.y).length;
}

function shortOfGuards(state: GameState, ctx: Ctx, c: City): boolean {
  return garrison(state, ctx, c).length + incoming(ctx, c) < (ctx.wanted.get(c.id) ?? 1);
}

/**
 * A unit kind made for peaceful work (settlers, diplomats, caravans). Tested by
 * name rather than "has any flag", so a flag added to a fighting unit never
 * quietly drops it from the build list.
 */
function civilian(t: { flags?: readonly string[] }): boolean {
  return t.flags?.some((f) => f === "settler" || f === "diplomat" || f === "caravan") ?? false;
}

/** The best land unit to build for attack or defence; `footOnly` leaves out wheels (rough ground without roads stops them). */
function bestUnit(options: Production[], stat: "attack" | "defense", footOnly: GameState | null = null): Production | undefined {
  let best: Production | undefined;
  let score = -1;
  for (const o of options) {
    if (o.kind !== "unit") continue;
    const t = unitType(o.id);
    if (t.domain !== "land" || t.attack === 0 || civilian(t)) continue;
    if (footOnly && needsRoads(footOnly, t)) continue;
    const s = stat === "defense" ? t.defense * 10 - t.cost / 8 : t.attack * 10 + t.moves * 3 - t.cost / 8;
    if (s > score) { score = s; best = o; }
  }
  return best;
}

/** Improvements worth having even when nothing calls for them; never barracks, walls or plants. */
const FALLBACK_BUILDINGS = new Set(["temple", "library", "marketplace", "granary", "courthouse", "aqueduct", "university", "bank", "colosseum", "cathedral"]);

const WONDER_ORDER = [
  "apollo_program", // the gate to the space race, first the moment Space Flight is known
  "hanging_gardens", "colossus", "great_library", "oracle", "michelangelos", "copernicus", "shakespeares",
  "js_bachs", "isaac_newtons", "great_wall", "darwins_voyage", "womens_suffrage", "hoover_dam", "seti_program", "magellans",
  "cure_for_cancer", "pyramids", "united_nations", "lighthouse",
];

function wantBuilding(state: GameState, ctx: Ctx, c: City, r: CityReport, id: string): number {
  const has = (b: string) => c.buildings.includes(b);
  const threat = ctx.threat.get(c.id) ?? 0;
  switch (id) {
    case "temple": return c.size >= 3 || r.unhappy > 0 ? 8 + r.unhappy * 3 + (r.disorder ? 10 : 0) : 0;
    case "library": return r.science >= 3 ? 5 + r.science : 0;
    case "marketplace": return r.tax + r.lux >= 4 ? 4 + r.tax + (ctx.income <= 1 ? 6 : 0) : 0;
    case "granary": return c.size >= 5 && r.foodSurplus >= 2 ? 3 : 0;
    case "courthouse": return r.corruption >= 3 ? 2 + r.corruption : 0;
    case "aqueduct": return c.size >= 8 ? 20 : c.size >= 7 ? 10 : 0;
    case "city_walls": return threat > 0 ? 6 + threat * 4 : 0;
    case "colosseum": return r.unhappy >= 2 && has("temple") ? 7 : 0;
    case "cathedral": return r.unhappy >= 3 ? 6 : 0;
    case "university": return r.science >= 8 ? 6 : 0;
    case "data_center": return r.science >= 8 ? 6 : 0;
    case "quantum_lab": return r.science >= 12 ? 5 : 0;
    case "cell_tower": return r.unhappy > 0 ? 6 + r.unhappy * 2 : 0;
    case "automated_office": return r.corruption >= 3 ? 2 + r.corruption : 0;
    case "bank": return r.tax >= 8 ? 4 : 0;
    case "harbour": return 0;
    case "factory": return r.shields >= 10 ? 8 : 0;
    case "power_plant": case "hydro_plant": case "nuclear_plant": case "solar_plant": return r.shields >= 15 ? 4 + (r.pollution >= 10 ? 4 : 0) : 0;
    case "mass_transit": return r.pollution >= 8 && c.size >= 8 ? 10 : 0;
    case "recycling_center": return r.pollution >= 8 ? 9 : 0;
    default: return 0;
  }
}

function chooseProduction(state: GameState, ctx: Ctx, c: City, r: CityReport, settlersOut: number, army: number, military: number, wonderCity: boolean): Production | undefined {
  const options = buildOptions(state, c);
  const pick = (kind: Production["kind"], id: string) => options.find((o) => o.kind === kind && o.id === id);
  const here = garrison(state, ctx, c).length;
  const wanted = ctx.wanted.get(c.id) ?? 1;
  const p = ctx.p;
  // One more unit rides on a free unit or costs a shield a turn: only build it where `keep` shields are left over.
  const upkeepNext = state.units.filter((u) => u.homeCity === c.id && paysShields(state, u)).length < freeUnits(state, c) ? 0 : government(p.government).unitUpkeep;
  const affords = (keep: number) => r.shieldSurplus - upkeepNext >= keep;
  // Settlers cost only food (saves before version 24, `settlerShields`, paid for them like any unit).
  const affordsSettlers = state.settlerShields ? affords : (keep: number) => r.shieldSurplus >= keep;

  if (here < wanted) return bestUnit(options, "defense");
  // A ship to carry settlers overseas, from a port with no room left at home.
  const homeSites = ctx.wantMoreCities && sitesOn(state, ctx.sites(), c.x, c.y);
  if (ctx.ferries < ctx.ferriesWanted && !homeSites && coastal(state, c) && r.shields >= 2 && affords(2) && (ctx.threat.get(c.id) ?? 0) === 0 && ctx.wantOverseas()) {
    let ferry: Production | undefined;
    let ferryScore = -Infinity;
    for (const o of options) {
      if (o.kind !== "unit" || !isFerry({ type: o.id } as Unit)) continue;
      const t = unitType(o.id);
      const v = (t.capacity ?? 0) * 3 + t.moves - t.cost / 20;
      if (v > ferryScore) { ferryScore = v; ferry = o; }
    }
    if (ferry) { ctx.ferries++; return ferry; }
  }
  if (r.shields >= 2 && affords(2) && ctx.ships < 2 && ctx.p.advances.includes("map_making") && (ctx.threat.get(c.id) ?? 0) === 0 && coastal(state, c) && ctx.ships < ctx.seaExplorersWanted()) {
    // The quickest, cheapest ship that can sail: a trireme early, sail and frigates later.
    let ship: Production | undefined;
    for (const o of options) {
      if (o.kind !== "unit") continue;
      const t = unitType(o.id);
      if (t.domain !== "sea") continue;
      if (o.id === "trireme" && !ctx.coastFrontier()) continue;
      if (!ship) { ship = o; continue; }
      const sh = unitType(ship.id);
      if (t.moves > sh.moves || (t.moves === sh.moves && t.cost < sh.cost)) ship = o;
    }
    if (ship) { ctx.ships++; return ship; }
  }
  if (ctx.scoutsWanted > 0 && c === ctx.cities[0] && here <= wanted && affords(1)) {
    let scout: Production | undefined;
    for (const o of options) {
      if (o.kind !== "unit") continue;
      const t = unitType(o.id);
      if (t.domain !== "land" || t.attack === 0 || civilian(t)) continue;
      if (!scout) { scout = o; continue; }
      const s = unitType(scout.id);
      if (t.moves > s.moves || (t.moves === s.moves && t.cost < s.cost)) scout = o;
    }
    if (scout) return scout;
  }

  // A young empire grabs land fast: up to half its city count in settlers at once, a third later.
  const allowance = ctx.cities.length < 8 ? Math.max(2, Math.ceil(ctx.cities.length / 2)) : Math.ceil(ctx.cities.length / 3);
  // Settlers for land this city can walk to, or (from a port) for a colony across the sea.
  const colonists = !homeSites && coastal(state, c) && ctx.overseasSettlers < 2 && ctx.wantOverseas();
  if (colonists && settlersOut < allowance + 1 && r.foodSurplus >= 1 && c.size >= 3 && affordsSettlers(0)) {
    const s = pick("unit", "settlers");
    if (s) { ctx.overseasSettlers++; return s; }
  }
  const sitesLeft = homeSites;
  // Settlers off to found a city pay upkeep only until they do.
  if (sitesLeft && settlersOut < allowance && r.foodSurplus >= 1 && (c.size >= 2 || r.foodSurplus >= 2) && affordsSettlers(0)) {
    const s = pick("unit", "settlers");
    if (s) return s;
  }
  if (r.disorder || (r.unhappy > 0 && r.unhappy >= r.happy && c.size >= 4)) {
    const t = pick("building", "temple") ?? pick("building", "colosseum") ?? pick("building", "marketplace");
    if (t) return t;
  }
  const workers = ctx.units.filter((u) => unitType(u.type).flags?.includes("settler") && u.order.kind === "work").length;
  if (workers < ctx.workersWanted && c.size >= 3 && r.foodSurplus >= 2 && settlersOut <= allowance && affordsSettlers(1)) {
    const s = pick("unit", "settlers");
    if (s) return s;
  }
  if (c.size >= 8 && !c.buildings.includes("aqueduct")) {
    const a = pick("building", "aqueduct");
    if (a) return a;
  }
  const threat = ctx.threat.get(c.id) ?? 0;
  if (threat > 0 && !c.buildings.includes("city_walls") && c.size >= 3) {
    const w = pick("building", "city_walls");
    if (w) return w;
  }
  if (ctx.warTarget && ctx.escorts < ctx.escortsWanted && military < ctx.militaryCap && threat === 0 && r.shields >= 2 && affords(1)) {
    const d = bestUnit(options, "defense");
    if (d) { ctx.escorts++; return d; }
  }
  if (ctx.atWarWith.length > 0 && army < ctx.armyWanted && military < ctx.militaryCap && affords(1)) {
    const a = bestUnit(options, "attack", ctx.campaignFoot ? state : null);
    if (a) return a;
  }
  // Caravans carry shields to the wonder city, or open trade routes once the empire has spread out.
  // A standing army even in peacetime, raised by the cities that can afford it.
  if (army + ctx.armyBuilding < ctx.armyWanted && military < ctx.militaryCap && c.size >= 4 && r.shields >= 4 && affords(2)) {
    const a = bestUnit(options, "attack", ctx.campaignFoot ? state : null);
    if (a) { ctx.armyBuilding++; return a; }
  }
  if (ctx.spyTarget && ctx.diplomats < 1 && c.size >= 3 && r.shields >= 3 && threat === 0 && affords(2)) {
    const d = pick("unit", "diplomat");
    if (d) return d;
  }
  if (c.size >= 3 && r.shields >= 3 && threat === 0 && affords(1)) {
    const toWonder = ctx.wonderSite !== null && ctx.wonderSite.id !== c.id && ctx.caravans < 3;
    const toTrade = ctx.wonderSite === null && ctx.cities.length >= 6 && c.size >= 5 && c.routes.length < MAX_TRADE_ROUTES && ctx.caravans < 2 && tradePartner(state, ctx, c) !== null;
    if (toWonder || toTrade) {
      const cv = pick("unit", "caravan");
      if (cv) return cv;
    }
  }
  if (ctx.spaceRace && r.shields >= 5 && threat === 0) {
    const part = nextSpacePart(ctx.p.spaceship, options);
    if (part) return part;
  }
  if (wonderCity && r.shields >= 5 && threat === 0 && (ctx.cities.length >= 4 || ctx.turn >= 80)) {
    for (const id of WONDER_ORDER) {
      const w = pick("wonder", id);
      if (!w) continue;
      if (id === "colossus" && !coastal(state, c)) continue;
      return w;
    }
  }
  let best: Production | undefined;
  let bestScore = 0;
  const starved = ctx.income <= 0 && p.gold < 100;
  for (const o of options) {
    if (o.kind !== "building") continue;
    if (starved && o.id !== "marketplace" && o.id !== "temple") continue;
    const s = wantBuilding(state, ctx, c, r, o.id);
    if (s > bestScore) { bestScore = s; best = o; }
  }
  if (best) return best;
  if (army < ctx.armyWanted && military < ctx.militaryCap && affords(2)) {
    const a = bestUnit(options, "attack", ctx.campaignFoot ? state : null);
    if (a) return a;
  }
  if (sitesLeft && r.foodSurplus >= 1 && affordsSettlers(0)) {
    const s = pick("unit", "settlers");
    if (s) return s;
  }
  // Nothing pressing: the wonder city soaks up shields usefully, others take any improvement, then a worker. Units only under the cap.
  if (threat === 0 && wonderCity) {
    for (const id of WONDER_ORDER) {
      const w = pick("wonder", id);
      if (w && (id !== "colossus" || coastal(state, c))) return w;
    }
  }
  if (!starved) {
    let cheapest: Production | undefined;
    for (const o of options) {
      if (o.kind !== "building" || !FALLBACK_BUILDINGS.has(o.id)) continue;
      if (o.id === "aqueduct" && c.size < 6) continue;
      if (!cheapest || building(o.id).cost < building(cheapest.id).cost) cheapest = o;
    }
    if (cheapest) return cheapest;
  }
  if (r.foodSurplus >= 2 && settlersOut + workers < ctx.workersWanted + (sitesLeft ? allowance : 0) && affordsSettlers(1)) {
    const s = pick("unit", "settlers");
    if (s) return s;
  }
  if (military < ctx.militaryCap && affords(2)) return bestUnit(options, "defense");
  return undefined;
}

function sameProduction(a: Production, b: Production): boolean {
  return a.kind === b.kind && a.id === b.id;
}

function manageCities(state: GameState, ctx: Ctx): void {
  const p = ctx.p;
  const settlersOut = ctx.units.filter((u) => unitType(u.type).flags?.includes("settler") && u.order.kind !== "work").length;
  const army = ctx.units.filter(isAttacker).length;
  const military = ctx.units.filter(isMilitary).length;
  // One wonder city, two once the empire is large; the best shield city that is not already on one.
  const wonderBuilders = ctx.cities.filter((c) => c.production.kind === "wonder").length;
  let wonderCity: City | null = null;
  if (wonderBuilders < (ctx.cities.length >= 12 ? 2 : 1)) {
    for (const c of ctx.cities) {
      if (c.production.kind === "wonder") continue;
      const r = ctx.reports.get(c.id)!;
      if (!wonderCity || r.shields > ctx.reports.get(wonderCity.id)!.shields) wonderCity = c;
    }
  }
  let settlersPlanned = settlersOut;
  const sites = ctx.wantMoreCities ? ctx.sites() : [];
  ctx.overseasSettlers =
    ctx.units.filter((u) => isSettler(u) && u.order.kind === "none" && (u.aboard !== null || !sitesOn(state, sites, u.x, u.y))).length +
    ctx.cities.filter((c) => c.production.kind === "unit" && c.production.id === "settlers" && coastal(state, c) && !sitesOn(state, sites, c.x, c.y)).length;
  for (const c of ctx.cities) {
    governCity(state, ctx, c);
    fixDisorder(state, ctx, c);
    const r = computeCity(state, c);
    ctx.reports.set(c.id, r);
    const current = c.production;
    const stale = current.kind === "wonder" && wonderBuilt(state, current.id);
    const want = chooseProduction(state, ctx, c, r, settlersPlanned, army, military, c === wonderCity || current.kind === "wonder");
    if (want && (stale || !sameProduction(want, current))) {
      const urgent = want.kind === "unit" && garrison(state, ctx, c).length < (ctx.wanted.get(c.id) ?? 1) && (ctx.threat.get(c.id) ?? 0) > 0;
      const cheap = c.shields <= 8 || want.kind === current.kind;
      if (stale || urgent || cheap) applyCommand(state, { type: "setProduction", city: c.id, production: want });
    }
    if (c.production.kind === "unit" && c.production.id === "settlers") settlersPlanned++;
    if (c.production.kind === "unit" && c.production.id === "caravan") ctx.caravans++;
    if (c.production.kind === "unit" && c.production.id === "diplomat") ctx.diplomats++;

    // Spend gold where it changes the game: empty cities, threatened cities, early settlers, riots.
    const cost = buyCost(state, c);
    if (cost === 0) continue;
    const here = garrison(state, ctx, c).length;
    const threat = ctx.threat.get(c.id) ?? 0;
    const prod = c.production;
    const defensive = prod.kind === "unit" && unitType(prod.id).attack > 0;
    let buy = false;
    if (defensive && here === 0 && p.gold >= cost + 20) buy = true;
    else if (defensive && threat > 0 && here < (ctx.wanted.get(c.id) ?? 1) && p.gold >= cost + 30) buy = true;
    else if (prod.kind === "unit" && prod.id === "settlers" && c.size >= 2 && ctx.wantMoreCities && ctx.sites().length > 0 && p.gold - cost >= 60 + 10 * ctx.cities.length) buy = true;
    else if (prod.kind === "building" && prod.id === "temple" && r.disorder && p.gold >= cost + 40) buy = true;
    else if (prod.kind !== "unit" && (c.shields > 0 || cost <= 60) && p.gold - cost >= 150 + 20 * ctx.cities.length) buy = true;
    else if (prod.kind === "unit" && prod.id === "settlers" && c.size >= 2 && p.gold - cost >= 200 + 20 * ctx.cities.length) buy = true;
    if (buy) applyCommand(state, { type: "buy", city: c.id });
  }
}

/**
 * Keep every city able to pay for its units. A soldier or ship stationed in another of our cities
 * moves its support there when that city has a free unit to spare, or shields to spare while its
 * home is short. A city still short lets its least useful units go itself (never settlers, caravans,
 * a city's last guard or a loaded ship) rather than leave the choice to the rules, which take the newest.
 */
function manageUpkeep(state: GameState, ctx: Ctx): void {
  const upkeep = government(ctx.p.government).unitUpkeep;
  const surplus = (c: City) => computeCity(state, c).shieldSurplus;
  const pays = (c: City, u: Unit) => unitSupport(state, c).some((s) => s.unit.id === u.id && s.shields > 0);
  for (const u of ctx.units) {
    if (u.aboard !== null || civilian(unitType(u.type)) || u.homeCity === null) continue;
    const here = cityAt(state, u.x, u.y);
    if (!here || here.owner !== ctx.me || u.homeCity === here.id) continue;
    const home = ctx.cities.find((c) => c.id === u.homeCity);
    if (!home || !pays(home, u)) continue;
    const spareHere = state.units.filter((o) => o.homeCity === here.id && paysShields(state, o)).length < freeUnits(state, here);
    if (spareHere || (surplus(home) < 0 && surplus(here) >= 2 + upkeep)) applyCommand(state, { type: "home", unit: u.id });
  }
  for (const c of ctx.cities) {
    let short = -surplus(c);
    if (short <= 0) continue;
    const worth = (u: Unit) => unitType(u.type).attack + unitType(u.type).defense + (u.veteran ? 1 : 0);
    const spare = unitSupport(state, c)
      .filter((s) => s.shields > 0 && !civilian(unitType(s.unit.type)) && s.unit.aboard === null && cargo(state, s.unit).length === 0)
      .map((s) => s.unit)
      .filter((u) => { const at = cityAt(state, u.x, u.y); return !at || at.owner !== ctx.me || garrison(state, ctx, at).length > 1; })
      .sort((a, b) => worth(a) - worth(b));
    for (const u of spare) {
      if (short <= 0) break;
      if (!applyCommand(state, { type: "disband", unit: u.id }).ok) continue;
      ctx.units = ctx.units.filter((o) => o.id !== u.id);
      if (isMilitary(u)) ctx.military--;
      short -= upkeep;
    }
  }
}

function slotValue(state: GameState, c: City, slot: number, gov: string): number {
  const t = radiusTile(state, c, slot);
  if (!t) return -1;
  const y = tileYield(state, t, false, gov, c.owner);
  return y.food * 3 + y.shields * 2 + y.trade;
}

/** Same answer as core's `slotAvailable`, from the per-turn index instead of a scan of every city. */
function slotFree(state: GameState, ctx: Ctx, c: City, slot: number): boolean {
  if (slot === 0) return false;
  const [dx, dy] = CITY_RADIUS[slot]!;
  const y = c.y + dy;
  if (y < 0 || y >= state.map.height) return false;
  const i = y * state.map.width + wrapX(state.map, c.x + dx);
  const w = ctx.tileWorker.get(i);
  if (w !== undefined && w !== c.id) return false;
  return !ctx.foreignUnitTiles.has(i) && slotInLand(state, c, slot);
}

/** Refresh the index for one city after its citizens were moved. */
function reindexCity(state: GameState, ctx: Ctx, c: City): void {
  for (const [i, id] of ctx.tileWorker) if (id === c.id) ctx.tileWorker.delete(i);
  ctx.tileWorker.set(c.y * state.map.width + c.x, c.id);
  for (const s of c.worked) {
    const [dx, dy] = CITY_RADIUS[s]!;
    ctx.tileWorker.set((c.y + dy) * state.map.width + wrapX(state.map, c.x + dx), c.id);
  }
}

/**
 * Re-seat the citizens: grow while the city is small, then favour shields and
 * trade, and never starve. A civ with no science at all weights trade heavily
 * so it works rivers and the coast. Changes go through `toggleTile`.
 */
function governCity(state: GameState, ctx: Ctx, c: City): void {
  const gov = government(ctx.p.government);
  const workers = c.size - c.specialists.length;
  if (workers <= 0) return;
  const slots: { slot: number; food: number; shields: number; trade: number }[] = [];
  for (let s = 1; s < CITY_RADIUS.length; s++) {
    if (!slotFree(state, ctx, c, s)) continue;
    const y = tileYield(state, radiusTile(state, c, s)!, false, ctx.p.government, ctx.me);
    slots.push({ slot: s, ...y });
  }
  if (slots.length === 0) return;
  const centre = tileYield(state, getTile(state.map, c.x, c.y)!, true, ctx.p.government, ctx.me);
  let settlerFood = 0;
  for (const u of ctx.units) if (u.homeCity === c.id && unitType(u.type).flags?.includes("settler")) settlerFood += gov.settlerFood;
  const cap = c.buildings.includes("aqueduct") ? 99 : 10;
  const growthTarget = c.size >= cap ? 0 : c.size < 4 ? 2 : 1;
  const tradeWeight = ctx.turn > 5 && ctx.science < ctx.cities.length ? 3 : 1.5 + gov.tradeBonus * 0.5;
  let food = centre.food - c.size * 2 - settlerFood;
  const chosen: number[] = [];
  const left = [...slots];
  for (let i = 0; i < workers && left.length > 0; i++) {
    const fw = food < growthTarget ? 4 : 1.2;
    let bestIdx = 0;
    let bestV = -Infinity;
    for (let k = 0; k < left.length; k++) {
      const s = left[k]!;
      const v = s.food * fw + s.shields * 2 + s.trade * tradeWeight;
      if (v > bestV) { bestV = v; bestIdx = k; }
    }
    const [s] = left.splice(bestIdx, 1);
    chosen.push(s!.slot);
    food += s!.food;
  }
  const remove = c.worked.filter((s) => !chosen.includes(s));
  const add = chosen.filter((s) => !c.worked.includes(s));
  if (remove.length === 0 && add.length === 0) return;
  for (const s of remove) applyCommand(state, { type: "toggleTile", city: c.id, slot: s });
  for (const s of add) applyCommand(state, { type: "toggleTile", city: c.id, slot: s });
  reindexCity(state, ctx, c);
}

/** Turn workers into entertainers until order is restored; put surplus entertainers back to work. */
function fixDisorder(state: GameState, ctx: Ctx, c: City): void {
  const gov = state.players[c.owner]!.government;
  let r = computeCity(state, c);
  if (!r.disorder && c.specialists.length === 0) return;
  let guard = 0;
  while (r.disorder && c.worked.length > 0 && guard++ < 8) {
    let worst = c.worked[0]!;
    for (const s of c.worked) if (slotValue(state, c, s, gov) < slotValue(state, c, worst, gov)) worst = s;
    if (!applyCommand(state, { type: "toggleTile", city: c.id, slot: worst }).ok) break;
    r = computeCity(state, c);
  }
  while (!r.disorder && c.specialists.length > 0 && guard++ < 8) {
    let best = -1;
    let bestV = 0;
    for (let s = 1; s < CITY_RADIUS.length; s++) {
      if (c.worked.includes(s) || !slotFree(state, ctx, c, s)) continue;
      const v = slotValue(state, c, s, gov);
      if (v > bestV) { bestV = v; best = s; }
    }
    if (best < 0 || !applyCommand(state, { type: "toggleTile", city: c.id, slot: best }).ok) break;
    const r2 = computeCity(state, c);
    if (r2.disorder) { applyCommand(state, { type: "toggleTile", city: c.id, slot: best }); break; }
    r = r2;
  }
  // Entertainers nobody needs for order do more good as scientists.
  for (let i = 0; i < c.specialists.length && guard++ < 16; i++) {
    if (c.specialists[i] !== "entertainer") continue;
    applyCommand(state, { type: "setSpecialist", city: c.id, index: i, specialist: "scientist" });
    if (computeCity(state, c).disorder) { applyCommand(state, { type: "setSpecialist", city: c.id, index: i, specialist: "entertainer" }); break; }
  }
  reindexCity(state, ctx, c);
}

// ---- garrisons: sorties and excess -------------------------------------------------

/**
 * Hit points an attacker can expect to knock off a defender before the fight
 * ends, win or lose: rounds won before it runs out of lives (the mean of a
 * negative binomial), times its firepower, capped at what the defender has.
 */
function expectedDamage(state: GameState, a: Unit, d: Unit): number {
  const as = attackStrength(a);
  const ds = defenseStrength(state, d, a);
  const p = as / (as + ds);
  if (p >= 1) return d.hp;
  const lives = Math.ceil(a.hp / firepower(state, d.type));
  return Math.min(d.hp, ((lives * p) / (1 - p)) * firepower(state, a.type));
}

/** Attackers like `a` it takes to clear every defender from (x, y) in one turn (defenders heal between turns). */
function attackersNeeded(state: GameState, a: Unit, x: number, y: number): number {
  let need = 0;
  for (const d of state.units) {
    if (d.x !== x || d.y !== y || d.owner === a.owner) continue;
    need += d.hp / Math.max(0.5, expectedDamage(state, a, d));
  }
  return Math.ceil(need);
}

function winChance(state: GameState, u: Unit, x: number, y: number): number | null {
  const d = bestDefender(state, x, y, u);
  if (!d) return null;
  return attackOdds(state, u, d);
}

function rebalanceGarrisons(state: GameState, ctx: Ctx): void {
  const needy = ctx.cities.some((c) => shortOfGuards(state, ctx, c));
  // Soldiers fortified out in the field (an old camp, a finished campaign) are woken to find new work.
  for (const u of ctx.units) {
    if (u.order.kind !== "fortified" || cityAt(state, u.x, u.y) || u.aboard !== null) continue;
    const atCamp = ctx.camp !== null && u.x === ctx.camp[0] && u.y === ctx.camp[1];
    if (!atCamp) applyCommand(state, { type: "activate", unit: u.id });
  }
  for (const c of ctx.cities) {
    const g = garrison(state, ctx, c);
    const wanted = ctx.wanted.get(c.id) ?? 1;
    // Sortie against hostile units next to the city when the odds are good and a defender stays behind.
    for (const [dx, dy] of NEIGHBOURS) {
      const x = wrapX(state.map, c.x + dx);
      const y = c.y + dy;
      if (!state.units.some((o) => ctx.enemies.has(o.owner) && o.x === x && o.y === y && o.aboard === null)) continue;
      const sortie = g.filter((u) => unitType(u.type).attack >= 2 && u.movesLeft > 0).sort((a, b) => unitType(b.type).attack - unitType(a.type).attack);
      for (const u of sortie) {
        if (g.length <= 1) break;
        const p = winChance(state, u, x, y);
        if (p === null || p < 0.55) continue;
        applyCommand(state, { type: "activate", unit: u.id });
        applyCommand(state, { type: "move", unit: u.id, dx, dy });
        if (!state.units.some((o) => ctx.enemies.has(o.owner) && o.x === x && o.y === y)) break;
      }
    }
    // In wartime the attackers in a quiet city join the campaign, as long as one soldier stays.
    if (ctx.warTarget && (ctx.threat.get(c.id) ?? 0) === 0) {
      const leave = g.filter((u) => isAttacker(u) && (u.order.kind === "fortified" || u.order.kind === "sentry"));
      for (const u of leave.slice(0, Math.max(0, g.length - 1))) applyCommand(state, { type: "activate", unit: u.id });
    }
    // Release surplus defenders when someone else needs them or there is a war to fight.
    const extra = g.length - wanted;
    if (extra <= 0) continue;
    if (needy || ctx.warTarget !== null || ctx.scoutsWanted > 0) {
      const release = g.filter((u) => u.order.kind === "fortified" || u.order.kind === "sentry").sort((a, b) => unitType(b.type).attack - unitType(a.type).attack).slice(0, extra);
      for (const u of release) applyCommand(state, { type: "activate", unit: u.id });
      continue;
    }
    // At peace and over strength: let the weakest surplus unit go rather than pay for it.
    if (ctx.atWarWith.length === 0 && ctx.military > ctx.militaryCap + 2 && extra >= 2) {
      const weakest = g.reduce((a, b) => (unitType(b.type).defense + unitType(b.type).attack < unitType(a.type).defense + unitType(a.type).attack ? b : a));
      applyCommand(state, { type: "disband", unit: weakest.id });
      ctx.military--;
    }
  }
}

/**
 * Storm the enemy cities our soldiers stand next to: the attacker with the
 * best odds goes first; a weaker one still goes when at least two more can
 * follow up on the wounded defenders (or one more against a lone defender);
 * the moment a city stands empty, a soldier walks in and takes it.
 */
function assault(state: GameState, ctx: Ctx): void {
  const targets = state.cities.filter((c) => c.owner !== ctx.me && ctx.enemies.has(c.owner));
  for (const target of targets) {
    for (let guard = 0; guard < 16; guard++) {
      if (target.owner === ctx.me || !state.cities.includes(target)) break;
      const adjacent = state.units.filter((u) => u.owner === ctx.me && isMilitary(u) && u.aboard === null && u.movesLeft > 0 &&
        dist(state, u.x, u.y, target.x, target.y) === 1 && !cityAt(state, u.x, u.y));
      if (!adjacent.length) break;
      const step = (u: Unit): [number, number] => {
        let dx = target.x - u.x;
        if (dx > 1) dx -= state.map.width;
        if (dx < -1) dx += state.map.width;
        return [dx, target.y - u.y];
      };
      const defenders = state.units.filter((o) => o.owner !== ctx.me && o.x === target.x && o.y === target.y);
      if (!defenders.length) {
        const walker = adjacent.sort((a, b) => unitType(b.type).defense - unitType(a.type).defense)[0]!;
        const [dx, dy] = step(walker);
        applyCommand(state, { type: "activate", unit: walker.id });
        if (!applyCommand(state, { type: "move", unit: walker.id, dx, dy }).ok) break;
        continue;
      }
      const scored = adjacent.map((u) => ({ u, p: winChance(state, u, target.x, target.y) ?? 0 })).sort((a, b) => b.p - a.p);
      const { u, p } = scored[0]!;
      const followers = scored.length - 1;
      // All in when the soldiers here can be expected to wear every defender down this turn.
      let damage = 0;
      const top = bestDefender(state, target.x, target.y, u);
      for (const a of adjacent) if (top) damage += expectedDamage(state, a, top);
      const allIn = damage >= defenders.reduce((s, d) => s + d.hp, 0) * 1.15;
      const go = allIn || p >= 0.55 || (p >= 0.2 && followers >= 2) || (p >= 0.35 && defenders.length === 1 && followers >= 1);
      if (!go) break;
      const [dx, dy] = step(u);
      applyCommand(state, { type: "activate", unit: u.id });
      if (!applyCommand(state, { type: "move", unit: u.id, dx, dy }).ok) break;
    }
  }
}

// ---- units ---------------------------------------------------------------------------

function orderUnit(state: GameState, ctx: Ctx, u: Unit): void {
  const type = unitType(u.type);
  if (u.aboard !== null) { applyCommand(state, { type: "skip", unit: u.id }); return; }
  if (type.flags?.includes("settler")) { orderSettler(state, ctx, u); return; }
  if (type.flags?.includes("caravan")) { orderCaravan(state, ctx, u); return; }
  if (type.flags?.includes("diplomat")) { orderDiplomat(state, ctx, u); return; }
  if (type.domain === "sea") { orderShip(state, ctx, u); return; }
  if (type.domain !== "land" || type.attack === 0) { applyCommand(state, { type: "skip", unit: u.id }); return; }
  orderMilitary(state, ctx, u);
}

/** Issue a goto; if the first step is refused (zones of control), try a plain step instead. */
function goto(state: GameState, u: Unit, x: number, y: number): boolean {
  if (u.x === x && u.y === y) return false;
  const [bx, by] = [u.x, u.y];
  if (!applyCommand(state, { type: "goto", unit: u.id, x, y }).ok) return false;
  if (u.order.kind === "goto" || u.x !== bx || u.y !== by) return true;
  return nudge(state, u, x, y);
}

/** Step one tile toward a target when a goto cannot be issued (e.g. zones of control). */
function nudge(state: GameState, u: Unit, x: number, y: number): boolean {
  let dx = x - u.x;
  if (dx > state.map.width / 2) dx -= state.map.width;
  if (dx < -state.map.width / 2) dx += state.map.width;
  const sx = Math.sign(dx);
  const sy = Math.sign(y - u.y);
  for (const [mx, my] of [[sx, sy], [sx, 0], [0, sy]] as const) {
    if (mx === 0 && my === 0) continue;
    if (applyCommand(state, { type: "move", unit: u.id, dx: mx, dy: my }).ok) return true;
  }
  return false;
}

function nearestCity(state: GameState, ctx: Ctx, u: Unit, pred: (c: City) => boolean = () => true): City | null {
  let best: City | null = null;
  let bestD = 99;
  for (const c of ctx.cities) {
    if (!pred(c)) continue;
    const d = dist(state, u.x, u.y, c.x, c.y);
    if (d < bestD) { bestD = d; best = c; }
  }
  return best;
}

/**
 * Breadth-first over land for the nearest unexplored tile (a visible hut
 * wins). Like the original's opponents it walks the real map, so it heads
 * for land it has not seen rather than feeling along the edge of the known.
 */
function frontierTarget(state: GameState, u: Unit, limit = 900): [number, number] | null {
  const p = state.players[u.owner]!;
  const { width: w, height: h } = state.map;
  const start = u.y * w + u.x;
  const seen = new Uint8Array(w * h);
  seen[start] = 1;
  const queue = [start];
  let head = 0;
  let fallback: [number, number] | null = null;
  const blocked = new Set<number>();
  for (const o of state.units) if (o.owner !== u.owner) blocked.add(o.y * w + o.x);
  for (const c of state.cities) if (c.owner !== u.owner) blocked.add(c.y * w + c.x);
  while (head < queue.length && head < limit) {
    const i = queue[head++]!;
    const x = i % w;
    const y = Math.floor(i / w);
    const t = state.map.tiles[i]!;
    if (i !== start) {
      if (t.hut && p.explored[i]) return [x, y];
      if (fallback === null && !p.explored[i]) fallback = [x, y];
    }
    for (const [dx, dy] of NEIGHBOURS) {
      const ny = y + dy;
      if (ny < 1 || ny >= h - 1) continue;
      const nx = wrapX(state.map, x + dx);
      const ni = ny * w + nx;
      if (seen[ni]) continue;
      seen[ni] = 1;
      const n = state.map.tiles[ni]!;
      if (n.terrain === Terrain.Ocean) continue;
      if (blocked.has(ni)) continue;
      queue.push(ni);
    }
  }
  return fallback;
}

/** Water squares within two of land, per map (land never turns into sea, so this is computed once). */
const NEAR_LAND = new WeakMap<GameState["map"], Uint8Array>();
function nearLandMask(state: GameState): Uint8Array {
  let mask = NEAR_LAND.get(state.map);
  if (mask) return mask;
  const { width: w, height: h, tiles } = state.map;
  mask = new Uint8Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (tiles[y * w + x]!.terrain === Terrain.Ocean) continue;
      for (let dy = -2; dy <= 2; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= h) continue;
        for (let dx = -2; dx <= 2; dx++) mask[ny * w + wrapX(state.map, x + dx)] = 1;
      }
    }
  NEAR_LAND.set(state.map, mask);
  return mask;
}

/**
 * Breadth-first over the sea from one or more squares for the nearest water
 * square that borders the unknown. A trireme keeps within two squares of
 * land, as the original's had to hug the coast, so it can cross a narrow
 * strait but open ocean waits for Navigation.
 */
function seaFrontierFrom(state: GameState, owner: number, starts: number[], coastOnly: boolean, limit = 4000): [number, number] | null {
  const p = state.players[owner]!;
  const { width: w, height: h } = state.map;
  const seen = new Uint8Array(w * h);
  const queue: number[] = [];
  for (const s of starts) if (!seen[s]) { seen[s] = 1; queue.push(s); }
  const startSet = new Set(starts);
  let head = 0;
  const blocked = new Set<number>();
  for (const o of state.units) if (o.owner !== owner) blocked.add(o.y * w + o.x);
  const ownCity = new Set<number>();
  for (const c of state.cities) if (c.owner === owner) ownCity.add(c.y * w + c.x);
  const near = coastOnly ? nearLandMask(state) : null;
  while (head < queue.length && head < limit) {
    const i = queue[head++]!;
    const x = i % w;
    const y = Math.floor(i / w);
    if (!startSet.has(i) && state.map.tiles[i]!.terrain === Terrain.Ocean) {
      for (const [dx, dy] of NEIGHBOURS) {
        const ny = y + dy;
        if (ny >= 0 && ny < h && !p.explored[ny * w + wrapX(state.map, x + dx)]) return [x, y];
      }
    }
    for (const [dx, dy] of NEIGHBOURS) {
      const ny = y + dy;
      if (ny < 1 || ny >= h - 1) continue;
      const nx = wrapX(state.map, x + dx);
      const ni = ny * w + nx;
      if (seen[ni]) continue;
      seen[ni] = 1;
      const n = state.map.tiles[ni]!;
      if (!p.explored[ni] || blocked.has(ni)) continue;
      if (n.terrain !== Terrain.Ocean && !ownCity.has(ni)) continue;
      if (near && n.terrain === Terrain.Ocean && !near[ni]) continue;
      queue.push(ni);
    }
  }
  return null;
}

function seaFrontierTarget(state: GameState, u: Unit, coastOnly: boolean): [number, number] | null {
  return seaFrontierFrom(state, u.owner, [u.y * state.map.width + u.x], coastOnly);
}

// ---- ferries ---------------------------------------------------------------------------

/** An ocean square next to a city for a ship to wait at while settlers step aboard; the ship's own square if it is one. */
function berth(state: GameState, c: City, u: Unit): [number, number] | null {
  let first: [number, number] | null = null;
  for (const [dx, dy] of NEIGHBOURS) {
    const x = wrapX(state.map, c.x + dx);
    const y = c.y + dy;
    const t = getTile(state.map, x, y);
    if (!t || t.terrain !== Terrain.Ocean) continue;
    if (state.units.some((o) => o.owner !== u.owner && o.x === x && o.y === y)) continue;
    if (u.x === x && u.y === y) return [x, y];
    first ??= [x, y];
  }
  return first;
}

/**
 * Breadth-first over known water from a ship for the overseas site worth
 * most for the voyage: returns the site and the ocean square beside it to
 * sail to. A trireme keeps near the coast.
 */
function landingTarget(state: GameState, ctx: Ctx, u: Unit): { site: Site; x: number; y: number } | null {
  const sites = ctx.overseasSites();
  if (!sites.length) return null;
  const { width: w, height: h } = state.map;
  const bySquare = new Map<number, Site>();
  for (const s of sites) bySquare.set(s.y * w + s.x, s);
  // Sites another ferry is already making for are left to it.
  for (const o of ctx.units) {
    if (o.id === u.id || !isFerry(o) || o.order.kind !== "goto") continue;
    for (const [dx, dy] of NEIGHBOURS) bySquare.delete((o.order.y + dy) * w + wrapX(state.map, o.order.x + dx));
  }
  const near = u.type === "trireme" ? nearLandMask(state) : null;
  const start = u.y * w + u.x;
  const steps = new Int32Array(w * h).fill(-1);
  steps[start] = 0;
  const queue = [start];
  let best: { site: Site; x: number; y: number } | null = null;
  let bestV = -Infinity;
  for (let head = 0; head < queue.length && head < 5000; head++) {
    const i = queue[head]!;
    const x = i % w;
    const y = Math.floor(i / w);
    for (const [dx, dy] of NEIGHBOURS) {
      const ny = y + dy;
      if (ny < 1 || ny >= h - 1) continue;
      const ni = ny * w + wrapX(state.map, x + dx);
      const site = bySquare.get(ni);
      if (site && (i !== start || state.map.tiles[i]!.terrain === Terrain.Ocean)) {
        const v = site.score - 1.5 * steps[i]!;
        if (v > bestV) { bestV = v; best = { site, x, y }; }
      }
      if (steps[ni]! >= 0) continue;
      const t = state.map.tiles[ni]!;
      if (t.terrain !== Terrain.Ocean || !ctx.p.explored[ni] || ctx.foreignUnitTiles.has(ni)) continue;
      if (near && !near[ni]) continue;
      steps[ni] = steps[i]! + 1;
      queue.push(ni);
    }
  }
  return best;
}

/** Put a ship's settlers and their escort ashore on a fit site next to it; true if they went. */
function unloadAtSite(state: GameState, ctx: Ctx, u: Unit, load: Unit[]): boolean {
  for (const [dx, dy] of NEIGHBOURS) {
    const x = wrapX(state.map, u.x + dx);
    const y = u.y + dy;
    const t = getTile(state.map, x, y);
    if (!t || t.terrain === Terrain.Ocean || state.units.some((o) => o.x === x && o.y === y) || cityAt(state, x, y)) continue;
    const colony = !ctx.continents.has(t.continent) || sitesOn(state, ctx.sites(), x, y);
    if (!colony || canFoundCity(state, x, y) !== null || siteScore(state, x, y) === null) continue;
    if (!state.packedCities && !roomForCity(state, ctx.me, x, y)) continue;
    let landed = false;
    for (const c of [...load].sort((a, b) => Number(isSettler(b)) - Number(isSettler(a)))) {
      if (c.movesLeft <= 0) continue;
      applyCommand(state, { type: "activate", unit: c.id });
      if (applyCommand(state, { type: "move", unit: c.id, dx, dy }).ok && isSettler(c)) landed = true;
    }
    if (landed) return true;
  }
  return false;
}

/**
 * Ferry duty. A ship with settlers aboard sails for the best overseas site
 * and puts them ashore beside it; an empty ferry waits next to a port where
 * a settler has no room left at home, takes it aboard with one defender
 * from the garrison as escort, and sets sail. Returns false when there is
 * no ferrying to do, leaving the ship to explore.
 */
/** Before sailing from beside a port, take one defender from its garrison along as escort, if it can spare one. */
function takeEscort(state: GameState, ctx: Ctx, u: Unit): void {
  const aboard = cargo(state, u);
  if (!aboard.some(isSettler) || aboard.some(isMilitary) || aboard.length >= (unitType(u.type).capacity ?? 0)) return;
  for (const [dx, dy] of NEIGHBOURS) {
    const port = cityAt(state, u.x + dx, u.y + dy);
    if (!port || port.owner !== ctx.me) continue;
    const guards = garrison(state, ctx, port).sort((a, b) => unitType(b.type).defense - unitType(a.type).defense);
    const escort = guards.length >= 2 ? guards[1] : undefined;
    if (!escort || escort.movesLeft <= 0) continue;
    applyCommand(state, { type: "activate", unit: escort.id });
    if (applyCommand(state, { type: "move", unit: escort.id, dx: -dx, dy: -dy }).ok) return;
  }
}

function orderFerry(state: GameState, ctx: Ctx, u: Unit, depth = 0): boolean {
  const load = cargo(state, u);
  if (load.some(isSettler)) {
    takeEscort(state, ctx, u);
    if (unloadAtSite(state, ctx, u, load)) { applyCommand(state, { type: "skip", unit: u.id }); return true; }
    const target = landingTarget(state, ctx, u);
    if (target && u.movesLeft > 0 && (goto(state, u, target.x, target.y) || nudge(state, u, target.x, target.y))) return true;
    applyCommand(state, { type: "skip", unit: u.id });
    return true;
  }
  if (!ctx.wantOverseas()) return false;
  const cap = unitType(u.type).capacity ?? 0;
  const waiting = ctx.units.filter((s) => {
    if (!isSettler(s) || s.order.kind !== "none" || s.aboard !== null) return false;
    const c = cityAt(state, s.x, s.y);
    return c !== undefined && c.owner === ctx.me && coastal(state, c) && !sitesOn(state, ctx.sites(), c.x, c.y);
  });
  let port: City | null = null;
  let bestD = Infinity;
  for (const s of waiting) {
    const d = dist(state, u.x, u.y, s.x, s.y);
    if (d < bestD) { bestD = d; port = cityAt(state, s.x, s.y)!; }
  }
  port ??= nearestCity(state, ctx, u, (c) => coastal(state, c) && !sitesOn(state, ctx.sites(), c.x, c.y));
  if (!port) return false;
  const b = berth(state, port, u);
  if (!b) { applyCommand(state, { type: "skip", unit: u.id }); return true; }
  if (u.x !== b[0] || u.y !== b[1]) {
    if (u.movesLeft > 0 && (goto(state, u, b[0], b[1]) || nudge(state, u, b[0], b[1]))) return true;
    applyCommand(state, { type: "skip", unit: u.id });
    return true;
  }
  // At the berth: settlers step aboard, then one defender if the garrison can spare it.
  let dx = b[0] - port.x;
  if (dx > 1) dx -= state.map.width;
  if (dx < -1) dx += state.map.width;
  const dy = b[1] - port.y;
  for (const s of waiting) {
    if (s.x !== port.x || s.y !== port.y || s.movesLeft <= 0 || cargo(state, u).length >= cap) continue;
    applyCommand(state, { type: "activate", unit: s.id });
    applyCommand(state, { type: "move", unit: s.id, dx, dy });
  }
  if (cargo(state, u).some(isSettler) && depth === 0) return orderFerry(state, ctx, u, 1);
  applyCommand(state, { type: "skip", unit: u.id });
  return true;
}

/** Ships ferry settlers when there is land to settle overseas, otherwise chart the seas; with nothing left to find they go home and are let go. */
function orderShip(state: GameState, ctx: Ctx, u: Unit): void {
  if (isFerry(u)) {
    const load = cargo(state, u);
    const onDuty = load.length > 0 || ctx.units.filter(isFerry).sort((a, b) => a.id - b.id).indexOf(u) < ctx.ferriesWanted;
    if (onDuty && orderFerry(state, ctx, u)) return;
  }
  if (cargo(state, u).length > 0) { applyCommand(state, { type: "skip", unit: u.id }); return; }
  const target = seaFrontierTarget(state, u, u.type === "trireme");
  if (target && (goto(state, u, target[0], target[1]) || nudge(state, u, target[0], target[1]))) return;
  const here = cityAt(state, u.x, u.y);
  if (here && here.owner === ctx.me) {
    // Nothing left for this ship: let it go (a trireme that cannot reach open-sea work makes room for a seagoing ship).
    const ferrying = isFerry(u) && ctx.wantOverseas();
    if (!target && !ferrying && (ctx.seaExplorersWanted() === 0 || (u.type === "trireme" && !ctx.coastFrontier()))) { applyCommand(state, { type: "disband", unit: u.id }); ctx.ships--; return; }
    applyCommand(state, { type: "skip", unit: u.id });
    return;
  }
  const port = nearestCity(state, ctx, u, (c) => coastal(state, c));
  if (port && goto(state, u, port.x, port.y)) return;
  applyCommand(state, { type: "skip", unit: u.id });
}

function explore(state: GameState, u: Unit): boolean {
  const target = frontierTarget(state, u);
  if (!target) return false;
  if (goto(state, u, target[0], target[1])) return true;
  return nudge(state, u, target[0], target[1]);
}

function orderMilitary(state: GameState, ctx: Ctx, u: Unit): void {
  const type = unitType(u.type);
  const here = cityAt(state, u.x, u.y);
  const inOwnCity = here !== undefined && here.owner === ctx.me;

  // 1. Something to hit next door?
  let bestP = 0;
  let bestDir: [number, number] | null = null;
  for (const [dx, dy] of NEIGHBOURS) {
    const x = wrapX(state.map, u.x + dx);
    const y = u.y + dy;
    if (y < 0 || y >= state.map.height) continue;
    const city = cityAt(state, x, y);
    const hostileCity = city !== undefined && city.owner !== ctx.me && ctx.enemies.has(city.owner);
    const occupied = state.units.some((o) => o.owner !== ctx.me && o.x === x && o.y === y);
    if (!occupied) {
      if (hostileCity) { applyCommand(state, { type: "move", unit: u.id, dx, dy }); return; }
      continue;
    }
    if (!state.units.some((o) => ctx.enemies.has(o.owner) && o.x === x && o.y === y)) continue;
    const p = winChance(state, u, x, y);
    if (p === null) continue;
    const allies = state.units.filter((o) => o.owner === ctx.me && isAttacker(o) && dist(state, o.x, o.y, x, y) <= 1).length;
    const threshold = hostileCity ? (allies >= 3 ? 0.3 : 0.45) : inOwnCity ? 0.5 : 0.55;
    if (p >= threshold && p > bestP) { bestP = p; bestDir = [dx, dy]; }
  }
  if (bestDir) { applyCommand(state, { type: "move", unit: u.id, dx: bestDir[0], dy: bestDir[1] }); return; }

  // 2. Garrison duty (in wartime an attacker marches as long as someone else holds a quiet city).
  const attacker = isAttacker(u);
  if (inOwnCity) {
    const others = garrison(state, ctx, here).filter((o) => o.id !== u.id).length;
    const wanted = ctx.wanted.get(here.id) ?? 1;
    const marching = attacker && ctx.warTarget !== null && others >= 1 && (ctx.threat.get(here.id) ?? 0) === 0;
    if (others < wanted && !marching) { applyCommand(state, { type: "fortify", unit: u.id }); return; }
  }
  const marches = !(ctx.campaignFoot && needsRoads(state, type));
  if (ctx.warTarget && attacker && marches) {
    const t = ctx.warTarget;
    if (dist(state, u.x, u.y, t.x, t.y) <= 1) { applyCommand(state, { type: "skip", unit: u.id }); return; } // in position: the assault comes at the start of our next turn
    // Gather at the staging city until the army is big enough, then march together.
    const s = ctx.staging;
    if (!ctx.campaignReady && s) {
      if (dist(state, u.x, u.y, s.x, s.y) > 1 && (goto(state, u, s.x, s.y) || nudge(state, u, s.x, s.y))) return;
      applyCommand(state, { type: "skip", unit: u.id });
      return;
    }
    const [cx, cy] = ctx.camp ?? [t.x, t.y];
    if (goto(state, u, cx, cy) || nudge(state, u, cx, cy)) return;
  }
  // Escorts: spare defenders march with the army and hold the camp beside the target.
  if (ctx.warTarget && !attacker && marches && ctx.camp && (ctx.campaignReady || ctx.escorts < ctx.escortsWanted)) {
    const spare = !inOwnCity || garrison(state, ctx, here).filter((o) => o.id !== u.id).length >= (ctx.wanted.get(here.id) ?? 1);
    if (spare) {
      const [cx, cy] = ctx.campaignReady ? ctx.camp : [ctx.staging!.x, ctx.staging!.y];
      if (u.x === cx && u.y === cy) { applyCommand(state, { type: "fortify", unit: u.id }); return; }
      if (goto(state, u, cx, cy) || nudge(state, u, cx, cy)) return;
    }
  }
  const needy = nearestCity(state, ctx, u, (c) => shortOfGuards(state, ctx, c) && !(here && c.id === here.id));
  if (needy && goto(state, u, needy.x, needy.y)) return;

  // 3. Exploration while the map is young.
  const scouting = ctx.units.filter((o) => isMilitary(o) && o.id !== u.id && !cityAt(state, o.x, o.y)).length;
  if ((ctx.turn < 150 || ctx.cities.length === 0 || ctx.landUnexplored) && scouting < (ctx.turn < 150 ? 2 : 1) && explore(state, u)) return;

  // 4. Otherwise sit tight at home.
  if (inOwnCity) { applyCommand(state, { type: "fortify", unit: u.id }); return; }
  const home = nearestCity(state, ctx, u);
  if (home && goto(state, u, home.x, home.y)) return;
  applyCommand(state, { type: "fortify", unit: u.id });
}

// ---- caravans ----------------------------------------------------------------------------

/** The best city to open a route to from `home`: far away, rich in trade, with room for a route. */
function tradePartner(state: GameState, ctx: Ctx, home: City): City | null {
  if (home.routes.length >= MAX_TRADE_ROUTES) return null;
  let best: City | null = null;
  let bestV = 0;
  for (const c of state.cities) {
    if (c.id === home.id || home.routes.includes(c.id) || c.routes.length >= MAX_TRADE_ROUTES) continue;
    if (c.owner !== ctx.me && (c.owner === state.barbarians || !hasContact(state, ctx.me, c.owner) || ctx.enemies.has(c.owner))) continue;
    if (!ctx.continents.has(getTile(state.map, c.x, c.y)!.continent)) continue;
    const d = cityDistance(state, home, c);
    if (d < TRADE_ROUTE_MIN_DIST) continue;
    const v = tileTrade(state, c) * (c.owner === ctx.me ? 1 : 2) + d / 4;
    if (v > bestV) { bestV = v; best = c; }
  }
  return best;
}

function orderCaravan(state: GameState, ctx: Ctx, u: Unit): void {
  const here = cityAt(state, u.x, u.y);
  if (here && here.owner === ctx.me) {
    if (canHelpWonder(state, u, here) === null && wonder(here.production.id).cost - here.shields >= unitType(u.type).cost / 2) {
      applyCommand(state, { type: "helpWonder", unit: u.id });
      return;
    }
    if (canTradeRoute(state, u, here) === null) { applyCommand(state, { type: "tradeRoute", unit: u.id }); return; }
  }
  const site = ctx.wonderSite;
  if (site && site.id !== here?.id && (goto(state, u, site.x, site.y) || nudge(state, u, site.x, site.y))) return;
  const home = u.homeCity !== null ? ctx.cities.find((c) => c.id === u.homeCity) : undefined;
  const partner = home ? tradePartner(state, ctx, home) : null;
  if (partner) {
    // A foreign partner is entered with a plain step; the move itself opens the route.
    if (dist(state, u.x, u.y, partner.x, partner.y) <= 1 && nudge(state, u, partner.x, partner.y)) return;
    if (goto(state, u, partner.x, partner.y) || nudge(state, u, partner.x, partner.y)) return;
  }
  if (here && here.owner === ctx.me) { applyCommand(state, { type: "skip", unit: u.id }); return; }
  const back = nearestCity(state, ctx, u);
  if (back && goto(state, u, back.x, back.y)) return;
  applyCommand(state, { type: "skip", unit: u.id });
}

// ---- diplomats -----------------------------------------------------------------------

function orderDiplomat(state: GameState, ctx: Ctx, u: Unit): void {
  const target = ctx.spyTarget;
  if (!target) {
    const home = nearestCity(state, ctx, u);
    if (home && !(u.x === home.x && u.y === home.y) && goto(state, u, home.x, home.y)) return;
    applyCommand(state, { type: "skip", unit: u.id });
    return;
  }
  if (dist(state, u.x, u.y, target.x, target.y) <= 1) {
    const theirs = state.players[target.owner]!.advances.filter((a) => !ctx.p.advances.includes(a));
    const action = theirs.length > 0 ? "steal" : "sabotage";
    if (applyCommand(state, { type: "diplomat", unit: u.id, action, x: target.x, y: target.y }).ok) return;
    applyCommand(state, { type: "skip", unit: u.id });
    return;
  }
  if (goto(state, u, target.x, target.y) || nudge(state, u, target.x, target.y)) return;
  applyCommand(state, { type: "skip", unit: u.id });
}

// ---- settlers -------------------------------------------------------------------------

interface Job { x: number; y: number; work: WorkKind; value: number }

/** Jobs around a city, computed once per turn; a job vanishes from the list once a settler takes it. */
function cityJobs(state: GameState, ctx: Ctx, c: City): Job[] {
  let jobs = ctx.jobs.get(c.id);
  if (!jobs) { jobs = terraformJobs(state, ctx, c); ctx.jobs.set(c.id, jobs); }
  return jobs;
}

function takeJob(ctx: Ctx, job: Job): void {
  for (const list of ctx.jobs.values()) {
    const i = list.findIndex((j) => j.x === job.x && j.y === job.y);
    if (i >= 0) list.splice(i, 1);
  }
}

function terraformJobs(state: GameState, ctx: Ctx, c: City): Job[] {
  const jobs: Job[] = [];
  const gov = government(ctx.p.government);
  // Worked tiles first, plus the best two spare tiles the city will grow onto.
  const spare: { slot: number; v: number }[] = [];
  for (let s = 1; s < CITY_RADIUS.length; s++) {
    if (c.worked.includes(s) || !slotFree(state, ctx, c, s)) continue;
    const t = radiusTile(state, c, s)!;
    if (t.terrain === Terrain.Ocean) continue;
    spare.push({ slot: s, v: slotValue(state, c, s, ctx.p.government) });
  }
  spare.sort((a, b) => b.v - a.v);
  for (const slot of [...c.worked, ...spare.slice(0, 2).map((s) => s.slot)]) {
    const [dx, dy] = CITY_RADIUS[slot]!;
    const x = wrapX(state.map, c.x + dx);
    const y = c.y + dy;
    const t = getTile(state.map, x, y);
    if (!t || t.terrain === Terrain.Ocean) continue;
    if (state.units.some((o) => o.owner !== ctx.me && o.x === x && o.y === y)) continue;
    const r = TERRAIN_RULES[t.terrain];
    const busy = ctx.units.some((o) => o.order.kind === "work" && o.x === x && o.y === y);
    if (busy) continue;
    if (t.pollution) { jobs.push({ x, y, work: "clean", value: 6 }); continue; }
    if (r.irrigate?.food && r.irrigate.becomes === undefined && !t.irrigation && !t.mine && hasWaterNearby(state, x, y))
      jobs.push({ x, y, work: "irrigate", value: 3 + (gov.tilePenalty && r.food >= 2 ? -1 : 0) });
    if (t.terrain === Terrain.Hills && !t.mine) jobs.push({ x, y, work: "mine", value: 4 });
    if (r.road.trade > 0 && !t.road && !t.river) jobs.push({ x, y, work: "road", value: 2 + gov.tradeBonus });
    if (ctx.p.advances.includes("railroad") && tileYield(state, t, false, ctx.p.government, ctx.me).shields >= 2) {
      // Rails pay on shield tiles; the road comes first where there is none yet.
      if (t.road && !t.railroad) jobs.push({ x, y, work: "railroad", value: 3 });
      else if (!t.road && !t.river && r.road.turns > 0) jobs.push({ x, y, work: "road", value: 2 });
    }
  }
  // Pollution anywhere in the radius is worth clearing, worked or not.
  for (let s = 1; s < CITY_RADIUS.length; s++) {
    if (c.worked.includes(s)) continue;
    const [dx, dy] = CITY_RADIUS[s]!;
    const x = wrapX(state.map, c.x + dx);
    const y = c.y + dy;
    const t = getTile(state.map, x, y);
    if (!t?.pollution || ctx.units.some((o) => o.order.kind === "work" && o.x === x && o.y === y)) continue;
    jobs.push({ x, y, work: "clean", value: 5 });
  }
  return jobs;
}

function reservedSites(state: GameState, ctx: Ctx, except: Unit): [number, number][] {
  const out: [number, number][] = [];
  for (const o of ctx.units) {
    if (o.id === except.id || !unitType(o.type).flags?.includes("settler") || o.order.kind !== "goto") continue;
    out.push([o.order.x, o.order.y]);
  }
  return out;
}

function orderSettler(state: GameState, ctx: Ctx, u: Unit): void {
  const here = cityAt(state, u.x, u.y);
  const canFound = !here && canFoundCity(state, u.x, u.y) === null && (state.packedCities === true || roomForCity(state, ctx.me, u.x, u.y));
  const hereScore = canFound ? siteScore(state, u.x, u.y) : null;

  // The first city goes down at once on any fit tile.
  if (ctx.cities.length === 0) {
    if (hereScore !== null) { applyCommand(state, { type: "found", unit: u.id }); return; }
    const sites = ctx.sites().filter((s) => dist(state, u.x, u.y, s.x, s.y) <= 3);
    const near = sites.sort((a, b) => b.score - a.score)[0];
    if (near && (goto(state, u, near.x, near.y) || nudge(state, u, near.x, near.y))) return;
    if (canFound) { applyCommand(state, { type: "found", unit: u.id }); return; }
    explore(state, u);
    return;
  }

  const workers = ctx.units.filter((o) => o.id !== u.id && unitType(o.type).flags?.includes("settler") && o.order.kind === "work").length;
  const home = (u.homeCity !== null ? ctx.cities.find((c) => c.id === u.homeCity) : undefined) ?? nearestCity(state, ctx, u);
  const jobs: Job[] = [];
  for (const c of ctx.cities) if (dist(state, u.x, u.y, c.x, c.y) <= 6) jobs.push(...cityJobs(state, ctx, c));
  // Only sites a settler can walk to count; with none on its continent it may be bound for a colony.
  const myContinent = continentOf(state, u.x, u.y);
  const sites = ctx.wantMoreCities ? ctx.sites().filter((s) => continentOf(state, s.x, s.y) === myContinent) : [];
  const overseasBound = sites.length === 0 && ctx.wantOverseas();
  const wantWork = jobs.length > 0 && ((sites.length === 0 && !overseasBound) || workers < ctx.workersWanted);

  if (wantWork) {
    let best: Job | null = null;
    let bestV = -Infinity;
    for (const j of jobs) {
      const v = j.value * 3 - dist(state, u.x, u.y, j.x, j.y);
      if (v > bestV) { bestV = v; best = j; }
    }
    if (best) {
      if (u.x === best.x && u.y === best.y) {
        if (applyCommand(state, { type: "work", unit: u.id, work: best.work }).ok) { takeJob(ctx, best); return; }
      } else if (goto(state, u, best.x, best.y) || nudge(state, u, best.x, best.y)) { takeJob(ctx, best); return; }
    }
  }

  // No room at home: wait in port for a ferry, stepping aboard one berthed alongside (a settler just put ashore founds where it stands).
  if (overseasBound && hereScore === null) {
    if (here && here.owner === ctx.me && coastal(state, here)) {
      for (const [dx, dy] of NEIGHBOURS) {
        const x = wrapX(state.map, u.x + dx);
        const y = u.y + dy;
        const ship = ctx.units.find((o) => o.x === x && o.y === y && isFerry(o) && cargo(state, o).length < (unitType(o.type).capacity ?? 0));
        if (ship && applyCommand(state, { type: "move", unit: u.id, dx, dy }).ok) return;
      }
      applyCommand(state, { type: "skip", unit: u.id });
      return;
    }
    const port = nearestCity(state, ctx, u, (c) => coastal(state, c) && continentOf(state, c.x, c.y) === myContinent);
    if (port && goto(state, u, port.x, port.y)) return;
  }

  // Found here when this tile is about as good as anything nearby.
  const reserved = reservedSites(state, ctx, u);
  const apart = state.packedCities ? 3 : CITY_SPACING.own;
  const open = sites.filter((s) => !reserved.some(([rx, ry]) => dist(state, rx, ry, s.x, s.y) < apart));
  const ranked = open
    .map((s) => ({ s, v: s.score - 3 * dist(state, u.x, u.y, s.x, s.y) }))
    .sort((a, b) => b.v - a.v);
  if (hereScore !== null) {
    const bestNear = ranked[0]?.s.score ?? 0;
    if (hereScore >= bestNear * 0.9 || ranked.length === 0) { applyCommand(state, { type: "found", unit: u.id }); return; }
  }
  for (const { s } of ranked.slice(0, 4)) {
    if (goto(state, u, s.x, s.y)) return;
  }
  if (ranked[0] && nudge(state, u, ranked[0].s.x, ranked[0].s.y)) return;
  if (hereScore !== null) { applyCommand(state, { type: "found", unit: u.id }); return; }
  // Nothing to do: look around for land we have not seen; a surplus of idle settlers is just mouths to feed.
  if (sites.length === 0 && !overseasBound && explore(state, u)) return;
  const idle = ctx.units.filter((o) => unitType(o.type).flags?.includes("settler") && o.order.kind === "none").length;
  if (jobs.length === 0 && sites.length === 0 && !overseasBound && ctx.turn > 40 && idle > Math.ceil(ctx.cities.length / 4)) {
    applyCommand(state, { type: "disband", unit: u.id });
    return;
  }
  if (here && here.owner === ctx.me) { applyCommand(state, { type: "skip", unit: u.id }); return; }
  if (home && goto(state, u, home.x, home.y)) return;
  applyCommand(state, { type: "skip", unit: u.id });
}
