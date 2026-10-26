import { describe, expect, it } from "vitest";
import { applyCommand, building, BUILDINGS, createUnit, getTile, landAt, newGame, revealAround, SPACE_PARTS, Terrain, wonder, WONDERS, type UnitBattle } from "@civ/core";
import { rankedName, rankLine, rankProgress, showsRank } from "../src/index.js";
import { builtNotice, cityUnits, DEATH_MS, hasIcons, ICONS, iconSegments, LUNGE_MS, MENU_BAR, MotionPlayer, moveRefusal, workRefusal, NUDGE_MS, researchOutlook, opponentsForChoice, wrapIconLine, setupChoose, setupMenu, setupOptions, terrainInfo, topCitiesReport, wondersReport, type SetupState } from "../src/index.js";

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
    // Then its size, the original's selected, each with its squares beside it.
    expect(setupMenu(setup)).toMatchObject({ title: "How big a world?", items: ["Small", "Medium", "Large"], right: ["80 x 50", "120 x 75", "160 x 100"], selected: 0 });
    setupChoose(setup, 2);
    expect(setupMenu(setup).items).toEqual(["In their historical homelands", "Anywhere on the map"]);
    setupChoose(setup, 0);
    setupChoose(setup, 3); // King
    setupChoose(setup, 4); // 7 civilizations
    const tribes = setupMenu(setup).items;
    expect(tribes).toContain("Egyptians");
    expect(tribes).not.toContain("Aztecs");
    expect(setupChoose(setup, tribes.indexOf("Persians"))).toBe(true);
    expect(setupOptions(setup)).toEqual({ difficulty: 3, opponents: 6, civ: "persians", world: "middle-east", historical: true, size: "large" });
  });

  it("offers every tribe when a premade world scatters the civilizations", () => {
    const setup = fresh("world");
    setupChoose(setup, 1);
    setupChoose(setup, 0); // small: the original's size, left out of the options
    setupChoose(setup, 1);
    setupChoose(setup, 2);
    setupChoose(setup, 4);
    expect(setupMenu(setup).items).toContain("Aztecs");
    setupChoose(setup, 0);
    expect(setupOptions(setup)).not.toHaveProperty("size");
  });

  it("asks the world's size and the four customize-world questions before the usual ones", () => {
    const setup = fresh("size");
    const titles: string[] = [];
    for (const pick of [1, 2, 0, 2, 1]) { titles.push(setupMenu(setup).title); setupChoose(setup, pick); }
    expect(titles).toEqual(["How big a world?", "How much land?", "Temperature?", "Climate?", "Age of the world?"]);
    expect(setup.step).toBe("difficulty");
    setupChoose(setup, 2);
    setupChoose(setup, 4);
    setupChoose(setup, 0);
    expect(setupOptions(setup)).toEqual({ difficulty: 2, opponents: 6, civ: "romans", size: "medium", landMass: 2, temperature: 0, climate: 2, age: 1 });
  });
});

