import { describe, expect, it } from "vitest";
import {
  applyCommand,
  autoAssignWorkers,
  buyCost,
  CITY_RADIUS,
  cityYieldGovernment,
  computeCity,
  contentBase,
  createUnit,
  getTile,
  lastTurnEvents,
  loadSave,
  makeSave,
  newGame,
  secondKind,
  shieldsAfterChange,
  slotScore,
  specialOf,
  Terrain,
  TERRAIN_RULES,
  tileYield,
  unitSupport,
  type City,
  type GameState,
} from "../src/index.js";

function flatWorld(): GameState {
  const s = newGame(1, { opponents: 0, classicCivs: true });
  for (const t of s.map.tiles) {
    t.terrain = Terrain.Grassland;
    t.river = false; t.road = false; t.irrigation = false; t.mine = false; t.special = false; t.hut = false;
  }
  s.units = [];
  s.cities = [];
  return s;
}

describe("tile yields", () => {
  it("applies the despotism penalty and improvements", () => {
    const s = flatWorld();
    const t = getTile(s.map, 10, 10)!;
    expect(tileYield(s, t, false, "despotism")).toEqual({ food: 2, shields: 0, trade: 0 });
    t.irrigation = true;
    t.road = true;
    // 3 food -> 2 under despotism; road adds 1 trade on grassland
    expect(tileYield(s, t, false, "despotism")).toEqual({ food: 2, shields: 0, trade: 1 });
    expect(tileYield(s, t, false, "monarchy")).toEqual({ food: 3, shields: 0, trade: 1 });
    t.terrain = Terrain.Hills;
    t.irrigation = false;
    t.mine = true;
    expect(tileYield(s, t, false, "monarchy").shields).toBe(3);
  });

  it("centre tile is auto-irrigated and yields at least one shield", () => {
    const s = flatWorld();
    const t = getTile(s.map, 10, 10)!;
    expect(tileYield(s, t, true, "despotism")).toEqual({ food: 2, shields: 1, trade: 0 });
  });

  it("feeds more from animal specials once their worker's civilization knows Animal Husbandry", () => {
    const s = flatWorld();
    const t = getTile(s.map, 10, 10)!;
    t.terrain = Terrain.Plains;
    t.special = true; // Horses
    expect(tileYield(s, t, false, "monarchy", 0).food).toBe(1);
    s.players[0]!.advances.push("animal_husbandry");
    expect(tileYield(s, t, false, "monarchy", 0).food).toBe(2);
    expect(tileYield(s, t, false, "monarchy").food).toBe(1); // a square nobody works
    t.terrain = Terrain.Forest; // Game
    expect(tileYield(s, t, false, "monarchy", 0).food).toBe(4);
    t.terrain = Terrain.Grassland; // Resources: no animals
    expect(tileYield(s, t, false, "monarchy", 0).food).toBe(2);
  });

  it("gives a terrain's second special its own yield, raised by its advance", () => {
    const s = flatWorld();
    const t = getTile(s.map, 10, 10)!;
    t.terrain = Terrain.Ocean;
    t.special = true;
    expect(specialOf(t)?.name).toBe("Fish");
    expect(tileYield(s, t, false, "monarchy", 0)).toEqual({ food: 3, shields: 0, trade: 2 });
    t.secondSpecial = true;
    expect(specialOf(t)?.name).toBe("Whales");
    expect(tileYield(s, t, false, "monarchy", 0)).toEqual({ food: 2, shields: 1, trade: 2 });
    s.players[0]!.advances.push("navigation");
    expect(tileYield(s, t, false, "monarchy", 0).shields).toBe(2);
    // Oil is little use until Refining.
    t.terrain = Terrain.Desert;
    expect(specialOf(t)?.name).toBe("Oil");
    expect(tileYield(s, t, false, "monarchy", 0).shields).toBe(2);
    s.players[0]!.advances.push("refining");
    expect(tileYield(s, t, false, "monarchy", 0).shields).toBe(5);
    // Hills' wine came with version 18; whales a version before.
    t.terrain = Terrain.Hills;
    expect(specialOf(t)?.name).toBe("Wine");
    expect(secondKind(TERRAIN_RULES[Terrain.Hills], 17)).toBeUndefined();
    expect(secondKind(TERRAIN_RULES[Terrain.Ocean], 17)?.name).toBe("Whales");
  });

  it("scatters both kinds on new worlds, and in an old save's world only the kinds it knew", () => {
    // Eight worlds together, so even the rarer kinds turn up.
    const count = (resources?: number) => {
      const names = new Map<string, number>();
      let specials = 0;
      let terrains = "";
      for (let seed = 1; seed <= 8; seed++) {
        const { map } = newGame(seed, resources === undefined ? {} : { resources });
        for (const t of map.tiles) { const n = specialOf(t)?.name; if (n) names.set(n, (names.get(n) ?? 0) + 1); }
        specials += map.tiles.filter((t) => t.special).length;
        terrains += map.tiles.map((t) => t.terrain).join();
      }
      return { names, specials, terrains };
    };
    const now = count();
    const old = count(16);
    const five = count(17);
    for (const n of ["Whales", "Wheat", "Cotton", "Iron", "Oil", "Silk", "Wine", "Furs", "Ivory", "Spices", "Fruit"]) expect(now.names.get(n) ?? 0, n).toBeGreaterThan(0);
    for (const n of ["Whales", "Wheat", "Cotton", "Oil", "Iron", "Silk", "Wine", "Furs", "Ivory", "Spices", "Fruit"]) expect(old.names.has(n), n).toBe(false);
    for (const n of ["Silk", "Wine", "Furs", "Ivory", "Spices", "Fruit"]) expect(five.names.has(n), n).toBe(false);
    // Whales lay where they did until version 19 placed them by their reach.
    expect(five.names.get("Whales")).toBe(count(18).names.get("Whales"));
    expect(five.specials).toBe(now.specials);
    // The same world, the same squares: only which kind changes.
    expect(now.terrains).toBe(old.terrains);
    expect(now.specials).toBe(old.specials);
  });

  it("keeps fish within two squares of land and whales in deep water", () => {
    for (let seed = 1; seed <= 4; seed++) {
      const { map } = newGame(seed);
      const landNear = (x: number, y: number, r: number) => {
        for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
          const ny = y + dy;
          if (ny < 0 || ny >= map.height) continue;
          if (map.tiles[ny * map.width + (((x + dx) % map.width) + map.width) % map.width]!.terrain !== Terrain.Ocean) return true;
        }
        return false;
      };
      let fish = 0;
      let whales = 0;
      map.tiles.forEach((t, i) => {
        const x = i % map.width;
        const y = Math.floor(i / map.width);
        const name = specialOf(t)?.name;
        if (name === "Fish") { fish++; expect(landNear(x, y, 2), `fish at ${x},${y}`).toBe(true); }
        if (name === "Whales") { whales++; expect(landNear(x, y, 1), `whales at ${x},${y}`).toBe(false); }
      });
      expect(fish).toBeGreaterThan(0);
      expect(whales).toBeGreaterThan(0);
    }
  });
});

