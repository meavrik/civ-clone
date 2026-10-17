import { mkdirSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { applyCommand, autoAssignWorkers, buildOptions, building, createUnit, getTile, newGame, revealAround, Terrain, unitType } from "@civ/core";
import { C, drawCityScreen, drawDiscoveryScreen, drawMainScreen, drawMenu, drawUnit, playerColor, terrainInfo, drawRatesScreen, drawScienceScreen, drawText, drawTextInput, menuHit, PALETTE, Surface, textWidth, type MainScreenView } from "../src/index.js";
import { encodePng } from "./png.js";

describe("retro renderer", () => {
  it("palette has 256 entries, EGA first", () => {
    expect(PALETTE.length).toBe(256);
    expect(PALETTE[15]).toEqual([255, 255, 255]);
  });

  it("draws a modal with paragraphs above its choices and hit-tests only the choices", () => {
    const s = Surface.screen();
    s.fill(0);
    const box = { title: "A Tribal Village", body: ["Among the villagers you find scrolls of ancient wisdom.", "We learn Bronze Working!"], items: ["OK"], selected: 0 };
    drawMenu(s, box);
    let okRow = -1;
    for (let y = 0; y < 200 && okRow < 0; y++) if (menuHit(box, 160, y) === 0) okRow = y;
    expect(okRow).toBeGreaterThan(100 - 30);
    expect(menuHit(box, 160, okRow - 12)).toBe(-1);
    mkdirSync(new URL("./out/", import.meta.url), { recursive: true });
    writeFileSync(new URL("./out/modal.png", import.meta.url), encodePng(s, 3));
  });

  it("draws a text prompt with a cursor", () => {
    const s = Surface.screen();
    s.fill(0);
    drawTextInput(s, { title: "Name the new city", text: "Rome", maxLength: 14 }, true);
    expect(s.data.some((c) => c === 15)).toBe(true); // white typed text
    expect(s.data.some((c) => c === 14)).toBe(true); // yellow cursor
    mkdirSync(new URL("./out/", import.meta.url), { recursive: true });
    writeFileSync(new URL("./out/text-input.png", import.meta.url), encodePng(s, 3));
  });

  it("font measures proportionally", () => {
    expect(textWidth("i")).toBeLessThan(textWidth("W"));
    const s = new Surface(64, 8);
    drawText(s, 0, 0, "Hi", 15);
    expect(s.data.some((c) => c === 15)).toBe(true);
  });

  it("renders the main screen with overlays and units", () => {
    const state = newGame(2026);
    const u = state.units[0]!;
    // Reveal a neighbourhood and dress it with improvements so every overlay shows.
    revealAround(state, 0, u.x, u.y, 9);
    const here = getTile(state.map, u.x, u.y)!;
    here.road = true;
    for (const [dx, dy] of [[1, 0], [2, 0], [2, 1]] as const) {
      const t = getTile(state.map, u.x + dx, u.y + dy)!;
      t.road = true;
    }
    const irr = getTile(state.map, u.x - 1, u.y)!;
    irr.terrain = Terrain.Plains;
    irr.irrigation = true;
    const mine = getTile(state.map, u.x, u.y + 1)!;
    mine.terrain = Terrain.Hills;
    mine.mine = true;
    const m = createUnit(state, "militia", 0, u.x + 2, u.y + 1);
    applyCommand(state, { type: "fortify", unit: m.id });
    applyCommand(state, { type: "endTurn" });
    // Let the other civilizations pass so the screen shows our view again.
    while (state.currentPlayer !== 0) applyCommand(state, { type: "endTurn" });
    createUnit(state, "trireme", 0, u.x + 1, u.y - 2);
    // A stack on land and a village on land near the settlers.
    const land: [number, number][] = [];
    for (let dy = -4; dy <= 4; dy++)
      for (let dx = -5; dx <= 5; dx++) {
        const t = getTile(state.map, u.x + dx, u.y + dy);
        if (t && t.terrain !== Terrain.Ocean && Math.max(Math.abs(dx), Math.abs(dy)) >= 2) land.push([u.x + dx, u.y + dy]);
      }
    const [sx, sy] = land[0]!;
    createUnit(state, "legion", 0, sx, sy);
    createUnit(state, "legion", 0, sx, sy);
    const [hx, hy] = land[land.length - 1]!;
    getTile(state.map, hx, hy)!.hut = true;
    revealAround(state, 0, u.x, u.y, 9);
    for (let dy = -6; dy <= 6; dy++) for (let dx = -8; dx <= 8; dx++) {
      const yy = u.y + dy;
      if (yy >= 0 && yy < state.map.height) state.players[0]!.visible[yy * state.map.width + ((u.x + dx) % state.map.width + state.map.width) % state.map.width] = 1;
    }
    state.activeUnit = u.id;

    const view: MainScreenView = {
      originX: u.x - 7,
      originY: Math.max(0, u.y - 6),
      blink: true,
      message: "Zone of control",
    };
    const s = Surface.screen();
    drawMainScreen(s, state, view);
    expect(s.data.length).toBe(320 * 200);
    mkdirSync(new URL("./out/", import.meta.url), { recursive: true });
    writeFileSync(new URL("./out/main-screen.png", import.meta.url), encodePng(s, 3));

    // A long message wraps inside the panel and never crosses into the map.
    view.message = "Trade route Rome-Capua: +45 gold and science, a long message that must wrap";
    state.relations["0:1"] = "war";
    state.relations["0:2"] = "war";
    drawMainScreen(s, state, view);
    for (let y = 0; y < 200; y++) expect(s.data[y * 320 + 79], `panel edge at row ${y}`).not.toBe(14);
    writeFileSync(new URL("./out/panel-message.png", import.meta.url), encodePng(s, 3));

    // A gliding camera draws the viewport shifted by a fraction of a tile and still stops at the panel.
    view.panX = 0.4;
    view.panY = 0.6;
    drawMainScreen(s, state, view);
    expect(s.get(70, 100)).not.toBe(0);
    view.panX = undefined;
    view.panY = undefined;

    // Inspecting a tile shows terrain, yields and what stands there.
    view.message = undefined;
    view.inspect = { x: u.x + 2, y: u.y + 1 };
    state.currentPlayer = 0;
    state.activeUnit = null;
    view.autoEnd = true;
    drawMainScreen(s, state, view);
    writeFileSync(new URL("./out/panel-inspect.png", import.meta.url), encodePng(s, 3));
  });

  it("draws a sliding unit between squares and not on its own square", () => {
    const state = newGame(2026);
    const u = state.units[0]!;
    revealAround(state, 0, u.x, u.y, 9);
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) getTile(state.map, u.x + dx, u.y + dy)!.terrain = Terrain.Grassland;
    state.activeUnit = null;
    const view: MainScreenView = { originX: u.x - 7, originY: Math.max(0, u.y - 6), blink: true };
    const s = Surface.screen();
    // Halfway from the square on its left: the map shows it there, and its own square is empty.
    drawMainScreen(s, state, { ...view, moving: [{ unit: u.id, type: u.type, owner: 0, x: u.x - 0.5, y: u.y }] });
    writeFileSync(new URL("./out/unit-sliding.png", import.meta.url), encodePng(s, 3));
    const others = state.units.filter((o) => o.id !== u.id);
    const expected = Surface.screen();
    drawMainScreen(expected, { ...state, units: others }, view);
    const px = 80 + (u.x - view.originX) * 16;
    const py = 9 + (u.y - view.originY) * 16;
    drawUnit(expected, u, px - 8, py, playerColor(state, 0), false);
    for (let y = 9; y < 200; y++) for (let x = 80; x < 320; x++) expect(s.get(x, y), `pixel ${x},${y}`).toBe(expected.get(x, y));
  });

  it("draws a fight: hit point bars, the flash of a blow, the burst of the loser, and wounds afterwards", () => {
    const state = newGame(2026);
    const u = state.units[0]!;
    revealAround(state, 0, u.x, u.y, 9);
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) getTile(state.map, u.x + dx, u.y + dy)!.terrain = Terrain.Grassland;
    state.activeUnit = null;
    const enemy = createUnit(state, "legion", 1, u.x + 1, u.y);
    state.players[0]!.visible[u.y * state.map.width + u.x + 1] = 1;
    const view: MainScreenView = { originX: u.x - 7, originY: Math.max(0, u.y - 6), blink: true };
    const px = 80 + (u.x - view.originX) * 16;
    const py = 9 + (u.y - view.originY) * 16;
    const count = (surf: Surface, x0: number, colors: number[]) => {
      let n = 0;
      for (let y = py; y < py + 16; y++) for (let x = x0; x < x0 + 16; x++) if (colors.includes(surf.get(x, y))) n++;
      return n;
    };
    const fighter = (unit: number, type: string, owner: number, x: number, hp: number, extra: Partial<{ hit: number; dying: number }> = {}) =>
      ({ unit, type, owner, x, y: u.y, hp, maxHp: 10, stacked: false, hit: 0, dying: 0, ...extra });
    const s = Surface.screen();
    // A blow lands on our settlers: they flash white, both bars show.
    drawMainScreen(s, state, { ...view, battle: { attacker: fighter(enemy.id, "legion", 1, u.x + 1 - 0.3, 6), defender: fighter(u.id, "settlers", 0, u.x, 4, { hit: 1 }) } });
    writeFileSync(new URL("./out/battle-blow.png", import.meta.url), encodePng(s, 3));
    expect(count(s, px, [C.WHITE!])).toBeGreaterThan(60);
    expect(count(s, px, [C.YELLOW!])).toBeGreaterThan(0); // the defender's bar, at 4 of 10
    // The settlers lose: a burst where they stood.
    drawMainScreen(s, state, { ...view, battle: { attacker: fighter(enemy.id, "legion", 1, u.x + 1 - 0.15, 6), defender: fighter(u.id, "settlers", 0, u.x, 0, { dying: 0.4 }) } });
    writeFileSync(new URL("./out/battle-burst.png", import.meta.url), encodePng(s, 3));
    expect(count(s, px, [C.ORANGE!, C.YELLOW!, C.LRED!])).toBeGreaterThan(10);
    // Afterwards a wounded unit wears its bar on the map.
    enemy.hp = 2;
    state.units = state.units.filter((o) => o.id !== u.id);
    drawMainScreen(s, state, view);
    writeFileSync(new URL("./out/unit-wounded.png", import.meta.url), encodePng(s, 3));
    expect(count(s, px + 16, [C.LRED!])).toBeGreaterThan(0);
  });

  it("shows the panel as icons, and a badge of its job on a working settler", () => {
    const state = newGame(2026);
    const u = state.units[0]!;
    revealAround(state, 0, u.x, u.y, 9);
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) getTile(state.map, u.x + dx, u.y + dy)!.terrain = Terrain.Grassland;
    getTile(state.map, u.x, u.y)!.road = true;
    getTile(state.map, u.x, u.y)!.river = true;
    state.players[0]!.researching = "alphabet";
    state.players[0]!.science = 5;
    state.players[0]!.gold = 123;
    const worker = createUnit(state, "settlers", 0, u.x + 1, u.y);
    worker.order = { kind: "work", work: "irrigate", turnsLeft: 3 };
    const legion = createUnit(state, "legion", 0, u.x, u.y);
    legion.veteran = true;
    legion.hp = 6;
    state.activeUnit = legion.id;
    const view: MainScreenView = { originX: u.x - 7, originY: Math.max(0, u.y - 6), blink: true, inspect: { x: u.x + 1, y: u.y } };
    const s = Surface.screen();
    drawMainScreen(s, state, view);
    writeFileSync(new URL("./out/panel-icons.png", import.meta.url), encodePng(s, 3));
    // The working settler's badge: a black square in its top right corner with the blue drop inside.
    const bx = 80 + (u.x + 1 - view.originX) * 16 + 7;
    const by = 9 + (u.y - view.originY) * 16;
    let black = 0;
    let blue = 0;
    for (let y = by; y < by + 9; y++) for (let x = bx; x < bx + 9; x++) { const c = s.get(x, y); if (c === C.BLACK!) black++; if (c === C.LBLUE!) blue++; }
    expect(black).toBeGreaterThan(20);
    expect(blue).toBeGreaterThan(8);
    // The terrain window speaks in the same pictures.
    const info = terrainInfo(state, worker.x, worker.y);
    drawMenu(s, { title: info.title, body: info.lines, items: ["Center the map here", "Close"], selected: 1 });
    writeFileSync(new URL("./out/terrain-window.png", import.meta.url), encodePng(s, 3));
  });

  it("draws the menu bar above the map, with dropdowns under their titles", async () => {
    const { drawReportScreen, drawWorldMap, menuBarAnchor, menuBarHit, wondersReport, topCitiesReport, VIEW_Y } = await import("../src/index.js");
    const state = newGame(2026);
    const u = state.units[0]!;
    revealAround(state, 0, u.x, u.y, 9);
    applyCommand(state, { type: "found", unit: u.id });
    state.cities[0]!.wonders.push("pyramids");
    const view: MainScreenView = { originX: u.x - 7, originY: Math.max(0, u.y - 6), blink: true, menuOpen: 2 };
    const s = Surface.screen();
    drawMainScreen(s, state, view);
    // Titles left to right along the top rows; nothing of the map shows above the bar's edge.
    const titles: number[] = [];
    for (let x = 0; x < 320; x++) { const t = menuBarHit(x, 4); if (titles.at(-1) !== t) titles.push(t); }
    expect(titles.filter((t) => t >= 0)).toEqual([0, 1, 2, 3]);
    expect(menuBarHit(10, VIEW_Y + 2)).toBe(-1);
    const bg = s.get(316, 2);
    for (let x = 300; x < 320; x++) expect(s.get(x, 2)).toBe(bg);
    const anchor = menuBarAnchor(2);
    const drop = { title: "", items: ["City Status", "Military Advisor", "Foreign Minister", "Science Advisor"], right: ["F1", "F2", "F3", "F4"], selected: 1, anchor };
    drawMenu(s, drop);
    writeFileSync(new URL("./out/menu-bar.png", import.meta.url), encodePng(s, 3));
    let top = -1;
    for (let y = 0; y < 200 && top < 0; y++) if (menuHit(drop, anchor.x + 20, y) === 0) top = y;
    expect(top).toBeGreaterThanOrEqual(VIEW_Y);
    expect(top).toBeLessThan(VIEW_Y + 12);
    drawReportScreen(s, wondersReport(state));
    writeFileSync(new URL("./out/report-wonders.png", import.meta.url), encodePng(s, 3));
    drawReportScreen(s, topCitiesReport(state));
    writeFileSync(new URL("./out/report-cities.png", import.meta.url), encodePng(s, 3));
    drawWorldMap(s, state);
    writeFileSync(new URL("./out/world-map.png", import.meta.url), encodePng(s, 3));
    expect(s.data.some((c) => c !== 0)).toBe(true);
  });
});

