import { barbarianUnits } from "./barbarians.js";
import { traitContent, traitEffects, traitFoodBoxPct, traitGrowthKeep, traitPct, traitVeteran } from "./traits.js";
import { knows } from "./rules/advances.js";
import { addPart, partCount, SPACE_PARTS, spacePart } from "./rules/spaceship.js";
import { building, BUILDINGS } from "./rules/buildings.js";
import { wonder, WONDERS, type WonderRule } from "./rules/wonders.js";
import { CELEBRATION_SIZE, EMPIRE_SIZE_STEP, government } from "./rules/governments.js";
import { civ } from "./rules/civs.js";
import { nextCityName } from "./rules/names.js";
import { specialOf, TERRAIN_RULES } from "./rules/terrain.js";
import { UNIT_TYPES, unitType } from "./rules/units.js";
import {
  CITY_RADIUS,
  getTile,
  NEIGHBOURS,
  Terrain,
  wrapX,
  type City,
  type GameState,
  type Production,
  type Tile,
  type Unit,
} from "./types.js";
import { borderRadius, cultureRate, landOwner, withinBorder } from "./territory.js";
import { createUnit } from "./units.js";
import { recomputeVisibility, revealAround } from "./visibility.js";

export interface Yield {
  food: number;
  shields: number;
  trade: number;
}

/** Yield of one tile for a city of `owner`, with improvements and the government's tile penalty. */
/**
 * What a worked square yields under a government. `owner`, the civilization working it, adds
 * what its advances bring (pastures from Animal Husbandry); leave it out for a square nobody works.
 */
export function tileYield(state: GameState, tile: Tile, isCentre: boolean, govId: string, owner?: number): Yield {
  const r = TERRAIN_RULES[tile.terrain];
  let food = r.food;
  let shields = r.shields;
  let trade = r.trade;
  const sp = specialOf(tile);
  if (sp) {
    food += sp.food ?? 0;
    shields += sp.shields ?? 0;
    trade += sp.trade ?? 0;
    const learned = sp.learned;
    if (learned && owner !== undefined && knows(state.players[owner]?.advances ?? [], learned.advance)) {
      food += learned.food ?? 0;
      shields += learned.shields ?? 0;
      trade += learned.trade ?? 0;
    }
  }
  if (tile.river) trade += 1;
  if (tile.road) trade += r.road.trade;
  // The centre tile counts as irrigated where irrigation is possible, and
  // always yields at least one shield.
  if ((tile.irrigation || isCentre) && r.irrigate?.food && !tile.mine) food += r.irrigate.food;
  if (tile.mine && r.mine?.shields) shields += r.mine.shields;
  if (isCentre && shields < 1) shields = 1;
  if (tile.railroad) shields += Math.floor(shields / 2);
  const gov = government(govId);
  if (gov.tilePenalty) {
    if (food > 2) food--;
    if (shields > 2) shields--;
    if (trade > 2) trade--;
  }
  if (gov.tradeBonus && trade > 0) trade += gov.tradeBonus;
  if (tile.pollution) {
    food = Math.floor(food / 2);
    shields = Math.floor(shields / 2);
    trade = Math.floor(trade / 2);
  }
  return { food, shields, trade };
}

/** Advances that make each citizen pollute a little more. */
const POLLUTING_ADVANCES = ["industrialization", "automobile", "mass_production", "plastics"];

/**
 * Chance (percent per turn) that the city fouls a tile in its radius:
 * shields over twenty, plus a share of the population once industry
 * arrives. Mass Transit removes the population part; Recycling Centers,
 * plants and the Hoover Dam cut the production part (the best one counts).
 */
export function pollutionChance(state: GameState, city: City, shields: number): number {
  const p = state.players[city.owner]!;
  let prodCut = 0;
  let transit = false;
  for (const id of city.buildings) {
    const b = building(id);
    if (id === "mass_transit") transit = true;
    else if (b.pollutionPct) prodCut = Math.max(prodCut, b.pollutionPct);
  }
  const here = getTile(state.map, city.x, city.y)!.continent;
  for (const { rule, city: wc } of activeWonders(state, city.owner))
    if (rule.effect.kind === "powerPlantContinent" && getTile(state.map, wc.x, wc.y)!.continent === here) prodCut = Math.max(prodCut, 50);
  const prod = Math.floor((shields * (100 - prodCut)) / 100);
  const techs = POLLUTING_ADVANCES.filter((a) => knows(p.advances, a)).length;
  const pop = transit ? 0 : Math.floor((city.size * techs * 25) / 100);
  return Math.max(0, prod + pop - 20);
}

/** Units a city supports without paying shields under its owner's government. */
export function freeUnits(state: GameState, city: City): number {
  const gov = government(state.players[city.owner]!.government);
  return state.looseUpkeep ? gov.looseFreeUnits : gov.freeUnits === "size" ? city.size : gov.freeUnits;
}

