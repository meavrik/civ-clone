import { applyCommand, type Command } from "./commands.js";
import { newGame, type NewGameOptions } from "./game.js";
import type { GameState } from "./types.js";

/**
 * A save is the game's recipe: the seed, the setup options and every command
 * issued since. Replaying them through the same engine rebuilds an identical
 * state (the RNG is part of the state, so AI and combat rolls come out the
 * same). This keeps saves tiny and doubles as the replay format for the AI
 * tournament harness. The game's own saves carry its state as well
 * (`withSnapshot`), so they load at once (`loadSnapshot`); the recipe stays
 * their truth, for old saves, rewinds and checks.
 */
export interface SaveGame {
  /**
   * 1: saved before units had hit points; such a game replays with classic combat.
   * 2: saved before wheeled units needed roads over rough ground and harsh ground wore units down; classic terrain.
   * 3: saved before barbarians came with leaders and boats, rose inland and held cities (simple barbarians),
   *    and while zones of control still held soldiers stepping off ships.
   * 4: saved before civilizations had traits and starting advances; classic civilizations.
   * 5: saved before generated worlds took their terrain from the climate; scattered terrain.
   * 6: saved before only settlers climbed mountains off the road; open mountains.
   * 7: saved before units cost upkeep as in the original (free units only up to a city's size under
   *    Despotism and Anarchy, units disbanded as soon as their city cannot pay); loose upkeep.
   * 8: saved before the extended tech tree (Weaving, Animal Husbandry, the modern advances); the
   *    1991 tree.
   * 9: saved before civilizations met face to face (the meeting unit stops, cities see round them)
   *    and minded foreign units on their land; far contact, no trespass.
   * 10: saved before the Hebrews and the Japanese; rivals drawn from the eighteen before them.
   * 11: saved before borders grew with culture; fixed borders (each city the 21 squares it works).
   * 12: saved before premade worlds kept their landmasses apart; joined islands (Britain touching France).
   * 13: saved while a city's culture mounted every turn; accrued culture.
   * 14: saved while civilizations made peace the moment they met; peace on contact.
   * 15: saved while cities worked squares beyond their border; work beyond borders.
   * 16: saved before cities celebrated, martial law went past three units, riots toppled a Democracy
   *     and the empire's size counted by government (simple moods), and while every terrain had one
   *     kind of special (`resources` 16: no second specials).
   * 17: on main, saved with the moods but before second specials (`resources` 16). The terrain-tiles-test
   *     branch used 17 to 19 for its resource steps while its moods were still simple: 17 saved before
   *     wine, silk, furs, ivory, spices and fruit (`resources` 17: whales, cotton, wheat, iron and oil
   *     only; a 17 is taken as main's), 18 while fish and whales lay anywhere at sea (`resources` 18: no
   *     `within`/`beyond`), 19 with every resource.
   * 20: saved while every change of production kind halved the box again, even a change back; compounding penalty.
   * 21: saved while the AI founded cities wherever the rules allowed; packed cities.
   * 22: saved before cities had a focus (the player's working for growth); balanced workers.
   * 23: saved while Despotism's -1 reached the city's own square and settlers paid shields; centre penalty, settler shields.
   * 24: saved while every civilization started on the square drawn for it; random starts.
   * 25: saved with FreeCiv's civ1 yields (scattered grassland Resources, roads trading on rivers, a city
   *     square's free shield, nothing mined into forest); freeciv yields.
   * 26: saved while the Colossus helped only ocean squares and workers were placed by bare yields; ocean colossus.
   * 29: saved while a civilization saw round its units and next to its cities only, and every scout one square out; narrow sight.
   * 31: saved while a unit's one rank, the veteran, came by a coin toss after a fight won; simple veterans.
   * 32: saved before units needed strategic resources and the world held their deposits; no resources.
   * 35: saved while the palace's culture gave the capital its 21 squares the day it was founded; wide capital.
   * 36: saved while stepping onto foreign land was the first demand to leave, and gifts swayed no one; ask on entry, no goodwill.
   * 37: saved while computer leaders asked nothing of the player (no tribute, gifts or resource requests), and the
   *     planner AI kept its habits from before it was retuned to the rules as they stand; quiet leaders, old planner.
   */
  version: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20 | 21 | 22 | 23 | 24 | 25 | 26 | 27 | 28 | 29 | 30 | 31 | 32 | 33 | 34 | 35 | 36 | 37 | 38 | 39 | 40;
  seed: number;
  options: NewGameOptions;
  log: Command[];
  /** Informational only: shown in the load menu. */
  savedAt: number;
  /**
   * Turn reached. Informational for games with a human seat; for an
   * `allAi` game (empty log) it says how many rounds to replay.
   */
  turn: number;
  civ: string;
  label?: string;
  /**
   * The game as it stood when saved (`withSnapshot`; asked for 2026-10-28: loading replayed the whole log,
   * every computer player's turn too, 2.5 s at turn 150 with seven civilizations and growing): a deep copy
   * of the state, loaded as it is (`loadSnapshot`, a few milliseconds) by the same version only, the rules
   * and the state's shape as they were. The browser's store keeps it (typed arrays and all); `serializeSave`
   * and `rewindSave` leave it out.
   */
  state?: GameState;
}

