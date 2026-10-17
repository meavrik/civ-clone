import { nextInt } from "./rng.js";
import { BARBARIANS } from "./rules/barbarians.js";
import { TERRAIN_RULES } from "./rules/terrain.js";
import { UNIT_TYPES, unitType, type BarbarianRole } from "./rules/units.js";
import { mapDistance, NEIGHBOURS, Terrain, wrapX, type City, type GameState } from "./types.js";
import { canEnter, createUnit } from "./units.js";

/** The Barbarian Leader's unit type: the one unit flagged `leader`. */
export const LEADER = UNIT_TYPES.find((t) => t.flags?.includes("leader"))!.id;

/** Where a band appeared and whom it is after. */
export interface BarbarianLanding {
  x: number;
  y: number;
  /** Came by sea (raiders in a boat) rather than rising on land. */
  sea: boolean;
  /** The nearest city when it appeared, and its owner. */
  city: number;
  victim: number;
}

/** Barbarian bands that appear as a round begins (none before the onset). */
export function maybeSpawnBarbarians(state: GameState): BarbarianLanding[] {
  if (state.simpleBarbarians) {
    const landing = simpleRaid(state);
    return landing ? [landing] : [];
  }
  if (state.turn < BARBARIANS.onset) return [];
  const out: BarbarianLanding[] = [];
  const tries = Math.max(1, Math.floor((state.map.width * state.map.height) / BARBARIANS.squaresPerTry)) * (BARBARIANS.rate - 1);
  for (let i = 0; i < tries; i++) {
    const landing = trySummon(state);
    if (landing) out.push(landing);
  }
  return out;
}

/**
 * One summons on a random square (so each square's chance is its own):
 * it needs the nearest city 5 to 8 squares off, a free square there or
 * next to it, land the victim has explored (on the city's continent) or sea
 * within four squares of land, and a roll the victim fails more often the
 * more cities it has.
 */
function trySummon(state: GameState): BarbarianLanding | null {
  const { map, rng } = state;
  const x0 = nextInt(rng, map.width);
  const y0 = nextInt(rng, map.height);
  if (TERRAIN_RULES[map.tiles[y0 * map.width + x0]!.terrain].noBarbarians) return null;
  const city = nearestCity(state, x0, y0);
  if (!city) return null;
  const d = mapDistance(map, x0, y0, city.x, city.y);
  if (d < BARBARIANS.minDistance || d > BARBARIANS.maxDistance) return null;
  const spot = freeSquareNear(state, x0, y0);
  if (!spot) return null;
  const [x, y] = spot;
  const tile = map.tiles[y * map.width + x]!;
  const sea = tile.terrain === Terrain.Ocean;
  const victim = state.players[city.owner]!;
  if (!sea && !victim.explored[y * map.width + x]) return null;
  // (Ours: an uprising only where it can walk to the city it rises against.)
  if (!sea && tile.continent !== map.tiles[city.y * map.width + city.x]!.continent) return null;
  if (sea && !nearLand(state, x, y)) return null;
  // Small empires are left alone: in practice, no uprisings early on.
  const owned = state.cities.filter((c) => c.owner === victim.id).length;
  if (nextInt(rng, 30) + 1 > owned * (BARBARIANS.rate - 1)) return null;

  let step = 1;
  for (let max: number = BARBARIANS.civSize; max <= owned; max += max * 1.2 + BARBARIANS.civSize) step++;
  const count = nextInt(rng, 3) + step * BARBARIANS.rate;
  const owner = state.barbarians;
  tile.hut = false;
  if (!sea) {
    // A unit that cannot stand on this ground (wheels on rough land) is just not raised.
    for (let i = 0; i < count; i++) {
      const type = barbarianUnit(state, "land");
      if (type && canEnter(state, unitType(type), tile)) createUnit(state, type, owner, x, y);
    }
    createUnit(state, LEADER, owner, x, y);
  } else {
    const boatType = barbarianUnit(state, "boat");
    if (!boatType) return null;
    const boat = createUnit(state, boatType, owner, x, y);
    const room = unitType(boatType).capacity ?? 0;
    // The boat is filled with raiders, leaving room for their leader.
    for (let i = 0; i < room - 1 && i < count; i++) {
      const type = barbarianUnit(state, "sea");
      if (type) createUnit(state, type, owner, x, y).aboard = boat.id;
    }
    createUnit(state, LEADER, owner, x, y).aboard = boat.id;
  }
  return { x, y, sea, city: city.id, victim: victim.id };
}