describe("garrisons", () => {
  it("marks a city with units inside with a shield: ours always, others' while we see the square", () => {
    const state = newGame(2026);
    const u = state.units[0]!;
    revealAround(state, 0, u.x, u.y, 9);
    applyCommand(state, { type: "found", unit: u.id });
    const city = state.cities[0]!;
    const view: MainScreenView = { originX: u.x - 7, originY: Math.max(0, u.y - 6), blink: false };
    const s = Surface.screen();
    // The shield's white field sits in the city square's top-left corner.
    const shieldAt = (cx: number, cy: number) => s.get(80 + (cx - view.originX) * 16 + 2, 9 + (cy - view.originY) * 16 + 1) === C.WHITE!;

    drawMainScreen(s, state, view);
    expect(shieldAt(city.x, city.y)).toBe(false);

    const guard = createUnit(state, "militia", 0, city.x, city.y);
    drawMainScreen(s, state, view);
    expect(shieldAt(city.x, city.y)).toBe(true);
    mkdirSync(new URL("./out/", import.meta.url), { recursive: true });
    writeFileSync(new URL("./out/city-garrison.png", import.meta.url), encodePng(s, 3));

    // A foreign city: a shield while we see it, none once it is out of sight.
    city.owner = 1;
    guard.owner = 1;
    state.players[0]!.visible[city.y * state.map.width + city.x] = 1;
    drawMainScreen(s, state, view);
    expect(shieldAt(city.x, city.y)).toBe(true);
    state.players[0]!.visible[city.y * state.map.width + city.x] = 0;
    drawMainScreen(s, state, view);
    expect(shieldAt(city.x, city.y)).toBe(false);
  });
});

