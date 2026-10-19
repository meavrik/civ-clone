import { describe, expect, it } from "vitest";
import { createRng, formatYear, generateMap, getTile, loadSave, makeSave, mapDistance, NEIGHBOURS, newGame, Terrain, turnToYear, WORLD_SIZES, type MapGenOptions, type Tile, type WorldMap } from "../src/index.js";

describe("map generation", () => {
  it("produces an 80x50 world deterministically", () => {
    const a = newGame(1234);
    const b = newGame(1234);
    expect(a.map.width).toBe(80);
    expect(a.map.height).toBe(50);
    expect(a.map.tiles.length).toBe(4000);
    expect(a.map.tiles.map((t) => t.terrain)).toEqual(b.map.tiles.map((t) => t.terrain));
  });

  it("has a plausible land/ocean ratio", () => {
    const g = newGame(99);
    const land = g.map.tiles.filter((t) => t.terrain !== Terrain.Ocean).length;
    const ratio = land / g.map.tiles.length;
    expect(ratio).toBeGreaterThan(0.25);
    expect(ratio).toBeLessThan(0.65);
  });

  it("has polar ice on the first and last rows", () => {
    const g = newGame(5);
    for (let x = 0; x < 80; x++) {
      expect(g.map.tiles[x]!.terrain).toBe(Terrain.Arctic);
      expect(g.map.tiles[49 * 80 + x]!.terrain).toBe(Terrain.Arctic);
    }
  });

  it("grows bigger worlds the same way: as much land, as varied, more rivers, starts further apart", () => {
    const small = worlds();
    for (const size of WORLD_SIZES.filter((s) => s.id !== "small")) {
      const maps = worlds({ size: size.id });
      for (const map of maps) {
        expect([map.width, map.height, map.tiles.length]).toEqual([size.width, size.height, size.width * size.height]);
        for (const x of [0, size.width - 1]) {
          expect(map.tiles[x]!.terrain).toBe(Terrain.Arctic);
          expect(map.tiles[(size.height - 1) * size.width + x]!.terrain).toBe(Terrain.Arctic);
        }
        const land = map.tiles.filter((t) => t.terrain !== Terrain.Ocean).length / map.tiles.length;
        expect(land, size.id).toBeGreaterThan(0.3);
        expect(land, size.id).toBeLessThan(0.5);
      }
      for (const t of [Terrain.Grassland, Terrain.Plains, Terrain.Forest, Terrain.Hills, Terrain.Mountains, Terrain.Desert])
        expect(Math.abs(share(maps, t) - share(small, t)), `${size.id} ${Terrain[t]}`).toBeLessThan(0.06);
      const rivers = (ms: WorldMap[]) => ms.flatMap((m) => m.tiles).filter((t) => t.river).length;
      expect(rivers(maps)).toBeGreaterThan(rivers(small) * 1.5);
      const game = newGame(8, { size: size.id, opponents: 6 });
      const starts = game.players.filter((p) => p.id !== game.barbarians).map((p) => game.units.find((u) => u.owner === p.id)!);
      for (let a = 0; a < starts.length; a++)
        for (let b = a + 1; b < starts.length; b++)
          expect(mapDistance(game.map, starts[a]!.x, starts[a]!.y, starts[b]!.x, starts[b]!.y)).toBeGreaterThanOrEqual(10);
    }
  });
});

/** Land squares of a world, with their latitude (0 equator .. 1 pole) and how many neighbours share their terrain. */
function landSquares(map: WorldMap) {
  const out: { t: Tile; lat: number; alike: number }[] = [];
  for (let y = 1; y < map.height - 1; y++)
    for (let x = 0; x < map.width; x++) {
      const t = map.tiles[y * map.width + x]!;
      if (t.terrain === Terrain.Ocean) continue;
      let alike = 0;
      for (const [dx, dy] of NEIGHBOURS) if (getTile(map, x + dx, y + dy)?.terrain === t.terrain) alike++;
      out.push({ t, lat: Math.abs(y - (map.height - 1) / 2) / ((map.height - 1) / 2), alike });
    }
  return out;
}

const SEEDS = [1, 2, 3, 4, 5, 6];
const worlds = (opts: MapGenOptions = {}) => SEEDS.map((seed) => generateMap(createRng(seed), opts));
const share = (maps: WorldMap[], terrain: Terrain) => {
  const all = maps.flatMap(landSquares);
  return all.filter((s) => s.t.terrain === terrain).length / all.length;
};

