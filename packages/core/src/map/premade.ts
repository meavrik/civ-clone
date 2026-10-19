import type { RngState } from "../rng.js";
import { Terrain, worldSize, type WorldMap, type WorldSize } from "../types.js";
import { blankTile, labelContinents, scatterSpecials } from "./generate.js";
import { EARTH } from "./worlds/earth.js";
import { EUROPE } from "./worlds/europe.js";
import { MIDDLE_EAST } from "./worlds/middle-east.js";

/**
 * A premade world: real geography rasterised onto the grid of each world size
 * by `tools/maps` from Natural Earth data (public domain). Terrain and rivers
 * are fixed; specials and villages are still scattered from the game's
 * seed. Every civilization with a homeland on the map has a start square.
 * Landmasses are kept apart: no land joins an island to its neighbour, not
 * even corner to corner (Britain is off France at every size).
 */
export interface PremadeWorld {
  id: string;
  name: string;
  /** The world drawn at each size (WORLD_SIZES), the same land on a finer grid. */
  sizes: Readonly<Record<WorldSize, PremadeGrid>>;
}

export interface PremadeGrid {
  /** One row per square of height, one character per square of width, from TERRAIN_CHARS; upper case marks a river. */
  rows: readonly string[];
  /** Historical homeland of each civilization that has one here, as a map square. */
  starts: Readonly<Record<string, readonly [number, number]>>;
  /**
   * The grid as saves before version 13 played it, before landmasses were kept apart
   * (`joinedIslands`): the squares (x, y, character) and homelands that differed then.
   */
  joinedIslands?: {
    squares: readonly (readonly [number, number, string])[];
    starts: Readonly<Record<string, readonly [number, number]>>;
  };
}

export const TERRAIN_CHARS: Readonly<Record<Terrain, string>> = {
  [Terrain.Ocean]: ".",
  [Terrain.Grassland]: "g",
  [Terrain.Plains]: "p",
  [Terrain.Forest]: "f",
  [Terrain.Hills]: "h",
  [Terrain.Mountains]: "m",
  [Terrain.Desert]: "d",
  [Terrain.Tundra]: "t",
  [Terrain.Arctic]: "a",
  [Terrain.Swamp]: "s",
  [Terrain.Jungle]: "j",
};

const CHAR_TERRAIN = new Map<string, Terrain>(Object.entries(TERRAIN_CHARS).map(([t, c]) => [c, Number(t) as Terrain]));

export const PREMADE_WORLDS: readonly PremadeWorld[] = [EARTH, EUROPE, MIDDLE_EAST];

export function premadeWorld(id: string): PremadeWorld {
  const world = PREMADE_WORLDS.find((w) => w.id === id);
  if (!world) throw new Error(`unknown world ${id}`);
  return world;
}

/** Each civilization's homeland square on the world at that size (as saves before version 13 drew it, with `joinedIslands`). */
export function premadeStarts(world: PremadeWorld, size: WorldSize = "small", joinedIslands = false): Readonly<Record<string, readonly [number, number]>> {
  const grid = world.sizes[size];
  return joinedIslands && grid.joinedIslands ? { ...grid.starts, ...grid.joinedIslands.starts } : grid.starts;
}

/** A square of a world's rows: its terrain, upper case marking a river. */
function decodeSquare(world: PremadeWorld, ch: string, x: number, y: number): ReturnType<typeof blankTile> {
  const terrain = CHAR_TERRAIN.get(ch.toLowerCase());
  if (terrain === undefined) throw new Error(`${world.id}: unknown terrain "${ch}" at ${x},${y}`);
  const tile = blankTile(terrain);
  tile.river = ch !== ch.toLowerCase();
  return tile;
}

/**
 * The world's terrain and rivers as drawn in its rows at that size, with nothing scattered yet;
 * with `joinedIslands`, as saves before version 13 drew it.
 */
export function decodeWorld(world: PremadeWorld, size: WorldSize = "small", joinedIslands = false): WorldMap {
  const { width, height } = worldSize(size);
  const { rows } = world.sizes[size];
  if (rows.length !== height) throw new Error(`${world.id} (${size}): ${rows.length} rows, expected ${height}`);
  const tiles = [];
  for (let y = 0; y < height; y++) {
    const row = rows[y]!;
    if (row.length !== width) throw new Error(`${world.id} (${size}): row ${y} has ${row.length} columns, expected ${width}`);
    for (let x = 0; x < width; x++) tiles.push(decodeSquare(world, row[x]!, x, y));
  }
  if (joinedIslands) for (const [x, y, ch] of world.sizes[size].joinedIslands?.squares ?? []) tiles[y * width + x] = decodeSquare(world, ch, x, y);
  return { width, height, tiles };
}

/** A premade world ready to play: its terrain plus specials and villages from the game's RNG. */
export function premadeMap(rng: RngState, id: string, size: WorldSize = "small", joinedIslands = false): WorldMap {
  const map = decodeWorld(premadeWorld(id), size, joinedIslands);
  scatterSpecials(map, rng);
  labelContinents(map);
  return map;
}
