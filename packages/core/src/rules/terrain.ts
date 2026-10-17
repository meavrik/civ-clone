import { Terrain } from "../types.js";

/**
 * Terrain ruleset. Yields are food/shields/trade per worked tile; move cost is
 * in whole movement points (stored internally in thirds); defense is a
 * multiplier applied to the defender. Values were checked against FreeCiv's
 * civ1 ruleset: only forest, swamp and jungle change terrain under the
 * plough, nothing is mined into forest, and mountains mine for +1.
 */
export interface TerrainRule {
  food: number;
  shields: number;
  trade: number;
  moveCost: number;
  defense: number;
  /** Special resource found on this terrain and its bonus. */
  special?: { name: string; food?: number; shields?: number; trade?: number };
  /** Irrigation result: yield bonus, or a terrain change. Turns = settler-turns. */
  irrigate?: { food?: number; becomes?: Terrain; turns: number };
  mine?: { shields?: number; becomes?: Terrain; turns: number };
  /** Roads add trade only on open terrain. Turns to build. */
  road: { trade: number; turns: number };
  /** Rough ground: wheeled units enter only along a road (every city square has one). */
  rough?: boolean;
  /**
   * Harsh ground: a land unit ending its turn here loses this share of its
   * full hit points instead of healing (never its last one), until its owner
   * knows `until`. Squares near the owner's cities, a river or a special
   * (water, food) spare it.
   */
  attrition?: { share: number; until: string };
  /** No barbarian uprising or raid starts here (FreeCiv civ1: tundra and arctic). */
  noBarbarians?: boolean;
}

export const TERRAIN_RULES: Record<Terrain, TerrainRule> = {
  [Terrain.Ocean]: {
    food: 1, shields: 0, trade: 2, moveCost: 1, defense: 1,
    special: { name: "Fish", food: 2 },
    road: { trade: 0, turns: 0 },
  },
  [Terrain.Grassland]: {
    food: 2, shields: 0, trade: 0, moveCost: 1, defense: 1,
    // Grassland "resources" (the shield variant) are handled as a special.
    special: { name: "Resources", shields: 1 },
    irrigate: { food: 1, turns: 5 },
    road: { trade: 1, turns: 2 },
  },
  [Terrain.Plains]: {
    food: 1, shields: 1, trade: 0, moveCost: 1, defense: 1,
    special: { name: "Horses", shields: 2 },
    irrigate: { food: 1, turns: 5 },
    road: { trade: 1, turns: 2 },
  },
  [Terrain.Forest]: {
    food: 1, shields: 2, trade: 0, moveCost: 2, defense: 1.5,
    special: { name: "Game", food: 2 },
    irrigate: { becomes: Terrain.Plains, turns: 5 },
    road: { trade: 0, turns: 4 },
  },
  [Terrain.Hills]: {
    food: 1, shields: 0, trade: 0, moveCost: 2, defense: 2,
    special: { name: "Coal", shields: 2 },
    irrigate: { food: 1, turns: 10 },
    mine: { shields: 3, turns: 10 },
    road: { trade: 0, turns: 4 },
  },
  [Terrain.Mountains]: {
    food: 0, shields: 1, trade: 0, moveCost: 3, defense: 3,
    special: { name: "Gold", trade: 6 },
    mine: { shields: 1, turns: 10 },
    road: { trade: 0, turns: 6 },
    rough: true,
  },
  [Terrain.Desert]: {
    food: 0, shields: 1, trade: 0, moveCost: 1, defense: 1,
    special: { name: "Oasis", food: 3 },
    irrigate: { food: 1, turns: 5 },
    mine: { shields: 1, turns: 5 },
    road: { trade: 1, turns: 2 },
    // Caravans learned the water holes.
    attrition: { share: 0.1, until: "trade" },
  },
  [Terrain.Tundra]: {
    food: 1, shields: 0, trade: 0, moveCost: 1, defense: 1,
    special: { name: "Game", food: 2 },
    road: { trade: 0, turns: 2 },
    noBarbarians: true,
  },
  [Terrain.Arctic]: {
    food: 0, shields: 0, trade: 0, moveCost: 2, defense: 1,
    special: { name: "Seals", food: 2 },
    road: { trade: 0, turns: 4 },
    rough: true,
    noBarbarians: true,
    // Frostbite and scurvy, until physicians know better.
    attrition: { share: 0.2, until: "medicine" },
  },
  [Terrain.Swamp]: {
    food: 1, shields: 0, trade: 0, moveCost: 2, defense: 1.5,
    special: { name: "Peat", shields: 4 },
    irrigate: { becomes: Terrain.Grassland, turns: 15 },
    road: { trade: 0, turns: 4 },
    rough: true,
  },
  [Terrain.Jungle]: {
    food: 1, shields: 0, trade: 0, moveCost: 2, defense: 1.5,
    special: { name: "Gems", trade: 4 },
    irrigate: { becomes: Terrain.Grassland, turns: 15 },
    road: { trade: 0, turns: 4 },
    rough: true,
  },
};

/** Movement points are stored in thirds so roads (1/3) stay integral. */
export const MOVE_FRAC = 3;

/** Settler-turns for the later improvements: rails take twice a road, forts and clean-ups three turns. */
export const RAILROAD_TURNS_FACTOR = 2;
export const FORTRESS_TURNS = 3;
export const CLEAN_TURNS = 3;

/** Polluted tiles above this count push the world toward global warming; it strikes when the pressure reaches the limit. */
export const WARMING_THRESHOLD = 12;
export const WARMING_LIMIT = 100;
