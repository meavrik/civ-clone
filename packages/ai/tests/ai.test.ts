import { describe, expect, it } from "vitest";
import { applyCommand, loadSave, loadSnapshot, makeSave, newGame, runAiPlayers, withSnapshot, type Command, type GameState } from "@civ/core";
import { aiTurn } from "../src/index.js";

/** Drive the game: human skips everything, AIs play, for n full rounds. */
function playRounds(seed: number, rounds: number) {
  const state = newGame(seed, { opponents: 2 });
  for (let r = 0; r < rounds; r++) {
    // Human: skip all units, end turn.
    let guard = 0;
    while (state.activeUnit !== null && guard++ < 50) applyCommand(state, { type: "skip", unit: state.activeUnit });
    applyCommand(state, { type: "endTurn" });
    while (state.currentPlayer !== 0) {
      aiTurn(state);
      applyCommand(state, { type: "endTurn" });
    }
  }
  return state;
}

describe("baseline AI", () => {
  it("founds cities and builds units over 40 rounds, deterministically", () => {
    const a = playRounds(7, 40);
    const b = playRounds(7, 40);
    const aiCities = a.cities.filter((c) => c.owner !== 0);
    expect(aiCities.length).toBeGreaterThanOrEqual(2);
    expect(a.units.filter((u) => u.owner !== 0).length).toBeGreaterThan(0);
    expect(a.turn).toBe(40);
    expect(JSON.stringify(a.cities)).toBe(JSON.stringify(b.cities));
    expect(a.players.slice(1, 3).some((p) => p.researching !== null || p.advances.length > 0)).toBe(true);
  });
});

describe("a save's snapshot", () => {
  it("plays on with the computer players exactly as the game it was taken from, and as its replay", () => {
    const opts = { opponents: 3 as const };
    const state = newGame(11, opts);
    const log: Command[] = [];
    // The human seat skips its units; the computer players play.
    const playTurn = (s: GameState, record: Command[]) => {
      let guard = 0;
      // As the game logs them: the commands the rules accept.
      const run = (cmd: Command) => { if (applyCommand(s, cmd).ok) record.push(cmd); };
      while (s.activeUnit !== null && s.currentPlayer === 0 && guard++ < 100) run({ type: "skip", unit: s.activeUnit });
      run({ type: "endTurn" });
      runAiPlayers(s, aiTurn);
    };
    const found: Command = { type: "found", unit: state.units.find((u) => u.owner === 0)!.id };
    applyCommand(state, found);
    log.push(found);
    while (state.turn < 40) playTurn(state, log);
    const save = withSnapshot(makeSave(state, opts, log), state);
    const fromSnapshot = loadSnapshot(save)!.state;
    const fromReplay = loadSave(save, aiTurn).state;
    const orders: Command[] = [];
    while (state.turn < 60) playTurn(state, orders);
    for (const copy of [fromSnapshot, fromReplay])
      for (const cmd of orders) {
        applyCommand(copy, cmd);
        if (cmd.type === "endTurn") runAiPlayers(copy, aiTurn);
      }
    const all = (s: GameState) => JSON.stringify(s, (k, v) => (k === "lastActions" || k === "lastTurnEvents" ? undefined : ArrayBuffer.isView(v) ? Array.from(v as Uint8Array) : v));
    expect(state.cities.length).toBeGreaterThan(3);
    expect(all(fromSnapshot)).toBe(all(state));
    expect(all(fromReplay)).toBe(all(state));
  });
});
