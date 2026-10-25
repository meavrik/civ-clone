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
      if (h) out.set(h.kind === "line" ? `${h.id}${h.sell ? ":sell" : ""}` : `scroll:${h.by}`, h);
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
    expect(s.art.map((a) => a.id)).toEqual(["pyramids", "palace", "barracks", "granary", "temple"]);
    for (const a of s.art) {
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
    expect(t.art.map((a) => a.id)).toEqual(["temple", "marketplace", "library", "courthouse", "city_walls"]);
    expect(scrollImprovements(city, view.top, -1, rows)).toBe(3);
    expect(scrollImprovements(city, 0, -1, rows)).toBe(0);
  });

  it("finds each line and its Sell button, none for the Palace or a wonder, and the bar's arrows and pages", () => {
    const state = cityWithBuildings();
    const city = state.cities[0]!;
    const found = hits(state, { city: city.id });
    expect([...found.keys()].filter((k) => k.endsWith(":sell")).sort()).toEqual(["barracks:sell", "granary:sell", "temple:sell"]);
    for (const id of ["pyramids", "palace", "barracks", "granary", "temple"]) expect(found.has(id)).toBe(true);
    expect(found.has("pyramids:sell") || found.has("palace:sell")).toBe(false);
    expect([...found.keys()].filter((k) => k.startsWith("scroll:")).sort()).toEqual(["scroll:-1", "scroll:0", "scroll:1", "scroll:5"]);
    // A short list does not scroll: no bar.
    city.buildings = ["palace", "temple"];
    expect([...hits(state, { city: city.id }).keys()].some((k) => k.startsWith("scroll:"))).toBe(false);
  });

  it("tells beside the citizens what the pointed line sells for, or why it cannot, and fades the buttons once the city has sold", () => {
    const state = cityWithBuildings();
    const city = state.cities[0]!;
    expect(improvementNote(state, city, "temple")).toBe("Sell the Temple for 40 gold");
    expect(improvementNote(state, city, "palace")).toBe("The Palace is never sold");
    expect(improvementNote(state, city, "pyramids")).toBe("Pyramids: wonders are never sold");
    const s = Surface.screen();
    drawCityScreen(s, state, { city: city.id, hoverImprovement: { id: "temple", sell: true } });
    writeFileSync(new URL("./out/city-improvements-hover.png", import.meta.url), encodePng(s, 3));
    expect(applyCommand(state, { type: "sell", city: city.id, building: "temple" }).ok).toBe(true);
    expect(improvementNote(state, city, "granary")).toBe(`${city.name} has sold a building this turn`);
    const t = Surface.screen();
    drawCityScreen(t, state, { city: city.id });
    writeFileSync(new URL("./out/city-improvements-sold.png", import.meta.url), encodePng(t, 3));
    // The Sell buttons are drawn differently (faded) once the city has sold this turn.
    const box = (x: Surface) => { const out: number[] = []; for (let y = BOX.y; y < BOX.y + BOX.h; y++) for (let k = BOX.x; k < BOX.x + BOX.w; k++) out.push(x.get(k, y)); return out; };
    const u = Surface.screen();
    city.soldOn = undefined;
    drawCityScreen(u, state, { city: city.id });
    expect(box(t)).not.toEqual(box(u));
    // A window over the screen hides the pictures under it and darkens the rest.
    drawMenu(t, { title: "Sell the Granary?", body: ["{purse} 60 gold for it"], items: ["Sell", "Keep it"], selected: 1 });
    expect(t.art.every((a) => a.dim)).toBe(true);
  });
});
