import { describe, expect, it } from "vitest";
import { applyCommand, arrangeCity, autoAssignWorkers, BALANCED_WEIGHTS, bestFreeSlot, borderRadius, cityFoci, cityFocus, CITY_RADIUS, computeCity, createUnit, dropLostSquares, getTile, loadSave, makeSave, newGame, Terrain, weakestWorked, wrapX, type City, type GameState } from "../src/index.js";

/** A city of ours on a world of forest (1 food, 2 shields), with grassland (2 food) on the squares named. */
function forestCity(grass: number[], opts: { balancedWorkers?: boolean; fedOnly?: boolean } = {}): { s: GameState; c: City } {
  const s = newGame(1, { opponents: 0, classicCivs: true, ...opts });
  for (const t of s.map.tiles) {
    t.terrain = Terrain.Forest;
    t.river = false; t.road = false; t.irrigation = false; t.mine = false; t.special = false; t.hut = false; t.grassShield = false;
  }
  s.units = [];
  s.cities = [];
  const u = createUnit(s, "settlers", 0, 10, 10);
  applyCommand(s, { type: "found", unit: u.id });
  const c = s.cities[0]!;
  for (const slot of grass) {
    const [dx, dy] = CITY_RADIUS[slot]!;
    getTile(s.map, wrapX(s.map, 10 + dx), 10 + dy)!.terrain = Terrain.Grassland;
  }
  return { s, c };
}

/** The squares next to a city, its land when it is founded. */
const NEXT = [5, 6, 7, 10, 11, 14, 15, 16];

const isGrass = (s: GameState, c: City, slot: number) => {
  const [dx, dy] = CITY_RADIUS[slot]!;
  return getTile(s.map, wrapX(s.map, c.x + dx), c.y + dy)!.terrain === Terrain.Grassland;
};

