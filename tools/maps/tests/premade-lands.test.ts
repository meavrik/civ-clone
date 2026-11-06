import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { decodeWorld, labelContinents, NEIGHBOURS, newGame, PREMADE_WORLDS, premadeWorld, siteScore, Terrain, WORLD_SIZES, type WorldDrawing, type WorldMap, type WorldSize } from "@civ/core";
import { HOMELAND, scaleFrame, siteWorth, type LandGrid } from "../src/build.js";
import { FRAMES, project } from "../src/frames.js";
import type { Pt } from "../src/geo.js";

const earthFrame = FRAMES.find((f) => f.id === "earth")!;
const earth = premadeWorld("earth");
const squareAt = (size: WorldSize, pt: Pt): [number, number] => {
  const [x, y] = project(scaleFrame(earthFrame, size), pt);
  return [Math.floor(x), Math.floor(y)];
};
const wrap = (x: number, w: number) => ((x % w) + w) % w;

/** Whether a walk from `a` over the squares `open` allows comes to `b`, on `steps`. */
function reaches(map: WorldMap, a: readonly [number, number], b: readonly [number, number], open: (x: number, y: number) => boolean, steps: readonly (readonly [number, number])[]): boolean {
  const at = (x: number, y: number) => y * map.width + wrap(x, map.width);
  const seen = new Set([at(a[0], a[1])]);
  const queue = [[a[0], a[1]] as const];
  for (let k = 0; k < queue.length; k++) {
    const [x, y] = queue[k]!;
    if (x === wrap(b[0], map.width) && y === b[1]) return true;
    for (const [dx, dy] of steps) {
      const nx = wrap(x + dx, map.width);
      const ny = y + dy;
      if (ny < 0 || ny >= map.height || seen.has(at(nx, ny)) || !open(nx, ny)) continue;
      seen.add(at(nx, ny));
      queue.push([nx, ny]);
    }
  }
  return false;
}
const SIDES = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;
const terrainAt = (map: WorldMap) => (x: number, y: number) => map.tiles[y * map.width + x]!.terrain;
const gridOf = (map: WorldMap): LandGrid => ({
  terrain: map.tiles.map((t) => t.terrain),
  river: Uint8Array.from(map.tiles, (t) => (t.river ? 1 : 0)),
  W: map.width,
  H: map.height,
});

describe("Earth's coasts", () => {
  for (const { id: size } of WORLD_SIZES)
    describe(size, () => {
      const map = decodeWorld(earth, size);
      labelContinents(map);
      const terrain = terrainAt(map);
      const sea = (x: number, y: number) => terrain(x, y) === Terrain.Ocean;
      const land = (x: number, y: number) => !sea(x, y);

      it("runs the narrow seas side to side, no corner of land bridging them", () => {
        // Sides only: a unit steps across a corner, and a ship cannot pass one.
        expect(reaches(map, squareAt(size, [33.7, 28.8]), squareAt(size, [47, 12.4]), sea, SIDES), "the Red Sea").toBe(true);
        expect(reaches(map, squareAt(size, [48.7, 29.6]), squareAt(size, [62.5, 22.5]), sea, SIDES), "the Gulf").toBe(true);
        expect(reaches(map, squareAt(size, [-8, 36]), squareAt(size, [-2.5, 36.2]), sea, SIDES), "Gibraltar").toBe(true);
      });

      it("keeps Arabia off Africa and Iran, joined to Asia only in the north", () => {
        const riyadh = squareAt(size, [46.7, 24.6]);
        const north = squareAt(size, [40, 29.5])[1];
        const south = (x: number, y: number) => y >= north && land(x, y);
        expect(reaches(map, riyadh, squareAt(size, [38.7, 9]), south, NEIGHBOURS), "Ethiopia").toBe(false);
        expect(reaches(map, riyadh, squareAt(size, [57, 28.5]), south, NEIGHBOURS), "Iran").toBe(false);
        expect(reaches(map, riyadh, squareAt(size, [44.4, 33.3]), land, NEIGHBOURS), "Baghdad").toBe(true);
      });

      it("keeps Spain off Morocco and Sinai joining Africa to Asia", () => {
        expect(reaches(map, squareAt(size, [-4, 40]), squareAt(size, [-6, 32]), (x, y) => land(x, y) && y >= squareAt(size, [0, 45])[1] && x <= squareAt(size, [0, 45])[0], NEIGHBOURS)).toBe(false);
        expect(reaches(map, squareAt(size, [31.2, 30]), squareAt(size, [35.2, 31.8]), land, NEIGHBOURS), "Cairo to Jerusalem").toBe(true);
      });

      it("draws Italy a boot with Sicily off its toe, the Adriatic open beside it", () => {
        const rome = earth.sizes[size].starts.romans!;
        const continent = (x: number, y: number) => map.tiles[y * map.width + x]!.continent;
        const toe = squareAt(size, [16.2, 38.9]);
        const north = squareAt(size, [0, 44.8])[1];
        const boot = (x: number, y: number) => y >= north && land(x, y);
        expect(reaches(map, rome, toe, boot, NEIGHBOURS), "Rome to the toe").toBe(true);
        expect(reaches(map, squareAt(size, [14, 44.3]), squareAt(size, [19, 39.6]), sea, SIDES), "the Adriatic").toBe(true);
        expect(reaches(map, rome, earth.sizes[size].starts.greeks!, boot, NEIGHBOURS), "Italy to Greece").toBe(false);
        const [sx, sy] = squareAt(size, [14, 36.1]);
        expect(terrain(sx, sy), "Sicily").not.toBe(Terrain.Ocean);
        expect(continent(sx, sy), "Sicily off Italy").not.toBe(continent(rome[0], rome[1]));
      });

      it("runs the Thames through England, past the English", () => {
        const [lx, ly] = earth.sizes[size].starts.english!;
        const near = map.tiles.filter((t, i) => t.river && Math.abs(i % map.width - lx) <= 3 && Math.abs(Math.floor(i / map.width) - ly) <= 1);
        expect(near.length).toBeGreaterThanOrEqual(2);
      });

      it("joins the Americas by land", () => {
        const mexico = earth.sizes[size].starts.aztecs!;
        const [bx, by] = squareAt(size, [-74, 4.6]);
        expect(map.tiles[by * map.width + bx]!.continent).toBe(map.tiles[mexico[1] * map.width + mexico[0]]!.continent);
      });
    });
});