/**
 * A unit type barbarians field in `role`, picked at random among those
 * open to them: always the ones without `needsTech`, the others once some
 * civilization knows the advance the unit requires.
 */
export function barbarianUnit(state: GameState, role: BarbarianRole): string | null {
  const open = barbarianUnits(state, role);
  return open.length ? open[nextInt(state.rng, open.length)]! : null;
}

/** Every unit type barbarians may field in `role` now. */
export function barbarianUnits(state: GameState, role: BarbarianRole): string[] {
  return UNIT_TYPES.filter((t) => {
    if (!t.barbarian?.as.includes(role)) return false;
    if (!t.barbarian.needsTech || !t.requires) return true;
    return state.players.some((p) => p.id !== state.barbarians && p.advances.includes(t.requires!));
  }).map((t) => t.id);
}

function nearestCity(state: GameState, x: number, y: number): City | null {
  let best: City | null = null;
  let bestD = Infinity;
  for (const c of state.cities) {
    if (c.owner === state.barbarians) continue;
    const d = mapDistance(state.map, x, y, c.x, c.y);
    if (d < bestD) { bestD = d; best = c; }
  }
  return best;
}

/** This square or a neighbour holding no unit and no city, scanning row by row. */
function freeSquareNear(state: GameState, x: number, y: number): [number, number] | null {
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      const ny = y + dy;
      if (ny < 0 || ny >= state.map.height) continue;
      const nx = wrapX(state.map, x + dx);
      if (state.units.some((u) => u.x === nx && u.y === ny) || state.cities.some((c) => c.x === nx && c.y === ny)) continue;
      return [nx, ny];
    }
  return null;
}

/** Land within four squares, so a boat starting here can reach a shore. */
function nearLand(state: GameState, x: number, y: number): boolean {
  for (let dy = -4; dy <= 4; dy++)
    for (let dx = -4; dx <= 4; dx++) {
      const ny = y + dy;
      if (ny < 0 || ny >= state.map.height) continue;
      if (state.map.tiles[ny * state.map.width + wrapX(state.map, x + dx)]!.terrain !== Terrain.Ocean) return true;
    }
  return false;
}

/**
 * Our first barbarians (games saved before leaders and boats, `simpleBarbarians`):
 * from 1000 BC on, every so often a raiding party appears on a coastal tile
 * near a random city. The party grows with the era (legions, then knights,
 * then musketeers). Rolls exactly as it always did, so old saves replay.
 */
function simpleRaid(state: GameState): BarbarianLanding | null {
  if (state.turn < 150) return null; // ~1000 BC
  if (nextInt(state.rng, 100) >= 6) return null;
  const targets = state.cities.filter((c) => c.owner !== state.barbarians);
  if (targets.length === 0) return null;
  const city = targets[nextInt(state.rng, targets.length)]!;
  // Find a land tile 3..5 away that touches the sea.
  for (let tries = 0; tries < 40; tries++) {
    const dx = nextInt(state.rng, 11) - 5;
    const dy = nextInt(state.rng, 11) - 5;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 3) continue;
    const x = wrapX(state.map, city.x + dx);
    const y = city.y + dy;
    if (y < 1 || y >= state.map.height - 1) continue;
    const t = state.map.tiles[y * state.map.width + x]!;
    if (t.terrain === Terrain.Ocean || t.terrain === Terrain.Arctic) continue;
    const coastal = NEIGHBOURS.some(([ex, ey]) => {
      const ny = y + ey;
      return ny >= 0 && ny < state.map.height && state.map.tiles[ny * state.map.width + wrapX(state.map, x + ex)]!.terrain === Terrain.Ocean;
    });
    if (!coastal) continue;
    if (state.units.some((u) => u.x === x && u.y === y) || state.cities.some((c) => c.x === x && c.y === y)) continue;
    const era = state.turn < 250 ? 0 : state.turn < 350 ? 1 : 2;
    const types = [["legion", "legion", "militia"], ["knights", "legion", "catapult"], ["musketeers", "cannon", "knights"]][era]!;
    const count = 2 + nextInt(state.rng, 2);
    for (let i = 0; i < count; i++) createUnit(state, types[i % types.length]!, state.barbarians, x, y);
    return { x, y, sea: true, city: city.id, victim: city.owner };
  }
  return null;
}
