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
}

export interface Player {
  id: number;
  name: string;
  /** Civ colour slot for rendering. */
  color: number;
  explored: Uint8Array;
  /** Tiles currently seen by a unit/city; recomputed when units move. */
  visible: Uint8Array;
}

export interface GameState {
  seed: number;
  rng: RngState;
  turn: number;
  map: WorldMap;
  players: Player[];
  units: Unit[];
  nextUnitId: number;
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