describe("modern improvements", () => {
  it("an Automated Office halves corruption again, on top of a courthouse", () => {
    const s = flatWorld();
    for (const [x, y] of [[10, 10], [40, 10]] as const) applyCommand(s, { type: "found", unit: createUnit(s, "settlers", 0, x, y).id });
    for (const t of s.map.tiles) t.river = true;
    const far = s.cities[1]!;
    far.size = 6;
    autoAssignWorkers(s, far);
    far.buildings.push("courthouse");
    const once = computeCity(s, far).corruption;
    far.buildings.push("automated_office");
    const twice = computeCity(s, far).corruption;
    expect(once).toBeGreaterThan(1);
    expect(twice).toBeLessThan(once);
    expect(twice).toBeLessThanOrEqual(Math.ceil(once / 2));
  });
});

describe("cities", () => {
  it("founds a city with the palace, assigns a worker, and removes the settlers", () => {
    const s = flatWorld();
    const u = createUnit(s, "settlers", 0, 10, 10);
    s.activeUnit = u.id;
    expect(applyCommand(s, { type: "found", unit: u.id }).ok).toBe(true);
    expect(s.units.length).toBe(0);
    const c = s.cities[0]!;
    expect(c.buildings).toContain("palace");
    expect(c.worked.length).toBe(1);
    expect(getTile(s.map, 10, 10)!.road).toBe(true);
    const r = computeCity(s, c);
    expect(r.food).toBe(4); // centre 2 (+irrigation capped by despotism) + one grassland 2
    expect(r.foodSurplus).toBe(2);
    expect(r.shields).toBe(1);
  });

  it("refuses to found adjacent to another city", () => {
    const s = flatWorld();
    const a = createUnit(s, "settlers", 0, 10, 10);
    applyCommand(s, { type: "found", unit: a.id });
    const b = createUnit(s, "settlers", 0, 11, 10);
    expect(applyCommand(s, { type: "found", unit: b.id }).ok).toBe(false);
  });

  it("grows when the food box fills and builds its production", () => {
    const s = flatWorld();
    const u = createUnit(s, "settlers", 0, 10, 10);
    applyCommand(s, { type: "found", unit: u.id });
    const c = s.cities[0]!;
    // Size 1 box is 20; surplus 2/turn -> grows on the 10th turn.
    for (let i = 0; i < 10; i++) applyCommand(s, { type: "endTurn" });
    expect(c.size).toBe(2);
    expect(c.worked.length).toBe(2);
    // Militia costs 10 at 1 shield/turn: built on turn 10.
    expect(s.units.some((x) => x.type === "militia" && x.homeCity === c.id)).toBe(true);
    expect(lastTurnEvents.some((e) => e.kind === "grew")).toBe(true);
  });

  it("switching production kind halves the box, switching back restores it; buying completes it", () => {
    const s = flatWorld();
    const u = createUnit(s, "settlers", 0, 10, 10);
    applyCommand(s, { type: "found", unit: u.id });
    const c = s.cities[0]!;
    c.shields = 8;
    s.players[0]!.advances.push("pottery");
    expect(shieldsAfterChange(s, c, { kind: "building", id: "granary" })).toBe(4);
    applyCommand(s, { type: "setProduction", city: c.id, production: { kind: "building", id: "granary" } });
    expect(c.shields).toBe(4);
    // The box is reckoned from the turn's start: back to a unit it is whole again, and to another
    // improvement it is half of the whole, not half of half.
    applyCommand(s, { type: "setProduction", city: c.id, production: { kind: "unit", id: "militia" } });
    expect(c.shields).toBe(8);
    applyCommand(s, { type: "setProduction", city: c.id, production: { kind: "building", id: "granary" } });
    expect(c.shields).toBe(4);
    s.players[0]!.gold = 1000;
    const cost = buyCost(s, c);
    expect(cost).toBe(2 * 56);
    expect(applyCommand(s, { type: "buy", city: c.id }).ok).toBe(true);
    expect(s.players[0]!.gold).toBe(1000 - cost);
    applyCommand(s, { type: "endTurn" });
    expect(c.buildings).toContain("granary");
    // The event names what was finished, for the window that asks what comes next.
    expect(lastTurnEvents).toContainEqual({ city: c.id, kind: "built", detail: "Granary", production: { kind: "building", id: "granary" } });
    expect(c.production).toEqual({ kind: "unit", id: "militia" });
  });

  it("halves the box on every change of kind for old saves, and counts a bought box as the turn's", () => {
    const s = flatWorld();
    s.compoundingPenalty = true;
    const u = createUnit(s, "settlers", 0, 10, 10);
    applyCommand(s, { type: "found", unit: u.id });
    const c = s.cities[0]!;
    c.shields = 8;
    s.players[0]!.advances.push("pottery");
    applyCommand(s, { type: "setProduction", city: c.id, production: { kind: "building", id: "granary" } });
    applyCommand(s, { type: "setProduction", city: c.id, production: { kind: "unit", id: "militia" } });
    expect(c.shields).toBe(2);
    const save = { ...makeSave(newGame(3, { opponents: 1 }), { opponents: 1 }, []), version: 20 as const };
    expect(loadSave(save, () => {}).state.compoundingPenalty).toBe(true);
    expect(loadSave(makeSave(newGame(3, { opponents: 1 }), { opponents: 1 }, []), () => {}).state.compoundingPenalty).toBeUndefined();

    const t = flatWorld();
    const v = createUnit(t, "settlers", 0, 10, 10);
    applyCommand(t, { type: "found", unit: v.id });
    const d = t.cities[0]!;
    t.players[0]!.gold = 1000;
    applyCommand(t, { type: "buy", city: d.id });
    expect(d.shields).toBe(10);
    t.players[0]!.advances.push("pottery");
    applyCommand(t, { type: "setProduction", city: d.id, production: { kind: "building", id: "granary" } });
    expect(d.shields).toBe(5);
    applyCommand(t, { type: "setProduction", city: d.id, production: { kind: "unit", id: "militia" } });
    expect(d.shields).toBe(10);
  });

  it("toggling a worked tile makes an entertainer and back", () => {
    const s = flatWorld();
    const u = createUnit(s, "settlers", 0, 10, 10);
    applyCommand(s, { type: "found", unit: u.id });
    const c = s.cities[0]!;
    const slot = c.worked[0]!;
    expect(applyCommand(s, { type: "toggleTile", city: c.id, slot }).ok).toBe(true);
    expect(c.specialists).toEqual(["entertainer"]);
    expect(computeCity(s, c).lux).toBe(2);
    expect(applyCommand(s, { type: "toggleTile", city: c.id, slot: 5 }).ok).toBe(true);
    expect(c.worked).toEqual([5]);
    expect(c.specialists).toEqual([]);
  });

  it("working an unworked tile takes a free citizen, else the worker on the weakest square", () => {
    const s = flatWorld();
    const u = createUnit(s, "settlers", 0, 10, 10);
    applyCommand(s, { type: "found", unit: u.id });
    const c = s.cities[0]!;
    c.size = 2;
    // Hills (slot 6, north) and plains (slot 10, west) are worked; forest at slot 11 (east) is not.
    getTile(s.map, 10, 9)!.terrain = Terrain.Hills;
    getTile(s.map, 9, 10)!.terrain = Terrain.Plains;
    getTile(s.map, 11, 10)!.terrain = Terrain.Forest;
    c.worked = [6, 10];
    c.specialists = [];
    expect(applyCommand(s, { type: "workTile", city: c.id, slot: 6 })).toEqual({ ok: false, reason: "already worked" });
    expect(slotScore(s, c, 6)).toBeLessThan(slotScore(s, c, 10));
    expect(applyCommand(s, { type: "workTile", city: c.id, slot: 11 }).ok).toBe(true);
    expect(c.worked.sort()).toEqual([10, 11]); // the hills worker moved
    // With a free citizen nobody has to move.
    c.specialists = ["entertainer"];
    c.size = 3;
    expect(applyCommand(s, { type: "workTile", city: c.id, slot: 6 }).ok).toBe(true);
    expect(c.worked.sort()).toEqual([10, 11, 6].sort());
    expect(c.specialists).toEqual([]);
  });

  it("arranging a city puts every citizen on the best squares, keeping order with entertainers", () => {
    const s = flatWorld();
    const u = createUnit(s, "settlers", 0, 10, 10);
    applyCommand(s, { type: "found", unit: u.id });
    const c = s.cities[0]!;
    getTile(s.map, 11, 10)!.terrain = Terrain.Hills;
    getTile(s.map, 11, 10)!.river = true;
    getTile(s.map, 9, 9)!.special = true;
    c.size = 3;
    c.worked = [];
    c.specialists = ["scientist", "taxman", "entertainer"];
    expect(applyCommand(s, { type: "arrangeCity", city: c.id }).ok).toBe(true);
    expect(c.specialists).toEqual([]);
    const best = Array.from({ length: 20 }, (_, i) => i + 1).sort((a, b) => slotScore(s, c, b) - slotScore(s, c, a));
    expect(c.worked.map((x) => slotScore(s, c, x)).sort()).toEqual(best.slice(0, 3).map((x) => slotScore(s, c, x)).sort());
    // A big city on Emperor needs entertainers: just enough of them to keep order.
    s.players[0]!.difficulty = 4;
    c.size = 6;
    applyCommand(s, { type: "arrangeCity", city: c.id });
    expect(computeCity(s, c).disorder).toBe(false);
    expect(c.specialists.length).toBeGreaterThan(0);
    expect(c.worked.length + c.specialists.length).toBe(6);
    c.worked.push(...c.specialists.splice(0, 1).map(() => best.find((x) => !c.worked.includes(x))!));
    expect(computeCity(s, c).disorder).toBe(true); // one more worker would have tipped it
  });

  it("falls into disorder when unhappy outnumber happy, and martial law helps", () => {
    const s = flatWorld();
    s.players[0]!.difficulty = 4; // 2 content base
    const u = createUnit(s, "settlers", 0, 10, 10);
    applyCommand(s, { type: "found", unit: u.id });
    const c = s.cities[0]!;
    c.size = 5;
    autoAssignWorkers(s, c);
    let r = computeCity(s, c);
    expect(r.unhappy).toBe(3);
    expect(r.disorder).toBe(true);
    createUnit(s, "militia", 0, 10, 10, c.id);
    createUnit(s, "militia", 0, 10, 10, c.id);
    r = computeCity(s, c);
    expect(r.unhappy).toBe(1);
    expect(r.disorder).toBe(true);
    c.buildings.push("temple");
    r = computeCity(s, c);
    expect(r.disorder).toBe(false);
  });

  it("charges shield upkeep beyond the free units and gold for buildings", () => {
    const s = flatWorld();
    const u = createUnit(s, "settlers", 0, 10, 10);
    applyCommand(s, { type: "found", unit: u.id });
    const c = s.cities[0]!;
    for (let i = 0; i < 5; i++) createUnit(s, "militia", 0, 10, 10, c.id);
    // Despotism: a size-1 city supports one unit free, the other four cost a shield each.
    const r = computeCity(s, c);
    expect(r.unitShields).toBe(4);
    c.buildings.push("temple");
    const gold = s.players[0]!.gold;
    applyCommand(s, { type: "endTurn" });
    expect(s.players[0]!.gold).toBe(gold + computeCity(s, c).tax - 1);
  });
});

