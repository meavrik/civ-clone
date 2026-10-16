import { describe, expect, it } from "vitest";
import { decodeWorld, MAP_WIDTH, Terrain } from "@civ/core";
import { buildWorld, worldModule } from "../src/build.js";
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

  it("builds a world module the engine can read", () => {
    const frame: Frame = { ...FRAMES.find((f) => f.id === "europe")!, homes: { romans: [5, 50] }, riverNames: [] };
    const island = { props: {}, rings: [square(0, 45, 10, 55)], bbox: [0, 45, 10, 55] as [number, number, number, number] };
    const world = buildWorld(frame, { land: [island], lakes: [], regions: [], rivers: [] });
    const text = worldModule(frame, world);
    expect(text).toContain('export const EUROPE: PremadeWorld = {');
    const map = decodeWorld({ id: frame.id, name: frame.name, rows: world.rows, starts: world.starts });
    const [x, y] = world.starts.romans!;
    expect(map.tiles[y * MAP_WIDTH + x]!.terrain).not.toBe(Terrain.Ocean);
    expect(map.tiles.filter((t) => t.terrain !== Terrain.Ocean).length).toBeGreaterThan(100);
  });
});
