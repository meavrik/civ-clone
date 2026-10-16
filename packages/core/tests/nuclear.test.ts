import { describe, expect, it } from "vitest";
import { applyCommand, createUnit, getTile, lastTurnEvents, newGame, Terrain, type GameState } from "../src/index.js";

function world(): GameState {
  const s = newGame(6, { opponents: 1 });
  for (const t of s.map.tiles) {
    t.terrain = Terrain.Grassland;
    t.river = false; t.road = false; t.irrigation = false; t.mine = false; t.special = false; t.hut = false;
    t.railroad = false; t.fortress = false; t.pollution = false;
  }
  s.units = [];
  s.cities = [];
  s.currentPlayer = 1;
  const settlers = createUnit(s, "settlers", 1, 30, 20);
  applyCommand(s, { type: "found", unit: settlers.id });
  s.currentPlayer = 0;
  s.relations["0:1"] = "war";
  return s;
}

describe("nuclear weapons", () => {
  it("wipe out every unit around the target, halve the city and leave fallout", () => {
    const s = world();
    const city = s.cities[0]!;
    city.size = 6;
    createUnit(s, "musketeers", 1, 30, 20);
    createUnit(s, "musketeers", 1, 31, 21);
    const far = createUnit(s, "musketeers", 1, 33, 20);
    const nuke = createUnit(s, "nuclear", 0, 29, 20);
    expect(applyCommand(s, { type: "move", unit: nuke.id, dx: 1, dy: 0 }).ok).toBe(true);
    expect(s.units.map((u) => u.id)).toEqual([far.id]);
    expect(city.size).toBe(3);
    expect(getTile(s.map, 30, 20)!.pollution).toBe(true);
    expect(lastTurnEvents.some((e) => e.kind === "nuked" && !e.stopped)).toBe(true);
  });

  it("is shot down by SDI Defense and refused against a civ at peace", () => {
    const s = world();
    const city = s.cities[0]!;
    city.buildings.push("sdi_defense");
    createUnit(s, "musketeers", 1, 30, 20);
    const nuke = createUnit(s, "nuclear", 0, 29, 20);
    expect(applyCommand(s, { type: "move", unit: nuke.id, dx: 1, dy: 0 }).ok).toBe(true);
    expect(s.units.length).toBe(1);
    expect(city.size).toBe(1);
    expect(lastTurnEvents.some((e) => e.kind === "nuked" && e.stopped)).toBe(true);
    s.relations["0:1"] = "peace";
    const second = createUnit(s, "nuclear", 0, 29, 20);
    expect(applyCommand(s, { type: "move", unit: second.id, dx: 1, dy: 0 })).toEqual({ ok: false, reason: "treaty" });
  });
});
