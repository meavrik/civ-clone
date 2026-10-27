import { describe, expect, it } from "vitest";
import { applyCommand, createUnit, foundCity, newGame, Terrain, getTile, type GameState } from "@civ/core";
import { ADVANCES } from "@civ/core";
import { CITY_SPACING, pickResearch, plannerTurn, roomForCity, siteScore } from "../src/index.js";

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

  it("keeps new cities apart: four squares from its own, five from anyone else's", () => {
    const s = newGame(3, { opponents: 2 });
    s.cities = [];
    s.units = [];
    const ours = foundCity(s, 1, 20, 20);
    foundCity(s, 2, 40, 20);
    expect(CITY_SPACING).toEqual({ own: 4, foreign: 5 });
    expect(roomForCity(s, 1, 23, 21)).toBe(false);
    expect(roomForCity(s, 1, ours.x + 4, 22)).toBe(true);
    expect(roomForCity(s, 1, 36, 20)).toBe(false);
    expect(roomForCity(s, 1, 35, 20)).toBe(true);
    // An old save's planner minds only four squares, from anyone.
    s.packedCities = true;
    expect(roomForCity(s, 1, 36, 20)).toBe(true);
  });

  it("does not found a city where its settlers stand two squares from one of ours, as it did in old saves", () => {
    const run = (packed: boolean): GameState => {
      const s = newGame(3, { opponents: 1 });
      // Saves that old load with the old settler rules too (`looseSettlers`: two squares apart).
      if (packed) Object.assign(s, { packedCities: true, looseSettlers: true });
      s.cities = [];
      s.units = [];
      for (let y = 10; y < 30; y++) for (let x = 10; x < 40; x++) Object.assign(getTile(s.map, x, y)!, { terrain: Terrain.Grassland, river: false, special: false, continent: 77 });
      s.players[1]!.explored.fill(1);
      foundCity(s, 1, 20, 20);
      s.activeUnit = createUnit(s, "settlers", 1, 22, 20).id;
      s.currentPlayer = 1;
      plannerTurn(s);
      return s;
    };
    expect(run(true).cities.some((c) => c.x === 22 && c.y === 20)).toBe(true);
    // Now it walks on to a site four squares out.
    const s = run(false);
    expect(s.cities).toHaveLength(1);
    const order = s.units[0]!.order;
    expect(order.kind).toBe("goto");
    if (order.kind === "goto") expect(Math.max(Math.abs(order.x - 20), Math.abs(order.y - 20))).toBeGreaterThanOrEqual(CITY_SPACING.own);
  });

  it("leaves room between the cities it founds in a game", () => {
    const s = playRounds(11, 80);
    const d = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.max(Math.min(Math.abs(a.x - b.x), s.map.width - Math.abs(a.x - b.x)), Math.abs(a.y - b.y));
    expect(s.cities.length).toBeGreaterThan(6);
    for (const a of s.cities)
      for (const b of s.cities)
        if (a.id < b.id) expect(d(a, b)).toBeGreaterThanOrEqual(a.owner === b.owner ? CITY_SPACING.own : CITY_SPACING.foreign);
  });
});