describe("unit upkeep", () => {
  function cityWith(units: string[], gov = "despotism", opts: { looseUpkeep?: boolean } = {}): { s: GameState; c: City } {
    const s = flatWorld();
    if (opts.looseUpkeep) s.looseUpkeep = true;
    applyCommand(s, { type: "found", unit: createUnit(s, "settlers", 0, 10, 10).id });
    const c = s.cities[0]!;
    s.players[0]!.government = gov;
    for (const t of units) createUnit(s, t, 0, 10, 10, c.id);
    return { s, c };
  }

  it("lets a city support as many units free as its size under Despotism, none under Monarchy, as in the original", () => {
    const { s, c } = cityWith(["militia", "militia", "militia", "settlers"]);
    c.size = 3;
    expect(unitSupport(s, c).map((x) => [x.shields, x.food])).toEqual([[0, 0], [0, 0], [0, 0], [1, 1]]);
    s.players[0]!.government = "monarchy";
    expect(unitSupport(s, c).map((x) => x.shields)).toEqual([1, 1, 1, 1]);
    s.players[0]!.government = "republic";
    expect(unitSupport(s, c).map((x) => x.food)).toEqual([0, 0, 0, 2]);
    // Saves before version 8 keep three free units under every government but Republic and Democracy.
    s.looseUpkeep = true;
    s.players[0]!.government = "monarchy";
    expect(computeCity(s, c).unitShields).toBe(1);
  });

  it("disbands units its city cannot pay for at once, newest first and settlers last, keeping the shield box", () => {
    const { s, c } = cityWith(["settlers", "militia", "militia", "militia", "militia"], "monarchy");
    // Forest all round: the city works one square of 2 shields beside its own 1, and owes 5.
    for (const [dx, dy] of CITY_RADIUS) if (dx || dy) getTile(s.map, c.x + dx, c.y + dy)!.terrain = Terrain.Forest;
    autoAssignWorkers(s, c);
    c.shields = 7;
    const militia = s.units.filter((u) => u.homeCity === c.id && u.type === "militia").map((u) => u.id);
    const r = computeCity(s, c);
    expect(r.unitShields - r.shields).toBe(2);
    applyCommand(s, { type: "endTurn" });
    const left = s.units.filter((u) => u.homeCity === c.id).map((u) => u.type === "settlers" ? "settlers" : u.id);
    expect(left).toEqual(["settlers", militia[0], militia[1]]);
    expect(lastTurnEvents.filter((e) => e.kind === "disbanded")).toEqual([
      { city: c.id, kind: "disbanded", detail: "Militia" },
      { city: c.id, kind: "disbanded", detail: "Militia" },
    ]);
    expect(c.shields).toBe(7);
  });

  it("before version 8, paid upkeep debts from the shield box first", () => {
    const { s, c } = cityWith(["militia", "militia", "militia", "militia", "militia", "militia"], "despotism", { looseUpkeep: true });
    c.shields = 7;
    const r = computeCity(s, c);
    expect(r.shieldSurplus).toBeLessThan(0);
    applyCommand(s, { type: "endTurn" });
    expect(s.units.filter((u) => u.homeCity === c.id)).toHaveLength(6);
    expect(c.shields).toBe(7 + r.shieldSurplus);
  });

  it("sinks a disbanded ship's cargo at sea and sets it ashore in port", () => {
    for (const atSea of [true, false]) {
      // Monarchy pays for every unit: the city cannot keep all four, and the ship is the newest.
      const { s, c } = cityWith(["militia", "militia", "militia"], "monarchy");
      getTile(s.map, c.x + 1, c.y)!.terrain = Terrain.Ocean;
      const [x, y] = atSea ? [c.x + 1, c.y] : [c.x, c.y];
      const ship = createUnit(s, "trireme", 0, x, y, c.id);
      const rider = createUnit(s, "militia", 0, x, y);
      rider.aboard = ship.id;
      applyCommand(s, { type: "endTurn" });
      expect(s.units.some((u) => u.id === ship.id)).toBe(false);
      const still = s.units.find((u) => u.id === rider.id);
      if (atSea) expect(still).toBeUndefined();
      else expect(still?.aboard).toBeNull();
    }
  });

  it("moves a unit's support to the city it stands in (Home City)", () => {
    const s = flatWorld();
    applyCommand(s, { type: "found", unit: createUnit(s, "settlers", 0, 10, 10).id });
    applyCommand(s, { type: "found", unit: createUnit(s, "settlers", 0, 20, 10).id });
    const [a, b] = s.cities;
    const u = createUnit(s, "militia", 0, b!.x, b!.y, a!.id);
    expect(applyCommand(s, { type: "home", unit: u.id })).toEqual({ ok: true });
    expect(u.homeCity).toBe(b!.id);
    expect(applyCommand(s, { type: "home", unit: u.id }).ok).toBe(false);
    u.x = 30;
    expect(applyCommand(s, { type: "home", unit: u.id })).toEqual({ ok: false, reason: "not in our city" });
  });
});

