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
  type GameState,
} from "../src/index.js";

function flatWorld(terrain = Terrain.Grassland, classicTerrain = false): GameState {
  const s = newGame(1, { opponents: 1, ...(classicTerrain ? { classicTerrain } : {}) });
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
    for (const rough of [Terrain.Mountains, Terrain.Jungle, Terrain.Swamp, Terrain.Arctic]) {
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

  it("routes wheels through the one road across a mountain range", () => {
    const s = flatWorld();
    // Ranges on both sides, or the chariot just drives round the world.
    for (let y = 0; y < s.map.height; y++) for (const x of [8, 12]) getTile(s.map, x, y)!.terrain = Terrain.Mountains;
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

  it("is open to everyone under the 1991 terrain rules", () => {
    const s = flatWorld(Terrain.Grassland, true);
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
    expect(rest(flatWorld(Terrain.Desert, true), "militia", 5)).toBe(6);
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
