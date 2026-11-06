import { describe, expect, it } from "vitest";
import { decodeWorld, labelContinents, Terrain, WORLD_SIZES, type WorldSize } from "@civ/core";
import { buildWorld, enlarged, HOMELAND, homelandSite, joinedDiff, landmasses, mixedLandmasses, scaleFrame, siteWorth, tillHomeland, worldModule, type BuiltWorld, type LandGrid } from "../src/build.js";
import { FRAMES, fromGrid, project, stretched, toGrid, type Enlargement, type Frame } from "../src/frames.js";
import { ScanFill, supercover, type Pt } from "../src/geo.js";

const square = (a: number, b: number, c: number, d: number): Pt[] => [[a, b], [c, b], [c, d], [a, d], [a, b]];

describe("map tool", () => {
  it("projects longitude and latitude to the grid and back", () => {
    for (const frame of FRAMES)
      for (const t of [0.5, 12.25, 40, 79.5]) {
        expect(toGrid(frame.lon, fromGrid(frame.lon, t))).toBeCloseTo(t, 6);
        expect(toGrid(frame.lat, fromGrid(frame.lat, t / 1.6))).toBeCloseTo(t / 1.6, 6);
      }
    // Earth's seam sits in the Bering Strait, so Alaska is on the left edge and Chukotka on the right.
    const earth = FRAMES.find((f) => f.id === "earth")!;
    expect(project(earth, [-167, 65])[0]).toBeLessThan(1);
    expect(project(earth, [-171, 65])[0]).toBeGreaterThan(79);
  });

  it("walks a segment through edge-connected cells", () => {
    const cells = supercover(0.5, 0.5, 4.5, 2.5);
    expect(cells[0]).toEqual([0, 0]);
    expect(cells[cells.length - 1]).toEqual([4, 2]);
    for (let i = 1; i < cells.length; i++) {
      const [x0, y0] = cells[i - 1]!;
      const [x1, y1] = cells[i]!;
      expect(Math.abs(x1 - x0) + Math.abs(y1 - y0)).toBe(1);
    }
  });

  it("fills rings even-odd, so holes stay open", () => {
    const fill = new ScanFill([square(0, 0, 10, 10), square(4, 4, 6, 6)], [2, 5]);
    expect(fill.inside(0, 5)).toBe(true);
    expect(fill.inside(1, 5)).toBe(false);
    expect(fill.inside(1, 2)).toBe(true);
    expect(fill.inside(0, 11)).toBe(false);
  });

  it("keeps an island off the mainland at every size, even when the strait is narrower than a square", () => {
    // Europe's small grid has squares about 0.7 degrees across; this strait is 0.3.
    const frame: Frame = { ...FRAMES.find((f) => f.id === "europe")!, homes: { romans: [5, 50], english: [11, 50] }, riverNames: [] };
    const shape = (rings: Pt[][]) => ({ props: {}, rings, bbox: [Math.min(...rings[0]!.map((p) => p[0])), Math.min(...rings[0]!.map((p) => p[1])), Math.max(...rings[0]!.map((p) => p[0])), Math.max(...rings[0]!.map((p) => p[1]))] as [number, number, number, number] });
    const mainland = shape([square(0, 44, 10, 56)]);
    const island = shape([square(10.3, 48.5, 12.5, 51.5)]);
    for (const size of WORLD_SIZES) {
      const world = buildWorld(frame, { land: [mainland, island], lakes: [], regions: [], rivers: [] }, size.id);
      expect(mixedLandmasses(world.landmass, size.width, size.height), size.id).toBeNull();
      const map = decodeWorld({ id: "test", name: "Test", sizes: { small: world, medium: world, large: world } }, size.id);
      labelContinents(map);
      const at = ([x, y]: [number, number]) => map.tiles[y * map.width + x]!;
      const [rome, london] = [world.starts.romans!, world.starts.english!];
      expect(at(rome).terrain, size.id).not.toBe(Terrain.Ocean);
      expect(at(london).terrain, size.id).not.toBe(Terrain.Ocean);
      expect(at(rome).continent, size.id).not.toBe(at(london).continent);
    }
  });

  it("joins the pieces of a landmass the data cuts at the 180th meridian", () => {
    const east = { props: {}, rings: [square(170, 60, 180, 70)], bbox: [170, 60, 180, 70] as [number, number, number, number] };
    const west = { props: {}, rings: [square(-180, 60, -170, 70)], bbox: [-180, 60, -170, 70] as [number, number, number, number] };
    const apart = { props: {}, rings: [square(-180, 10, -175, 20)], bbox: [-180, 10, -175, 20] as [number, number, number, number] };
    const [a, b, c] = landmasses([east, west, apart]);
    expect(a).toBe(b);
    expect(c).not.toBe(a);
  });

  it("draws an island bigger whole, its home with it, and leaves the rest of the world", () => {
    const e: Enlargement = { box: [10, 10, 20, 20], from: [10, 10], to: [30, 40], scale: [2, 3], landFrom: 0.2 };
    expect(stretched(e, [12, 11])).toEqual([34, 43]);
    const inside = { props: {}, rings: [square(12, 12, 14, 14)], bbox: [12, 12, 14, 14] as [number, number, number, number] };
    const across = { props: {}, rings: [square(15, 15, 25, 25)], bbox: [15, 15, 25, 25] as [number, number, number, number] };
    const frame: Frame = { ...FRAMES.find((f) => f.id === "europe")!, enlarge: [e], homes: { romans: [12, 12], greeks: [50, 50] } };
    const { frame: bigger, data } = enlarged(frame, { land: [inside, across], lakes: [], regions: [inside], rivers: [{ props: {}, points: [[12, 12], [13, 13]] }, { props: {}, points: [[12, 12], [40, 40]] }] });
    expect(data.land[0]!.bbox).toEqual([34, 46, 38, 52]);
    expect(data.regions[0]!.bbox).toEqual([34, 46, 38, 52]);
    expect(data.land[1]).toBe(across);
    expect(data.rivers[0]!.points[1]).toEqual([36, 49]);
    expect(data.rivers[1]!.points[1]).toEqual([40, 40]);
    expect(bigger.homes).toEqual({ romans: [34, 46], greeks: [50, 50] });
    // The box moves with the land, so the build still finds what it enlarged.
    expect(bigger.enlarge![0]!.box).toEqual([30, 40, 50, 70]);
    const other = { props: {}, rings: [square(35, 50, 36, 51)], bbox: [35, 50, 36, 51] as [number, number, number, number] };
    const [a, b, c] = landmasses([data.land[0]!, other, across], bigger.enlarge);
    expect(a).toBe(b);
    expect(c).not.toBe(a);
    // Past the 180th meridian the data's longitudes end and the land would be clipped without a word.
    const far: Frame = { ...frame, enlarge: [{ ...e, to: [175, 40] }] };
    expect(() => enlarged(far, { land: [inside], lakes: [], regions: [], rivers: [] })).toThrow(/180th meridian/);
  });

  describe("homelands", () => {
    const { Grassland: G, Plains: P, Hills: H, Desert: D, Ocean: O, Mountains: M } = Terrain;
    const W = 80;
    const H_ = 50;
    const grid = (ground: (x: number, y: number) => Terrain): LandGrid => {
      const terrain = Array.from({ length: W * H_ }, (_, i) => ground(i % W, Math.floor(i / W)));
      return { terrain, river: new Uint8Array(W * H_), W, H: H_ };
    };
    const noise = new Float32Array(W * H_).fill(0.5);
    const lat = () => 30;
    const owner = (g: LandGrid) => Int32Array.from(g.terrain, (t) => (t === O ? -1 : 0));

    it("clear a desert homeland to food and grass, keeping the sites that do not need it", () => {
      const desert = grid(() => D);
      expect(tillHomeland(desert, noise, lat, 40, 25)).toBeGreaterThan(10);
      const site = siteWorth(desert, 40, 25);
      expect(site.food).toBeGreaterThanOrEqual(HOMELAND.food);
      expect(site.grass).toBeGreaterThanOrEqual(HOMELAND.grass);
      // All the poor ground gone, and no more than that: plains are not cleared for the score alone.
      expect(desert.terrain.filter((t) => t !== D).length).toBe(21);
      expect(desert.terrain.filter((t) => t === G).length).toBe(HOMELAND.grass);
      const good = grid(() => G);
      expect(tillHomeland(good, noise, lat, 40, 25)).toBe(0);
    });

    it("leave good hilly land hills but for the grass a city needs", () => {
      const hills = grid(() => H);
      tillHomeland(hills, noise, lat, 40, 25);
      const site = siteWorth(hills, 40, 25);
      expect(site.grass).toBe(HOMELAND.grass);
      expect(hills.terrain.filter((t) => t === H).length).toBe(W * H_ - HOMELAND.grass);
    });

    it("clear peaks to hills and a city's own square before all else", () => {
      const peaks = grid(() => M);
      tillHomeland(peaks, noise, lat, 40, 25);
      expect(peaks.terrain[25 * W + 40]).not.toBe(M);
      expect(peaks.terrain[20 * W + 40]).toBe(M);
    });

    it("stay on a people's true spot if a city has room there, and never cross to another land", () => {
      const land = grid((x) => (x < 40 ? P : O));
      expect(homelandSite(land, owner(land), 20.5, 25.5, true)).toEqual([20, 25]);
      // A cape with no room for a city: inland is the nearest square with some.
      const cape = grid((x, y) => (x < 37 || (x < 41 && y === 25) ? P : O));
      expect(siteWorth(cape, 40, 25).land).toBeLessThan(7);
      const site = homelandSite(cape, owner(cape), 40.5, 25.5, true)!;
      expect(site[0]).toBeLessThan(40);
      expect(siteWorth(cape, site[0], site[1]).land).toBeGreaterThanOrEqual(7);
      // An island beside the true spot is not home, however roomy.
      const shore = grid((x) => (x < 10 || x > 11 ? P : O));
      const lands = Int32Array.from(shore.terrain, (t, i) => (t === O ? -1 : i % W < 11 ? 0 : 1));
      expect(homelandSite(shore, lands, 9.5, 25.5, true)![0]).toBeLessThan(10);
      // Nothing near: the build says so.
      const sea = grid(() => O);
      expect(homelandSite(sea, owner(sea), 20, 20, true)).toBeNull();
    });
  });

  it("lists where an older grid differed, so its saves replay on the land they knew", () => {
    const frame: Frame = { ...FRAMES.find((f) => f.id === "europe")!, homes: { romans: [5, 50] }, riverNames: [] };
    const island = { props: {}, rings: [square(0, 45, 10, 55)], bbox: [0, 45, 10, 55] as [number, number, number, number] };
    const world = buildWorld(frame, { land: [island], lakes: [], regions: [], rivers: [] });
    expect(joinedDiff(world, world)).toBeNull();
    const old = { rows: world.rows.map((r, y) => (y === 3 ? "g" + r.slice(1) : r)), starts: { romans: [1, 3] as const } };
    const diff = joinedDiff(world, old)!;
    expect(diff).toEqual({ squares: [[0, 3, "g"]], starts: { romans: [1, 3] } });
    const grid = { ...world, joinedIslands: diff };
    const sizes = { small: grid, medium: grid, large: grid };
    expect(decodeWorld({ id: "test", name: "Test", sizes }).tiles[3 * 80]!.terrain).toBe(Terrain.Ocean);
    expect(decodeWorld({ id: "test", name: "Test", sizes }, "small", "joinedIslands").tiles[3 * 80]!.terrain).toBe(Terrain.Grassland);
    expect(worldModule(frame, { small: world, medium: world, large: world }, { small: old, medium: world, large: world })).toContain('joinedIslands: {\n        squares: [\n          [0, 3, "g"],');
    expect(worldModule(frame, { small: world, medium: world, large: world }, undefined, { small: old, medium: world, large: world })).toContain('oldLands: {\n        squares: [\n          [0, 3, "g"],');
  });

  it("stretches a frame over a bigger world's grid, the same place in the same spot", () => {
    const europe = FRAMES.find((f) => f.id === "europe")!;
    expect(scaleFrame(europe, "small")).toBe(europe);
    const large = scaleFrame(europe, "large");
    const [x, y] = project(europe, [12.5, 41.9]);
    const [lx, ly] = project(large, [12.5, 41.9]);
    expect(lx).toBeCloseTo(x * 2, 6);
    expect(ly).toBeCloseTo(y * 2, 6);
  });

  it("builds a world module the engine can read, at every size", () => {
    const frame: Frame = { ...FRAMES.find((f) => f.id === "europe")!, homes: { romans: [5, 50] }, riverNames: [] };
    const island = { props: {}, rings: [square(0, 45, 10, 55)], bbox: [0, 45, 10, 55] as [number, number, number, number] };
    const built = {} as Record<WorldSize, BuiltWorld>;
    for (const size of WORLD_SIZES) built[size.id] = buildWorld(frame, { land: [island], lakes: [], regions: [], rivers: [] }, size.id);
    const text = worldModule(frame, built);
    expect(text).toContain('export const EUROPE: PremadeWorld = {');
    expect(text).toContain("    large: {");
    const world = { id: frame.id, name: frame.name, sizes: built };
    for (const size of WORLD_SIZES) {
      const map = decodeWorld(world, size.id);
      expect([map.width, map.height]).toEqual([size.width, size.height]);
      const [x, y] = built[size.id].starts.romans!;
      expect(map.tiles[y * map.width + x]!.terrain).not.toBe(Terrain.Ocean);
      // The island covers the same share of the world at every size.
      const land = map.tiles.filter((t) => t.terrain !== Terrain.Ocean).length / map.tiles.length;
      expect(land).toBeGreaterThan(100 / 4000);
    }
  });
});
