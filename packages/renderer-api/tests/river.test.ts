import { describe, expect, it } from "vitest";
import { getTile, newGame, Terrain } from "@civ/core";
import { riverCrossing, riverLinks, riverShape, strokeDistance } from "../src/index.js";

const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]] as const;

describe("rivers", () => {
  const { map } = newGame(5);
  const rivers: [number, number][] = [];
  for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) if (map.tiles[y * map.width + x]!.river) rivers.push([x, y]);

  it("crosses each border at one point, seen from either side, across the wrap too", () => {
    for (let y = 0; y < map.height; y++)
      for (let x = 0; x < map.width; x++) {
        const [ex, ey] = riverCrossing(map, x, y, 1);
        const [wx, wy] = riverCrossing(map, (x + 1) % map.width, y, 3);
        expect([ex - 1, ey]).toEqual([wx, wy]);
        const [sx, sy] = riverCrossing(map, x, y, 2);
        const [nx, ny] = riverCrossing(map, x, y + 1, 0);
        expect([sx, sy - 1]).toEqual([nx, ny]);
      }
  });

  it("runs every branch to its border crossing, square to the border, and joins the next square there", () => {
    expect(rivers.length).toBeGreaterThan(0);
    for (const [x, y] of rivers) {
      const shape = riverShape(map, x, y)!;
      const links = riverLinks(map, x, y);
      const open = [0, 1, 2, 3].filter((d) => links & (1 << d));
      expect(shape.strokes.length).toBe(Math.max(1, open.length));
      open.forEach((d, i) => {
        const { pts } = shape.strokes[i]!;
        const n = pts.length;
        const c = riverCrossing(map, x, y, d);
        expect(pts[n - 2]).toBeCloseTo(c[0], 9);
        expect(pts[n - 1]).toBeCloseTo(c[1], 9);
        // The neighbour picks the river up at the same point and carries on in the same direction.
        const [dx, dy] = DIRS[d]!;
        const next = riverShape(map, x + dx, y + dy);
        expect(next).not.toBeNull();
        const near = Math.min(...next!.strokes.map((s) => strokeDistance(s, c[0] - dx, c[1] - dy).dist));
        expect(near).toBeLessThan(1e-9);
        if (getTile(map, x + dx, y + dy)!.terrain === Terrain.Ocean) return;
        const back = (d + 2) % 4;
        const there = next!.strokes[[0, 1, 2, 3].filter((k) => riverLinks(map, x + dx, y + dy) & (1 << k)).indexOf(back)]!.pts;
        const m = there.length;
        const ax = pts[n - 2]! - pts[n - 4]!;
        const ay = pts[n - 1]! - pts[n - 3]!;
        const bx = there[m - 4]! - there[m - 2]!;
        const by = there[m - 3]! - there[m - 1]!;
        const turn = Math.acos(Math.min(1, (ax * bx + ay * by) / Math.hypot(ax, ay) / Math.hypot(bx, by)));
        expect(turn).toBeLessThan(0.3);
      });
    }
  });

  it("widens toward the sea and carries the mouth into the sea square at the same width", () => {
    let mouths = 0;
    for (const [x, y] of rivers)
      DIRS.forEach(([dx, dy], d) => {
        if (getTile(map, x + dx, y + dy)?.terrain !== Terrain.Ocean) return;
        mouths++;
        const shape = riverShape(map, x, y)!;
        const c = riverCrossing(map, x, y, d);
        const land = Math.min(...shape.strokes.map((s) => (strokeDistance(s, c[0], c[1]).dist < 1e-9 ? strokeDistance(s, c[0], c[1]).width : Infinity)));
        const sea = riverShape(map, x + dx, y + dy)!;
        const out = sea.strokes.map((s) => strokeDistance(s, c[0] - dx, c[1] - dy)).find((r) => r.dist < 1e-9)!;
        expect(land).toBeGreaterThan(1);
        expect(out.width).toBeCloseTo(land, 9);
      });
    expect(mouths).toBeGreaterThan(0);
  });

  it("does not meander the same way in every square", () => {
    const kinks = new Set(rivers.slice(0, 40).map(([x, y]) => riverShape(map, x, y)!.strokes[0]!.pts[8]!.toFixed(3)));
    expect(kinks.size).toBeGreaterThan(10);
  });
});
