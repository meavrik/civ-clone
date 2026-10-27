import { mkdirSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { applyCommand, autoAssignWorkers, newGame } from "@civ/core";
import { CITY_BOXES, cityBoxAt, cityButtonAt, cityImprovementAt, cityZoomPlace, cityZoomPoint, drawCityScreen, drawCityZoom, SCREEN_W, Surface } from "../src/index.js";
import { encodePng } from "./png.js";

describe("the phone's enlarged city box", () => {
  it("draws a box of the city screen twice its size over the darkened rest, and maps its points back", () => {
    const state = newGame(2026);
    applyCommand(state, { type: "found", unit: state.units[0]!.id });
    const city = state.cities[0]!;
    city.size = 5;
    city.buildings = ["palace", "barracks", "granary", "temple"];
    autoAssignWorkers(state, city);
    const view = { city: city.id };
    const narrow = Surface.screen();
    drawCityScreen(narrow, state, view);
    mkdirSync(new URL("./out/", import.meta.url), { recursive: true });
    const wide = Surface.fine(440, 200);
    const inset = (440 - SCREEN_W) / 2;
    for (const box of CITY_BOXES) {
      const z = cityZoomPlace(box, 440);
      expect(z.scale, box.id).toBe(2);
      expect(z.x).toBeGreaterThanOrEqual(0);
      expect(z.x + z.w).toBeLessThanOrEqual(440);
      expect(z.y - 13).toBeGreaterThanOrEqual(0);
      expect(z.y + z.h).toBeLessThanOrEqual(200);
      // A point of the box is found there, and maps back onto itself.
      expect(cityBoxAt(box.x + 5, box.y + 5)).toBe(box);
      expect(cityZoomPoint(z, z.x + 10, z.y + 10)).toEqual([box.x + 5, box.y + 5]);
      expect(cityZoomPoint(z, z.x - 1, z.y)).toBeNull();
      // The phone's narrowest screen fits it too.
      expect(cityZoomPlace(box, SCREEN_W).scale).toBe(2);
    }
    const improvements = CITY_BOXES.find((b) => b.id === "improvements")!;
    const z = cityZoomPlace(improvements, 440);
    drawCityZoom(wide, narrow, z, inset);
    writeFileSync(new URL("./out/city-zoom-improvements.png", import.meta.url), encodePng(wide, 3));
    // Every fine pixel of the box stands as a block of four.
    for (const [x, y] of [[3, 3], [40, 20], [100, 60]] as const)
      expect(wide.fget((z.x + x * 2) * 2, (z.y + y * 2) * 2)).toBe(narrow.fget((improvements.x + x) * 2, (improvements.y + y) * 2));
    // Its pictures grew with it; the rest went dark.
    const spots = narrow.art.filter((a) => a.x >= improvements.x && a.y < improvements.y + improvements.h && a.y >= improvements.y);
    expect(spots.length).toBeGreaterThan(0);
    for (const a of wide.art.filter((b) => !b.dim)) {
      expect(a.w).toBe(28);
      expect(a.x).toBeGreaterThanOrEqual(z.x);
    }
    // Another box enlarged: the improvements' pictures, darkened, never stand over it.
    const resources = cityZoomPlace(CITY_BOXES.find((b) => b.id === "resources")!, 440);
    const r = Surface.fine(440, 200);
    drawCityZoom(r, narrow, resources, inset);
    expect(r.art.every((a) => a.dim && (a.x >= resources.x + resources.w + 3 || a.x + a.w <= resources.x - 1 || a.y >= resources.y + resources.h + 3 || a.y + a.h <= resources.y - 1))).toBe(true);
    expect(r.dimmed).toBe(false);
    // A tap on the enlarged Stop button of the barracks is the button's own point.
    const stop = cityZoomPoint(z, z.x + z.w - 14, z.y + (improvements.y + 14 + 11 * 1 + 5 - improvements.y) * 2);
    expect(stop).not.toBeNull();
    expect(cityImprovementAt(state, view, ...stop!)).toMatchObject({ kind: "line", id: "barracks", toggle: true });
    const production = CITY_BOXES.find((b) => b.id === "production")!;
    const p = cityZoomPlace(production, 440);
    const t = Surface.fine(440, 200);
    drawCityZoom(t, narrow, p, inset);
    writeFileSync(new URL("./out/city-zoom-production.png", import.meta.url), encodePng(t, 3));
    const change = cityZoomPoint(p, p.x + 20 * 2, p.y + 16 * 2)!;
    expect(cityButtonAt(...change)).toBe("change");
  });
});
