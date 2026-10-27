import { Terrain } from "../types.js";
import { COAL, HORSES, IRON, OIL, RESOURCE_BY_ID } from "./resources.js";

/**
 * Terrain ruleset. Yields are food/shields/trade per worked tile; move cost is
 * in whole movement points (stored internally in thirds); defense is a
 * multiplier applied to the defender. Values follow the 1991 game's own tables
 * (asked for 2026-10-23: "same as civilization 1, the original"): forest, swamp
 * and jungle change terrain under the plough, grassland, plains, swamp and
 * jungle are mined into forest (games before save version 26, `freecivYields`,
 * had FreeCiv's civ1 numbers: nothing mined into forest), mountains mine for +1.
 */
/**
 * A special resource and what it adds to its square; `learned` adds more for a worker whose
 * civilization knows an advance (Animal Husbandry: pastures for Horses, Game and Seals).
 */
export interface SpecialRule {
  name: string;
  food?: number;
  shields?: number;
  trade?: number;
  learned?: { advance: string; food?: number; shields?: number; trade?: number };
  /** The save version that brought it (second specials): worlds of older saves have none (`MapGenOptions.resources`). */
  since?: number;
  /** Found only this many squares from land or nearer (fish keep to coastal waters). */
  within?: number;
  /** Found only this many squares from land or farther (whales keep to deep water: no land beside them). */
  beyond?: number;
}

/** The save version from which `within` and `beyond` place specials; older worlds ignore them. */
export const SPECIAL_REACH_SINCE = 19;

export interface TerrainRule {
  food: number;
  shields: number;
  trade: number;
  moveCost: number;
  defense: number;
  /** The original's special resource on this terrain (see `SpecialRule`). */
  special?: SpecialRule;
  /**
   * A second kind of special (our departure, asked for 2026-10-21, after Civilization II): about
   * half the specials on this terrain are this one instead (`Tile.secondSpecial`), in worlds of
   * saves from its `since` on.
   */
  second?: SpecialRule;
  /** Irrigation result: yield bonus, or a terrain change. Turns = settler-turns. */
  irrigate?: { food?: number; becomes?: Terrain; turns: number };
  mine?: { shields?: number; becomes?: Terrain; turns: number };
  /** Roads add trade only on open terrain. Turns to build. */
  road: { trade: number; turns: number };
  /** Rough ground: wheeled units enter only along a road (every city square has one). */
  rough?: boolean;
  /** Steep ground: only settlers climb on without a road; everyone else follows the road they build. */
  roadOnly?: boolean;
  /**
   * Harsh ground: a land unit ending its turn here loses this share of its
   * full hit points instead of healing (never its last one), until its owner
   * knows `until` (`classicUntil` in games on the 1991 tech tree). Squares near the
   * owner's cities, a river or a special (water, food) spare it.
   */
  attrition?: { share: number; until: string; classicUntil?: string };
  /** No barbarian uprising or raid starts here (FreeCiv civ1: tundra and arctic). */
  noBarbarians?: boolean;
}

