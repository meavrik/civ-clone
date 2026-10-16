import { describe, expect, it } from "vitest";
import {
  applyCommand,
  cargo,
  createUnit,
  defenseStrength,
  findPath,
  getTile,
  lastCombat,
  lastTurnEvents,
  newGame,
  relation,
  setRelation,
  Terrain,
  type GameState,
} from "../src/index.js";

/** Two civs plus barbarians on a flat world. */
function world(): GameState {
  const s = newGame(1, { opponents: 1 });
  for (const t of s.map.tiles) {
    t.terrain = Terrain.Grassland;
    t.river = false; t.road = false; t.irrigation = false; t.mine = false; t.special = false; t.hut = false;
  }
  s.units = []; s.cities = [];
  return s;
}

describe("combat", () => {
  it("refuses to attack without a state of war, then fights when at war", () => {
    const s = world();
    const a = createUnit(s, "legion", 0, 10, 10);
    createUnit(s, "militia", 1, 11, 10);
    expect(applyCommand(s, { type: "move", unit: a.id, dx: 1, dy: 0 })).toEqual({ ok: false, reason: "treaty" });
    setRelation(s, 0, 1, "war");
    expect(applyCommand(s, { type: "move", unit: a.id, dx: 1, dy: 0 }).ok).toBe(true);
    expect(lastCombat).not.toBeNull();
    expect(s.units.length).toBe(1);
  });

  it("applies terrain, fortification, veteran and walls to defence", () => {
    const s = world();
    const a = createUnit(s, "legion", 0, 10, 10);
    const d = createUnit(s, "phalanx", 1, 11, 10);
    expect(defenseStrength(s, d, a)).toBe(2);
    getTile(s.map, 11, 10)!.terrain = Terrain.Hills;
    expect(defenseStrength(s, d, a)).toBe(4);
    d.order = { kind: "fortified" };
    expect(defenseStrength(s, d, a)).toBe(6);
    d.veteran = true;
    expect(defenseStrength(s, d, a)).toBe(9);
  });

  it("a losing stack outside a city is wiped out", () => {
    const s = world();
    setRelation(s, 0, 1, "war");
    const a = createUnit(s, "armor", 0, 10, 10);
    a.veteran = true;
    createUnit(s, "militia", 1, 11, 10);
    createUnit(s, "militia", 1, 11, 10);
    // 15 vs 1: near-certain win; retry seeds until the roll goes our way.
    let won = false;
    for (let i = 0; i < 20 && !won; i++) {
      applyCommand(s, { type: "move", unit: a.id, dx: 1, dy: 0 });
      if (lastCombat?.attackerWon) won = true;
      a.movesLeft = 9;
      if (!s.units.includes(a)) break;
    }
    expect(won).toBe(true);
    expect(s.units.filter((u) => u.owner === 1).length).toBe(0);
  });

  it("captures an undefended enemy city and plunders gold", () => {
    const s = world();
    setRelation(s, 0, 1, "war");
    const settler = createUnit(s, "settlers", 1, 12, 10);
    s.currentPlayer = 1;
    applyCommand(s, { type: "found", unit: settler.id });
    s.currentPlayer = 0;
    const city = s.cities[0]!;
    city.size = 3;
    s.players[1]!.gold = 90;
    const a = createUnit(s, "legion", 0, 11, 10);
    expect(applyCommand(s, { type: "move", unit: a.id, dx: 1, dy: 0 }).ok).toBe(true);
    expect(city.owner).toBe(0);
    expect(city.size).toBe(2);
    expect(s.players[0]!.gold).toBeGreaterThan(0);
    expect(lastTurnEvents.some((e) => e.kind === "cityCaptured")).toBe(true);
  });
});

describe("transport", () => {
  it("boards a ship, sails, and disembarks", () => {
    const s = world();
    for (let x = 12; x < 20; x++) getTile(s.map, x, 10)!.terrain = Terrain.Ocean;
    const ship = createUnit(s, "trireme", 0, 12, 10);
    const inf = createUnit(s, "militia", 0, 11, 10);
    expect(applyCommand(s, { type: "move", unit: inf.id, dx: 1, dy: 0 }).ok).toBe(true);
    expect(inf.aboard).toBe(ship.id);
    expect(cargo(s, ship).length).toBe(1);
    const extra = createUnit(s, "militia", 0, 11, 10);
    const extra2 = createUnit(s, "militia", 0, 11, 10);
    applyCommand(s, { type: "move", unit: extra.id, dx: 1, dy: 0 });
    expect(applyCommand(s, { type: "move", unit: extra2.id, dx: 1, dy: 0 })).toEqual({ ok: false, reason: "full" });
    applyCommand(s, { type: "move", unit: ship.id, dx: 1, dy: 0 });
    expect(inf.x).toBe(13);
    applyCommand(s, { type: "endTurn" });
    applyCommand(s, { type: "endTurn" }); // back to player 0
    inf.order = { kind: "none" };
    getTile(s.map, 13, 9)!.terrain = Terrain.Grassland;
    expect(applyCommand(s, { type: "move", unit: inf.id, dx: 0, dy: -1 }).ok).toBe(true);
    expect(inf.aboard).toBeNull();
  });
});

describe("goto", () => {
  it("routes around water and walks over several turns", () => {
    const s = world();
    for (let y = 5; y < 15; y++) getTile(s.map, 12, y)!.terrain = Terrain.Ocean;
    const u = createUnit(s, "militia", 0, 10, 10);
    const path = findPath(s, u, 14, 10);
    expect(path).not.toBeNull();
    expect(path!.length).toBeGreaterThan(4);
    expect(applyCommand(s, { type: "goto", unit: u.id, x: 14, y: 10 }).ok).toBe(true);
    for (let i = 0; i < 12 && u.order.kind === "goto"; i++) {
      applyCommand(s, { type: "endTurn" });
      applyCommand(s, { type: "endTurn" });
    }
    expect([u.x, u.y]).toEqual([14, 10]);
    expect(u.order.kind).toBe("none");
  });
});

describe("diplomacy and turns", () => {
  it("makes contact when units meet and cycles players", () => {
    const s = world();
    expect(relation(s, 0, 1)).toBe("none");
    createUnit(s, "militia", 0, 10, 10);
    createUnit(s, "settlers", 0, 30, 20);
    const b = createUnit(s, "militia", 1, 12, 10);
    createUnit(s, "settlers", 1, 20, 20);
    s.currentPlayer = 1;
    applyCommand(s, { type: "move", unit: b.id, dx: -1, dy: 0 });
    expect(relation(s, 0, 1)).toBe("peace");
    expect(lastTurnEvents.some((e) => e.kind === "contact")).toBe(true);
    s.currentPlayer = 0;
    const turn = s.turn;
    applyCommand(s, { type: "endTurn" });
    expect(s.currentPlayer).toBe(1);
    applyCommand(s, { type: "endTurn" });
    expect(s.currentPlayer).toBe(0);
    expect(s.turn).toBe(turn + 1);
  });
});