describe("fog of war", () => {
  it("draws clouds over unexplored squares, drifting into explored ones, and shows nothing of what lies beneath", () => {
    const state = newGame(7);
    const u = state.units[0]!;
    // Explore a little more, along the coast, so the fog edge crosses land and sea.
    const me = state.players[0]!;
    const was = me.explored.slice();
    revealAround(state, 0, u.x + 2, u.y + 1, 2);
    const view: MainScreenView = { originX: u.x - 7, originY: Math.max(0, u.y - 6), blink: false };
    const s = Surface.screen();
    mkdirSync(new URL("./out/", import.meta.url), { recursive: true });

    // Halfway through lifting off the squares just found, the fog over them is dissolving.
    const found = [...me.explored.keys()].filter((i) => me.explored[i] && !was[i]);
    expect(found.length).toBeGreaterThan(0);
    drawMainScreen(s, state, { ...view, lifting: new Map(found.map((i) => [i, 0.5])) });
    writeFileSync(new URL("./out/fog-lifting.png", import.meta.url), encodePng(s, 3));
    const i0 = found.find((i) => [-1, 0, 1].every((d) => me.explored[i + d]))!;
    const sq = { x: i0 % state.map.width, y: Math.floor(i0 / state.map.width) };
    let fogPx = 0;
    for (let j = 4; j < 12; j++)
      for (let i = 4; i < 12; i++) {
        const c = s.data[(80 + (sq.x - view.originX) * 16 + i) + (9 + (sq.y - view.originY) * 16 + j) * 320]! - C.FOG!;
        if (c >= 0 && c < 8) fogPx++;
      }
    expect(fogPx).toBeGreaterThan(16);
    expect(fogPx).toBeLessThan(48);

    drawMainScreen(s, state, view);
    writeFileSync(new URL("./out/fog.png", import.meta.url), encodePng(s, 3));

    // An unexplored square is cloud through and through; an explored one keeps its middle clear.
    const fogMin = C.FOG!;
    const at = (mx: number, my: number, i: number, j: number) => s.data[(80 + (mx - view.originX) * 16 + i) + (9 + (my - view.originY) * 16 + j) * 320]!;
    const hidden = { x: u.x - 6, y: u.y };
    expect(me.explored[hidden.y * state.map.width + hidden.x]).toBe(0);
    for (let j = 0; j < 16; j++) for (let i = 0; i < 16; i++) expect(at(hidden.x, hidden.y, i, j) - fogMin, `${i},${j}`).toBeLessThan(8);
    expect(at(u.x, u.y, 8, 8) - fogMin < 0 || at(u.x, u.y, 8, 8) - fogMin >= 8).toBe(true);

    // Rewrite every unexplored square: the picture does not change.
    const before = s.data.slice();
    state.map.tiles.forEach((t, i) => {
      if (me.explored[i]) return;
      t.terrain = t.terrain === Terrain.Ocean ? Terrain.Desert : Terrain.Ocean;
      t.river = !t.river;
      t.road = true;
    });
    drawMainScreen(s, state, view);
    expect(s.data).toEqual(before);
  });
});