/**
 * What each unit a city supports costs it a turn, oldest first: the oldest ride on the
 * government's free units, the rest pay shields, and settlers eat food besides.
 */
export function unitSupport(state: GameState, city: City): { unit: Unit; shields: number; food: number }[] {
  const gov = government(state.players[city.owner]!.government);
  let free = freeUnits(state, city);
  return state.units.filter((u) => u.homeCity === city.id).map((unit) => {
    const food = unitType(unit.type).flags?.includes("settler") ? gov.settlerFood : 0;
    if (free > 0) { free--; return { unit, shields: 0, food }; }
    return { unit, shields: gov.unitUpkeep, food };
  });
}

/** A unit its city can no longer pay for leaves the game; what it carries steps ashore in port and sinks with it at sea. */
function disbandForUpkeep(state: GameState, unit: Unit): void {
  const atSea = getTile(state.map, unit.x, unit.y)?.terrain === Terrain.Ocean;
  const gone = new Set([unit.id]);
  for (const o of state.units) if (o.aboard === unit.id) { if (atSea) gone.add(o.id); else o.aboard = null; }
  state.units = state.units.filter((u) => !gone.has(u.id));
}

export function cityById(state: GameState, id: number): City | undefined {
  return state.cities.find((c) => c.id === id);
}

export function cityAt(state: GameState, x: number, y: number): City | undefined {
  const wx = wrapX(state.map, x);
  return state.cities.find((c) => c.x === wx && c.y === y);
}

/** Tile index for a radius slot, or null if off the map. */
export function radiusTile(state: GameState, city: City, slot: number): Tile | null {
  const [dx, dy] = CITY_RADIUS[slot]!;
  return getTile(state.map, city.x + dx, city.y + dy) ?? null;
}

/**
 * Does a radius slot lie in the city's own land: within its border, on a
 * square its civilization holds (a square another civilization's city claims
 * is theirs)? Always true in saves before version 16 (`workBeyondBorders`).
 */
export function slotInLand(state: GameState, city: City, slot: number): boolean {
  if (state.workBeyondBorders || slot === 0) return true;
  const [dx, dy] = CITY_RADIUS[slot]!;
  if (!withinBorder(dx, dy, borderRadius(state, city))) return false;
  return landOwner(state, wrapX(state.map, city.x + dx), city.y + dy) === city.owner;
}

/** Is a radius slot available to this city (on map, in its land, not worked by another city, not enemy-occupied)? */
export function slotAvailable(state: GameState, city: City, slot: number): boolean {
  if (slot === 0) return false;
  const t = radiusTile(state, city, slot);
  if (!t || !slotInLand(state, city, slot)) return false;
  const [dx, dy] = CITY_RADIUS[slot]!;
  const x = wrapX(state.map, city.x + dx);
  const y = city.y + dy;
  for (const other of state.cities) {
    if (other.id === city.id) continue;
    if (other.x === x && other.y === y) return false;
    for (const s of other.worked) {
      const [ox, oy] = CITY_RADIUS[s]!;
      if (wrapX(state.map, other.x + ox) === x && other.y + oy === y) return false;
    }
  }
  if (state.units.some((u) => u.owner !== city.owner && u.x === x && u.y === y)) return false;
  return true;
}

/** How much a worker on this square is worth to the city: food first, then shields, then trade. */
export function slotScore(state: GameState, city: City, slot: number): number {
  const t = radiusTile(state, city, slot);
  if (!t) return -Infinity;
  const y = tileYield(state, t, false, state.players[city.owner]!.government, city.owner);
  return y.food * 3 + y.shields * 2 + y.trade;
}

/** Greedy worker placement: food first, then shields, then trade. */
export function autoAssignWorkers(state: GameState, city: City): void {
  city.worked = [];
  const wanted = city.size - city.specialists.length;
  const scored: { slot: number; score: number }[] = [];
  for (let slot = 1; slot < CITY_RADIUS.length; slot++) {
    if (!slotAvailable(state, city, slot)) continue;
    scored.push({ slot, score: slotScore(state, city, slot) });
  }
  scored.sort((a, b) => b.score - a.score);
  city.worked = scored.slice(0, Math.max(0, wanted)).map((s) => s.slot);
  // Not enough tiles: surplus citizens become entertainers.
  while (city.worked.length + city.specialists.length < city.size) city.specialists.push("entertainer");
}

/**
 * Squares a city works that are no longer its land (its border drew back as
 * its culture fell, or a rival's city took them): each worker moves to the
 * best free square left, or becomes an entertainer. Run as its owner's turn
 * begins, before the city produces.
 */
export function dropLostSquares(state: GameState, city: City): void {
  const lost = city.worked.filter((s) => !slotInLand(state, city, s));
  if (!lost.length) return;
  city.worked = city.worked.filter((s) => !lost.includes(s));
  for (let n = 0; n < lost.length; n++) {
    let best = -1;
    for (let slot = 1; slot < CITY_RADIUS.length; slot++) {
      if (city.worked.includes(slot) || !slotAvailable(state, city, slot)) continue;
      if (best < 0 || slotScore(state, city, slot) > slotScore(state, city, best)) best = slot;
    }
    if (best < 0) city.specialists.push("entertainer");
    else city.worked.push(best);
  }
}

