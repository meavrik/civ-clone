import { describe, expect, it } from "vitest";
import {
  applyCommand,
  attrition,
  canEnter,
  createUnit,
  findPath,
  foundCity,
  getTile,
  lastCombat,
  loadSave,
  makeSave,
  newGame,
  setRelation,
  Terrain,
  unitType,
  workOptions,
  type GameState,
  type NewGameOptions,
} from "../src/index.js";

function flatWorld(terrain = Terrain.Grassland, opts: NewGameOptions = {}): GameState {
  const s = newGame(1, { opponents: 1, ...opts });
  for (const t of s.map.tiles) {
    t.terrain = terrain;
    t.river = false; t.road = false; t.irrigation = false; t.mine = false; t.special = false; t.hut = false;
    t.railroad = false; t.fortress = false; t.pollution = false;
  }
  s.units = [];
  s.cities = [];
  return s;
}

const move = (s: GameState, unit: number, dx: number, dy: number) => applyCommand(s, { type: "move", unit, dx, dy });

describe("rough ground", () => {
  it("takes wheeled units only along a road, and every other land unit anywhere", () => {
    for (const rough of [Terrain.Jungle, Terrain.Swamp, Terrain.Arctic]) {
      const s = flatWorld();
      getTile(s.map, 11, 10)!.terrain = rough;
      const chariot = createUnit(s, "chariot", 0, 10, 10);
      expect(move(s, chariot.id, 1, 0)).toEqual({ ok: false, reason: "rough" });
      const militia = createUnit(s, "militia", 0, 10, 10);
      expect(move(s, militia.id, 1, 0).ok).toBe(true);
      getTile(s.map, 11, 10)!.road = true;
      expect(move(s, chariot.id, 1, 0).ok).toBe(true);
    }
    for (const open of [Terrain.Hills, Terrain.Forest, Terrain.Desert, Terrain.Tundra]) {
      const s = flatWorld();
      getTile(s.map, 11, 10)!.terrain = open;
      expect(move(s, createUnit(s, "armor", 0, 10, 10).id, 1, 0).ok).toBe(true);
    }
  });

  it("lets wheels into a city on rough ground and lets them attack onto it", () => {
    const s = flatWorld();
    getTile(s.map, 11, 10)!.terrain = Terrain.Mountains;
    foundCity(s, 0, 11, 10);
    expect(move(s, createUnit(s, "catapult", 0, 10, 10).id, 1, 0).ok).toBe(true);

    getTile(s.map, 11, 12)!.terrain = Terrain.Jungle;
    createUnit(s, "militia", 1, 11, 12);
    setRelation(s, 0, 1, "war");
    const chariot = createUnit(s, "chariot", 0, 10, 12);
    expect(move(s, chariot.id, 1, 0).ok).toBe(true);
    expect(lastCombat).not.toBeNull();
  });

  it("keeps wheels from landing on rough ground off a ship", () => {
    const s = flatWorld();
    getTile(s.map, 11, 10)!.terrain = Terrain.Ocean;
    getTile(s.map, 12, 10)!.terrain = Terrain.Swamp;
    const ship = createUnit(s, "trireme", 0, 11, 10);
    const cannon = createUnit(s, "cannon", 0, 11, 10);
    cannon.aboard = ship.id;
    expect(move(s, cannon.id, 1, 0)).toEqual({ ok: false, reason: "rough" });
    getTile(s.map, 12, 10)!.terrain = Terrain.Plains;
    expect(move(s, cannon.id, 1, 0).ok).toBe(true);
  });

  it("routes wheels through the one road across a jungle belt", () => {
    const s = flatWorld();
    // Belts on both sides, or the chariot just drives round the world.
    for (let y = 0; y < s.map.height; y++) for (const x of [8, 12]) getTile(s.map, x, y)!.terrain = Terrain.Jungle;
    const chariot = createUnit(s, "chariot", 0, 10, 10);
    const militia = createUnit(s, "militia", 0, 10, 10);
    expect(findPath(s, chariot, 14, 10)).toBeNull();
    expect(findPath(s, militia, 14, 10)).not.toBeNull();

    getTile(s.map, 12, 14)!.road = true;
    const path = findPath(s, chariot, 14, 10)!;
    expect(path).toContainEqual([12, 14]);
    for (const [x, y] of path) expect(canEnter(s, unitType("chariot"), getTile(s.map, x, y)!)).toBe(true);

    // A goto may end in an attack onto rough ground, never cross it.
    createUnit(s, "militia", 1, 12, 9);
    const attack = findPath(s, chariot, 12, 9)!;
    expect(attack).toHaveLength(2);
    expect(attack[1]).toEqual([12, 9]);
  });
});