describe("climate", () => {
  it("gathers like terrain into regions instead of speckling it", () => {
    const clustered = (maps: WorldMap[]) => {
      const all = maps.flatMap(landSquares);
      return all.filter((s) => s.alike >= 3).length / all.length;
    };
    expect(clustered(worlds())).toBeGreaterThan(0.65);
    expect(clustered(worlds({ scatteredTerrain: true }))).toBeLessThan(0.4);
  });

  it("grows jungle by the equator, desert in the dry subtropics, tundra and ice toward the poles", () => {
    const all = worlds().flatMap(landSquares);
    const meanLat = (terrain: Terrain) => {
      const of = all.filter((s) => s.t.terrain === terrain);
      expect(of.length).toBeGreaterThan(50);
      return of.reduce((sum, s) => sum + s.lat, 0) / of.length;
    };
    expect(meanLat(Terrain.Jungle)).toBeLessThan(0.2);
    expect(meanLat(Terrain.Desert)).toBeGreaterThan(0.15);
    expect(meanLat(Terrain.Desert)).toBeLessThan(0.5);
    expect(meanLat(Terrain.Tundra)).toBeGreaterThan(0.65);
    expect(meanLat(Terrain.Arctic)).toBeGreaterThan(0.8);
    // Every biome keeps a fair share of the land.
    for (const t of [Terrain.Grassland, Terrain.Plains, Terrain.Forest, Terrain.Hills, Terrain.Mountains, Terrain.Desert, Terrain.Jungle, Terrain.Swamp, Terrain.Tundra])
      expect(share(worlds(), t)).toBeGreaterThan(0.03);
  });

  it("follows the world settings: arid and wet, young and old", () => {
    expect(share(worlds({ climate: 0 }), Terrain.Desert)).toBeGreaterThan(2 * share(worlds({ climate: 2 }), Terrain.Desert));
    expect(share(worlds({ climate: 2 }), Terrain.Swamp)).toBeGreaterThan(share(worlds({ climate: 0 }), Terrain.Swamp));
    expect(share(worlds({ age: 0 }), Terrain.Mountains)).toBeGreaterThan(share(worlds({ age: 2 }), Terrain.Mountains));
    expect(share(worlds({ temperature: 0 }), Terrain.Arctic)).toBeGreaterThan(share(worlds({ temperature: 2 }), Terrain.Arctic));
  });

  it("runs every river down to the sea, alone or by joining another", () => {
    for (const map of worlds()) {
      const { width: w } = map;
      const seen = new Set<number>();
      let rivers = 0;
      for (let i = 0; i < map.tiles.length; i++) {
        if (!map.tiles[i]!.river || seen.has(i)) continue;
        rivers++;
        // One connected river system (squares joined side by side) must touch the sea.
        const stack = [i];
        seen.add(i);
        let mouth = false;
        while (stack.length) {
          const c = stack.pop()!;
          for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]] as const) {
            const t = getTile(map, (c % w) + dx, Math.floor(c / w) + dy);
            if (!t) continue;
            if (t.terrain === Terrain.Ocean) mouth = true;
            const j = map.tiles.indexOf(t);
            if (t.river && !seen.has(j)) { seen.add(j); stack.push(j); }
          }
        }
        expect(mouth).toBe(true);
      }
      expect(rivers).toBeGreaterThan(5);
    }
  });

  it("rebuilds old saves' worlds with the first generator", () => {
    const opts = { opponents: 1 as const };
    const state = newGame(321, opts);
    const old = loadSave({ ...makeSave(state, opts, []), version: 5 as const }, () => {});
    expect(old.options.scatteredTerrain).toBe(true);
    const first = newGame(321, { ...opts, scatteredTerrain: true });
    expect(old.state.map.tiles.map((t) => t.terrain)).toEqual(first.map.tiles.map((t) => t.terrain));
    expect(state.map.tiles.map((t) => t.terrain)).not.toEqual(first.map.tiles.map((t) => t.terrain));
    expect(loadSave(makeSave(state, opts, []), () => {}).state.map.tiles.map((t) => t.terrain)).toEqual(state.map.tiles.map((t) => t.terrain));
  });
});

describe("calendar", () => {
  it("matches the original pacing", () => {
    expect(formatYear(turnToYear(0))).toBe("4000 BC");
    expect(formatYear(turnToYear(1))).toBe("3980 BC");
    expect(formatYear(turnToYear(200))).toBe("1 AD");
  });
});
