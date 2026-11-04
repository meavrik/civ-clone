import { describe, expect, it } from "vitest";
import { applyCommand, computeCity, createUnit, lastTurnEvents, loadSave, makeSave, newGame, setRelation, Terrain, type GameState } from "../src/index.js";

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

  it("calls at a garrisoned foreign city, by treaty or by contact alone, and never fights (save version 65)", () => {
    for (const relation of ["peace", "contact"] as const) {
      const s = flatWorld();
      const home = found(s, 0, 10, 10);
      const theirs = found(s, 1, 24, 10);
      setRelation(s, 0, 1, relation);
      const guard = createUnit(s, "phalanx", 1, 24, 10, theirs.id);
      const cv = createUnit(s, "caravan", 0, 23, 10, home.id);
      const gold = s.players[0]!.gold;
      expect(applyCommand(s, { type: "move", unit: cv.id, dx: 1, dy: 0 }).ok).toBe(true);
      expect(home.routes).toEqual([theirs.id]);
      expect(theirs.routes).toEqual([home.id]);
      expect(s.players[0]!.gold).toBeGreaterThan(gold);
      expect(s.units).toEqual([guard]);
      expect(lastTurnEvents.some((e) => e.kind === "tradeRoute" && e.player === 0)).toBe(true);
    }
  });

  it("says why a call opens nothing, and stays out of a city at war", () => {
    const s = flatWorld();
    const home = found(s, 0, 10, 10);
    const near = found(s, 1, 15, 10);
    createUnit(s, "phalanx", 1, 15, 10, near.id);
    setRelation(s, 0, 1, "peace");
    const cv = createUnit(s, "caravan", 0, 14, 10, home.id);
    expect(applyCommand(s, { type: "move", unit: cv.id, dx: 1, dy: 0 })).toEqual({ ok: false, reason: "too close to home" });
    setRelation(s, 0, 1, "war");
    expect(applyCommand(s, { type: "move", unit: cv.id, dx: 1, dy: 0 })).toEqual({ ok: false, reason: "this unit cannot attack" });
    expect(home.routes).toEqual([]);
    expect(s.units).toContain(cv);
  });

  it("opens its route as a goto reaches a foreign city, and waits at the gate if turned away", () => {
    const s = flatWorld();
    const home = found(s, 0, 10, 10);
    const theirs = found(s, 1, 24, 10);
    setRelation(s, 0, 1, "peace");
    createUnit(s, "phalanx", 1, 24, 10, theirs.id);
    const cv = createUnit(s, "caravan", 0, 22, 10, home.id);
    expect(applyCommand(s, { type: "goto", unit: cv.id, x: 24, y: 10 }).ok).toBe(true);
    expect(home.routes).toEqual([theirs.id]);
    expect(s.units.some((u) => u.id === cv.id)).toBe(false);
    expect(s.activeUnit).toBeNull();

    const again = createUnit(s, "caravan", 0, 22, 10, home.id); // a route exists already
    expect(applyCommand(s, { type: "goto", unit: again.id, x: 24, y: 10 }).ok).toBe(true);
    expect([again.x, again.y]).toEqual([23, 10]);
    expect(again.order).toEqual({ kind: "none" });
    expect(home.routes).toEqual([theirs.id]);
  });

  it("was turned away by a garrison in saves before version 65", () => {
    const opts = { opponents: 1 as const };
    const loaded = loadSave({ ...makeSave(newGame(3, opts), opts, []), version: 64 as const }, () => {}).state;
    expect(loaded.barredCaravans).toBe(true);
    expect(loadSave(makeSave(newGame(3, opts), opts, []), () => {}).state.barredCaravans).toBeUndefined();

    const s = flatWorld();
    s.barredCaravans = true;
    const home = found(s, 0, 10, 10);
    const theirs = found(s, 1, 24, 10);
    setRelation(s, 0, 1, "peace");
    const guard = createUnit(s, "phalanx", 1, 24, 10, theirs.id);
    const cv = createUnit(s, "caravan", 0, 23, 10, home.id);
    expect(applyCommand(s, { type: "move", unit: cv.id, dx: 1, dy: 0 })).toEqual({ ok: false, reason: "treaty" });
    expect(home.routes).toEqual([]);
    s.units = s.units.filter((u) => u !== guard); // an empty city still takes one in
    expect(applyCommand(s, { type: "move", unit: cv.id, dx: 1, dy: 0 }).ok).toBe(true);
    expect(home.routes).toEqual([theirs.id]);
  });
});