/** The worked square a city would give up first: the one worth least. */
export function weakestWorked(state: GameState, city: City): number | undefined {
  let worst: number | undefined;
  for (const s of city.worked) if (worst === undefined || slotScore(state, city, s) < slotScore(state, city, worst)) worst = s;
  return worst;
}

/**
 * Every citizen on the best squares (ranked as autoAssignWorkers ranks them),
 * keeping only as many entertainers as the city needs to stay out of
 * disorder. Specialists are put back to work.
 */
export function arrangeCity(state: GameState, city: City): void {
  city.specialists = [];
  autoAssignWorkers(state, city);
  let guard = 0;
  while (computeCity(state, city).disorder && city.worked.length > 0 && guard++ < 40) {
    const worst = weakestWorked(state, city)!;
    city.worked.splice(city.worked.indexOf(worst), 1);
    city.specialists.push("entertainer");
  }
}

/** A step of the happiness reckoning, in the order the city screen's Happy panel shows them. */
export type MoodStageKind = "born" | "luxury" | "buildings" | "soldiers" | "wonders";
export const MOOD_STAGES: readonly MoodStageKind[] = ["born", "luxury", "buildings", "soldiers", "wonders"];
/** The citizens' moods after one stage of the reckoning. */
export interface MoodStage {
  stage: MoodStageKind;
  happy: number;
  content: number;
  unhappy: number;
}

export interface CityReport {
  food: number;
  shields: number;
  trade: number;
  /** Part of `trade` that comes from caravan routes. */
  routes: number;
  /** Percent chance per turn of polluting a tile. */
  pollution: number;
  foodSurplus: number;
  shieldSurplus: number;
  /** Unit upkeep in shields and food. */
  unitShields: number;
  unitFood: number;
  corruption: number;
  tax: number;
  lux: number;
  science: number;
  buildingUpkeep: number;
  happy: number;
  content: number;
  unhappy: number;
  disorder: boolean;
  /** The moods after each stage (`MOOD_STAGES`), the last being the city's. */
  moods: MoodStage[];
  /** Unhappy citizens made content by soldiers in the city (martial law). */
  martialLaw: number;
  /** Citizens soured by soldiers away from home (war weariness). */
  weariness: number;
  /** The people are in the mood to celebrate: size 3 or more, nobody unhappy, half of them happy. At the turn's end it becomes `City.celebrating`. */
  celebration: boolean;
  foodBox: number;
  productionCost: number;
}

export function foodBox(city: City): number {
  return (city.size + 1) * 10;
}

/** The food a city must store to grow, after its owner's trait. */
export function cityFoodBox(state: GameState, city: City): number {
  const pct = traitFoodBoxPct(state, city.owner);
  return pct === 0 ? foodBox(city) : Math.max(1, Math.round((foodBox(city) * (100 + pct)) / 100));
}

/** The rules' cost of a production, before any civilization's trait. */
export function productionCost(p: Production): number {
  return p.kind === "unit" ? unitType(p.id).cost : p.kind === "wonder" ? wonder(p.id).cost : p.kind === "spaceship" ? spacePart(p.id).cost : building(p.id).cost;
}

/** What a production costs `owner`: the rules' cost, less any discount of its civilization's trait. */
export function costFor(state: GameState, owner: number, p: Production): number {
  let pct = 0;
  for (const e of traitEffects(state, owner)) {
    if (e.kind !== "cost") continue;
    const soldier = p.kind === "unit" && unitType(p.id).domain === "land" && unitType(p.id).attack > 0;
    if ((p.kind === "wonder" && e.wonders) || (p.kind === "building" && e.buildings?.includes(p.id)) || (p.kind === "unit" && e.units?.includes(p.id)) || (soldier && e.soldiers)) pct += e.pct;
  }
  const base = productionCost(p);
  return pct === 0 ? base : Math.max(1, Math.round((base * (100 + pct)) / 100));
}

export function productionName(p: Production): string {
  return p.kind === "unit" ? unitType(p.id).name : p.kind === "wonder" ? wonder(p.id).name : p.kind === "spaceship" ? spacePart(p.id).name : building(p.id).name;
}

/** Active (non-obsolete) wonders owned by a player, with the city holding each. */
export function activeWonders(state: GameState, owner: number): { rule: WonderRule; city: City }[] {
  const p = state.players[owner]!;
  const out: { rule: WonderRule; city: City }[] = [];
  for (const c of state.cities) {
    if (c.owner !== owner) continue;
    for (const id of c.wonders) {
      const rule = wonder(id);
      if (rule.obsolete && knows(p.advances, rule.obsolete)) continue;
      out.push({ rule, city: c });
    }
  }
  return out;
}

