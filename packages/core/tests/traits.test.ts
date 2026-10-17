import { describe, expect, it } from "vitest";
import {
  ADVANCE_BY_ID,
  applyCommand,
  autoAssignWorkers,
  BUILDINGS,
  buyCost,
  CIVS,
  computeCity,
  costFor,
  createUnit,
  foundCity,
  getTile,
  lastTurnEvents,
  loadSave,
  makeSave,
  moveAllowance,
  newGame,
  processCityTurn,
  productionCost,
  Terrain,
  UNIT_BY_ID,
  workOptions,
  type GameState,
} from "../src/index.js";

/** A flat grassland world for player 0 playing `civ`; no units or cities. */
function world(civ: string, classicCivs = false): GameState {
  const s = newGame(1, { civ, opponents: 1, ...(classicCivs ? { classicCivs } : {}) });
  for (const t of s.map.tiles) {
    Object.assign(t, { terrain: Terrain.Grassland, river: false, special: false, hut: false, road: false, irrigation: false, mine: false, railroad: false, fortress: false, pollution: false });
  }
  s.units = [];
  s.cities = [];
  return s;
}

/** The same question asked with the trait and without it (classic civilizations). */
function withAndWithout<T>(s: GameState, ask: () => T): [T, T] {
  const on = ask();
  s.classicCivs = true;
  const off = ask();
  delete s.classicCivs;
  return [on, off];
}

