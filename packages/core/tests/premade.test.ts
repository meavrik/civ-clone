import { describe, expect, it } from "vitest";
import {
  applyCommand,
  CIVS,
  decodeWorld,
  loadSave,
  makeSave,
  MAP_HEIGHT,
  MAP_WIDTH,
  nativeCivs,
  newGame,
  PLACE_CHARS,
  PREMADE_WORLDS,
  premadeWorld,
  Terrain,
  labelContinents,
  premadeStarts,
  WORLD_SIZES,
  type Command,
  type GameState,
} from "../src/index.js";

function startOf(state: GameState, player: number): [number, number] {
  const u = state.units.find((u) => u.owner === player)!;
  return [u.x, u.y];
}

function dist(a: [number, number], b: [number, number]): number {
  const dx = Math.abs(a[0] - b[0]);
  return Math.max(Math.min(dx, MAP_WIDTH - dx), Math.abs(a[1] - b[1]));
}

describe("premade worlds", () => {
  it("are full grids at every size with land, sea and rivers only on land", () => {
    for (const world of PREMADE_WORLDS)
      for (const size of WORLD_SIZES) {
        const at = `${world.id} ${size.id}`;
        const map = decodeWorld(world, size.id);
        expect([map.width, map.height], at).toEqual([size.width, size.height]);
        expect(map.tiles.length, at).toBe(size.width * size.height);
        const land = map.tiles.filter((t) => t.terrain !== Terrain.Ocean).length / map.tiles.length;
        expect(land, at).toBeGreaterThan(0.3);
        expect(land, at).toBeLessThan(0.8);
        expect(map.tiles.some((t) => t.river), at).toBe(true);
        expect(map.tiles.every((t) => !t.river || t.terrain !== Terrain.Ocean), at).toBe(true);
      }
    // Small is the original's 80x50.
    expect(decodeWorld(premadeWorld("earth")).tiles.length).toBe(MAP_WIDTH * MAP_HEIGHT);
  });

  it("put every homeland on land a city can be built on, the same civilizations at every size", () => {
    for (const world of PREMADE_WORLDS)
      for (const size of WORLD_SIZES) {
        const map = decodeWorld(world, size.id);
        const { starts } = world.sizes[size.id];
        expect(Object.keys(starts).sort(), `${world.id} ${size.id}`).toEqual(Object.keys(world.sizes.small.starts).sort());
        for (const [civ, [x, y]] of Object.entries(starts)) {
          expect(CIVS.some((c) => c.id === civ), `${world.id} ${civ}`).toBe(true);
          const t = map.tiles[y * map.width + x]!;
          expect([Terrain.Ocean, Terrain.Arctic, Terrain.Mountains], `${world.id} ${size.id} ${civ}`).not.toContain(t.terrain);
        }
      }
  });

  it("spread the homelands further apart on bigger worlds", () => {
    const earth = premadeWorld("earth");
    const span = (size: "small" | "large") => {
      const { starts } = earth.sizes[size];
      return Math.abs(starts.romans![0] - starts.chinese![0]);
    };
    expect(span("large")).toBeGreaterThan(span("small") * 1.8);
  });

  it("keep islands off the mainland at every size: Britain off Europe, Japan off Asia, Eurasia whole", () => {
    const continentOf = (world: string, size: (typeof WORLD_SIZES)[number]["id"], joined = false) => {
      const w = premadeWorld(world);
      const map = decodeWorld(w, size, joined);
      labelContinents(map);
      const starts = premadeStarts(w, size, joined);
      return (civ: string) => { const [x, y] = starts[civ]!; return map.tiles[y * map.width + x]!.continent; };
    };
    for (const size of WORLD_SIZES) {
      for (const world of ["earth", "europe"]) {
        const of = continentOf(world, size.id);
        for (const rival of ["french", "germans", "spanish", "vikings", "romans"]) expect(of("english"), `${world} ${size.id} ${rival}`).not.toBe(of(rival));
        expect(of("greeks"), `${world} ${size.id}`).toBe(of("hittites"));
      }
      const earth = continentOf("earth", size.id);
      expect(earth("japanese"), size.id).not.toBe(earth("chinese"));
      expect(earth("americans"), size.id).not.toBe(earth("russians"));
    }
    // As first drawn (saves before version 13), Britain touched France on Earth.
    const before = continentOf("earth", "small", true);
    expect(before("english")).toBe(before("french"));
  });

  it("load saves from before version 13 on the land they were played on", () => {
    const opts = { world: "earth", historical: true, civ: "english", opponents: 3 };
    const save = { ...makeSave(newGame(3, opts), opts, []), version: 12 as const };
    const { state, options } = loadSave(save, () => {});
    expect(options.joinedIslands).toBe(true);
    const joined = decodeWorld(premadeWorld("earth"), "small", true);
    expect(state.map.tiles.map((t) => t.terrain)).toEqual(joined.tiles.map((t) => t.terrain));
    expect(state.map.tiles.map((t) => t.terrain)).not.toEqual(newGame(3, opts).map.tiles.map((t) => t.terrain));
    expect(startOf(state, 0)).toEqual([...premadeStarts(premadeWorld("earth"), "small", true).english!]);
    // A generated world never had islands joined: nothing changes for it.
    const random = { ...makeSave(newGame(3, { opponents: 2 }), { opponents: 2 }, []), version: 12 as const };
    expect(loadSave(random, () => {}).options.joinedIslands).toBeUndefined();
  });

  it("play at the size asked for, every player seeing that map", () => {
    for (const size of WORLD_SIZES) {
      const state = newGame(5, { world: "europe", historical: true, civ: "english", opponents: 4, size: size.id });
      expect([state.map.width, state.map.height]).toEqual([size.width, size.height]);
      for (const p of state.players) expect(p.explored.length).toBe(size.width * size.height);
      expect(startOf(state, 0)).toEqual([...premadeWorld("europe").sizes[size.id].starts.english!]);
    }
  });

  it("seat enough natives for a full game of seven", () => {
    expect(nativeCivs(premadeWorld("earth")).length).toBe(CIVS.length - 1);
    expect(nativeCivs(premadeWorld("europe"))).toEqual(expect.arrayContaining(["english", "french", "germans", "romans", "greeks", "spanish", "russians"]));
    expect(nativeCivs(premadeWorld("middle-east"))).toEqual(expect.arrayContaining(["egyptians", "babylonians", "persians", "hittites", "hebrews"]));
    for (const world of PREMADE_WORLDS) expect(nativeCivs(world).length, world.id).toBeGreaterThanOrEqual(7);
  });

  it("keep their terrain whatever the seed; specials and villages vary", () => {
    const a = newGame(1, { world: "europe" });
    const b = newGame(2, { world: "europe" });
    expect(a.map.tiles.map((t) => t.terrain)).toEqual(b.map.tiles.map((t) => t.terrain));
    expect(a.map.tiles.map((t) => t.hut)).not.toEqual(b.map.tiles.map((t) => t.hut));
  });
});