describe("city focus", () => {
  it("works the player's cities for growth unless told otherwise: grassland before forest", () => {
    const { s, c } = forestCity([7, 14]);
    expect(cityFocus(s, c)?.id).toBe("growth");
    c.size = 2;
    c.specialists = [];
    autoAssignWorkers(s, c);
    expect(c.worked.sort((a, b) => a - b)).toEqual([7, 14]);
  });

  it("worked for shields under Production as long as the city was fed, in games saved before version 66", () => {
    const { s, c } = forestCity(NEXT.filter((x) => x !== 10), { fedOnly: true });
    c.size = 1;
    expect(applyCommand(s, { type: "setFocus", city: c.id, focus: "production" }).ok).toBe(true);
    expect(c.focus).toBe("production");
    expect(c.worked.map((x) => isGrass(s, c, x))).toEqual([false]); // the one forest
    // Bigger, forests alone would starve it: it works grassland enough to eat, forest with the rest.
    c.size = 3;
    autoAssignWorkers(s, c);
    expect(computeCity(s, c).foodSurplus).toBeGreaterThanOrEqual(0);
    expect(c.worked.some((x) => !isGrass(s, c, x))).toBe(true);
  });

  it("puts spare citizens to study under Science and to tax under Trade, while the city keeps order", () => {
    const { s, c } = forestCity([5]);
    s.slowCulture = true; // the first culture levels keep the new city to its eight squares, so a third citizen has nowhere to work
    s.players[0]!.difficulty = 0;
    // Barbarians stand on all but two of the new city's eight squares: a third citizen has nowhere to work.
    for (const slot of NEXT.slice(2)) {
      const [dx, dy] = CITY_RADIUS[slot]!;
      createUnit(s, "militia", s.barbarians, wrapX(s.map, c.x + dx), c.y + dy);
    }
    c.size = 3;
    applyCommand(s, { type: "arrangeCity", city: c.id });
    expect(c.specialists).toEqual(["entertainer"]);
    applyCommand(s, { type: "setFocus", city: c.id, focus: "science" });
    expect(c.specialists).toEqual(["scientist"]);
    applyCommand(s, { type: "setFocus", city: c.id, focus: "trade" });
    expect(c.specialists).toEqual(["taxman"]);
    expect(computeCity(s, c).disorder).toBe(false);
  });

  it("works for any foci picked together: their weights added, none the old balance, science and trade studying and taxing in turn", () => {
    const { s, c } = forestCity([5]);
    s.slowCulture = true; // as above: eight squares, so the fourth and third citizens are spare
    expect(applyCommand(s, { type: "setFoci", city: c.id, foci: ["production", "growth"] }).ok).toBe(true);
    expect(c.foci).toEqual(["growth", "production"]);
    expect(cityFoci(s, c)).toEqual(["growth", "production"]);
    expect(cityFocus(s, c)?.weights).toEqual({ food: 7, shields: 7, trade: 2 });
    applyCommand(s, { type: "setFoci", city: c.id, foci: [] });
    expect(cityFocus(s, c)?.weights).toEqual(BALANCED_WEIGHTS);
    expect(applyCommand(s, { type: "setFoci", city: c.id, foci: ["growth", "gold" as "growth"] }).ok).toBe(false);
    // Picked together, the foci win over a single focus set before.
    c.focus = "trade";
    applyCommand(s, { type: "setFoci", city: c.id, foci: ["science"] });
    expect(c.focus).toBeUndefined();
    expect(cityFocus(s, c)?.id).toBe("science");
    // Science and trade: the spare citizens study and tax in turn.
    s.players[0]!.difficulty = 0;
    for (const slot of NEXT.slice(2)) {
      const [dx, dy] = CITY_RADIUS[slot]!;
      createUnit(s, "militia", s.barbarians, wrapX(s.map, c.x + dx), c.y + dy);
    }
    c.size = 4;
    applyCommand(s, { type: "setFoci", city: c.id, foci: ["science", "trade"] });
    expect([...c.specialists].sort()).toEqual(["scientist", "taxman"]);
    expect(computeCity(s, c).disorder).toBe(false);
  });

  it("keeps the old balance for the computer players' cities and in games saved before foci", () => {
    for (const setup of ["ai", "old"] as const) {
      const { s, c } = forestCity([5], setup === "old" ? { balancedWorkers: true } : {});
      if (setup === "ai") s.players[0]!.isAi = true;
      expect(cityFocus(s, c)).toBeNull();
      c.size = 1;
      c.specialists = [];
      autoAssignWorkers(s, c);
      expect(isGrass(s, c, c.worked[0]!)).toBe(false); // forest: food 3 + shields 2x2 beats grassland's 2x3
    }
    const { s, c } = forestCity([5], { balancedWorkers: true });
    expect(applyCommand(s, { type: "setFocus", city: c.id, focus: "growth" }).ok).toBe(false);
  });

  describe("keeping a city growing and making something", () => {
    /** A city of ours on `centre` among squares of `land`, with `others` on the squares named. A city's own grassland yields 3 food, no shield. */
    function landCity(centre: Terrain, land: Terrain, others: Partial<Record<number, Terrain>> = {}, opts: { fedOnly?: boolean } = {}): { s: GameState; c: City } {
      const { s, c } = forestCity([], opts);
      for (const t of s.map.tiles) t.terrain = land;
      getTile(s.map, c.x, c.y)!.terrain = centre;
      for (const [slot, terrain] of Object.entries(others)) {
        const [dx, dy] = CITY_RADIUS[Number(slot)]!;
        getTile(s.map, wrapX(s.map, c.x + dx), c.y + dy)!.terrain = terrain;
      }
      return { s, c };
    }

    /** As `landCity`, a Monarchy on irrigated grassland (3 food a square), one forest among it on square 5: food to spare for a shield. */
    function richCity(): { s: GameState; c: City } {
      const { s, c } = landCity(Terrain.Grassland, Terrain.Grassland, { 5: Terrain.Forest });
      for (const t of s.map.tiles) if (t.terrain === Terrain.Grassland) t.irrigation = true;
      s.players[0]!.government = "monarchy";
      return { s, c };
    }

    it("gives a city growing on grassland the forest that lets it make something", () => {
      const { s, c } = landCity(Terrain.Grassland, Terrain.Grassland, { 5: Terrain.Forest });
      c.size = 2;
      autoAssignWorkers(s, c);
      expect(c.worked).toContain(5);
      const r = computeCity(s, c);
      expect(r.foodSurplus).toBe(2);
      expect(r.shieldSurplus).toBe(2);
    });

    it("leaves Production a square of food when forests alone would stop its growth", () => {
      const { s, c } = forestCity(NEXT.filter((x) => x !== 10));
      c.size = 1;
      applyCommand(s, { type: "setFocus", city: c.id, focus: "production" });
      expect(c.worked.map((x) => isGrass(s, c, x))).toEqual([true]);
      expect(computeCity(s, c).foodSurplus).toBe(1);
      expect(computeCity(s, c).shieldSurplus).toBeGreaterThan(0);
    });

    it("changes nothing in a city that has both to spare", () => {
      const { s, c } = forestCity([5, 6]);
      c.size = 2;
      c.specialists = [];
      autoAssignWorkers(s, c);
      expect(c.worked.sort((a, b) => a - b)).toEqual([5, 6]);
    });

    it("leaves the focus's squares where the land cannot give both", () => {
      const { s, c } = landCity(Terrain.Tundra, Terrain.Forest, { 5: Terrain.Grassland });
      c.size = 1;
      autoAssignWorkers(s, c); // food first: grass grows it, a forest would make shields instead
      expect(c.worked).toEqual([5]);
      expect(computeCity(s, c).shieldSurplus).toBe(0);
      applyCommand(s, { type: "setFocus", city: c.id, focus: "production" });
      expect(c.worked).not.toContain(5);
      expect(computeCity(s, c).foodSurplus).toBe(0);
    });

    it("feeds a starving city first, then lets the focus choose, even at the cost of its only shield", () => {
      const { s, c } = landCity(Terrain.Tundra, Terrain.Forest, { 5: Terrain.Grassland, 6: Terrain.Grassland });
      c.size = 3;
      applyCommand(s, { type: "setFocus", city: c.id, focus: "production" });
      expect(c.worked).toEqual(expect.arrayContaining([5, 6])); // the third on forest: no growth, but it makes something
      expect(computeCity(s, c).foodSurplus).toBe(0);
      expect(computeCity(s, c).shieldSurplus).toBe(2);
      const poor = landCity(Terrain.Tundra, Terrain.Tundra, { 5: Terrain.Desert });
      poor.c.size = 1;
      applyCommand(poor.s, { type: "setFocus", city: poor.c.id, focus: "production" });
      expect(poor.c.worked).not.toContain(5); // the desert's shield would starve it
      expect(computeCity(poor.s, poor.c).foodSurplus).toBe(0);
    });

    it("wants no food to spare in a city at its size limit, until an Aqueduct lifts it", () => {
      const { s, c } = forestCity([1, 2, 3, 4, 5, 6, 7, 8, 9]);
      getTile(s.map, c.x, c.y)!.terrain = Terrain.Plains;
      c.size = 10;
      c.focus = "production";
      autoAssignWorkers(s, c);
      expect(computeCity(s, c).foodSurplus).toBe(0);
      c.buildings.push("aqueduct");
      autoAssignWorkers(s, c);
      expect(computeCity(s, c).foodSurplus).toBe(1);
    });

    it("sees what a rioting city's squares would make, and holds when citizens are taken off the land to keep order", () => {
      const { s, c } = richCity();
      s.players[0]!.difficulty = 4;
      c.size = 3;
      autoAssignWorkers(s, c);
      expect(computeCity(s, c).disorder).toBe(true);
      expect(c.worked).toContain(5);
      arrangeCity(s, c);
      expect(c.specialists.length).toBeGreaterThan(0);
      expect(computeCity(s, c).disorder).toBe(false);
      expect(c.worked).toContain(5);
    });

    it("brings on no disorder for a shield or a food", () => {
      // The two sea squares' trade pays the luxuries that keep this city in order: taking either for grassland, though it goes hungry, would cost them.
      const { s, c } = landCity(Terrain.Tundra, Terrain.Tundra, { 5: Terrain.Ocean, 6: Terrain.Ocean, 7: Terrain.Grassland, 10: Terrain.Grassland, 11: Terrain.Grassland });
      s.players[0]!.difficulty = 4;
      s.players[0]!.luxRate = 10;
      s.players[0]!.taxRate = 0;
      s.players[0]!.sciRate = 0;
      c.size = 3;
      c.focus = "science";
      autoAssignWorkers(s, c);
      const r = computeCity(s, c);
      expect(r.foodSurplus).toBeLessThan(0);
      expect(r.disorder).toBe(false);
      expect(c.worked).toEqual(expect.arrayContaining([5, 6]));
    });

    it("sends a citizen back to the square the city lacks, and takes one off the square it can spare", () => {
      const { s, c } = richCity();
      c.size = 2;
      c.worked = [6];
      c.specialists = ["entertainer"];
      expect(bestFreeSlot(s, c)).toBe(5);
      c.size = 3;
      c.worked = [5, 6, 7];
      c.specialists = [];
      expect(weakestWorked(s, c)).toBe(6); // the forest is worth less to Growth, but it is the city's only shield
    });

    it("mends a city that lost squares to its border", () => {
      const { s, c } = richCity();
      s.players[0]!.difficulty = 0;
      c.size = 2;
      c.specialists = [];
      c.worked = [6, CITY_RADIUS.findIndex(([dx, dy]) => dx === 2 && dy === 0)];
      expect(borderRadius(s, c)).toBe(1);
      dropLostSquares(s, c);
      expect(c.worked).toContain(5);
    });

    it("leaves computer players' cities, and games saved before version 66, as they were", () => {
      const { s, c } = landCity(Terrain.Grassland, Terrain.Grassland, { 5: Terrain.Forest }, { fedOnly: true });
      c.size = 2;
      autoAssignWorkers(s, c);
      expect(c.worked).not.toContain(5);
      c.worked = [5, 6];
      expect(weakestWorked(s, c)).toBe(5);
      const ai = forestCity([5, 6]);
      ai.s.players[0]!.isAi = true;
      ai.c.size = 2;
      ai.c.specialists = [];
      autoAssignWorkers(ai.s, ai.c); // forests by the old balance, starving as it always did: the planner minds its own squares
      expect(computeCity(ai.s, ai.c).foodSurplus).toBe(-1);
      const opts = { opponents: 1 };
      expect(loadSave({ ...makeSave(newGame(3, opts), opts, []), version: 65 as const }, () => {}).state.fedOnly).toBe(true);
      expect(loadSave(makeSave(newGame(3, opts), opts, []), () => {}).state.fedOnly).toBeUndefined();
    });
  });
});
