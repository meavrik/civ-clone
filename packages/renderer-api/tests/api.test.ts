import { describe, expect, it } from "vitest";
import { applyCommand, createUnit, getTile, newGame, revealAround, Terrain } from "@civ/core";
import { MENU_BAR, MotionPlayer, opponentsForChoice, setupChoose, setupMenu, setupOptions, terrainInfo, topCitiesReport, wondersReport, type SetupState } from "../src/index.js";

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

describe("world reports", () => {
  it("names the bar's four menus in the original's order", () => {
    expect([...MENU_BAR]).toEqual(["Game", "Orders", "Advisors", "World"]);
  });

  it("lists built wonders, hiding the city of a civilization we have not met", () => {
    const s = newGame(2026, { opponents: 2 });
    expect(wondersReport(s).lines).toEqual([{ text: "No wonder has been built yet.", dim: true }]);
    applyCommand(s, { type: "found", unit: s.units[0]!.id });
    const mine = s.cities[0]!;
    mine.wonders.push("pyramids");
    const rival = s.players[1]!;
    const theirs = { ...mine, id: 999, owner: 1, name: "Faraway", x: (mine.x + 30) % s.map.width, wonders: ["colossus"] };
    s.cities.push(theirs);
    const page = wondersReport(s);
    expect(page.title).toBe("Wonders of the World");
    expect(page.lines.map((l) => l.text)).toEqual(expect.arrayContaining(["Pyramids", "Colossus"]));
    const pyramids = page.lines.find((l) => l.text === "Pyramids")!;
    expect(pyramids.right).toBe(`${mine.name} (${s.players[0]!.name})`);
    expect(pyramids.slot).toBe(s.players[0]!.color);
    const colossus = page.lines.find((l) => l.text === "Colossus")!;
    expect(colossus.right).toBe("a distant civilization");
    expect(colossus.right).not.toContain("Faraway");
    expect(colossus.dim).toBe(true);
    expect(colossus.slot).toBe(rival.color);
    expect(page.hint).toMatch(/^2 of \d+ built$/);
  });

  it("ranks the five largest cities we know of by size", () => {
    const s = newGame(2026, { opponents: 2 });
    expect(topCitiesReport(s).lines[0]!.dim).toBe(true);
    applyCommand(s, { type: "found", unit: s.units[0]!.id });
    const base = s.cities[0]!;
    base.size = 3;
    for (let i = 0; i < 6; i++) s.cities.push({ ...base, id: 100 + i, name: `Town${i}`, size: 4 + i, wonders: [] });
    // A big city on land we have never seen stays off the list.
    const hidden = { ...base, id: 200, owner: 1, name: "Unseen", size: 30, x: (base.x + 40) % s.map.width, wonders: [] };
    s.players[0]!.explored[hidden.y * s.map.width + hidden.x] = 0;
    s.cities.push(hidden);
    const page = topCitiesReport(s);
    expect(page.lines.map((l) => l.text)).toEqual(["1. Town5", "2. Town4", "3. Town3", "4. Town2", "5. Town1"]);
    expect(page.lines[0]!.right).toBe(`size 9 (${s.players[0]!.name})`);
  });
});

describe("unit motion", () => {
  const step = (unit: number, fromX: number, fromY: number, toX: number, toY: number, aboard?: number) =>
    ({ unit, type: "militia", owner: 0, fromX, fromY, toX, toY, ...(aboard !== undefined ? { aboard } : {}) });
  const pace = { stepMs: 100, maxMs: 1000, width: 80 };

  it("slides one square at a time, each step after the one before", () => {
    const m = new MotionPlayer();
    m.play([step(1, 10, 10, 11, 10), step(1, 11, 10, 12, 11)], 0, pace);
    expect(m.at(0)).toEqual([{ unit: 1, type: "militia", owner: 0, x: 10, y: 10 }]);
    expect(m.at(50)[0]).toMatchObject({ x: 10.5, y: 10 });
    expect(m.at(150)[0]).toMatchObject({ x: 11.5, y: 10.5 });
    expect(m.busy(150)).toBe(true);
    expect(m.at(200)).toEqual([]);
    expect(m.busy(200)).toBe(false);
  });

  it("holds a unit on its old square until its turn to move comes", () => {
    const m = new MotionPlayer();
    m.play([step(1, 10, 10, 11, 10)], 0, pace);
    m.play([step(2, 20, 20, 20, 21)], 0, pace);
    expect(m.at(50).find((u) => u.unit === 2)).toMatchObject({ x: 20, y: 20 });
    expect(m.at(150).map((u) => u.unit)).toEqual([2]);
    expect(m.at(150)[0]).toMatchObject({ y: 20.5 });
  });

  it("moves cargo in its ship's beat and marks it aboard", () => {
    const m = new MotionPlayer();
    m.play([step(5, 3, 3, 4, 3), step(6, 3, 3, 4, 3, 5), step(5, 4, 3, 5, 3), step(6, 4, 3, 5, 3, 5)], 0, pace);
    const mid = m.at(50);
    expect(mid).toHaveLength(2);
    expect(mid.find((u) => u.unit === 6)).toMatchObject({ x: 3.5, aboard: 5 });
    expect(m.busy(199)).toBe(true);
    expect(m.busy(200)).toBe(false);
  });

  it("slides the short way across the seam", () => {
    const m = new MotionPlayer();
    m.play([step(1, 79, 5, 0, 5), step(2, 0, 6, 79, 6)], 0, pace);
    expect(m.at(50).find((u) => u.unit === 1)!.x).toBeCloseTo(79.5);
    expect(m.at(150).find((u) => u.unit === 2)!.x).toBeCloseTo(-0.5);
  });

  it("fits a long chain into the time allowed, and clear() snaps everything home", () => {
    const m = new MotionPlayer();
    const chain = Array.from({ length: 40 }, (_, i) => step(1, i, 0, i + 1, 0));
    m.play(chain, 0, pace);
    expect(m.busy(999)).toBe(true);
    expect(m.busy(1000)).toBe(false);
    m.clear();
    expect(m.at(10)).toEqual([]);
  });
});
