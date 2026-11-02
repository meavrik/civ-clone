import { describe, expect, it } from "vitest";
import {
  advancesFor,
  applyCommand,
  buildOptions,
  CITY_RADIUS,
  cityTileYield,
  createUnit,
  defenseStrength,
  findPath,
  foundCity,
  FRIGHTENED,
  getTile,
  loadSave,
  makeSave,
  newGame,
  RESOURCES,
  resourcesIn,
  setRelation,
  siteScore,
  specialOf,
  Terrain,
  trespassOn,
  unitChoices,
  unitRetired,
  whyNoFishery,
  type City,
  type GameState,
} from "../src/index.js";

/** Two civs met at peace on a flat grassland world with no specials, knowing the advances of version 53's additions. */
function world(): GameState {
  const s = newGame(1, { opponents: 1 });
  for (const t of s.map.tiles) {
    t.terrain = Terrain.Grassland;
    t.river = false; t.road = false; t.irrigation = false; t.mine = false; t.special = false; t.hut = false;
    delete t.deposit;
    delete t.fishery;
  }
  s.units = []; s.cities = [];
  for (const p of s.players) p.advances = ["pottery", "alphabet", "map_making", "seafaring", "archery", "animal_husbandry", "horseback_riding", "bronze_working"];
  setRelation(s, 0, 1, "peace");
  // Out of Despotism, whose -1 on yields over two would hide the gains.
  for (const p of s.players) p.government = "monarchy";
  return s;
}

function sea(s: GameState, x: number, y: number): ReturnType<typeof getTile> & object {
  const t = getTile(s.map, x, y)!;
  t.terrain = Terrain.Ocean;
  return t;
}

const slotOf = (dx: number, dy: number) => CITY_RADIUS.findIndex(([x, y]) => x === dx && y === dy);
const ids = (s: GameState, c: City) => buildOptions(s, c).map((p) => p.id);

