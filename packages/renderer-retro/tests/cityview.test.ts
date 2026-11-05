import { mkdirSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { applyCommand, BUILDINGS, costFor, getTile, newGame, Terrain, WONDERS, type GameState } from "@civ/core";
import { artLot, artPlace, buildingArt, BUILDING_CUTS, BUILDING_PICTURES_WANTED, cityScene, fieldKinds, HOUSE_ART, HOUSES, houseChoices, isoU, isoV, PICTURES, pickHouse, sceneItemAt, townTerrain, wonderRise, wonderSite, wonderStages, type CityScene } from "@civ/renderer-api";
import { C, cityButtonAt, cityViewAt, drawCityView, drawPicture, hideArtUnder, rasterize, shade, Surface, SCENE_X, SCENE_Y, terrainPieces } from "../src/index.js";
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

/** A city with these squares round it, plain grassland otherwise, all of it known. */
function placed(size: number, buildings: string[], wonders: string[], squares: [number, number, Partial<{ terrain: Terrain; river: boolean; road: boolean; irrigation: boolean; mine: boolean }>][], advances: string[] = []) {
  const made = town(size, buildings, wonders, advances);
  const city = made.state.cities[0]!;
  made.state.players[0]!.explored.fill(1);
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) Object.assign(getTile(made.state.map, city.x + dx, city.y + dy)!, { terrain: Terrain.Grassland, river: false, road: false, irrigation: false, mine: false });
  for (const [dx, dy, p] of squares) Object.assign(getTile(made.state.map, city.x + dx, city.y + dy)!, p);
  return { ...made, city };
}

/** A point of the picture of `id` that nothing stands in front of, to click on. */
function openPoint(scene: CityScene, id: string): { x: number; y: number } {
  const it = scene.items.find((i) => i.id === id)!;
  for (let y = it.y - it.h; y < it.y; y++)
    for (let x = it.x; x < it.x + it.w; x++) if (sceneItemAt(scene, x + 0.5, y + 0.5)?.id === id) return { x: x + 0.5, y: y + 0.5 };
  throw new Error(`nowhere to click on ${id}`);
}

