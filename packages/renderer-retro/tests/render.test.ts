import { mkdirSync, writeFileSync } from "node:fs";
import { DIMMED } from "../src/palette.js";
import { describe, expect, it } from "vitest";
import { ADVANCES, applyCommand, autoAssignWorkers, buildOptions, building, createUnit, getTile, newGame, productionCost, productionName, recomputeVisibility, revealAround, slotInLand, Terrain, unitType } from "@civ/core";
import { borderSides, C, MOOD_PENNANT_W, planMove, type MovePlan, CITY_MAP_X, CITY_MAP_Y, cityButtonAt, fogSquare, SPRITE_CLEAR, citySlotAt, cityUnitAt, cityUnitSlot, cityCitizenAt, cityExitHit, cityFocusAt, storeLayout, darker, isStone, ownerAt, territory, drawCityScreen, drawMainScreen, drawResearch, openResearch, RESEARCH_LIST_ROWS, researchHit, researchRows, statusPanelAt, type ResearchHit, drawMenu, drawUnit, menuRect, playerColor, terrainInfo, drawRatesScreen, drawScienceScreen, drawText, drawTextInput, menuHit, PALETTE, shade, Surface, textPlateWidth, textWidth, type MainScreenView } from "../src/index.js";
import { encodePng } from "./png.js";
import { civCard, settlerSites, standing, TERRAIN_TEXT } from "@civ/renderer-api";
import { cardPicture, diplomacyChoiceAt, drawDiplomacyScreen, ratesAt, ratesHit, ratesRect } from "../src/index.js";
import { drawSquarePicture, squarePainter } from "../src/index.js";
import { DETAIL, FINE, isWater, terrainSquare, unzoomPoint, viewAcross, VIEW_H, VIEW_W, VIEW_X, VIEW_Y, zoomedTiles } from "../src/index.js";

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

  it("puts an X in the title strip of a window that only closes", () => {
    const s = Surface.screen();
    s.fill(0);
    const win = { title: "Grassland (12, 30)", body: ["{food} 2  {shield} 0  {trade} 0"], items: [], selected: -1, close: true };
    drawMenu(s, win);
    const r = menuRect(win);
    // The X's two strokes cross in the middle of a small box at the strip's right end.
    const bx = r.x + r.w - 3 - 9;
    expect(s.get(bx + 2, r.y + 3 + 2)).toBe(C.BLACK);
    expect(s.get(bx + 6, r.y + 3 + 2)).toBe(C.BLACK);
    expect(menuHit(win, bx + 4, r.y + 7)).toBe(-1); // a click there picks nothing: the window closes
    mkdirSync(new URL("./out/", import.meta.url), { recursive: true });
    writeFileSync(new URL("./out/modal-close.png", import.meta.url), encodePng(s, 3));
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
    expect([s.width, s.height]).toEqual([320, 200]);
    expect(s.data.length).toBe(320 * 200 * DETAIL * DETAIL);
    mkdirSync(new URL("./out/", import.meta.url), { recursive: true });
    writeFileSync(new URL("./out/main-screen.png", import.meta.url), encodePng(s, 3));

    // Zoomed in twice (the mobile app's pinch): the viewport shows its top-left quarter, each fine
    // pixel as four; the menu bar stays as it was, and a point on the zoomed map finds its square.
    const z = Surface.screen();
    drawMainScreen(z, state, { ...view, zoom: 2 });
    let off = 0;
    for (let y = 0; y < VIEW_H * DETAIL; y++)
      for (let x = 0; x < VIEW_W * DETAIL; x++)
        if (z.fget(VIEW_X * DETAIL + x, VIEW_Y * DETAIL + y) !== s.fget(VIEW_X * DETAIL + (x >> 1), VIEW_Y * DETAIL + (y >> 1))) off++;
    expect(off).toBe(0);
    expect(z.data.subarray(0, VIEW_Y * DETAIL * z.fw)).toEqual(s.data.subarray(0, VIEW_Y * DETAIL * s.fw));
    expect(unzoomPoint({ ...view, zoom: 2 }, VIEW_X + 33, VIEW_Y + 21)).toEqual([VIEW_X + 16, VIEW_Y + 10]);
    expect(unzoomPoint(view, VIEW_X + 33, VIEW_Y + 21)).toEqual([VIEW_X + 33, VIEW_Y + 21]);
    expect(zoomedTiles(1)).toEqual({ x: 15, y: 12 });
    expect(zoomedTiles(2)).toEqual({ x: 8, y: 6 });
    writeFileSync(new URL("./out/main-screen-zoom.png", import.meta.url), encodePng(z, 3));

    // Drawn wider (the mobile app on a phone held sideways): the squares the original shows are as
    // they were, more squares follow on the right, the menu bar runs across it all, and the
    // minimap's box (all that differs in the panel) frames what shows.
    const wide = new Surface(400, 200, undefined, DETAIL);
    drawMainScreen(wide, state, view);
    let changed = 0;
    for (let y = VIEW_Y * DETAIL; y < 200 * DETAIL; y++)
      for (let x = VIEW_X * DETAIL; x < 320 * DETAIL; x++) if (wide.fget(x, y) !== s.fget(x, y)) changed++;
    expect(changed).toBe(0);
    expect(wide.get(399, 2)).toBe(s.get(319, 2)); // the bar's stone at the far end
    expect(viewAcross(400)).toBe(20);
    let mapBeyond = 0;
    for (let x = 320; x < 400; x++) if (wide.get(x, 100) !== C.BLACK) mapBeyond++;
    expect(mapBeyond).toBeGreaterThan(0);
    writeFileSync(new URL("./out/main-screen-wide.png", import.meta.url), encodePng(wide, 3));

    // A long message wraps inside the panel and never crosses into the map.
    view.message = "Trade route Rome-Capua: +45 gold and science, a long message that must wrap";
    state.relations["0:1"] = "war";
    state.relations["0:2"] = "war";
    drawMainScreen(s, state, view);
    for (let y = 0; y < s.fh; y++) for (let x = 79 * s.k; x < 80 * s.k; x++) expect(s.fget(x, y), `panel edge at fine row ${y}`).not.toBe(14);
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
    // The working settler's badge: a black square in its top right corner with the irrigation's blue canal inside.
    const bx = 80 + (u.x + 1 - view.originX) * 16 + 7;
    const by = 9 + (u.y - view.originY) * 16;
    let black = 0;
    let blue = 0;
    for (let y = by; y < by + 9; y++) for (let x = bx; x < bx + 9; x++) { const c = s.get(x, y); if (c === C.BLACK!) black++; if ((c >= C.ICE! && c < C.ICE! + 8) || (c >= C.OCEAN! && c < C.OCEAN! + 8)) blue++; }
    expect(black).toBeGreaterThan(20);
    expect(blue).toBeGreaterThan(4);
    // The terrain window speaks in the same pictures.
    const info = terrainInfo(state, worker.x, worker.y);
    // Headed by the square itself, as the map draws it, twice its size in a dark frame.
    const window = { title: info.title, body: info.lines, items: [], selected: -1, close: true, square: { x: worker.x, y: worker.y } };
    drawMenu(s, window, squarePainter(window, state));
    writeFileSync(new URL("./out/terrain-window.png", import.meta.url), encodePng(s, 3));
    expect(info.lines[1]).toBe(TERRAIN_TEXT[getTile(state.map, worker.x, worker.y)!.terrain]);
    const r = menuRect(window);
    const pic = Surface.fine(32, 32);
    drawSquarePicture(pic, state, worker.x, worker.y, 0, 0);
    // The picture's middle in the window is the picture's middle.
    expect(s.fget((r.x + 12 + 16) * s.k, (r.y + 18 + 2 + 16) * s.k)).toBe(pic.fget(16 * pic.k, 16 * pic.k));
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
    expect(titles.filter((t) => t >= 0)).toEqual([0, 1, 2, 3, 4, 5]); // Game, Orders, Advisors, Diplomacy, World, Debug
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

describe("refused moves and research", () => {
  it("puts a note above a unit that was refused, and shows the research under way in the panel", () => {
    const state = newGame(2026);
    const u = state.units[0]!;
    revealAround(state, 0, u.x, u.y, 9);
    applyCommand(state, { type: "found", unit: u.id });
    const p = state.players[0]!;
    p.researching = "pottery";
    p.science = 6;
    const guard = createUnit(state, "militia", 0, u.x + 1, u.y + 1);
    recomputeVisibility(state, 0);
    state.activeUnit = guard.id;
    const view: MainScreenView = { originX: u.x - 7, originY: Math.max(0, u.y - 6), blink: true };
    const s = Surface.screen();
    drawMainScreen(s, state, view);
    const before = s.data.slice();
    // Beakers toward Pottery: a light cyan bar in the status column.
    let beakers = 0;
    for (let y = 9; y < 200; y++) for (let x = 0; x < 80; x++) if (s.get(x, y) === C.LCYAN!) beakers++;
    expect(beakers).toBeGreaterThan(0);
    // With nothing under study the row is left out altogether: no bar, no bulb, no words.
    p.researching = null;
    const empty = Surface.screen();
    drawMainScreen(empty, state, view);
    const inPanel = (sf: Surface, color: number) => { let n = 0; for (let y = 9; y < 200; y++) for (let x = 0; x < 80; x++) if (sf.get(x, y) === color) n++; return n; };
    expect(inPanel(empty, C.YELLOW!)).toBeLessThan(inPanel(s, C.YELLOW!)); // the bulb
    expect(beakers - inPanel(empty, C.LCYAN!)).toBeGreaterThan(0); // the bar (the gem shares its cyan)
    p.researching = "pottery";

    drawMainScreen(s, state, { ...view, callout: { x: guard.x, y: guard.y, text: "Militia cannot cross the ocean. A ship with room must carry it." } });
    mkdirSync(new URL("./out/", import.meta.url), { recursive: true });
    writeFileSync(new URL("./out/callout.png", import.meta.url), encodePng(s, 3));
    // The note covers part of the map above the unit's square, and nothing else.
    const top = 9 + (guard.y - view.originY) * 16;
    let changed = 0;
    for (let i = 0; i < s.data.length; i++) {
      if (s.data[i] === before[i]) continue;
      changed++;
      expect(i % s.fw).toBeGreaterThanOrEqual(80 * s.k);
      expect(Math.floor(i / s.fw)).toBeLessThan(top * s.k);
    }
    expect(changed).toBeGreaterThan(500 * s.k * s.k);
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
    // The shield, in the owner's colour, sits in the city square's top-left corner.
    const shieldAt = (cx: number, cy: number) => s.get(80 + (cx - view.originX) * 16 + 2, 9 + (cy - view.originY) * 16 + 1) === playerColor(state, city.owner);

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
  it("draws unexplored squares black, drifting into explored ones beside them, and shows nothing of what lies beneath", () => {
    const state = newGame(7);
    const u = state.units[0]!;
    // Explore a little more, along the coast, so the fog edge crosses land and sea.
    const me = state.players[0]!;
    const was = me.explored.slice();
    revealAround(state, 0, u.x + 2, u.y + 1, 2);
    const view: MainScreenView = { originX: u.x - 7, originY: Math.max(0, u.y - 6), blink: false };
    const s = Surface.screen();
    mkdirSync(new URL("./out/", import.meta.url), { recursive: true });
    const { width } = state.map;

    // Halfway through lifting off the squares just found, the black over them is dissolving.
    const found = [...me.explored.keys()].filter((i) => me.explored[i] && !was[i]);
    expect(found.length).toBeGreaterThan(0);
    const i0 = found.find((i) => [-1, 0, 1].every((d) => me.explored[i + d]))!;
    const sq = { x: i0 % width, y: Math.floor(i0 / width) };
    const lifted = fogSquare(state.map, me.explored, sq.x, sq.y, new Map(found.map((i) => [i, 0.5])))!;
    let half = 0;
    for (let j = 4; j < 12; j++) for (let i = 4; i < 12; i++) if (lifted.data[j * 16 + i] === C.BLACK!) half++;
    expect(half).toBeGreaterThan(16);
    expect(half).toBeLessThan(48);
    drawMainScreen(s, state, { ...view, lifting: new Map(found.map((i) => [i, 0.5])) });
    writeFileSync(new URL("./out/fog-lifting.png", import.meta.url), encodePng(s, 3));

    drawMainScreen(s, state, view);
    writeFileSync(new URL("./out/fog.png", import.meta.url), encodePng(s, 3));

    // The fog is black, never a shade of grey: an unexplored square is black through and through,
    // and on an explored square beside one it drifts in black, its middle left clear.
    // (i, j): a fine pixel of square (mx, my), 0 to FINE - 1.
    const at = (mx: number, my: number, i: number, j: number) => s.fget((80 + (mx - view.originX) * 16) * s.k + i, (9 + (my - view.originY) * 16) * s.k + j);
    const hidden = { x: u.x - 6, y: u.y };
    expect(me.explored[hidden.y * width + hidden.x]).toBe(0);
    for (let j = 0; j < FINE; j++) for (let i = 0; i < FINE; i++) expect(at(hidden.x, hidden.y, i, j), `${i},${j}`).toBe(C.BLACK!);
    const edge = [...me.explored.keys()].find((i) => me.explored[i] && [-1, 1, -width, width].some((d) => !me.explored[i + d]))!;
    const drift = fogSquare(state.map, me.explored, edge % width, Math.floor(edge / width))!;
    expect(drift).not.toBeNull();
    expect(drift.data.some((c) => c === C.BLACK!)).toBe(true);
    expect(drift.data.every((c) => c === C.BLACK! || c === SPRITE_CLEAR)).toBe(true);
    expect(drift.data[8 * 16 + 8]).toBe(SPRITE_CLEAR);

    // Rewrite every unexplored square: the picture does not change.
    const before = s.data.slice();
    state.map.tiles.forEach((t, i) => {
      if (me.explored[i]) return;
      t.terrain = t.terrain === Terrain.Ocean ? Terrain.Desert : Terrain.Ocean;
      t.river = !t.river;
      t.road = true;
      t.railroad = true;
      t.irrigation = true;
    });
    drawMainScreen(s, state, view);
    expect(s.data).toEqual(before);
  });
});

describe("land borders", () => {
  it("lets other ground reach over a border in ragged specks, under whatever stands on the square", () => {
    const { map } = newGame(7);
    const X = 20;
    const Y = 20;
    const set = (x: number, y: number, t: Terrain) => { const tile = map.tiles[y * map.width + x]!; tile.terrain = t; tile.river = false; };
    for (let y = Y - 2; y <= Y + 2; y++) for (let x = X - 2; x <= X + 2; x++) set(x, y, Terrain.Grassland);
    const sandy = (c: number) => c >= C.DUNE! && c < C.DUNE! + 8;
    // Grass among grass is drawn as its sprite; desert to the east reaches in from that side only.
    const plain = terrainSquare(map, X, Y);
    set(X + 1, Y, Terrain.Desert);
    const grass = terrainSquare(map, X, Y);
    let east = 0;
    for (let j = 0; j < FINE; j++)
      for (let i = 0; i < FINE; i++) {
        const at = j * FINE + i;
        if (i < FINE * 0.6) expect(grass.data[at]).toBe(plain.data[at]);
        else if (sandy(grass.data[at]!)) east++;
      }
    expect(east).toBeGreaterThan(0);
    // Mountains ringed by desert: the sand reaches in, every peak stays whole.
    set(X + 1, Y, Terrain.Grassland);
    set(X, Y, Terrain.Mountains);
    const alone = terrainSquare(map, X, Y);
    for (let y = Y - 1; y <= Y + 1; y++) for (let x = X - 1; x <= X + 1; x++) if (x !== X || y !== Y) set(x, y, Terrain.Desert);
    const ringed = terrainSquare(map, X, Y);
    const rock = (c: number) => c >= C.ROCK! && c < C.ROCK! + 8;
    let peaks = 0;
    for (let at = 0; at < FINE * FINE; at++) {
      if (!rock(alone.data[at]!)) continue;
      peaks++;
      expect(ringed.data[at]).toBe(alone.data[at]);
    }
    expect(peaks).toBeGreaterThan(100);
    expect([...ringed.data].some(sandy)).toBe(true);
  });
});

describe("settler sites", () => {
  it("dot the edge of the best squares near settlers in play to found a city on, the best in gold", () => {
    const state = newGame(2026);
    const u = state.units.find((x) => x.id === state.activeUnit)!;
    revealAround(state, 0, u.x, u.y, 7);
    const view: MainScreenView = { originX: u.x - 7, originY: Math.max(0, u.y - 6), blink: true };
    const s = Surface.screen();
    drawMainScreen(s, state, view);
    mkdirSync(new URL("./out/", import.meta.url), { recursive: true });
    writeFileSync(new URL("./out/settler-sites.png", import.meta.url), encodePng(s, 3));
    const sites = settlerSites(state, u.id).filter((site) => site.x !== u.x || site.y !== u.y);
    expect(sites.length).toBeGreaterThan(0);
    // A dot on the top edge (fine pixels 3..4, 2..3 of the square), clear of the middle of the square.
    const dot = (t: Surface, x: number, y: number) => t.fget((VIEW_X + (x - view.originX) * 16) * t.k + 3, (VIEW_Y + (y - view.originY) * 16) * t.k + 2);
    const middle = (t: Surface, x: number, y: number) => t.fget((VIEW_X + (x - view.originX) * 16) * t.k + 16, (VIEW_Y + (y - view.originY) * 16) * t.k + 16);
    const bare = Surface.screen();
    const plain = { ...view };
    // The same squares drawn with no settlers in play: only the dots differ, never the middle.
    const militia = createUnit(state, "militia", 0, u.x, u.y);
    for (const site of sites) expect(dot(s, site.x, site.y)).toBe(site.best ? shade("wheat", 7) : shade("panel", 7));
    state.units = state.units.filter((x) => x.owner !== 0 || x.type !== "settlers");
    state.activeUnit = militia.id;
    drawMainScreen(bare, state, plain);
    for (const site of sites) {
      expect(dot(bare, site.x, site.y)).not.toBe(dot(s, site.x, site.y));
      expect(middle(bare, site.x, site.y)).toBe(middle(s, site.x, site.y));
    }
  });
});

describe("terrain works", () => {
  // A valley laid out by hand: sea to the west, farmland along a river, a road
  // winding east with a railway on its last stretch, mines in the hills.
  const LAND: Record<string, Terrain> = { "~": Terrain.Ocean, g: Terrain.Grassland, p: Terrain.Plains, h: Terrain.Hills, m: Terrain.Mountains, d: Terrain.Desert, f: Terrain.Forest };
  const TERRAIN = [
    "~~~~ggggpphhmm",
    "~~~gggpppfphmm",
    "~~ggggpppdddhm",
    "~gggggpppdddhh",
    "~ggggppppdddhh",
    "~~gggpppppddmm",
    "~~~ggggpppphmm",
    "~~~~gggppphhhm",
    "~~~~~ggggpphhm",
    "~~~~~~ggpppphh",
  ];
  // i irrigation, r road, b both, R railroad, M mine, X mine and railroad, o a lone road.
  const WORKS = [
    "..........M.M.",
    "...ii..r..rX..",
    "..iiiir.r.i.r.",
    ".bbbrb..rM....",
    "..iiii...RRRRR",
    "...iii.bbi..M.",
    "......iiii.X..",
    "........i.....",
    "......o....M..",
    "..............",
  ];
  const RIVER: [number, number][] = [[12, 2], [12, 3], [11, 3], [10, 3], [10, 4], [9, 4], [9, 5], [8, 5], [8, 6], [7, 6], [7, 7], [6, 7], [5, 7], [4, 7]];

  function valley() {
    const state = newGame(2026);
    const me = state.players[0]!;
    const x0 = 20;
    const y0 = 20;
    state.units.length = 0;
    state.activeUnit = null;
    for (let j = 0; j < TERRAIN.length; j++)
      for (let i = 0; i < TERRAIN[j]!.length; i++) {
        const t = getTile(state.map, x0 + i, y0 + j)!;
        const w = WORKS[j]![i]!;
        Object.assign(t, { terrain: LAND[TERRAIN[j]![i]!]!, river: false, special: false, hut: false, fortress: false, pollution: false });
        t.irrigation = "ib".includes(w);
        t.road = "rbRXo".includes(w);
        t.railroad = "RX".includes(w);
        t.mine = "MX".includes(w);
      }
    for (const [i, j] of RIVER) getTile(state.map, x0 + i, y0 + j)!.river = true;
    for (let j = -1; j <= TERRAIN.length; j++)
      for (let i = -1; i <= TERRAIN[0]!.length; i++) {
        const idx = (y0 + j) * state.map.width + x0 + i;
        me.explored[idx] = 1;
        me.visible[idx] = 1;
      }
    return { state, x0, y0 };
  }

  it("draws roads, railroads, fields and mines, joined across squares", () => {
    const { state, x0, y0 } = valley();
    const view: MainScreenView = { originX: x0 - 1, originY: y0 - 1, blink: true };
    const s = Surface.screen();
    drawMainScreen(s, state, view);
    // (i, j): a screen pixel of square (mx, my), 0 to 15, for the works drawn in screen pixels;
    // `fine` reads a fine pixel of the terrain beneath, 0 to FINE - 1.
    const at = (mx: number, my: number, i: number, j: number) => s.get(80 + (mx - view.originX) * 16 + i, 9 + (my - view.originY) * 16 + j);
    const fine = (mx: number, my: number, i: number, j: number) => s.fget((80 + (mx - view.originX) * 16) * s.k + i, (9 + (my - view.originY) * 16) * s.k + j);
    const earth = (c: number) => c >= C.EARTH! && c < C.EARTH! + 8;
    const water = isWater;
    const crop = Surface.fine((TERRAIN[0]!.length + 1) * 16, (TERRAIN.length + 1) * 16);
    for (let y = 0; y < crop.fh; y++) for (let x = 0; x < crop.fw; x++) crop.fset(x, y, s.fget(80 * s.k + x, 9 * s.k + y));
    mkdirSync(new URL("./out/", import.meta.url), { recursive: true });
    writeFileSync(new URL("./out/works.png", import.meta.url), encodePng(crop, 4));

    // A road wanders across its square, and its packed earth meets the next square's at the border.
    const surface = (c: number) => c === shade("earth", 6) || c === shade("earth", 5);
    const rows = (mx: number, i: number) => [...Array(16).keys()].filter((j) => surface(at(mx, y0 + 3, i, j)));
    const leaving = rows(x0 + 2, 15);
    expect(leaving.length).toBeGreaterThan(0);
    expect(leaving.some((j) => rows(x0 + 3, 0).some((k) => Math.abs(j - k) <= 1))).toBe(true);
    expect(new Set([0, 4, 8, 12, 15].map((i) => rows(x0 + 2, i).join())).size).toBeGreaterThan(1);
    // The diagonal from (6,2) to (7,1) passes the corner of (6,1) and (7,2), roadless, which draw their part of it.
    let corner = 0;
    for (let j = 0; j < 16; j++) for (let i = 0; i < 16; i++) if (earth(at(x0 + 6, y0 + 1, i, j)) || earth(at(x0 + 7, y0 + 2, i, j))) corner++;
    expect(corner).toBeGreaterThan(0);
    // Where the road crosses the river it is a bridge: timber planks over the water, none on dry road squares.
    const planks = (mx: number, my: number) => {
      let n = 0;
      for (let j = 0; j < 32; j++) for (let i = 0; i < 32; i++) if (fine(mx, my, i, j) === shade("earth", 4)) n++;
      return n;
    };
    expect(getTile(state.map, x0 + 9, y0 + 4)!.river).toBe(true);
    expect(planks(x0 + 9, y0 + 4)).toBeGreaterThan(0);
    expect(planks(x0 + 2, y0 + 3)).toBe(0);
    // Fields: a canal runs through the middle and on into the irrigated neighbour; a strip of terrain shows toward the rest.
    expect(water(at(x0 + 3, y0 + 4, 15, 7)) && water(at(x0 + 4, y0 + 4, 0, 7))).toBe(true);
    const ground = (c: number) => c >= C.MEADOW! && c < C.MEADOW! + 8;
    expect(ground(at(x0 + 4, y0 + 1, 8, 0))).toBe(true);
    // The river keeps its water through the fields it waters.
    const riverSquare = { x: x0 + 9, y: y0 + 5 };
    let riverPx = 0;
    // The canal runs along screen row 7, fine rows 14 and 15; leave out that row and column.
    const canal = (n: number) => Math.floor(n / DETAIL) === 7;
    for (let j = 0; j < FINE; j++) for (let i = 0; i < FINE; i++) if (water(fine(riverSquare.x, riverSquare.y, i, j)) && !canal(i) && !canal(j)) riverPx++;
    expect(riverPx).toBeGreaterThan(8 * DETAIL * DETAIL);
    // A mine is a rock mound with a dark shaft framed in timber.
    expect(at(x0 + 10, y0, 7, 13)).toBe(shade("steel", 0));
    expect(at(x0 + 10, y0, 4, 13)).toBe(shade("rock", 4));

  });
});

describe("city screen", () => {
  it("shades the squares beyond a new city's border and rings its land", () => {
    const state = newGame(2026);
    const u = state.units[0]!;
    applyCommand(state, { type: "found", unit: u.id });
    const city = state.cities[0]!;
    city.buildings = [];
    city.size = 2;
    autoAssignWorkers(state, city);
    const s = Surface.screen();
    drawCityScreen(s, state, { city: city.id });
    writeFileSync(new URL("./out/city-border.png", import.meta.url), encodePng(s, 3));
    // The map shows the city at its middle: the squares two out are shaded (every other pixel black), those next to it are not.
    const mapX = CITY_MAP_X + 2 * 16;
    const mapY = CITY_MAP_Y + 2 * 16;
    const black = (sx: number, sy: number) => { let n = 0; for (let j = 0; j < 16; j++) for (let i = 0; i < 16; i++) if (s.get(sx + i, sy + j) === C.BLACK) n++; return n; };
    expect(black(mapX + 32, mapY)).toBeGreaterThanOrEqual(128); // two east: beyond the border
    for (const w of city.worked) expect(slotInLand(state, city, w)).toBe(true);
    // The city on the main map carries its name under it.
    const view: MainScreenView = { originX: city.x - 7, originY: Math.max(0, city.y - 6), blink: true };
    drawMainScreen(s, state, view);
    writeFileSync(new URL("./out/main-screen-city.png", import.meta.url), encodePng(s, 3));
  });

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
      items: opts.map(productionName),
      right: opts.map((p) => String(productionCost(p))),
      selected: 2,
    });
    writeFileSync(new URL("./out/city-menu.png", import.meta.url), encodePng(s, 3));
    expect(s.data.some((c) => c !== 0)).toBe(true);
  });

  it("finds each citizen in the row under a click, lights the one pointed at, and lines off what a Granary keeps", () => {
    const state = newGame(2026);
    applyCommand(state, { type: "found", unit: state.units[0]!.id });
    const city = state.cities[0]!;
    city.size = 6;
    city.food = 20;
    autoAssignWorkers(state, city);
    applyCommand(state, { type: "toggleTile", city: city.id, slot: city.worked[0]! });
    applyCommand(state, { type: "setSpecialist", city: city.id, index: 0, specialist: "taxman" });
    const view = { city: city.id };
    // Along the row, every person once and in order; nothing past them or below the top window.
    const seen: number[] = [];
    const first = new Map<number, number>();
    for (let x = 0; x < 320; x++) {
      const i = cityCitizenAt(state, view, x, 22);
      if (i === null) continue;
      if (seen[seen.length - 1] !== i) seen.push(i);
      if (!first.has(i)) first.set(i, x);
    }
    expect(seen).toEqual([0, 1, 2, 3, 4, 5]);
    expect(cityCitizenAt(state, view, 300, 22)).toBeNull();
    expect(cityCitizenAt(state, view, first.get(0)! + 2, 60)).toBeNull();
    // The taxman pointed at stands on a lit patch.
    const lit = (hover?: number) => {
      const s = Surface.screen();
      drawCityScreen(s, state, { city: city.id, hover });
      let n = 0;
      for (let y = 14; y < 28; y++) for (let x = first.get(5)!; x < first.get(5)! + 9; x++) if (s.get(x, y) === shade("panel", 7)) n++;
      return n;
    };
    expect(lit(5)).toBeGreaterThan(lit() + 20);
    // The slots a Granary keeps full when the city grows are edged in gold in the food box.
    const gold = () => {
      const s = Surface.screen();
      drawCityScreen(s, state, view);
      let n = 0;
      for (let y = 116; y < 200; y++) for (let x = 1; x < 107; x++) if (s.get(x, y) === shade("wheat", 1)) n++;
      return { s, n };
    };
    expect(gold().n).toBe(0);
    city.buildings.push("granary");
    const { s, n } = gold();
    expect(n).toBeGreaterThan(40);
    writeFileSync(new URL("./out/city-granary.png", import.meta.url), encodePng(s, 3));
  });

  it("lays a store's slots out ten to a row in the middle of its region, a slot standing for more than one only when the box is big", () => {
    const region = { x: 5, y: 120, w: 98, h: 60 };
    const gridW = 10 * 9 - 1;
    for (const box of [10, 20, 30, 50, 60, 80, 100, 150, 210, 400, 600]) {
      const { per, slots, rows, x, y } = storeLayout(region, box);
      expect(slots * per).toBeGreaterThanOrEqual(box);
      expect(rows * 10).toBeGreaterThanOrEqual(slots);
      expect(rows * 9 - 1).toBeLessThanOrEqual(region.h);
      // The same room either side, and above as below (a pixel over when the room is odd).
      expect(Math.abs((x - region.x) - (region.x + region.w - (x + gridW)))).toBeLessThanOrEqual(1);
      expect(Math.abs((y - region.y) - (region.y + region.h - (y + rows * 9 - 1)))).toBeLessThanOrEqual(1);
    }
    expect(storeLayout(region, 50).per).toBe(1);
    expect(storeLayout(region, 60).per).toBe(1); // six rows of ten fit
    expect(storeLayout(region, 100).per).toBe(2);
  });

  it("draws Change and Buy buttons in the production box and hit-tests them", () => {
    const state = newGame(2026);
    applyCommand(state, { type: "found", unit: state.units[0]!.id });
    const city = state.cities[0]!;
    state.players[0]!.gold = 500;
    const s = Surface.screen();
    drawCityScreen(s, state, { city: city.id });
    writeFileSync(new URL("./out/city-buttons.png", import.meta.url), encodePng(s, 3));
    const hits = new Map<string, { x0: number; x1: number; y0: number; y1: number }>();
    for (let y = 0; y < 200; y++)
      for (let x = 0; x < 320; x++) {
        const b = cityButtonAt(x, y);
        if (!b) continue;
        const r = hits.get(b) ?? { x0: x, x1: x, y0: y, y1: y };
        hits.set(b, { x0: Math.min(r.x0, x), x1: Math.max(r.x1, x), y0: Math.min(r.y0, y), y1: Math.max(r.y1, y) });
      }
    const change = hits.get("change")!;
    const buy = hits.get("buy")!;
    expect(change.x1).toBeLessThan(buy.x0);
    expect(change.y0).toBe(buy.y0);
    // Each button is drawn where it is hit: its top-left corner is the light bevel, not the panel behind.
    for (const r of [change, buy]) expect(s.get(r.x0, r.y0)).not.toBe(s.get(r.x0 - 1, r.y0 - 1));
    // Neither covers the resource map or the exit bar.
    expect(citySlotAt(change.x0, change.y0)).toBeNull();
    expect(buy.y1).toBeLessThan(188);
  });

  it("marks what each supported unit costs: nothing for the free ones, a shield beyond, food for settlers", () => {
    const state = newGame(2026);
    applyCommand(state, { type: "found", unit: state.units[0]!.id });
    const city = state.cities[0]!;
    for (const t of ["militia", "militia", "settlers", "phalanx", "militia", "militia"]) createUnit(state, t, 0, city.x, city.y, city.id);
    const s = Surface.screen();
    drawCityScreen(s, state, { city: city.id });
    writeFileSync(new URL("./out/city-upkeep.png", import.meta.url), encodePng(s, 3));
    // Under each unit's sprite: a size-1 city under Despotism keeps its first unit free.
    const under = (i: number) => {
      const { x, y } = cityUnitSlot(i);
      let painted = 0;
      for (let dy = 0; dy < 8; dy++) for (let dx = 0; dx < 16; dx++) if (!isStone(s.get(x + dx, y + 17 + dy))) painted++;
      return painted;
    };
    expect(under(0)).toBe(0);
    expect(under(1)).toBeGreaterThan(0);
    // Settlers cost food, not a shield (since version 24): the wheat under them, no shield's blue.
    const colours = (i: number) => {
      const { x, y } = cityUnitSlot(i);
      const set = new Set<number>();
      for (let dy = 0; dy < 8; dy++) for (let dx = 0; dx < 16; dx++) if (!isStone(s.get(x + dx, y + 17 + dy))) set.add(s.get(x + dx, y + 17 + dy));
      return set;
    };
    expect(under(2)).toBeGreaterThan(0);
    expect(colours(1).has(shade("sea", 7))).toBe(true);
    expect(colours(2).has(shade("sea", 7))).toBe(false);
  });

  it("shows the units in the city, then those away faded, and picks a unit by its sprite or cost", () => {
    const state = newGame(2026);
    applyCommand(state, { type: "found", unit: state.units[0]!.id });
    const city = state.cities[0]!;
    state.units = state.units.filter((u) => u.owner !== 0);
    const away = createUnit(state, "militia", 0, city.x, city.y + 2, city.id);
    const here = createUnit(state, "militia", 0, city.x, city.y, city.id);
    const guest = createUnit(state, "phalanx", 0, city.x, city.y, null);
    here.order = { kind: "fortified" };
    const s = Surface.screen();
    drawCityScreen(s, state, { city: city.id });
    writeFileSync(new URL("./out/city-units.png", import.meta.url), encodePng(s, 3));
    const view = { city: city.id };
    const ids = [0, 1, 2, 3].map((i) => { const { x, y } = cityUnitSlot(i); return cityUnitAt(state, view, x + 8, y + 8); });
    expect(ids).toEqual([here.id, guest.id, away.id, null]);
    // The cost under a sprite picks its unit too.
    expect(cityUnitAt(state, view, cityUnitSlot(0).x + 4, cityUnitSlot(0).y + 20)).toBe(here.id);
    expect(cityUnitAt(state, view, 4, 4)).toBeNull();
    // The militia away shows about half the pixels of the one in the city.
    const sprite = (i: number) => {
      const { x, y } = cityUnitSlot(i);
      let painted = 0;
      for (let dy = 0; dy < 16; dy++) for (let dx = 0; dx < 16; dx++) if (!isStone(s.get(x + dx, y + dy))) painted++;
      return painted;
    };
    expect(sprite(2)).toBeLessThan(sprite(0) * 0.7);
    expect(sprite(2)).toBeGreaterThan(sprite(0) * 0.3);
  });
});

