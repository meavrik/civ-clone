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
   */
  version: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20 | 21 | 22 | 23 | 24 | 25 | 26 | 27 | 28;
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

export const SAVE_VERSION = 28;

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
  if (![1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, SAVE_VERSION].includes(save.version)) throw new Error(`unsupported save version ${save.version}`);
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
  return at ? { ...save, log: save.log.slice(0, at.length), turn } : null;
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
