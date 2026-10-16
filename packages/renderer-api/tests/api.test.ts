import { describe, expect, it } from "vitest";
import { applyCommand, createUnit, getTile, newGame, revealAround, Terrain } from "@civ/core";
import { opponentsForChoice, setupMenu, terrainInfo } from "../src/index.js";

describe("setup", () => {
  it("asks for 3 to 7 civilizations in total and defaults to 7", () => {
    const m = setupMenu({ step: "opponents", difficulty: 2, opponents: 6, civ: "romans" });
    expect(m.title).toBe("How many civilizations?");
    expect(m.items).toEqual(["3 civilizations", "4 civilizations", "5 civilizations", "6 civilizations", "7 civilizations"]);
    expect(m.selected).toBe(4);
    expect([0, 1, 2, 3, 4].map(opponentsForChoice)).toEqual([2, 3, 4, 5, 6]);
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
