import { aiTurn, baselineTurn, plannerTurn } from "@civ/ai";
import {
  computeScore,
  loadSave,
  makeSave,
  newGame,
  runAiPlayers,
  unitType,
  type GameState,
  type NewGameOptions,
  type SaveGame,
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
}

export interface Sample {
  turn: number;
  players: PlayerStats[];
}

export interface GameResult {
  seed: number;
  config: GameConfig;
  /** Rounds actually played. */
  turns: number;
  end: "conquest" | "turns";
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
  return { seed, civs: 4, difficulty: 2, turns: 200, ais: ["baseline"], every: 0, ...over };
}

/** AI name seated at each civ slot (barbarians excluded). */
export function seatAis(config: GameConfig): string[] {
  const out: string[] = [];
  for (let i = 0; i < config.civs; i++) out.push(config.ais[i % config.ais.length] ?? "baseline");
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
  return { allAi: true, opponents: Math.max(1, Math.min(7, config.civs - 1)), difficulty: config.difficulty };
}

export function playerStats(state: GameState, id: number, ai: string): PlayerStats {
  const p = state.players[id]!;
  let cities = 0;
  let pop = 0;
  for (const c of state.cities) if (c.owner === id) { cities++; pop += c.size; }
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
  };
}

export function sample(state: GameState, config: GameConfig): Sample {
  const seats = seatAis(config);
  const players: PlayerStats[] = [];
  for (const p of state.players) if (p.id !== state.barbarians) players.push(playerStats(state, p.id, seats[p.id] ?? "baseline"));
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
  const router = makeRouter(config);
  const state = newGame(config.seed, options);
  const samples: Sample[] = [];
  const t0 = performance.now();
  let end: GameResult["end"] = "turns";
  while (state.turn < config.turns) {
    runAiPlayers(state, router);
    if (config.every > 0 && state.turn % config.every === 0 && state.turn < config.turns) {
      const s = sample(state, config);
      samples.push(s);
      onSample?.(s);
    }
    if (aliveCivs(state).length <= 1) { end = "conquest"; break; }
  }
  const final = sample(state, config);
  samples.push(final);
  onSample?.(final);
  const alive = final.players.filter((p) => p.alive);
  let winner: number | null = null;
  if (end === "conquest") winner = alive[0]?.id ?? null;
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
