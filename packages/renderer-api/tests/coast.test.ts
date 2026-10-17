import { describe, expect, it } from "vitest";
import { getTile, NEIGHBOURS, newGame, Terrain } from "@civ/core";
import { coastLevel, coastPatch, DEEP, DEEP_EDGE, isDeepWater, LAND, landOwner, SHORE, waterDepth } from "../src/index.js";

describe("coasts", () => {
  const { map } = newGame(5);

  it("calls water deep only when no land touches it", () => {
    let deep = 0;
    for (let y = 0; y < map.height; y++)
      for (let x = 0; x < map.width; x++) {
        if (!isDeepWater(map, x, y)) continue;
        deep++;
        expect(getTile(map, x, y)!.terrain).toBe(Terrain.Ocean);
        for (const [dx, dy] of NEIGHBOURS) {
          const n = getTile(map, x + dx, y + dy);
          if (n) expect(n.terrain).toBe(Terrain.Ocean);
        }
      }
    expect(deep).toBeGreaterThan(0);
  });

  it("keeps every square's centre its own kind, so only the borders move", () => {
    for (let y = 0; y < map.height; y++)
      for (let x = 0; x < map.width; x++) {
        const p = coastPatch(map, x, y);
        const g = coastLevel(p, 0.5, 0.5);
        const depth = waterDepth(map, x, y);
        expect(g < SHORE, `${x},${y}`).toBe(depth === LAND);
        expect(g >= DEEP_EDGE, `${x},${y}`).toBe(depth === DEEP);
        if (depth === LAND) expect(landOwner(p, 0.5, 0.5)).toBe(4);
      }
  });

  it("agrees along shared borders, across the east-west wrap too", () => {
    for (let y = 0; y < map.height - 1; y++)
      for (let x = 0; x < map.width; x++) {
        const here = coastPatch(map, x, y);
        const east = coastPatch(map, (x + 1) % map.width, y);
        const south = coastPatch(map, x, y + 1);
        for (const t of [0.1, 0.37, 0.8]) {
          expect(coastLevel(here, 1, t)).toBeCloseTo(coastLevel(east, 0, t), 9);
          expect(coastLevel(here, t, 1)).toBeCloseTo(coastLevel(south, t, 0), 9);
        }
      }
  });

  it("moves real shores off the square borders", () => {
    // Somewhere a land square gives up part of its edge to the sea, and a water square takes some land.
    let bitten = false;
    let spilled = false;
    for (let y = 0; y < map.height && !(bitten && spilled); y++)
      for (let x = 0; x < map.width; x++) {
        const p = coastPatch(map, x, y);
        if (!p.mixed || p.depth[4] === DEEP) continue;
        for (let k = 0; k < 16; k++) {
          const g = coastLevel(p, (k + 0.5) / 16, 0.02);
          if (p.depth[4] === LAND && g >= SHORE) bitten = true;
          if (p.depth[4] !== LAND && g < SHORE) spilled = true;
        }
      }
    expect(bitten).toBe(true);
    expect(spilled).toBe(true);
  });
});
