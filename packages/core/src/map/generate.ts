import { nextInt, type RngState } from "../rng.js";
import { MAP_HEIGHT, MAP_WIDTH, NEIGHBOURS, Terrain, wrapX, type Tile, type WorldMap } from "../types.js";

export interface MapGenOptions {
  /** 0..2 — original "land mass" setting (small / normal / large). */
  landMass?: 0 | 1 | 2;
  /** 0..2 — original "temperature" (cool / temperate / warm). */
  temperature?: 0 | 1 | 2;
  /** 0..2 — original "climate" (arid / normal / wet). */
  climate?: 0 | 1 | 2;
  /** 0..2 — original "age" (3 / 4 / 5 billion years): erosion passes. */
  age?: 0 | 1 | 2;
}

/**
 * World generator in the spirit of the 1991 algorithm: land is grown as a
 * series of random-walk "chunks" stamped onto an elevation map, eroded by
 * age, then terrain is assigned by latitude band (temperature), elevation,
 * and a moisture pass (climate). Rivers run from hills to the sea and
 * specials follow a fixed lattice so they appear in the familiar spread.
 *
 * Every random draw comes from the game's RNG, so a seed reproduces a world.
 */
export function generateMap(rng: RngState, opts: MapGenOptions = {}): WorldMap {
  const w = MAP_WIDTH;
  const h = MAP_HEIGHT;
  const landMass = opts.landMass ?? 1;
  const temperature = opts.temperature ?? 1;
  const climate = opts.climate ?? 1;
  const age = opts.age ?? 1;

  // ---- 1. elevation by random-walk chunks ---------------------------------
  const elev = new Uint8Array(w * h);
  const targetLand = Math.floor(w * h * [0.28, 0.36, 0.46][landMass]!);
  let landCount = 0;
  let guard = 0;
  while (landCount < targetLand && guard++ < 4000) {
    // Chunk origin, away from the poles.
    let x = nextInt(rng, w);
    let y = 4 + nextInt(rng, h - 8);
    const steps = 20 + nextInt(rng, 40);
    for (let i = 0; i < steps; i++) {
      // Stamp a 2x2-ish blob so coastlines are chunky rather than stringy.
      for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]] as const) {
        const yy = y + dy;
        if (yy < 2 || yy >= h - 2) continue;
        const idx = yy * w + wrapX({ width: w, height: h, tiles: [] }, x + dx);
        if (elev[idx] === 0) landCount++;
        elev[idx] = Math.min(255, elev[idx]! + 1);
      }
      const d = NEIGHBOURS[nextInt(rng, 8)]!;
      x = (x + d[0] + w) % w;
      y = Math.max(2, Math.min(h - 3, y + d[1]));
    }
  }

  // ---- 2. erosion: older worlds are smoother -------------------------------
  const passes = [1, 2, 3][age]!;
  for (let p = 0; p < passes; p++) {
    const next = new Uint8Array(elev);
    for (let y = 1; y < h - 1; y++)
      for (let x = 0; x < w; x++) {
        let land = 0;
        for (const [dx, dy] of NEIGHBOURS) if (elev[(y + dy) * w + ((x + dx + w) % w)]! > 0) land++;
        const i = y * w + x;
        if (elev[i]! > 0 && land <= 2) next[i] = 0; // lone spits sink
        else if (elev[i] === 0 && land >= 6) next[i] = 1; // lakes fill
      }
    elev.set(next);
  }

  // ---- 3. terrain by latitude / elevation / moisture -----------------------
  // Relief thresholds are percentiles of land elevation, so the proportion of
  // hills and mountains is stable whatever the walk density produced.
  const landElev = Array.from(elev).filter((e) => e > 0).sort((a, b) => a - b);
  const pct = (p: number) => landElev[Math.min(landElev.length - 1, Math.floor(landElev.length * p))] ?? 1;
  const hillsAt = pct(0.78);
  const mountainsAt = pct(0.91);
  const tiles: Tile[] = new Array(w * h);
  const blank = (terrain: Terrain): Tile => ({
    terrain, river: false, special: false, road: false, irrigation: false, mine: false, continent: 0,
  });
  for (let y = 0; y < h; y++) {
    const lat = Math.abs(y - (h - 1) / 2) / ((h - 1) / 2); // 0 equator .. 1 pole
    // Temperature shifts the bands toward/away from the poles.
    const t = lat - (temperature - 1) * 0.08;
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const e = elev[i]!;
      if (y === 0 || y === h - 1) { tiles[i] = blank(Terrain.Arctic); continue; }
      if (e === 0) { tiles[i] = blank(Terrain.Ocean); continue; }
      let terrain: Terrain;
      const roll = nextInt(rng, 100);
      if (t > 0.92) terrain = Terrain.Arctic;
      else if (t > 0.82) terrain = roll < 70 ? Terrain.Tundra : Terrain.Arctic;
      else if (e >= mountainsAt && e > hillsAt) terrain = roll < 75 ? Terrain.Mountains : Terrain.Hills;
      else if (e >= hillsAt && e > 1) terrain = roll < 70 ? Terrain.Hills : Terrain.Mountains;
      else {
        // Moisture: wetter climates grow more forest/swamp/jungle.
        const wet = roll + (climate - 1) * 15;
        if (t < 0.25) terrain = wet > 80 ? Terrain.Jungle : wet > 62 ? Terrain.Swamp : wet < 22 ? Terrain.Desert : wet < 50 ? Terrain.Plains : Terrain.Grassland;
        else if (t < 0.6) terrain = wet > 85 ? Terrain.Swamp : wet > 65 ? Terrain.Forest : wet < 15 ? Terrain.Desert : wet < 45 ? Terrain.Plains : Terrain.Grassland;
        else terrain = wet > 70 ? Terrain.Forest : wet > 60 ? Terrain.Swamp : wet < 40 ? Terrain.Plains : Terrain.Grassland;
      }
      tiles[i] = blank(terrain);
    }
  }
  const map: WorldMap = { width: w, height: h, tiles };

  // ---- 4. rivers: walk from hills toward lower ground until water ---------
  const riverSources = 16 + landMass * 6;
  let placed = 0;
  for (let attempt = 0; attempt < 400 && placed < riverSources; attempt++) {
    let x = nextInt(rng, w);
    let y = 3 + nextInt(rng, h - 6);
    const src = tiles[y * w + x]!;
    if (src.terrain !== Terrain.Hills && src.terrain !== Terrain.Mountains) continue;
    const path: number[] = [];
    let ok = false;
    for (let step = 0; step < 20; step++) {
      // Prefer the lowest neighbour; ties broken randomly.
      let best = -1;
      let bestE = elev[y * w + x]! + 1;
      const ortho = [[0, -1], [1, 0], [0, 1], [-1, 0]] as const;
      const spin = nextInt(rng, 4);
      for (let k = 0; k < 4; k++) {
        const [dx, dy] = ortho[(k + spin) % 4]!;
        const nx = (x + dx + w) % w;
        const ny = y + dy;
        if (ny < 1 || ny >= h - 1) continue;
        const ne = elev[ny * w + nx]!;
        if (ne < bestE && !path.includes(ny * w + nx)) { bestE = ne; best = ny * w + nx; }
      }
      if (best < 0) break;
      x = best % w;
      y = Math.floor(best / w);
      if (tiles[best]!.terrain === Terrain.Ocean) { ok = true; break; }
      if (tiles[best]!.terrain === Terrain.Arctic) break;
      path.push(best);
    }
    if (ok && path.length >= 2) {
      for (const i of path) tiles[i]!.river = true;
      placed++;
    }
  }

  // ---- 5. specials on a drifting lattice -----------------------------------
  const sx = nextInt(rng, 4);
  const sy = nextInt(rng, 4);
  for (let y = 1; y < h - 1; y++)
    for (let x = 0; x < w; x++) {
      const t = tiles[y * w + x]!;
      const lattice = ((x + sx) * 13 + (y + sy) * 11 + ((x + sx) >> 2)) % 32 === 0;
      if (lattice) t.special = true;
      else if (t.terrain === Terrain.Ocean && (x * 7 + y * 3 + sx) % 29 === 0) t.special = true;
    }

  labelContinents(map);
  return map;
}

/** Flood-fill continent/ocean ids (1-based) so "same landmass" is a lookup. */
export function labelContinents(map: WorldMap): void {
  const { width: w, height: h, tiles } = map;
  for (const t of tiles) t.continent = 0;
  let next = 1;
  const stack: number[] = [];
  for (let i = 0; i < tiles.length; i++) {
    if (tiles[i]!.continent) continue;
    const water = tiles[i]!.terrain === Terrain.Ocean;
    const id = next++;
    stack.push(i);
    tiles[i]!.continent = id;
    while (stack.length) {
      const c = stack.pop()!;
      const cx = c % w;
      const cy = Math.floor(c / w);
      for (const [dx, dy] of NEIGHBOURS) {
        const ny = cy + dy;
        if (ny < 0 || ny >= h) continue;
        const n = ny * w + ((cx + dx + w) % w);
        const nt = tiles[n]!;
        if (nt.continent || (nt.terrain === Terrain.Ocean) !== water) continue;
        nt.continent = id;
        stack.push(n);
      }
    }
  }
}
