import { describe, expect, it } from "vitest";
import { applyCommand, computeCity, createUnit, lastTurnEvents, newGame, setRelation, Terrain, type GameState } from "../src/index.js";

function flatWorld(): GameState {
  const s = newGame(1, { opponents: 1 });
  for (const t of s.map.tiles) {
    t.terrain = Terrain.Grassland;
    t.river = true; // some trade everywhere
    t.road = false; t.irrigation = false; t.mine = false; t.special = false; t.hut = false;
  }
  s.units = [];
  s.cities = [];
  return s;
}

function found(s: GameState, owner: number, x: number, y: number) {
  const u = createUnit(s, "settlers", owner, x, y);
  s.currentPlayer = owner;
  applyCommand(s, { type: "found", unit: u.id });
  s.currentPlayer = 0;
  return s.cities[s.cities.length - 1]!;
}

describe("caravans", () => {
  it("opens a trade route between distant cities, paying a bonus, and refuses a second one", () => {
    const s = flatWorld();
    const home = found(s, 0, 10, 10);
    const far = found(s, 0, 25, 10);
    const near = found(s, 0, 14, 10);
    const cv = createUnit(s, "caravan", 0, 14, 10, home.id);
    expect(applyCommand(s, { type: "tradeRoute", unit: cv.id }).ok).toBe(false); // too close
    cv.x = far.x;
    const before = computeCity(s, home).trade;
    const gold = s.players[0]!.gold;
    expect(applyCommand(s, { type: "tradeRoute", unit: cv.id }).ok).toBe(true);
    expect(home.routes).toEqual([far.id]);
    expect(far.routes).toEqual([home.id]);
    expect(s.players[0]!.gold).toBeGreaterThan(gold);
    expect(computeCity(s, home).trade).toBeGreaterThan(before);
    expect(s.units.find((u) => u.id === cv.id)).toBeUndefined();
    expect(lastTurnEvents.some((e) => e.kind === "tradeRoute")).toBe(true);
    const again = createUnit(s, "caravan", 0, far.x, far.y, home.id);
    expect(applyCommand(s, { type: "tradeRoute", unit: again.id }).ok).toBe(false);
    void near;
  });

  it("helps build a wonder with its full cost", () => {
    const s = flatWorld();
    const c = found(s, 0, 10, 10);
    s.players[0]!.advances.push("masonry");
    applyCommand(s, { type: "setProduction", city: c.id, production: { kind: "wonder", id: "pyramids" } });
    const cv = createUnit(s, "caravan", 0, 10, 10, c.id);
    expect(applyCommand(s, { type: "helpWonder", unit: cv.id }).ok).toBe(true);
    expect(c.shields).toBe(50);
    expect(s.units.length).toBe(0);
  });

  it("entering a peaceful foreign city opens a route instead of a treaty refusal", () => {
    const s = flatWorld();
    const home = found(s, 0, 10, 10);
    const theirs = found(s, 1, 24, 10);
    setRelation(s, 0, 1, "peace");
    const cv = createUnit(s, "caravan", 0, 23, 10, home.id);
    expect(applyCommand(s, { type: "move", unit: cv.id, dx: 1, dy: 0 }).ok).toBe(true);
    expect(home.routes).toEqual([theirs.id]);
    expect(s.units.length).toBe(0);
  });
});