export const SAVE_VERSION = 40;

export function makeSave(state: GameState, options: NewGameOptions, log: Command[], label?: string): SaveGame {
  const s: SaveGame = {
    version: SAVE_VERSION,
    seed: state.seed,
    options,
    log: [...log],
    savedAt: Date.now(),
    turn: state.turn,
    civ: state.players[0]!.civ,
  };
  if (label) s.label = label;
  return s;
}

/** A game rebuilt from its save. */
export interface LoadedGame {
  state: GameState;
  log: Command[];
  options: NewGameOptions;
}

/** How far a replay has come: the turn it has reached, between the turn the game began on and the one it was saved on. */
export interface ReplayProgress {
  turn: number;
  from: number;
  to: number;
}

/** A save that carries the game as it stands (`SaveGame.state`), copied now, so later play cannot change it. */
export function withSnapshot(save: SaveGame, state: GameState): SaveGame {
  return { ...save, state: copyState(state) };
}

/**
 * The game straight from its save's snapshot, without replaying: only from a save of this version (older ones
 * replay with their older rules) whose snapshot is the turn it says; else null, and the save replays.
 */
export function loadSnapshot(save: SaveGame): LoadedGame | null {
  const s = save.state;
  if (!s || save.version !== SAVE_VERSION || s.seed !== save.seed || s.turn !== save.turn) return null;
  return { state: copyState(s), log: [...save.log], options: { ...save.options } };
}

/** A deep copy of the game's state: plain objects, arrays and typed arrays are all it holds. */
export function copyState(state: GameState): GameState {
  return copyData(state);
}

function copyData<T>(v: T): T {
  if (v === null || typeof v !== "object") return v;
  if (ArrayBuffer.isView(v)) return (v as unknown as Uint8Array).slice() as unknown as T;
  if (Array.isArray(v)) return v.map(copyData) as unknown as T;
  const out: Record<string, unknown> = {};
  for (const [k, x] of Object.entries(v)) out[k] = copyData(x);
  return out as T;
}

/**
 * Rebuild a game from a save by replaying its log (never its snapshot: this is the check that the log
 * rebuilds the game). `aiTurn` is injected so core stays free of the AI package; it runs whenever the
 * replayed log hands the turn to an AI.
 */
export function loadSave(save: SaveGame, aiTurn: (state: GameState) => void): LoadedGame {
  const replay = replaySave(save, aiTurn);
  for (;;) {
    const step = replay.next();
    if (step.done) return step.value;
  }
}

/**
 * `loadSave` a step at a time, for a screen that shows how far it has come (asked for 2026-10-28:
 * Continue hung for seconds, every turn of the game and its computer players' turns replayed at
 * once): it yields once the world is made, then after each command of the log (an end of turn with
 * the computer players' turns after it), and returns the game.
 */
