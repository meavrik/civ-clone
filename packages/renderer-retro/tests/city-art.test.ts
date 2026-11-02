import { mkdirSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { applyCommand, createUnit, getTile, newGame, revealAround, Terrain } from "@civ/core";
import { artPlace, fieldsPicture, hutKind, minePicture, pierSquare, type ArtBox, type MainScreenView } from "@civ/renderer-api";
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

describe("village pictures", () => {
  function withVillage() {
    const { state, view, city } = founded();
    state.cities = [];
    const me = state.players[0]!;
    // A village on explored land in sight, away from the settlers' city.
    const at = { x: city.x + 3, y: city.y + 2 };
    const tile = getTile(state.map, at.x, at.y)!;
    Object.assign(tile, { terrain: Terrain.Desert, hut: true, special: false, river: false, road: false });
    me.visible[at.y * state.map.width + at.x] = 1;
    return { state, view, at, px: 80 + (at.x - view.originX) * 16, py: 9 + (at.y - view.originY) * 16 };
  }

  it("lays the user's picture of a village of the land's kind on its square in place of the drawn huts", () => {
    const { state, view, at, px, py } = withVillage();
    const s = Surface.screen();
    drawMainScreen(s, state, view);
    writeFileSync(new URL("./out/village-picture.png", import.meta.url), encodePng(s, 3));
    const spot = s.art.find((a) => a.hut && a.x === px && a.y === py);
    expect(spot).toMatchObject({ id: hutKind(state.map, at.x, at.y), hut: true, w: 16, h: 16, clip: { x: 80, y: 9 } });
    expect(["adobe", "tent"]).toContain(spot!.id);
    expect(spot!.unseen).toBeUndefined();
    // No drawn huts under it: the square is drawn as it would be without the village.
    const bare = Surface.screen();
    getTile(state.map, at.x, at.y)!.hut = false;
    drawMainScreen(bare, state, view);
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) expect(s.fget(px * 2 + x, py * 2 + y), `${x},${y}`).toBe(bare.fget(px * 2 + x, py * 2 + y));
    // It stands inside its square on the square's foot, smaller than the square.
    const box = artPlace(spot!)!;
    expect(box.x).toBeGreaterThan(px);
    expect(box.x + box.w).toBeLessThan(px + 16);
    expect(box.y + box.h).toBeCloseTo(py + 16 - 0.5);
    expect(box.w).toBeLessThan(12);
  });

  it("is shaded whole out of sight, the shade making no holes, and what is drawn over it later shows through", () => {
    const { state, view, at, px, py } = withVillage();
    state.players[0]!.visible[at.y * state.map.width + at.x] = 0;
    const s = Surface.screen();
    drawMainScreen(s, state, view);
    const spot = s.art.find((a) => a.hut && a.x === px && a.y === py)!;
    expect(spot.unseen).toBe(true);
    expect(spot.holes).toBeUndefined();
    // A planned route's dot over the square shows over the picture.
    const routed = Surface.screen();
    drawMainScreen(routed, state, { ...view, plan: { unit: state.units[0]!.id, x: at.x + 1, y: at.y, route: [[at.x, at.y], [at.x + 1, at.y]], text: "1 turn" } });
    const dotted = routed.art.find((a) => a.hut && a.x === px && a.y === py)!;
    expect(dotted.holes?.length).toBeGreaterThan(0);
    expect(within(dotted.holes, px + 8, py + 8)).toBe(true);
  });

  it("grows with the square's window, the kind the same as on the map", () => {
    const { state, at } = withVillage();
    const s = Surface.screen();
    drawSquarePicture(s, state, at.x, at.y, 100, 50);
    expect(s.art.filter((a) => a.hut)).toEqual([expect.objectContaining({ id: hutKind(state.map, at.x, at.y), x: 100, y: 50, w: 16 * 2, h: 16 * 2 })]);
  });

  it("are of a kind for the land, alike on the same square every time, every kind somewhere", () => {
    const { map } = newGame(4);
    const seen = new Set<string>();
    for (let y = 0; y < map.height; y++)
      for (let x = 0; x < map.width; x++) {
        const t = map.tiles[y * map.width + x]!.terrain;
        if (t === Terrain.Ocean) continue;
        const kind = hutKind(map, x, y);
        expect(hutKind(map, x + map.width, y)).toBe(kind);
        seen.add(kind);
        if (t === Terrain.Desert) expect(["adobe", "tent"]).toContain(kind);
        if (t === Terrain.Forest) expect(["timber", "cottage"]).toContain(kind);
        if (t === Terrain.Arctic) expect(kind).toBe("tent");
      }
    expect([...seen].sort()).toEqual(["adobe", "cottage", "tent", "thatch", "timber"]);
  });
});

