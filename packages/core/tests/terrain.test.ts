import { describe, expect, it } from "vitest";
import {
  applyCommand,
  autoAssignWorkers,
  bestDefender,
  computeCity,
  createUnit,
  defenseStrength,
  getTile,
  globalWarming,
  lastTurnEvents,
  newGame,
  pollutionChance,
  resolveCombat,
  Terrain,
  tileYield,
  workOptions,
  type GameState,
} from "../src/index.js";

function flatWorld(terrain = Terrain.Grassland): GameState {
  const s = newGame(1, { opponents: 1, classicCivs: true });
  for (const t of s.map.tiles) {
    t.terrain = terrain;
    t.river = false; t.road = false; t.irrigation = false; t.mine = false; t.special = false; t.hut = false;
    t.railroad = false; t.fortress = false; t.pollution = false;
  }
  s.units = [];
  s.cities = [];
  return s;
}

describe("railroads", () => {
  it("cost nothing to move along and add half again to shields", () => {
    const s = flatWorld(Terrain.Forest);
    for (const x of [10, 11]) { const t = getTile(s.map, x, 10)!; t.road = true; t.railroad = true; }
    const u = createUnit(s, "militia", 0, 10, 10);
    expect(applyCommand(s, { type: "move", unit: u.id, dx: 1, dy: 0 }).ok).toBe(true);
    expect(u.movesLeft).toBe(3);
    expect(tileYield(s, getTile(s.map, 11, 10)!, false, "monarchy").shields).toBe(3);
  });

  it("are a settler job on a road once Railroad is known", () => {
    const s = flatWorld();
    getTile(s.map, 10, 10)!.road = true;
    const u = createUnit(s, "settlers", 0, 10, 10);
    expect(workOptions(s, u).railroad).toBeUndefined();
    s.players[0]!.advances.push("railroad");
    expect(workOptions(s, u).railroad).toBe(4);
  });
});

describe("fortresses", () => {
  it("double defence and spare the rest of the stack", () => {
    const s = flatWorld();
    s.players[0]!.advances.push("construction");
    const worker = createUnit(s, "settlers", 0, 11, 10);
    expect(workOptions(s, worker).fortress).toBe(3);
    getTile(s.map, 11, 10)!.fortress = true;
    const a = createUnit(s, "legion", 1, 10, 10);
    const d = createUnit(s, "phalanx", 0, 11, 10);
    expect(defenseStrength(s, d, a)).toBe(4);
    expect(bestDefender(s, 11, 10, a)!.id).toBe(d.id);
    s.currentPlayer = 1;
    s.relations["0:1"] = "war";
    // Keep rolling fresh worlds until the attacker wins once; the settlers must survive every time.
    for (let seed = 1; seed < 40; seed++) {
      const w = flatWorld();
      w.relations["0:1"] = "war";
      getTile(w.map, 11, 10)!.fortress = true;
      const att = createUnit(w, "armor", 1, 10, 10);
      att.veteran = true;
      createUnit(w, "phalanx", 0, 11, 10);
      const set = createUnit(w, "settlers", 0, 11, 10);
      w.rng.s[0] = seed;
      w.currentPlayer = 1;
      const r = resolveCombat(w, att, 1, 0);
      if ("error" in r) throw new Error(r.error);
      if (r.attackerWon) { expect(w.units.some((u) => u.id === set.id)).toBe(true); return; }
    }
    throw new Error("attacker never won");
  });
});

describe("pollution", () => {
  it("grows with industry, is tamed by Mass Transit and recycling, halves a tile and can be cleaned", () => {
    const s = flatWorld();
    const u = createUnit(s, "settlers", 0, 10, 10);
    applyCommand(s, { type: "found", unit: u.id });
    const c = s.cities[0]!;
    c.size = 12;
    expect(pollutionChance(s, c, 10)).toBe(0);
    expect(pollutionChance(s, c, 35)).toBe(15);
    s.players[0]!.advances.push("industrialization", "automobile");
    expect(pollutionChance(s, c, 35)).toBe(21);
    c.buildings.push("mass_transit");
    expect(pollutionChance(s, c, 35)).toBe(15);
    c.buildings.push("recycling_center");
    expect(pollutionChance(s, c, 35)).toBe(0);

    const t = getTile(s.map, 11, 10)!;
    const clean = tileYield(s, t, false, "monarchy");
    t.pollution = true;
    expect(tileYield(s, t, false, "monarchy").food).toBe(Math.floor(clean.food / 2));
    const w = createUnit(s, "settlers", 0, 11, 10);
    expect(applyCommand(s, { type: "work", unit: w.id, work: "clean" }).ok).toBe(true);
    for (let i = 0; i < 3; i++) { applyCommand(s, { type: "endTurn" }); while (s.currentPlayer !== 0) applyCommand(s, { type: "endTurn" }); }
    expect(t.pollution).toBe(false);
    void computeCity;
  });

  it("fouls tiles around a smoky city and warms the world when it spreads", () => {
    const s = flatWorld();
    const u = createUnit(s, "settlers", 0, 10, 10);
    applyCommand(s, { type: "found", unit: u.id });
    const c = s.cities[0]!;
    c.size = 8;
    c.buildings.push("factory", "power_plant", "temple", "colosseum");
    s.players[0]!.difficulty = 0;
    s.players[0]!.government = "monarchy";
    // Four coal hills with mines and four irrigated fields keep a size-8 city fed and smoky.
    for (const [x, y] of [[8, 10], [12, 10], [10, 8], [10, 12]]) {
      const t = getTile(s.map, x, y)!;
      t.terrain = Terrain.Hills; t.mine = true; t.special = true;
    }
    for (const [x, y] of [[9, 9], [11, 9], [9, 11], [11, 11]]) getTile(s.map, x, y)!.irrigation = true;
    autoAssignWorkers(s, c);
    const r0 = computeCity(s, c);
    expect(r0.disorder).toBe(false);
    expect(r0.foodSurplus).toBeGreaterThanOrEqual(0);
    expect(r0.pollution).toBeGreaterThan(10);
    let polluted = 0;
    for (let turn = 0; turn < 60 && polluted === 0; turn++) {
      applyCommand(s, { type: "endTurn" });
      if (lastTurnEvents.some((e) => e.kind === "pollution")) polluted++;
      while (s.currentPlayer !== 0) applyCommand(s, { type: "endTurn" });
    }
    expect(polluted).toBeGreaterThan(0);

    const before = s.map.tiles.filter((t) => t.terrain === Terrain.Grassland).length;
    globalWarming(s);
    const after = s.map.tiles.filter((t) => t.terrain === Terrain.Grassland).length;
    expect(after).toBeLessThan(before);
    expect(s.map.tiles.some((t) => t.terrain === Terrain.Swamp || t.terrain === Terrain.Plains)).toBe(true);
  });
});