describe("Seafaring (save version 53)", () => {
  it("brings the Harbour to a city by the sea, and one more food on each ocean square it works", () => {
    const s = world();
    const inland = foundCity(s, 0, 30, 20);
    expect(ids(s, inland)).not.toContain("harbour");
    sea(s, 11, 10);
    const port = foundCity(s, 0, 10, 10);
    expect(ids(s, port)).toContain("harbour");
    const slot = slotOf(1, 0);
    const before = cityTileYield(s, port, slot)!;
    port.buildings.push("harbour");
    expect(cityTileYield(s, port, slot)!.food).toBe(before.food + 1);
    // Land squares gain nothing.
    const land = slotOf(-1, 0);
    port.buildings.pop();
    const landBefore = cityTileYield(s, port, land)!;
    port.buildings.push("harbour");
    expect(cityTileYield(s, port, land)).toEqual(landBefore);
  });

  it("leaves the sea 1 trade until its city has a Harbour, which adds the second (save version 58)", () => {
    const s = world();
    sea(s, 11, 10);
    const port = foundCity(s, 0, 10, 10);
    const slot = slotOf(1, 0);
    expect(cityTileYield(s, port, slot)).toEqual({ food: 1, shields: 0, trade: 1 });
    port.buildings.push("harbour");
    expect(cityTileYield(s, port, slot)).toEqual({ food: 2, shields: 0, trade: 2 });
    // A game saved before version 58 (`richSea`): the sea's 2 trade, and a Harbour of food only.
    s.richSea = true;
    expect(cityTileYield(s, port, slot)).toEqual({ food: 2, shields: 0, trade: 2 });
    port.buildings.pop();
    expect(cityTileYield(s, port, slot)).toEqual({ food: 1, shields: 0, trade: 2 });
    // A site is scored for the trade its sea gives with a Harbour, so starts stand where they did.
    delete s.richSea;
    const score = siteScore(s, 10, 10);
    s.richSea = true;
    expect(siteScore(s, 10, 10)).toBe(score);
    const save = makeSave(newGame(5, { opponents: 1 }), {}, []);
    expect(loadSave({ ...save, version: 57 }, () => {}).state.richSea).toBe(true);
    expect(loadSave(save, () => {}).state.richSea).toBeUndefined();
  });

  it("lets a Fishing Boat lay a fishery on fish or whales in its own waters, and spends it", () => {
    const s = world();
    const t = sea(s, 11, 10);
    foundCity(s, 0, 10, 10);
    const boat = createUnit(s, "fishing_boat", 0, 11, 10);
    expect(whyNoFishery(s, boat)).toBe("no fish");
    const sea0 = cityTileYield(s, s.cities[0]!, slotOf(1, 0))!;
    t.special = true; // Fish: the ocean's first special
    expect(specialOf(t)?.name).toBe("Fish");
    // Fish feed no one until fished (since save version 54): plain sea, then its 2 food and the fishery's 1.
    const plain = cityTileYield(s, s.cities[0]!, slotOf(1, 0))!;
    expect(plain).toEqual(sea0);
    expect(whyNoFishery(s, boat)).toBeNull();
    expect(applyCommand(s, { type: "fishery", unit: boat.id }).ok).toBe(true);
    expect(t.fishery).toBe(true);
    expect(s.units.some((u) => u.id === boat.id)).toBe(false);
    const fished = cityTileYield(s, s.cities[0]!, slotOf(1, 0))!;
    expect(fished.food).toBe(plain.food + 3);
    expect(fished.shields).toBe(plain.shields);
    // A game saved before version 54 (`freeFish`): fish fed a city as they lay, and a fishery added one more.
    s.freeFish = true;
    expect(cityTileYield(s, s.cities[0]!, slotOf(1, 0))!.food).toBe(plain.food + 3);
    t.fishery = false;
    expect(cityTileYield(s, s.cities[0]!, slotOf(1, 0))!.food).toBe(plain.food + 2);
    t.fishery = true;
    delete s.freeFish;
    // Whales give a shield as well.
    t.secondSpecial = true;
    expect(specialOf(t)?.name).toBe("Whales");
    t.fishery = false;
    const whales = cityTileYield(s, s.cities[0]!, slotOf(1, 0))!;
    t.fishery = true;
    expect(cityTileYield(s, s.cities[0]!, slotOf(1, 0))).toEqual({ ...whales, food: whales.food + 1, shields: whales.shields + 1 });
    // Once laid, never twice; never in another civilization's waters; never by another unit.
    const again = createUnit(s, "fishing_boat", 0, 11, 10);
    expect(whyNoFishery(s, again)).toBe("has fishery");
    const far = sea(s, 40, 30);
    far.special = true;
    expect(whyNoFishery(s, createUnit(s, "fishing_boat", 0, 40, 30))).toBe("not our waters");
    expect(whyNoFishery(s, createUnit(s, "trireme", 0, 40, 30))).toBe("not a fishing boat");
  });

  it("sends the Explorer over any ground at a road's cost, up mountains, and no one minds it", () => {
    const s = world();
    for (let x = 11; x <= 13; x++) getTile(s.map, x, 10)!.terrain = Terrain.Mountains;
    const ex = createUnit(s, "explorer", 0, 10, 10);
    const legion = createUnit(s, "phalanx", 0, 10, 11);
    for (let i = 0; i < 3; i++) expect(applyCommand(s, { type: "move", unit: ex.id, dx: 1, dy: 0 }).ok).toBe(true);
    expect([ex.x, ex.movesLeft]).toEqual([13, 0]);
    // A soldier cannot climb them without a road.
    expect(findPath(s, legion, 12, 10)).toBeNull();
    // Foreign land: an explorer is no trespasser, a soldier is.
    foundCity(s, 1, 20, 20);
    ex.x = 21; ex.y = 20;
    legion.x = 19; legion.y = 20;
    expect(trespassOn(s, ex)).toBe(-1);
    expect(trespassOn(s, legion)).toBe(1);
  });

  it("brings Archers with Archery, retired by Gunpowder", () => {
    const s = world();
    const rome = foundCity(s, 0, 10, 10);
    expect(ids(s, rome)).toContain("archers");
    s.players[0]!.advances = s.players[0]!.advances.filter((a) => a !== "archery");
    expect(ids(s, rome)).not.toContain("archers");
    s.players[0]!.advances.push("archery", "gunpowder");
    expect(unitRetired(s, 0, "archers")).toBe(true);
    expect(ids(s, rome)).not.toContain("archers");
  });
});

