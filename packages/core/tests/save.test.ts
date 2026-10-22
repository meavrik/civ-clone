import { describe, expect, it } from "vitest";
import { applyCommand, checkGameEnd, computeScore, loadSave, makeSave, newGame, parseSave, rankTitle, rewindSave, serializeSave, turnStarts, type Command } from "../src/index.js";

/** Trivial stand-in for the AI: skip every unit. */
function skipAll(state: Parameters<typeof applyCommand>[0]): void {
  let guard = 0;
  while (state.activeUnit !== null && guard++ < 100) applyCommand(state, { type: "skip", unit: state.activeUnit });
}

describe("save/load", () => {
  it("replays a command log to an identical state", () => {
    const opts = { opponents: 1 as const };
    const state = newGame(321, opts);
    const log: Command[] = [];
    const run = (cmd: Command) => { if (applyCommand(state, cmd).ok) log.push(cmd); };
    run({ type: "found", unit: state.units[0]! .id });
    for (let i = 0; i < 6; i++) {
      skipAll(state);
      run({ type: "endTurn" });
      while (state.currentPlayer !== 0) { skipAll(state); applyCommand(state, { type: "endTurn" }); }
    }
    const save = parseSave(serializeSave(makeSave(state, opts, log, "test")));
    const { state: again } = loadSave(save, skipAll);
    expect(again.turn).toBe(state.turn);
    expect(JSON.stringify(again.cities)).toBe(JSON.stringify(state.cities));
    expect(JSON.stringify(again.units)).toBe(JSON.stringify(state.units));
    expect(again.rng.s).toEqual(state.rng.s);
  });

  it("goes back to the start of any turn it saw, the same as it was then", () => {
    const opts = { opponents: 1 as const };
    const state = newGame(321, opts);
    const log: Command[] = [];
    const run = (cmd: Command) => { if (applyCommand(state, cmd).ok) log.push(cmd); };
    const first = state.turn;
    const seen = new Map<number, string>();
    run({ type: "found", unit: state.units[0]!.id });
    for (let i = 0; i < 5; i++) {
      skipAll(state);
      run({ type: "endTurn" });
      while (state.currentPlayer !== 0) { skipAll(state); applyCommand(state, { type: "endTurn" }); }
      seen.set(state.turn, JSON.stringify([state.cities, state.units, state.rng.s]));
    }
    // Midway through the last turn: what was done so far belongs to it, not to a new one.
    run({ type: "skip", unit: state.units.find((u) => u.owner === 0)?.id ?? -1 });
    const save = makeSave(state, opts, log);
    expect(turnStarts(save).map((t) => t.turn)).toEqual([first, first + 1, first + 2, first + 3, first + 4, first + 5]);
    for (const [turn, then] of seen) {
      const back = rewindSave(save, turn)!;
      expect(back.turn).toBe(turn);
      const { state: again } = loadSave(back, skipAll);
      expect(again.turn).toBe(turn);
      expect(JSON.stringify([again.cities, again.units, again.rng.s])).toBe(then);
    }
    expect(rewindSave(save, first + 9)).toBeNull();
  });

  it("replays a save from before hit points with one-roll fights", () => {
    const opts = { opponents: 1 as const };
    const state = newGame(321, opts);
    const old = { ...makeSave(state, opts, [], "old"), version: 1 as const };
    const loaded = loadSave(old, skipAll);
    expect(loaded.options.classicCombat).toBe(true);
    expect(loaded.state.classicCombat).toBe(true);
    expect(loaded.state.units.every((u) => u.hp === 10)).toBe(true);
    expect(loadSave(makeSave(state, opts, []), skipAll).state.classicCombat).toBeUndefined();
  });

  it("replays a save from before the extended tech tree on the 1991 tree", () => {
    const opts = { opponents: 1 as const };
    const state = newGame(4242, opts);
    expect(loadSave({ ...makeSave(state, opts, []), version: 8 as const }, skipAll).state.classicAdvances).toBe(true);
    expect(loadSave(makeSave(state, opts, []), skipAll).state.classicAdvances).toBeUndefined();
  });

  it("replays a save from before the original's unit upkeep with the loose upkeep", () => {
    const opts = { opponents: 1 as const };
    const state = newGame(321, opts);
    expect(loadSave({ ...makeSave(state, opts, []), version: 7 as const }, skipAll).state.looseUpkeep).toBe(true);
    expect(loadSave(makeSave(state, opts, []), skipAll).state.looseUpkeep).toBeUndefined();
  });

  it("replays a save from before the AI kept its cities apart with its old habit", () => {
    const opts = { opponents: 1 as const };
    const state = newGame(321, opts);
    expect(loadSave({ ...makeSave(state, opts, []), version: 21 as const }, skipAll).state.packedCities).toBe(true);
    expect(loadSave(makeSave(state, opts, []), skipAll).state.packedCities).toBeUndefined();
  });
});

describe("saves before celebrations", () => {
  it("replay with the simple moods", () => {
    const opts = { opponents: 1 as const };
    const state = newGame(321, opts);
    expect(loadSave({ ...makeSave(state, opts, []), version: 16 as const }, skipAll).state.simpleMoods).toBe(true);
    expect(loadSave(makeSave(state, opts, []), skipAll).state.simpleMoods).toBeUndefined();
  });
});

describe("score and end", () => {
  it("scores citizens, techs and peace; detects defeat and time", () => {
    const state = newGame(5, { opponents: 1, classicCivs: true });
    applyCommand(state, { type: "found", unit: state.units[0]!.id });
    state.players[0]!.advances.push("alphabet", "pottery");
    const s = computeScore(state, 0);
    expect(s.techs).toBe(4);
    expect(s.peace).toBe(3);
    expect(s.total).toBeGreaterThan(5);
    expect(rankTitle(s.total)).toBe("Pathetic");
    expect(checkGameEnd(state, 1000)).toBeNull();
    state.turn = 1000;
    expect(checkGameEnd(state, 1000)).toEqual({ kind: "time" });
    state.players[0]!.alive = false;
    expect(checkGameEnd(state, 1000)).toEqual({ kind: "defeat" });
  });
});
