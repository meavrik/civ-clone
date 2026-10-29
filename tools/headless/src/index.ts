import { aiTurn, baselineTurn, plannerTurn, plannerV2Turn } from "@civ/ai";
import {
  computeScore,
  getTile,
  lastTurnEvents,
  loadSave,
  makeSave,
  newGame,
  runAiPlayers,
  unitType,
  type GameState,
  type NewGameOptions,
  type SaveGame,
  type WorldSize,
} from "@civ/core";

/**
 * Headless tournament harness: runs seeded all-AI games through the same
 * `applyCommand`/`runAiPlayers` path the browser uses, sampling per-civ
 * statistics along the way. Each seat can be given a different AI so
 * variants can be pitted against each other; the barbarians always use the
 * baseline.
 */
export type AiFn = (state: GameState) => void;

/** Named AI variants a seat can be given. */
export const AIS: Record<string, AiFn> = {
  baseline: baselineTurn,
  v2: plannerV2Turn,
  planner: plannerTurn,
};

export interface GameConfig {
  seed: number;
  /** Civilizations in the game, all AI-driven (2..8). */
  civs: number;
  /** 0 Chieftain .. 4 Emperor. */
  difficulty: number;
  /** Stop after this many rounds unless someone conquers the world first. */
  turns: number;
  /** AI name per seat, cycled over the civs. */
  ais: string[];
  /** Sample statistics every N turns (0 = final only). */
  every: number;
  /** Premade world id; a generated world when absent. */
  world?: string;
  /** World size (WORLD_SIZES); the original's 80x50 when absent. */
  size?: WorldSize;
  /** On a premade world, civilizations start in their historical homelands. */
  historical?: boolean;
  /** The 1991 terrain rules (no roads needed for wheels, no attrition), to measure the difference. */
  classicTerrain?: boolean;
  /** Mountains take every land unit, as before only settlers climbed them off the road. */
  openMountains?: boolean;
  /** The 1991 civilizations, all alike (no traits or starting advances), to measure the difference. */
  classicCivs?: boolean;
  /** Our first unit upkeep (3 free units a city under Monarchy and Communism, debts from the shield box). */
  looseUpkeep?: boolean;
  /** Cities work all 21 squares, inside their border or not (saves before version 16). */
  workBeyondBorders?: boolean;
  /** Our first moods: no celebrations, martial law capped at three, no Democracy toppled by riots (saves before version 17). */
  simpleMoods?: boolean;
  /** The planner founds cities wherever the rules allow, not only well apart (saves before version 22). */
  packedCities?: boolean;
  /** Our support before version 24: the city's own square suffers Despotism's -1 and settlers pay shields. */
  oldSupport?: boolean;
  /** Starts on the squares drawn, before they moved onto good sites (saves before version 25). */
  randomStarts?: boolean;
  /** FreeCiv's civ1 yields, before the original's (saves before version 26). */
  freecivYields?: boolean;
  /** The Colossus on ocean squares only, workers placed by bare yields (saves before version 27). */
  oceanColossus?: boolean;
  /** A finished improvement's leftover shields halved for the next one (saves before version 28). */
  halvedCarryOver?: boolean;
  /** Borders growing at the first culture levels, radius 2 at 8 (saves before version 28). */
  slowCulture?: boolean;
  /** No trade from specials beyond a city's worked squares (saves before version 28). */
  noInfluenceYields?: boolean;
  /** Free units by city size under Despotism, settlers free of shields (saves before version 29). */
  sizeFreeUnits?: boolean;
  /** Sight round units and next to cities only (`GameState.narrowSight`). */
  narrowSight?: boolean;
  /** Wonders bought at an improvement.s price (`GameState.cheapWonderBuy`). */
  cheapWonderBuy?: boolean;
  /** One veteran rank won by a coin toss, no experience (`GameState.simpleVeterans`). */
  simpleVeterans?: boolean;
  /** No strategic resources or deposits: units built from their advance alone (`GameState.noResources`). */
  noResources?: boolean;
  /** Settlers fortify and found cities two squares apart (`GameState.looseSettlers`). */
  looseSettlers?: boolean;
  /** Triremes sail deep water unharmed (`GameState.safeTriremes`). */
  safeTriremes?: boolean;
  /** The palace gives the capital its 21 squares at once (`GameState.wideCapital`). */
  wideCapital?: boolean;
  /** The planner AI's habits before version 38 (`GameState.oldPlanner`). */
  oldPlanner?: boolean;
  /** No unit retires (`GameState.lastingUnits`). */
  lastingUnits?: boolean;
  /** Every civ sees every strategic resource from the start (`GameState.visibleResources`). */
  visibleResources?: boolean;
  /** A dry treasury sells a city's costliest building (`GameState.sellWhenBroke`). */
  sellWhenBroke?: boolean;
  /** A strategic resource serves without a road on its square (`GameState.roadlessResources`). */
  roadlessResources?: boolean;
  /** City-states placed as the game begins (`NewGameOptions.cityStates`). */
  cityStates?: boolean;
}

