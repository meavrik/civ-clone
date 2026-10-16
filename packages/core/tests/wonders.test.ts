import { describe, expect, it } from "vitest";
import { applyCommand, createUnit, governmentsAvailable, moveAllowance, newGame, Terrain, type GameState } from "../src/index.js";

function flatWorld(): GameState {
  const s = newGame(1, { opponents: 2 });
  for (const t of s.map.tiles) {
    t.terrain = Terrain.Grassland;
    t.river = false; t.road = false; t.irrigation = false; t.mine = false; t.special = false; t.hut = false;
  }
  s.units = [];
  s.cities = [];
  return s;
}

describe("wonders", () => {
  it("Great Library grants advances two other civilizations know", () => {
    const s = flatWorld();
    const u = createUnit(s, "settlers", 0, 10, 10);
    applyCommand(s, { type: "found", unit: u.id });
    s.cities[0]!.wonders.push("great_library");
    s.players[1]!.advances.push("alphabet", "pottery");
    s.players[2]!.advances.push("alphabet");
    applyCommand(s, { type: "endTurn" });
    expect(s.players[0]!.advances).toContain("alphabet");
    expect(s.players[0]!.advances).not.toContain("pottery");
  });

  it("Lighthouse and Magellan's each add a move to ships", () => {
    const s = flatWorld();
    const u = createUnit(s, "settlers", 0, 10, 10);
    applyCommand(s, { type: "found", unit: u.id });
    const ship = createUnit(s, "trireme", 0, 10, 10);
    const land = createUnit(s, "militia", 0, 10, 10);
    expect(moveAllowance(s, ship)).toBe(9);
    s.cities[0]!.wonders.push("lighthouse", "magellans");
    expect(moveAllowance(s, ship)).toBe(15);
    expect(moveAllowance(s, land)).toBe(3);
    // Magnetism retires the Lighthouse.
    s.players[0]!.advances.push("magnetism");
    expect(moveAllowance(s, ship)).toBe(12);
  });

  it("a no-anarchy wonder opens every government and skips anarchy", () => {
    const s = flatWorld();
    const u = createUnit(s, "settlers", 0, 10, 10);
    applyCommand(s, { type: "found", unit: u.id });
    expect(governmentsAvailable(s, 0)).toEqual(["despotism"]);
    s.cities[0]!.wonders.push("united_nations");
    expect(governmentsAvailable(s, 0)).toContain("democracy");
    applyCommand(s, { type: "revolution" });
    expect(s.players[0]!.anarchyTurns).toBe(0);
  });
});
