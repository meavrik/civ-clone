import { autoAssignWorkers, canFoundCity, foundCity } from "./cities.js";
import { goldScale } from "./diplomacy.js";
import { nextInt } from "./rng.js";
import { CITY_STATE, CITY_STATES, CITY_STATE_BY_ID, type CityStateRule } from "./rules/city-states.js";
import { UNIT_TYPES } from "./rules/units.js";
import { siteScore } from "./sites.js";
import { mapDistance, Terrain, type City, type CityStateDemand, type GameState, type Unit } from "./types.js";
import { createUnit } from "./units.js";

/**
 * City-states (rules/city-states.ts): single cities of peoples of history, placed as a new game begins, held by the
 * barbarians' seat, so always at war with every civilization, never met, never talked to. They raise only soldiers
 * and now and then send a few against the nearest civilization's city (the AI's `barbarian.ts`), first demanding
 * tribute of its owner (`cityStateDemand`); paid, that city-state leaves the payer be for `CITY_STATE.peaceTurns`
 * (`cityStatePeace`), until the payer strikes it. Otherwise they are conquered like any city, and stop being
 * city-states. Games placed them since save version 45, when started with `NewGameOptions.cityStates`.
 */

/** The city-state a city is, or undefined for any other city. */
export function cityStateOf(city: City | undefined): CityStateRule | undefined {
  return city?.cityState !== undefined ? CITY_STATE_BY_ID[city.cityState] : undefined;
}

/** The city-state city a unit serves (its home city, while that is a city-state), or undefined. */
export function unitCityState(state: GameState, u: Pick<Unit, "homeCity">): City | undefined {
  if (u.homeCity === null) return undefined;
  const home = state.cities.find((c) => c.id === u.homeCity);
  return home?.cityState !== undefined ? home : undefined;
}

/** How many city-states a new game places: `CITY_STATE.perGame` on the original's world, more on wider ones. */
export function cityStateCount(state: GameState): number {
  return Math.round((CITY_STATE.perGame * state.map.width) / 80);
}

/**
 * The units a city-state raises: land soldiers whose advance at least half the living civilizations know (or none
 * is needed), so it keeps a step behind the world; it needs no strategic resource, as the barbarians need none.
 */
export function cityStateUnits(state: GameState): string[] {
  const civs = state.players.filter((p) => p.alive && p.id !== state.barbarians);
  return UNIT_TYPES.filter((t) => {
    if (t.domain !== "land" || t.attack <= 0 || t.flags?.length) return false;
    if (!t.requires) return true;
    return civs.filter((p) => p.advances.includes(t.requires!)).length * 2 >= civs.length;
  }).map((t) => t.id);
}

/** The city-state's best unit for `role`: the stoutest defender or the hardest hitter, the cheaper on a tie. */
export function cityStateUnit(state: GameState, role: "defense" | "attack"): string {
  let best: (typeof UNIT_TYPES)[number] | undefined;
  for (const id of cityStateUnits(state)) {
    const t = UNIT_TYPES.find((u) => u.id === id)!;
    if (!best || t[role] > best[role] || (t[role] === best[role] && t.cost < best.cost)) best = t;
  }
  return best?.id ?? "militia";
}

/**
 * Place the city-states as a new game begins (`starts`: each civilization's starting square): first one near each
 * civilization alone on its land (`nearMin`..`nearMax` squares from its start, widened to `nearLimit`; the best city
 * site), so no civilization has its land to itself; then, up to `cityStateCount`, others drawn at random among good
 * sites `farMin`..`farMax` from the nearest start. Each takes a people drawn at random, its size and a garrison.
 */
