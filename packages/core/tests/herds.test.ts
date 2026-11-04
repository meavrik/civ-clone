import { describe, expect, it } from "vitest";
import {
  foundCity,
  heldResources,
  HERDS,
  isStrategic,
  loadSave,
  makeSave,
  newGame,
  resourceAt,
  resourceSquares,
  SAVE_VERSION,
  SPECIAL_SPACING,
  specialOf,
  Terrain,
  tileYield,
  type GameState,
  type Tile,
} from "../src/index.js";

const HERD_NAMES = HERDS.map((h) => h.id);

/** A square of `terrain` holding a herd of `id`, off the shield bands, in a game whose player knows `advances`. */
function herd(id: string, terrain: Terrain, advances: string[]): { state: GameState; tile: Tile } {
  const state = newGame(1, { opponents: 1 });
  state.players[0]!.advances = advances;
  const tile: Tile = { ...state.map.tiles[0]!, terrain, special: true, deposit: id, river: false, road: false, grassShield: false };
  return { state, tile };
}

/** A square's yield for the player under a Monarchy (no Despotism's -1 over two). */
const yields = ({ state, tile }: { state: GameState; tile: Tile }) => {
  const { food, shields, trade } = tileYield(state, tile, false, "monarchy", 0);
  return [food, shields, trade];
};

