import { describe, expect, it } from "vitest";
import {
  applyCommand,
  CITY_RADIUS,
  cityTileYield,
  createUnit,
  foundCity,
  getTile,
  heldResources,
  loadSave,
  makeSave,
  newGame,
  RESOURCE_BY_ID,
  resourceHoldings,
  resourceRoaded,
  specialOf,
  Terrain,
  whyNoRig,
  type GameState,
} from "../src/index.js";

/** One civ on a flat grassland world with no specials, its city by the sea, knowing Seafaring and Refining. */
function world(): { s: GameState; oil: ReturnType<typeof getTile> & object } {
  const s = newGame(1, { opponents: 1 });
  for (const t of s.map.tiles) {
    t.terrain = Terrain.Grassland;
    t.river = false; t.road = false; t.irrigation = false; t.mine = false; t.special = false; t.hut = false;
    delete t.deposit; delete t.fishery; delete t.rig;
  }
  s.units = []; s.cities = [];
  for (const p of s.players) { p.advances = ["pottery", "alphabet", "map_making", "seafaring", "refining"]; p.government = "monarchy"; }
  const oil = getTile(s.map, 11, 10)!;
  oil.terrain = Terrain.Ocean;
  oil.special = true;
  oil.deposit = "Oil";
  foundCity(s, 0, 10, 10);
  return { s, oil };
}

const slotOf = (dx: number, dy: number) => CITY_RADIUS.findIndex(([x, y]) => x === dx && y === dy);
const landDistance = (s: GameState, x: number, y: number) => {
  for (let r = 1; r <= 3; r++)
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        const t = getTile(s.map, x + dx, y + dy);
        if (Math.max(Math.abs(dx), Math.abs(dy)) === r && t && t.terrain !== Terrain.Ocean) return r;
      }
  return 4;
};

describe("Oil at sea (save version 55)", () => {
  it("lies on open sea within two squares of land, on new worlds only, every land deposit where it was", () => {
    let seen = 0;
    for (const seed of [2, 5, 9]) {
      // The worlds as laid, before specials of a kind were spread apart (version 57, `clusteredResources`).
      const s = newGame(seed, { clusteredResources: true, catalogue: 60 });
      const old = newGame(seed, { catalogue: 54, clusteredResources: true });
      s.map.tiles.forEach((t, i) => {
        const x = i % s.map.width, y = Math.floor(i / s.map.width);
        if (t.terrain === Terrain.Ocean && t.deposit) {
          seen++;
          expect(t.deposit).toBe("Oil");
          expect(specialOf(t)?.name).toBe("Oil");
          expect(landDistance(s, x, y)).toBeLessThanOrEqual(RESOURCE_BY_ID.Oil!.offshore!.within);
          expect(old.map.tiles[i]!.deposit, `${seed}:${i}`).toBeUndefined();
        } else expect(old.map.tiles[i]!.deposit, `${seed}:${i}`).toBe(t.deposit);
      });
      // The players start where they did, and the city-states stand where they did (a site counts no oil at sea).
      const starts = (g: GameState) => g.units.map((u) => `${u.owner}:${u.x},${u.y}`).sort();
      expect(starts(s)).toEqual(starts(old));
      const states = (g: GameState) => g.cities.map((c) => `${c.cityState}:${c.x},${c.y}`);
      expect(states(newGame(seed, { cityStates: true, clusteredResources: true, catalogue: 60 }))).toEqual(states(newGame(seed, { cityStates: true, catalogue: 54, clusteredResources: true })));
    }
    expect(seen).toBeGreaterThan(20);
  });

  it("serves its civilization only with an oil rig a Fishing Boat builds, with Refining, in its own waters", () => {
    const { s, oil } = world();
    expect(resourceRoaded(s, oil)).toBe(false);
    expect(resourceHoldings(s, 0).find((h) => h.id === "Oil")).toMatchObject({ own: 0, unroaded: 1, unrigged: 1 });
    expect(heldResources(s, 0).has("Oil")).toBe(false);
    const boat = createUnit(s, "fishing_boat", 0, 11, 10);
    // Refining reveals the oil and lets the boat build; without it the boat sees plain sea.
    s.players[0]!.advances = s.players[0]!.advances.filter((a) => a !== "refining");
    expect(whyNoRig(s, boat)).toBe("no oil");
    s.players[0]!.advances.push("refining");
    expect(whyNoRig(s, createUnit(s, "trireme", 0, 11, 10))).toBe("not a fishing boat");
    s.units.pop();
    expect(whyNoRig(s, boat)).toBeNull();
    const plain = cityTileYield(s, s.cities[0]!, slotOf(1, 0))!;
    expect(applyCommand(s, { type: "rig", unit: boat.id }).ok).toBe(true);
    expect(oil.rig).toBe(true);
    expect(s.units.some((u) => u.id === boat.id)).toBe(false);
    expect(heldResources(s, 0).has("Oil")).toBe(true);
    expect(resourceHoldings(s, 0).find((h) => h.id === "Oil")).toMatchObject({ own: 1, unroaded: 0, unrigged: 0 });
    // The rig's own shield, as a mine adds to the land; the oil adds none.
    expect(cityTileYield(s, s.cities[0]!, slotOf(1, 0))).toEqual({ ...plain, shields: plain.shields + RESOURCE_BY_ID.Oil!.offshore!.rig.shields });
    // Never twice, never off our waters, never on land oil, never on fish.
    expect(whyNoRig(s, createUnit(s, "fishing_boat", 0, 11, 10))).toBe("has rig");
    const far = getTile(s.map, 40, 30)!;
    Object.assign(far, { terrain: Terrain.Ocean, special: true, deposit: "Oil" });
    expect(whyNoRig(s, createUnit(s, "fishing_boat", 0, 40, 30))).toBe("not our waters");
    const fish = getTile(s.map, 10, 11)!;
    Object.assign(fish, { terrain: Terrain.Ocean, special: true });
    delete fish.deposit;
    expect(whyNoRig(s, createUnit(s, "fishing_boat", 0, 10, 11))).toBe("no oil");
  });

  it("wants Refining for the rig even where the oil shows by another advance", () => {
    const { s } = world();
    // Automobile's Armor needs Oil, so its advance shows the oil too (`resourceRevealers`).
    s.players[0]!.advances = s.players[0]!.advances.filter((a) => a !== "refining").concat("automobile");
    expect(whyNoRig(s, createUnit(s, "fishing_boat", 0, 11, 10))).toBe("needs:refining");
  });

  it("is left out of older games, which load knowing only what their version knew", () => {
    const save = makeSave(newGame(5, { opponents: 1 }), {}, []);
    for (const v of [53, 54] as const) {
      const old = loadSave({ ...save, version: v }, () => {}).state;
      expect(old.catalogue).toBe(v);
      expect(old.map.tiles.some((t) => t.terrain === Terrain.Ocean && t.deposit)).toBe(false);
    }
    const now = loadSave(save, () => {}).state;
    expect(now.catalogue).toBeUndefined();
    expect(now.map.tiles.some((t) => t.terrain === Terrain.Ocean && t.deposit === "Oil")).toBe(true);
    // A boat of an older game builds no rig, whatever lies under it.
    const { s } = world();
    s.catalogue = 54;
    expect(whyNoRig(s, createUnit(s, "fishing_boat", 0, 11, 10))).toBe("no oil");
  });
});