describe("bankruptcy", () => {
  it("sells the costliest improvement when the treasury goes negative", () => {
    const s = flatWorld();
    const u = createUnit(s, "settlers", 0, 10, 10);
    applyCommand(s, { type: "found", unit: u.id });
    const c = s.cities[0]!;
    c.buildings.push("temple", "city_walls");
    s.players[0]!.gold = 0;
    s.players[0]!.taxRate = 0;
    s.players[0]!.sciRate = 6;
    s.players[0]!.luxRate = 4;
    applyCommand(s, { type: "endTurn" });
    expect(c.buildings).not.toContain("city_walls");
    expect(c.buildings).toContain("temple");
    expect(s.players[0]!.gold).toBeGreaterThan(0);
    expect(lastTurnEvents.some((e) => e.kind === "sold")).toBe(true);
  });
});

describe("moods", () => {
  function cityOf(s: GameState, size: number): City {
    const u = createUnit(s, "settlers", 0, 10, 10);
    applyCommand(s, { type: "found", unit: u.id });
    const c = s.cities[0]!;
    c.size = size;
    autoAssignWorkers(s, c);
    return c;
  }

  it("lets martial law run to the government's limit: three under Monarchy, every soldier under Despotism", () => {
    const s = flatWorld();
    s.players[0]!.difficulty = 4; // 2 born content
    const c = cityOf(s, 7); // 5 unhappy
    for (let i = 0; i < 5; i++) createUnit(s, "militia", 0, 10, 10, c.id);
    let r = computeCity(s, c);
    expect(r.martialLaw).toBe(5);
    expect(r.unhappy).toBe(0);
    expect(r.moods.map((m) => m.stage)).toEqual(["born", "luxury", "buildings", "soldiers", "wonders"]);
    expect(r.moods[2]!.unhappy).toBe(5);
    expect(r.moods[3]!.unhappy).toBe(0);
    s.players[0]!.government = "monarchy";
    r = computeCity(s, c);
    expect(r.martialLaw).toBe(3);
    expect(r.unhappy).toBe(2);
    // Before version 17 every government stopped at three.
    s.simpleMoods = true;
    s.players[0]!.government = "despotism";
    expect(computeCity(s, c).martialLaw).toBe(3);
  });

  it("sours the happy too when soldiers are abroad under a Democracy", () => {
    const s = flatWorld();
    s.players[0]!.government = "democracy";
    const c = cityOf(s, 4);
    // Two entertainers: four luxuries make both workers happy.
    c.worked = c.worked.slice(0, 2);
    c.specialists = ["entertainer", "entertainer"];
    let r = computeCity(s, c);
    expect([r.happy, r.content, r.unhappy]).toEqual([2, 0, 0]);
    // Two legions in the field: four steps of weariness turn both happy citizens unhappy.
    createUnit(s, "legion", 0, 12, 12, c.id);
    createUnit(s, "legion", 0, 13, 13, c.id);
    r = computeCity(s, c);
    expect(r.weariness).toBe(2);
    expect([r.happy, r.content, r.unhappy]).toEqual([0, 0, 2]);
    expect(r.disorder).toBe(true);
    // Before version 17 only the content were soured.
    s.simpleMoods = true;
    r = computeCity(s, c);
    expect([r.happy, r.content, r.unhappy]).toEqual([2, 0, 0]);
  });

  it("counts the empire's size by government: one content citizen fewer past its limit, another every ten cities", () => {
    const s = flatWorld();
    expect(contentBase(s, 0)).toBe(4); // Prince
    for (let i = 0; i < 11; i++) expect(applyCommand(s, { type: "found", unit: createUnit(s, "settlers", 0, 10 + 3 * i, 10).id }).ok).toBe(true);
    expect(contentBase(s, 0)).toBe(3); // 11 cities under Despotism (limit 10)
    s.players[0]!.government = "democracy"; // limit 14
    expect(contentBase(s, 0)).toBe(4);
    for (let i = 0; i < 10; i++) expect(applyCommand(s, { type: "found", unit: createUnit(s, "settlers", 0, 10 + 3 * i, 14).id }).ok).toBe(true);
    expect(contentBase(s, 0)).toBe(3); // 21 cities
    s.players[0]!.government = "despotism";
    expect(contentBase(s, 0)).toBe(2); // one past 10, one more for the next 10
    s.simpleMoods = true;
    expect(contentBase(s, 0)).toBe(1); // before version 17: one per four cities past eight
  });

  it("celebrates from size 3 with nobody unhappy and half happy: a Despotism's squares lose their penalty, a Republic grows", () => {
    const s = flatWorld();
    const c = cityOf(s, 4);
    const east = CITY_RADIUS.findIndex(([dx, dy]) => dx === 1 && dy === 0);
    const west = CITY_RADIUS.findIndex(([dx, dy]) => dx === -1 && dy === 0);
    getTile(s.map, 11, 10)!.irrigation = true;
    c.worked = [east, west];
    c.specialists = ["entertainer", "entertainer"];
    c.food = 10;
    let r = computeCity(s, c);
    expect([r.happy, r.unhappy]).toEqual([2, 0]);
    expect(r.celebration).toBe(true);
    expect(c.celebrating).toBe(false);
    expect(cityYieldGovernment(s, c)).toBe("despotism");
    const penalised = r.food; // the centre and the irrigated square each lose a food to the despot
    applyCommand(s, { type: "endTurn" });
    expect(c.celebrating).toBe(true);
    expect(lastTurnEvents.some((e) => e.kind === "celebration")).toBe(true);
    expect(cityYieldGovernment(s, c)).toBe("monarchy");
    expect(computeCity(s, c).food).toBe(penalised + 2);
    // A celebrating Republic grows a citizen every turn it has food to spare, and keeps its store.
    s.players[0]!.government = "republic";
    getTile(s.map, 9, 10)!.irrigation = true;
    r = computeCity(s, c);
    expect(r.foodSurplus).toBe(1);
    const store = c.food;
    applyCommand(s, { type: "endTurn" });
    expect(c.size).toBe(5);
    expect(c.food).toBe(store + 1);
    // Three of five must be happy now: the festival ends until they are.
    expect(computeCity(s, c).celebration).toBe(false);
    // Nothing of this before version 17.
    s.simpleMoods = true;
    c.size = 4;
    c.worked = [east, west];
    c.specialists = ["entertainer", "entertainer"];
    expect(computeCity(s, c).celebration).toBe(false);
  });

  it("topples a Democracy whose city riots three turns running", () => {
    const run = (simple: boolean) => {
      const s = flatWorld();
      if (simple) s.simpleMoods = true;
      s.players[0]!.difficulty = 4; // 2 born content
      s.players[0]!.government = "democracy";
      const c = cityOf(s, 5); // 3 unhappy, nobody happy
      expect(computeCity(s, c).disorder).toBe(true);
      for (let t = 1; t <= 2; t++) {
        applyCommand(s, { type: "endTurn" });
        expect(c.unrest).toBe(t);
        expect(s.players[0]!.government).toBe("democracy");
      }
      applyCommand(s, { type: "endTurn" });
      expect(c.unrest).toBe(3);
      return s;
    };
    const s = run(false);
    expect(s.players[0]!.government).toBe("anarchy");
    expect(lastTurnEvents.some((e) => e.kind === "overthrown" && e.player === 0)).toBe(true);
    expect(run(true).players[0]!.government).toBe("democracy");
  });

  it("keeps a rioting city paying for its units", () => {
    const s = flatWorld();
    s.players[0]!.difficulty = 4;
    s.players[0]!.government = "monarchy"; // every unit costs a shield
    const c = cityOf(s, 5);
    for (let i = 0; i < 4; i++) createUnit(s, "militia", 0, 20, 20, c.id);
    const r = computeCity(s, c);
    expect(r.disorder).toBe(true);
    expect(r.shieldSurplus).toBe(Math.min(0, r.shields - r.unitShields));
    s.simpleMoods = true;
    expect(computeCity(s, c).shieldSurplus).toBe(0);
  });
});
