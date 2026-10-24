import type { RngState } from "./rng.js";
import type { SpacePart, Spaceship } from "./rules/spaceship.js";

/** Original world size: 80 columns wrapping east-west, 50 rows. */
export const MAP_WIDTH = 80;
export const MAP_HEIGHT = 50;

export type WorldSize = "small" | "medium" | "large";

/**
 * World sizes offered at setup (our departure: the original had one). Each
 * keeps the original's 8:5 shape, so the minimap stays 80x50 pixels; small is
 * the original's world and what every game without a size plays on.
 */
export const WORLD_SIZES: readonly { id: WorldSize; name: string; width: number; height: number }[] = [
  { id: "small", name: "Small", width: MAP_WIDTH, height: MAP_HEIGHT },
  { id: "medium", name: "Medium", width: 120, height: 75 },
  { id: "large", name: "Large", width: 160, height: 100 },
];

export function worldSize(id: WorldSize = "small"): (typeof WORLD_SIZES)[number] {
  return WORLD_SIZES.find((s) => s.id === id) ?? WORLD_SIZES[0]!;
}

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
  /** The special is its terrain's second kind (`TerrainRule.second`), where it has one. */
  secondSpecial?: boolean;
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
  /**
   * On the original's diagonal bands of shield grassland (`grassShieldAt`): grassland here, river or
   * not, yields a shield more, and land drained into grassland here shows it. Set for games from save
   * version 26; their grassland has no other first special.
   */
  grassShield?: boolean;
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

/**
 * Between two civilizations: "none" before they meet, "contact" once met
 * without a treaty (neither side may attack before declaring war, and maps
 * and borders wait for peace), "peace" under a treaty, "war". Saves before
 * version 15 went straight to peace on meeting (`peaceOnContact`).
 */
export type Relation = "none" | "contact" | "peace" | "war";

export type Specialist = "entertainer" | "taxman" | "scientist";

/** What a city works its squares for (`FOCI` in rules/focus.ts). */
export type CityFocus = "growth" | "production" | "science" | "trade";

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
  /**
   * The box as the turn began (or as bought) and the kind of production it was gathered for: a
   * change to another kind keeps half of it, a change back all of it. Absent until the city's first
   * turn end; old saves halve on every change instead (`compoundingPenalty`).
   */
  turnShields?: number;
  turnKind?: Production["kind"];
  /** True once a disorder turn has been reported, for the renderer. */
  disorder: boolean;
  /** Turns in disorder in a row at the last turn's end; past the government's `revolutionAfter` a Democracy falls. */
  unrest: number;
  /**
   * The people celebrated their ruler at the last turn's end (`CityReport.celebration`): this turn the
   * city runs by its government's `celebration` rule (`cityYieldGovernment`; a Republic or Democracy grows it).
   */
  celebrating: boolean;
  /** Ids of cities this one trades with (caravan routes, mutual, at most three). */
  routes: number[];
  /**
   * What its citizens are put to work for, as chosen on the city screen (`setFocus`). Unset, a city
   * of the player's works for growth and a computer player's weighs squares as it always did (`cityFocus`).
   */
  focus?: CityFocus;
  /**
   * The foci picked together (`setFoci`, the city screen's four corner toggles): any of them, or none
   * (the old balance). When set it takes the place of `focus`; games before it have only `focus`.
   */
  foci?: CityFocus[];
  /** Culture gathered since it was founded, in saves before version 14 (`accruedCulture`); since then a city's culture is what it holds (`cityCulture` in territory.ts) and this stays 0. */
  culture: number;
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
  /** The 1991 tech tree (Future Tech. last, no Weaving, Animal Husbandry or modern advances). Set for saves before version 9. */
  classicAdvances?: boolean;
  /** Our first contact: civilizations meet two squares apart, the meeting stops no one, and cities see nothing round them. Set for saves before version 10. */
  farContact?: boolean;
  /** No civilization minds foreign units on its land (no demands to leave, no wars over it). Set for saves before version 10. */
  noTrespass?: boolean;
  /** Every city's land is the 21 squares it works, whatever its culture. Set for saves before version 12. */
  fixedBorders?: boolean;
  /** Culture mounts every turn (`City.culture`, `cultureRate`) rather than being what a city's people, buildings and wonders make it. Set for saves before version 14. */
  accruedCulture?: boolean;
  /** Meeting signs peace at once (no "contact" relation, no peace offers). Set for saves before version 15. */
  peaceOnContact?: boolean;
  /** A city works any of its 21 squares, inside its border or not (`slotInLand`). Set for saves before version 16. */
  workBeyondBorders?: boolean;
  /**
   * Our first moods: no celebrations, martial law of three units under every government that has it,
   * soldiers abroad souring content citizens only, wonders calming with the buildings, a Democracy
   * never toppled by riots, and one content citizen fewer per four cities past eight. Set for saves before version 17.
   */
  simpleMoods?: boolean;
  /** Second specials only of those a save of this version knew (`SpecialRule.since`). Set for saves before version 20. */
  resources?: number;
  /** Every change of production kind halves the box again, even a change back. Set for saves before version 21. */
  compoundingPenalty?: boolean;
  /**
   * The AI planner founds a city on any fit square it stands on, however near another city (the rules
   * allow two squares apart), as it did before version 22; since then it keeps its cities apart.
   */
  packedCities?: boolean;
  /** Every city weighs its squares food 3, shields 2, trade 1 and has no focus, as before version 23. */
  balancedWorkers?: boolean;
  /** Despotism's and Anarchy's -1 on yields over 2 reaches the city's own square too, as before version 24. */
  centrePenalty?: boolean;
  /** Settlers take a free unit and pay a shield beyond it like any unit, besides their food, as before version 24. */
  settlerShields?: boolean;
  /**
   * Our first yields, FreeCiv's civ1 numbers, before version 26: grassland's shields as a scattered
   * Resources special, roads adding trade on rivers, rivers no defence, nothing mined into forest,
   * railroads adding shields only, and a city's own square always making a shield.
   */
  freecivYields?: boolean;
  /** The Colossus adds trade to the ocean squares its city works only, and workers are placed by bare yields, as before version 27. */
  oceanColossus?: boolean;
  /** Pairs "a:b" (a < b) whose lands are open to each other's units. Missing: none agreed. */
  openBorders?: Record<string, true>;
  /** "owner>intruder": when `owner` last asked `intruder` to take its units off its land, and how often since they last stood clear. */
  trespass?: Record<string, Trespass>;
  /** "payer>receiver": the turn tribute was last paid. */
  tributePaid?: Record<string, number>;
  /** "offerer>to": the turn `offerer` last offered `to` peace. */
  peaceOffers?: Record<string, number>;
}

export interface Trespass {
  /** Turn of the latest demand. */
  turn: number;
  /** Demands so far; the second is the last before war. */
  warnings: number;
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
