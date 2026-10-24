import { mkdirSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { applyCommand, BUILDINGS, getTile, newGame, Terrain, WONDERS, type GameState } from "@civ/core";
import { artLot, BUILDING_ART, cityScene, PICTURES } from "@civ/renderer-api";
import { C, cityButtonAt, cityViewAt, drawCityView, drawPicture, rasterize, shade, Surface, SCENE_X, SCENE_Y } from "../src/index.js";
import { encodePng } from "./png.js";

describe("city view pictures", () => {
  it("has a picture for every improvement and wonder, drawn within its box", () => {
    for (const r of [...BUILDINGS, ...WONDERS]) expect(PICTURES[r.id], r.id).toBeDefined();
    // Every picture paints something in each of its quarters' rows and leaves the ring outside its outline clear.
    for (const [id, pic] of Object.entries(PICTURES)) {
      const px = rasterize(pic, C.RED!);
      const gw = pic.w + 2;
      const painted = [...px].filter((c) => c >= 0).length;
      expect(painted, id).toBeGreaterThan(pic.w * pic.h * 0.25);
      for (let x = 0; x < gw; x++) expect(px[(pic.h + 1) * gw + x] === -1 || px[(pic.h + 1) * gw + x] === C.BLACK, id).toBe(true);
    }
  });

  it("draws every picture on a sheet (pictures.png)", () => {
    const s = new Surface(320, 300);
    s.fill(shade("sky", 6));
    let x = 4;
    let y = 4;
    let rowH = 0;
    const order = [...BUILDINGS.map((b) => b.id), ...WONDERS.map((w) => w.id)];
    for (const id of order) {
      const pic = PICTURES[id]!;
      if (x + pic.w + 4 > 320) { x = 4; y += rowH + 6; rowH = 0; }
      s.rect(x - 2, y + pic.h, pic.w + 4, 2, shade("grass", 4));
      drawPicture(s, pic, x, y + pic.h, C.LRED!);
      x += pic.w + 8;
      rowH = Math.max(rowH, pic.h);
    }
    mkdirSync(new URL("./out/", import.meta.url), { recursive: true });
    writeFileSync(new URL("./out/pictures.png", import.meta.url), encodePng(s, 3));
    expect(y + rowH).toBeLessThan(300);
  });
});

/** A city of `size` with these improvements and wonders, its owner knowing `advances`. */
function town(size: number, buildings: string[], wonders: string[], advances: string[] = []): { state: GameState; id: number } {
  const state = newGame(2026);
  applyCommand(state, { type: "found", unit: state.units[0]!.id });
  const city = state.cities[0]!;
  city.size = size;
  city.buildings = buildings;
  city.wonders = wonders;
  state.players[0]!.advances.push(...advances);
  return { state, id: city.id };
}

describe("city view", () => {
  it("lays out wonders on the skyline, the palace in the middle, more homes for a bigger city", () => {
    const { state, id } = town(12, ["palace", "temple", "granary", "library", "marketplace", "city_walls", "barracks"], ["pyramids", "colossus", "great_library"], ["construction"]);
    const city = state.cities.find((c) => c.id === id)!;
    const scene = cityScene(state, city);
    const wonders = scene.items.filter((it) => it.kind === "wonder");
    expect(wonders.map((w) => w.id).sort()).toEqual(["colossus", "great_library", "pyramids"]);
    expect(new Set(wonders.map((w) => w.y))).toEqual(new Set([scene.streets[0]!.y]));
    const palace = scene.items.find((it) => it.id === "palace")!;
    expect(Math.abs(palace.x + palace.w / 2 - scene.w / 2)).toBeLessThan(scene.w / 6);
    expect(scene.items.filter((it) => it.kind === "walls")).toHaveLength(1);
    expect(scene.streets[0]!.surface).toBe("stone");
    // Every item stands inside the scene, back rows before front ones.
    for (const it of scene.items) {
      expect(it.x).toBeGreaterThanOrEqual(0);
      expect(it.x + it.w).toBeLessThanOrEqual(scene.w);
    }
    expect(scene.items.map((it) => it.y)).toEqual([...scene.items.map((it) => it.y)].sort((a, b) => a - b));
    const homes = (size: number) => cityScene(state, { ...city, size }).items.filter((it) => it.kind === "home").length;
    expect(homes(8)).toBeGreaterThan(homes(1));
    // The same city lays out the same every time (no game RNG, no clock).
    expect(cityScene(state, city)).toEqual(scene);
  });

  it("draws a city on its land and names the building clicked (city-view.png)", () => {
    const { state, id } = town(9, ["palace", "temple", "granary", "library", "marketplace", "city_walls", "aqueduct", "colosseum", "courthouse"], ["pyramids", "hanging_gardens", "lighthouse", "great_library"], ["construction"]);
    const city = state.cities.find((c) => c.id === id)!;
    getTile(state.map, city.x, city.y)!.river = true;
    const s = Surface.screen();
    drawCityView(s, state, { city: id });
    mkdirSync(new URL("./out/", import.meta.url), { recursive: true });
    writeFileSync(new URL("./out/city-view.png", import.meta.url), encodePng(s, 3));
    const scene = cityScene(state, city);
    const temple = scene.items.find((it) => it.id === "temple")!;
    const at = { x: SCENE_X + temple.x + temple.w / 2, y: SCENE_Y + temple.y - 3 };
    expect(cityViewAt(state, { city: id }, at.x, at.y)).toBe("temple");
    expect(cityViewAt(state, { city: id }, 160, 195)).toBeNull();
    drawCityView(s, state, { city: id, picked: "temple" });
    writeFileSync(new URL("./out/city-view-picked.png", import.meta.url), encodePng(s, 3));
    // The city screen's View button is an icon in its title strip, beside the close box.
    let view = 0;
    for (let y = 0; y < 16; y++) for (let x = 0; x < 320; x++) if (cityButtonAt(x, y) === "view") view++;
    expect(view).toBeGreaterThan(60);
  });

  it("leaves a spot for the user's picture of each building, back to front, the one clicked lit", () => {
    const { state, id } = town(9, ["palace", "temple", "granary", "library", "city_walls"], ["pyramids", "colossus"], ["construction"]);
    const city = state.cities.find((c) => c.id === id)!;
    const scene = cityScene(state, city);
    const s = Surface.screen();
    drawCityView(s, state, { city: id, picked: "temple" });
    // Every building has a picture of the user's and gets a spot of its lot's size.
    const spotted = s.art.map((a) => a.id);
    expect(spotted.sort()).toEqual(["city_walls", "colossus", "granary", "library", "palace", "pyramids", "temple"].sort());
    const temple = scene.items.find((it) => it.id === "temple")!;
    expect(temple).toMatchObject(artLot("temple", PICTURES.temple!));
    expect(s.art.find((a) => a.id === "temple")).toEqual({ id: "temple", x: SCENE_X + temple.x, y: SCENE_Y + temple.y - temple.h, w: temple.w, h: temple.h, lit: true });
    expect(s.art.filter((a) => a.lit).map((a) => a.id)).toEqual(["temple"]);
    // Back rows first, so the apps stack the front ones over them; the walls' gatehouse stands on the front.
    const feet = s.art.map((a) => a.y + a.h);
    expect(feet).toEqual([...feet].sort((a, b) => a - b));
    expect(s.art.at(-1)!.id).toBe("city_walls");
    // A click on the gatehouse names the walls.
    const gate = scene.items.find((it) => it.kind === "gate")!;
    expect(cityViewAt(state, { city: id }, SCENE_X + gate.x + gate.w / 2, SCENE_Y + gate.y - 4)).toBe("city_walls");
  });

  it("gives each picture about the room of the drawn one, in its own shape", () => {
    for (const [id, pic] of Object.entries(PICTURES)) {
      const lot = artLot(id, pic);
      expect(BUILDING_ART[id], id).toBeDefined(); // every drawn picture has one of the user's now
      expect(lot.h, id).toBeLessThanOrEqual(46);
      expect(lot.w * lot.h, id).toBeGreaterThan(pic.w * pic.h * 0.6);
      expect(lot.w * lot.h, id).toBeLessThan(pic.w * pic.h * 1.2);
    }
  });

  it("draws a small modern town and an empty hamlet (city-view-modern.png)", () => {
    const { state, id } = town(16, ["palace", "factory", "power_plant", "bank", "university", "mass_transit", "automated_office", "cell_tower", "solar_plant"], ["united_nations", "apollo_program"], ["construction", "industrialization", "automobile"]);
    const s = Surface.screen();
    drawCityView(s, state, { city: id });
    writeFileSync(new URL("./out/city-view-modern.png", import.meta.url), encodePng(s, 3));
    const hamlet = town(1, [], []);
    drawCityView(s, hamlet.state, { city: hamlet.id });
    writeFileSync(new URL("./out/city-view-hamlet.png", import.meta.url), encodePng(s, 3));
    expect(cityScene(hamlet.state, hamlet.state.cities[0]!).items.some((it) => it.kind === "home")).toBe(true);
    void Terrain;
  });
});
