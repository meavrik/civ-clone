import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { applyCommand, BUILDINGS, newGame, SPACE_PARTS, WONDERS, type GameState, type Production } from "@civ/core";
import { ART_SIZE, artPlace, BUILDING_ART, builtCard, type BuiltView, type MainScreenView } from "@civ/renderer-api";
import { describe, expect, it } from "vitest";
import { builtHit, builtPicture, builtPlace, builtRect, drawBuilt, drawMainScreen, tileToScreen, TILE, VIEW_Y } from "../src/index.js";
import { Surface } from "../src/surface.js";
import { encodePng } from "./png.js";

const dir = new URL("../../../apps/web/src/buildings/", import.meta.url);

/** A game with one city of ours. */
function withCity(): { state: GameState; city: number } {
  const state = newGame(5, { opponents: 2 });
  applyCommand(state, { type: "found", unit: state.units[0]!.id });
  return { state, city: state.cities[0]!.id };
}

describe("the user's pictures of buildings", () => {
  it("are a picture for each id the table names, and nothing else, each drawing inside its square", () => {
    const ids = new Set([...BUILDINGS.map((b) => b.id), ...WONDERS.map((w) => w.id), ...SPACE_PARTS.map((p) => p.id)]);
    const files = readdirSync(dir).filter((f) => f.endsWith(".webp")).map((f) => f.slice(0, -5));
    expect(files.sort()).toEqual(Object.keys(BUILDING_ART).sort());
    for (const [id, [x, y, w, h]] of Object.entries(BUILDING_ART)) {
      expect(ids.has(id), id).toBe(true);
      expect(existsSync(new URL(`${id}.webp`, dir)), id).toBe(true);
      expect(x >= 0 && y >= 0 && w > 100 && h > 100 && x + w <= ART_SIZE && y + h <= ART_SIZE, id).toBe(true);
    }
    // Every one of the 50 has one.
    expect(Object.keys(BUILDING_ART).length).toBe(ids.size);
  });

  it("lay a picture so its drawing fills a box, shape kept, on the box's foot or in its middle", () => {
    const box = { id: "cell_tower", x: 100, y: 40, w: 60, h: 60 };
    const [ax, ay, aw, ah] = BUILDING_ART.cell_tower!;
    for (const middle of [false, true]) {
      const p = artPlace({ ...box, middle })!;
      const k = p.w / ART_SIZE;
      const drawn = { x: p.x + ax * k, y: p.y + ay * k, w: aw * k, h: ah * k };
      expect(drawn.h).toBeCloseTo(60); // a tall tower fills the box's height
      expect(drawn.x + drawn.w / 2).toBeCloseTo(130);
      if (middle) expect(drawn.y + drawn.h / 2).toBeCloseTo(70);
      else expect(drawn.y + drawn.h).toBeCloseTo(100);
    }
    expect(artPlace({ ...box, id: "hut" })).toBeNull();
  });
});