describe("advisor screens", () => {
  it("renders the research panel on a discovery, hit-testing its list, card links, buttons and scrolling", () => {
    const state = newGame(2026);
    const p = state.players[0]!;
    p.advances.push("alphabet", "bronze_working", "ceremonial_burial", "code_of_laws");
    const s = Surface.screen();
    const view = openResearch(state, RESEARCH_LIST_ROWS, { discovered: ["code_of_laws"], choosing: true, closable: false });
    expect(view.selected).toBe("monarchy"); // what the find brought within reach comes first
    drawResearch(s, state, view);
    writeFileSync(new URL("./out/research.png", import.meta.url), encodePng(s, 3));
    const hits = new Map<string, ResearchHit>();
    for (let y = 0; y < 200; y++) for (let x = 0; x < 320; x++) {
      const h = researchHit(state, view, x, y);
      if (h) hits.set(h.kind === "row" || h.kind === "link" ? `${h.kind}:${h.id}` : h.kind, h);
    }
    expect(hits.has("row:monarchy")).toBe(true);
    expect(hits.has("row:writing")).toBe(true);
    expect(hits.has("row:literacy")).toBe(true); // coming later: a hint of what lies ahead
    expect(hits.has("row:the_republic")).toBe(false); // two steps beyond: not listed
    expect(hits.has("link:ceremonial_burial")).toBe(true); // Monarchy's card: what it needs...
    expect(hits.has("link:feudalism")).toBe(true); // ...and what it opens the way to
    expect(hits.has("research")).toBe(true);
    expect(hits.has("close")).toBe(false); // research is due: no way out but a pick
    expect(hits.has("scroll")).toBe(true); // the discovered ones lie further down the list
    // A card reached through a link: Literacy wants Writing first.
    view.selected = "literacy";
    drawResearch(s, state, view);
    writeFileSync(new URL("./out/research-later.png", import.meta.url), encodePng(s, 3));
    // Under way, opened from the status panel: progress across the top, a close button.
    applyCommand(state, { type: "research", advance: "writing" });
    p.science = 10;
    const browsing = openResearch(state, RESEARCH_LIST_ROWS, { choosing: true, closable: true });
    expect(browsing.selected).toBe("writing");
    drawResearch(s, state, browsing);
    writeFileSync(new URL("./out/research-under-way.png", import.meta.url), encodePng(s, 3));
    // Late in the game the list is long and scrolls.
    p.advances = ADVANCES.map((a) => a.id).filter((id) => !["fusion_power", "artificial_intelligence", "quantum_computing"].includes(id));
    p.researching = null;
    const late = openResearch(state, RESEARCH_LIST_ROWS, { choosing: false, closable: true });
    expect(researchRows(state, late).length).toBeGreaterThan(RESEARCH_LIST_ROWS);
    drawResearch(s, state, late);
    writeFileSync(new URL("./out/research-late.png", import.meta.url), encodePng(s, 3));
    const kinds = new Set<string>();
    for (let y = 0; y < 200; y++) for (let x = 0; x < 320; x++) { const h = researchHit(state, late, x, y); if (h) kinds.add(h.kind === "scroll" ? `scroll${Math.sign(h.by)}` : h.kind); }
    expect([...kinds]).toEqual(expect.arrayContaining(["scroll1", "close", "row"]));
    expect(kinds.has("research")).toBe(false);
  });

  it("opens the research panel from the status panel's research row", () => {
    const state = newGame(2026);
    applyCommand(state, { type: "found", unit: state.units.find((u) => u.type === "settlers")!.id });
    const at = (): Set<string> => {
      const found = new Set<string>();
      for (let y = 0; y < 200; y++) for (let x = 0; x < 80; x++) if (statusPanelAt(state, x, y) === "research") found.add(`${x},${y}`);
      return found;
    };
    // With nothing awaiting orders the panel's End of Turn ends the turn when clicked, below the research row.
    const idle: MainScreenView = { originX: 0, originY: 0, blink: false };
    const endAt = (v: MainScreenView) => {
      const ys: number[] = [];
      for (let y = 0; y < 200; y++) if (statusPanelAt(state, 20, y, v) === "endTurn") ys.push(y);
      return ys;
    };
    const active = state.activeUnit;
    state.activeUnit = null;
    expect(endAt(idle).length).toBeGreaterThan(8);
    state.activeUnit = active ?? state.units.find((u) => u.owner === 0)?.id ?? null;
    if (state.activeUnit !== null) expect(endAt(idle)).toEqual([]);
    state.players[0]!.researching = null;
    expect(at().size).toBe(0); // no row while nothing is under study
    applyCommand(state, { type: "research", advance: "alphabet" });
    const cells = at();
    expect(cells.size).toBeGreaterThan(0);
    // The row it answers on is where the bulb is drawn.
    const s = Surface.screen();
    const view: MainScreenView = { originX: 0, originY: 0, blink: false };
    drawMainScreen(s, state, view);
    const ys = [...cells].map((c) => Number(c.split(",")[1]));
    const top = Math.min(...ys);
    let bulb = false;
    for (let y = top; y < top + 9; y++) for (let x = 3; x < 11; x++) if (s.get(x, y) === C.YELLOW) bulb = true;
    expect(bulb).toBe(true);
  });

  it("renders the science screen, and the rates window over the game with its blocks, steps and Done", () => {
    const state = newGame(2026);
    const p = state.players[0]!;
    p.advances.push("alphabet", "bronze_working");
    p.researching = "writing";
    p.science = 14;
    const s = Surface.screen();
    drawScienceScreen(s, state);
    writeFileSync(new URL("./out/science.png", import.meta.url), encodePng(s, 3));
    // The rates window is drawn over whatever is there: the corners stay as they were.
    s.fill(7);
    drawRatesScreen(s, state);
    writeFileSync(new URL("./out/rates.png", import.meta.url), encodePng(s, 3));
    expect(s.get(2, 2)).toBe(DIMMED[7]); // the game darkened behind the window
    expect(s.get(160, 100)).not.toBe(7);
    // Along a row: the - button, ten blocks each a rate, the + button; Done at the foot; nothing outside.
    const o = ratesRect();
    const kinds = new Set<string>();
    for (let y = o.y; y < o.y + o.h; y++) for (let x = o.x; x < o.x + o.w; x++) { const h = ratesHit(x, y); if (h) kinds.add(h.kind === "step" ? `${h.row}${h.delta > 0 ? "+" : "-"}` : h.kind === "set" ? `set:${h.row}` : h.kind); }
    expect([...kinds].sort()).toEqual(["done", "lux+", "lux-", "sci+", "sci-", "set:lux", "set:sci", "set:tax", "tax+", "tax-"]);
    expect(ratesHit(2, 2)).toBeNull();
    const taxY = (() => { for (let y = o.y; y < o.y + o.h; y++) { const h = ratesAt(o.x + 100, y); if (h?.row === "tax") return y; } return -1; })();
    const values = new Set<number>();
    for (let x = o.x; x < o.x + o.w; x++) { const h = ratesAt(x, taxY); if (h) values.add(h.value); }
    expect(Math.max(...values)).toBe(10);
    expect(Math.min(...values)).toBe(0);
    // On a wider screen (the phone's map) the window stands in that screen's middle.
    expect(ratesRect(480).x).toBe(o.x + 80);
    expect(ratesHit(o.x + 80 + 100, taxY, 480)?.kind).toBe("set");
  });

  it("fades a menu row that cannot be picked and never hits it", () => {
    const s = Surface.screen();
    s.fill(0);
    const m = { title: "", items: ["Tax Rate", "Revolution!", "Save Game"], right: ["T", "G", ""], selected: 0, anchor: { x: 4, y: 9 }, disabled: [1] };
    drawMenu(s, m);
    const rowY = (i: number) => { for (let y = 0; y < 200; y++) if (menuHit({ ...m, disabled: [] }, 30, y) === i) return y; return -1; };
    expect(menuHit(m, 30, rowY(0))).toBe(0);
    expect(menuHit(m, 30, rowY(1))).toBe(-1);
    expect(menuHit(m, 30, rowY(2))).toBe(2);
    // The faded row's ink is the stone's dim grey, not black.
    let faded = 0;
    let black = 0;
    for (let x = 8; x < 60; x++) for (let y = rowY(1); y < rowY(1) + 8; y++) { const c = s.get(x, y); if (c === shade("panel", 2)) faded++; if (c === C.BLACK) black++; }
    expect(faded).toBeGreaterThan(10);
    expect(black).toBe(0);
  });

  it("lays a civilization's card out: the portrait's spot at the left, its lines beside it, the buttons under", () => {
    const state = newGame(2026, { opponents: 2 });
    const them = state.players[1]!;
    const s = Surface.screen();
    const card = civCard(state, them.id, "wary");
    expect(card.length).toBeGreaterThanOrEqual(5);
    expect(card.some((l) => l.includes("wary toward us"))).toBe(true);
    const view = { player: them.id, line: standing(state, them.id, true).text, card, choices: ["Talk", "Back"], selected: 0 };
    drawDiplomacyScreen(s, state, view);
    writeFileSync(new URL("./out/civ-card.png", import.meta.url), encodePng(s, 3));
    // The portrait's spot is a sky bed at the left; ink stands to its right.
    const p = cardPicture();
    expect(s.get(p.x + 10, p.y + 10)).toBeGreaterThanOrEqual(shade("azure", 0));
    expect(s.get(p.x + 10, p.y + 10)).toBeLessThanOrEqual(shade("azure", 7));
    let ink = 0;
    for (let y = p.y; y < p.y + 40; y++) for (let x = p.x + p.w + 10; x < 280; x++) if (s.get(x, y) === C.BLACK) ink++;
    expect(ink).toBeGreaterThan(50);
    expect(diplomacyChoiceAt(view, 80, 165)).toBe(0); // the first of two buttons, on the one row
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

    // Borders: the edge of what the cities reach, in their owners' colours.
    const before = s.data.slice();
    drawMainScreen(s, state, { originX: enemy.x - 7, originY: Math.max(0, enemy.y - 6), blink: true, borders: true });
    writeFileSync(new URL("./out/borders.png", import.meta.url), encodePng(s, 3));
    const changed = s.data.filter((c, i) => c !== before[i]);
    expect(changed.length).toBeGreaterThan(100 * s.k * s.k);
    expect(changed.some((c) => c === playerColor(state, enemy.owner))).toBe(true);

    // The minimap (one pixel a square from y 11): each city a white dot in a cross of its owner's
    // colour, darker inside a border; the border a line of the owner's colour round its land.
    const view = { originX: enemy.x - 7, originY: Math.max(0, enemy.y - 6), blink: true };
    const { width, height } = state.map;
    const mm = (x: number, y: number) => s.get(((x % width) + width) % width, 11 + y);
    const color = playerColor(state, enemy.owner);
    const terr = territory(state);
    const clear = (x: number, y: number) => !state.units.some((u) => u.x === x && u.y === y)
      && !state.cities.some((c) => Math.abs(c.x - x) + Math.abs(c.y - y) <= 1);
    let edge: [number, number] | undefined;
    for (let y = 0; y < height && !edge; y++)
      for (let x = 0; x < width && !edge; x++)
        if (ownerAt(terr, x, y) === enemy.owner && borderSides(terr, x, y).length && clear(x, y)) edge = [x, y];
    expect(edge).toBeDefined();
    const [ex, ey] = edge!;
    drawMainScreen(s, state, { ...view, borders: true });
    expect(mm(enemy.x, enemy.y)).toBe(C.WHITE!);
    expect(mm(enemy.x + 1, enemy.y)).toBe(darker(color));
    expect(mm(ex, ey)).toBe(color);
    drawMainScreen(s, state, view);
    expect(mm(enemy.x + 1, enemy.y)).toBe(color);
    expect(mm(ex, ey)).not.toBe(color);
    // Nothing of a square we have not explored, borders included.
    state.players[0]!.explored[ey * width + ex] = 0;
    drawMainScreen(s, state, { ...view, borders: true });
    expect(mm(ex, ey)).toBe(C.BLACK!);
  });

  it("fits a bigger world's minimap in the same 80x50, each pixel a block of squares", async () => {
    const { aiTurn } = await import("@civ/ai");
    const { drawWorldMap, minimapColor, minimapSize, minimapSquare, VIEW_Y } = await import("../src/index.js");
    const state = newGame(4, { world: "earth", historical: true, civ: "greeks", opponents: 3, size: "large" });
    for (let r = 0; r < 12; r++) {
      let guard = 0;
      while (state.activeUnit !== null && guard++ < 50) applyCommand(state, { type: "skip", unit: state.activeUnit });
      applyCommand(state, { type: "endTurn" });
      while (state.currentPlayer !== 0) { aiTurn(state); applyCommand(state, { type: "endTurn" }); }
    }
    const { map } = state;
    expect(minimapSize(map)).toEqual({ w: 80, h: 50 });
    const me = state.players[0]!;
    me.explored.fill(1);
    me.visible.fill(1);
    const city = state.cities.find((c) => c.owner !== 0) ?? state.cities[0]!;
    const view = { originX: city.x - 7, originY: Math.max(0, city.y - 6), blink: true };
    const s = Surface.screen();
    drawMainScreen(s, state, view);
    writeFileSync(new URL("./out/main-screen-large.png", import.meta.url), encodePng(s, 3));
    const top = VIEW_Y + 2;
    const mm = (px: number, py: number) => s.get(px, top + py);
    // Each city at the pixel of its 2x2 block, and that pixel leads back to the block.
    expect(mm(city.x >> 1, city.y >> 1)).toBe(C.WHITE!);
    const back = minimapSquare(map, city.x >> 1, city.y >> 1)!;
    expect(Math.abs(back.x - city.x) <= 1 && Math.abs(back.y - city.y) <= 1).toBe(true);
    expect(minimapSquare(map, 80, 0)).toBeNull();
    expect(minimapSquare(map, 0, 50)).toBeNull();
    // A block of sea with one square of land shows the land, so islands stay on the map.
    const clear = (px: number, py: number) => !state.units.some((u) => u.x >> 1 === px && u.y >> 1 === py)
      && !state.cities.some((c) => Math.abs((c.x >> 1) - px) + Math.abs((c.y >> 1) - py) <= 1);
    let island: [number, number] | undefined;
    for (let py = 1; py < 49 && !island; py++)
      for (let px = 0; px < 80 && !island; px++) {
        const squares = [0, 1, map.width, map.width + 1].map((d) => map.tiles[py * 2 * map.width + px * 2 + d]!);
        if (squares.filter((t) => t.terrain !== Terrain.Ocean).length === 1 && clear(px, py)) island = [px, py];
      }
    expect(island).toBeDefined();
    const [ix, iy] = island!;
    const landAt = [0, 1, map.width, map.width + 1].map((d) => iy * 2 * map.width + ix * 2 + d).find((i) => map.tiles[i]!.terrain !== Terrain.Ocean)!;
    expect(mm(ix, iy)).toBe(minimapColor(map, landAt % map.width, Math.floor(landAt / map.width), me.explored));
    // Nothing of a block we have not explored.
    for (const d of [0, 1, map.width, map.width + 1]) me.explored[iy * 2 * map.width + ix * 2 + d] = 0;
    drawMainScreen(s, state, view);
    expect(mm(ix, iy)).toBe(C.BLACK!);
    // The panel below the minimap starts where it does on the original's world.
    const small = Surface.screen();
    drawMainScreen(small, newGame(4), { originX: 0, originY: 0, blink: true });
    for (let x = 0; x < 80; x++) expect(isStone(s.get(x, top + 52)), `x ${x}`).toBe(isStone(small.get(x, top + 52)));
    drawWorldMap(s, state);
    writeFileSync(new URL("./out/world-map-large.png", import.meta.url), encodePng(s, 3));
  });
});