export function* replaySave(save: SaveGame, aiTurn: (state: GameState) => void): Generator<ReplayProgress, LoadedGame, void> {
  if (![1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, SAVE_VERSION].includes(save.version)) throw new Error(`unsupported save version ${save.version}`);
  // Older games were played under older rules (one-roll fights, open terrain, simple barbarians, alike civilizations) on older maps; they must replay the same way.
  const options: NewGameOptions = { ...save.options };
  if (save.version < 2) options.classicCombat = true;
  if (save.version < 3) options.classicTerrain = true;
  if (save.version < 4) {
    options.simpleBarbarians = true;
    options.zocAtSea = true;
  }
  if (save.version < 5) options.classicCivs = true;
  if (save.version < 6) options.scatteredTerrain = true;
  if (save.version < 7) options.openMountains = true;
  if (save.version < 8) options.looseUpkeep = true;
  if (save.version < 9) options.classicAdvances = true;
  if (save.version < 10) {
    options.farContact = true;
    options.noTrespass = true;
  }
  if (save.version < 11) options.roster = 10;
  if (save.version < 12) options.fixedBorders = true;
  if (save.version < 13 && options.world) options.joinedIslands = true;
  if (save.version < 14) options.accruedCulture = true;
  if (save.version < 15) options.peaceOnContact = true;
  if (save.version < 16) options.workBeyondBorders = true;
  // 18 and 19 were the terrain-tiles-test branch's, saved while its moods were still simple.
  if (save.version < 17 || save.version === 18 || save.version === 19) options.simpleMoods = true;
  // A 17 is taken as main's: second specials came to main only with 20.
  if (save.version < 20) options.resources = save.version === 17 ? 16 : save.version;
  if (save.version < 21) options.compoundingPenalty = true;
  // The computer players' turns replay from the AI, so its older habits must come back with an older save.
  if (save.version < 22) options.packedCities = true;
  if (save.version < 23) options.balancedWorkers = true;
  if (save.version < 24) {
    options.centrePenalty = true;
    options.settlerShields = true;
  }
  if (save.version < 25) options.randomStarts = true;
  if (save.version < 26) options.freecivYields = true;
  if (save.version < 27) options.oceanColossus = true;
  if (save.version < 28) {
    options.halvedCarryOver = true;
    options.slowCulture = true;
    options.noInfluenceYields = true;
  }
  if (save.version < 29) options.sizeFreeUnits = true;
  if (save.version < 30) options.narrowSight = true;
  if (save.version < 31) options.cheapWonderBuy = true;
  if (save.version < 32) options.simpleVeterans = true;
  if (save.version < 33) options.noResources = true;
  if (save.version < 34) options.looseSettlers = true;
  if (save.version < 35) options.safeTriremes = true;
  if (save.version < 36) options.wideCapital = true;
  if (save.version < 37) {
    options.askOnEntry = true;
    options.noGoodwill = true;
  }
  if (save.version < 38) {
    options.quietLeaders = true;
    options.oldPlanner = true;
  }
  if (save.version < 39) options.lastingUnits = true;
  if (save.version < 40) options.visibleResources = true;
  const state = newGame(save.seed, options);
  const from = state.turn;
  const progress = (): ReplayProgress => ({ turn: state.turn, from, to: Math.max(from, save.turn) });
  yield progress();
  const log: Command[] = [];
  for (const cmd of save.log) {
    const r = applyCommand(state, cmd);
    if (!r.ok) throw new Error(`replay diverged at command ${log.length}: ${r.reason}`);
    log.push(cmd);
    if (cmd.type === "endTurn") runAiPlayers(state, aiTurn);
    yield progress();
  }
  // No human seat: nothing is logged, so play the recorded number of rounds.
  if (options.allAi) {
    let guard = 0;
    while (state.turn < save.turn && guard++ < 10000) {
      runAiPlayers(state, aiTurn);
      yield progress();
    }
  }
  return { state, log, options };
}

/**
 * Where each turn began in a save's log: at the start, then after each of the
 * player's end-of-turn commands (the computer players' turns replay from the
 * seed and are not logged, so every one of those ends a round).
 */
export function turnStarts(save: SaveGame): { turn: number; length: number }[] {
  const ends = save.log.flatMap((c, i) => (c.type === "endTurn" ? [i + 1] : []));
  const first = save.turn - ends.length;
  return [{ turn: first, length: 0 }, ...ends.map((length, k) => ({ turn: first + k + 1, length }))];
}

/** The save as it stood when `turn` began, its log cut back to there; null if it never saw that turn begin. */
export function rewindSave(save: SaveGame, turn: number): SaveGame | null {
  const at = turnStarts(save).find((t) => t.turn === turn);
  if (!at) return null;
  const { state: _later, ...rest } = save;
  return { ...rest, log: save.log.slice(0, at.length), turn };
}

/**
 * Advance through AI players until a human's turn comes up or a full round
 * has been played (the turn counter moved on), whichever is first. With a
 * human seat the two coincide; in an all-AI game one call is one round.
 */
export function runAiPlayers(state: GameState, aiTurn: (state: GameState) => void): void {
  const turn = state.turn;
  let guard = 0;
  while (state.players[state.currentPlayer]!.isAi && state.turn === turn && guard++ < 64) {
    aiTurn(state);
    applyCommand(state, { type: "endTurn" });
  }
}

/** A save as JSON: its recipe; the snapshot stays in the browser's store (JSON would mangle its typed arrays). */
export function serializeSave(save: SaveGame): string {
  const { state: _snapshot, ...recipe } = save;
  return JSON.stringify(recipe);
}

export function parseSave(text: string): SaveGame {
  const s = JSON.parse(text) as SaveGame;
  if (typeof s.seed !== "number" || !Array.isArray(s.log)) throw new Error("not a save file");
  return s;
}
