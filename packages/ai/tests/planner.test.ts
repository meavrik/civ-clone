import { describe, expect, it } from "vitest";
import { applyCommand, newGame, Terrain, getTile } from "@civ/core";
import { ADVANCES } from "@civ/core";
import { pickResearch, plannerTurn, siteScore } from "../src/index.js";

/** Human skips everything; the planner plays the rest. */
function playRounds(seed: number, rounds: number) {
  const state = newGame(seed, { opponents: 2 });
  for (let r = 0; r < rounds; r++) {
    let guard = 0;
    while (state.activeUnit !== null && guard++ < 50) applyCommand(state, { type: "skip", unit: state.activeUnit });
    applyCommand(state, { type: "endTurn" });
    while (state.currentPlayer !== 0) {
      plannerTurn(state);
      applyCommand(state, { type: "endTurn" });
    }
  }
  return state;
}

describe("planner AI", () => {
  it("expands, researches along the beeline and stays deterministic", () => {
    const a = playRounds(11, 60);
    const b = playRounds(11, 60);
    const aiCities = a.cities.filter((c) => c.owner !== 0 && c.owner !== a.barbarians);
    expect(aiCities.length).toBeGreaterThanOrEqual(5);
    for (const p of a.players.slice(1, 3)) expect(p.advances.length + (p.researching ? 1 : 0)).toBeGreaterThan(0);
    expect(JSON.stringify(a.cities)).toBe(JSON.stringify(b.cities));
    expect(JSON.stringify(a.units)).toBe(JSON.stringify(b.units));
    expect(a.rng.s).toEqual(b.rng.s);
  });

  it("beelines bronze working, then the path to monarchy", () => {
    expect(pickResearch([], ADVANCES, false)).toBe("bronze_working");
    expect(pickResearch(["bronze_working"], ADVANCES, false)).toBe("alphabet");
    expect(pickResearch(["bronze_working", "alphabet", "ceremonial_burial"], ADVANCES, false)).toBe("code_of_laws");
    expect(pickResearch(["bronze_working", "alphabet", "ceremonial_burial", "code_of_laws"], ADVANCES, false)).toBe("monarchy");
    // At war, iron working jumps the queue once bronze is known.
    expect(pickResearch(["bronze_working"], ADVANCES, true)).toBe("iron_working");
  });

  it("scores city sites by their radius and refuses the sea", () => {
    const s = newGame(3);
    let sea: [number, number] | null = null;
    let land: [number, number] | null = null;
    for (let y = 5; y < 45 && (!sea || !land); y++)
      for (let x = 0; x < 80; x++) {
        const t = getTile(s.map, x, y)!;
        if (!sea && t.terrain === Terrain.Ocean) sea = [x, y];
        if (!land && t.terrain === Terrain.Grassland && siteScore(s, x, y) !== null) land = [x, y];
      }
    expect(sea).not.toBeNull();
    expect(siteScore(s, sea![0], sea![1])).toBeNull();
    expect(land).not.toBeNull();
    expect(siteScore(s, land![0], land![1])!).toBeGreaterThan(20);
  });
});
