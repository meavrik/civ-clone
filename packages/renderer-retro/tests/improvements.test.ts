import { mkdirSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { applyCommand, autoAssignWorkers, newGame, type GameState } from "@civ/core";
import { cityImprovementAt, cityImprovementRows, drawCityScreen, drawMenu, improvementNote, scrollImprovements, Surface, type CityScreenView, type ImprovementHit } from "../src/index.js";
import { encodePng } from "./png.js";

/** The Improvements box: the right-hand window of the city screen's upper row. */
const BOX = { x: 193, y: 30, w: 126, h: 84 };

function cityWithBuildings(): GameState {
  const state = newGame(2026);
  applyCommand(state, { type: "found", unit: state.units[0]!.id });
  const city = state.cities[0]!;
  city.size = 5;
  city.buildings = ["palace", "barracks", "granary", "temple", "marketplace", "library", "courthouse", "city_walls"];
  city.wonders = ["pyramids"];
  autoAssignWorkers(state, city);
  return state;
}

/** Every hit the box answers, by line and by kind, scanning it pixel by pixel. */
function hits(state: GameState, view: CityScreenView): Map<string, ImprovementHit> {
  const out = new Map<string, ImprovementHit>();
  for (let y = BOX.y; y < BOX.y + BOX.h; y++)
    for (let x = BOX.x; x < BOX.x + BOX.w; x++) {
      const h = cityImprovementAt(state, view, x, y);
      if (h) out.set(h.kind === "line" ? `${h.id}${h.toggle ? ":toggle" : ""}` : `scroll:${h.by}`, h);
    }
  return out;
}

describe("the city screen's improvements", () => {
  it("lays a picture for each line on view, inside the box, and scrolls through them all", () => {
    const state = cityWithBuildings();
    const city = state.cities[0]!;
    const rows = cityImprovementRows(state);
    expect(rows).toBe(5);
    const view: CityScreenView = { city: city.id };
    const s = Surface.screen();
    drawCityScreen(s, state, view);
    mkdirSync(new URL("./out/", import.meta.url), { recursive: true });
    writeFileSync(new URL("./out/city-improvements.png", import.meta.url), encodePng(s, 3));
    // Wonders first, then the buildings as built; only the lines on view.
    expect(s.art.filter((a) => !a.unit && !a.city).map((a) => a.id)).toEqual(["pyramids", "palace", "barracks", "granary", "temple"]);
    for (const a of s.art.filter((a) => !a.unit && !a.city)) {
      expect(a.x).toBeGreaterThanOrEqual(BOX.x);
      expect(a.x + a.w).toBeLessThanOrEqual(BOX.x + BOX.w);
      expect(a.y).toBeGreaterThanOrEqual(BOX.y);
      expect(a.y + a.h).toBeLessThanOrEqual(BOX.y + BOX.h);
    }
    // Scrolled to the end, the last lines show; no further.
    view.top = scrollImprovements(city, view.top, 99, rows);
    expect(view.top).toBe(4);
    const t = Surface.screen();
    drawCityScreen(t, state, view);
    writeFileSync(new URL("./out/city-improvements-scrolled.png", import.meta.url), encodePng(t, 3));
    expect(t.art.filter((a) => !a.unit && !a.city).map((a) => a.id)).toEqual(["temple", "marketplace", "library", "courthouse", "city_walls"]);
    expect(scrollImprovements(city, view.top, -1, rows)).toBe(3);
    expect(scrollImprovements(city, 0, -1, rows)).toBe(0);
  });

  it("finds each line and its Stop button, none for the Palace or a wonder, and the bar's arrows and pages", () => {
    const state = cityWithBuildings();
    const city = state.cities[0]!;
    const found = hits(state, { city: city.id });
    expect([...found.keys()].filter((k) => k.endsWith(":toggle")).sort()).toEqual(["barracks:toggle", "granary:toggle", "temple:toggle"]);
    for (const id of ["pyramids", "palace", "barracks", "granary", "temple"]) expect(found.has(id)).toBe(true);
    expect(found.has("pyramids:toggle") || found.has("palace:toggle")).toBe(false);
    expect([...found.keys()].filter((k) => k.startsWith("scroll:")).sort()).toEqual(["scroll:-1", "scroll:0", "scroll:1", "scroll:5"]);
    // A short list does not scroll: no bar.
    city.buildings = ["palace", "temple"];
    expect([...hits(state, { city: city.id }).keys()].some((k) => k.startsWith("scroll:"))).toBe(false);
  });

  it("tells beside the citizens what stopping a building saves, lists a stopped one last, faded, with Use", () => {
    const state = cityWithBuildings();
    const city = state.cities[0]!;
    city.buildings = ["palace", "temple", "granary"];
    expect(improvementNote(state, city, "temple")).toBe("Temple: 1 gold a turn. Stop: no cost, no effect");
    expect(improvementNote(state, city, "palace")).toBe("The Palace costs nothing to keep");
    expect(improvementNote(state, city, "pyramids")).toBe("Pyramids: wonders cost nothing to keep");
    const s = Surface.screen();
    drawCityScreen(s, state, { city: city.id, hoverImprovement: { id: "temple", toggle: true } });
    writeFileSync(new URL("./out/city-improvements-hover.png", import.meta.url), encodePng(s, 3));
    expect(applyCommand(state, { type: "support", city: city.id, building: "temple", on: false }).ok).toBe(true);
    expect(improvementNote(state, city, "temple")).toBe("Temple stopped: Use pays 1 gold a turn");
    const t = Surface.screen();
    drawCityScreen(t, state, { city: city.id, hoverImprovement: { id: "temple", toggle: true } });
    writeFileSync(new URL("./out/city-improvements-idle.png", import.meta.url), encodePng(t, 3));
    // The stopped temple comes last, its picture darkened; its line still answers, on its Use button too.
    expect(t.art.filter((a) => !a.unit && !a.city).map((a) => [a.id, a.dim === true])).toEqual([["pyramids", false], ["palace", false], ["granary", false], ["temple", true]]);
    const found = hits(state, { city: city.id });
    expect(found.has("temple:toggle")).toBe(true);
    // A window over the screen hides the pictures under it and darkens the rest.
    drawMenu(t, { title: "Stop supporting the Granary?", body: ["{coin} Saves 1 gold a turn."], items: ["Keep it", "Stop support"], selected: 0 });
    expect(t.art.every((a) => a.dim)).toBe(true);
  });
});
