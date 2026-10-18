import { applyCommand, type Command } from "./commands.js";
import { newGame, type NewGameOptions } from "./game.js";
import type { GameState } from "./types.js";

/**
 * A save is the game's recipe, not its state: the seed, the setup options
 * and every command issued since. Replaying them through the same engine
 * rebuilds an identical state (the RNG is part of the state, so AI and
 * combat rolls come out the same). This keeps saves tiny and doubles as the
 * replay format for the AI tournament harness.
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
   */
  version: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
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
}

export const SAVE_VERSION = 8;

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

/**
 * Rebuild a game from a save. `aiTurn` is injected so core stays free of the
 * AI package; it runs whenever the replayed log hands the turn to an AI.
 */
export function loadSave(save: SaveGame, aiTurn: (state: GameState) => void): { state: GameState; log: Command[]; options: NewGameOptions } {
  if (![1, 2, 3, 4, 5, 6, 7, SAVE_VERSION].includes(save.version)) throw new Error(`unsupported save version ${save.version}`);
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
  const state = newGame(save.seed, options);
  const log: Command[] = [];
  for (const cmd of save.log) {
    const r = applyCommand(state, cmd);
    if (!r.ok) throw new Error(`replay diverged at command ${log.length}: ${r.reason}`);
    log.push(cmd);
    if (cmd.type === "endTurn") runAiPlayers(state, aiTurn);
  }
  // No human seat: nothing is logged, so play the recorded number of rounds.
  if (options.allAi) {
    let guard = 0;
    while (state.turn < save.turn && guard++ < 10000) runAiPlayers(state, aiTurn);
  }
  return { state, log, options };
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

export function serializeSave(save: SaveGame): string {
  return JSON.stringify(save);
}

export function parseSave(text: string): SaveGame {
  const s = JSON.parse(text) as SaveGame;
  if (typeof s.seed !== "number" || !Array.isArray(s.log)) throw new Error("not a save file");
  return s;
}