describe("civilization traits", () => {
  it("shows each tribe's strength beside its name, and the civilizations met with theirs", async () => {
    const { drawTitleScreen, drawReportScreen } = await import("../src/index.js");
    const { civilizationsReport, setupMenu } = await import("@civ/renderer-api");
    const s = Surface.screen();
    drawTitleScreen(s);
    const m = setupMenu({ step: "civ", world: null, historical: false, custom: null, difficulty: 2, opponents: 6, civ: "romans" });
    expect(m.items).toHaveLength(20);
    expect(m.right![0]).toBe("Fast roads");
    drawMenu(s, m);
    // Every tribe can still be picked: each row answers to a click.
    const rows = new Set<number>();
    for (let y = 0; y < 200; y++) rows.add(menuHit(m, 160, y));
    for (let i = 0; i < m.items.length; i++) expect(rows.has(i), m.items[i]).toBe(true);
    writeFileSync(new URL("./out/setup-civ.png", import.meta.url), encodePng(s, 3));
    const state = newGame(4, { opponents: 3 });
    applyCommand(state, { type: "cheat", cheat: "contact" });
    const page = civilizationsReport(state);
    expect(page.lines.filter((l) => !l.dim)).toHaveLength(4);
    drawReportScreen(s, page);
    writeFileSync(new URL("./out/report-civs.png", import.meta.url), encodePng(s, 3));
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
    drawTitleScreen(s);
    writeFileSync(new URL("./out/title.png", import.meta.url), encodePng(s, 3));
    drawDomesticAdvisor(s, state);
    writeFileSync(new URL("./out/advisor-domestic.png", import.meta.url), encodePng(s, 3));
    drawForeignAdvisor(s, state);
    writeFileSync(new URL("./out/advisor-foreign.png", import.meta.url), encodePng(s, 3));
    drawScoreScreen(s, state);
    writeFileSync(new URL("./out/score.png", import.meta.url), encodePng(s, 3));
    drawDiplomacyScreen(s, state, { player: 1, line: leaderLine(state, 1) });
    writeFileSync(new URL("./out/diplomacy.png", import.meta.url), encodePng(s, 3));
    // Met without a treaty, and our capital renowned enough for them to admire us.
    state.relations["0:2"] = "contact";
    state.cities.find((c) => c.owner === 0)!.wonders.push("pyramids", "colossus", "great_library");
    drawForeignAdvisor(s, state);
    writeFileSync(new URL("./out/advisor-foreign-treaty.png", import.meta.url), encodePng(s, 3));
    drawDiplomacyScreen(s, state, { player: 2, line: leaderLine(state, 2) });
    writeFileSync(new URL("./out/diplomacy-contact.png", import.meta.url), encodePng(s, 3));
    drawEndScreen(s, ["You have conquered the world!", "", "Total score: 123"], "Great");
    writeFileSync(new URL("./out/end.png", import.meta.url), encodePng(s, 3));
    expect(s.data.some((c) => c !== 0)).toBe(true);
  });
});

