import type { RngState } from "../rng.js";
import { MAP_HEIGHT, MAP_WIDTH, Terrain, type WorldMap } from "../types.js";
import { blankTile, labelContinents, scatterSpecials } from "./generate.js";
import { EARTH } from "./worlds/earth.js";
import { EUROPE } from "./worlds/europe.js";
import { MIDDLE_EAST } from "./worlds/middle-east.js";

/**
 * A premade world: real geography rasterised onto the 80x50 grid by
 * `tools/maps` from Natural Earth data (public domain). Terrain and rivers
 * are fixed; specials and villages are still scattered from the game's
 * seed. Every civilization with a homeland on the map has a start square.
 */
export interface PremadeWorld {
  id: string;
  name: string;
  /** MAP_HEIGHT rows of MAP_WIDTH characters from TERRAIN_CHARS; upper case marks a river. */
  rows: readonly string[];
  /** Historical homeland of each civilization that has one here, as a map square. */
  starts: Readonly<Record<string, readonly [number, number]>>;
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

/** The world's terrain and rivers as drawn in its rows, with nothing scattered yet. */
export function decodeWorld(world: PremadeWorld): WorldMap {
  if (world.rows.length !== MAP_HEIGHT) throw new Error(`${world.id}: ${world.rows.length} rows, expected ${MAP_HEIGHT}`);
  const tiles = [];
  for (let y = 0; y < MAP_HEIGHT; y++) {
    const row = world.rows[y]!;
    if (row.length !== MAP_WIDTH) throw new Error(`${world.id}: row ${y} has ${row.length} columns, expected ${MAP_WIDTH}`);
    for (let x = 0; x < MAP_WIDTH; x++) {
      const ch = row[x]!;
      const terrain = CHAR_TERRAIN.get(ch.toLowerCase());
      if (terrain === undefined) throw new Error(`${world.id}: unknown terrain "${ch}" at ${x},${y}`);
      const tile = blankTile(terrain);
      tile.river = ch !== ch.toLowerCase();
      tiles.push(tile);
    }
  }
  return { width: MAP_WIDTH, height: MAP_HEIGHT, tiles };
}

/** A premade world ready to play: its terrain plus specials and villages from the game's RNG. */
export function premadeMap(rng: RngState, id: string): WorldMap {
  const map = decodeWorld(premadeWorld(id));
  scatterSpecials(map, rng);
  labelContinents(map);
  return map;
}
