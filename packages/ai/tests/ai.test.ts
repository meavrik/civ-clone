import { describe, expect, it } from "vitest";
import { applyCommand, newGame } from "@civ/core";
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
