import { describe, expect, it } from "vitest";
import { newGame, runAiPlayers } from "@civ/core";
import { aiTurn } from "@civ/ai";
import { defaultConfig, replayMatches, runGame, seatAis } from "../src/index.js";

describe("all-AI games", () => {
  it("runAiPlayers plays exactly one round when nobody is human", () => {
    const state = newGame(3, { allAi: true, opponents: 2 });
    expect(state.players[0]!.isAi).toBe(true);
    runAiPlayers(state, aiTurn);
    expect(state.turn).toBe(1);
    expect(state.currentPlayer).toBe(0);
    runAiPlayers(state, aiTurn);
    expect(state.turn).toBe(2);
  });

  it("runs a seeded game, samples stats and replays to the same state", () => {
    const config = defaultConfig(11, { civs: 3, turns: 30, every: 10, ais: ["baseline"] });
    const a = runGame(config);
    expect(a.turns).toBe(30);
    expect(a.end).toBe("turns");
    expect(a.players.length).toBe(3);
    expect(a.samples.map((s) => s.turn)).toEqual([10, 20, 30]);
    expect(a.players.some((p) => p.cities > 0)).toBe(true);
    expect(a.winner).not.toBeNull();
    expect(seatAis(config)).toEqual(["baseline", "baseline", "baseline"]);

    const b = runGame(config);
    expect(b.digest).toBe(a.digest);
    expect(replayMatches(a)).toBe(true);
  });
});
