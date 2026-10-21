import { describe, expect, it } from "vitest";
import { newGame, Terrain } from "@civ/core";
import { BLEND_REACH, coastPatch, groundOwner } from "../src/index.js";

describe("land borders", () => {
  const { map } = newGame(5);
  const X = 20;
  const Y = 20;
  for (let y = Y - 2; y <= Y + 2; y++) for (let x = X - 2; x <= X + 2; x++) map.tiles[y * map.width + x]!.terrain = Terrain.Plains;
  const steps = [...Array(32).keys()].map((i) => (i + 0.5) / 32);

  it("keeps a square's middle its own and moves only its borders, by less than the reach", () => {
    const p = coastPatch(map, X, Y);
    let strays = 0;
    for (const v of steps)
      for (const u of steps) {
        const o = groundOwner(p, u, v);
        expect(o).toBeGreaterThanOrEqual(0);
        if (o === 4) continue;
        strays++;
        const ox = (o % 3) - 1;
        const oy = Math.floor(o / 3) - 1;
        // The point lies within the reach of the border it crossed.
        if (ox < 0) expect(u).toBeLessThan(BLEND_REACH);
        if (ox > 0) expect(1 - u).toBeLessThan(BLEND_REACH);
        if (oy < 0) expect(v).toBeLessThan(BLEND_REACH);
        if (oy > 0) expect(1 - v).toBeLessThan(BLEND_REACH);
      }
    expect(strays).toBeGreaterThan(0);
  });

  it("lets neighbouring squares agree on the line between them", () => {
    const a = coastPatch(map, X, Y);
    const b = coastPatch(map, X + 1, Y);
    for (const v of steps)
      for (const du of [-0.2, -0.1, -0.02, 0.02, 0.1, 0.2]) {
        const fromA = groundOwner(a, 1 + du, v);
        const fromB = groundOwner(b, du, v);
        expect(X + (fromA % 3) - 1).toBe(X + 1 + (fromB % 3) - 1);
        expect(Math.floor(fromA / 3)).toBe(Math.floor(fromB / 3));
      }
  });

  it("never gives a border to water or to a square the player has not explored", () => {
    map.tiles[Y * map.width + X + 1]!.terrain = Terrain.Ocean;
    const explored = new Uint8Array(map.width * map.height).fill(1);
    explored[(Y - 1) * map.width + X] = 0;
    const p = coastPatch(map, X, Y, explored);
    for (const v of steps) for (const u of steps) expect([1, 5]).not.toContain(groundOwner(p, u, v));
    map.tiles[Y * map.width + X + 1]!.terrain = Terrain.Plains;
  });
});
