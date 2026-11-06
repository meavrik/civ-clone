import { selectNextUnit } from "./commands.js";
import { generateMap, scatterDeposits, spreadSpecials, type MapGenOptions } from "./map/generate.js";
import { premadeMap, premadeStarts, premadeWorld, type PremadeWorld } from "./map/premade.js";
import { createRng, nextInt } from "./rng.js";
import { advancesFor } from "./rules/advances.js";
import { civ, CIVS, colorSlot, type CivRule } from "./rules/civs.js";
import { difficultyRule } from "./rules/difficulty.js";
import { computerRule } from "./levels.js";
import { newSpaceship } from "./rules/spaceship.js";
import { MAP_WIDTH, Terrain, type GameState, type Player, type WorldMap } from "./types.js";
import { createUnit } from "./units.js";
import { placeCityStates } from "./city-states.js";
import { recomputeVisibility } from "./visibility.js";
import { siteScore } from "./sites.js";
import { grassShieldAt } from "./rules/terrain.js";

export interface NewGameOptions extends MapGenOptions {
  /** Difficulty 0 (Chieftain) .. 4 (Emperor). */
  difficulty?: number;
  /** Civ id for the human player. */
  civ?: string;
  /** Number of AI opponents (0..9). */
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
  /** Sight round units and next to cities only, not over a civilization's land (see `GameState.narrowSight`). Old saves load with it. */
  narrowSight?: boolean;
  /** Wonders bought at an improvement's price (see `GameState.cheapWonderBuy`). Old saves load with it. */
  cheapWonderBuy?: boolean;
  /** One veteran rank won by a coin toss, no experience (see `GameState.simpleVeterans`). Old saves load with it. */
  simpleVeterans?: boolean;
  /** Each city's land is the 21 squares it works; borders never grow with culture. Old saves load with it. */
  fixedBorders?: boolean;
  /** Our first culture: gathered every turn, not what a city's people and buildings make it. Old saves load with it. */
  accruedCulture?: boolean;
  /** Civilizations make peace the moment they meet, with no treaty to ask for. Old saves load with it. */
  peaceOnContact?: boolean;
  /** Cities work any of their 21 squares, not only those inside their border. Old saves load with it. */
  workBeyondBorders?: boolean;
  /** Our first moods: no celebrations, martial law capped at three, no Democracy toppled by riots. Old saves load with it. */
  simpleMoods?: boolean;
  /** Rivals come only from civilizations a save of this version knew (`CivRule.since`). Old saves load with it. */
  roster?: number;
  /** Premade worlds as first drawn, some islands joined to their neighbours by land (Britain to France). Old saves load with it. */
  joinedIslands?: boolean;
  /** Every change of production kind halves the box again, even a change back. Old saves load with it. */
  compoundingPenalty?: boolean;
  /** Computer civilizations found cities wherever the rules allow, not only well apart. Old saves load with it. */
  packedCities?: boolean;
  /** No city focus: every city weighs its squares as before version 23. Old saves load with it. */
  balancedWorkers?: boolean;
  /** The city's own square suffers Despotism's and Anarchy's -1 like any other. Old saves load with it. */
  centrePenalty?: boolean;
  /** Settlers draw on their city's free units and pay shields like other units. Old saves load with it. */
  settlerShields?: boolean;
  /** Each civilization starts on the square drawn for it, good land or not. Old saves load with it. */
  randomStarts?: boolean;
  /** Our first yields (FreeCiv's civ1 numbers, see `GameState.freecivYields`). Old saves load with it. */
  freecivYields?: boolean;
  /** The Colossus on ocean squares only (see `GameState.oceanColossus`). Old saves load with it. */
  oceanColossus?: boolean;
  /** A finished improvement's leftover halved for the next one (see `GameState.halvedCarryOver`). Old saves load with it. */
  halvedCarryOver?: boolean;
  /** The first culture levels, radius 2 at 8 (see `GameState.slowCulture`). Old saves load with it. */
  slowCulture?: boolean;
  /** No trade from specials beyond a city's worked squares (see `GameState.noInfluenceYields`). Old saves load with it. */
  noInfluenceYields?: boolean;
  /** Free units by city size and settlers free of shields (see `GameState.sizeFreeUnits`). Old saves load with it. */
  sizeFreeUnits?: boolean;
  /** No strategic resources or deposits (see `GameState.noResources`). Old saves load with it. */
  noResources?: boolean;
  /** Settlers fortify and found cities two squares apart (see `GameState.looseSettlers`). Old saves load with it. */
  looseSettlers?: boolean;
  /** Triremes sail open water unharmed (see `GameState.safeTriremes`). Old saves load with it. */
  safeTriremes?: boolean;
  /** The capital's border at its 21 squares from the start (see `GameState.wideCapital`). Old saves load with it. */
  wideCapital?: boolean;
  /** Stepping onto land that minds it is the first demand to leave (see `GameState.askOnEntry`). Old saves load with it. */
  askOnEntry?: boolean;
  /** Gifts of gold sway no leader (see `GameState.noGoodwill`). Old saves load with it. */
  noGoodwill?: boolean;
  /** Computer leaders ask nothing of the player (see `GameState.quietLeaders`). Old saves load with it. */
  quietLeaders?: boolean;
  /** The planner AI's habits before version 38 (see `GameState.oldPlanner`). Old saves load with it. */
  oldPlanner?: boolean;
  /** No unit retires (see `GameState.lastingUnits`). Old saves load with it. */
  lastingUnits?: boolean;
  /** Every strategic resource seen from the start (see `GameState.visibleResources`). Old saves load with it. */
  visibleResources?: boolean;
  /** Coal seen from the start (see `GameState.visibleCoal`). Old saves load with it. */
  visibleCoal?: boolean;
  /** A dry treasury sells a building (see `GameState.sellWhenBroke`). Old saves load with it. */
  sellWhenBroke?: boolean;
  /** A strategic resource serves without a road (see `GameState.roadlessResources`). Old saves load with it. */
  roadlessResources?: boolean;
  /** A strategic resource on a river square wants a road built on it all the same (see `GameState.riverNeedsRoad`). Old saves load with it. */
  riverNeedsRoad?: boolean;
  /** A finished production's leftover shields kept for the next (see `GameState.leftoverShields`). Old saves load with it. */
  leftoverShields?: boolean;
  /** A human player's city turns to its default production by itself (see `GameState.defaultBuilds`). Old saves load with it. */
  defaultBuilds?: boolean;
  /** A human player's city waits for a choice after any finished unit, a fighting one too (see `GameState.pickAfterUnits`). Old saves load with it. */
  pickAfterUnits?: boolean;
  /** No unit gives way to its successor (see `GameState.noReplacements`). Old saves load with it. */
  noReplacements?: boolean;
  /** Only an empty foreign city takes a caravan in (see `GameState.barredCaravans`). Old saves load with it. */
  barredCaravans?: boolean;
  /** The squares picked for a city only keep it from starving (see `GameState.fedOnly`). Old saves load with it. */
  fedOnly?: boolean;
  /** Villages hold no tribe (see `GameState.noTribes`). Old saves load with it. */
  noTribes?: boolean;
  /** Settlers start a job the turn they walk onto its square, and clean up in three turns (see `GameState.quickWork`). Old saves load with it. */
  quickWork?: boolean;
  /** The computer players under the human's rules of the level, as before version 47 (see `GameState.evenDifficulty`). Old saves load with it. */
  evenDifficulty?: boolean;
  /** City-states ask for tribute as each raid sets out, of anyone, as before version 50 (see `GameState.eagerCityStates`). Old saves load with it. */
  eagerCityStates?: boolean;
  /** Only gifts of gold sway a leader, as before version 51 (see `GameState.plainGifts`). Old saves load with it. */
  plainGifts?: boolean;
  /** Strategic resources' squares add the shields of their specials, as before version 52 (see `GameState.resourceShields`). Old saves load with it. */
  resourceShields?: boolean;
  /** Only the units, improvements, advances and resources a save of this version knew (see `GameState.catalogue`). Saves before version 68 load with their version. */
  catalogue?: number;
  /** Fish feed a city without a fishery, as before version 54 (see `GameState.freeFish`). Old saves load with it. */
  freeFish?: boolean;
  /** Roads, irrigation and mines in the original's turns, as before version 56 (see `GameState.quickImprovements`). Old saves load with it. */
  quickImprovements?: boolean;
  /** The sea's 2 trade and a Harbour of food only, as before version 58 (see `GameState.richSea`). Old saves load with it. */
  richSea?: boolean;
  /** War Elephants keep off roadless mountains, as before version 59 (see `GameState.groundedElephants`). Old saves load with it. */
  groundedElephants?: boolean;
  /** A fishery on Fish adds no shield, as before version 60 (see `GameState.foodOnlyFishery`). Old saves load with it. */
  foodOnlyFishery?: boolean;
  /** City-states' raiders neither hunt nor pillage and fortify where they stop, as before version 63 (see `GameState.meekCityStates`). Old saves load with it. */
  meekCityStates?: boolean;
  /** City-states raise soldiers without end and send them out as they come, as before version 71 (see `GameState.swarmingCityStates`). Old saves load with it. */
  swarmingCityStates?: boolean;
  /**
   * Specials of a kind lie where the lattice and the deposits' rolls put them, however near each other, as before
   * version 57 (since, `spreadSpecials` keeps them `SPECIAL_SPACING` apart). Old saves load with it.
   */
  clusteredResources?: boolean;
  /** Only specials of one kind are kept apart, as before version 69 (since, any two: `spreadSpecials`). Old saves load with it. */
  crowdedResources?: boolean;
  /** Civilizations in the colours they had before version 72, eight to share (`CivRule.earlyColor`). Old saves load with it. */
  eightColors?: boolean;
  /** Rivals drawn whatever room their homelands leave, and starts kept only three squares apart, as before version 72. Old saves load with it. */
  crowdedHomelands?: boolean;
  /** The premade worlds as drawn before version 73 (`PremadeGrid.oldLands`). Old saves load with it. */
  oldLands?: boolean;
  /** Place city-states as the game begins (`placeCityStates`; since save version 45). Every new game in the app asks for them. */
  cityStates?: boolean;
}

