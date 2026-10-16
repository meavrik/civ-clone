import { mkdirSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { applyCommand, autoAssignWorkers, buildOptions, building, createUnit, getTile, newGame, revealAround, Terrain, unitType } from "@civ/core";
import { drawCityScreen, drawDiscoveryScreen, drawMainScreen, drawMenu, drawRatesScreen, drawScienceScreen, drawText, drawTextInput, PALETTE, Surface, textWidth, type MainScreenView } from "../src/index.js";
import { encodePng } from "./png.js";

describe("retro renderer", () => {
  it("palette has 256 entries, EGA first", () => {
    expect(PALETTE.length).toBe(256);
    expect(PALETTE[15]).toEqual([255, 255, 255]);
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
    createUnit(state, "trireme", 0, u.x + 1, u.y - 2);
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