describe("terrain info", () => {
  it("describes yields, movement, specials, improvements, settler work, city and units", () => {
    const s = newGame(2026);
    const u = s.units[0]!;
    revealAround(s, 0, u.x, u.y, 3);
    const t = getTile(s.map, u.x + 1, u.y)!;
    t.terrain = Terrain.Plains;
    t.river = true;
    t.road = true;
    t.special = true;
    createUnit(s, "militia", 0, u.x + 1, u.y);
    createUnit(s, "militia", 0, u.x + 1, u.y);
    const working = createUnit(s, "settlers", 0, u.x + 1, u.y);
    working.order = { kind: "work", work: "road", turnsLeft: 2 };
    const info = terrainInfo(s, u.x + 1, u.y);
    // The title names the terrain and the land it lies in; the resource and the river are told of below, once.
    const land = landAt(s.map, u.x + 1, u.y)!.name!;
    expect(info.title).toBe(`Plains, ${land}`);
    // Grassland has no first special in the original: a special flag there names nothing.
    t.terrain = Terrain.Grassland;
    expect(terrainInfo(s, u.x + 1, u.y).lines.some((l) => l.includes("Horses"))).toBe(false);
    t.terrain = Terrain.Plains;
    // Pictures stand in for the words: yields, movement and a river's defence on one line, then a word on the
    // terrain, then the features with what each adds.
    expect(info.lines[0]).toMatch(/^\{food\} \d+  \{shield\} \d+  \{trade\} \d+  \{boot\} 1  \{tower\} \+50%$/);
    expect(info.lines[1]).toBe("Open land for fields and herds, with a little timber.");
    expect(info.lines).toContain("{star} Horses +2 {shield}  {river} River +1 {trade}, no road trade  {road} Road");
    expect(info.lines.some((l) => l.startsWith("Improvements:  {irrigate} +1 {food}"))).toBe(true);
    expect(info.lines).toContain("{swords} 2 Militia, Settlers (ours)");
    expect(info.lines).toContain("{road} Building a road, 2 turns");
    for (const line of info.lines) for (const seg of iconSegments(line)) if ("icon" in seg) expect(ICONS).toContain(seg.icon);

    applyCommand(s, { type: "found", unit: u.id });
    expect(terrainInfo(s, u.x, u.y).lines.some((l) => l.startsWith(`{city} ${s.cities[0]!.name} (Romans), size 1`))).toBe(true);
    expect(terrainInfo(s, (u.x + 40) % 80, u.y)).toEqual({ title: "Unexplored", lines: ["Not explored yet."] });
  });

  it("warns where only settlers climb, where wheels need a road and where the ground wears units down", () => {
    const s = newGame(2026);
    const u = s.units[0]!;
    revealAround(s, 0, u.x, u.y, 3);
    const t = getTile(s.map, u.x + 1, u.y)!;
    const roadLines = () => terrainInfo(s, u.x + 1, u.y).lines.filter((l) => l.startsWith("{road} "));
    Object.assign(t, { terrain: Terrain.Mountains, river: false, road: false, special: false });
    expect(roadLines()).toEqual(["{road} Settlers only, until a road"]);
    t.terrain = Terrain.Jungle;
    expect(roadLines()).toEqual(["{road} Wheeled units need a road"]);
    t.road = true;
    expect(roadLines()).toEqual(["{road} Road"]);
    t.terrain = Terrain.Desert;
    expect(terrainInfo(s, u.x + 1, u.y).lines).toContain("{heart} Wears units down 10% a turn  until Trade");
    applyCommand(s, { type: "found", unit: u.id });
    expect(terrainInfo(s, u.x + 1, u.y).lines.some((l) => l.startsWith("{heart}"))).toBe(false);
  });
});