describe("city screen", () => {
  it("renders a city with production menu", () => {
    const state = newGame(2026);
    const u = state.units[0]!;
    applyCommand(state, { type: "found", unit: u.id });
    const city = state.cities[0]!;
    city.size = 4;
    city.shields = 7;
    city.buildings.push("temple", "granary");
    autoAssignWorkers(state, city);
    createUnit(state, "militia", 0, city.x, city.y, city.id);
    applyCommand(state, { type: "toggleTile", city: city.id, slot: city.worked[0]! });
    const s = Surface.screen();
    drawCityScreen(s, state, { city: city.id });
    mkdirSync(new URL("./out/", import.meta.url), { recursive: true });
    writeFileSync(new URL("./out/city-screen.png", import.meta.url), encodePng(s, 3));
    const opts = buildOptions(state, city);
    drawMenu(s, {
      title: `${city.name}: build what?`,
      items: opts.map((p) => (p.kind === "unit" ? unitType(p.id).name : building(p.id).name)),
      right: opts.map((p) => String(p.kind === "unit" ? unitType(p.id).cost : building(p.id).cost)),
      selected: 2,
    });
    writeFileSync(new URL("./out/city-menu.png", import.meta.url), encodePng(s, 3));
    expect(s.data.some((c) => c !== 0)).toBe(true);
  });
});