export function placeCityStates(state: GameState, starts: readonly [number, number][]): void {
  const { map, rng } = state;
  const owner = state.barbarians;
  const pool = [...CITY_STATES];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = nextInt(rng, i + 1);
    [pool[i], pool[j]] = [pool[j]!, pool[i]!];
  }
  const placed: [number, number][] = [];
  const fit = (x: number, y: number): boolean => {
    const t = map.tiles[y * map.width + x]!;
    if (t.terrain === Terrain.Ocean || t.hut || siteScore(state, x, y) === null || canFoundCity(state, x, y) !== null) return false;
    if (state.units.some((u) => u.x === x && u.y === y)) return false;
    return placed.every(([px, py]) => mapDistance(map, px, py, x, y) >= CITY_STATE.apart);
  };
  const place = (x: number, y: number): boolean => {
    const rule = pool[placed.length];
    if (!rule) return false;
    placed.push([x, y]);
    found(state, owner, x, y, rule);
    return true;
  };
  const nearest = (x: number, y: number) => Math.min(...starts.map(([sx, sy]) => mapDistance(map, sx, sy, x, y)));

  // A civilization alone on its land: a city-state on it, near enough to meet.
  const continentOf = (x: number, y: number) => map.tiles[y * map.width + x]!.continent;
  for (const [sx, sy] of starts) {
    const land = continentOf(sx, sy);
    if (starts.some(([ox, oy]) => (ox !== sx || oy !== sy) && continentOf(ox, oy) === land)) continue;
    if (placed.some(([px, py]) => continentOf(px, py) === land)) continue;
    for (const [lo, hi] of [[CITY_STATE.nearMin, CITY_STATE.nearMax], [4, CITY_STATE.nearLimit]] as const) {
      let best: [number, number] | null = null;
      let bestScore = -Infinity;
      for (let dy = -hi; dy <= hi; dy++)
        for (let dx = -hi; dx <= hi; dx++) {
          const y = sy + dy;
          if (y < 0 || y >= map.height) continue;
          const x = (((sx + dx) % map.width) + map.width) % map.width;
          const d = mapDistance(map, sx, sy, x, y);
          if (d < lo || d > hi || continentOf(x, y) !== land || nearest(x, y) < lo || !fit(x, y)) continue;
          const score = siteScore(state, x, y)!;
          if (score > bestScore) { bestScore = score; best = [x, y]; }
        }
      if (best) { place(best[0], best[1]); break; }
    }
  }

  // The rest at random among the better sites within reach of the civilizations.
  const want = Math.min(pool.length, Math.max(cityStateCount(state), placed.length));
  const sites: { x: number; y: number; score: number }[] = [];
  for (let y = 0; y < map.height; y++)
    for (let x = 0; x < map.width; x++) {
      const d = nearest(x, y);
      if (d < CITY_STATE.farMin || d > CITY_STATE.farMax) continue;
      const score = siteScore(state, x, y);
      if (score !== null && map.tiles[y * map.width + x]!.terrain !== Terrain.Ocean) sites.push({ x, y, score });
    }
  sites.sort((a, b) => b.score - a.score);
  const good = sites.slice(0, Math.max(1, Math.ceil(sites.length / 2)));
  for (let tries = 0; placed.length < want && tries < 400 && good.length; tries++) {
    const s = good[nextInt(rng, good.length)]!;
    if (fit(s.x, s.y)) place(s.x, s.y);
  }
}

/** Found city-state `rule` at (x, y): its size, no palace, a garrison fortified, raising soldiers. */
function found(state: GameState, owner: number, x: number, y: number, rule: CityStateRule): City {
  const city = foundCity(state, owner, x, y, rule.name);
  city.buildings = city.buildings.filter((b) => b !== "palace");
  city.cityState = rule.id;
  city.size = CITY_STATE.size;
  autoAssignWorkers(state, city);
  const guard = cityStateUnit(state, "defense");
  city.production = { kind: "unit", id: guard };
  for (let i = 0; i < CITY_STATE.garrison; i++) createUnit(state, guard, owner, x, y, city.id).order = { kind: "fortified" };
  return city;
}

// ---- tribute ------------------------------------------------------------------------------

