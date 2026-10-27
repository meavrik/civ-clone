import { describe, expect, it } from "vitest";
import {
  applyCommand,
  canFoundCity,
  checkMove,
  createUnit,
  deepWater,
  findPath,
  foundCity,
  getTile,
  lastTurnEvents,
  loadSave,
  makeSave,
  newGame,
  Terrain,
  type GameState,
  siteScore,
} from "../src/index.js";

/** Flat test world: all grassland except the poles, one unit placed by caller. */
function flatWorld(): GameState {
  const s = newGame(1, { opponents: 0, classicCivs: true });
  for (const t of s.map.tiles) {
    t.terrain = Terrain.Grassland;
    t.river = false;
    t.road = false;
    t.irrigation = false;
    t.mine = false;
    t.hut = false;
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

describe("triremes", () => {
  /** A sea 20 squares across in the flat world, a Trireme on it carrying a Legion. */
  function sea(x: number, y: number) {
    const s = flatWorld();
    for (let sy = 10; sy <= 30; sy++) for (let sx = 10; sx <= 30; sx++) getTile(s.map, sx, sy)!.terrain = Terrain.Ocean;
    const ship = createUnit(s, "trireme", 0, x, y);
    const legion = createUnit(s, "legion", 0, x, y);
    legion.aboard = ship.id;
    legion.order = { kind: "sentry" };
    return { s, ship, legion };
  }
  const round = (s: GameState) => { do applyCommand(s, { type: "endTurn" }); while (s.currentPlayer !== 0); };

  it("sink with their cargo when the turn ends on deep water, and live beside land; old saves sail on", () => {
    const { s, ship, legion } = sea(20, 20);
    expect(deepWater(s, 20, 20)).toBe(true);
    expect(deepWater(s, 10, 20)).toBe(false);
    applyCommand(s, { type: "endTurn" });
    expect(s.units.some((u) => u.id === ship.id || u.id === legion.id)).toBe(false);
    expect(lastTurnEvents).toContainEqual({ kind: "lostAtSea", player: 0, type: "trireme", x: 20, y: 20, cargo: 1 });

    const safe = sea(10, 20);
    round(safe.s);
    expect(safe.s.units).toHaveLength(2);

    const old = sea(20, 20);
    old.s.safeTriremes = true;
    round(old.s);
    expect(old.s.units).toHaveLength(2);
    expect(loadSave({ ...makeSave(newGame(7), {}, []), version: 34 as const }, () => {}).state.safeTriremes).toBe(true);
  });

  it("cross deep water on their gotos only where the turn ends beside land", () => {
    const { s, ship } = sea(10, 12);
    // Never to deep water; across the open sea only a ship that need not hug the coast goes.
    expect(findPath(s, ship, 20, 20)).toBeNull();
    const around = findPath(s, ship, 30, 20)!;
    expect(around.length).toBeGreaterThan(findPath(s, { ...ship, type: "sail" }, 30, 20)!.length);
    // Three steps a turn: every third square is where a turn ends, beside land.
    around.forEach(([x, y], i) => { if (i % 3 === 2) expect(deepWater(s, x, y), `${x},${y}`).toBe(false); });
    s.safeTriremes = true;
    expect(findPath(s, ship, 20, 20)).not.toBeNull();

    // A strait three squares wide, its middle row deep: crossed in one turn, or after a step along the shore when one move is left.
    const t = flatWorld();
    for (let y = 19; y <= 21; y++) for (let x = 10; x <= 30; x++) getTile(t.map, x, y)!.terrain = Terrain.Ocean;
    const boat = createUnit(t, "trireme", 0, 15, 19);
    expect(deepWater(t, 15, 20)).toBe(true);
    expect(findPath(t, boat, 15, 21)).toHaveLength(2);
    boat.movesLeft = 3;
    const late = findPath(t, boat, 15, 21)!;
    expect(late).toHaveLength(3);
    expect(deepWater(t, ...late[0]!)).toBe(false);
    // Walked as a goto, it never stands on deep water as a turn ends.
    expect(applyCommand(t, { type: "goto", unit: boat.id, x: 15, y: 21 }).ok).toBe(true);
    for (let r = 0; r < 3 && boat.order.kind === "goto"; r++) {
      expect(deepWater(t, boat.x, boat.y)).toBe(false);
      round(t);
    }
    expect([boat.x, boat.y]).toEqual([15, 21]);
    expect(t.units).toContain(boat);
  });

  it("are not halted on deep water by meeting a new people, as other units are", () => {
    const s = newGame(1, { opponents: 1, classicCivs: true });
    for (const t of s.map.tiles) Object.assign(t, { terrain: Terrain.Grassland, river: false, hut: false });
    for (let y = 10; y <= 30; y++) for (let x = 10; x <= 30; x++) getTile(s.map, x, y)!.terrain = Terrain.Ocean;
    s.units = [];
    s.cities = [];
    const ship = createUnit(s, "trireme", 0, 10, 20);
    createUnit(s, "trireme", 1, 12, 21);
    expect(applyCommand(s, { type: "move", unit: ship.id, dx: 1, dy: 0 }).ok).toBe(true);
    expect(lastTurnEvents).toContainEqual({ kind: "contact", player: 1 });
    expect(deepWater(s, 11, 20)).toBe(true);
    expect(ship.movesLeft).toBeGreaterThan(0);
  });
});

describe("camping", () => {
  it("heals a wounded unit as in a fortress, skips it until whole, then wakes it; a whole unit has nothing to heal", () => {
    const s = flatWorld();
    const u = createUnit(s, "legion", 0, 20, 20);
    expect(applyCommand(s, { type: "camp", unit: u.id })).toEqual({ ok: false, reason: "not wounded" });
    u.hp = 2;
    const other = createUnit(s, "legion", 0, 30, 20);
    expect(applyCommand(s, { type: "camp", unit: u.id }).ok).toBe(true);
    expect(u.order.kind).toBe("camp");
    expect(s.activeUnit).toBe(other.id);
    applyCommand(s, { type: "sentry", unit: other.id });
    // A quarter of its hit points a turn (of a legion's 10, 2.5 rounded up), where the field heals a tenth.
    const round = () => { do applyCommand(s, { type: "endTurn" }); while (s.currentPlayer !== 0); };
    const hp = [u.hp];
    for (let t = 0; t < 3; t++) { round(); hp.push(u.hp); }
    expect(hp).toEqual([2, 5, 8, 10]);
    expect(u.order.kind).toBe("none");
    expect(s.activeUnit).toBe(u.id);
    // Moving breaks camp.
    u.hp = 4;
    applyCommand(s, { type: "camp", unit: u.id });
    applyCommand(s, { type: "activate", unit: u.id });
    expect(u.order.kind).toBe("none");
  });
});

describe("settlers", () => {
  it("found a city only three squares from every other, and never fortify; old saves keep two squares and fortified settlers", () => {
    for (const loose of [false, true]) {
      const s = flatWorld();
      if (loose) s.looseSettlers = true;
      s.cities = [];
      foundCity(s, 1, 20, 20);
      expect(canFoundCity(s, 21, 21)).toBe("too close to another city");
      expect(canFoundCity(s, 22, 18)).toBe(loose ? null : "too close to another city");
      expect(canFoundCity(s, 23, 20)).toBeNull();
      // Round the wrap too.
      foundCity(s, 1, 0, 10);
      expect(canFoundCity(s, s.map.width - 2, 10)).toBe(loose ? null : "too close to another city");
      const settlers = createUnit(s, "settlers", 0, 30, 30);
      expect(applyCommand(s, { type: "fortify", unit: settlers.id }).ok).toBe(loose);
      const soldier = createUnit(s, "militia", 0, 32, 30);
      expect(applyCommand(s, { type: "fortify", unit: soldier.id }).ok).toBe(true);
    }
    expect(loadSave({ ...makeSave(newGame(7), {}, []), version: 33 as const }, () => {}).state.looseSettlers).toBe(true);
    expect(loadSave(makeSave(newGame(7), {}, []), () => {}).state.looseSettlers).toBeUndefined();
  });
});

describe("new game", () => {
  it("starts with settlers on a city site with visibility", () => {
    const s = newGame(77);
    expect(s.units.length).toBeGreaterThanOrEqual(1);
    const u = s.units[0]!;
    const t = getTile(s.map, u.x, u.y)!;
    expect(siteScore(s, u.x, u.y)).not.toBeNull();
    expect(s.players[0]!.visible[u.y * 80 + u.x]).toBe(1);
    expect(s.activeUnit).toBe(u.id);
    expect(t.continent).toBeGreaterThan(0);
  });

  it("moves each start onto the best site within two squares of the square drawn; old saves keep the square drawn", () => {
    let better = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const drawn = newGame(seed, { opponents: 3, randomStarts: true });
      const now = newGame(seed, { opponents: 3 });
      for (const p of now.players) {
        if (p.id === now.barbarians) continue;
        const a = drawn.units.find((x) => x.owner === p.id)!;
        const b = now.units.find((x) => x.owner === p.id)!;
        // The old starts are plain open land, as before.
        expect([Terrain.Grassland, Terrain.Plains]).toContain(getTile(drawn.map, a.x, a.y)!.terrain);
        expect(Math.max(Math.min(Math.abs(a.x - b.x), 80 - Math.abs(a.x - b.x)), Math.abs(a.y - b.y))).toBeLessThanOrEqual(2);
        expect(siteScore(now, b.x, b.y)!).toBeGreaterThanOrEqual(siteScore(drawn, a.x, a.y) ?? -Infinity);
        if (a.x !== b.x || a.y !== b.y) better++;
      }
      // The same world either way: only the starts moved.
      expect(now.map.tiles.map((t) => t.terrain)).toEqual(drawn.map.tiles.map((t) => t.terrain));
    }
    expect(better).toBeGreaterThan(20);
  });
});

describe("tribal villages", () => {
  it("report the player whose unit entered them", () => {
    const s = newGame(1, { opponents: 1 });
    for (const t of s.map.tiles) { t.terrain = Terrain.Grassland; t.hut = false; }
    s.units = [];
    const u = createUnit(s, "militia", 0, 10, 10);
    getTile(s.map, 11, 10)!.hut = true;
    expect(applyCommand(s, { type: "move", unit: u.id, dx: 1, dy: 0 }).ok).toBe(true);
    const ev = lastTurnEvents.find((e) => e.kind === "hut");
    expect(ev && ev.kind === "hut" && ev.player).toBe(0);
    expect(getTile(s.map, 11, 10)!.hut).toBe(false);
  });
});