describe("advisor screens", () => {
  it("renders discovery, science and rates screens", () => {
    const state = newGame(2026);
    const p = state.players[0]!;
    p.advances.push("alphabet", "bronze_working");
    p.researching = "writing";
    p.science = 14;
    const s = Surface.screen();
    drawDiscoveryScreen(s, state, "bronze_working");
    writeFileSync(new URL("./out/discovery.png", import.meta.url), encodePng(s, 3));
    drawScienceScreen(s, state);
    writeFileSync(new URL("./out/science.png", import.meta.url), encodePng(s, 3));
    drawRatesScreen(s, state);
    writeFileSync(new URL("./out/rates.png", import.meta.url), encodePng(s, 3));
    expect(s.data.some((c) => c !== 0)).toBe(true);
  });
});

describe("world with opponents", () => {
  it("renders enemy cities and units after AI rounds", async () => {
    const { aiTurn } = await import("@civ/ai");
    const state = newGame(11, { opponents: 2 });
    for (let r = 0; r < 25; r++) {
      let guard = 0;
      while (state.activeUnit !== null && guard++ < 50) applyCommand(state, { type: "skip", unit: state.activeUnit });
      applyCommand(state, { type: "endTurn" });
      while (state.currentPlayer !== 0) { aiTurn(state); applyCommand(state, { type: "endTurn" }); }
    }
    const enemy = state.cities.find((c) => c.owner !== 0) ?? state.cities[0]!;
    state.players[0]!.explored.fill(1);
    state.players[0]!.visible.fill(1);
    const s = Surface.screen();
    drawMainScreen(s, state, { originX: enemy.x - 7, originY: Math.max(0, enemy.y - 6), blink: true });
    writeFileSync(new URL("./out/world.png", import.meta.url), encodePng(s, 3));
    expect(state.cities.length).toBeGreaterThan(1);
  });
});

