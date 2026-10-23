import { describe, expect, it } from "vitest";
import {
  ADVANCES,
  ADVANCE_BY_ID,
  advancesFor,
  applyCommand,
  CLASSIC_ADVANCES,
  availableAdvances,
  buildOptions,
  BUILDINGS,
  computeCity,
  createUnit,
  governmentsAvailable,
  lastTurnEvents,
  newGame,
  researchCost,
  Terrain,
  UNIT_TYPES,
  WONDERS,
  type GameState,
} from "../src/index.js";

function flatWorld(): GameState {
  const s = newGame(1, { opponents: 0, classicCivs: true });
  for (const t of s.map.tiles) {
    t.terrain = Terrain.Grassland;
    t.river = false; t.road = false; t.irrigation = false; t.mine = false; t.special = false; t.hut = false;
  }
  s.units = []; s.cities = [];
  return s;
}

describe("tech tree", () => {
  it("is a DAG whose prerequisites all exist and is fully reachable, in both trees", () => {
    for (const tree of [ADVANCES, CLASSIC_ADVANCES]) {
      const ids = new Set(tree.map((a) => a.id));
      for (const a of tree) for (const r of a.requires) expect(ids.has(r), `${a.id} requires ${r}`).toBe(true);
      const known: string[] = [];
      while (true) {
        const next = availableAdvances(known, tree);
        if (next.length === 0) break;
        known.push(next[0]!.id);
      }
      expect(known.length).toBe(tree.length);
    }
  });

  it("extends the 1991 tree for new games, and old saves keep the 1991 one", () => {
    expect(CLASSIC_ADVANCES).toHaveLength(68);
    expect(CLASSIC_ADVANCES.at(-1)!.id).toBe("future_tech");
    const ours = new Set(ADVANCES.map((a) => a.id));
    expect(ours.has("future_tech")).toBe(false);
    for (const id of ["weaving", "animal_husbandry", "the_internet", "mobile_phones", "renewable_energy", "artificial_intelligence", "quantum_computing"])
      expect(ours.has(id), id).toBe(true);
    expect(ADVANCES.find((a) => a.id === "horseback_riding")!.requires).toEqual(["animal_husbandry"]);
    expect(CLASSIC_ADVANCES.find((a) => a.id === "horseback_riding")!.requires).toEqual([]);
    // Every advance shared with the 1991 tree keeps its prerequisites, but Horseback Riding.
    for (const a of CLASSIC_ADVANCES) {
      const b = ADVANCES.find((x) => x.id === a.id);
      if (b && a.id !== "horseback_riding") expect(b.requires, a.id).toEqual(a.requires);
    }
    expect(advancesFor(newGame(1, { opponents: 1 }))).toBe(ADVANCES);
    expect(advancesFor(newGame(1, { opponents: 1, classicAdvances: true }))).toBe(CLASSIC_ADVANCES);
  });

  it("gives every modern advance an improvement, built on what came before", () => {
    const unlocks = (id: string) => BUILDINGS.filter((b) => b.requires === id).map((b) => b.id);
    expect(unlocks("the_internet")).toEqual(["data_center"]);
    expect(unlocks("mobile_phones")).toEqual(["cell_tower"]);
    expect(unlocks("renewable_energy")).toEqual(["solar_plant"]);
    expect(unlocks("artificial_intelligence")).toEqual(["automated_office"]);
    expect(unlocks("quantum_computing")).toEqual(["quantum_lab"]);
    expect(BUILDINGS.find((b) => b.id === "quantum_lab")!.needs).toBe("data_center");
  });

  it("every unit, building and wonder prerequisite is a real advance", () => {
    for (const u of UNIT_TYPES) if (u.requires) expect(ADVANCE_BY_ID[u.requires], u.id).toBeDefined();
    for (const b of BUILDINGS) if (b.requires) expect(ADVANCE_BY_ID[b.requires], b.id).toBeDefined();
    for (const w of WONDERS) {
      expect(ADVANCE_BY_ID[w.requires], w.id).toBeDefined();
      if (w.obsolete) expect(ADVANCE_BY_ID[w.obsolete], w.id).toBeDefined();
    }
  });

  it("starts with seven root advances: Animal Husbandry in place of Horseback Riding", () => {
    expect(availableAdvances([], ADVANCES).map((a) => a.id).sort()).toEqual(
      ["alphabet", "animal_husbandry", "bronze_working", "ceremonial_burial", "masonry", "pottery", "the_wheel"],
    );
    expect(availableAdvances([], CLASSIC_ADVANCES).map((a) => a.id).sort()).toEqual(
      ["alphabet", "bronze_working", "ceremonial_burial", "horseback_riding", "masonry", "pottery", "the_wheel"],
    );
  });
});