export function hasWonder(state: GameState, owner: number, id: string): boolean {
  return activeWonders(state, owner).some((w) => w.rule.id === id);
}

export function wonderBuilt(state: GameState, id: string): boolean {
  return state.cities.some((c) => c.wonders.includes(id));
}

export function cityDistance(state: GameState, a: City, b: City): number {
  const dx = Math.min(Math.abs(a.x - b.x), state.map.width - Math.abs(a.x - b.x));
  return Math.max(dx, Math.abs(a.y - b.y));
}

export function distanceToCapital(state: GameState, city: City): number {
  const capital = state.cities.find((c) => c.owner === city.owner && c.buildings.includes("palace"));
  if (!capital) return 16;
  return cityDistance(state, capital, city);
}

// ---- caravans: trade routes and wonder help ----------------------------------

/** Cities must be this far apart to trade. */
export const TRADE_ROUTE_MIN_DIST = 9;
export const MAX_TRADE_ROUTES = 3;

/** Trade from the centre and worked tiles alone, so route values never recurse. */
export function tileTrade(state: GameState, city: City): number {
  const gov = state.players[city.owner]!.government;
  let trade = tileYield(state, getTile(state.map, city.x, city.y)!, true, gov, city.owner).trade;
  for (const slot of city.worked) {
    const t = radiusTile(state, city, slot);
    if (t) trade += tileYield(state, t, false, gov, city.owner).trade;
  }
  return trade;
}

/** Trade each city earns every turn from a route between them; foreign partners pay double. */
export function routeTrade(state: GameState, a: City, b: City): number {
  const base = Math.floor((tileTrade(state, a) + tileTrade(state, b) + 4) / 8);
  return Math.max(1, a.owner === b.owner ? base : base * 2);
}

/** One-off gold and science when a route is opened: distance and both cities' trade. */
export function routeBonus(state: GameState, home: City, target: City): number {
  const v = Math.floor(((cityDistance(state, home, target) + 10) * (tileTrade(state, home) + tileTrade(state, target))) / 24);
  return Math.max(1, home.owner === target.owner ? v : v * 2);
}

/** Why a caravan here could not open a route from its home city to `city`, or null. */
export function canTradeRoute(state: GameState, u: Unit, city: City): string | null {
  if (!unitType(u.type).flags?.includes("caravan")) return "only caravans trade";
  const home = u.homeCity !== null ? cityById(state, u.homeCity) : undefined;
  if (!home) return "the caravan has no home city";
  if (home.id === city.id) return "that is its home city";
  if (cityDistance(state, home, city) < TRADE_ROUTE_MIN_DIST) return "too close to home";
  if (home.routes.includes(city.id)) return "a route already exists";
  if (home.routes.length >= MAX_TRADE_ROUTES || city.routes.length >= MAX_TRADE_ROUTES) return "no room for another route";
  return null;
}

/** Gold to buy a city's loyalty: dearer the bigger it is, the richer its owner and the closer to its capital. Capitals never sell. */
export function inciteCost(state: GameState, city: City): number {
  if (city.buildings.includes("palace")) return Infinity;
  const owner = state.players[city.owner]!;
  return Math.floor(((1000 + owner.gold) * city.size) / (3 + distanceToCapital(state, city)));
}

/** Why a caravan here could not add its shields to the city's wonder, or null. */
export function canHelpWonder(state: GameState, u: Unit, city: City): string | null {
  if (!unitType(u.type).flags?.includes("caravan")) return "only caravans help";
  if (city.owner !== u.owner) return "not our city";
  if (city.production.kind !== "wonder") return "no wonder in production";
  return null;
}

/**
 * Citizens born content, by difficulty (6 at Chieftain down to 2 at Emperor), fewer as the empire
 * grows: one less once the civilization holds more cities than its government's `empireSize`, one
 * less again for every `EMPIRE_SIZE_STEP` beyond (the original's unhappiness from size, FreeCiv's
 * civ1 numbers). Saves before version 17 lose one per four cities past eight, whatever the government.
 */
export function contentBase(state: GameState, owner: number): number {
  const p = state.players[owner]!;
  const base = [6, 5, 4, 3, 2][p.difficulty] ?? 4;
  const cities = state.cities.filter((c) => c.owner === owner).length;
  if (state.simpleMoods) return Math.max(0, base - Math.floor(Math.max(0, cities - 8) / 4));
  const limit = government(p.government).empireSize;
  const penalty = cities > limit ? 1 + Math.floor((cities - limit - 1) / EMPIRE_SIZE_STEP) : 0;
  return Math.max(0, base - penalty);
}

/**
 * The government whose tile rules a city's squares yield by: its own, or while the city celebrates
 * the one its government's `celebration` names (a Despotism's festival lifts the tile penalty, a
 * Monarchy's or Communism's brings the Democracy's trade).
 */
export function cityYieldGovernment(state: GameState, city: City): string {
  const gov = state.players[city.owner]!.government;
  const rule = government(gov).celebration;
  return city.celebrating && rule && "yieldsAs" in rule ? rule.yieldsAs : gov;
}

