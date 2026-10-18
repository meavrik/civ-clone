import type { RngState } from "./rng.js";
import type { SpacePart, Spaceship } from "./rules/spaceship.js";

/** Original world size: 80 columns wrapping east-west, 50 rows. */
export const MAP_WIDTH = 80;
export const MAP_HEIGHT = 50;

export enum Terrain {
  Ocean = 0,
  Grassland,
  Plains,
  Forest,
  Hills,
  Mountains,
  Desert,
  Tundra,
  Arctic,
  Swamp,
  Jungle,
}

export const TERRAIN_NAMES: Record<Terrain, string> = {
  [Terrain.Ocean]: "Ocean",
  [Terrain.Grassland]: "Grassland",
  [Terrain.Plains]: "Plains",
  [Terrain.Forest]: "Forest",
  [Terrain.Hills]: "Hills",
  [Terrain.Mountains]: "Mountains",
  [Terrain.Desert]: "Desert",
  [Terrain.Tundra]: "Tundra",
  [Terrain.Arctic]: "Arctic",
  [Terrain.Swamp]: "Swamp",
  [Terrain.Jungle]: "Jungle",
};

export interface Tile {
  terrain: Terrain;
  river: boolean;
  special: boolean;
  road: boolean;
  irrigation: boolean;
  mine: boolean;
  /** Minor tribe village; removed when entered. */
  hut: boolean;
  /** Rails on top of a road: free movement along them, more shields. */
  railroad: boolean;
  /** Settler-built fortification: doubles defence, no stack losses. */
  fortress: boolean;
  /** Industrial pollution: halves the tile's output until cleaned. */
  pollution: boolean;
  /** Id of the continent (land) or ocean body this tile belongs to; 0 = unassigned. */
  continent: number;
}

export interface WorldMap {
  width: number;
  height: number;
  /** Row-major, length width*height. */
  tiles: Tile[];
}

/** Settler jobs on a tile. */
export type WorkKind = "irrigate" | "mine" | "road" | "railroad" | "fortress" | "clean";

export type UnitOrder =
  | { kind: "none" }
  | { kind: "fortified" }
  | { kind: "fortifying" }
  | { kind: "sentry" }
  | { kind: "goto"; x: number; y: number }
  | { kind: "work"; work: WorkKind; turnsLeft: number };

export interface Unit {
  id: number;
  type: string;
  owner: number;
  x: number;
  y: number;
  /** Movement points left this turn, in thirds. */
  movesLeft: number;
  veteran: boolean;
  /** Hit points left; a unit that loses them all in a fight is destroyed. */
  hp: number;
  order: UnitOrder;
  /** City paying this unit's upkeep; null for starting units. */
  homeCity: number | null;
  /** Id of the ship carrying this unit, if aboard. */
  aboard: number | null;
}

export type Relation = "none" | "peace" | "war";

export type Specialist = "entertainer" | "taxman" | "scientist";

export type Production =
  | { kind: "unit"; id: string }
  | { kind: "building"; id: string }
  | { kind: "wonder"; id: string }
  | { kind: "spaceship"; id: SpacePart };

export interface City {
  id: number;
  name: string;
  owner: number;
  x: number;
  y: number;
  size: number;
  food: number;
  shields: number;
  /** Indices 0..20 into CITY_RADIUS (excluding the centre, which is always worked). */
  worked: number[];
  specialists: Specialist[];
  buildings: string[];
  wonders: string[];
  production: Production;
  founded: number;
  /** True once a disorder turn has been reported, for the renderer. */
  disorder: boolean;
  /** Ids of cities this one trades with (caravan routes, mutual, at most three). */
  routes: number[];
}