describe("the regional worlds' narrow seas", () => {
  it.each([
    ["middle-east", "the Red Sea", [37, 21], [47, 12.4]],
    ["middle-east", "the Gulf", [48.7, 29.6], [62.5, 22.5]],
    ["europe", "Gibraltar", [-8, 36], [-2.5, 36.2]],
  ] as [string, string, Pt, Pt][])("%s keeps %s open side to side", (id, _, from, to) => {
    const frame = FRAMES.find((f) => f.id === id)!;
    for (const { id: size } of WORLD_SIZES) {
      const map = decodeWorld(premadeWorld(id), size);
      const square = (pt: Pt): [number, number] => {
        const [x, y] = project(scaleFrame(frame, size), pt);
        return [Math.floor(x), Math.floor(y)];
      };
      const terrain = terrainAt(map);
      expect(reaches(map, square(from), square(to), (x, y) => terrain(x, y) === Terrain.Ocean, SIDES), size).toBe(true);
    }
  });
});

describe("Japan", () => {
  it("is one island near Asia, only as big as a few cities need (asked for: first bigger, then not so huge and far)", () => {
    for (const [size, least, most, reach, sites] of [["small", 14, 18, 2, 2], ["medium", 26, 33, 2, 3], ["large", 45, 55, 3, 3]] as const) {
      const state = newGame(1, { world: "earth", historical: true, civ: "japanese", opponents: 1, size });
      const { map } = state;
      for (const t of map.tiles) { t.special = false; t.secondSpecial = false; delete t.deposit; }
      const [hx, hy] = earth.sizes[size].starts.japanese!;
      const [cx, cy] = earth.sizes[size].starts.chinese!;
      const home = map.tiles[hy * map.width + hx]!.continent;
      const asia = map.tiles[cy * map.width + cx]!.continent;
      const where = (i: number): [number, number] => [i % map.width, Math.floor(i / map.width)];
      const japan = map.tiles.flatMap((t, i) => (t.continent === home ? [where(i)] : []));
      expect(japan.length, size).toBeGreaterThanOrEqual(least);
      expect(japan.length, size).toBeLessThanOrEqual(most);
      const mainland = map.tiles.flatMap((t, i) => (t.continent === asia ? [where(i)] : []));
      let gap = Infinity;
      for (const [x, y] of japan) for (const [a, b] of mainland) gap = Math.min(gap, Math.max(Math.abs(x - a), Math.abs(y - b)));
      expect(gap, size).toBeGreaterThanOrEqual(2);
      expect(gap, size).toBeLessThanOrEqual(reach);
      const fit: [number, number, number][] = [];
      map.tiles.forEach((t, i) => {
        const s = t.continent === home ? siteScore(state, ...where(i)) : null;
        if (s !== null) fit.push([...where(i), s]);
      });
      const apart: [number, number, number][] = [];
      for (const p of fit.sort((a, b) => b[2] - a[2])) if (apart.every((q) => Math.max(Math.abs(q[0] - p[0]), Math.abs(q[1] - p[1])) >= 4)) apart.push(p);
      expect(apart.length, size).toBeGreaterThanOrEqual(sites);
    }
  });
});