describe("War Elephants (save version 53)", () => {
  it("lie in the jungle and on the grass or plains beside it, on new worlds only", () => {
    let seen = 0;
    for (const seed of [3, 7, 11]) {
      const s = newGame(seed);
      for (let i = 0; i < s.map.tiles.length; i++) {
        const t = s.map.tiles[i]!;
        if (t.deposit !== "Elephants") continue;
        seen++;
        const x = i % s.map.width, y = Math.floor(i / s.map.width);
        const jungle = (dx: number, dy: number) => getTile(s.map, x + dx, y + dy)?.terrain === Terrain.Jungle;
        expect([Terrain.Jungle, Terrain.Grassland, Terrain.Plains]).toContain(t.terrain);
        expect([-1, 0, 1].some((dx) => [-1, 0, 1].some((dy) => jungle(dx, dy)))).toBe(true);
      }
      // An older game's world holds none, and the other deposits on land lie where they did (at sea, oil since 55), as
      // laid: before specials of a kind were spread apart (version 57, `clusteredResources`).
      const old = newGame(seed, { catalogue: 52, clusteredResources: true });
      expect(old.map.tiles.some((t) => t.deposit === "Elephants")).toBe(false);
      newGame(seed, { clusteredResources: true }).map.tiles.forEach((t, i) => { if (t.deposit !== "Elephants" && t.terrain !== Terrain.Ocean) expect(old.map.tiles[i]!.deposit, `${seed}:${i}`).toBe(t.deposit); });
    }
    expect(seen).toBeGreaterThan(5);
  });

  it("need Elephants on the land, and frighten mounted defenders", () => {
    const s = world();
    const rome = foundCity(s, 0, 10, 10);
    expect(unitChoices(s, rome).find((u) => u.id === "elephants")!.missing).toEqual(["Elephants"]);
    const t = getTile(s.map, 11, 10)!;
    t.special = true; t.deposit = "Elephants"; t.road = true;
    expect(ids(s, rome)).toContain("elephants");
    const elephants = createUnit(s, "elephants", 0, 30, 30);
    const archers = createUnit(s, "archers", 0, 30, 31);
    for (const [type, frightened] of [["cavalry", true], ["chariot", true], ["phalanx", false]] as const) {
      const d = createUnit(s, type, 1, 31, 30);
      const ratio = defenseStrength(s, d, elephants) / defenseStrength(s, d, archers);
      expect(ratio, type).toBeCloseTo(frightened ? FRIGHTENED : 1);
      s.units.pop();
    }
  });
});

describe("older games (catalogue)", () => {
  it("load without anything version 53 brought, and new ones with it all", () => {
    const save = makeSave(newGame(5, { opponents: 1 }), {}, []);
    const old = loadSave({ ...save, version: 52 }, () => {}).state;
    expect(old.catalogue).toBe(52);
    expect(old.freeFish).toBe(true);
    expect(loadSave({ ...save, version: 53 }, () => {}).state.freeFish).toBe(true);
    expect(loadSave(save, () => {}).state.freeFish).toBeUndefined();
    // Every version before loads (49 to 51 had been refused), each with the catalogue it knew.
    for (const v of [48, 49, 50, 51] as const) expect(loadSave({ ...save, version: v }, () => {}).state.catalogue).toBe(v);
    expect(advancesFor(old).some((a) => a.id === "seafaring" || a.id === "archery")).toBe(false);
    expect(resourcesIn(old).map((r) => r.id)).not.toContain("Elephants");
    expect(resourcesIn(newGame(5)).map((r) => r.id)).toEqual(RESOURCES.map((r) => r.id));
    expect(loadSave(save, () => {}).state.catalogue).toBeUndefined();
    // A city of an old game is never offered the new units, whatever it knows.
    old.players[0]!.advances.push("horseback_riding", "archery", "seafaring");
    const c = foundCity(old, 0, old.units[0]!.x, old.units[0]!.y);
    expect(unitChoices(old, c).map((u) => u.id).filter((id) => ["archers", "elephants", "explorer", "fishing_boat"].includes(id))).toEqual([]);
    expect(buildOptions(old, c).some((p) => p.id === "harbour")).toBe(false);
  });
});