export interface PlayerStats {
  id: number;
  civ: string;
  ai: string;
  alive: boolean;
  cities: number;
  /** Sum of city sizes. */
  pop: number;
  units: number;
  /** Units with an attack value. */
  military: number;
  settlers: number;
  techs: number;
  gold: number;
  government: string;
  score: number;
  /** Explored tiles. */
  explored: number;
  /** Cities on a continent other than the capital's (settled or taken overseas). */
  overseas: number;
  /** Cities this civ captured or razed so far, and cities it lost. */
  captured: number;
  lost: number;
}

/** Running tallies a game keeps per civ: conquests come from the turn events, which every end of turn clears. */
export interface Tallies { captured: number[]; lost: number[] }

export interface Sample {
  turn: number;
  players: PlayerStats[];
}

export interface GameResult {
  seed: number;
  config: GameConfig;
  /** Rounds actually played. */
  turns: number;
  end: "conquest" | "space" | "turns";
  /** Sole survivor, or the top scorer at the turn limit. */
  winner: number | null;
  players: PlayerStats[];
  samples: Sample[];
  ms: number;
  /** Fingerprint of the final state, for determinism checks. */
  digest: string;
  save: SaveGame;
}

export function defaultConfig(seed: number, over: Partial<GameConfig> = {}): GameConfig {
  return { seed, civs: 4, difficulty: 2, turns: 200, ais: ["planner"], every: 0, ...over };
}

/** AI name seated at each civ slot (barbarians excluded). */
export function seatAis(config: GameConfig): string[] {
  const out: string[] = [];
  for (let i = 0; i < config.civs; i++) out.push(config.ais[i % config.ais.length] ?? "planner");
  return out;
}

/** One AI function that dispatches on whose turn it is. */
export function makeRouter(config: GameConfig): AiFn {
  const seats = seatAis(config).map((name) => {
    const fn = AIS[name];
    if (!fn) throw new Error(`unknown AI "${name}" (known: ${Object.keys(AIS).join(", ")})`);
    return fn;
  });
  return (state) => (state.currentPlayer === state.barbarians ? aiTurn : seats[state.currentPlayer] ?? aiTurn)(state);
}

export function gameOptions(config: GameConfig): NewGameOptions {
  return {
    allAi: true,
    opponents: Math.max(1, Math.min(7, config.civs - 1)),
    difficulty: config.difficulty,
    ...(config.world ? { world: config.world, historical: config.historical === true } : {}),
    ...(config.size ? { size: config.size } : {}),
    ...(config.classicTerrain ? { classicTerrain: true } : {}),
    ...(config.openMountains ? { openMountains: true } : {}),
    ...(config.classicCivs ? { classicCivs: true } : {}),
    ...(config.looseUpkeep ? { looseUpkeep: true } : {}),
    ...(config.workBeyondBorders ? { workBeyondBorders: true } : {}),
    ...(config.simpleMoods ? { simpleMoods: true } : {}),
    ...(config.packedCities ? { packedCities: true } : {}),
    ...(config.oldSupport ? { centrePenalty: true, settlerShields: true } : {}),
    ...(config.randomStarts ? { randomStarts: true } : {}),
    ...(config.freecivYields ? { freecivYields: true } : {}),
    ...(config.oceanColossus ? { oceanColossus: true } : {}),
    ...(config.halvedCarryOver ? { halvedCarryOver: true } : {}),
    ...(config.slowCulture ? { slowCulture: true } : {}),
    ...(config.noInfluenceYields ? { noInfluenceYields: true } : {}),
    ...(config.sizeFreeUnits ? { sizeFreeUnits: true } : {}),
    ...(config.narrowSight ? { narrowSight: true } : {}),
    ...(config.cheapWonderBuy ? { cheapWonderBuy: true } : {}),
    ...(config.simpleVeterans ? { simpleVeterans: true } : {}),
    ...(config.noResources ? { noResources: true } : {}),
    ...(config.looseSettlers ? { looseSettlers: true } : {}),
    ...(config.safeTriremes ? { safeTriremes: true } : {}),
    ...(config.wideCapital ? { wideCapital: true } : {}),
    ...(config.oldPlanner ? { oldPlanner: true } : {}),
    ...(config.lastingUnits ? { lastingUnits: true } : {}),
    ...(config.visibleResources ? { visibleResources: true } : {}),
    ...(config.sellWhenBroke ? { sellWhenBroke: true } : {}),
    ...(config.roadlessResources ? { roadlessResources: true } : {}),
    ...(config.cityStates ? { cityStates: true } : {}),
  };
}

