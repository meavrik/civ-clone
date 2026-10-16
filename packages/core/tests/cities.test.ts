import { describe, expect, it } from "vitest";
import {
  applyCommand,
  autoAssignWorkers,
  buyCost,
  computeCity,
  createUnit,
  getTile,
  lastTurnEvents,
  newGame,
  Terrain,
  tileYield,
  type GameState,
} from "../src/index.js";

function flatWorld(): GameState {
  const s = newGame(1, { opponents: 0 });
  for (const t of s.map.tiles) {
    t.terrain = Terrain.Grassland;
    t.river = false; t.road = false; t.irrigation = false; t.mine = false; t.special = false; t.hut = false;
  }
  s.units = [];
  s.cities = [];
  return s;
}

describe("tile yields", () => {
  it("applies the despotism penalty and improvements", () => {
    const s = flatWorld();
    const t = getTile(s.map, 10, 10)!;
    expect(tileYield(s, t, false, "despotism")).toEqual({ food: 2, shields: 0, trade: 0 });
    t.irrigation = true;
    t.road = true;
    // 3 food -> 2 under despotism; road adds 1 trade on grassland
    expect(tileYield(s, t, false, "despotism")).toEqual({ food: 2, shields: 0, trade: 1 });
    expect(tileYield(s, t, false, "monarchy")).toEqual({ food: 3, shields: 0, trade: 1 });
    t.terrain = Terrain.Hills;
    t.irrigation = false;
    t.mine = true;
    expect(tileYield(s, t, false, "monarchy").shields).toBe(3);
  });

  it("centre tile is auto-irrigated and yields at least one shield", () => {
    const s = flatWorld();
    const t = getTile(s.map, 10, 10)!;
    expect(tileYield(s, t, true, "despotism")).toEqual({ food: 2, shields: 1, trade: 0 });
  });
});

describe("cities", () => {
  it("founds a city with the palace, assigns a worker, and removes the settlers", () => {
    const s = flatWorld();
    const u = createUnit(s, "settlers", 0, 10, 10);
    s.activeUnit = u.id;
    expect(applyCommand(s, { type: "found", unit: u.id }).ok).toBe(true);
    expect(s.units.length).toBe(0);
    const c = s.cities[0]!;
    expect(c.buildings).toContain("palace");
    expect(c.worked.length).toBe(1);
    expect(getTile(s.map, 10, 10)!.road).toBe(true);
    const r = computeCity(s, c);
    expect(r.food).toBe(4); // centre 2 (+irrigation capped by despotism) + one grassland 2
    expect(r.foodSurplus).toBe(2);
    expect(r.shields).toBe(1);
  });

  it("refuses to found adjacent to another city", () => {
    const s = flatWorld();
    const a = createUnit(s, "settlers", 0, 10, 10);
    applyCommand(s, { type: "found", unit: a.id });
    const b = createUnit(s, "settlers", 0, 11, 10);
    expect(applyCommand(s, { type: "found", unit: b.id }).ok).toBe(false);
  });

  it("grows when the food box fills and builds its production", () => {
    const s = flatWorld();
    const u = createUnit(s, "settlers", 0, 10, 10);
    applyCommand(s, { type: "found", unit: u.id });
    const c = s.cities[0]!;
    // Size 1 box is 20; surplus 2/turn -> grows on the 10th turn.
    for (let i = 0; i < 10; i++) applyCommand(s, { type: "endTurn" });
    expect(c.size).toBe(2);
    expect(c.worked.length).toBe(2);
    // Militia costs 10 at 1 shield/turn: built on turn 10.
    expect(s.units.some((x) => x.type === "militia" && x.homeCity === c.id)).toBe(true);
    expect(lastTurnEvents.some((e) => e.kind === "grew")).toBe(true);
  });

  it("switching production kind halves the box; buying completes it", () => {
    const s = flatWorld();
    const u = createUnit(s, "settlers", 0, 10, 10);
    applyCommand(s, { type: "found", unit: u.id });
    const c = s.cities[0]!;
    c.shields = 8;
    s.players[0]!.advances.push("pottery");
    applyCommand(s, { type: "setProduction", city: c.id, production: { kind: "building", id: "granary" } });
    expect(c.shields).toBe(4);
    s.players[0]!.gold = 1000;
    const cost = buyCost(c);
    expect(cost).toBe(2 * 56);
    expect(applyCommand(s, { type: "buy", city: c.id }).ok).toBe(true);
    expect(s.players[0]!.gold).toBe(1000 - cost);
    applyCommand(s, { type: "endTurn" });
    expect(c.buildings).toContain("granary");
  });

  it("toggling a worked tile makes an entertainer and back", () => {
    const s = flatWorld();
    const u = createUnit(s, "settlers", 0, 10, 10);
    applyCommand(s, { type: "found", unit: u.id });
    const c = s.cities[0]!;
    const slot = c.worked[0]!;
    expect(applyCommand(s, { type: "toggleTile", city: c.id, slot }).ok).toBe(true);
    expect(c.specialists).toEqual(["entertainer"]);
    expect(computeCity(s, c).lux).toBe(2);
    expect(applyCommand(s, { type: "toggleTile", city: c.id, slot: 5 }).ok).toBe(true);
    expect(c.worked).toEqual([5]);
    expect(c.specialists).toEqual([]);
  });

  it("falls into disorder when unhappy outnumber happy, and martial law helps", () => {
    const s = flatWorld();
    s.players[0]!.difficulty = 4; // 2 content base
    const u = createUnit(s, "settlers", 0, 10, 10);
    applyCommand(s, { type: "found", unit: u.id });
    const c = s.cities[0]!;
    c.size = 5;
    autoAssignWorkers(s, c);
    let r = computeCity(s, c);
    expect(r.unhappy).toBe(3);
    expect(r.disorder).toBe(true);
    createUnit(s, "militia", 0, 10, 10, c.id);
    createUnit(s, "militia", 0, 10, 10, c.id);
    r = computeCity(s, c);
    expect(r.unhappy).toBe(1);
    expect(r.disorder).toBe(true);
    c.buildings.push("temple");
    r = computeCity(s, c);
    expect(r.disorder).toBe(false);
  });

  it("charges shield upkeep beyond the free units and gold for buildings", () => {
    const s = flatWorld();
    const u = createUnit(s, "settlers", 0, 10, 10);
    applyCommand(s, { type: "found", unit: u.id });
    const c = s.cities[0]!;
    for (let i = 0; i < 5; i++) createUnit(s, "militia", 0, 10, 10, c.id);
    const r = computeCity(s, c);
    expect(r.unitShields).toBe(2);
    c.buildings.push("temple");
    const gold = s.players[0]!.gold;
    applyCommand(s, { type: "endTurn" });
    expect(s.players[0]!.gold).toBe(gold + computeCity(s, c).tax - 1);
  });
});

describe("bankruptcy", () => {
  it("sells the costliest improvement when the treasury goes negative", () => {
    const s = flatWorld();
    const u = createUnit(s, "settlers", 0, 10, 10);
    applyCommand(s, { type: "found", unit: u.id });
    const c = s.cities[0]!;
    c.buildings.push("temple", "city_walls");
    s.players[0]!.gold = 0;
    s.players[0]!.taxRate = 0;
    s.players[0]!.sciRate = 6;
    s.players[0]!.luxRate = 4;
    applyCommand(s, { type: "endTurn" });
    expect(c.buildings).not.toContain("city_walls");
    expect(c.buildings).toContain("temple");
    expect(s.players[0]!.gold).toBeGreaterThan(0);
    expect(lastTurnEvents.some((e) => e.kind === "sold")).toBe(true);
  });
});
