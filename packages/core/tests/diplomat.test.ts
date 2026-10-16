import { describe, expect, it } from "vitest";
import { applyCommand, createUnit, inciteCost, lastTurnEvents, newGame, relation, setRelation, Terrain, type GameState } from "../src/index.js";

function world(): GameState {
  const s = newGame(4, { opponents: 1 });
  for (const t of s.map.tiles) {
    t.terrain = Terrain.Grassland;
    t.river = false; t.road = false; t.irrigation = false; t.mine = false; t.special = false; t.hut = false;
    t.railroad = false; t.fortress = false; t.pollution = false;
  }
  s.units = [];
  s.cities = [];
  const mine = createUnit(s, "settlers", 0, 10, 10);
  applyCommand(s, { type: "found", unit: mine.id });
  s.currentPlayer = 1;
  const theirs = createUnit(s, "settlers", 1, 30, 10);
  applyCommand(s, { type: "found", unit: theirs.id });
  const second = createUnit(s, "settlers", 1, 30, 20);
  applyCommand(s, { type: "found", unit: second.id });
  s.currentPlayer = 0;
  setRelation(s, 0, 1, "peace");
  return s;
}

describe("diplomats", () => {
  it("steal an advance, are spent, and start a war when the victim was at peace", () => {
    const s = world();
    s.players[1]!.advances.push("alphabet");
    const d = createUnit(s, "diplomat", 0, 29, 20);
    expect(applyCommand(s, { type: "move", unit: d.id, dx: 1, dy: 0 }).ok).toBe(false);
    expect(applyCommand(s, { type: "diplomat", unit: d.id, action: "steal", x: 30, y: 20 }).ok).toBe(true);
    expect(s.players[0]!.advances).toContain("alphabet");
    expect(s.units.find((u) => u.id === d.id)).toBeUndefined();
    expect(relation(s, 0, 1)).toBe("war");
    expect(lastTurnEvents.some((e) => e.kind === "spy" && e.action === "steal")).toBe(true);
  });

  it("sabotage wrecks production or an improvement", () => {
    const s = world();
    const city = s.cities[2]!;
    city.shields = 30;
    city.buildings.push("temple");
    const d = createUnit(s, "diplomat", 0, 29, 21);
    expect(applyCommand(s, { type: "diplomat", unit: d.id, action: "sabotage", x: 30, y: 20 }).ok).toBe(true);
    expect(city.shields === 0 || !city.buildings.includes("temple")).toBe(true);
  });

  it("incite buys a city with its garrison, never a capital, never on credit", () => {
    const s = world();
    const capital = s.cities[1]!;
    const town = s.cities[2]!;
    town.size = 2;
    createUnit(s, "militia", 1, 30, 20);
    const d = createUnit(s, "diplomat", 0, 29, 20);
    expect(inciteCost(s, capital)).toBe(Infinity);
    const cost = inciteCost(s, town);
    expect(cost).toBeGreaterThan(0);
    s.players[0]!.gold = cost - 1;
    expect(applyCommand(s, { type: "diplomat", unit: d.id, action: "incite", x: 30, y: 20 }).ok).toBe(false);
    s.players[0]!.gold = cost;
    expect(applyCommand(s, { type: "diplomat", unit: d.id, action: "incite", x: 30, y: 20 }).ok).toBe(true);
    expect(town.owner).toBe(0);
    expect(s.units.filter((u) => u.x === 30 && u.y === 20).every((u) => u.owner === 0)).toBe(true);
    expect(s.players[0]!.gold).toBe(0);
    const d2 = createUnit(s, "diplomat", 0, 29, 10);
    expect(applyCommand(s, { type: "diplomat", unit: d2.id, action: "incite", x: 30, y: 10 }).ok).toBe(false);
  });
});
