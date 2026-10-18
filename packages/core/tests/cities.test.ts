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
  slotScore,
  Terrain,
  tileYield,
  type GameState,
} from "../src/index.js";

function flatWorld(): GameState {
  const s = newGame(1, { opponents: 0, classicCivs: true });
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
    const cost = buyCost(s, c);
    expect(cost).toBe(2 * 56);
    expect(applyCommand(s, { type: "buy", city: c.id }).ok).toBe(true);
    expect(s.players[0]!.gold).toBe(1000 - cost);
    applyCommand(s, { type: "endTurn" });
    expect(c.buildings).toContain("granary");
    // The event names what was finished, for the window that asks what comes next.
    expect(lastTurnEvents).toContainEqual({ city: c.id, kind: "built", detail: "Granary", production: { kind: "building", id: "granary" } });
    expect(c.production).toEqual({ kind: "unit", id: "militia" });
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

  it("working an unworked tile takes a free citizen, else the worker on the weakest square", () => {
    const s = flatWorld();
    const u = createUnit(s, "settlers", 0, 10, 10);
    applyCommand(s, { type: "found", unit: u.id });
    const c = s.cities[0]!;
    c.size = 2;
    // Hills (slot 6, north) and plains (slot 10, west) are worked; forest at slot 11 (east) is not.
    getTile(s.map, 10, 9)!.terrain = Terrain.Hills;
    getTile(s.map, 9, 10)!.terrain = Terrain.Plains;
    getTile(s.map, 11, 10)!.terrain = Terrain.Forest;
    c.worked = [6, 10];
    c.specialists = [];
    expect(applyCommand(s, { type: "workTile", city: c.id, slot: 6 })).toEqual({ ok: false, reason: "already worked" });
    expect(slotScore(s, c, 6)).toBeLessThan(slotScore(s, c, 10));
    expect(applyCommand(s, { type: "workTile", city: c.id, slot: 11 }).ok).toBe(true);
    expect(c.worked.sort()).toEqual([10, 11]); // the hills worker moved
    // With a free citizen nobody has to move.
    c.specialists = ["entertainer"];
    c.size = 3;
    expect(applyCommand(s, { type: "workTile", city: c.id, slot: 6 }).ok).toBe(true);
    expect(c.worked.sort()).toEqual([10, 11, 6].sort());
    expect(c.specialists).toEqual([]);
  });

  it("arranging a city puts every citizen on the best squares, keeping order with entertainers", () => {
    const s = flatWorld();
    const u = createUnit(s, "settlers", 0, 10, 10);
    applyCommand(s, { type: "found", unit: u.id });
    const c = s.cities[0]!;
    getTile(s.map, 11, 10)!.terrain = Terrain.Hills;
    getTile(s.map, 11, 10)!.river = true;
    getTile(s.map, 9, 9)!.special = true;
    c.size = 3;
    c.worked = [];
    c.specialists = ["scientist", "taxman", "entertainer"];
    expect(applyCommand(s, { type: "arrangeCity", city: c.id }).ok).toBe(true);
    expect(c.specialists).toEqual([]);
    const best = Array.from({ length: 20 }, (_, i) => i + 1).sort((a, b) => slotScore(s, c, b) - slotScore(s, c, a));
    expect(c.worked.map((x) => slotScore(s, c, x)).sort()).toEqual(best.slice(0, 3).map((x) => slotScore(s, c, x)).sort());
    // A big city on Emperor needs entertainers: just enough of them to keep order.
    s.players[0]!.difficulty = 4;
    c.size = 6;
    applyCommand(s, { type: "arrangeCity", city: c.id });
    expect(computeCity(s, c).disorder).toBe(false);
    expect(c.specialists.length).toBeGreaterThan(0);
    expect(c.worked.length + c.specialists.length).toBe(6);
    c.worked.push(...c.specialists.splice(0, 1).map(() => best.find((x) => !c.worked.includes(x))!));
    expect(computeCity(s, c).disorder).toBe(true); // one more worker would have tipped it
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
