import { knows } from "./rules/advances.js";
import { building, BUILDINGS } from "./rules/buildings.js";
import { wonder, WONDERS, type WonderRule } from "./rules/wonders.js";
import { government } from "./rules/governments.js";
import { civ } from "./rules/civs.js";
import { nextCityName } from "./rules/names.js";
import { TERRAIN_RULES } from "./rules/terrain.js";
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
} from "./types.js";
import { createUnit } from "./units.js";
import { revealAround } from "./visibility.js";

export interface Yield {
  food: number;
  shields: number;
  trade: number;
}

/** Yield of one tile for a city of `owner`, with improvements and the government's tile penalty. */
export function tileYield(state: GameState, tile: Tile, isCentre: boolean, govId: string): Yield {
  const r = TERRAIN_RULES[tile.terrain];
  let food = r.food;
  let shields = r.shields;
  let trade = r.trade;
  if (tile.special && r.special) {
    food += r.special.food ?? 0;
    shields += r.special.shields ?? 0;
    trade += r.special.trade ?? 0;
  }
  if (tile.river) trade += 1;
  if (tile.road) trade += r.road.trade;
  // The centre tile counts as irrigated where irrigation is possible, and
  // always yields at least one shield.
  if ((tile.irrigation || isCentre) && r.irrigate?.food && !tile.mine) food += r.irrigate.food;
  if (tile.mine && r.mine?.shields) shields += r.mine.shields;
  if (isCentre && shields < 1) shields = 1;
  const gov = government(govId);
  if (gov.tilePenalty) {
    if (food > 2) food--;
    if (shields > 2) shields--;
    if (trade > 2) trade--;
  }
  if (gov.tradeBonus && trade > 0) trade += gov.tradeBonus;
  return { food, shields, trade };
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

/** Is a radius slot available to this city (on map, not worked by another city, not enemy-occupied)? */
export function slotAvailable(state: GameState, city: City, slot: number): boolean {
  if (slot === 0) return false;
  const t = radiusTile(state, city, slot);
  if (!t) return false;
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

/** Greedy worker placement: food first, then shields, then trade. */
export function autoAssignWorkers(state: GameState, city: City): void {
  const gov = state.players[city.owner]!.government;
  city.worked = [];
  const wanted = city.size - city.specialists.length;
  const scored: { slot: number; score: number }[] = [];
  for (let slot = 1; slot < CITY_RADIUS.length; slot++) {
    if (!slotAvailable(state, city, slot)) continue;
    const t = radiusTile(state, city, slot)!;
    const y = tileYield(state, t, false, gov);
    scored.push({ slot, score: y.food * 3 + y.shields * 2 + y.trade });
  }
  scored.sort((a, b) => b.score - a.score);
  city.worked = scored.slice(0, Math.max(0, wanted)).map((s) => s.slot);
  // Not enough tiles: surplus citizens become entertainers.
  while (city.worked.length + city.specialists.length < city.size) city.specialists.push("entertainer");
}

export interface CityReport {
  food: number;
  shields: number;
  trade: number;
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
  foodBox: number;
  productionCost: number;
}

export function foodBox(city: City): number {
  return (city.size + 1) * 10;
}

export function productionCost(p: Production): number {
  return p.kind === "unit" ? unitType(p.id).cost : p.kind === "wonder" ? wonder(p.id).cost : building(p.id).cost;
}

export function productionName(p: Production): string {
  return p.kind === "unit" ? unitType(p.id).name : p.kind === "wonder" ? wonder(p.id).name : building(p.id).name;
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

export function distanceToCapital(state: GameState, city: City): number {
  const capital = state.cities.find((c) => c.owner === city.owner && c.buildings.includes("palace"));
  if (!capital) return 16;
  const dx = Math.min(Math.abs(capital.x - city.x), state.map.width - Math.abs(capital.x - city.x));
  const dy = Math.abs(capital.y - city.y);
  return Math.max(dx, dy);
}

/** Base content citizens by difficulty, shrinking as the empire grows (the original's "unhappiness from size"). */
export function contentBase(state: GameState, owner: number): number {
  const p = state.players[owner]!;
  const base = [6, 5, 4, 3, 2][p.difficulty] ?? 4;
  const cities = state.cities.filter((c) => c.owner === owner).length;
  const empirePenalty = Math.floor(Math.max(0, cities - 8) / 4);
  return Math.max(0, base - empirePenalty);
}

/** Everything the city screen shows and the turn pass needs, computed from state. */
export function computeCity(state: GameState, city: City): CityReport {
  const player = state.players[city.owner]!;
  const gov = government(player.government);
  const centre = getTile(state.map, city.x, city.y)!;
  let food = 0;
  let shields = 0;
  let trade = 0;
  const c = tileYield(state, centre, true, player.government);
  food += c.food;
  shields += c.shields;
  trade += c.trade;
  for (const slot of city.worked) {
    const t = radiusTile(state, city, slot);
    if (!t) continue;
    const y = tileYield(state, t, false, player.government);
    food += y.food;
    shields += y.shields;
    trade += y.trade;
  }

  const has = (id: string) => city.buildings.includes(id);
  let shieldPct = 0;
  let taxPct = 0;
  let luxPct = 0;
  let sciPct = 0;
  let contentFromBuildings = 0;
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
  let shieldPerTile = false;
  let oceanTrade = 0;
  for (const { rule, city: wc } of wonders) {
    const e = rule.effect;
    switch (e.kind) {
      case "contentAll": contentFromWonders += e.amount; break;
      case "contentCity": if (wc.id === city.id) contentFromWonders += e.amount; break;
      case "contentContinent": {
        const here = getTile(state.map, city.x, city.y)!.continent;
        if (getTile(state.map, wc.x, wc.y)!.continent === here) contentFromWonders += e.amount;
        break;
      }
      case "noUnhappyCity": if (wc.id === city.id) noUnhappy = true; break;
      case "sciencePct": if (wc.id === city.id) sciPct += e.amount; break;
      case "shieldPerWorkedTile": shieldPerTile = true; break;
      case "oceanTrade": if (wc.id === city.id) oceanTrade += e.amount; break;
      case "templeDouble": if (has("temple")) contentFromBuildings += building("temple").content ?? 0; break;
      case "cathedralEverywhere": if (!has("cathedral")) contentFromBuildings += building("cathedral").content ?? 0; break;
      case "freeUpkeepCheap":
        for (const id of city.buildings) if (building(id).upkeep === 1) buildingUpkeep -= 1;
        break;
      case "factoryBonus": if (has("factory")) shieldPct += e.amount; break;
      default: break;
    }
  }
  if (shieldPerTile) {
    for (const slot of city.worked) {
      const t = radiusTile(state, city, slot);
      if (t && tileYield(state, t, false, player.government).shields > 0) shields += 1;
    }
    shields += 1; // centre always yields a shield
  }
  if (oceanTrade) {
    for (const slot of city.worked) {
      const t = radiusTile(state, city, slot);
      if (t?.terrain === Terrain.Ocean) trade += oceanTrade;
    }
  }

  // Corruption: trade lost to distance from the palace.
  let corruptionPct = Math.min(90, gov.corruptionPerDistance * distanceToCapital(state, city) * 2);
  if (has("courthouse")) corruptionPct = Math.floor(corruptionPct / 2);
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

  // Happiness. Citizens start content up to the base, the rest unhappy.
  const workers = city.size - city.specialists.length;
  const base = contentBase(state, city.owner);
  let content = Math.min(workers, base);
  let unhappy = workers - content;
  let happy = 0;
  // Luxuries: two per step, content -> happy first, then unhappy -> content.
  let luxLeft = Math.floor(lux / 2);
  while (luxLeft > 0 && content > 0) { content--; happy++; luxLeft--; }
  while (luxLeft > 0 && unhappy > 0) { unhappy--; content++; luxLeft--; }
  // Buildings and wonders make unhappy citizens content.
  let fix = contentFromBuildings + contentFromWonders;
  while (fix > 0 && unhappy > 0) { unhappy--; content++; fix--; }
  // Martial law.
  if (gov.martialLaw) {
    let police = Math.min(3, state.units.filter((u) => u.x === city.x && u.y === city.y && unitType(u.type).attack > 0 && u.owner === city.owner).length);
    while (police > 0 && unhappy > 0) { unhappy--; content++; police--; }
  }
  // War weariness: military units outside cities under Republic/Democracy.
  if (gov.warWeariness > 0) {
    const abroad = state.units.filter(
      (u) => u.homeCity === city.id && unitType(u.type).attack > 0 && !cityAt(state, u.x, u.y),
    ).length;
    let weary = abroad * gov.warWeariness;
    while (weary > 0 && content > 0) { content--; unhappy++; weary--; }
  }
  if (noUnhappy) { content += unhappy; unhappy = 0; }
  const disorder = unhappy > happy;

  // Unit upkeep.
  const supported = state.units.filter((u) => u.homeCity === city.id);
  let unitShields = 0;
  let unitFood = 0;
  let free = gov.freeUnits;
  for (const u of supported) {
    if (unitType(u.type).flags?.includes("settler")) unitFood += gov.settlerFood;
    if (free > 0) free--;
    else unitShields += gov.unitUpkeep;
  }

  shields = Math.floor((shields * (100 + shieldPct)) / 100);
  const foodEaten = workers * 2 + city.specialists.length * 2 + unitFood;

  return {
    food, shields, trade,
    foodSurplus: food - foodEaten,
    shieldSurplus: disorder ? 0 : shields - unitShields,
    unitShields, unitFood, corruption,
    tax: disorder ? 0 : tax,
    lux,
    science: disorder ? 0 : science,
    buildingUpkeep,
    happy, content, unhappy, disorder,
    foodBox: foodBox(city),
    productionCost: productionCost(city.production),
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

export function foundCity(state: GameState, owner: number, x: number, y: number, name?: string): City {
  const used = new Set(state.cities.map((c) => c.name));
  const first = !state.cities.some((c) => c.owner === owner);
  const civNames = civ(state.players[owner]!.civ).cities;
  const fromCiv = civNames.find((n) => !used.has(n));
  const city: City = {
    id: state.nextCityId++,
    name: name ?? fromCiv ?? nextCityName(used),
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
    disorder: false,
  };
  state.cities.push(city);
  // Founding the city builds its road.
  getTile(state.map, city.x, city.y)!.road = true;
  autoAssignWorkers(state, city);
  revealAround(state, owner, city.x, city.y, 2);
  return city;
}

/** Gold to complete current production, the original's escalating price. */
export function buyCost(city: City): number {
  const cost = productionCost(city.production);
  const remaining = Math.max(0, cost - city.shields);
  if (remaining === 0) return 0;
  const base = city.production.kind === "unit" ? 2 * remaining + (remaining * remaining) / 20 : 2 * remaining;
  return Math.ceil(city.shields === 0 ? base * 2 : base);
}

export interface CityTurnEvent {
  city: number;
  kind: "grew" | "shrank" | "built" | "wonder" | "disorder" | "starving" | "famine";
  detail?: string;
}

/** End-of-turn pass for one city. Returns events for the UI. */
export function processCityTurn(state: GameState, city: City): CityTurnEvent[] {
  const events: CityTurnEvent[] = [];
  const player = state.players[city.owner]!;
  const r = computeCity(state, city);

  city.disorder = r.disorder;
  if (r.disorder) events.push({ city: city.id, kind: "disorder" });

  // Treasury: tax in, building upkeep out. Selling buildings on bankruptcy comes with the AI phase.
  player.gold += r.tax - r.buildingUpkeep;
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
  } else if (city.food >= r.foodBox) {
    const cap = city.buildings.includes("aqueduct") ? 99 : 10;
    if (city.size < cap) {
      city.size++;
      city.food = city.buildings.includes("granary") ? Math.floor(r.foodBox / 2) : 0;
      events.push({ city: city.id, kind: "grew" });
      autoAssignWorkers(state, city);
    } else {
      city.food = r.foodBox;
    }
  } else if (r.foodSurplus < 0) {
    events.push({ city: city.id, kind: "starving" });
  }

  // Shields.
  city.shields += r.shieldSurplus;
  if (city.shields < 0) {
    // Can't support units: disband the newest supported unit.
    const victim = state.units.filter((u) => u.homeCity === city.id).pop();
    if (victim) state.units = state.units.filter((u) => u.id !== victim.id);
    city.shields = 0;
  }
  const cost = productionCost(city.production);
  if (city.shields >= cost) {
    const p = city.production;
    if (p.kind === "unit") {
      const u = createUnit(state, p.id, city.owner, city.x, city.y, city.id);
      if (city.buildings.includes("barracks") && unitType(p.id).domain === "land") u.veteran = true;
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
      events.push({ city: city.id, kind: "built", detail: unitType(p.id).name });
    } else if (p.kind === "wonder") {
      if (wonderBuilt(state, p.id)) {
        // Someone else finished it first: the shields stay for the next choice.
        city.production = { kind: "unit", id: "militia" };
        return events;
      }
      city.wonders.push(p.id);
      city.shields -= cost;
      events.push({ city: city.id, kind: "wonder", detail: wonder(p.id).name });
      city.production = { kind: "unit", id: "militia" };
    } else {
      if (!city.buildings.includes(p.id)) city.buildings.push(p.id);
      city.shields -= cost;
      events.push({ city: city.id, kind: "built", detail: building(p.id).name });
      // Move on to something sensible rather than rebuilding.
      city.production = { kind: "unit", id: "militia" };
    }
  }
  return events;
}

/** What a city may build right now, gated by the owner's advances. */
export function buildOptions(state: GameState, city: City): Production[] {
  const p = state.players[city.owner]!;
  const out: Production[] = [];
  for (const t of UNIT_TYPES) {
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
  return out;
}

export function coastal(state: GameState, city: City): boolean {
  for (const [dx, dy] of NEIGHBOURS)
    if (getTile(state.map, city.x + dx, city.y + dy)?.terrain === Terrain.Ocean) return true;
  return false;
}
