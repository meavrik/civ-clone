import { describe, expect, it } from "vitest";
import { applyCommand, checkGameEnd, computeScore, loadSave, makeSave, newGame, parseSave, rankTitle, serializeSave, type Command } from "../src/index.js";

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

  it("replays a save from before the original's unit upkeep with the loose upkeep", () => {
    const opts = { opponents: 1 as const };
    const state = newGame(321, opts);
    expect(loadSave({ ...makeSave(state, opts, []), version: 7 as const }, skipAll).state.looseUpkeep).toBe(true);
    expect(loadSave(makeSave(state, opts, []), skipAll).state.looseUpkeep).toBeUndefined();
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
