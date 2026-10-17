import { describe, expect, it } from "vitest";
import { createUnit, findPath, foundCity, newGame, nextInt, Terrain, type GameState } from "../src/index.js";
import { legacyFindPath } from "./pathfind-legacy.js";

/** A crowded world: soldiers, ships and cities of several owners scattered over a generated map. */
function crowded(seed: number): GameState {
  const s = newGame(seed, { opponents: 3 });
  const land: [number, number][] = [];
  const sea: [number, number][] = [];
  for (let y = 1; y < s.map.height - 1; y++)
    for (let x = 0; x < s.map.width; x++) (s.map.tiles[y * s.map.width + x]!.terrain === Terrain.Ocean ? sea : land).push([x, y]);
  for (let k = 0; k < 120; k++) {
    const [x, y] = land[nextInt(s.rng, land.length)]!;
    createUnit(s, k % 3 === 0 ? "legion" : "militia", k % 4, x, y);
  }
  for (let k = 0; k < 30; k++) {
    const [x, y] = sea[nextInt(s.rng, sea.length)]!;
    createUnit(s, "trireme", k % 4, x, y);
  }
  for (let k = 0; k < 16; k++) {
    const [x, y] = land[nextInt(s.rng, land.length)]!;
    if (!s.cities.some((c) => Math.abs(c.x - x) < 3 && Math.abs(c.y - y) < 3)) foundCity(s, k % 4, x, y);
  }
  // Some roads, rivers and rails so every cost case comes up.
  for (let k = 0; k < 400; k++) {
    const t = s.map.tiles[land.map(([x, y]) => y * s.map.width + x)[nextInt(s.rng, land.length)]!]!;
    t.road = true;
    if (k % 3 === 0) t.railroad = true;
    if (k % 5 === 0) t.river = true;
  }
  return s;
}

describe("path search", () => {
  it("finds exactly the routes the old search found, for land and sea units, around foreign units and cities", () => {
    for (const seed of [3, 4]) {
      const s = crowded(seed);
      let found = 0;
      for (let q = 0; q < 1500; q++) {
        const u = s.units[nextInt(s.rng, s.units.length)]!;
        const tx = nextInt(s.rng, s.map.width);
        const ty = nextInt(s.rng, s.map.height);
        const now = findPath(s, u, tx, ty);
        expect(now, `unit ${u.id} ${u.type} to ${tx},${ty}`).toEqual(legacyFindPath(s, u, tx, ty));
        if (now) found++;
      }
      expect(found).toBeGreaterThan(200);
    }
  });
});
