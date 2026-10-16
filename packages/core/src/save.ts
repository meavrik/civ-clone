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
  version: 1;
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

export const SAVE_VERSION = 1;

export function makeSave(state: GameState, options: NewGameOptions, log: Command[], label?: string): SaveGame {
  const s: SaveGame = {
    version: 1,
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
export function loadSave(save: SaveGame, aiTurn: (state: GameState) => void): { state: GameState; log: Command[] } {
  if (save.version !== SAVE_VERSION) throw new Error(`unsupported save version ${save.version}`);
  const state = newGame(save.seed, save.options);
  const log: Command[] = [];
  for (const cmd of save.log) {
    const r = applyCommand(state, cmd);
    if (!r.ok) throw new Error(`replay diverged at command ${log.length}: ${r.reason}`);
    log.push(cmd);
    if (cmd.type === "endTurn") runAiPlayers(state, aiTurn);
  }
  // No human seat: nothing is logged, so play the recorded number of rounds.
  if (save.options.allAi) {
    let guard = 0;
    while (state.turn < save.turn && guard++ < 10000) runAiPlayers(state, aiTurn);
  }
  return { state, log };
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
