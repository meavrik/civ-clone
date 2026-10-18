import { describe, expect, it } from "vitest";
import { getTile, newGame, Terrain, type GameState } from "@civ/core";
import { courseGap, roadWays, type Course } from "../src/index.js";

/** A patch of plains with roads on the given squares, all explored. */
function roads(squares: [number, number][]): GameState {
  const state = newGame(7);
  for (let y = 10; y < 20; y++)
    for (let x = 0; x < state.map.width; x++) Object.assign(getTile(state.map, x, y)!, { terrain: Terrain.Plains, road: false, railroad: false, river: false });
  for (const [x, y] of squares) getTile(state.map, x, y)!.road = true;
  state.players[0]!.explored.fill(1);
  return state;
}

/** A course moved into another square's frame. */
const moved = (c: Course, dx: number, dy: number) => c.map((v, k) => v + (k % 2 ? dy : dx));
const same = (a: Course, b: Course) => a.length === b.length && a.every((v, k) => Math.abs(v - b[k]!) < 1e-9);

describe("roads", () => {
  it("wander between squares, and both squares lay the same course", () => {
    const state = roads([[5, 12], [6, 12], [7, 13], [7, 14], [79, 15], [0, 15]]);
    const { map, players } = state;
    const at = (x: number, y: number) => roadWays(map, players[0]!.explored, x, y)!;
    for (const [[ax, ay], [bx, by]] of [[[5, 12], [6, 12]], [[6, 12], [7, 13]], [[7, 13], [7, 14]], [[79, 15], [0, 15]]] as const) {
      const dx = (((bx - ax + 1) % map.width) + map.width) % map.width - 1;
      const dy = by - ay;
      const fromA = at(ax, ay).courses;
      const fromB = at(bx, by).courses.map((c) => moved(c, dx, dy));
      expect(fromA.some((a) => fromB.some((b) => same(a, b))), `${ax},${ay} to ${bx},${by}`).toBe(true);
    }
    // Not straight: somewhere a course strays from the line between its ends.
    const bends = at(5, 12).courses.concat(at(7, 13).courses).some((c) => {
      const line: Course = [c[0]!, c[1]!, c[c.length - 2]!, c[c.length - 1]!];
      return c.some((_, k) => k % 2 === 0 && courseGap(line, c[k]!, c[k + 1]!).gap > 0.05);
    });
    expect(bends).toBe(true);
  });

  it("send the squares beside a diagonal their part of it, and nothing to squares away from roads", () => {
    const state = roads([[5, 12], [6, 13]]);
    const explored = state.players[0]!.explored;
    for (const [x, y] of [[6, 12], [5, 13]]) {
      const w = roadWays(state.map, explored, x, y)!;
      expect(w.courses.length).toBe(1);
      expect(w.patch).toBeNull();
    }
    expect(roadWays(state.map, explored, 9, 9)).toBeNull();
    // A road with no neighbours is a patch near the centre.
    const lone = roadWays(roads([[3, 11]]).map, explored, 3, 11)!;
    expect(lone.courses).toEqual([]);
    expect(Math.hypot(lone.patch![0] - 0.5, lone.patch![1] - 0.5)).toBeLessThan(0.15);
  });
});