/** What a city-state asks of `player` for its peace: a share of what gold is worth to `player`, in tens. */
export function tributePrice(state: GameState, player: number): number {
  return Math.max(CITY_STATE.minPrice, Math.round((goldScale(state, player) * CITY_STATE.price) / 10) * 10);
}

const peaceKey = (city: number, player: number) => `${city}:${player}`;

/** The last turn city-state `city` leaves `player` be, for tribute paid; undefined without a peace. */
export function peaceUntil(state: GameState, city: number, player: number): number | undefined {
  const until = state.cityStatePeace?.[peaceKey(city, player)];
  return until !== undefined && until >= state.turn ? until : undefined;
}

/** Whether `u`, a city-state's unit, may not strike `player`'s units or cities: its city-state has their tribute. */
export function boughtOff(state: GameState, u: Pick<Unit, "homeCity">, player: number): boolean {
  const home = unitCityState(state, u);
  return home !== undefined && peaceUntil(state, home.id, player) !== undefined;
}

/** `player` struck city-state `city`: the peace it paid for is over. */
export function breakPeace(state: GameState, city: number, player: number): void {
  if (state.cityStatePeace) delete state.cityStatePeace[peaceKey(city, player)];
}

/** The demand city-state `city` has standing on `player`, if any. */
export function demandOn(state: GameState, city: number, player: number): CityStateDemand | undefined {
  return state.cityStateDemands?.find((d) => d.city === city && d.player === player);
}

/** Why city-state `city` may not demand tribute of `player` now, or null when it may. */
export function whyNoDemand(state: GameState, city: City | undefined, player: number): string | null {
  if (!city || city.cityState === undefined || city.owner !== state.barbarians) return "not a city-state";
  const p = state.players[player];
  if (!p || !p.alive || player === state.barbarians) return "no one to ask";
  if (peaceUntil(state, city.id, player) !== undefined) return "paid already";
  if (demandOn(state, city.id, player)) return "already asked";
  if (p.gold < tributePrice(state, player)) return "they cannot pay";
  return null;
}

/** Pay a standing demand: the gold goes, and the city-state leaves the payer be for `CITY_STATE.peaceTurns`. */
export function payTribute(state: GameState, d: CityStateDemand): number {
  state.players[d.player]!.gold -= d.gold;
  const until = state.turn + CITY_STATE.peaceTurns;
  (state.cityStatePeace ??= {})[peaceKey(d.city, d.player)] = until;
  dropDemand(state, d);
  return until;
}

export function dropDemand(state: GameState, d: CityStateDemand): void {
  state.cityStateDemands = (state.cityStateDemands ?? []).filter((x) => x !== d);
  if (!state.cityStateDemands.length) delete state.cityStateDemands;
}

/** As the city-states' turn comes round: demands not answered lapse, and peace that has run out is dropped. */
export function settleCityStates(state: GameState): void {
  if (state.cityStateDemands) {
    state.cityStateDemands = state.cityStateDemands.filter((d) => d.turn >= state.turn && state.cities.some((c) => c.id === d.city && c.cityState !== undefined));
    if (!state.cityStateDemands.length) delete state.cityStateDemands;
  }
  if (state.cityStatePeace) {
    for (const [k, until] of Object.entries(state.cityStatePeace)) if (until < state.turn) delete state.cityStatePeace[k];
    if (!Object.keys(state.cityStatePeace).length) delete state.cityStatePeace;
  }
}

/** A city-state taken (or razed): it is a city-state no more, and its demands and peace go with it. */
export function endCityState(state: GameState, city: City): void {
  delete city.cityState;
  if (state.cityStateDemands) {
    state.cityStateDemands = state.cityStateDemands.filter((d) => d.city !== city.id);
    if (!state.cityStateDemands.length) delete state.cityStateDemands;
  }
  if (state.cityStatePeace) {
    for (const k of Object.keys(state.cityStatePeace)) if (k.startsWith(`${city.id}:`)) delete state.cityStatePeace[k];
    if (!Object.keys(state.cityStatePeace).length) delete state.cityStatePeace;
  }
}