describe("herds (save version 61)", () => {
  it("graze their own land on new worlds only, apart from their kind, every other special where it was", () => {
    const seen: Record<string, number> = {};
    for (const seed of [3, 8, 13]) {
      // The worlds as version 68 spread them: since version 69 no special keeps its place for a herd's sake.
      const s = newGame(seed, { opponents: 3, crowdedResources: true });
      const old = newGame(seed, { opponents: 3, catalogue: 60, crowdedResources: true });
      const at = new Map<string, [number, number][]>();
      s.map.tiles.forEach((t, i) => {
        const name = specialOf(t)?.name;
        if (name && HERD_NAMES.includes(name)) {
          seen[name] = (seen[name] ?? 0) + 1;
          expect(t.deposit).toBe(name);
          expect(HERDS.find((h) => h.id === name)!.deposits[t.terrain], `${name} on ${Terrain[t.terrain]}`).toBeGreaterThan(0);
          // A square that held nothing before.
          expect(old.map.tiles[i]!.special, `${seed}:${i}`).toBe(false);
          at.set(name, [...(at.get(name) ?? []), [i % s.map.width, Math.floor(i / s.map.width)]]);
        }
        // Off the arctic, whose lattice is all Seals since Ivory went (save version 62), which an older catalogue still lays.
        else if (t.terrain !== Terrain.Arctic) expect([t.special, t.deposit, t.secondSpecial], `${seed}:${i}`).toEqual([old.map.tiles[i]!.special, old.map.tiles[i]!.deposit, old.map.tiles[i]!.secondSpecial]);
      });
      // None of a kind within two squares of another.
      for (const squares of at.values())
        squares.forEach(([x, y], a) => squares.forEach(([u, v], b) => {
          if (a === b) return;
          const dx = Math.min(Math.abs(x - u), s.map.width - Math.abs(x - u));
          expect(Math.max(dx, Math.abs(y - v))).toBeGreaterThanOrEqual(SPECIAL_SPACING);
        }));
      expect(old.map.tiles.some((t) => t.deposit && HERD_NAMES.includes(t.deposit))).toBe(false);
    }
    for (const name of HERD_NAMES) expect(seen[name] ?? 0, name).toBeGreaterThan(10);
  });

  it("are left out of games saved before version 61", () => {
    const s = newGame(3, { opponents: 2 });
    const save = makeSave(s, { opponents: 2 }, []);
    expect(save.version).toBe(SAVE_VERSION);
    const old = loadSave({ ...save, version: 60 as const }, () => {}).state;
    expect(old.catalogue).toBe(60);
    expect(old.map.tiles.some((t) => t.deposit && HERD_NAMES.includes(t.deposit))).toBe(false);
    expect(loadSave(save, () => {}).state.map.tiles).toEqual(s.map.tiles);
  });

  it("yield more with Animal Husbandry, and sheep's wool with Weaving", () => {
    // Plains 1/1/0: Sheep a food, Animal Husbandry a food more, Weaving a trade.
    expect(yields(herd("Sheep", Terrain.Plains, []))).toEqual([2, 1, 0]);
    expect(yields(herd("Sheep", Terrain.Plains, ["animal_husbandry"]))).toEqual([3, 1, 0]);
    expect(yields(herd("Sheep", Terrain.Plains, ["weaving"]))).toEqual([2, 1, 1]);
    expect(yields(herd("Sheep", Terrain.Plains, ["animal_husbandry", "weaving"]))).toEqual([3, 1, 1]);
    // Desert 0/1/0: Camels a food and two trade, Animal Husbandry a food more.
    expect(yields(herd("Camels", Terrain.Desert, []))).toEqual([1, 1, 2]);
    expect(yields(herd("Camels", Terrain.Desert, ["animal_husbandry"]))).toEqual([2, 1, 2]);
    // Grassland 2/0/0: Bison a shield, Animal Husbandry a food.
    expect(yields(herd("Bison", Terrain.Grassland, []))).toEqual([2, 1, 0]);
    expect(yields(herd("Bison", Terrain.Grassland, ["animal_husbandry"]))).toEqual([3, 1, 0]);
    // Tundra 1/0/0: Reindeer a food and a shield, Animal Husbandry a food more.
    expect(yields(herd("Reindeer", Terrain.Tundra, []))).toEqual([2, 1, 0]);
    expect(yields(herd("Reindeer", Terrain.Tundra, ["animal_husbandry"]))).toEqual([3, 1, 0]);
  });

  it("put Reindeer on the tundra since save version 68, and in no game saved before", () => {
    const opts = { opponents: 2 as const };
    const s = newGame(3, opts);
    const reindeer = (g: GameState) => g.map.tiles.filter((t) => t.deposit === "Reindeer");
    expect(reindeer(s).length).toBeGreaterThan(0);
    for (const t of reindeer(s)) expect(t.terrain).toBe(Terrain.Tundra);
    const old = loadSave({ ...makeSave(s, opts, []), version: 67 as const }, () => {}).state;
    expect(old.catalogue).toBe(67);
    expect(reindeer(old)).toEqual([]);
  });

  it("are not strategic: no unit needs them, no one holds or trades them", () => {
    const s = newGame(8, { opponents: 1 });
    const i = s.map.tiles.findIndex((t) => t.deposit === "Sheep");
    expect(i).toBeGreaterThanOrEqual(0);
    const x = i % s.map.width, y = Math.floor(i / s.map.width);
    expect(isStrategic(specialOf(s.map.tiles[i]!))).toBe(false);
    expect(resourceAt(s, x, y)).toBeNull();
    // A city on it: its land holds the sheep, roaded, and they are no resource of its civilization's.
    foundCity(s, 0, x, y);
    expect(specialOf(s.map.tiles[i]!)?.name).toBe("Sheep");
    expect(resourceSquares(s, 0, true).has("Sheep")).toBe(false);
    expect(heldResources(s, 0).has("Sheep")).toBe(false);
  });
});

describe("Ivory (gone since save version 62)", () => {
  it("lies in no new world, the arctic holding only its Seals, and stays in games saved before", () => {
    const ivory = (s: GameState) => s.map.tiles.filter((t) => specialOf(t)?.name === "Ivory").length;
    let before = 0;
    for (const seed of [2, 6, 10]) {
      const s = newGame(seed, { opponents: 2 });
      expect(ivory(s), `${seed}`).toBe(0);
      for (const t of s.map.tiles) if (t.terrain === Terrain.Arctic && t.special && !t.deposit) expect(specialOf(t)?.name).toBe("Seals");
      const old = loadSave({ ...makeSave(s, { opponents: 2 }, []), version: 61 as const }, () => {}).state;
      expect(old.catalogue).toBe(61);
      before += ivory(old);
    }
    expect(before).toBeGreaterThan(0);
  });
});
