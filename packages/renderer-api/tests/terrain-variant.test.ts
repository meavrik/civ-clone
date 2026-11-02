import { describe, expect, it } from "vitest";
import { newGame, Terrain } from "@civ/core";
import { forestKind, mountainKind, terrainVariant } from "../src/index.js";

describe("kinds of forest and mountains", () => {
  it("are only forests' and mountains', each kind somewhere on a world, the same every time", () => {
    const { map } = newGame(3, { size: "medium" });
    const seen = new Map<string, number>();
    for (let y = 0; y < map.height; y++)
      for (let x = 0; x < map.width; x++) {
        const t = map.tiles[y * map.width + x]!.terrain;
        const kind = terrainVariant(map, x, y);
        if (t !== Terrain.Forest && t !== Terrain.Mountains) { expect(kind).toBeNull(); continue; }
        expect(kind).toBe(t === Terrain.Forest ? forestKind(map, x, y) : mountainKind(map, x, y));
        seen.set(kind!, (seen.get(kind!) ?? 0) + 1);
      }
    for (const kind of ["broadleaf", "pine", "birch", "autumn", "mixed", "grey", "snow", "red", "ice"]) expect(seen.get(kind), kind).toBeGreaterThan(0);
    // Grey is the commonest mountain: the others come of the land round them, or in patches.
    expect(seen.get("grey")!).toBeGreaterThan(seen.get("snow")!);
    expect(seen.get("grey")!).toBeGreaterThan(seen.get("red")!);
  });

  it("read only the squares the viewer has explored", () => {
    const { map, players } = newGame(8);
    const explored = players[0]!.explored;
    const before: (string | null)[] = [];
    for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) before.push(explored[y * map.width + x] ? terrainVariant(map, x, y, explored) : null);
    map.tiles.forEach((t, i) => {
      if (!explored[i]) t.terrain = t.terrain === Terrain.Arctic ? Terrain.Desert : Terrain.Arctic;
    });
    for (let y = 0; y < map.height; y++)
      for (let x = 0; x < map.width; x++) if (explored[y * map.width + x]) expect(terrainVariant(map, x, y, explored), `${x},${y}`).toBe(before[y * map.width + x]);
  });
});