/** Everything the city screen shows and the turn pass needs, computed from state. */
export function computeCity(state: GameState, city: City): CityReport {
  const player = state.players[city.owner]!;
  const gov = government(player.government);
  const yieldGov = cityYieldGovernment(state, city);
  const centre = getTile(state.map, city.x, city.y)!;
  let food = 0;
  let shields = 0;
  let trade = 0;
  const c = tileYield(state, centre, true, yieldGov, city.owner);
  food += c.food;
  shields += c.shields;
  trade += c.trade;
  for (const slot of city.worked) {
    const t = radiusTile(state, city, slot);
    if (!t) continue;
    const y = tileYield(state, t, false, yieldGov, city.owner);
    food += y.food;
    shields += y.shields;
    trade += y.trade;
  }
  let routes = 0;
  for (const id of city.routes) {
    const other = cityById(state, id);
    if (other) routes += routeTrade(state, city, other);
  }
  trade += routes;

  const has = (id: string) => city.buildings.includes(id);
  let shieldPct = 0;
  let taxPct = traitPct(state, city.owner, "taxPct");
  let luxPct = 0;
  let sciPct = traitPct(state, city.owner, "sciencePct");
  let contentFromBuildings = traitContent(state, city.owner);
  let buildingUpkeep = 0;
  for (const id of city.buildings) {
    const b = building(id);
    shieldPct += b.shieldsPct ?? 0;
    taxPct += b.taxPct ?? 0;
    luxPct += b.luxPct ?? 0;
    sciPct += b.sciencePct ?? 0;
    contentFromBuildings += b.content ?? 0;
    buildingUpkeep += b.upkeep;
  }

  // Wonders.
  const wonders = activeWonders(state, city.owner);
  let contentFromWonders = 0;
  let noUnhappy = false;
  let oceanTrade = 0;
  let police = 0;
  const sameContinent = (wc: City) => getTile(state.map, wc.x, wc.y)!.continent === getTile(state.map, city.x, city.y)!.continent;
  const hasPlant = has("power_plant") || has("hydro_plant") || has("nuclear_plant");
  for (const { rule, city: wc } of wonders) {
    const e = rule.effect;
    switch (e.kind) {
      case "contentAll": contentFromWonders += e.amount; break;
      case "contentCity": if (wc.id === city.id) contentFromWonders += e.amount; break;
      case "contentContinent": if (sameContinent(wc)) contentFromWonders += e.amount; break;
      case "noUnhappyCity": if (wc.id === city.id) noUnhappy = true; break;
      case "sciencePct": if (wc.id === city.id) sciPct += e.amount; break;
      case "scienceAll": sciPct += e.amount; break;
      case "oceanTrade": if (wc.id === city.id) oceanTrade += e.amount; break;
      case "templeDouble": if (has("temple")) contentFromBuildings += building("temple").content ?? 0; break;
      case "cathedralEverywhere": if (!has("cathedral")) contentFromBuildings += building("cathedral").content ?? 0; break;
      case "powerPlantContinent": if (has("factory") && !hasPlant && sameContinent(wc)) shieldPct += building("power_plant").shieldsPct ?? 0; break;
      case "policeEverywhere": police += 1; break;
      default: break;
    }
  }
  if (oceanTrade) {
    for (const slot of city.worked) {
      const t = radiusTile(state, city, slot);
      if (t?.terrain === Terrain.Ocean) trade += oceanTrade;
    }
  }

  // Corruption: trade lost to distance from the palace.
  let corruptionPct = Math.min(90, gov.corruptionPerDistance * distanceToCapital(state, city) * 2);
  const corruptionTrait = traitPct(state, city.owner, "corruptionPct");
  if (corruptionTrait) corruptionPct = (corruptionPct * (100 + corruptionTrait)) / 100;
  for (const id of city.buildings) if (building(id).halveCorruption) corruptionPct = Math.floor(corruptionPct / 2);
  if (has("palace")) corruptionPct = 0;
  const corruption = Math.floor((trade * corruptionPct) / 100);
  const netTrade = trade - corruption;

  // Split trade by rates; rounding remainder goes to tax.
  let lux = Math.floor((netTrade * player.luxRate) / 10);
  let science = Math.floor((netTrade * player.sciRate) / 10);
  let tax = netTrade - lux - science;
  for (const s of city.specialists) {
    if (s === "entertainer") lux += 2;
    else if (s === "taxman") tax += 2;
    else science += 2;
  }
  tax = Math.floor((tax * (100 + taxPct)) / 100);
  lux = Math.floor((lux * (100 + luxPct)) / 100);
  science = Math.floor((science * (100 + sciPct) * gov.sciencePct) / 10000);

  // Happiness, stage by stage as the original's Happy analysis showed it: citizens are born content
  // up to the base and unhappy beyond it; luxuries, buildings, soldiers and wonders then move them.
  const workers = city.size - city.specialists.length;
  const base = contentBase(state, city.owner);
  let content = Math.min(workers, base);
  let unhappy = workers - content;
  let happy = 0;
  const moods: MoodStage[] = [];
  const stage = (kind: MoodStageKind) => moods.push({ stage: kind, happy, content, unhappy });
  stage("born");
  // Luxuries: two per step, content -> happy first, then unhappy -> content.
  let luxLeft = Math.floor(lux / 2);
  while (luxLeft > 0 && content > 0) { content--; happy++; luxLeft--; }
  while (luxLeft > 0 && unhappy > 0) { unhappy--; content++; luxLeft--; }
  stage("luxury");
  // Buildings make unhappy citizens content (wonders with them, before version 17).
  let fix = contentFromBuildings + (state.simpleMoods ? contentFromWonders : 0);
  while (fix > 0 && unhappy > 0) { unhappy--; content++; fix--; }
  stage("buildings");
  // Martial law: soldiers in the city, up to the government's limit (three everywhere before version 17).
  let martialLaw = 0;
  const lawCap = state.simpleMoods ? Math.min(3, gov.martialLaw) : gov.martialLaw;
  if (lawCap > 0) {
    let soldiers = Math.min(lawCap, state.units.filter((u) => u.x === city.x && u.y === city.y && unitType(u.type).attack > 0 && u.owner === city.owner).length);
    while (soldiers > 0 && unhappy > 0) { unhappy--; content++; soldiers--; martialLaw++; }
  }
  // War weariness: soldiers away from home under the Republic and Democracy sour the content, then
  // (since version 17) the happy, two steps each, a step left over only sobering one; a police effect excuses some.
  let weariness = 0;
  if (gov.warWeariness > 0) {
    const abroad = state.units.filter(
      (u) => u.homeCity === city.id && unitType(u.type).attack > 0 && !cityAt(state, u.x, u.y),
    ).length;
    let weary = Math.max(0, abroad - police) * gov.warWeariness;
    while (weary > 0 && content > 0) { content--; unhappy++; weary--; weariness++; }
    if (!state.simpleMoods) {
      while (weary > 1 && happy > 0) { happy--; unhappy++; weary -= 2; weariness++; }
      if (weary > 0 && happy > 0) { happy--; content++; weariness++; }
    }
  }
  stage("soldiers");
  // Wonders last: their content, then Shakespeare's peace.
  if (!state.simpleMoods) {
    let calm = contentFromWonders;
    while (calm > 0 && unhappy > 0) { unhappy--; content++; calm--; }
  }
  if (noUnhappy) { content += unhappy; unhappy = 0; }
  stage("wonders");
  const disorder = unhappy > happy;
  const celebration = !state.simpleMoods && city.size >= CELEBRATION_SIZE && unhappy === 0 && happy >= Math.ceil(city.size / 2);

  // Unit upkeep.
  let unitShields = 0;
  let unitFood = 0;
  for (const s of unitSupport(state, city)) {
    unitShields += s.shields;
    unitFood += s.food;
  }

  shields = Math.floor((shields * (100 + shieldPct)) / 100);
  const foodEaten = workers * 2 + city.specialists.length * 2 + unitFood;

  return {
    food, shields, trade, routes,
    pollution: pollutionChance(state, city, shields),
    foodSurplus: food - foodEaten,
    // Riots stop the work, not the soldiers' pay: a city in disorder still owes its units (not before version 17).
    shieldSurplus: disorder ? (state.simpleMoods ? 0 : Math.min(0, shields - unitShields)) : shields - unitShields,
    unitShields, unitFood, corruption,
    tax: disorder ? 0 : tax,
    lux,
    science: disorder ? 0 : science,
    buildingUpkeep,
    happy, content, unhappy, disorder, moods, martialLaw, weariness, celebration,
    foodBox: cityFoodBox(state, city),
    productionCost: costFor(state, city.owner, city.production),
  };
}