export function playerStats(state: GameState, id: number, ai: string, tallies?: Tallies): PlayerStats {
  const p = state.players[id]!;
  let cities = 0;
  let pop = 0;
  const mine = state.cities.filter((c) => c.owner === id);
  const capital = mine.find((c) => c.buildings.includes("palace")) ?? mine[0];
  const home = capital ? getTile(state.map, capital.x, capital.y)!.continent : -1;
  let overseas = 0;
  for (const c of mine) {
    cities++;
    pop += c.size;
    if (getTile(state.map, c.x, c.y)!.continent !== home) overseas++;
  }
  let units = 0;
  let military = 0;
  let settlers = 0;
  for (const u of state.units) {
    if (u.owner !== id) continue;
    units++;
    const t = unitType(u.type);
    if (t.attack > 0) military++;
    if (t.flags?.includes("settler")) settlers++;
  }
  let explored = 0;
  for (let i = 0; i < p.explored.length; i++) if (p.explored[i]) explored++;
  return {
    id,
    civ: p.name,
    ai,
    alive: p.alive,
    cities,
    pop,
    units,
    military,
    settlers,
    techs: p.advances.length,
    gold: p.gold,
    government: p.government,
    score: p.alive ? computeScore(state, id).total : 0,
    explored,
    overseas,
    captured: tallies?.captured[id] ?? 0,
    lost: tallies?.lost[id] ?? 0,
  };
}

export function sample(state: GameState, config: GameConfig, tallies?: Tallies): Sample {
  const seats = seatAis(config);
  const players: PlayerStats[] = [];
  for (const p of state.players) if (p.id !== state.barbarians) players.push(playerStats(state, p.id, seats[p.id] ?? "baseline", tallies));
  return { turn: state.turn, players };
}

function aliveCivs(state: GameState): number[] {
  return state.players.filter((p) => p.alive && p.id !== state.barbarians).map((p) => p.id);
}

/** FNV-1a over the parts of the state a replay must reproduce. */
export function digest(state: GameState): string {
  const players = state.players.map((p) => {
    const { explored, visible, ...rest } = p;
    let seen = 0;
    for (let i = 0; i < explored.length; i++) if (explored[i]) seen++;
    void visible;
    return { ...rest, seen };
  });
  const text = JSON.stringify({
    turn: state.turn,
    rng: state.rng.s,
    currentPlayer: state.currentPlayer,
    nextUnitId: state.nextUnitId,
    nextCityId: state.nextCityId,
    units: state.units,
    cities: state.cities,
    players,
    relations: state.relations,
    tiles: state.map.tiles.map((t) => (t.terrain << 4) | (+t.road << 3) | (+t.irrigation << 2) | (+t.mine << 1) | +t.hut),
  });
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

/** Play one game to the turn limit or conquest. `onSample` fires at every sample point. */
export function runGame(config: GameConfig, onSample?: (s: Sample) => void): GameResult {
  const options = gameOptions(config);
  const route = makeRouter(config);
  const state = newGame(config.seed, options);
  // Count conquests as they happen: each AI's own captures are in the events of its turn.
  const tallies: Tallies = { captured: state.players.map(() => 0), lost: state.players.map(() => 0) };
  const router: AiFn = (s) => {
    const me = s.currentPlayer;
    const from = lastTurnEvents.length;
    route(s);
    for (const ev of lastTurnEvents.slice(from)) {
      if (ev.kind !== "cityCaptured" && ev.kind !== "cityLost") continue;
      tallies.captured[me] = (tallies.captured[me] ?? 0) + 1;
      tallies.lost[ev.player] = (tallies.lost[ev.player] ?? 0) + 1;
    }
  };
  const samples: Sample[] = [];
  const t0 = performance.now();
  let end: GameResult["end"] = "turns";
  while (state.turn < config.turns) {
    runAiPlayers(state, router);
    if (config.every > 0 && state.turn % config.every === 0 && state.turn < config.turns) {
      const s = sample(state, config, tallies);
      samples.push(s);
      onSample?.(s);
    }
    if (aliveCivs(state).length <= 1) { end = "conquest"; break; }
    if (state.players.some((p) => p.spaceship.arrived)) { end = "space"; break; }
  }
  const final = sample(state, config, tallies);
  samples.push(final);
  onSample?.(final);
  const alive = final.players.filter((p) => p.alive);
  let winner: number | null = null;
  if (end === "conquest") winner = alive[0]?.id ?? null;
  else if (end === "space") winner = state.players.find((p) => p.spaceship.arrived)?.id ?? null;
  else if (alive.length) winner = alive.reduce((a, b) => (b.score > a.score ? b : a)).id;
  return {
    seed: config.seed,
    config,
    turns: state.turn,
    end,
    winner,
    players: final.players,
    samples,
    ms: Math.round(performance.now() - t0),
    digest: digest(state),
    save: makeSave(state, options, [], `headless ${config.seed}`),
  };
}

/** Replay the game's save through `loadSave` and confirm it lands on the same state. */
export function replayMatches(result: GameResult): boolean {
  const { state } = loadSave(result.save, makeRouter(result.config));
  return digest(state) === result.digest;
}
