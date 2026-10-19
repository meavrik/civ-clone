import { describe, expect, it } from "vitest";
import { decodeWorld, labelContinents, Terrain, WORLD_SIZES, type WorldSize } from "@civ/core";
import { buildWorld, joinedDiff, landmasses, mixedLandmasses, scaleFrame, worldModule, type BuiltWorld } from "../src/build.js";
import { FRAMES, fromGrid, project, toGrid, type Frame } from "../src/frames.js";
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
    expect(decodeWorld({ id: "test", name: "Test", sizes }, "small", true).tiles[3 * 80]!.terrain).toBe(Terrain.Grassland);
    expect(worldModule(frame, { small: world, medium: world, large: world }, { small: old, medium: world, large: world })).toContain('joinedIslands: {\n        squares: [\n          [0, 3, "g"],');
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