export const TERRAIN_RULES: Record<Terrain, TerrainRule> = {
  [Terrain.Ocean]: {
    food: 1, shields: 0, trade: 2, moveCost: 1, defense: 1,
    special: { name: "Fish", food: 2, within: 2 },
    // Whalers put to sea with Navigation.
    second: { name: "Whales", food: 1, shields: 1, learned: { advance: "navigation", shields: 1 }, since: 17, beyond: 2 },
    road: { trade: 0, turns: 0 },
  },
  [Terrain.Grassland]: {
    food: 2, shields: 0, trade: 0, moveCost: 1, defense: 1,
    // Grassland "resources" (the shield variant) are handled as a special.
    // Games before version 26 only: since then grassland's shields lie on the original's bands (`grassShieldAt`).
    special: { name: "Resources", shields: 1 },
    second: { name: "Cotton", trade: 2, learned: { advance: "weaving", shields: 1 }, since: 17 },
    irrigate: { food: 1, turns: 5 },
    mine: { becomes: Terrain.Forest, turns: 10 },
    road: { trade: 1, turns: 2 },
  },
  [Terrain.Plains]: {
    food: 1, shields: 1, trade: 0, moveCost: 1, defense: 1,
    special: HORSES,
    // Pots keep the harvest.
    second: { name: "Wheat", food: 2, learned: { advance: "pottery", food: 1 }, since: 17 },
    irrigate: { food: 1, turns: 5 },
    mine: { becomes: Terrain.Forest, turns: 15 },
    road: { trade: 1, turns: 2 },
  },
  [Terrain.Forest]: {
    food: 1, shields: 2, trade: 0, moveCost: 2, defense: 1.5,
    special: { name: "Game", food: 2, learned: { advance: "animal_husbandry", food: 1 } },
    // Looms want silk.
    second: { name: "Silk", trade: 3, learned: { advance: "weaving", trade: 1 }, since: 18 },
    irrigate: { becomes: Terrain.Plains, turns: 5 },
    road: { trade: 0, turns: 4 },
  },
  [Terrain.Hills]: {
    food: 1, shields: 0, trade: 0, moveCost: 2, defense: 2,
    special: COAL,
    second: { name: "Wine", trade: 4, since: 18 },
    irrigate: { food: 1, turns: 10 },
    mine: { shields: 3, turns: 10 },
    road: { trade: 0, turns: 4 },
  },
  [Terrain.Mountains]: {
    food: 0, shields: 1, trade: 0, moveCost: 3, defense: 3,
    special: { name: "Gold", trade: 6 },
    second: IRON,
    mine: { shields: 1, turns: 10 },
    road: { trade: 0, turns: 6 },
    rough: true,
    roadOnly: true,
  },
  [Terrain.Desert]: {
    food: 0, shields: 1, trade: 0, moveCost: 1, defense: 1,
    special: { name: "Oasis", food: 3 },
    second: OIL,
    irrigate: { food: 1, turns: 5 },
    mine: { shields: 1, turns: 5 },
    road: { trade: 1, turns: 2 },
    // Caravans learned the water holes.
    attrition: { share: 0.1, until: "trade" },
  },
  [Terrain.Tundra]: {
    food: 1, shields: 0, trade: 0, moveCost: 1, defense: 1,
    special: { name: "Game", food: 2, learned: { advance: "animal_husbandry", food: 1 } },
    second: { name: "Furs", food: 1, trade: 3, since: 18 },
    road: { trade: 0, turns: 2 },
    noBarbarians: true,
  },
  [Terrain.Arctic]: {
    food: 0, shields: 0, trade: 0, moveCost: 2, defense: 1,
    special: { name: "Seals", food: 2, learned: { advance: "animal_husbandry", food: 1 } },
    second: { name: "Ivory", food: 1, shields: 1, trade: 4, since: 18 },
    road: { trade: 0, turns: 4 },
    rough: true,
    noBarbarians: true,
    // Frostbite, until cloth keeps the cold out (until physicians know better, on the 1991 tree).
    attrition: { share: 0.2, until: "weaving", classicUntil: "medicine" },
  },
  [Terrain.Swamp]: {
    food: 1, shields: 0, trade: 0, moveCost: 2, defense: 1.5,
    special: { name: "Peat", shields: 4 },
    second: { name: "Spices", food: 2, trade: 4, since: 18 },
    irrigate: { becomes: Terrain.Grassland, turns: 15 },
    mine: { becomes: Terrain.Forest, turns: 15 },
    road: { trade: 0, turns: 4 },
    rough: true,
  },
  [Terrain.Jungle]: {
    food: 1, shields: 0, trade: 0, moveCost: 2, defense: 1.5,
    special: { name: "Gems", trade: 4 },
    second: { name: "Fruit", food: 3, trade: 1, since: 18 },
    irrigate: { becomes: Terrain.Grassland, turns: 15 },
    mine: { becomes: Terrain.Forest, turns: 15 },
    road: { trade: 0, turns: 4 },
    rough: true,
  },
};

/** A terrain's second kind of special, if worlds of a save of version `resources` have it (all do when absent). */
export function secondKind(rule: TerrainRule, resources?: number): SpecialRule | undefined {
  const s = rule.second;
  return s && (resources === undefined || (s.since ?? 0) <= resources) ? s : undefined;
}

/**
 * Whether square (x, y) lies on the original's bands of shield grassland: diagonal stripes two squares
 * wide, every other pair (x + y modulo 4 being 0 or 3), as the 1991 game lays them on grassland and rivers.
 */
export function grassShieldAt(x: number, y: number): boolean {
  const m = (x + y) % 4;
  return m === 0 || m === 3;
}

/** The special on a square, if it has one: its deposit's, else its terrain's second kind where the square says so, else the first. */
export function specialOf(tile: { terrain: Terrain; special: boolean; secondSpecial?: boolean; deposit?: string }): SpecialRule | undefined {
  if (!tile.special) return undefined;
  // A strategic resource's deposit is its special whatever the terrain (rules/resources.ts).
  if (tile.deposit) return RESOURCE_BY_ID[tile.deposit]?.special;
  const r = TERRAIN_RULES[tile.terrain];
  return (tile.secondSpecial ? r.second : undefined) ?? r.special;
}

/** Movement points are stored in thirds so roads (1/3) stay integral. */
export const MOVE_FRAC = 3;

/** Settler-turns for the later improvements: rails take twice a road, forts and clean-ups three turns. */
export const RAILROAD_TURNS_FACTOR = 2;
export const FORTRESS_TURNS = 3;
export const CLEAN_TURNS = 3;

/** Polluted tiles above this count push the world toward global warming; it strikes when the pressure reaches the limit. */
export const WARMING_THRESHOLD = 12;
export const WARMING_LIMIT = 100;