export function canFoundCity(state: GameState, x: number, y: number): string | null {
  const t = getTile(state.map, x, y);
  if (!t) return "off map";
  if (t.terrain === Terrain.Ocean) return "cannot found at sea";
  if (cityAt(state, x, y)) return "a city is already here";
  for (const c of state.cities) {
    const dx = Math.min(Math.abs(c.x - x), state.map.width - Math.abs(c.x - x));
    if (dx <= 1 && Math.abs(c.y - y) <= 1) return "too close to another city";
  }
  return null;
}

/** The name a new city of this civilization would get: the next historical name, then the generic list. */
export function defaultCityName(state: GameState, owner: number): string {
  const used = new Set(state.cities.map((c) => c.name));
  const fromCiv = civ(state.players[owner]!.civ).cities.find((n) => !used.has(n));
  return fromCiv ?? nextCityName(used);
}

export function foundCity(state: GameState, owner: number, x: number, y: number, name?: string): City {
  const first = !state.cities.some((c) => c.owner === owner);
  const city: City = {
    id: state.nextCityId++,
    name: name?.trim().slice(0, 14) || defaultCityName(state, owner),
    owner,
    x: wrapX(state.map, x),
    y,
    size: 1,
    food: 0,
    shields: 0,
    worked: [],
    specialists: [],
    buildings: first ? ["palace"] : [],
    wonders: [],
    production: { kind: "unit", id: "militia" },
    founded: state.turn,
    culture: 0,
    disorder: false,
    unrest: 0,
    celebrating: false,
    routes: [],
  };
  state.cities.push(city);
  // Founding the city builds its road.
  getTile(state.map, city.x, city.y)!.road = true;
  autoAssignWorkers(state, city);
  revealAround(state, owner, city.x, city.y, 2);
  return city;
}

