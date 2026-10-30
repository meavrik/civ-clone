import { mkdirSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { applyCommand, createUnit, newGame, revealAround } from "@civ/core";
import type { ArtBox, MainScreenView } from "@civ/renderer-api";
import { C, DIMMED, drawCityScreen, drawMainScreen, drawSquarePicture, Surface } from "../src/index.js";
import { drawnOver, fineCopy, runHoles } from "../src/art-holes.js";
import { encodePng } from "./png.js";

function founded() {
  const state = newGame(2026);
  const u = state.units[0]!;
  revealAround(state, 0, u.x, u.y, 9);
  applyCommand(state, { type: "found", unit: u.id });
  const city = state.cities[0]!;
  const view: MainScreenView = { originX: u.x - 7, originY: Math.max(0, u.y - 6), blink: false, placeNames: false, civNames: false };
  return { state, city, view, px: 80 + (city.x - view.originX) * 16, py: 9 + (city.y - view.originY) * 16 };
}

const within = (holes: ArtBox[] | undefined, x: number, y: number) => (holes ?? []).some((h) => x >= h.x && x < h.x + h.w && y >= h.y && y < h.y + h.h);

describe("holes in a picture", () => {
  it("are the runs of what was drawn over its place since, rows alike made one box, the dusk's darkening not counted", () => {
    const s = Surface.screen();
    s.rect(0, 0, 320, 200, C.GREEN!);
    const copy = fineCopy(s, 40, 20, 16, 16);
    expect(drawnOver(s, copy)).toEqual([]);
    s.rect(42, 22, 3, 4, C.WHITE!);
    // Darkened only, as fireworks' dusk darkens the map: the same ground.
    for (let x = 0; x < 32; x++) s.fset(80 + x, 40 + 30, DIMMED[C.GREEN!]!);
    expect(drawnOver(s, copy)).toEqual([{ x: 42, y: 22, w: 3, h: 4 }]);
    expect(runHoles(4, 2, 2, 10, 10, (i, j) => i !== 1 && j === 1)).toEqual([{ x: 10, y: 10.5, w: 0.5, h: 0.5 }, { x: 11, y: 10.5, w: 1, h: 0.5 }]);
  });
});

describe("city pictures", () => {
  it("lays the user's picture of a city on its square in place of the icon, by its age and size", () => {
    const { state, city, view, px, py } = founded();
    const s = Surface.screen();
    drawMainScreen(s, state, view);
    mkdirSync(new URL("./out/", import.meta.url), { recursive: true });
    writeFileSync(new URL("./out/city-picture.png", import.meta.url), encodePng(s, 3));
    const spot = s.art.find((a) => a.city);
    // The first city has the Palace: the capital, of the ancient age, inside the map's view.
    expect(spot).toMatchObject({ id: "ancient-capital", city: true, x: px, y: py, w: 16, h: 16, clip: { x: 80, y: 9 } });
    expect(spot!.holes).toBeUndefined();
    expect(spot!.unseen).toBeUndefined();
    // No icon under it: the square is drawn as it would be without the city.
    const bare = Surface.screen();
    drawMainScreen(bare, { ...state, cities: [] }, view);
    for (let y = 2; y < 30; y++) for (let x = 2; x < 30; x++) expect(s.fget(px * 2 + x, py * 2 + y), `${x},${y}`).toBe(bare.fget(px * 2 + x, py * 2 + y));
    // A medieval village once its owner builds in stone and it holds no palace.
    state.players[0]!.advances.push("construction");
    city.buildings = city.buildings.filter((b) => b !== "palace");
    const later = Surface.screen();
    drawMainScreen(later, state, view);
    expect(later.art.find((a) => a.city)?.id).toBe("medieval-village");
  });

  it("lets the walls' front, the garrison's shield and whatever is drawn over the square later show through", () => {
    const { state, city, view, px, py } = founded();
    city.buildings.push("city_walls");
    const guard = createUnit(state, "militia", 0, city.x, city.y);
    let s = Surface.screen();
    drawMainScreen(s, state, view);
    writeFileSync(new URL("./out/city-picture-walls.png", import.meta.url), encodePng(s, 3));
    const holes = () => s.art.find((a) => a.city)!.holes;
    expect(within(holes(), px + 4, py + 15.25)).toBe(true); // the wall's foot
    expect(within(holes(), px + 0.25, py + 12)).toBe(true); // its side
    expect(within(holes(), px + 1.5, py + 1.5)).toBe(true); // the shield
    expect(within(holes(), px + 8, py + 8)).toBe(false); // the town
    // A planned move through the city: the route's dot in its middle shows over the picture.
    s = Surface.screen();
    drawMainScreen(s, state, { ...view, plan: { unit: guard.id, x: city.x + 2, y: city.y, route: [[city.x, city.y], [city.x + 1, city.y], [city.x + 2, city.y]], text: "2 turns" } });
    expect(within(holes(), px + 8, py + 8)).toBe(true);
  });

  it("shades a city's picture out of sight, as its square", () => {
    const { state, city, view } = founded();
    city.owner = 1;
    state.players[0]!.visible[city.y * state.map.width + city.x] = 0;
    const s = Surface.screen();
    drawMainScreen(s, state, view);
    expect(s.art.find((a) => a.city)?.unseen).toBe(true);
  });

  it("shows the picture in the square's window and on the city screen's map, the yields over it showing through", () => {
    const { state, city } = founded();
    const s = Surface.screen();
    drawSquarePicture(s, state, city.x, city.y, 40, 50);
    expect(s.art.filter((a) => a.city)).toEqual([expect.objectContaining({ id: "ancient-capital", x: 40, y: 50, w: 32, h: 32 })]);
    const c = Surface.screen();
    drawCityScreen(c, state, { city: city.id });
    writeFileSync(new URL("./out/city-picture-screen.png", import.meta.url), encodePng(c, 3));
    const spot = c.art.find((a) => a.city)!;
    expect(spot.id).toBe("ancient-capital");
    expect(spot.holes?.length).toBeGreaterThan(0);
  });
});
