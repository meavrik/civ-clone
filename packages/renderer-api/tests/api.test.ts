import { describe, expect, it } from "vitest";
import { applyCommand, createUnit, getTile, newGame, revealAround, Terrain } from "@civ/core";
import { opponentsForChoice, setupChoose, setupMenu, setupOptions, terrainInfo, type SetupState } from "../src/index.js";

const fresh = (step: SetupState["step"]): SetupState => ({ step, world: null, historical: true, custom: null, difficulty: 2, opponents: 6, civ: "romans" });

describe("setup", () => {
  it("asks for 3 to 7 civilizations in total and defaults to 7", () => {
    const m = setupMenu(fresh("opponents"));
    expect(m.title).toBe("How many civilizations?");
    expect(m.items).toEqual(["3 civilizations", "4 civilizations", "5 civilizations", "6 civilizations", "7 civilizations"]);
    expect(m.selected).toBe(4);
    expect([0, 1, 2, 3, 4].map(opponentsForChoice)).toEqual([2, 3, 4, 5, 6]);
  });

  it("plays a premade world with historical homelands, offering only its native tribes", () => {
    const setup = fresh("world");
    expect(setupMenu(setup).items).toEqual(["Earth", "Europe", "Middle East"]);
    expect(setupChoose(setup, 2)).toBe(false);
    expect(setupMenu(setup).items).toEqual(["In their historical homelands", "Anywhere on the map"]);
    setupChoose(setup, 0);
    setupChoose(setup, 3); // King
    setupChoose(setup, 4); // 7 civilizations
    const tribes = setupMenu(setup).items;
    expect(tribes).toContain("Egyptians");
    expect(tribes).not.toContain("Aztecs");
    expect(setupChoose(setup, tribes.indexOf("Persians"))).toBe(true);
    expect(setupOptions(setup)).toEqual({ difficulty: 3, opponents: 6, civ: "persians", world: "middle-east", historical: true });
  });

  it("offers every tribe when a premade world scatters the civilizations", () => {
    const setup = fresh("world");
    setupChoose(setup, 1);
    setupChoose(setup, 1);
    setupChoose(setup, 2);
    setupChoose(setup, 4);
    expect(setupMenu(setup).items).toContain("Aztecs");
  });

  it("asks the four customize-world questions before the usual ones", () => {
    const setup = fresh("landMass");
    const titles: string[] = [];
    for (const pick of [2, 0, 2, 1]) { titles.push(setupMenu(setup).title); setupChoose(setup, pick); }
    expect(titles).toEqual(["How much land?", "Temperature?", "Climate?", "Age of the world?"]);
    expect(setup.step).toBe("difficulty");
    setupChoose(setup, 2);
    setupChoose(setup, 4);
    setupChoose(setup, 0);
    expect(setupOptions(setup)).toEqual({ difficulty: 2, opponents: 6, civ: "romans", landMass: 2, temperature: 0, climate: 2, age: 1 });
  });
});

describe("terrain info", () => {
  it("describes yields, movement, specials, improvements, settler work, city and units", () => {
    const s = newGame(2026);
    const u = s.units[0]!;
    revealAround(s, 0, u.x, u.y, 3);
    const t = getTile(s.map, u.x + 1, u.y)!;
    t.terrain = Terrain.Grassland;
    t.river = true;
    t.road = true;
    t.special = true;
    createUnit(s, "militia", 0, u.x + 1, u.y);
    createUnit(s, "militia", 0, u.x + 1, u.y);
    const info = terrainInfo(s, u.x + 1, u.y);
    expect(info.title).toBe("Grassland (River)");
    expect(info.lines[0]).toMatch(/^Food \d+, shields \d+, trade \d+$/);
    expect(info.lines).toContain("Movement cost 1, defence normal");
    expect(info.lines).toContain("Special resource: Resources");
    expect(info.lines).toContain("Improvements: Road");
    expect(info.lines.some((l) => l.startsWith("Settlers can irrigate +1 food"))).toBe(true);
    expect(info.lines).toContain("Units (ours): 2 Militia");

    applyCommand(s, { type: "found", unit: u.id });
    expect(terrainInfo(s, u.x, u.y).lines.some((l) => l.startsWith(`City: ${s.cities[0]!.name} (Romans), size 1`))).toBe(true);
    expect(terrainInfo(s, (u.x + 40) % 80, u.y)).toEqual({ title: "Unexplored", lines: ["Our explorers have not seen this land."] });
  });
});