describe("planned moves", () => {
  it("draw the route as dots, corners round its end and the note there, until the second click", () => {
    const state = newGame(2026);
    const u = state.units[0]!;
    revealAround(state, 0, u.x, u.y, 9);
    for (let dx = -1; dx <= 5; dx++) for (let dy = -2; dy <= 2; dy++) Object.assign(getTile(state.map, u.x + dx, u.y + dy)!, { terrain: Terrain.Grassland, road: false, river: false, special: false, hut: false });
    const view: MainScreenView = { originX: u.x - 7, originY: Math.max(0, u.y - 6), blink: false };
    const plan = planMove(state, u.id, u.x + 4, u.y);
    expect(plan).not.toBe("step");
    expect(plan).not.toBeNull();
    const s = Surface.screen();
    drawMainScreen(s, state, { ...view, plan: plan as MovePlan });
    mkdirSync(new URL("./out/", import.meta.url), { recursive: true });
    writeFileSync(new URL("./out/move-plan.png", import.meta.url), encodePng(s, 3));
    const at = (mx: number, my: number, i: number, j: number) => s.get(80 + (mx - view.originX) * 16 + i, 9 + (my - view.originY) * 16 + j);
    // A dot in the middle of the first square on the way, white ringed in black; the end's corners white.
    const [fx, fy] = (plan as MovePlan).route[0]!;
    expect(at(fx, fy, 8, 8)).toBe(C.WHITE);
    expect(at(fx, fy, 6, 6)).toBe(C.BLACK);
    expect(at(u.x + 4, u.y, 0, 0)).toBe(C.WHITE);
    expect(at(u.x + 4, u.y, 15, 15)).toBe(C.WHITE);
    // Without the plan: no dot, no corners.
    drawMainScreen(s, state, view);
    expect(at(fx, fy, 8, 8)).not.toBe(C.WHITE);
    expect(at(u.x + 4, u.y, 0, 0)).not.toBe(C.WHITE);
  });
});

