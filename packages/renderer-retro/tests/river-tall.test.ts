import { mkdirSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { newGame, Terrain } from "@civ/core";
import { FINE, isWater, spriteSurface, squareSprite, Surface, TERRAIN_SHEET, terrainSquare } from "../src/index.js";
import { tallOf } from "../src/tiles.js";
import { encodePng } from "./png.js";

const X = 30, Y = 24;

/** A world of `terrain` round (X, Y) with a river east to west through it; the square east of (X, Y), where the river crosses, of `east` when given. */
function valley(terrain: Terrain, river = true, east?: Terrain) {
  const { map } = newGame(1, {});
  for (let y = Y - 4; y <= Y + 4; y++)
    for (let x = X - 8; x <= X + 8; x++)
      Object.assign(map.tiles[y * map.width + x]!, { terrain, river: river && y === Y, special: false, hut: false });
  if (east !== undefined) map.tiles[Y * map.width + X + 1]!.terrain = east;
  return map;
}

describe("rivers behind what stands tall", () => {
  // The river's line is the same on any land, so open grass shows all of it.
  const line = terrainSquare(valley(Terrain.Grassland), X, Y).data;

  it.each([
    ["a forest", Terrain.Forest, undefined],
    ["a jungle", Terrain.Jungle, undefined],
    ["a jungle beside the desert", Terrain.Jungle, Terrain.Desert],
    ["hills", Terrain.Hills, undefined],
    ["mountains", Terrain.Mountains, undefined],
  ])("runs behind %s, and shows round them", (_, terrain, east) => {
    const map = valley(terrain, true, east);
    const drawn = terrainSquare(map, X, Y).data;
    const sprite = spriteSurface(TERRAIN_SHEET, squareSprite(map, X, Y, terrain))!.data;
    let shown = 0, under = 0;
    for (let i = 0; i < FINE * FINE; i++) {
      if (!isWater(line[i]!)) continue;
      if (isWater(drawn[i]!)) shown++;
      else {
        under++;
        // Only what stands on the square itself: no gap where a neighbour's ground reaches in.
        expect(drawn[i]).toBe(sprite[i]);
      }
    }
    expect(under).toBeGreaterThan(0);
    expect(shown).toBeGreaterThan(0);
    // The jungle stands thick: most of the river still shows through it.
    if (terrain === Terrain.Jungle) expect(shown).toBeGreaterThan(under);
  });

  it("hides behind the whole of a hill, the grass of its slopes too", () => {
    const hill = tallOf("hills");
    for (let y = 0; y < FINE; y++) {
      const row = [...hill.subarray(y * FINE, (y + 1) * FINE)].join("");
      expect(row).toMatch(/^0*1*0*$/);
    }
    expect(hill.indexOf(1)).toBeGreaterThanOrEqual(0);
  });

  it("leaves other land to the river", () => {
    const map = valley(Terrain.Desert);
    const drawn = terrainSquare(map, X, Y).data;
    for (let i = 0; i < FINE * FINE; i++) if (isWater(line[i]!)) expect(isWater(drawn[i]!)).toBe(true);
  });

  it("draws at every zoom", () => {
    const sizes = [16, 20, 24];
    const kinds = [Terrain.Forest, Terrain.Jungle, Terrain.Hills, Terrain.Mountains];
    const s = Surface.fine(6 * 24, kinds.length * 3 * sizes.reduce((a, b) => a + b, 0));
    let dy = 0;
    for (const terrain of kinds)
      for (const t of sizes) {
        const map = valley(terrain);
        for (let j = 0; j < 3; j++) for (let i = 0; i < 6; i++) s.blit(terrainSquare(map, X + i - 3, Y + j - 1, undefined, t), i * t, dy + j * t);
        dy += t * 3;
      }
    expect(s.data.some(isWater)).toBe(true);
    mkdirSync(new URL("./out/", import.meta.url), { recursive: true });
    writeFileSync(new URL("./out/river-tall.png", import.meta.url), encodePng(s, 3));
  });
});
