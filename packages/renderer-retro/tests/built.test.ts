import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { applyCommand, BUILDINGS, newGame, SPACE_PARTS, WONDERS, type GameState, type Production } from "@civ/core";
import { ART_SIZE, artPlace, BUILDING_ART, builtCard } from "@civ/renderer-api";
import { describe, expect, it } from "vitest";
import { wrapText } from "../src/font.js";
import { BUILT_PICTURE, BUILT_TEXT_W, builtHit, drawBuilt } from "../src/index.js";
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
    // All but three of the 50 have one.
    expect(ids.size - Object.keys(BUILDING_ART).length).toBe(3);
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
    expect(artPlace({ ...box, id: "granary" })).toBeNull();
  });
});

describe("Building Completed window", () => {
  it("says what every improvement, wonder and spaceship part is in three lines at most, and what it does", () => {
    const { state, city } = withCity();
    const all: Production[] = [
      ...BUILDINGS.map((b) => ({ kind: "building" as const, id: b.id })),
      ...WONDERS.map((w) => ({ kind: "wonder" as const, id: w.id })),
      ...SPACE_PARTS.map((p) => ({ kind: "spaceship" as const, id: p.id })),
    ];
    for (const production of all) {
      const card = builtCard(state, { city, production, selected: 1 })!;
      expect(wrapText(card.text, BUILT_TEXT_W).length, production.id).toBeLessThanOrEqual(3);
      expect(card.effects.length, production.id).toBeGreaterThan(0);
      expect(card.where).toBe(`Completed in ${state.cities[0]!.name}`);
    }
    const temple = builtCard(state, { city, production: { kind: "building", id: "temple" }, selected: 1 })!;
    expect(temple).toMatchObject({ title: "Building Completed", name: "Temple", upkeep: 1 });
    expect(temple.effects).toEqual([{ icon: "heart", text: "+1 content citizen" }, { icon: "culture", text: "+2 culture" }]);
    expect(builtCard(state, { city, production: { kind: "building", id: "library" }, selected: 1 })!.more).toEqual(["University and Data Center build on it."]);
    expect(builtCard(state, { city, production: { kind: "building", id: "bank" }, selected: 1 })!.more).toEqual(["Builds on the Marketplace."]);
    const pyramids = builtCard(state, { city, production: { kind: "wonder", id: "pyramids" }, selected: 1 })!;
    expect(pyramids).toMatchObject({ title: "Wonder Completed", upkeep: 0 });
    expect(pyramids.more.at(-1)).toBe("It stops working with Communism.");
    expect(builtCard(state, { city: 9999, production: { kind: "building", id: "temple" }, selected: 1 })).toBeNull();
    expect(builtCard(state, { city, production: { kind: "unit", id: "settlers" }, selected: 1 })).toBeNull();
  });

  it("draws the window after the user's template, its picture's spot in its frame, its buttons answering clicks", () => {
    const { state, city } = withCity();
    const s = Surface.screen();
    mkdirSync(new URL("./out/", import.meta.url), { recursive: true });
    const shown: [Production["kind"], string][] = [["building", "temple"], ["building", "hydro_plant"], ["wonder", "michelangelos"], ["spaceship", "module"], ["building", "granary"]];
    for (const [kind, id] of shown) {
      s.art = [];
      drawBuilt(s, state, { city, production: { kind, id } as Production, selected: 1 });
      writeFileSync(new URL(`./out/built-${id}.png`, import.meta.url), encodePng(s, 3));
      // The granary has no picture of the user's yet: its drawn one stands in the frame instead.
      expect(s.art).toEqual(id === "granary" ? [] : [{ id, ...BUILT_PICTURE, middle: true }]);
    }
    const view = { city, production: { kind: "building", id: "temple" } as Production, selected: 1 };
    const hits = new Set<string | null>();
    for (let y = 0; y < 200; y++) for (let x = 0; x < 320; x++) hits.add(builtHit(view, x, y));
    expect([...hits].sort()).toEqual(["city", "close", "continue", null].sort());
    expect(builtHit(view, 30, 185)).toBe("city");
    expect(builtHit(view, 290, 185)).toBe("continue");
  });
});