describe("title, advisors, diplomacy, end", () => {
  it("renders the phase 6 screens", async () => {
    const { aiTurn } = await import("@civ/ai");
    const { drawTitleScreen, drawDomesticAdvisor, drawForeignAdvisor, drawDiplomacyScreen, drawEndScreen, drawScoreScreen, leaderLine } = await import("../src/index.js");
    const state = newGame(11, { opponents: 2 });
    applyCommand(state, { type: "found", unit: state.units[0]!.id });
    for (let r = 0; r < 15; r++) {
      let guard = 0;
      while (state.activeUnit !== null && guard++ < 50) applyCommand(state, { type: "skip", unit: state.activeUnit });
      applyCommand(state, { type: "endTurn" });
      while (state.currentPlayer !== 0) { aiTurn(state); applyCommand(state, { type: "endTurn" }); }
    }
    state.relations["0:1"] = "peace";
    state.relations["0:2"] = "war";
    const s = Surface.screen();
    drawTitleScreen(s, true);
    writeFileSync(new URL("./out/title.png", import.meta.url), encodePng(s, 3));
    drawDomesticAdvisor(s, state);
    writeFileSync(new URL("./out/advisor-domestic.png", import.meta.url), encodePng(s, 3));
    drawForeignAdvisor(s, state);
    writeFileSync(new URL("./out/advisor-foreign.png", import.meta.url), encodePng(s, 3));
    drawScoreScreen(s, state);
    writeFileSync(new URL("./out/score.png", import.meta.url), encodePng(s, 3));
    drawDiplomacyScreen(s, state, 1, leaderLine(state, 1));
    writeFileSync(new URL("./out/diplomacy.png", import.meta.url), encodePng(s, 3));
    drawEndScreen(s, ["You have conquered the world!", "", "Total score: 123"], "Great");
    writeFileSync(new URL("./out/end.png", import.meta.url), encodePng(s, 3));
    expect(s.data.some((c) => c !== 0)).toBe(true);
  });
});