describe("city view", () => {
  it("lays out a town round its crossroads: the palace at its heart, wonders behind, walls round it, more homes for a bigger city", () => {
    const { state, city } = placed(12, ["palace", "temple", "granary", "library", "marketplace", "city_walls", "barracks"], ["pyramids", "colossus", "great_library"], [], ["construction"]);
    const scene = cityScene(state, city);
    const wonders = scene.items.filter((it) => it.kind === "wonder");
    expect(wonders.map((w) => w.id).sort()).toEqual(["colossus", "great_library", "pyramids"]);
    const palace = scene.items.find((it) => it.id === "palace")!;
    expect(Math.abs(palace.x + palace.w / 2 - scene.w / 2)).toBeLessThan(scene.w / 6);
    expect(Math.abs(palace.y - scene.h * 0.55)).toBeLessThan(scene.h / 6);
    // The first wonders stand behind the palace, against the back of the town.
    expect(Math.min(...wonders.map((w) => w.y))).toBeLessThan(palace.y);
    expect(scene.items.filter((it) => it.kind === "gate")).toHaveLength(1);
    expect(scene.items.filter((it) => it.kind === "walls").length).toBeGreaterThan(20);
    expect(scene.streets[0]!.surface).toBe("stone");
    // Everything built stands inside the scene, back to front.
    for (const it of scene.items) {
      if (it.kind === "tree" || it.kind === "peak" || it.kind === "mound" || it.kind === "walls") continue;
      expect(it.x, it.id).toBeGreaterThanOrEqual(0);
      expect(it.x + it.w, it.id).toBeLessThanOrEqual(scene.w);
      expect(it.y - it.h, it.id).toBeGreaterThanOrEqual(0);
      expect(it.y, it.id).toBeLessThan(scene.h);
    }
    expect(scene.items.map((it) => it.y)).toEqual([...scene.items.map((it) => it.y)].sort((a, b) => a - b));
    const homes = (size: number) => cityScene(state, { ...city, size }).items.filter((it) => it.kind === "home").length;
    expect(homes(8)).toBeGreaterThan(homes(1));
    // The same city lays out the same every time (no game RNG, no clock).
    expect(cityScene(state, { ...city })).toEqual(scene);
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
    const at = openPoint(scene, "temple");
    expect(cityViewAt(state, { city: id }, SCENE_X + at.x, SCENE_Y + at.y)).toBe("temple");
    expect(cityViewAt(state, { city: id }, 160, 195)).toBeNull();
    expect(temple.kind).toBe("building");
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
    const spotted = s.art.filter((a) => !a.house && !a.work).map((a) => a.id);
    expect(spotted.sort()).toEqual(["city_walls", "colossus", "granary", "library", "palace", "pyramids", "temple"].sort());
    const temple = scene.items.find((it) => it.id === "temple")!;
    // An improvement stands a little under its room, a wonder at its sheet's size.
    const room = artLot("temple", PICTURES.temple!);
    expect(temple.w).toBe(Math.round(room.w * 0.9));
    expect(temple.h).toBe(Math.round(room.h * 0.9));
    expect(s.art.find((a) => a.id === "temple")).toMatchObject({ id: "temple", x: SCENE_X + temple.x, y: SCENE_Y + temple.y - temple.h, w: temple.w, h: temple.h, lit: true });
    expect(s.art.filter((a) => a.lit).map((a) => a.id)).toEqual(["temple"]);
    // Back to front, so the apps stack the nearer ones over the rest; the walls' gatehouse stands nearest of all.
    const feet = s.art.filter((a) => !a.work).map((a) => a.y + a.h);
    expect(feet).toEqual([...feet].sort((a, b) => a - b));
    expect(s.art.at(-1)!.id).toBe("city_walls");
    // A click on the gatehouse names the walls.
    const gate = scene.items.find((it) => it.kind === "gate")!;
    expect(cityViewAt(state, { city: id }, SCENE_X + gate.x + gate.w / 2, SCENE_Y + gate.y - 4)).toBe("city_walls");
  });

  it("gives each picture about the room of the drawn one, in its own shape", () => {
    for (const [id, pic] of Object.entries(PICTURES)) {
      const lot = artLot(id, pic);
      // Every drawn picture has one of the user's now, but any still to come, which stand as drawn.
      if (BUILDING_PICTURES_WANTED.includes(id)) { expect(buildingArt(id), id).toBeNull(); expect(lot).toEqual({ w: pic.w, h: pic.h }); continue; }
      expect(buildingArt(id), id).not.toBeNull();
      expect(lot.h, id).toBeLessThanOrEqual(46);
      if (wonderStages(id).length) continue; // one scale for a sheet's wonders, below
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
  });
});

describe("a wonder going up", () => {
  const raising = (id = "pyramids") => {
    const made = town(9, ["palace"], [], ["masonry"]);
    const city = made.state.cities.find((c) => c.id === made.id)!;
    city.production = { kind: "wonder", id };
    delete city.choosing;
    return { ...made, city };
  };

  it("has a start and a construction picture the size of the finished one, for every wonder", () => {
    for (const { id } of WONDERS) {
      expect(wonderStages(id)).toEqual([`${id}-start`, `${id}-construction`]);
      for (const stage of wonderStages(id)) expect(BUILDING_CUTS[stage], stage).toEqual(BUILDING_CUTS[id]);
    }
    expect(wonderStages("structural")).toEqual([]);
  });

  it("shows the start until half its shields are in, then the construction, whatever the owner pays", () => {
    const { state, city } = raising();
    const cost = costFor(state, city.owner, city.production);
    const art = (shields: number) => { city.shields = shields; return wonderSite(state, city)?.art; };
    expect(art(0)).toBe("pyramids-start");
    expect(art(Math.ceil(cost / 2) - 1)).toBe("pyramids-start");
    expect(art(Math.ceil(cost / 2))).toBe("pyramids-construction");
    expect(art(cost)).toBe("pyramids-construction"); // bought, it stands next turn
  });

  it("stands on the lot it will take finished, among the wonders, its stage laid in place of the finished picture", () => {
    const { state, city, id } = raising();
    city.wonders.push("colossus");
    city.shields = 0;
    const scene = cityScene(state, city);
    const site = scene.items.find((it) => it.id === "pyramids")!;
    expect(site).toMatchObject({ kind: "wonder", site: "pyramids-start" });
    const s = Surface.screen();
    drawCityView(s, state, { city: id, picked: "pyramids" });
    expect(s.art.find((a) => a.id === "pyramids-start")).toMatchObject({ id: "pyramids-start", x: SCENE_X + site.x, y: SCENE_Y + site.y - site.h, w: site.w, h: site.h, lit: true });
    expect(s.art.some((a) => a.id === "pyramids")).toBe(false);
    // Clicked, it is named as under way, not by what it will do.
    const open = openPoint(scene, "pyramids");
    expect(cityViewAt(state, { city: id }, SCENE_X + open.x, SCENE_Y + open.y)).toBe("pyramids");
    // Finished, nothing moves.
    city.wonders.push("pyramids");
    const done = cityScene(state, city).items.find((it) => it.id === "pyramids")!;
    expect(done.site).toBeUndefined();
    expect({ x: done.x, y: done.y, w: done.w, h: done.h }).toEqual({ x: site.x, y: site.y, w: site.w, h: site.h });
  });

  it("is not shown once it stands, while the city only holds it for a choice, or without stages", () => {
    const { state, city } = raising();
    expect(wonderSite(state, city)).not.toBeNull();
    city.choosing = true;
    expect(wonderSite(state, city)).toBeNull();
    delete city.choosing;
    city.wonders.push("pyramids"); // its own, kept as its production
    expect(wonderSite(state, city)).toBeNull();
    expect(cityScene(state, city).items.filter((it) => it.id === "pyramids").length).toBe(1);
    city.wonders.pop();
    state.cities.push({ ...city, id: city.id + 1000, wonders: ["pyramids"] }); // finished first elsewhere
    expect(wonderSite(state, city)).toBeNull();
    expect(cityScene(state, city).items.some((it) => it.id === "pyramids")).toBe(false);
    state.cities.pop();
    city.production = { kind: "wonder", id: "yet_to_come" }; // one added later, its sheet still to come
    expect(wonderSite(state, city)).toBeNull();
    expect(cityScene(state, city).items.some((it) => it.id === "yet_to_come")).toBe(false);
  });

  it("goes up in fast forward as it is completed, each stage rising in the place of the one before", () => {
    expect(wonderRise("yet_to_come", 0.5)).toBeNull();
    expect(wonderRise("colossus", 0)).toEqual([{ art: "colossus-start", reveal: 0, cleared: 0 }]);
    expect(wonderRise("colossus", 1 / 6)![0]).toMatchObject({ art: "colossus-start", cleared: 0 });
    const mid = wonderRise("colossus", 0.5)!;
    expect(mid.map((l) => l.art)).toEqual(["colossus-start", "colossus-construction"]);
    expect(mid[0]!.cleared).toBeCloseTo(0.5);
    expect(mid[1]!.reveal).toBeCloseTo(0.5);
    const late = wonderRise("colossus", 5 / 6)!;
    expect(late.map((l) => l.art)).toEqual(["colossus-construction", "colossus"]);
    expect(wonderRise("colossus", 1)).toEqual([{ art: "colossus", reveal: 1, cleared: 0 }]);
    // On the screen: the stage going under holds only what lies above the line the next has reached.
    const { state, id: cityId, city } = raising("colossus");
    city.wonders.push("colossus");
    const it = cityScene(state, city).items.find((i) => i.id === "colossus")!;
    const s = Surface.screen();
    drawCityView(s, state, { city: cityId, rising: { id: "colossus", reveal: 0.5, sparkle: 0 } });
    const [under, over] = s.art.filter((a) => a.id.startsWith("colossus"));
    expect(under).toMatchObject({ id: "colossus-start", clip: { y: SCENE_Y + it.y - it.h, h: it.h / 2 } });
    expect(over).toMatchObject({ id: "colossus-construction", reveal: 0.5 });
  });

  it("keeps the wonders at one scale, none past the tallest building", () => {
    const lots = WONDERS.map(({ id }) => ({ id, ...artLot(id, PICTURES[id]!), cut: BUILDING_CUTS[id]! }));
    const scale = Math.max(...lots.map((l) => l.h / l.cut[1]));
    for (const l of lots) {
      expect(l.h, l.id).toBeLessThanOrEqual(46);
      expect(Math.abs(l.h - l.cut[1] * scale), l.id).toBeLessThan(1); // rounded to whole pixels
    }
    expect(Math.max(...lots.map((l) => l.h))).toBe(46);
    expect(lots.find((l) => l.id === "colossus")!.h).toBeGreaterThan(40); // not brought down to a temple's size
  });
});

describe("the town's houses", () => {
  const kinds = (known: string[], age: number, size: number, ground = Terrain.Grassland) => houseChoices(known, age, size, ground).map((c) => c.rule.id);

  it("has a house's picture for every rule, and no rule without one", () => {
    expect(Object.keys(HOUSE_ART).sort()).toEqual(HOUSES.map((h) => h.id).sort());
    expect(HOUSES.filter((h) => h.age === 0).length + HOUSES.filter((h) => h.age === 3).length).toBe(12);
    for (const h of HOUSES) expect(h.text.length, h.id).toBeLessThan(50); // it shares the bar with its name and Back
  });

  it("goes by the advances: a new one brings its house", () => {
    expect(kinds([], 0, 12)).toEqual(["round_hut", "fishers_hut"]);
    expect(kinds(["pottery"], 0, 12)).toEqual(expect.arrayContaining(["white_cottage", "potters_yard"]));
    expect(kinds(["masonry"], 0, 12)).toContain("stone_cottage");
    expect(kinds(["pottery"], 0, 12)).not.toContain("stone_cottage");
  });

  it("goes by the city's size: shops want customers, tenements a crowd", () => {
    const known = ["trade", "industrialization", "pottery"];
    expect(kinds(known, 2, 3)).not.toContain("bakery");
    expect(kinds(known, 2, 4)).toContain("bakery");
    expect(kinds(known, 2, 7)).not.toContain("tenement");
    expect(kinds(known, 2, 8)).toContain("tenement");
  });

  it("goes by the time: each age back counts for less, and the oldest go", () => {
    const weight = (age: number, id: string) => houseChoices([], age, 12, Terrain.Grassland).find((c) => c.rule.id === id)?.weight ?? 0;
    expect(weight(1, "round_hut")).toBeLessThan(weight(0, "round_hut"));
    expect(weight(2, "round_hut")).toBeLessThan(weight(1, "round_hut"));
    expect(weight(3, "round_hut")).toBe(0);
  });

  it("goes by the land: adobe on dry ground, a mossy cottage on wet", () => {
    const known = ["construction"];
    expect(kinds(known, 1, 9, Terrain.Desert)).toContain("adobe_house");
    expect(kinds(known, 1, 9, Terrain.Desert)).not.toContain("mossy_cottage");
    expect(kinds(known, 1, 9, Terrain.Swamp)).toContain("mossy_cottage");
    expect(kinds(known, 1, 9, Terrain.Swamp)).not.toContain("adobe_house");
  });

  it("keeps a fisher's hut to the water", () => {
    const choices = houseChoices([], 0, 5, Terrain.Grassland);
    const dry = Array.from({ length: 300 }, (_, lot) => pickHouse(choices, lot, 7, { heart: false, water: false }).id);
    const wet = Array.from({ length: 300 }, (_, lot) => pickHouse(choices, lot, 7, { heart: false, water: true }).id);
    expect(dry).not.toContain("fishers_hut");
    expect(wet).toContain("fishers_hut");
  });

  it("changes house by house: a lot keeps its house when a new kind comes, unless the new kind takes it", () => {
    const at = { heart: false, water: false };
    const before = houseChoices(["pottery", "masonry"], 0, 6, Terrain.Grassland);
    const after = houseChoices(["pottery", "masonry", "currency"], 0, 6, Terrain.Grassland);
    let changed = 0;
    for (let lot = 0; lot < 400; lot++) {
      const a = pickHouse(before, lot, 11, at).id, b = pickHouse(after, lot, 11, at).id;
      if (a !== b) { expect(b).toBe("courtyard_house"); changed++; }
    }
    expect(changed).toBeGreaterThan(0);
    expect(changed).toBeLessThan(200);
  });

  it("mixes the ages in a town, and thins out the old as the people's means grow", () => {
    const share = (age: number, known: string[]) => {
      const choices = houseChoices(known, age, 12, Terrain.Grassland);
      const picks = Array.from({ length: 600 }, (_, lot) => pickHouse(choices, lot, 3, { heart: false, water: false }));
      return { old: picks.filter((h) => h.age === 0).length, kinds: new Set(picks.map((h) => h.id)).size };
    };
    const ancient = ["pottery", "masonry", "currency"];
    const middle = share(1, [...ancient, "construction", "trade", "iron_working"]);
    const late = share(2, [...ancient, "construction", "trade", "iron_working", "invention", "industrialization", "banking", "engineering", "railroad"]);
    expect(middle.old).toBeLessThan(share(0, ancient).old);
    expect(late.old).toBeLessThan(middle.old);
    expect(late.old).toBeGreaterThan(0);
    expect(late.kinds).toBeGreaterThan(8);
  });

  it("stands houses on the town's lots, and a click on one names it along the bar", () => {
    const { state, id } = town(9, ["palace"], [], ["construction", "pottery", "masonry"]);
    const city = state.cities.find((c) => c.id === id)!;
    const scene = cityScene(state, city);
    const houses = scene.items.filter((it) => it.kind === "home");
    expect(houses.length).toBe(2 + Math.round(9 * 1.5));
    expect(new Set(houses.map((h) => h.id)).size).toBe(houses.length); // each its own, by its lot
    const s = Surface.screen();
    drawCityView(s, state, { city: id });
    const spots = s.art.filter((a) => a.house);
    expect(spots.length).toBe(houses.length);
    for (const a of spots) expect(artPlace(a)).toEqual({ x: a.x, y: a.y, w: a.w, h: a.h });
    // Named when clicked, that house alone lit.
    const front = houses.at(-1)!;
    const at = openPoint(scene, front.id);
    const picked = cityViewAt(state, { city: id }, SCENE_X + at.x, SCENE_Y + at.y)!;
    expect(picked).toBe(front.id);
    s.art = [];
    drawCityView(s, state, { city: id, picked });
    expect(s.art.filter((a) => a.lit).map((a) => a.id)).toEqual([front.house]);
  });
});

describe("the town's room", () => {
  const foot = (it: { x: number; y: number; w: number }) => ({ u: isoU(it.x + it.w / 2, it.y - it.w / 4), v: isoV(it.x + it.w / 2, it.y - it.w / 4) });

  it("stands its houses apart, each on a lot wider than it is, with gardens between them", () => {
    const { state, city } = placed(24, ["palace", "temple", "library", "granary"], [], [], ["construction", "pottery", "masonry", "trade", "industrialization", "automobile"]);
    const scene = cityScene(state, city);
    const houses = scene.items.filter((it) => it.kind === "home");
    expect(houses.length).toBe(2 + 24 * 1.5);
    for (const h of houses) expect(h.w, h.id).toBeLessThanOrEqual(16); // a lot is 18 across
    // No two nearer than a lot and a little, either way along the town's axes.
    for (let i = 0; i < houses.length; i++)
      for (let j = i + 1; j < houses.length; j++) {
        const a = foot(houses[i]!), b = foot(houses[j]!);
        expect(Math.max(Math.abs(a.u - b.u), Math.abs(a.v - b.v)), `${houses[i]!.id} ${houses[j]!.id}`).toBeGreaterThan(1.1);
      }
    // Gardens: no block is built on all four lots.
    const perBlock = new Map<string, number>();
    for (const it of scene.items.filter((i) => i.kind === "home" || (i.kind === "building" && i.w <= 20))) {
      const f = foot(it);
      const key = `${Math.floor(f.u / 2.8)},${Math.floor(f.v / 2.8)}`;
      perBlock.set(key, (perBlock.get(key) ?? 0) + 1);
    }
    expect(Math.max(...perBlock.values())).toBeLessThanOrEqual(3);
  });

  it("walls a small town snugly, and leaves the mountains out of it", () => {
    const { state, city } = placed(9, ["palace", "temple", "city_walls"], [], [[1, 0, { terrain: Terrain.Mountains }], [0, -1, { terrain: Terrain.Mountains }], [1, -1, { terrain: Terrain.Mountains }], [1, 1, { terrain: Terrain.Mountains }], [0, 1, { terrain: Terrain.Hills }]]);
    const scene = cityScene(state, city);
    const walls = scene.items.filter((it) => it.wall).map((it) => it.wall!);
    const reach = Math.max(...walls.map((w) => w.u1));
    expect(reach).toBeLessThan(6);
    const peaks = scene.items.filter((it) => it.kind === "peak");
    expect(peaks.length).toBeGreaterThan(1);
    const built = scene.items.filter((it) => it.kind === "home" || it.kind === "building" || it.kind === "gate");
    for (const p of peaks) {
      const at = foot({ x: p.x, y: p.y + p.w / 4, w: p.w });
      expect(Math.max(Math.abs(at.u), Math.abs(at.v)), "inside the walls").toBeGreaterThan(reach);
      // No peak stands in front of anything built.
      for (const b of built) if (b.y <= p.y) expect(b.x >= p.x + p.w || b.x + b.w <= p.x || b.y <= p.y - p.h, `${b.id} behind a peak`).toBe(true);
    }
  });

  it("keeps a walled town's big buildings inside its walls while there is room", () => {
    const { state, city } = placed(13, ["palace", "temple", "granary", "library", "marketplace", "city_walls", "colosseum", "courthouse", "barracks", "cathedral"], ["pyramids"], []);
    const scene = cityScene(state, city);
    const reach = Math.max(...scene.items.filter((it) => it.wall).map((it) => it.wall!.u1));
    for (const it of scene.items.filter((i) => i.kind === "building" || i.kind === "wonder")) {
      const at = foot(it);
      expect(Math.max(Math.abs(at.u), Math.abs(at.v)), it.id).toBeLessThan(reach);
    }
  });

  it("lays fields out as plots on the town's axes, clear of what is built, by what suits the land", () => {
    const { state, city } = placed(6, ["temple"], [], [[-1, 0, { terrain: Terrain.Plains, irrigation: true }], [0, 1, { terrain: Terrain.Grassland, irrigation: true, river: true }], [1, 0, { terrain: Terrain.Desert }]]);
    const scene = cityScene(state, city);
    expect(scene.fields.length).toBeGreaterThan(9);
    // Each plot grows what suits its square: a river's has canals among them, plains no canals.
    const inSquare = (f: { u0: number; v0: number }, dx: number, dy: number) => Math.abs(f.u0 + 1.25 - dx * 9) < 4.5 && Math.abs(f.v0 + 1.25 - dy * 9) < 4.5;
    const plains = scene.fields.filter((f) => inSquare(f, -1, 0)), wet = scene.fields.filter((f) => inSquare(f, 0, 1));
    expect(plains.length).toBeGreaterThan(3);
    for (const f of plains) expect(fieldKinds({ terrain: Terrain.Plains, river: false })).toContain(f.id);
    expect(wet.some((f) => f.id === "fields_irrigated")).toBe(true);
    for (const f of scene.fields) {
      expect(f.u1 - f.u0).toBeCloseTo(2.5);
      expect(f.v1 - f.v0).toBeCloseTo(2.5);
    }
    // No plot under a house, and none over another.
    for (const it of scene.items.filter((i) => i.kind === "home")) {
      const at = foot(it);
      expect(scene.fields.some((f) => at.u > f.u0 && at.u < f.u1 && at.v > f.v0 && at.v < f.v1), it.id).toBe(false);
    }
    scene.fields.forEach((a, i) => scene.fields.slice(i + 1).forEach((b) => expect(a.u1 <= b.u0 || b.u1 <= a.u0 || a.v1 <= b.v0 || b.v1 <= a.v0).toBe(true)));
    // They are the ground: no picture is laid for them.
    const s = Surface.screen();
    drawCityView(s, state, { city: city.id });
    expect(s.art.some((a) => a.id.startsWith("fields_"))).toBe(false);
  });

  it("draws the land from the terrain sheet: its colour under foot, its own tufts and trees", () => {
    const grass = terrainPieces("grassland");
    expect(grass.pieces.some((p) => p.n <= 60 && !p.edge)).toBe(true);
    const woods = terrainPieces("forest_pine").pieces.filter((p) => p.h >= 12 && p.w >= 8);
    expect(woods.length).toBeGreaterThan(0);
    // A piece is the sprite's own pixels: nothing of the ground's colour, each pixel in the sheet's palette.
    for (const p of woods) { expect(p.px.length).toBe(p.w * p.h); expect([...p.px].filter((c) => c >= 0).length).toBe(p.n); }
    const { state, city } = placed(2, [], [], []);
    const s = Surface.screen();
    drawCityView(s, state, { city: city.id });
    const seen = new Map<number, number>();
    for (let y = SCENE_Y * 2; y < (SCENE_Y + 174) * 2; y++) for (let x = SCENE_X * 2; x < (SCENE_X + 316) * 2; x++) { const c = s.fget(x, y); seen.set(c, (seen.get(c) ?? 0) + 1); }
    expect([...seen.entries()].sort((a, b) => b[1] - a[1])[0]![0]).toBe(grass.base);
  });

  it("gives a mountain faces, gullies and a dark edge, and keeps it inside the scene", () => {
    const { state, city } = placed(3, [], [], [[0, -1, { terrain: Terrain.Mountains }], [1, -1, { terrain: Terrain.Mountains }], [-1, -1, { terrain: Terrain.Mountains }], [1, 0, { terrain: Terrain.Mountains }], [-1, 0, { terrain: Terrain.Mountains }]]);
    const s = Surface.screen();
    drawCityView(s, state, { city: city.id });
    const peak = cityScene(state, city).items.filter((it) => it.kind === "peak").find((it) => it.x > 10 && it.x + it.w < 300 && it.y - it.h > 2)!;
    expect(peak).toBeDefined();
    const colours = new Set<number>();
    for (let y = (SCENE_Y + peak.y - peak.h) * 2; y < (SCENE_Y + peak.y) * 2; y++) for (let x = (SCENE_X + peak.x) * 2; x < (SCENE_X + peak.x + peak.w) * 2; x++) colours.add(s.fget(x, y));
    expect(colours.has(shade("stone", 0))).toBe(true);
    expect(colours.size).toBeGreaterThan(4);
    // The frame round the scene is never drawn over.
    const clean = Surface.screen();
    drawCityView(clean, state, { city: city.id });
    for (let x = 0; x < 640; x++) expect(clean.fget(x, 25)).toBe(s.fget(x, 25));
  });
});

describe("the town on its land", () => {
  const groundOf = (scene: CityScene, x: number, y: number) => townTerrain(scene.land, scene.salt, isoU(x, y), isoV(x, y));

  it("shows the squares round the city, and builds on neither the sea nor the mountains", () => {
    const { state, city } = placed(20, ["temple", "granary", "harbour"], ["lighthouse"], [[0, -1, { terrain: Terrain.Ocean }], [1, -1, { terrain: Terrain.Ocean }], [-1, -1, { terrain: Terrain.Ocean }], [1, 0, { terrain: Terrain.Mountains }], [1, 1, { terrain: Terrain.Mountains }]]);
    const scene = cityScene(state, city);
    expect(scene.land[12]).toBe(Terrain.Grassland);
    expect(scene.land[7]).toBe(Terrain.Ocean); // the square north of the city
    for (const it of scene.items) {
      if (it.kind !== "home" && it.id !== "temple" && it.id !== "granary") continue;
      const t = groundOf(scene, it.x + it.w / 2, it.y - it.w / 4);
      expect(t, it.id).not.toBe(Terrain.Ocean);
      expect(t, it.id).not.toBe(Terrain.Mountains);
    }
    // No street runs out to sea.
    for (const st of scene.streets)
      for (let i = 0; i < st.pts.length; i += 2) expect(townTerrain(scene.land, scene.salt, st.pts[i]!, st.pts[i + 1]!)).not.toBe(Terrain.Ocean);
    expect(scene.items.some((it) => it.kind === "peak")).toBe(true);
  });

  it("stands the harbour and the seafaring wonders by the sea, the harbour nearest it", () => {
    const { state, city } = placed(9, ["harbour"], ["lighthouse"], [[0, -1, { terrain: Terrain.Ocean }], [1, -1, { terrain: Terrain.Ocean }], [-1, -1, { terrain: Terrain.Ocean }]]);
    const scene = cityScene(state, city);
    const north = (it: { x: number; y: number }) => it.y - it.x / 2; // up and to the right, on the screen
    const harbour = scene.items.find((it) => it.id === "harbour")!, light = scene.items.find((it) => it.id === "lighthouse")!;
    const homes = scene.items.filter((it) => it.kind === "home");
    expect(north(harbour)).toBeLessThan(Math.min(...homes.map(north)) + 20);
    expect(north(light)).toBeLessThan(Math.max(...homes.map(north)));
  });

  it("has a harbour built late move no wonder", () => {
    const squares: [number, number, { terrain: Terrain }][] = [[0, -1, { terrain: Terrain.Ocean }], [1, -1, { terrain: Terrain.Ocean }]];
    const a = placed(9, [], ["lighthouse"], squares);
    const before = cityScene(a.state, a.city).items.find((it) => it.id === "lighthouse")!;
    a.city.buildings = ["harbour"];
    expect(cityScene(a.state, a.city).items.find((it) => it.id === "lighthouse")).toMatchObject({ x: before.x, y: before.y });
  });

  it("lets nothing move for a new building: what stood stands, on its lot", () => {
    const { state, city } = placed(14, ["palace", "temple", "granary", "library"], [], []);
    const where = () => Object.fromEntries(cityScene(state, city).items.filter((it) => it.kind === "building").map((it) => [it.id, [it.x, it.y]]));
    const before = where();
    city.buildings = [...city.buildings, "bank", "courthouse", "factory"];
    const after = where();
    for (const id of Object.keys(before)) expect(after[id], id).toEqual(before[id]);
    // Nor for one that stops being supported, whatever order that leaves the city's lists in.
    const standing = where();
    city.idle = [city.buildings[1]!, city.buildings[3]!];
    city.buildings = city.buildings.filter((b) => !city.idle!.includes(b));
    expect(where()).toEqual(standing);
    delete city.idle;
    city.buildings = ["palace", "temple", "granary", "library", "bank", "courthouse", "factory"];
    // Works that smoke keep to the edge of the town.
    const factory = cityScene(state, city).items.find((it) => it.id === "factory")!;
    expect(Math.abs(factory.x + factory.w / 2 - 158)).toBeGreaterThan(60);
  });

  it("lays out what its owner knows, and tells nothing of what lies unexplored", () => {
    const { state, city } = placed(6, ["temple"], [], [[1, 0, { terrain: Terrain.Ocean }], [0, 1, { terrain: Terrain.Mountains, river: true }], [-1, 0, { irrigation: true }]]);
    const known = cityScene(state, city);
    expect(known.fields.length).toBeGreaterThan(0);
    const explored = state.players[0]!.explored;
    const hide = (dx: number, dy: number) => { explored[(city.y + dy) * state.map.width + city.x + dx] = 0; };
    hide(1, 0); hide(0, 1); hide(-1, 0);
    const hidden = cityScene(state, city);
    expect(hidden.land[13]).toBe(hidden.ground);
    expect(hidden.land[17]).toBe(hidden.ground);
    expect(hidden.fields).toEqual([]);
    // Rewrite what is hidden and the picture stays the same.
    const before = Surface.screen();
    drawCityView(before, state, { city: city.id });
    Object.assign(getTile(state.map, city.x + 1, city.y)!, { terrain: Terrain.Desert, river: true, irrigation: true });
    Object.assign(getTile(state.map, city.x, city.y + 1)!, { terrain: Terrain.Swamp, mine: true });
    const after = Surface.screen();
    drawCityView(after, state, { city: city.id });
    expect(after.data).toEqual(before.data);
  });

  it("runs a river by the crossroads, a street crossing it on a bridge, no house in it", () => {
    const { state, city } = placed(16, ["temple"], [], [[0, 0, { river: true }], [1, 0, { river: true }], [-1, 0, { river: true }], [2, 0, { river: true }], [-2, 0, { river: true }]]);
    const scene = cityScene(state, city);
    expect(scene.rivers.length).toBeGreaterThan(1);
    const pts = scene.rivers.flat();
    const near = (x: number, y: number, r: number) => { for (let i = 0; i < pts.length; i += 2) if (Math.hypot(pts[i]! - isoU(x, y), pts[i + 1]! - isoV(x, y)) < r) return true; return false; };
    for (const it of scene.items) if (it.kind === "home") expect(near(it.x + it.w / 2, it.y - it.w / 4, 0.5), it.id).toBe(false);
    expect(near(158, 100, 1)).toBe(false); // the crossroads stands dry
  });

  it("keeps every picture a window only partly covers, cut round the window", () => {
    const { state, id } = town(12, ["palace", "temple", "granary", "library"], [], ["pottery"]);
    const s = Surface.screen();
    drawCityView(s, state, { city: id });
    const before = s.art.length;
    const middle = s.art.find((a) => a.house)!;
    const window = { x: middle.x + 2, y: middle.y + 2, w: 60, h: 40 };
    hideArtUnder(s, window);
    expect(s.art.length).toBe(before);
    expect(s.art.find((a) => a.id === middle.id && a.x === middle.x && a.y === middle.y)!.holes).toContainEqual(window);
  });

  it("moves the gate along the walls when the sea takes the corner it would stand on", () => {
    const { state, city } = placed(9, ["city_walls"], [], [[0, 1, { terrain: Terrain.Ocean }], [1, 0, { terrain: Terrain.Ocean }], [1, 1, { terrain: Terrain.Ocean }], [0, 2, { terrain: Terrain.Ocean }], [2, 0, { terrain: Terrain.Ocean }]]);
    const scene = cityScene(state, city);
    const gate = scene.items.find((it) => it.kind === "gate")!;
    expect(groundOf(scene, gate.x + gate.w / 2, gate.y - 3)).not.toBe(Terrain.Ocean);
    // No wall stands in the sea, and no paving.
    for (const it of scene.items) if (it.wall) expect(townTerrain(scene.land, scene.salt, (it.wall.u0 + it.wall.u1) / 2, (it.wall.v0 + it.wall.v1) / 2)).not.toBe(Terrain.Ocean);
    for (const b of scene.squares) expect(townTerrain(scene.land, scene.salt, (b.u0 + b.u1) / 2, (b.v0 + b.v1) / 2)).not.toBe(Terrain.Ocean);
  });

  it("walls the town with a gate at its nearest corner, and shows what stands before a picture through it", () => {
    const { state, city, id } = placed(9, ["palace", "city_walls", "temple", "library", "granary"], [], [], ["construction"]);
    const scene = cityScene(state, city);
    const gate = scene.items.find((it) => it.kind === "gate")!;
    expect(Math.abs(gate.x + gate.w / 2 - scene.w / 2)).toBeLessThanOrEqual(1);
    expect(gate.y).toBeGreaterThanOrEqual(Math.max(...scene.items.filter((it) => it.kind === "walls").map((it) => it.y)));
    const s = Surface.screen();
    drawCityView(s, state, { city: id });
    // The second time round it comes from what was kept, the same to the pixel.
    const again = Surface.screen();
    drawCityView(again, state, { city: id });
    expect(again.data).toEqual(s.data);
    expect(again.art).toEqual(s.art);
  });
});