describe("homelands", () => {
  it("give every people a city's land, food and grass on every premade world at every size, none on a neighbour's square", () => {
    for (const world of PREMADE_WORLDS)
      for (const { id: size } of WORLD_SIZES) {
        const grid = gridOf(decodeWorld(world, size));
        const squares = new Set<string>();
        for (const [civ, [x, y]] of Object.entries(world.sizes[size].starts)) {
          const site = siteWorth(grid, x, y);
          const at = `${world.id} ${size} ${civ}`;
          expect(site.land, at).toBeGreaterThanOrEqual(7);
          expect(site.food, at).toBeGreaterThanOrEqual(HOMELAND.food);
          expect(site.grass, at).toBeGreaterThanOrEqual(HOMELAND.grass);
          squares.add(`${x},${y}`);
        }
        expect(squares.size, `${world.id} ${size}`).toBe(Object.keys(world.sizes[size].starts).length);
      }
  });

  it("reckon a site as the game does", () => {
    for (const world of PREMADE_WORLDS)
      for (const { id: size } of WORLD_SIZES) {
        const state = newGame(1, { world: world.id, historical: true, size });
        for (const t of state.map.tiles) { t.special = false; t.secondSpecial = false; t.grassShield = false; delete t.deposit; }
        const grid = gridOf(state.map);
        for (const [x, y] of Object.values(world.sizes[size].starts)) expect(siteWorth(grid, x, y).score, `${world.id} ${size}`).toBeCloseTo(siteScore(state, x, y)!, 6);
      }
  });

  it("make the Hebrews' land more than desert, on Earth and in the Middle East", () => {
    for (const id of ["earth", "middle-east"])
      for (const { id: size } of WORLD_SIZES) {
        const world = premadeWorld(id);
        const map = decodeWorld(world, size);
        const [x, y] = world.sizes[size].starts.hebrews!;
        let desert = 0;
        let farmland = 0;
        for (let dy = -2; dy <= 2; dy++)
          for (let dx = -2; dx <= 2; dx++) {
            const t = map.tiles[(y + dy) * map.width + wrap(x + dx, map.width)]!;
            if (t.terrain === Terrain.Desert && !t.river) desert++;
            if (t.terrain === Terrain.Grassland || t.terrain === Terrain.Plains) farmland++;
          }
        expect(desert, `${id} ${size}`).toBeLessThanOrEqual(6);
        expect(farmland, `${id} ${size}`).toBeGreaterThanOrEqual(7);
      }
  });
});

describe("older drawings", () => {
  const frozen = (file: string) => JSON.parse(readFileSync(new URL(`../legacy/${file}`, import.meta.url), "utf8")) as Record<string, Record<WorldSize, { rows: string[]; starts: Record<string, [number, number]> }>>;
  const rowsOf = (map: WorldMap) => {
    const CH = ".gpfhmdtasj";
    return Array.from({ length: map.height }, (_, y) => Array.from({ length: map.width }, (_, x) => {
      const t = map.tiles[y * map.width + x]!;
      return t.river ? CH[t.terrain]!.toUpperCase() : CH[t.terrain]!;
    }).join(""));
  };

  it.each<[WorldDrawing, string]>([["oldLands", "old-lands.json"], ["joinedIslands", "joined-islands.json"]])("%s gives back the frozen grids square for square", (drawing, file) => {
    const old = frozen(file);
    for (const world of PREMADE_WORLDS)
      for (const { id: size } of WORLD_SIZES) {
        expect(rowsOf(decodeWorld(world, size, drawing)), `${world.id} ${size}`).toEqual(old[world.id]![size].rows);
        expect(world.sizes[size][drawing]?.squares.length ?? 0, `${world.id} ${size}`).toBeGreaterThan(0);
      }
  });
});
