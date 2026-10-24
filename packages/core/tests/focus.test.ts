import { describe, expect, it } from "vitest";
import { applyCommand, autoAssignWorkers, BALANCED_WEIGHTS, cityFoci, cityFocus, CITY_RADIUS, computeCity, createUnit, getTile, newGame, Terrain, wrapX, type City, type GameState } from "../src/index.js";

/** A city of ours on a world of forest (1 food, 2 shields), with grassland (2 food) on the squares named. */
function forestCity(grass: number[], opts: { balancedWorkers?: boolean } = {}): { s: GameState; c: City } {
  const s = newGame(1, { opponents: 0, classicCivs: true, ...opts });
  for (const t of s.map.tiles) {
    t.terrain = Terrain.Forest;
    t.river = false; t.road = false; t.irrigation = false; t.mine = false; t.special = false; t.hut = false;
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

  it("works for shields under Production, as long as the city is fed", () => {
    const { s, c } = forestCity(NEXT.filter((x) => x !== 10));
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
});