describe("civilization traits", () => {
  it("every playable civilization has one, starting from an advance with no prerequisites", () => {
    const names = new Set<string>();
    for (const c of CIVS) {
      if (c.id === "barbarians") { expect(c.trait).toBeUndefined(); continue; }
      const t = c.trait!;
      expect(t, c.id).toBeDefined();
      expect(ADVANCE_BY_ID[t.start]?.requires, c.id).toEqual([]);
      expect(t.short.length, c.id).toBeLessThanOrEqual(18);
      expect(t.effects.length, c.id).toBeGreaterThan(0);
      names.add(t.name);
      for (const e of t.effects) {
        if (e.kind === "cost") {
          for (const b of e.buildings ?? []) expect(BUILDINGS.some((x) => x.id === b), b).toBe(true);
          for (const u of e.units ?? []) expect(UNIT_BY_ID[u], u).toBeDefined();
        }
        if (e.kind === "veteran" || e.kind === "moves") for (const u of e.units ?? []) expect(UNIT_BY_ID[u], u).toBeDefined();
      }
    }
    expect(names.size).toBe(CIVS.length - 1);
  });

  it("each civilization begins knowing its trait's advance, unless the civilizations are classic", () => {
    const s = newGame(7, { civ: "greeks", opponents: 3 });
    for (const p of s.players) {
      if (p.id === s.barbarians) expect(p.advances).toEqual([]);
      else expect(p.advances).toEqual([CIVS.find((c) => c.id === p.civ)!.trait!.start]);
    }
    expect(newGame(7, { civ: "greeks", opponents: 3, classicCivs: true }).players.every((p) => p.advances.length === 0)).toBe(true);
  });

  it("discounts the right productions, and cities finish and buy them at that price", () => {
    const egypt = world("egyptians");
    expect(costFor(egypt, 0, { kind: "wonder", id: "pyramids" })).toBe(Math.round(productionCost({ kind: "wonder", id: "pyramids" }) * 0.8));
    expect(costFor(egypt, 0, { kind: "building", id: "temple" })).toBe(productionCost({ kind: "building", id: "temple" }));
    expect(costFor(egypt, 1, { kind: "wonder", id: "pyramids" })).toBe(productionCost({ kind: "wonder", id: "pyramids" }));
    const babylon = world("babylonians");
    const c = foundCity(babylon, 0, 10, 10);
    c.production = { kind: "building", id: "library" };
    const [buy, full] = withAndWithout(babylon, () => buyCost(babylon, c));
    expect(buy).toBeLessThan(full);
    c.shields = costFor(babylon, 0, c.production);
    processCityTurn(babylon, c);
    expect(c.buildings).toContain("library");
    const hatti = world("hittites");
    expect(costFor(hatti, 0, { kind: "unit", id: "chariot" })).toBe(32);
    expect(costFor(hatti, 0, { kind: "unit", id: "settlers" })).toBe(productionCost({ kind: "unit", id: "settlers" }));
    expect(costFor(hatti, 0, { kind: "unit", id: "trireme" })).toBe(productionCost({ kind: "unit", id: "trireme" }));
  });

  it("speeds up the jobs it names", () => {
    const rome = world("romans");
    const settler = createUnit(rome, "settlers", 0, 10, 10);
    const [fast, slow] = withAndWithout(rome, () => workOptions(rome, settler));
    expect(fast.road).toBe(Math.ceil(slow.road! / 2));
    expect(fast.mine).toBe(slow.mine);
    const germany = world("germans");
    const farmer = createUnit(germany, "settlers", 0, 10, 10);
    getTile(germany.map, 10, 11)!.river = true;
    const [quick, plain] = withAndWithout(germany, () => workOptions(germany, farmer));
    expect(quick.irrigate).toBe(Math.ceil(plain.irrigate! / 2));
    expect(quick.road).toBe(plain.road);
  });

  it("adds science, tax and content citizens, and cuts corruption", () => {
    for (const [civ, field] of [["greeks", "science"], ["persians", "tax"]] as const) {
      const s = world(civ);
      for (const t of s.map.tiles) { t.river = true; t.road = true; }
      const c = foundCity(s, 0, 10, 10);
      c.size = 4;
      autoAssignWorkers(s, c);
      s.players[0]!.taxRate = 5; s.players[0]!.sciRate = 5;
      const [more, base] = withAndWithout(s, () => computeCity(s, c)[field]);
      expect(more, civ).toBeGreaterThan(base);
    }
    const india = world("indians");
    const c = foundCity(india, 0, 10, 10);
    c.size = 7;
    const [calm, restless] = withAndWithout(india, () => computeCity(india, c).unhappy);
    expect(calm).toBe(restless - 1);
    const russia = world("russians");
    foundCity(russia, 0, 10, 10);
    const far = foundCity(russia, 0, 30, 10);
    for (const t of russia.map.tiles) t.river = true;
    const [less, more] = withAndWithout(russia, () => computeCity(russia, far).corruption);
    expect(less).toBeLessThan(more);
  });

  it("keeps food on growth, shrinks the food box, trains veterans and gives extra moves", () => {
    const china = world("chinese");
    const c = foundCity(china, 0, 10, 10);
    c.food = 1000;
    processCityTurn(china, c);
    expect(c.size).toBe(2);
    expect(c.food).toBe(Math.floor(((1 + 1) * 10) / 3));

    const aztecs = world("aztecs");
    const t = foundCity(aztecs, 0, 10, 10);
    t.size = 4;
    expect(withAndWithout(aztecs, () => computeCity(aztecs, t).foodBox)).toEqual([40, 50]);

    const zulus = world("zulus");
    const k = foundCity(zulus, 0, 10, 10);
    k.production = { kind: "unit", id: "militia" };
    k.shields = 10;
    processCityTurn(zulus, k);
    expect(zulus.units.find((u) => u.type === "militia")!.veteran).toBe(true);

    const england = world("english");
    const ship = createUnit(england, "trireme", 0, 10, 10);
    const [far, near] = withAndWithout(england, () => moveAllowance(england, ship));
    expect(far).toBe(near + 3);
    const mongols = world("mongols");
    const rider = createUnit(mongols, "cavalry", 0, 10, 10);
    const walker = createUnit(mongols, "militia", 0, 10, 10);
    expect(withAndWithout(mongols, () => moveAllowance(mongols, rider))).toEqual([9, 6]);
    expect(withAndWithout(mongols, () => moveAllowance(mongols, walker))).toEqual([3, 3]);
  });

  it("shortens anarchy and makes villages friendly", () => {
    for (let seed = 1; seed <= 12; seed++) {
      const s = newGame(seed, { civ: "americans", opponents: 1 });
      applyCommand(s, { type: "revolution" });
      expect(s.players[0]!.anarchyTurns).toBeLessThanOrEqual(1);
    }

    const spain = world("spanish");
    const gifts: string[] = [];
    for (let i = 0; i < 60; i++) {
      getTile(spain.map, 20 + i, 30)!.hut = true;
      const u = createUnit(spain, "militia", 0, 19 + i, 30);
      applyCommand(spain, { type: "move", unit: u.id, dx: 1, dy: 0 });
      const ev = lastTurnEvents.find((e) => e.kind === "hut");
      if (ev?.kind === "hut") gifts.push(ev.result.kind === "gold" ? `gold${ev.result.amount % 50}` : ev.result.kind);
      lastTurnEvents.length = 0;
    }
    expect(gifts).not.toContain("barbarians");
    expect(gifts.filter((g) => g.startsWith("gold")).every((g) => g === "gold0")).toBe(true);
  });

  it("old saves load with classic civilizations", () => {
    const opts = { opponents: 1 as const };
    const state = newGame(321, opts);
    expect(loadSave({ ...makeSave(state, opts, []), version: 4 as const }, () => {}).state.classicCivs).toBe(true);
    expect(loadSave(makeSave(state, opts, []), () => {}).state.classicCivs).toBeUndefined();
  });
});
