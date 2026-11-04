import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { applyCommand, BUILDINGS, newGame, SPACE_PARTS, WONDERS, type GameState, type Production } from "@civ/core";
import { ART_SIZE, artPlace, BUILDING_ART, BUILDING_CUTS, BUILDING_PICTURES_WANTED, builtCard, wonderStages, type BuiltView, type MainScreenView } from "@civ/renderer-api";
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
  it("are a picture for each id the tables name, and nothing else, each drawing inside its square", () => {
    const ids = new Set([...BUILDINGS.map((b) => b.id), ...WONDERS.map((w) => w.id), ...SPACE_PARTS.map((p) => p.id)].filter((id) => !BUILDING_PICTURES_WANTED.includes(id)));
    const of = (ext: string) => readdirSync(dir).filter((f) => f.endsWith(ext)).map((f) => f.slice(0, -ext.length)).sort();
    expect(of(".webp")).toEqual(Object.keys(BUILDING_ART).sort());
    expect(of(".png")).toEqual(Object.keys(BUILDING_CUTS).sort());
    for (const [id, [x, y, w, h]] of Object.entries(BUILDING_ART)) {
      expect(ids.has(id), id).toBe(true);
      expect(id in BUILDING_CUTS, id).toBe(false);
      expect(existsSync(new URL(`${id}.webp`, dir)), id).toBe(true);
      expect(x >= 0 && y >= 0 && w > 100 && h > 100 && x + w <= ART_SIZE && y + h <= ART_SIZE, id).toBe(true);
    }
    // The sheets hold every improvement and some wonders, with their stages; the rest keep their squares.
    const stages = WONDERS.flatMap((w) => wonderStages(w.id));
    const cut = Object.keys(BUILDING_CUTS).filter((id) => !stages.includes(id));
    for (const id of cut) expect(ids.has(id), id).toBe(true);
    for (const b of BUILDINGS) expect(cut, b.id).toContain(b.id);
    expect(Object.keys(BUILDING_ART).length + cut.length).toBe(ids.size);
  });

  it("lay a picture so its drawing fills a box, shape kept, on the box's foot or in its middle", () => {
    const box = { id: "apollo_program", x: 100, y: 40, w: 60, h: 60 };
    const [ax, ay, aw, ah] = BUILDING_ART.apollo_program!;
    for (const middle of [false, true]) {
      const p = artPlace({ ...box, middle })!;
      const k = p.w / ART_SIZE;
      const drawn = { x: p.x + ax * k, y: p.y + ay * k, w: aw * k, h: ah * k };
      expect(drawn.h).toBeCloseTo(60); // a tall rocket fills the box's height
      expect(drawn.x + drawn.w / 2).toBeCloseTo(130);
      if (middle) expect(drawn.y + drawn.h / 2).toBeCloseTo(70);
      else expect(drawn.y + drawn.h).toBeCloseTo(100);
    }
    expect(artPlace({ ...box, id: "hut" })).toBeNull();
  });

  it("lay a cut of the sheet whole, in its own shape", () => {
    const box = { id: "cell_tower", x: 100, y: 40, w: 60, h: 60 };
    const [w, h] = BUILDING_CUTS.cell_tower!;
    const foot = artPlace(box)!;
    expect(foot.h).toBeCloseTo(60); // taller than wide, so it fills the box's height...
    expect(foot.w / foot.h).toBeCloseTo(w / h); // ...shape kept
    expect(foot.x + foot.w / 2).toBeCloseTo(130);
    expect(foot.y + foot.h).toBeCloseTo(100);
    const wide = artPlace({ ...box, id: "city_walls", middle: true })!;
    expect(wide.w).toBeCloseTo(60);
    expect(wide.y + wide.h / 2).toBeCloseTo(70);
  });
});