/** Gold to complete current production, the original's escalating price. */
export function buyCost(state: GameState, city: City): number {
  const cost = costFor(state, city.owner, city.production);
  const remaining = Math.max(0, cost - city.shields);
  if (remaining === 0) return 0;
  const base = city.production.kind === "unit" ? 2 * remaining + (remaining * remaining) / 20 : 2 * remaining;
  return Math.ceil(city.shields === 0 ? base * 2 : base);
}

export interface CityTurnEvent {
  city: number;
  kind: "grew" | "shrank" | "built" | "wonder" | "disorder" | "celebration" | "starving" | "famine" | "sold" | "pollution" | "disbanded" | "borders";
  detail?: string;
  /** What was finished ("built", "wonder"). */
  production?: Production;
}

/** End-of-turn pass for one city. Returns events for the UI. */
export function processCityTurn(state: GameState, city: City): CityTurnEvent[] {
  // The border reaches further as the city grows and builds (fixed in old saves).
  const reach = borderRadius(state, city);
  const events = cityTurn(state, city);
  if (!state.fixedBorders && borderRadius(state, city) > reach) events.push({ city: city.id, kind: "borders" });
  return events;
}

function cityTurn(state: GameState, city: City): CityTurnEvent[] {
  const events: CityTurnEvent[] = [];
  const player = state.players[city.owner]!;
  const gov = government(player.government);
  const r = computeCity(state, city);

  city.disorder = r.disorder;
  city.unrest = r.disorder ? city.unrest + 1 : 0;
  if (r.disorder) events.push({ city: city.id, kind: "disorder" });
  // The people celebrate when nobody is unhappy and half are happy: from the next turn the city runs
  // by its government's festival rule (`cityYieldGovernment`), and a Republic or Democracy grows it at once.
  if (r.celebration && !city.celebrating) events.push({ city: city.id, kind: "celebration" });
  city.celebrating = r.celebration;
  const festivalGrowth = city.celebrating && gov.celebration !== undefined && "grow" in gov.celebration && r.foodSurplus > 0;

  // Saves before version 14: culture mounted every turn.
  if (state.accruedCulture && !state.fixedBorders) city.culture += cultureRate(state, city);

  // Treasury: tax in, building upkeep out. A bankrupt treasury sells the costliest improvement to keep.
  player.gold += r.tax - r.buildingUpkeep;
  if (player.gold < 0) {
    const forSale = city.buildings.filter((b) => building(b).upkeep > 0 && b !== "palace").sort((a, b) => building(b).upkeep - building(a).upkeep);
    const sold = forSale[0];
    if (sold) {
      city.buildings = city.buildings.filter((b) => b !== sold);
      player.gold += building(sold).cost;
      events.push({ city: city.id, kind: "sold", detail: building(sold).name });
    }
  }
  player.science += r.science;

  // Food.
  city.food += r.foodSurplus;
  if (city.food < 0) {
    // Starvation: disband a food-eating settler first, else shrink.
    const settler = state.units.find((u) => u.homeCity === city.id && unitType(u.type).flags?.includes("settler"));
    if (settler) {
      state.units = state.units.filter((u) => u.id !== settler.id);
      events.push({ city: city.id, kind: "famine", detail: unitType(settler.type).name });
    } else if (city.size > 1) {
      city.size--;
      events.push({ city: city.id, kind: "shrank" });
    }
    city.food = 0;
    autoAssignWorkers(state, city);
  } else if (city.food >= r.foodBox || festivalGrowth) {
    const cap = city.buildings.includes("aqueduct") ? 99 : 10;
    if (city.size < cap) {
      city.size++;
      // A full granary empties into the new citizen (a Granary keeps half); a festival's growth leaves the store be.
      if (city.food >= r.foodBox) {
        const keep = Math.max(city.buildings.includes("granary") ? 1 / 2 : 0, traitGrowthKeep(state, city.owner));
        city.food = Math.floor(r.foodBox * keep);
      }
      events.push({ city: city.id, kind: "grew" });
      autoAssignWorkers(state, city);
    } else {
      city.food = Math.min(city.food, r.foodBox);
    }
  } else if (r.foodSurplus < 0) {
    events.push({ city: city.id, kind: "starving" });
  }

  // Shields.
  if (state.looseUpkeep) {
    // Old saves: upkeep beyond the surplus came out of the shield box; once that was empty the newest unit went.
    city.shields += r.shieldSurplus;
    if (city.shields < 0) {
      const victim = state.units.filter((u) => u.homeCity === city.id).pop();
      if (victim) state.units = state.units.filter((u) => u.id !== victim.id);
      city.shields = 0;
    }
  } else {
    // A city that cannot pay its units' upkeep disbands them, newest first, until it can.
    // Settlers go last: they carry a citizen.
    let surplus = r.shieldSurplus;
    if (surplus < 0) {
      const paying = unitSupport(state, city).filter((s) => s.shields > 0).reverse();
      const order = [...paying.filter((s) => s.food === 0), ...paying.filter((s) => s.food > 0)];
      let disbanded = false;
      for (const s of order) {
        if (surplus >= 0) break;
        disbandForUpkeep(state, s.unit);
        surplus += s.shields;
        disbanded = true;
        events.push({ city: city.id, kind: "disbanded", detail: unitType(s.unit.type).name });
      }
      if (disbanded) recomputeVisibility(state, city.owner);
    }
    city.shields += Math.max(0, surplus);
  }
  const cost = costFor(state, city.owner, city.production);
  if (city.shields >= cost) {
    const p = city.production;
    if (p.kind === "unit") {
      const u = createUnit(state, p.id, city.owner, city.x, city.y, city.id);
      if ((city.buildings.includes("barracks") && unitType(p.id).domain === "land") || traitVeteran(state, city.owner, p.id)) u.veteran = true;
      if (unitType(p.id).flags?.includes("settler")) {
        if (city.size > 1) city.size--;
        else {
          // A size-1 city can't produce settlers; keep the shields and wait.
          state.units = state.units.filter((x) => x.id !== u.id);
          return events;
        }
        autoAssignWorkers(state, city);
      }
      city.shields -= cost;
      events.push({ city: city.id, kind: "built", detail: unitType(p.id).name, production: { ...p } });
    } else if (p.kind === "spaceship") {
      addPart(player.spaceship, p.id);
      city.shields -= cost;
      events.push({ city: city.id, kind: "built", detail: spacePart(p.id).name, production: { ...p } });
      city.production = { kind: "unit", id: "militia" };
    } else if (p.kind === "wonder") {
      if (wonderBuilt(state, p.id)) {
        // Someone else finished it first: the shields stay for the next choice.
        city.production = { kind: "unit", id: "militia" };
        return events;
      }
      city.wonders.push(p.id);
      city.shields -= cost;
      events.push({ city: city.id, kind: "wonder", detail: wonder(p.id).name, production: { ...p } });
      city.production = { kind: "unit", id: "militia" };
    } else {
      if (!city.buildings.includes(p.id)) city.buildings.push(p.id);
      city.shields -= cost;
      events.push({ city: city.id, kind: "built", detail: building(p.id).name, production: { ...p } });
      // Move on to something sensible rather than rebuilding.
      city.production = { kind: "unit", id: "militia" };
    }
  }
  return events;
}

