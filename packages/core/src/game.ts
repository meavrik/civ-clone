import { selectNextUnit } from "./commands.js";
import { generateMap, type MapGenOptions } from "./map/generate.js";
import { premadeMap, premadeWorld, type PremadeWorld } from "./map/premade.js";
import { createRng, nextInt } from "./rng.js";
import { advancesFor } from "./rules/advances.js";
import { civ, CIVS, colorSlot } from "./rules/civs.js";
import { newSpaceship } from "./rules/spaceship.js";
import { MAP_HEIGHT, MAP_WIDTH, Terrain, type GameState, type Player, type WorldMap } from "./types.js";
import { createUnit } from "./units.js";
import { recomputeVisibility } from "./visibility.js";

export interface NewGameOptions extends MapGenOptions {
  /** Difficulty 0 (Chieftain) .. 4 (Emperor). */
  difficulty?: number;
  /** Civ id for the human player. */
  civ?: string;
  /** Number of AI opponents (0..6). */
  opponents?: number;
  /** Premade world to play on (see PREMADE_WORLDS); a generated one when absent. */
  world?: string;
  /** On a premade world: civilizations come from it and start in their historical homelands. */
  historical?: boolean;
  /**
   * Player 0 is AI-driven too (no human seat). Used by the headless
   * tournament harness; such a game has an empty command log.
   */
  allAi?: boolean;
  /** The 1991 rules: every fight is one roll and units take no lasting damage. Old saves load with it. */
  classicCombat?: boolean;
  /** The 1991 terrain: wheeled units cross rough ground and harsh ground wears nobody down. Old saves load with it. */
  classicTerrain?: boolean;
  /** Mountains take every land unit, as before only settlers climbed them off the road. Old saves load with it. */
  openMountains?: boolean;
  /** Our first barbarians (coastal parties, no leaders, razing what they take). Old saves load with it. */
  simpleBarbarians?: boolean;
  /** Zones of control reach a soldier stepping off a ship. Old saves load with it. */
  zocAtSea?: boolean;
  /** The 1991 civilizations: no traits, no starting advance. Old saves load with it. */
  classicCivs?: boolean;
  /** Our first unit upkeep (3 free units a city under Monarchy and Communism, debts paid from the shield box). Old saves load with it. */
  looseUpkeep?: boolean;
  /** The 1991 tech tree, before Weaving, Animal Husbandry and the modern advances. Old saves load with it. */
  classicAdvances?: boolean;
  /** Our first contact (two squares apart, nobody stops, cities see nothing round them). Old saves load with it. */
  farContact?: boolean;
  /** Nobody minds foreign units on their land. Old saves load with it. */
  noTrespass?: boolean;
  /** Rivals come only from civilizations a save of this version knew (`CivRule.since`). Old saves load with it. */
  roster?: number;
}

/** A player for a civilization; its colour slot comes from the civilization, never the seat. */
function makePlayer(id: number, civId: string, isAi: boolean): Player {
  const color = colorSlot(civ(civId).color);
  return {
    id,
    civ: civId,
    name: civ(civId).name,
    isAi,
    alive: true,
    color,
    explored: new Uint8Array(MAP_WIDTH * MAP_HEIGHT),
    visible: new Uint8Array(MAP_WIDTH * MAP_HEIGHT),
    gold: 0,
    taxRate: 5,
    luxRate: 0,
    sciRate: 5,
    government: "despotism",
    science: 0,
    advances: [],
    researching: null,
    anarchyTurns: 0,
    pendingGovernment: null,
    difficulty: 2,
    spaceship: newSpaceship(),
  };
}

/** Homelands closer than this overlap: rivals are drawn from roomier ones first. */
const HOMELAND_ROOM = 3;
/** Starts nudged off a crowded homeland keep at least this far apart. */
const START_SPACING = 3;

function squareDist(map: WorldMap, a: readonly [number, number], b: readonly [number, number]): number {
  const dx = Math.abs(a[0] - b[0]);
  return Math.max(Math.min(dx, map.width - dx), Math.abs(a[1] - b[1]));
}

/** Civilizations with a homeland on the world, in roster order (barbarians never have one). */
export function nativeCivs(world: PremadeWorld): string[] {
  return CIVS.filter((c) => world.starts[c.id] !== undefined).map((c) => c.id);
}

/**
 * The square nearest a homeland that can take a city and is not crowding an
 * earlier start; the homeland itself unless a neighbour already sits there.
 */
function homelandStart(map: WorldMap, home: readonly [number, number], starts: [number, number][]): [number, number] {
  const fits = (x: number, y: number, strict: boolean) => {
    if (y < 0 || y >= map.height) return false;
    const t = map.tiles[y * map.width + x]!;
    if (t.terrain === Terrain.Ocean || t.terrain === Terrain.Arctic || t.terrain === Terrain.Mountains) return false;
    if (strict && !(t.terrain === Terrain.Grassland || t.terrain === Terrain.Plains || t.terrain === Terrain.Hills || t.river)) return false;
    return starts.every((s) => squareDist(map, s, [x, y]) >= START_SPACING);
  };
  for (const strict of [true, false])
    for (let r = 0; r <= 8; r++)
      for (let dy = -r; dy <= r; dy++)
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const x = (((home[0] + dx) % map.width) + map.width) % map.width;
          const y = home[1] + dy;
          if (fits(x, y, strict)) return [x, y];
        }
  return [home[0], home[1]];
}