describe("mountains", () => {
  it("take only settlers off the road, who can build the road for everyone else", () => {
    const s = flatWorld();
    getTile(s.map, 11, 10)!.terrain = Terrain.Mountains;
    const others = ["militia", "legion", "knights", "chariot", "diplomat", "caravan"].map((t) => createUnit(s, t, 0, 10, 10));
    for (const u of others) expect(move(s, u.id, 1, 0)).toEqual({ ok: false, reason: "steep" });
    const settlers = createUnit(s, "settlers", 0, 10, 10);
    expect(move(s, settlers.id, 1, 0).ok).toBe(true);
    expect(workOptions(s, settlers).road).toBeGreaterThan(0);
    getTile(s.map, 11, 10)!.road = true;
    for (const u of others) expect(move(s, u.id, 1, 0).ok).toBe(true);
  });

  it("can be attacked from below, and landed on from a ship only by settlers or along a road", () => {
    const s = flatWorld();
    getTile(s.map, 11, 10)!.terrain = Terrain.Mountains;
    createUnit(s, "militia", 1, 11, 10);
    setRelation(s, 0, 1, "war");
    expect(move(s, createUnit(s, "legion", 0, 10, 10).id, 1, 0).ok).toBe(true);
    expect(lastCombat).not.toBeNull();

    getTile(s.map, 11, 12)!.terrain = Terrain.Ocean;
    getTile(s.map, 12, 12)!.terrain = Terrain.Mountains;
    const ship = createUnit(s, "trireme", 0, 11, 12);
    const [soldier, settlers] = ["militia", "settlers"].map((t) => Object.assign(createUnit(s, t, 0, 11, 12), { aboard: ship.id }));
    expect(move(s, soldier!.id, 1, 0)).toEqual({ ok: false, reason: "steep" });
    expect(move(s, settlers!.id, 1, 0).ok).toBe(true);
  });

  it("route soldiers over a range by its road and settlers straight across", () => {
    const s = flatWorld();
    for (let y = 0; y < s.map.height; y++) for (const x of [8, 12]) getTile(s.map, x, y)!.terrain = Terrain.Mountains;
    const militia = createUnit(s, "militia", 0, 10, 10);
    const settlers = createUnit(s, "settlers", 0, 10, 10);
    expect(findPath(s, militia, 14, 10)).toBeNull();
    expect(findPath(s, settlers, 14, 10)).not.toBeNull();
    getTile(s.map, 12, 14)!.road = true;
    expect(findPath(s, militia, 14, 10)).toContainEqual([12, 14]);
  });

  it("stay open to every land unit in games saved before the rule", () => {
    const s = flatWorld(Terrain.Grassland, { openMountains: true });
    getTile(s.map, 11, 10)!.terrain = Terrain.Mountains;
    expect(move(s, createUnit(s, "militia", 0, 10, 10).id, 1, 0).ok).toBe(true);
    expect(move(s, createUnit(s, "chariot", 0, 10, 10).id, 1, 0)).toEqual({ ok: false, reason: "rough" });
    const opts = { opponents: 1 as const };
    const state = newGame(321, opts);
    expect(loadSave({ ...makeSave(state, opts, []), version: 6 as const }, () => {}).state.openMountains).toBe(true);
    expect(loadSave(makeSave(state, opts, []), () => {}).state.openMountains).toBeUndefined();
  });

  it("is open to everyone under the 1991 terrain rules", () => {
    const s = flatWorld(Terrain.Grassland, { classicTerrain: true });
    getTile(s.map, 11, 10)!.terrain = Terrain.Mountains;
    const chariot = createUnit(s, "chariot", 0, 10, 10);
    expect(findPath(s, chariot, 11, 10)).toEqual([[11, 10]]);
    expect(move(s, chariot.id, 1, 0).ok).toBe(true);
  });
});

describe("harsh ground", () => {
  /** End player 0's turn with one unit resting at (30, 10). */
  function rest(s: GameState, type: string, hp?: number) {
    const u = createUnit(s, type, 0, 30, 10);
    if (hp !== undefined) u.hp = hp;
    applyCommand(s, { type: "endTurn" });
    return u.hp;
  }

  it("wears down units in the desert and the arctic instead of healing them, never to death", () => {
    expect(rest(flatWorld(Terrain.Desert), "militia")).toBe(9);
    expect(rest(flatWorld(Terrain.Desert), "militia", 5)).toBe(4);
    expect(rest(flatWorld(Terrain.Desert), "militia", 1)).toBe(1);
    expect(rest(flatWorld(Terrain.Arctic), "militia")).toBe(8);
    expect(rest(flatWorld(Terrain.Arctic), "musketeers")).toBe(16);
    expect(rest(flatWorld(Terrain.Tundra), "militia", 5)).toBe(6);
  });

  it("spares units near their own cities, on water or a special, and once the cure is known", () => {
    const near = flatWorld(Terrain.Desert);
    foundCity(near, 0, 32, 11);
    expect(rest(near, "militia", 5)).toBe(6);
    const foreign = flatWorld(Terrain.Desert);
    foundCity(foreign, 1, 32, 11);
    expect(rest(foreign, "militia", 5)).toBe(4);

    const river = flatWorld(Terrain.Desert);
    getTile(river.map, 30, 10)!.river = true;
    expect(rest(river, "militia", 5)).toBe(6);
    const oasis = flatWorld(Terrain.Desert);
    getTile(oasis.map, 30, 10)!.special = true;
    expect(rest(oasis, "militia", 5)).toBe(6);

    const traders = flatWorld(Terrain.Desert);
    traders.players[0]!.advances.push("trade");
    expect(rest(traders, "militia", 5)).toBe(6);
    const arctic = flatWorld(Terrain.Arctic);
    arctic.players[0]!.advances.push("trade");
    expect(attrition(arctic, 0, 30, 10)).toBe(0.2);
    arctic.players[0]!.advances.push("medicine");
    expect(rest(arctic, "militia", 5)).toBe(6);
  });

  it("wears nobody down under the 1991 terrain rules", () => {
    expect(rest(flatWorld(Terrain.Desert, { classicTerrain: true }), "militia", 5)).toBe(6);
  });

  it("is off in games saved before it existed", () => {
    const opts = { opponents: 1 as const };
    const state = newGame(321, opts);
    const old = loadSave({ ...makeSave(state, opts, []), version: 2 }, () => {});
    expect(old.state.classicTerrain).toBe(true);
    expect(old.options.classicTerrain).toBe(true);
    expect(old.state.classicCombat).toBeUndefined();
    expect(loadSave(makeSave(state, opts, []), () => {}).state.classicTerrain).toBeUndefined();
  });
});