describe("historical starts", () => {
  it("start us on our homeland and rivals on theirs, all natives", () => {
    const world = premadeWorld("middle-east");
    const state = newGame(7, { world: world.id, historical: true, civ: "egyptians", opponents: 6 });
    // Seven seats for its eight natives.
    const seated = state.players.filter((p) => p.id !== state.barbarians).map((p) => p.civ);
    expect(seated).toHaveLength(7);
    expect(nativeCivs(world)).toEqual(expect.arrayContaining(seated));
    const { starts } = world.sizes.small;
    expect(startOf(state, 0)).toEqual([...starts.egyptians!]);
    for (const p of state.players) {
      if (p.id === state.barbarians) continue;
      expect(dist(startOf(state, p.id), [...starts[p.civ]!] as [number, number]), p.civ).toBeLessThanOrEqual(3);
    }
  });

  it("keep crowded homelands apart on Earth", () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const state = newGame(seed, { world: "earth", historical: true, civ: "english", opponents: 6 });
      const civs = state.players.filter((p) => p.id !== state.barbarians);
      expect(civs.length).toBe(7);
      // France's homeland is next door to England's: it is left out while roomier rivals remain.
      expect(civs.map((p) => p.civ)).not.toContain("french");
      for (let a = 0; a < civs.length; a++)
        for (let b = a + 1; b < civs.length; b++) expect(dist(startOf(state, civs[a]!.id), startOf(state, civs[b]!.id))).toBeGreaterThanOrEqual(3);
    }
  });

  it("scatter civilizations anywhere when homelands are off", () => {
    const world = premadeWorld("europe");
    const state = newGame(11, { world: world.id, historical: false, civ: "romans", opponents: 6 });
    expect(state.players.length).toBe(8);
    const home = world.sizes.small.starts.romans!;
    const here = startOf(state, 0);
    expect(here[0] === home[0] && here[1] === home[1]).toBe(false);
  });

  it.each(["small", "large"] as const)("replay from a save (%s)", (size) => {
    const opts = { world: "earth", historical: true, civ: "romans", opponents: 3, ...(size === "small" ? {} : { size }) };
    const state = newGame(99, opts);
    const log: Command[] = [];
    const skip = (s: GameState) => { let g = 0; while (s.activeUnit !== null && g++ < 100) applyCommand(s, { type: "skip", unit: s.activeUnit }); };
    const run = (cmd: Command) => { if (applyCommand(state, cmd).ok) log.push(cmd); };
    run({ type: "found", unit: state.units[0]!.id });
    for (let i = 0; i < 4; i++) {
      skip(state);
      run({ type: "endTurn" });
      while (state.currentPlayer !== 0) { skip(state); applyCommand(state, { type: "endTurn" }); }
    }
    const { state: again } = loadSave(makeSave(state, opts, log), skip);
    expect(JSON.stringify(again.units)).toBe(JSON.stringify(state.units));
    expect(again.rng.s).toEqual(state.rng.s);
  });

  it("names every sea of every premade world at every size, each square from its own layer's names", () => {
    const bad: string[] = [];
    for (const world of PREMADE_WORLDS)
      for (const { id: size, width, height } of WORLD_SIZES) {
        const t = world.sizes[size].places!;
        const map = decodeWorld(world, size);
        if (t.place.length !== height || t.land.length !== height) bad.push(`${world.id} ${size}: rows`);
        for (let y = 0; y < height; y++) {
          if (t.place[y]!.length !== width || t.land[y]!.length !== width) bad.push(`${world.id} ${size}: row ${y}`);
          for (let x = 0; x < width; x++) {
            const wet = map.tiles[y * width + x]!.terrain === Terrain.Ocean;
            const a = PLACE_CHARS.indexOf(t.place[y]![x]!);
            const b = PLACE_CHARS.indexOf(t.land[y]![x]!);
            const fits = wet ? a >= 0 && a < t.waters.length && b === -1 : a < t.landforms.length && b < t.lands.length;
            if (!fits) bad.push(`${world.id} ${size} ${x},${y}`);
          }
        }
      }
    expect(bad).toEqual([]);
  });
});
