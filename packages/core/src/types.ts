import type { RngState } from "./rng.js";

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
  /** Id of the continent (land) or ocean body this tile belongs to; 0 = unassigned. */
  continent: number;
}

export interface WorldMap {
  width: number;
  height: number;
  /** Row-major, length width*height. */
  tiles: Tile[];
}

export type UnitOrder =
  | { kind: "none" }
  | { kind: "fortified" }
  | { kind: "fortifying" }
  | { kind: "sentry" }
  | { kind: "work"; work: "irrigate" | "mine" | "road"; turnsLeft: number };

export interface Unit {
  id: number;
  type: string;
  owner: number;
  x: number;
  y: number;
  /** Movement points left this turn, in thirds. */
  movesLeft: number;
  veteran: boolean;
  order: UnitOrder;
  /** City paying this unit's upkeep; null for starting units. */
  homeCity: number | null;
}

export type Specialist = "entertainer" | "taxman" | "scientist";

export type Production = { kind: "unit"; id: string } | { kind: "building"; id: string };

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
  production: Production;
  founded: number;
  /** True once a disorder turn has been reported, for the renderer. */
  disorder: boolean;
}

export interface Player {
  id: number;
  name: string;
  /** Civ colour slot for rendering. */
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
  /** Accumulated research beakers (spent by the tech tree in phase 4). */
  science: number;
  /** Chieftain 0 .. Emperor 4. */
  difficulty: number;
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
  /** Whose turn it is. */
  currentPlayer: number;
  /** Id of the unit awaiting orders, or null when the turn can end. */
  activeUnit: number | null;
}

export function wrapX(map: WorldMap, x: number): number {
  return ((x % map.width) + map.width) % map.width;
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