describe("research", () => {
  it("accumulates beakers and discovers the chosen advance", () => {
    const s = flatWorld();
    const u = createUnit(s, "settlers", 0, 10, 10);
    applyCommand(s, { type: "found", unit: u.id });
    const p = s.players[0]!;
    p.sciRate = 6; p.taxRate = 4;
    expect(applyCommand(s, { type: "research", advance: "writing" }).ok).toBe(false);
    expect(applyCommand(s, { type: "research", advance: "alphabet" }).ok).toBe(true);
    p.science = researchCost(0, p.difficulty) - 1;
    s.cities[0]!.buildings.push("library");
    // Give the city some trade so science > 0: rivers everywhere, a trade on each square.
    for (const t of s.map.tiles) t.river = true;
    applyCommand(s, { type: "endTurn" });
    expect(p.advances).toContain("alphabet");
    expect(lastTurnEvents.some((e) => e.kind === "discovered")).toBe(true);
    expect(lastTurnEvents.some((e) => e.kind === "chooseResearch")).toBe(true);
    expect(p.researching).toBeNull();
  });

  it("gates build options on advances", () => {
    const s = flatWorld();
    const u = createUnit(s, "settlers", 0, 10, 10);
    applyCommand(s, { type: "found", unit: u.id });
    const c = s.cities[0]!;
    const ids = () => buildOptions(s, c).map((p) => p.id);
    expect(ids()).toContain("militia");
    expect(ids()).not.toContain("phalanx");
    expect(ids()).not.toContain("temple");
    s.players[0]!.advances.push("bronze_working", "ceremonial_burial");
    expect(ids()).toContain("phalanx");
    expect(ids()).toContain("temple");
    expect(ids()).toContain("colossus");
    c.wonders.push("colossus");
    expect(ids()).not.toContain("colossus");
  });
});

describe("governments", () => {
  it("revolution causes anarchy, then a known government can be chosen", () => {
    const s = flatWorld();
    const p = s.players[0]!;
    expect(governmentsAvailable(s, 0)).toEqual(["despotism"]);
    p.advances.push("ceremonial_burial", "code_of_laws", "monarchy");
    expect(governmentsAvailable(s, 0)).toEqual(["despotism", "monarchy"]);
    expect(applyCommand(s, { type: "revolution" }).ok).toBe(true);
    expect(p.government).toBe("anarchy");
    expect(applyCommand(s, { type: "setGovernment", government: "monarchy" }).ok).toBe(false);
    for (let i = 0; i < 5; i++) applyCommand(s, { type: "endTurn" });
    expect(lastTurnEvents.some((e) => e.kind === "chooseGovernment")).toBe(true);
    expect(applyCommand(s, { type: "setGovernment", government: "monarchy" }).ok).toBe(true);
    expect(p.government).toBe("monarchy");
  });

  it("clamps rates to the government maximum", () => {
    const s = flatWorld();
    expect(applyCommand(s, { type: "setRates", tax: 7, lux: 0, sci: 3 }).ok).toBe(false);
    expect(applyCommand(s, { type: "setRates", tax: 6, lux: 0, sci: 4 }).ok).toBe(true);
  });

  it("wonder effects reach the city maths", () => {
    const s = flatWorld();
    const u = createUnit(s, "settlers", 0, 10, 10);
    applyCommand(s, { type: "found", unit: u.id });
    const c = s.cities[0]!;
    c.size = 3;
    applyCommand(s, { type: "endTurn" });
    for (const t of s.map.tiles) t.river = true;
    c.buildings.push("library");
    const before = computeCity(s, c);
    c.wonders.push("seti_program");
    const after = computeCity(s, c);
    expect(after.science).toBeGreaterThan(before.science);
    c.wonders.push("shakespeares");
    s.players[0]!.difficulty = 4;
    expect(computeCity(s, c).unhappy).toBe(0);
  });
});