describe("Building Completed window", () => {
  it("says in its title what was completed and where, and what it does in numbers", () => {
    const { state, city } = withCity();
    const all: Production[] = [
      ...BUILDINGS.map((b) => ({ kind: "building" as const, id: b.id })),
      ...WONDERS.map((w) => ({ kind: "wonder" as const, id: w.id })),
      ...SPACE_PARTS.map((p) => ({ kind: "spaceship" as const, id: p.id })),
    ];
    for (const production of all) {
      const card = builtCard(state, { city, production })!;
      expect(card.text, production.id).not.toBe("");
      expect(card.title).toBe(`${card.name} is completed in ${state.cities[0]!.name}`);
      expect(card.effects.length, production.id).toBeGreaterThan(0);
    }
    const name = state.cities[0]!.name;
    const temple = builtCard(state, { city, production: { kind: "building", id: "temple" } })!;
    expect(temple).toMatchObject({ title: `Temple is completed in ${name}`, name: "Temple", upkeep: 1 });
    expect(temple.effects).toEqual([{ icon: "heart", text: "+1 content citizen" }, { icon: "culture", text: "+2 culture" }]);
    // The Harbour's food and, since save version 58, its trade on the sea (`richSea` games: food only).
    expect(builtCard(state, { city, production: { kind: "building", id: "harbour" } })!.effects).toEqual([
      { icon: "food", text: "+1 food on each ocean square" },
      { icon: "trade", text: "+1 trade on each ocean square" },
    ]);
    expect(builtCard({ ...state, richSea: true }, { city, production: { kind: "building", id: "harbour" } })!.effects).toEqual([{ icon: "food", text: "+1 food on each ocean square" }]);
    expect(builtCard(state, { city, production: { kind: "wonder", id: "pyramids" } })!.title).toBe(`Pyramids is completed in ${name}`);
    expect(builtCard(state, { city: 9999, production: { kind: "building", id: "temple" } })).toBeNull();
    expect(builtCard(state, { city, production: { kind: "unit", id: "settlers" } })).toBeNull();
  });

  it("draws a small window, the news in its title, its picture's spot in its bed, its effects beside it, one button into the city", () => {
    const { state, city } = withCity();
    const s = Surface.screen();
    mkdirSync(new URL("./out/", import.meta.url), { recursive: true });
    const shown: [Production["kind"], string][] = [["building", "temple"], ["building", "hydro_plant"], ["wonder", "michelangelos"], ["spaceship", "module"], ["building", "granary"], ["building", "palace"]];
    for (const [kind, id] of shown) {
      s.art = [];
      const shownView: BuiltView = { city, production: { kind, id } as Production };
      drawBuilt(s, state, shownView);
      writeFileSync(new URL(`./out/built-${id}.png`, import.meta.url), encodePng(s, 3));
      expect(s.art).toEqual([{ id, ...builtPicture(state, shownView), middle: true }]);
      // As wide as its title and effects need, never off the screen.
      const o = builtRect(state, shownView);
      expect(o.x).toBeGreaterThan(0);
      expect(o.x + o.w).toBeLessThan(320);
    }
    // The Harbour's two lines.
    const harbour: BuiltView = { city, production: { kind: "building", id: "harbour" } };
    drawBuilt(s, state, harbour);
    writeFileSync(new URL("./out/built-harbour.png", import.meta.url), encodePng(s, 3));
    expect(builtRect(state, harbour).x + builtRect(state, harbour).w).toBeLessThan(320);
    const view = { city, production: { kind: "building", id: "temple" } as Production };
    const hits = new Set<string | null>();
    for (let y = 0; y < 200; y++) for (let x = 0; x < 320; x++) hits.add(builtHit(state, view, x, y));
    expect([...hits].sort()).toEqual(["city", "close", null].sort());
    // A small window over the game (168x88 until 2026-10-27), the picture at its left, View City along its foot.
    const o = builtRect(state, view);
    expect(o.h).toBeLessThan(80);
    expect(o.w).toBeLessThan(168);
    const p = builtPicture(state, view);
    expect(p.w).toBeLessThan(36);
    expect(builtHit(state, view, o.x + (o.w >> 1), o.y + o.h - 10)).toBe("city");
    expect(builtHit(state, view, p.x + p.w + 15, p.y + (p.h >> 1))).toBeNull();
    expect(builtHit(state, view, 30, 185)).toBeNull();
    // A long name and city widen it to fit the title.
    const wide = { city, production: { kind: "wonder", id: "michelangelos" } as Production };
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
    const view: BuiltView = { city, production: { kind: "building", id: "temple" }, square };
    drawBuilt(s, state, view);
    writeFileSync(new URL("./out/built-over-map.png", import.meta.url), encodePng(s, 3));
    const place = builtPlace(320, square, builtRect(state, view));
    expect(place.side).toBe("above");
    expect(place.win.w * place.win.h).toBeLessThan(168 * 88 * 0.85);
    expect(place.win.y).toBeGreaterThan(VIEW_Y);
    // The point reaches from the window's foot to the ring round the square, over the square's middle.
    expect(place.win.y + place.win.h + 6).toBe(y - 2);
    expect(place.tip).toEqual({ x: x + 8, y: y - 3 });
    expect(s.art.filter((a) => !a.city && !a.resource)).toEqual([{ id: "temple", ...builtPicture(state, view), middle: true }]);
    // The city stays lit under the darkened map, its picture too; a click on it is View City, as the button is.
    expect(s.fget(x * 2 + 9, y * 2 + 9)).toBe(lit);
    expect(s.art.filter((a) => a.city).map((a) => [a.x, a.y, a.dim === true])).toEqual([[x, y, false]]);
    expect(builtHit(state, view, x + 8, y + 8)).toBe("city");
    expect(builtHit(state, view, x + 8, y + 20)).toBeNull();
    const o = place.win;
    expect(builtHit(state, view, o.x + (o.w >> 1), o.y + o.h - 10)).toBe("city");
    expect(builtHit(state, view, o.x + o.w - 10, o.y + 8)).toBe("close");
    // No room above (a city by the top of the view): below it; none either: beside it.
    const size = { w: o.w, h: o.h };
    expect(builtPlace(320, { x: 200, y: 20, w: 16, h: 16 }, size).side).toBe("below");
    expect(builtPlace(480, { x: 200, y: 92, w: 32, h: 32 }, { w: 168, h: 88 }).side).toBe("right");
    expect(builtPlace(320, undefined, size)).toMatchObject({ side: null, win: builtRect(state, { ...view, square: undefined }) });
  });
});