describe("Building Completed window", () => {
  it("says it all in its title: what was completed and where", () => {
    const { state, city } = withCity();
    const all: Production[] = [
      ...BUILDINGS.map((b) => ({ kind: "building" as const, id: b.id })),
      ...WONDERS.map((w) => ({ kind: "wonder" as const, id: w.id })),
      ...SPACE_PARTS.map((p) => ({ kind: "spaceship" as const, id: p.id })),
    ];
    for (const production of all) {
      const card = builtCard(state, { city, production, selected: 1 })!;
      expect(card.text, production.id).not.toBe("");
      expect(card.title).toBe(`${card.name} is completed in ${state.cities[0]!.name}`);
    }
    const name = state.cities[0]!.name;
    expect(builtCard(state, { city, production: { kind: "building", id: "temple" }, selected: 1 })).toMatchObject({ title: `Temple is completed in ${name}`, name: "Temple" });
    expect(builtCard(state, { city, production: { kind: "wonder", id: "pyramids" }, selected: 1 })!.title).toBe(`Pyramids is completed in ${name}`);
    expect(builtCard(state, { city: 9999, production: { kind: "building", id: "temple" }, selected: 1 })).toBeNull();
    expect(builtCard(state, { city, production: { kind: "unit", id: "settlers" }, selected: 1 })).toBeNull();
  });

  it("draws a small window, the news in its title, its picture's spot in its bed, its buttons answering clicks", () => {
    const { state, city } = withCity();
    const s = Surface.screen();
    mkdirSync(new URL("./out/", import.meta.url), { recursive: true });
    const shown: [Production["kind"], string][] = [["building", "temple"], ["building", "hydro_plant"], ["wonder", "michelangelos"], ["spaceship", "module"], ["building", "granary"], ["building", "palace"]];
    for (const [kind, id] of shown) {
      s.art = [];
      const shownView: BuiltView = { city, production: { kind, id } as Production, selected: 1 };
      drawBuilt(s, state, shownView);
      writeFileSync(new URL(`./out/built-${id}.png`, import.meta.url), encodePng(s, 3));
      expect(s.art).toEqual([{ id, ...builtPicture(state, shownView), middle: true }]);
      // As wide as its title needs, never off the screen.
      const o = builtRect(state, shownView);
      expect(o.x).toBeGreaterThan(0);
      expect(o.x + o.w).toBeLessThan(320);
    }
    const view = { city, production: { kind: "building", id: "temple" } as Production, selected: 1 };
    const hits = new Set<string | null>();
    for (let y = 0; y < 200; y++) for (let x = 0; x < 320; x++) hits.add(builtHit(state, view, x, y));
    expect([...hits].sort()).toEqual(["city", "close", "continue", null].sort());
    // A small window over the game (168x88 until 2026-10-27), the picture at its left, its buttons beside it.
    const o = builtRect(state, view);
    expect(o.h).toBeLessThan(60);
    expect(o.w).toBeLessThan(168);
    const p = builtPicture(state, view);
    expect(p.w).toBeLessThan(36);
    const mid = p.y + (p.h >> 1);
    expect(builtHit(state, view, p.x + p.w + 15, mid)).toBe("city");
    expect(builtHit(state, view, o.x + o.w - 15, mid)).toBe("continue");
    expect(builtHit(state, view, 30, 185)).toBeNull();
    // A long name and city widen it to fit the title.
    const wide = { city, production: { kind: "wonder", id: "michelangelos" } as Production, selected: 1 };
    state.cities[0]!.name = "Constantinople";
    expect(builtRect(state, wide).w).toBeGreaterThan(o.w);
  });

  it("stands above the city it names over the map, pointing at its lit square, and smaller than it was", () => {
    const { state, city } = withCity();
    const c = state.cities[0]!;
    // As the web app leaves the camera: the city a square below the middle of the view.
    const map: MainScreenView = { originX: c.x - 7, originY: Math.max(0, c.y - 7), blink: false, placeNames: false };
    const s = Surface.screen();
    drawMainScreen(s, state, map);
    const [x, y] = tileToScreen(state, map, c.x, c.y)!;
    const square = { x, y, w: TILE, h: TILE };
    const lit = s.fget(x * 2 + 9, y * 2 + 9);
    const view: BuiltView = { city, production: { kind: "building", id: "temple" }, selected: 1, square };
    drawBuilt(s, state, view);
    writeFileSync(new URL("./out/built-over-map.png", import.meta.url), encodePng(s, 3));
    const place = builtPlace(320, square, builtRect(state, view));
    expect(place.side).toBe("above");
    expect(place.win.w * place.win.h).toBeLessThan(168 * 88 * 0.6);
    expect(place.win.y).toBeGreaterThan(VIEW_Y);
    // The point reaches from the window's foot to the ring round the square, over the square's middle.
    expect(place.win.y + place.win.h + 6).toBe(y - 2);
    expect(place.tip).toEqual({ x: x + 8, y: y - 3 });
    expect(s.art).toEqual([{ id: "temple", ...builtPicture(state, view), middle: true }]);
    // The city stays lit under the darkened map; a click on it is View City, as the button is.
    expect(s.fget(x * 2 + 9, y * 2 + 9)).toBe(lit);
    expect(builtHit(state, view, x + 8, y + 8)).toBe("city");
    expect(builtHit(state, view, x + 8, y + 20)).toBeNull();
    const o = place.win;
    expect(builtHit(state, view, o.x + o.w - 20, o.y + 30)).toBe("continue");
    // No room above (a city by the top of the view): below it; none either: beside it.
    const size = { w: o.w, h: o.h };
    expect(builtPlace(320, { x: 200, y: 20, w: 16, h: 16 }, size).side).toBe("below");
    expect(builtPlace(480, { x: 200, y: 92, w: 32, h: 32 }, { w: 168, h: 88 }).side).toBe("right");
    expect(builtPlace(320, undefined, size)).toMatchObject({ side: null, win: builtRect(state, { ...view, square: undefined }) });
  });
});