/** A civilization's colour slot; a game of before version 72 has it in its colour of then. */
function civColorSlot(c: CivRule, eightColors = false): number {
  return colorSlot((eightColors ? c.earlyColor : undefined) ?? c.color);
}

/** A player for a civilization; its colour slot comes from the civilization, never the seat. */
function makePlayer(map: WorldMap, id: number, civId: string, isAi: boolean, eightColors = false): Player {
  const color = civColorSlot(civ(civId), eightColors);
  return {
    id,
    civ: civId,
    name: civ(civId).name,
    isAi,
    alive: true,
    color,
    explored: new Uint8Array(map.width * map.height),
    visible: new Uint8Array(map.width * map.height),
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

/** Homelands closer than this overlap: rivals were drawn from roomier ones first, before version 72. */
const HOMELAND_ROOM = 3;
/** Each rival is drawn from this many of those left with the most room from the homelands already in, so games still differ. */
const HOMELAND_CHOICE = 3;
/** Starts nudged off a crowded homeland keep at least this far apart. */
const START_SPACING = 3;
/** Starts nudged off a homeland too near another try for this far apart at Small, and as far again in proportion on a bigger world. */
const HOMELAND_SPACING = 6;
/** How far a start may be nudged off its homeland at Small, and in proportion on a bigger world. */
const HOMELAND_REACH = 8;
/** A start drawn at random moves up to this far onto the best city site near it (asked for 2026-10-23). */
const START_NUDGE = 2;
/** The least a site (`siteScore`) must come to for a start to be drawn on it on a premade world (asked for 2026-11-06). */
const START_WORTH = 95;

/**
 * The best city site (`siteScore`) within `START_NUDGE` of a start drawn at (x0, y0), on the same land and
 * passing `ok`; the square drawn when nothing near is better. No randomness: the seed's world stays.
 */
function siteNear(state: GameState, x0: number, y0: number, ok: (x: number, y: number) => boolean): [number, number] {
  const map = state.map;
  const land = map.tiles[y0 * map.width + x0]!.continent;
  let best: [number, number] = [x0, y0];
  let bestScore = siteScore(state, x0, y0) ?? -Infinity;
  for (let r = 1; r <= START_NUDGE; r++)
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const x = (((x0 + dx) % map.width) + map.width) % map.width;
        const y = y0 + dy;
        if (y < 0 || y >= map.height) continue;
        const t = map.tiles[y * map.width + x]!;
        if (t.terrain === Terrain.Ocean || t.continent !== land || !ok(x, y)) continue;
        const s = siteScore(state, x, y);
        // Nearer squares come first, so a square only as good as a nearer one never wins.
        if (s !== null && s > bestScore) { best = [x, y]; bestScore = s; }
      }
  return best;
}

function squareDist(map: WorldMap, a: readonly [number, number], b: readonly [number, number]): number {
  const dx = Math.abs(a[0] - b[0]);
  return Math.max(Math.min(dx, map.width - dx), Math.abs(a[1] - b[1]));
}

/** Civilizations with a homeland on the world, in roster order (barbarians never have one; every size has the same). */
export function nativeCivs(world: PremadeWorld): string[] {
  return CIVS.filter((c) => world.sizes.small.starts[c.id] !== undefined).map((c) => c.id);
}

/**
 * The square nearest a homeland that can take a city and is not crowding an
 * earlier start; the homeland itself unless a neighbour already sits there.
 */
function homelandStart(map: WorldMap, home: readonly [number, number], starts: [number, number][], crowded = false): [number, number] {
  const k = map.width / MAP_WIDTH;
  const spacing = crowded ? START_SPACING : Math.round(HOMELAND_SPACING * k);
  const reach = crowded ? HOMELAND_REACH : Math.round(HOMELAND_REACH * k);
  const fits = (x: number, y: number, strict: boolean, apart: number, land: number | null) => {
    if (y < 0 || y >= map.height) return false;
    const t = map.tiles[y * map.width + x]!;
    if (t.terrain === Terrain.Ocean || t.terrain === Terrain.Arctic || t.terrain === Terrain.Mountains) return false;
    if (land !== null && t.continent !== land) return false;
    if (strict && !(t.terrain === Terrain.Grassland || t.terrain === Terrain.Plains || t.terrain === Terrain.Hills || t.river)) return false;
    return starts.every((s) => squareDist(map, s, [x, y]) >= apart);
  };
  // A people stays on its own land if it can (the English in Britain), as far from the others as that land allows.
  const land = map.tiles[home[1] * map.width + home[0]]!.continent;
  for (const on of crowded || !land ? [null] : [land, null])
    for (let apart = spacing; apart >= START_SPACING; apart--)
      for (const strict of [true, false])
        for (let r = 0; r <= reach; r++)
          for (let dy = -r; dy <= r; dy++)
            for (let dx = -r; dx <= r; dx++) {
              if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
              const x = (((home[0] + dx) % map.width) + map.width) % map.width;
              const y = home[1] + dy;
              if (fits(x, y, strict, apart, on)) return [x, y];
            }
  return [home[0], home[1]];
}

export function newGame(seed: number, opts: NewGameOptions = {}): GameState {
  const rng = createRng(seed);
  const world = opts.world ? premadeWorld(opts.world) : undefined;
  const drawing = opts.joinedIslands ? "joinedIslands" : opts.oldLands ? "oldLands" : undefined;
  const map = opts.world ? premadeMap(rng, opts.world, opts.size, drawing, opts.resources, opts.catalogue) : generateMap(rng, opts);
  const homes = world && opts.historical ? premadeStarts(world, opts.size, drawing) : undefined;
  // The original's yields: shield grassland on its diagonal bands, and no other first special on grassland.
  if (!opts.freecivYields)
    map.tiles.forEach((t, i) => {
      if (grassShieldAt(i % map.width, Math.floor(i / map.width))) t.grassShield = true;
      if (t.terrain === Terrain.Grassland && t.special && !t.secondSpecial) t.special = false;
    });
  // Strategic resources lie in deposits besides the lattice's specials (rules/resources.ts).
  if (!opts.noResources) scatterDeposits(map, seed, opts.catalogue);
  // None of a kind near another (since version 57), no two of any kind near each other (since version 69).
  if (!opts.clusteredResources) spreadSpecials(map, seed, opts.crowdedResources);
  const humanCiv = opts.civ ?? "romans";
  const roster = opts.roster;
  const others = CIVS.filter((c) => c.id !== humanCiv && c.id !== "barbarians" && (!homes || homes[c.id] !== undefined) && (roster === undefined || (c.since ?? 0) <= roster));
  const opponents = Math.max(0, Math.min(others.length, opts.opponents ?? 2));
  const players: Player[] = [makePlayer(map, 0, humanCiv, opts.allAi === true, opts.eightColors)];
  for (let i = 0; i < opponents; i++) {
    // Every civilization in the game keeps its own colour: skip civs whose colour is taken.
    const takenColors = new Set(players.map((p) => p.color));
    let pool = others.filter((c) => !takenColors.has(civColorSlot(c, opts.eightColors)));
    if (!pool.length) break;
    // With homelands, prefer rivals that are not crowding a civilization already in.
    if (homes) {
      const taken = players.map((p) => homes[p.civ]).filter((h) => h !== undefined);
      if (opts.crowdedHomelands) {
        const roomy = pool.filter((c) => taken.every((h) => squareDist(map, h, homes[c.id]!) >= HOMELAND_ROOM));
        if (roomy.length) pool = roomy;
      } else {
        const room = (c: CivRule) => Math.min(...taken.map((h) => squareDist(map, h, homes[c.id]!)));
        pool = [...pool].sort((a, b) => room(b) - room(a)).slice(0, HOMELAND_CHOICE);
      }
    }
    const pick = pool[nextInt(rng, pool.length)]!;
    others.splice(others.indexOf(pick), 1);
    players.push(makePlayer(map, players.length, pick.id, true, opts.eightColors));
  }
  const barbarians = players.length;
  players.push(makePlayer(map, barbarians, "barbarians", true));

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
    ...(opts.narrowSight ? { narrowSight: true } : {}),
    ...(opts.cheapWonderBuy ? { cheapWonderBuy: true } : {}),
    ...(opts.simpleVeterans ? { simpleVeterans: true } : {}),
    ...(opts.fixedBorders ? { fixedBorders: true } : {}),
    ...(opts.accruedCulture ? { accruedCulture: true } : {}),
    ...(opts.peaceOnContact ? { peaceOnContact: true } : {}),
    ...(opts.workBeyondBorders ? { workBeyondBorders: true } : {}),
    ...(opts.simpleMoods ? { simpleMoods: true } : {}),
    ...(opts.resources !== undefined ? { resources: opts.resources } : {}),
    ...(opts.compoundingPenalty ? { compoundingPenalty: true } : {}),
    ...(opts.packedCities ? { packedCities: true } : {}),
    ...(opts.balancedWorkers ? { balancedWorkers: true } : {}),
    ...(opts.centrePenalty ? { centrePenalty: true } : {}),
    ...(opts.settlerShields ? { settlerShields: true } : {}),
    ...(opts.freecivYields ? { freecivYields: true } : {}),
    ...(opts.oceanColossus ? { oceanColossus: true } : {}),
    ...(opts.halvedCarryOver ? { halvedCarryOver: true } : {}),
    ...(opts.slowCulture ? { slowCulture: true } : {}),
    ...(opts.noInfluenceYields ? { noInfluenceYields: true } : {}),
    ...(opts.sizeFreeUnits ? { sizeFreeUnits: true } : {}),
    ...(opts.noResources ? { noResources: true } : {}),
    ...(opts.looseSettlers ? { looseSettlers: true } : {}),
    ...(opts.safeTriremes ? { safeTriremes: true } : {}),
    ...(opts.wideCapital ? { wideCapital: true } : {}),
    ...(opts.askOnEntry ? { askOnEntry: true } : {}),
    ...(opts.noGoodwill ? { noGoodwill: true } : {}),
    ...(opts.quietLeaders ? { quietLeaders: true } : {}),
    ...(opts.oldPlanner ? { oldPlanner: true } : {}),
    ...(opts.lastingUnits ? { lastingUnits: true } : {}),
    ...(opts.visibleResources ? { visibleResources: true } : {}),
    ...(opts.visibleCoal ? { visibleCoal: true } : {}),
    ...(opts.sellWhenBroke ? { sellWhenBroke: true } : {}),
    ...(opts.roadlessResources ? { roadlessResources: true } : {}),
    ...(opts.riverNeedsRoad ? { riverNeedsRoad: true } : {}),
    ...(opts.leftoverShields ? { leftoverShields: true } : {}),
    ...(opts.defaultBuilds ? { defaultBuilds: true } : {}),
    ...(opts.pickAfterUnits ? { pickAfterUnits: true } : {}),
    ...(opts.noReplacements ? { noReplacements: true } : {}),
    ...(opts.barredCaravans ? { barredCaravans: true } : {}),
    ...(opts.fedOnly ? { fedOnly: true } : {}),
    ...(opts.noTribes ? { noTribes: true } : {}),
    ...(opts.quickWork ? { quickWork: true } : {}),
    ...(opts.evenDifficulty ? { evenDifficulty: true } : {}),
    ...(opts.eagerCityStates ? { eagerCityStates: true } : {}),
    ...(opts.plainGifts ? { plainGifts: true } : {}),
    ...(opts.resourceShields ? { resourceShields: true } : {}),
    ...(opts.catalogue !== undefined ? { catalogue: opts.catalogue } : {}),
    ...(opts.freeFish ? { freeFish: true } : {}),
    ...(opts.quickImprovements ? { quickImprovements: true } : {}),
    ...(opts.richSea ? { richSea: true } : {}),
    ...(opts.groundedElephants ? { groundedElephants: true } : {}),
    ...(opts.foodOnlyFishery ? { foodOnlyFishery: true } : {}),
    ...(opts.meekCityStates ? { meekCityStates: true } : {}),
    ...(opts.swarmingCityStates ? { swarmingCityStates: true } : {}),
  };
  const difficulty = opts.difficulty ?? 2;
  for (const p of players) {
    p.difficulty = difficulty;
    p.gold = computerRule(state, p.id)?.gold ?? difficultyRule(difficulty).gold;
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

  // Starting positions: open land on decent continents, spread apart (further on a bigger world).
  const k = map.width / MAP_WIDTH;
  const sizes = new Map<number, number>();
  for (const t of map.tiles) if (t.terrain !== Terrain.Ocean) sizes.set(t.continent, (sizes.get(t.continent) ?? 0) + 1);
  let candidates: number[] = [];
  const margin = Math.round(6 * k);
  for (let y = margin; y < map.height - margin; y++)
    for (let x = 0; x < map.width; x++) {
      const t = map.tiles[y * map.width + x]!;
      if ((t.terrain === Terrain.Grassland || t.terrain === Terrain.Plains) && (sizes.get(t.continent) ?? 0) >= 40 * k * k)
        candidates.push(y * map.width + x);
    }
  // A premade world's deserts are as real as its farmland, and a lone plains square in the Empty Quarter is no place to begin.
  if (opts.world && !opts.oldLands) {
    const worth = candidates.filter((i) => (siteScore(state, i % map.width, Math.floor(i / map.width)) ?? 0) >= START_WORTH);
    if (worth.length) candidates = worth;
  }
  const starts: [number, number][] = [];
  // The squares drawn, before any moved onto a better site: they keep the draws as they always were.
  const drawn: [number, number][] = [];
  const far = (x: number, y: number) =>
    drawn.every(([sx, sy]) => Math.max(Math.min(Math.abs(sx - x), map.width - Math.abs(sx - x)), Math.abs(sy - y)) >= 10 * k);
  for (const p of players) {
    if (p.id === barbarians) continue;
    let sx = 0;
    let sy = map.height >> 1;
    const home = homes?.[p.civ];
    if (home) [sx, sy] = homelandStart(map, home, starts, opts.crowdedHomelands);
    else
      for (let tries = 0; tries < 200 && candidates.length; tries++) {
        const pick = candidates[nextInt(rng, candidates.length)]!;
        const x = pick % map.width;
        const y = Math.floor(pick / map.width);
        if (tries === 199 || far(x, y)) { sx = x; sy = y; break; }
      }
    drawn.push([sx, sy]);
    // A drawn start moves onto the best site near it, clear of the other starts (a homeland stays).
    if (!home && !opts.randomStarts && candidates.length)
      [sx, sy] = siteNear(state, sx, sy, (x, y) => starts.every((o) => squareDist(map, o, [x, y]) >= START_SPACING));
    starts.push([sx, sy]);
    const settlers = p.isAi ? 2 : difficultyRule(difficulty).settlers;
    for (let i = 0; i < settlers; i++) createUnit(state, "settlers", p.id, sx, sy);
    recomputeVisibility(state, p.id);
    p.explored.set(p.visible);
  }
  // City-states, so no civilization starts alone on its land.
  if (opts.cityStates) placeCityStates(state, starts);
  selectNextUnit(state, null);
  return state;
}

export { turnToYear, formatYear } from "./calendar.js";