export interface Player {
  id: number;
  civ: string;
  name: string;
  isAi: boolean;
  alive: boolean;
  /** Colour slot (index into CIV_COLORS), fixed by the civilization. */
  color: number;
  explored: Uint8Array;
  /** Tiles currently seen by a unit/city; recomputed when units move. */
  visible: Uint8Array;
  gold: number;
  /** Rates in tenths; they sum to 10. */
  taxRate: number;
  luxRate: number;
  sciRate: number;
  government: string;
  /** Accumulated research beakers toward `researching`. */
  science: number;
  advances: string[];
  researching: string | null;
  /** Turns of anarchy left before `pendingGovernment` takes over. */
  anarchyTurns: number;
  pendingGovernment: string | null;
  /** Chieftain 0 .. Emperor 4. */
  difficulty: number;
  spaceship: Spaceship;
}

export interface GameState {
  seed: number;
  rng: RngState;
  turn: number;
  map: WorldMap;
  players: Player[];
  units: Unit[];
  cities: City[];
  nextUnitId: number;
  nextCityId: number;
  /** Relation between players a<b, keyed "a:b". Missing = no contact. */
  relations: Record<string, Relation>;
  /** The barbarian player's id. */
  barbarians: number;
  /** Whose turn it is. */
  currentPlayer: number;
  /** Id of the unit awaiting orders, or null when the turn can end. */
  activeUnit: number | null;
  /** Pollution pressure accumulated toward the next bout of global warming. */
  warming: number;
  /** The 1991 rules: every fight is one roll (no lasting damage). Set for old saves. */
  classicCombat?: boolean;
  /** The 1991 terrain: every land unit enters every land square and no ground wears units down. Set for old saves. */
  classicTerrain?: boolean;
  /** Mountains take every land unit (wheels still need a road there). Set for saves before version 7. */
  openMountains?: boolean;
  /** Our first barbarians: parties that step ashore near any city and raze what they take, no leader. Set for old saves. */
  simpleBarbarians?: boolean;
  /** Our first landings: a soldier stepping off a ship minds zones of control as on land. Set for old saves. */
  zocAtSea?: boolean;
  /** The 1991 civilizations: all alike, no traits or starting advances. Set for old saves. */
  classicCivs?: boolean;
  /** Our first unit upkeep: 3 free units a city under Monarchy and Communism too, debts paid from the shield box. Set for saves before version 8. */
  looseUpkeep?: boolean;
}

export function wrapX(map: WorldMap, x: number): number {
  return ((x % map.width) + map.width) % map.width;
}

/** Squares between two points: the longer axis, east-west the short way round the wrap. */
export function mapDistance(map: WorldMap, ax: number, ay: number, bx: number, by: number): number {
  const dx = Math.abs(wrapX(map, ax) - wrapX(map, bx));
  return Math.max(Math.min(dx, map.width - dx), Math.abs(ay - by));
}

export function tileIndex(map: WorldMap, x: number, y: number): number {
  return y * map.width + wrapX(map, x);
}

export function getTile(map: WorldMap, x: number, y: number): Tile | undefined {
  if (y < 0 || y >= map.height) return undefined;
  return map.tiles[tileIndex(map, x, y)];
}

/** Eight neighbours, as (dx, dy). Order matches the keypad: 7 8 9 / 4 6 / 1 2 3. */
export const NEIGHBOURS: ReadonlyArray<readonly [number, number]> = [
  [-1, -1], [0, -1], [1, -1],
  [-1, 0], [1, 0],
  [-1, 1], [0, 1], [1, 1],
];

/**
 * The 21-tile city radius as offsets from the centre, in the original's
 * reading order (the "fat cross": 5x5 minus corners). Index 0 is the centre.
 */
export const CITY_RADIUS: ReadonlyArray<readonly [number, number]> = [
  [0, 0],
  [-1, -2], [0, -2], [1, -2],
  [-2, -1], [-1, -1], [0, -1], [1, -1], [2, -1],
  [-2, 0], [-1, 0], [1, 0], [2, 0],
  [-2, 1], [-1, 1], [0, 1], [1, 1], [2, 1],
  [-1, 2], [0, 2], [1, 2],
];