describe("world reports", () => {
  it("names the bar's menus in the original's order, Diplomacy among them", () => {
    expect([...MENU_BAR]).toEqual(["Game", "Orders", "Advisors", "Diplomacy", "World", "Debug"]);
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

describe("finished builds", () => {
  it("says what a finished improvement, wonder or spaceship part does; units open no window", () => {
    const s = newGame(2026, { opponents: 2 });
    applyCommand(s, { type: "found", unit: s.units[0]!.id });
    const c = s.cities[0]!;
    expect(builtNotice(s, c.id, { kind: "unit", id: "militia" })).toBeNull();
    // Settlers cost the city a citizen, so it asks what to build next, and says in numbers what the city gave.
    expect(builtNotice(s, c.id, { kind: "unit", id: "settlers" })).toEqual({ title: `${c.name} generates a group of Settlers`, lines: [`{people} Population ${c.size}`] });
    const change = { size: [3, 2] as [number, number], food: [3, 0] as [number, number], shields: [2, 2] as [number, number], trade: [2, 1] as [number, number] };
    expect(builtNotice(s, c.id, { kind: "unit", id: "settlers" }, change)!.lines).toEqual([
      "{people} Population 3 → 2",
      "{food} Food +3 → 0 a turn",
      "{trade} Trade +2 → +1 a turn",
    ]);
    expect(builtNotice(s, 9999, { kind: "building", id: "granary" })).toBeNull();
    expect(builtNotice(s, c.id, { kind: "building", id: "granary" })).toEqual({
      title: `${c.name} builds Granary`,
      lines: [`{food} ${building("granary").text}`, "{purse} Upkeep 1 gold"],
    });
    // The palace costs nothing to keep, so it says no upkeep, only the culture it brings.
    expect(builtNotice(s, c.id, { kind: "building", id: "palace" })!.lines).toEqual([`{crown} ${building("palace").text}`, "{culture} Culture +3"]);
    expect(builtNotice(s, c.id, { kind: "building", id: "temple" })!.lines.at(-1)).toBe("{purse} Upkeep 1 gold  {culture} Culture +2");
    expect(builtNotice(s, c.id, { kind: "wonder", id: "pyramids" })).toEqual({
      title: `${c.name} completes Pyramids`,
      lines: [`{star} ${wonder("pyramids").text}`, "{hourglass} Ends with Communism  {culture} Culture +4"],
    });
    expect(builtNotice(s, c.id, { kind: "wonder", id: "magellans" })!.lines).toEqual([`{star} ${wonder("magellans").text}`, "{culture} Culture +4"]);
    // Saves before version 14 gathered culture every turn.
    s.accruedCulture = true;
    expect(builtNotice(s, c.id, { kind: "building", id: "temple" })!.lines.at(-1)).toBe("{purse} Upkeep 1 gold  {culture} Culture +1 a turn");
    expect(builtNotice(s, c.id, { kind: "wonder", id: "magellans" })!.lines.at(-1)).toBe("{culture} Culture +3 a turn");
    delete s.accruedCulture;
    s.players[0]!.spaceship.structurals = 3;
    expect(builtNotice(s, c.id, { kind: "spaceship", id: "structural" })!.lines.at(-1)).toBe("{star} 3 of 32 built");
  });

  it("has a line of text for every improvement, wonder and spaceship part, with icons it can draw", () => {
    for (const r of [...BUILDINGS, ...WONDERS, ...SPACE_PARTS]) expect(r.text.length, r.id).toBeGreaterThan(15);
    const s = newGame(2026, { opponents: 2 });
    applyCommand(s, { type: "found", unit: s.units[0]!.id });
    const c = s.cities[0]!;
    for (const b of BUILDINGS)
      for (const line of builtNotice(s, c.id, { kind: "building", id: b.id })!.lines) expect(iconSegments(line).every((seg) => "icon" in seg || !/\{[a-z]+\}/.test(seg.text)), line).toBe(true);
  });
});

describe("unit ranks", () => {
  it("names the rank before the unit, tells what it adds and how far the next is", () => {
    expect(rankedName({ type: "legion", xp: 0 })).toBe("Legion");
    expect(rankedName({ type: "legion", xp: 4 })).toBe("Veteran Legion");
    expect(rankLine(0)).toBe("Recruit");
    expect(rankLine(1)).toBe("{regular}Regular +25%");
    expect(rankLine(10)).toBe("{elite}Elite +100%");
    for (const xp of [1, 3, 6, 10]) expect(hasIcons(rankLine(xp))).toBe(true);
    expect(rankProgress(4)).toBe("4/6 experience to Hardened");
    expect(rankProgress(10)).toBe("The highest rank");
    // Settlers have no rank to tell until they win a fight.
    expect(showsRank({ type: "settlers", xp: 0 })).toBe(false);
    expect(showsRank({ type: "settlers", xp: 1 })).toBe(true);
    expect(showsRank({ type: "militia", xp: 0 })).toBe(true);
  });
});

describe("city units", () => {
  it("lists the units in the city first, from any home, then those it supports elsewhere, with what each costs it", () => {
    const s = newGame(2026, { opponents: 2 });
    applyCommand(s, { type: "found", unit: s.units[0]!.id });
    const c = s.cities[0]!;
    s.units = s.units.filter((u) => u.owner !== 0);
    const away = createUnit(s, "militia", 0, c.x, c.y + 2, c.id);
    const home = createUnit(s, "settlers", 0, c.x, c.y, c.id);
    const guest = createUnit(s, "phalanx", 0, c.x, c.y, null);
    const second = createUnit(s, "militia", 0, c.x + 2, c.y, c.id);
    // Size 1 under Despotism: the first soldier it supports (the one away) is free, the second pays a shield; the settlers only eat.
    expect(cityUnits(s, c).map(({ unit, here, shields, food }) => [unit.id, here, shields, food])).toEqual([
      [home.id, true, 0, 1],
      [guest.id, true, 0, 0],
      [away.id, false, 0, 0],
      [second.id, false, 1, 0],
    ]);
  });
});

describe("unit motion", () => {
  const step = (unit: number, fromX: number, fromY: number, toX: number, toY: number, aboard?: number) =>
    ({ kind: "step" as const, unit, type: "militia", owner: 0, fromX, fromY, toX, toY, ...(aboard !== undefined ? { aboard } : {}) });
  const pace = { stepMs: 100, maxMs: 1000, width: 80 };

  it("slides one square at a time, each step after the one before", () => {
    const m = new MotionPlayer();
    m.play([step(1, 10, 10, 11, 10), step(1, 11, 10, 12, 11)], 0, pace);
    expect(m.at(0).moving).toEqual([{ unit: 1, type: "militia", owner: 0, x: 10, y: 10 }]);
    expect(m.at(50).moving[0]).toMatchObject({ x: 10.5, y: 10 });
    expect(m.at(150).moving[0]).toMatchObject({ x: 11.5, y: 10.5 });
    expect(m.busy(150)).toBe(true);
    expect(m.at(200).moving).toEqual([]);
    expect(m.busy(200)).toBe(false);
  });

  it("holds a unit on its old square until its turn to move comes", () => {
    const m = new MotionPlayer();
    m.play([step(1, 10, 10, 11, 10)], 0, pace);
    m.play([step(2, 20, 20, 20, 21)], 0, pace);
    expect(m.at(50).moving.find((u) => u.unit === 2)).toMatchObject({ x: 20, y: 20 });
    expect(m.at(150).moving.map((u) => u.unit)).toEqual([2]);
    expect(m.at(150).moving[0]).toMatchObject({ y: 20.5 });
  });

  it("moves cargo in its ship's beat and marks it aboard", () => {
    const m = new MotionPlayer();
    m.play([step(5, 3, 3, 4, 3), step(6, 3, 3, 4, 3, 5), step(5, 4, 3, 5, 3), step(6, 4, 3, 5, 3, 5)], 0, pace);
    const mid = m.at(50).moving;
    expect(mid).toHaveLength(2);
    expect(mid.find((u) => u.unit === 6)).toMatchObject({ x: 3.5, aboard: 5 });
    expect(m.busy(199)).toBe(true);
    expect(m.busy(200)).toBe(false);
  });

  it("slides the short way across the seam", () => {
    const m = new MotionPlayer();
    m.play([step(1, 79, 5, 0, 5), step(2, 0, 6, 79, 6)], 0, pace);
    expect(m.at(50).moving.find((u) => u.unit === 1)!.x).toBeCloseTo(79.5);
    expect(m.at(150).moving.find((u) => u.unit === 2)!.x).toBeCloseTo(-0.5);
  });

  it("nudges a refused unit toward the square it could not enter and back, after a slide still playing", () => {
    const m = new MotionPlayer();
    m.play([step(1, 10, 10, 11, 10)], 0, pace);
    m.nudge({ id: 1, type: "militia", owner: 0, x: 11, y: 10 }, 0, -1, 0);
    expect(m.at(50).moving).toEqual([{ unit: 1, type: "militia", owner: 0, x: 10.5, y: 10 }]);
    // At the height of the lean it stands well out toward the square, then it springs back.
    const lean = m.at(100 + NUDGE_MS * 0.275).moving[0]!;
    expect(lean.x).toBe(11);
    expect(lean.y).toBeCloseTo(9.7, 2);
    expect(m.at(100 + NUDGE_MS * 0.55).moving[0]!.y).toBeCloseTo(10, 5);
    expect(m.at(100 + NUDGE_MS - 1).moving[0]!.y).toBeCloseTo(10, 2);
    expect(m.busy(100 + NUDGE_MS - 1)).toBe(true);
    expect(m.busy(100 + NUDGE_MS)).toBe(false);
    expect(m.at(100 + NUDGE_MS).moving).toEqual([]);
    // Pressing again while one waits replaces it rather than queueing a train of nudges.
    m.play([step(2, 0, 0, 1, 0)], 1000, pace);
    m.nudge({ id: 1, type: "militia", owner: 0, x: 11, y: 10 }, 1, 0, 1000);
    m.nudge({ id: 1, type: "militia", owner: 0, x: 11, y: 10 }, 1, 0, 1010);
    expect(m.busy(1100 + NUDGE_MS - 1)).toBe(true);
    expect(m.busy(1100 + NUDGE_MS)).toBe(false);
  });

  it("fits a long chain into the time allowed, and clear() snaps everything home", () => {
    const m = new MotionPlayer();
    const chain = Array.from({ length: 40 }, (_, i) => step(1, i, 0, i + 1, 0));
    m.play(chain, 0, pace);
    expect(m.busy(999)).toBe(true);
    expect(m.busy(1000)).toBe(false);
    m.clear();
    expect(m.at(10).moving).toEqual([]);
  });

  it("plays a fight: the lunge, a blow per round draining hit points, then the loser's end", () => {
    const m = new MotionPlayer();
    const battle: UnitBattle = {
      kind: "battle",
      attacker: { unit: 1, type: "legion", owner: 0, x: 10, y: 10, hp: 10, maxHp: 10, firepower: 1 },
      defender: { unit: 2, type: "phalanx", owner: 1, x: 11, y: 10, hp: 3, maxHp: 10, firepower: 1 },
      rounds: [true, false, true, true],
      attackerWon: true,
      alsoLost: [3],
    };
    m.play([step(1, 9, 10, 10, 10), battle], 0, { ...pace, battleMs: 2000, battleTotalMs: 2000 });
    // While the attacker walks up, the defender waits on its square as it was before the fight.
    const walking = m.at(50);
    expect(walking.battle).toBeUndefined();
    expect(walking.moving.find((u) => u.unit === 2)).toMatchObject({ x: 11, y: 10, hp: 3, maxHp: 10, stacked: true });
    const begin = 100;
    const lunge = m.at(begin + LUNGE_MS / 2).battle!;
    expect(lunge.attacker.x).toBeGreaterThan(10);
    expect(lunge.attacker.x).toBeLessThan(10.31);
    expect(lunge.defender).toMatchObject({ hp: 3, hit: 0, dying: 0, stacked: true });
    const round = 110;
    const first = m.at(begin + LUNGE_MS + 1).battle!;
    expect(first.defender.hp).toBe(2);
    expect(first.defender.hit).toBeGreaterThan(0.9);
    expect(first.attacker.hit).toBe(0);
    const second = m.at(begin + LUNGE_MS + round + 1).battle!;
    expect(second.attacker.hp).toBe(9);
    expect(second.attacker.hit).toBeGreaterThan(0.9);
    const roundsEnd = begin + LUNGE_MS + 4 * round;
    const end = m.at(roundsEnd + DEATH_MS / 2).battle!;
    expect(end.defender.hp).toBe(0);
    expect(end.defender.dying).toBeCloseTo(0.5, 1);
    expect(end.attacker.dying).toBe(0);
    expect(end.attacker.x).toBeLessThan(lunge.attacker.x + 0.2);
    expect(m.busy(roundsEnd + DEATH_MS - 1)).toBe(true);
    expect(m.busy(roundsEnd + DEATH_MS)).toBe(false);
    expect(m.at(roundsEnd + DEATH_MS)).toEqual({ moving: [] });
  });

  it("keeps a run of fights within the time allowed for them", () => {
    const m = new MotionPlayer();
    const fight = (unit: number): UnitBattle => ({
      kind: "battle",
      attacker: { unit, type: "legion", owner: 1, x: 5, y: 5, hp: 10, maxHp: 10, firepower: 1 },
      defender: { unit: 100 + unit, type: "militia", owner: 0, x: 6, y: 5, hp: 10, maxHp: 10, firepower: 1 },
      rounds: Array.from({ length: 19 }, (_, i) => i % 2 === 0),
      attackerWon: true,
      alsoLost: [],
    });
    m.play([fight(1), fight(2), fight(3), fight(4)], 0, { ...pace, battleMs: 1600, battleTotalMs: 4000 });
    expect(m.busy(4000)).toBe(true);
    expect(m.busy(4000 + 4 * 30 * 19)).toBe(false);
  });
});

describe("icon lines", () => {
  it("splits {icon} tokens from text, keeps unknown tokens as text, and wraps between groups", () => {
    expect(iconSegments("{food} 2  {shield}1")).toEqual([{ icon: "food" }, { text: " 2  " }, { icon: "shield" }, { text: "1" }]);
    expect(iconSegments("{nope} x")).toEqual([{ text: "{nope}" }, { text: " x" }]);
    expect(hasIcons("plain words")).toBe(false);
    expect(hasIcons("{nope}")).toBe(false);
    expect(hasIcons("{coin}5")).toBe(true);
    const width = (s: string) => s.length;
    expect(wrapIconLine("aaa  bbb  ccc", 8, width)).toEqual(["aaa  bbb", "ccc"]);
    expect(wrapIconLine("aaaaaaaaaa  b", 4, width)).toEqual(["aaaaaaaaaa", "b"]);
  });
});

describe("refused moves", () => {
  it("say in a few words why a unit cannot go", () => {
    const s = newGame(2026);
    const u = s.units.find((x) => x.owner === 0 && x.type === "settlers")!;
    getTile(s.map, u.x + 1, u.y)!.terrain = Terrain.Ocean;
    for (const o of s.units) if (o.x === u.x + 1 && o.y === u.y && o.id !== u.id) o.x = u.x - 3;
    const r = applyCommand(s, { type: "move", unit: u.id, dx: 1, dy: 0 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(moveRefusal(s, u.id, 1, 0, r.reason)).toBe("Can't go there yet.");
    getTile(s.map, u.x, u.y + 1)!.terrain = Terrain.Mountains;
    expect(moveRefusal(s, u.id, 0, 1, "steep")).toBe("Needs a road.");
    expect(moveRefusal(s, u.id, 0, 1, "no-moves")).toBe("No moves left.");
    expect(moveRefusal(s, u.id, 0, 1, "zoc")).toBe("Enemy too close.");
    // A reason without its own words still reads as a sentence.
    expect(moveRefusal(s, u.id, 0, 1, "too close to home")).toBe("Too close to home.");
  });

  it("say why a settler cannot take up a job", () => {
    expect(workRefusal("needs:bridge_building")).toBe("A road across the river needs Bridge Building.");
    expect(workRefusal("needs:railroad")).toBe("Needs Railroad.");
    expect(workRefusal("has road")).toBe("Already has a road.");
    expect(workRefusal("needs water")).toBe("Needs water beside it: a river, the sea or irrigation.");
    expect(workRefusal("something new")).toBe("Something new.");
  });
});

describe("research outlook", () => {
  it("names the advance under study, the beakers toward it and the turns to go", () => {
    const s = newGame(2026);
    const p = s.players[0]!;
    p.researching = null;
    expect(researchOutlook(s)).toMatchObject({ id: null, name: "" });
    p.researching = "pottery";
    p.science = 3;
    expect(researchOutlook(s)).toMatchObject({ id: "pottery", name: "Pottery", have: 3, turns: null });
    const settlers = s.units.find((x) => x.owner === 0 && x.type === "settlers")!;
    getTile(s.map, settlers.x, settlers.y)!.river = true; // trade for the new city
    applyCommand(s, { type: "found", unit: settlers.id });
    p.taxRate = 0;
    p.luxRate = 0;
    p.sciRate = 10;
    const r = researchOutlook(s);
    expect(r.turns).toBeGreaterThan(0);
    expect(r.cost).toBeGreaterThan(r.have);
  });
});