export function newGame(seed: number, opts: NewGameOptions = {}): GameState {
  const rng = createRng(seed);
  const world = opts.world ? premadeWorld(opts.world) : undefined;
  const map = opts.world ? premadeMap(rng, opts.world) : generateMap(rng, opts);
  const homes = world && opts.historical ? world.starts : undefined;
  const humanCiv = opts.civ ?? "romans";
  const roster = opts.roster;
  const others = CIVS.filter((c) => c.id !== humanCiv && c.id !== "barbarians" && (!homes || homes[c.id] !== undefined) && (roster === undefined || (c.since ?? 0) <= roster));
  const opponents = Math.max(0, Math.min(others.length, opts.opponents ?? 2));
  const players: Player[] = [makePlayer(0, humanCiv, opts.allAi === true)];
  for (let i = 0; i < opponents; i++) {
    // Every civilization in the game keeps its own colour: skip civs whose colour is taken.
    const takenColors = new Set(players.map((p) => p.color));
    let pool = others.filter((c) => !takenColors.has(colorSlot(c.color)));
    if (!pool.length) break;
    // With homelands, prefer rivals that are not crowding a civilization already in.
    if (homes) {
      const taken = players.map((p) => homes[p.civ]).filter((h) => h !== undefined);
      const roomy = pool.filter((c) => taken.every((h) => squareDist(map, h, homes[c.id]!) >= HOMELAND_ROOM));
      if (roomy.length) pool = roomy;
    }
    const pick = pool[nextInt(rng, pool.length)]!;
    others.splice(others.indexOf(pick), 1);
    players.push(makePlayer(players.length, pick.id, true));
  }
  const barbarians = players.length;
  players.push(makePlayer(barbarians, "barbarians", true));

  const state: GameState = {
    seed,
    rng,
    turn: 0,
    map,
    players,
    units: [],
    cities: [],
    nextUnitId: 1,
    nextCityId: 1,
    relations: {},
    barbarians,
    currentPlayer: 0,
    activeUnit: null,
    warming: 0,
    ...(opts.classicCombat ? { classicCombat: true } : {}),
    ...(opts.classicTerrain ? { classicTerrain: true } : {}),
    ...(opts.openMountains ? { openMountains: true } : {}),
    ...(opts.simpleBarbarians ? { simpleBarbarians: true } : {}),
    ...(opts.zocAtSea ? { zocAtSea: true } : {}),
    ...(opts.classicCivs ? { classicCivs: true } : {}),
    ...(opts.looseUpkeep ? { looseUpkeep: true } : {}),
    ...(opts.classicAdvances ? { classicAdvances: true } : {}),
    ...(opts.farContact ? { farContact: true } : {}),
    ...(opts.noTrespass ? { noTrespass: true } : {}),
  };
  const difficulty = opts.difficulty ?? 2;
  for (const p of players) {
    p.difficulty = difficulty;
    p.gold = [100, 50, 0, 0, 0][difficulty] ?? 0;
    // Each civilization begins with the advance of its trait, and whatever it needs (Horseback Riding: Animal Husbandry).
    const start = civ(p.civ).trait?.start;
    if (start && !state.classicCivs) {
      const tree = advancesFor(state);
      const grant = (id: string): void => {
        for (const r of tree.find((a) => a.id === id)?.requires ?? []) grant(r);
        if (!p.advances.includes(id)) p.advances.push(id);
      };
      grant(start);
    }
  }

  // Starting positions: open land on decent continents, spread apart.
  const sizes = new Map<number, number>();
  for (const t of map.tiles) if (t.terrain !== Terrain.Ocean) sizes.set(t.continent, (sizes.get(t.continent) ?? 0) + 1);
  const candidates: number[] = [];
  for (let y = 6; y < map.height - 6; y++)
    for (let x = 0; x < map.width; x++) {
      const t = map.tiles[y * map.width + x]!;
      if ((t.terrain === Terrain.Grassland || t.terrain === Terrain.Plains) && (sizes.get(t.continent) ?? 0) >= 40)
        candidates.push(y * map.width + x);
    }
  const starts: [number, number][] = [];
  const far = (x: number, y: number) =>
    starts.every(([sx, sy]) => Math.max(Math.min(Math.abs(sx - x), map.width - Math.abs(sx - x)), Math.abs(sy - y)) >= 10);
  for (const p of players) {
    if (p.id === barbarians) continue;
    let sx = 0;
    let sy = map.height >> 1;
    const home = homes?.[p.civ];
    if (home) [sx, sy] = homelandStart(map, home, starts);
    else
      for (let tries = 0; tries < 200 && candidates.length; tries++) {
        const pick = candidates[nextInt(rng, candidates.length)]!;
        const x = pick % map.width;
        const y = Math.floor(pick / map.width);
        if (tries === 199 || far(x, y)) { sx = x; sy = y; break; }
      }
    starts.push([sx, sy]);
    const settlers = difficulty <= 1 || p.isAi ? 2 : 1;
    for (let i = 0; i < settlers; i++) createUnit(state, "settlers", p.id, sx, sy);
    recomputeVisibility(state, p.id);
    p.explored.set(p.visible);
  }
  selectNextUnit(state, null);
  return state;
}

/** Original calendar: 4000 BC start, 20 years/turn until 1 AD, then slower. */
export function turnToYear(turn: number): number {
  if (turn < 200) return -4000 + turn * 20;
  if (turn < 250) return (turn - 200) * 10 + 1;
  if (turn < 300) return 500 + (turn - 250) * 5;
  if (turn < 350) return 750 + (turn - 300) * 2;
  return 850 + (turn - 350);
}

export function formatYear(year: number): string {
  return year < 0 ? `${-year} BC` : `${year} AD`;
}