/** What a city may build right now, gated by the owner's advances. */
export function buildOptions(state: GameState, city: City): Production[] {
  // A barbarian city raises soldiers, nothing else.
  if (city.owner === state.barbarians) return barbarianUnits(state, "build").map((id) => ({ kind: "unit", id }));
  const p = state.players[city.owner]!;
  const out: Production[] = [];
  for (const t of UNIT_TYPES) {
    if (t.flags?.includes("leader")) continue;
    if (t.requires && !knows(p.advances, t.requires)) continue;
    if (t.domain === "sea" && !coastal(state, city)) continue;
    if (t.flags?.includes("nuclear") && !hasWonder(state, city.owner, "manhattan_project")) continue;
    out.push({ kind: "unit", id: t.id });
  }
  for (const b of BUILDINGS) {
    if (b.id === "palace" && city.buildings.includes("palace")) continue;
    if (city.buildings.includes(b.id)) continue;
    if (b.requires && !knows(p.advances, b.requires)) continue;
    if (b.needs && !city.buildings.includes(b.needs)) continue;
    out.push({ kind: "building", id: b.id });
  }
  for (const w of WONDERS) {
    if (wonderBuilt(state, w.id)) continue;
    if (!knows(p.advances, w.requires)) continue;
    if (w.obsolete && knows(p.advances, w.obsolete)) continue;
    out.push({ kind: "wonder", id: w.id });
  }
  if (wonderBuilt(state, "apollo_program") && p.spaceship.launched === null)
    for (const part of SPACE_PARTS)
      if (knows(p.advances, part.requires) && partCount(p.spaceship, part.id) < part.max) out.push({ kind: "spaceship", id: part.id });
  return out;
}

export function coastal(state: GameState, city: City): boolean {
  for (const [dx, dy] of NEIGHBOURS)
    if (getTile(state.map, city.x + dx, city.y + dy)?.terrain === Terrain.Ocean) return true;
  return false;
}