describe("tile improvement pictures", () => {
  it("lay oil with a road as a pump, a net under the fish, a pier on the sea beside a Harbour's city", () => {
    const { state, view, city } = founded();
    const me = state.players[0]!;
    const sq = (dx: number, dy: number) => getTile(state.map, city.x + dx, city.y + dy)!;
    const box = (dx: number, dy: number) => ({ x: 80 + (city.x + dx - view.originX) * 16, y: 9 + (city.y + dy - view.originY) * 16 });
    // Oil on land, seen (Refining), with a road built to it.
    me.advances.push("refining");
    Object.assign(sq(2, 0), { terrain: Terrain.Plains, deposit: "Oil", special: true, road: false, river: false, rig: false, hut: false });
    // A fishery on the sea, with its fish.
    Object.assign(sq(0, 2), { terrain: Terrain.Ocean, special: true, fishery: true, deposit: undefined, hut: false });
    for (const [dx, dy] of [[0, 1], [1, 1], [-1, 1], [1, 0], [-1, 0]] as const) Object.assign(sq(dx, dy), { terrain: Terrain.Grassland, river: false });
    Object.assign(sq(0, 1), { terrain: Terrain.Ocean, special: false, fishery: false, hut: false });
    const draw = () => { const s = Surface.screen(); drawMainScreen(s, state, view); return s; };
    const at = (s: Surface, dx: number, dy: number) => s.art.find((a) => a.work && a.x === box(dx, dy).x && a.y === box(dx, dy).y);
    let s = draw();
    expect(at(s, 2, 0)).toBeUndefined();
    sq(2, 0).road = true;
    s = draw();
    expect(at(s, 2, 0)?.id).toBe("oil_pump");
    // The net lies under the fish: the fish's icon shows through it.
    const net = at(s, 0, 2)!;
    expect(net.id).toBe("fishing_net");
    expect(net.holes?.length).toBeGreaterThan(0);
    // No Harbour, no pier; with one, a pier on the sea beside it, the sides before the corners.
    expect(s.art.some((a) => a.id === "pier")).toBe(false);
    city.buildings.push("harbour");
    s = draw();
    expect(at(s, 0, 1)?.id).toBe("pier");
    expect(pierSquare(state.map, city, () => true)).toEqual([city.x, city.y + 1]);
    city.buildings = city.buildings.filter((b) => b !== "harbour");
    expect(pierSquare(state.map, city, () => true)).toBeNull();
  });

  it("are fields of a kind for the land, mines a shaft or a quarry", () => {
    const { map } = newGame(4);
    for (let y = 0; y < map.height; y++)
      for (let x = 0; x < map.width; x++) {
        const t = map.tiles[y * map.width + x]!;
        const f = fieldsPicture(map, x, y, t);
        if (t.river) expect(f).toBe("fields_irrigated");
        else if (t.terrain === Terrain.Plains) expect(["fields_wheat", "fields_crops"]).toContain(f);
        else if (t.terrain === Terrain.Desert) expect(["fields_ploughed", "fields_wheat"]).toContain(f);
        else if (t.terrain === Terrain.Tundra) expect(f).toBe("fields_ploughed");
      }
    expect(minePicture(Terrain.Mountains)).toBe("quarry");
    expect(minePicture(Terrain.Hills)).toBe("mine");
    expect(minePicture(Terrain.Desert)).toBe("mine");
  });
});
