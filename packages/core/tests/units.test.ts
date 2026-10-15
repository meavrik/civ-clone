import { describe, expect, it } from "vitest";
import {
  applyCommand,
  checkMove,
  createUnit,
  getTile,
  newGame,
  Terrain,
  type GameState,
} from "../src/index.js";

/** Flat test world: all grassland except the poles, one unit placed by caller. */
function flatWorld(): GameState {
  const s = newGame(1);
  for (const t of s.map.tiles) {
    t.terrain = Terrain.Grassland;
    t.river = false;
    t.road = false;
    t.irrigation = false;
    t.mine = false;
  }
  s.units = [];
  return s;
}

describe("movement", () => {
  it("pays terrain cost in thirds and allows entry with any moves left", () => {
    const s = flatWorld();
    const u = createUnit(s, "settlers", 0, 10, 10);
    getTile(s.map, 11, 10)!.terrain = Terrain.Mountains;
    const r = checkMove(s, u, 1, 0);
    expect(r).toEqual({ ok: true, cost: 9 });
    expect(applyCommand(s, { type: "move", unit: u.id, dx: 1, dy: 0 }).ok).toBe(true);
    expect(u.x).toBe(11);
    expect(u.movesLeft).toBe(0);
  });

  it("road to road costs one third", () => {
    const s = flatWorld();
    const u = createUnit(s, "cavalry", 0, 10, 10);
    getTile(s.map, 10, 10)!.road = true;
    getTile(s.map, 11, 10)!.road = true;
    expect(checkMove(s, u, 1, 0)).toEqual({ ok: true, cost: 1 });
  });

  it("wraps east-west", () => {
    const s = flatWorld();
    const u = createUnit(s, "settlers", 0, 79, 10);
    applyCommand(s, { type: "move", unit: u.id, dx: 1, dy: 0 });
    expect(u.x).toBe(0);
  });

  it("land units cannot enter ocean", () => {
    const s = flatWorld();
    const u = createUnit(s, "settlers", 0, 10, 10);
    getTile(s.map, 11, 10)!.terrain = Terrain.Ocean;
    expect(checkMove(s, u, 1, 0)).toEqual({ ok: false, reason: "terrain" });
  });

  it("enforces zones of control", () => {
    const s = flatWorld();
    s.players.push({ ...s.players[0]!, id: 1, name: "Enemy" });
    const u = createUnit(s, "militia", 0, 10, 10);
    createUnit(s, "militia", 1, 11, 11); // adjacent to both (10,10) and (10,11)
    expect(checkMove(s, u, 0, 1)).toEqual({ ok: false, reason: "zoc" });
    expect(checkMove(s, u, 0, -1).ok).toBe(true); // moving away is fine
  });
});

describe("settler work and turns", () => {
  it("builds a road after the required turns", () => {
    const s = flatWorld();
    const u = createUnit(s, "settlers", 0, 10, 10);
    s.activeUnit = u.id;
    expect(applyCommand(s, { type: "work", unit: u.id, work: "road" }).ok).toBe(true);
    applyCommand(s, { type: "endTurn" });
    expect(getTile(s.map, 10, 10)!.road).toBe(false);
    applyCommand(s, { type: "endTurn" });
    expect(getTile(s.map, 10, 10)!.road).toBe(true);
    expect(u.order.kind).toBe("none");
    expect(s.turn).toBe(2);
  });

  it("irrigation needs water nearby", () => {
    const s = flatWorld();
    const u = createUnit(s, "settlers", 0, 10, 10);
    expect(applyCommand(s, { type: "work", unit: u.id, work: "irrigate" }).ok).toBe(false);
    getTile(s.map, 10, 9)!.terrain = Terrain.Ocean;
    expect(applyCommand(s, { type: "work", unit: u.id, work: "irrigate" }).ok).toBe(true);
  });

  it("cycles active units and ends the turn when none need orders", () => {
    const s = flatWorld();
    const a = createUnit(s, "militia", 0, 10, 10);
    const b = createUnit(s, "militia", 0, 12, 10);
    applyCommand(s, { type: "endTurn" });
    expect(s.activeUnit).toBe(a.id);
    applyCommand(s, { type: "fortify", unit: a.id });
    expect(s.activeUnit).toBe(b.id);
    applyCommand(s, { type: "skip", unit: b.id });
    expect(s.activeUnit).toBeNull();
    applyCommand(s, { type: "endTurn" });
    expect(a.order.kind).toBe("fortified");
    expect(s.activeUnit).toBe(b.id); // fortified units don't ask for orders
  });
});

describe("new game", () => {
  it("starts with settlers on open land with visibility", () => {
    const s = newGame(77);
    expect(s.units.length).toBeGreaterThanOrEqual(1);
    const u = s.units[0]!;
    const t = getTile(s.map, u.x, u.y)!;
    expect([Terrain.Grassland, Terrain.Plains]).toContain(t.terrain);
    expect(s.players[0]!.visible[u.y * 80 + u.x]).toBe(1);
    expect(s.activeUnit).toBe(u.id);
    expect(t.continent).toBeGreaterThan(0);
  });
});