describe("moods", () => {
  it("flags our cities by mood on the map and lays the Happy panel out stage by stage", () => {
    const state = newGame(2026);
    const u = state.units[0]!;
    revealAround(state, 0, u.x, u.y, 9);
    applyCommand(state, { type: "found", unit: u.id });
    const city = state.cities[0]!;
    state.players[0]!.difficulty = 4; // two born content
    const view: MainScreenView = { originX: u.x - 7, originY: Math.max(0, u.y - 6), blink: false };
    const s = Surface.screen();
    // The mood flies as a pennant before the size plate, under the square (the town flies its owner's
    // flag on the square itself); `flag` reads the pennant's cloth, where it would be.
    const MOODS = [C.LRED, C.YELLOW, C.LGREEN];
    const flag = () => {
      drawMainScreen(s, state, view);
      const cx = 80 + (city.x - view.originX) * 16 + 8;
      const y = 9 + (city.y - view.originY) * 16 + 17;
      const x0 = cx - Math.floor((MOOD_PENNANT_W + textPlateWidth(String(city.size)) + 2 + textWidth(city.name)) / 2);
      return s.get(x0 + 1, y);
    };
    expect(MOODS).not.toContain(flag()); // one content citizen: nothing to flag
    city.size = 5;
    autoAssignWorkers(state, city); // three unhappy against none happy: riots
    expect(flag()).toBe(C.LRED);
    // Two entertainers make two happy against two unhappy: one lost happy citizen from riots.
    city.size = 6;
    autoAssignWorkers(state, city);
    city.worked = city.worked.slice(0, 4);
    city.specialists = ["entertainer", "entertainer"];
    expect(flag()).toBe(C.YELLOW);
    // A temple settles one of them: nothing to flag again; a festival flies green.
    city.buildings.push("temple");
    expect(MOODS).not.toContain(flag());
    city.celebrating = true;
    expect(flag()).toBe(C.LGREEN);
    mkdirSync(new URL("./out/", import.meta.url), { recursive: true });
    writeFileSync(new URL("./out/city-moods.png", import.meta.url), encodePng(s, 3));
    // A foreign city keeps its moods to itself.
    city.owner = 1;
    state.players[0]!.visible[city.y * state.map.width + city.x] = 1;
    expect(flag()).not.toBe(C.LGREEN);
    city.owner = 0;

    // The Happy panel takes the resources box: five rows, the people after each stage, the Happy button lit.
    city.celebrating = false;
    drawCityScreen(s, state, { city: city.id, happy: true });
    writeFileSync(new URL("./out/city-happy.png", import.meta.url), encodePng(s, 3));
    // No bottom bar: View and the close box end the title strip, Happy's face starts the row of citizens.
    const at = (want: (x: number, y: number) => boolean) => {
      for (let y = 0; y < 200; y++) for (let x = 0; x < 320; x++) if (want(x, y)) return { x, y };
      return null;
    };
    const exit = at((x, y) => cityExitHit(x, y))!;
    const viewAt = at((x, y) => cityButtonAt(x, y) === "view")!;
    const happyAt = at((x, y) => cityButtonAt(x, y) === "happy")!;
    expect(exit.y).toBeLessThan(14);
    expect(viewAt.y).toBeLessThan(14);
    expect(viewAt.x).toBeLessThan(exit.x);
    expect(happyAt.x).toBeLessThan(20);
    expect(at((x, y) => y >= 188 && cityExitHit(x, y))).toBeNull();
    // The focus toggles fill the map's four corners, the squares no city works: lit for each focus picked.
    expect([citySlotAt(CITY_MAP_X + 8, CITY_MAP_Y + 8), cityFocusAt(CITY_MAP_X + 8, CITY_MAP_Y + 8)]).toEqual([null, "growth"]);
    expect(cityFocusAt(CITY_MAP_X + 72, CITY_MAP_Y + 8)).toBe("production");
    expect(cityFocusAt(CITY_MAP_X + 72, CITY_MAP_Y + 72)).toBe("trade");
    expect(cityFocusAt(CITY_MAP_X + 8, CITY_MAP_Y + 72)).toBe("science");
    expect(cityFocusAt(CITY_MAP_X + 40, CITY_MAP_Y + 40)).toBeNull();
    const corner = (t: Surface, cx: number, cy: number) => {
      let lit = 0;
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (t.get(CITY_MAP_X + cx + x, CITY_MAP_Y + cy + y) === shade("azure", 2)) lit++;
      return lit;
    };
    drawCityScreen(s, state, { city: city.id, happy: true });
    expect(corner(s, 0, 0)).toBeGreaterThan(50); // Growth, the player's default
    expect(corner(s, 64, 0)).toBe(0);
    applyCommand(state, { type: "setFoci", city: city.id, foci: ["growth", "production"] });
    drawCityScreen(s, state, { city: city.id, happy: true });
    expect(corner(s, 0, 0)).toBeGreaterThan(50);
    expect(corner(s, 64, 0)).toBeGreaterThan(50);
    expect(corner(s, 64, 64)).toBe(0);
    writeFileSync(new URL("./out/city-foci.png", import.meta.url), encodePng(s, 3));
    // Without the panel the resources are back.
    drawCityScreen(s, state, { city: city.id });
    expect(s.data.some((c) => c !== 0)).toBe(true);
  });
});
