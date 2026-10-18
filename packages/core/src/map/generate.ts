import { nextFloat, nextInt, type RngState } from "../rng.js";
import { MAP_HEIGHT, MAP_WIDTH, NEIGHBOURS, Terrain, wrapX, type Tile, type WorldMap } from "../types.js";

export interface MapGenOptions {
  /** 0..2 — original "land mass" setting (small / normal / large). */
  landMass?: 0 | 1 | 2;
  /** 0..2 — original "temperature" (cool / temperate / warm). */
  temperature?: 0 | 1 | 2;
  /** 0..2 — original "climate" (arid / normal / wet). */
  climate?: 0 | 1 | 2;
  /** 0..2 — original "age" (3 / 4 / 5 billion years): erosion passes, and fewer mountains as it wears. */
  age?: 0 | 1 | 2;
  /**
   * The first generator: every land square's terrain rolled on its own within
   * latitude bands. Saves from before version 6 rebuild their world with it.
   */
  scatteredTerrain?: boolean;
}

/**
 * World generator in the spirit of the 1991 algorithm: land is grown as a
 * series of random-walk "chunks" stamped onto an elevation map and eroded by
 * age; then the climate decides the terrain (see `climateWorld`), rivers run
 * from wet highlands to the sea, and specials follow a fixed lattice so they
 * appear in the familiar spread.
 *
 * Every random draw comes from the game's RNG, so a seed reproduces a world.
 */
export function generateMap(rng: RngState, opts: MapGenOptions = {}): WorldMap {
  const w = MAP_WIDTH;
  const h = MAP_HEIGHT;
  const landMass = opts.landMass ?? 1;
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

  // ---- 3. terrain and rivers ------------------------------------------------
  const map = opts.scatteredTerrain ? scatteredWorld(rng, elev, opts) : climateWorld(rng, elev, opts);

  // ---- 4. specials and villages --------------------------------------------
  scatterSpecials(map, rng);

  labelContinents(map);
  return map;
}

/** The first generator's terrain and rivers: each land square rolled on its own (saves before version 6). */
function scatteredWorld(rng: RngState, elev: Uint8Array, opts: MapGenOptions): WorldMap {
  const w = MAP_WIDTH;
  const h = MAP_HEIGHT;
  const landMass = opts.landMass ?? 1;
  const temperature = opts.temperature ?? 1;
  const climate = opts.climate ?? 1;

  // ---- 3. terrain by latitude / elevation / moisture -----------------------
  // Relief thresholds are percentiles of land elevation, so the proportion of
  // hills and mountains is stable whatever the walk density produced.
  const landElev = Array.from(elev).filter((e) => e > 0).sort((a, b) => a - b);
  const pct = (p: number) => landElev[Math.min(landElev.length - 1, Math.floor(landElev.length * p))] ?? 1;
  const hillsAt = pct(0.78);
  const mountainsAt = pct(0.91);
  const tiles: Tile[] = new Array(w * h);
  const blank = blankTile;
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
  return map;
}

/**
 * Terrain from climate, so like terrain gathers in regions instead of
 * speckling the land. Smooth fields (noise that wraps east-west, drawn from
 * the game's RNG) give every square:
 *  - relief: mountain ranges along noise ridges, raised where the land walks
 *    piled up, with hills as their foothills; older worlds keep fewer peaks;
 *  - heat: falling from the equator to the poles and with height;
 *  - rain: in latitude belts (wet tropics, dry subtropics, wet mid-latitudes,
 *    dry poles) and on the prevailing winds (easterlies in the tropics and
 *    near the poles, westerlies between), which lose it crossing land and
 *    above all mountains, leaving dry interiors and rain shadows.
 * Heat and rain pick the biome: jungle where hot and wet, desert where hot
 * and dry, forest where cool and wet, tundra and ice toward the poles,
 * swamp on soaked lowland coasts. Lone squares then take the terrain around
 * them, and rivers rise in wet highlands and run downhill to the sea,
 * joining where they meet.
 */
function climateWorld(rng: RngState, elev: Uint8Array, opts: MapGenOptions): WorldMap {
  const w = MAP_WIDTH;
  const h = MAP_HEIGHT;
  const landMass = opts.landMass ?? 1;
  const temperature = opts.temperature ?? 1;
  const climate = opts.climate ?? 1;
  const age = opts.age ?? 1;
  const n = w * h;
  const land = (i: number) => elev[i]! > 0;
  const latOf = (y: number) => Math.abs(y - (h - 1) / 2) / ((h - 1) / 2); // 0 equator .. 1 pole
  const shore = seaDistance(elev, w, h);

  // ---- relief --------------------------------------------------------------
  const ridges = noiseField(rng, w, h, [12, 6], [0.7, 0.3]);
  let maxElev = 1;
  for (let i = 0; i < n; i++) maxElev = Math.max(maxElev, elev[i]!);
  const piled = blur(Float32Array.from(elev, (e) => e / maxElev), w, h, 1);
  const relief = new Float32Array(n);
  const ranked: number[] = [];
  for (let i = 0; i < n; i++) {
    if (!land(i)) continue;
    const ridge = Math.pow(1 - Math.abs(2 * ridges[i]! - 1), 3);
    relief[i] = 0.65 * ridge + 0.2 * piled[i]! + 0.15 * Math.min(shore[i]!, 5) / 5;
    const y = Math.floor(i / w);
    if (y > 0 && y < h - 1) ranked.push(relief[i]!);
  }
  ranked.sort((a, b) => a - b);
  const above = (share: number) => ranked[Math.min(ranked.length - 1, Math.floor(ranked.length * (1 - share)))] ?? 1;
  const mountainShare = [0.09, 0.075, 0.06][age]!;
  const mountainsAt = above(mountainShare);
  const hillsAt = above(mountainShare + [0.11, 0.12, 0.13][age]!);

  // ---- heat and rain -------------------------------------------------------
  const warmth = noiseField(rng, w, h, [20, 10], [0.6, 0.4]);
  const damp = noiseField(rng, w, h, [12, 5, 3], [0.35, 0.35, 0.3]);
  const winds = windRain(elev, relief, hillsAt, mountainsAt, w, h);
  const heat = new Float32Array(n);
  const wet = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const lat = latOf(Math.floor(i / w));
    heat[i] = 1 - lat + 0.16 * (warmth[i]! - 0.5) + (temperature - 1) * 0.08 - 0.12 * relief[i]!;
    const belt = 0.5 + 0.5 * Math.cos(3 * Math.PI * lat);
    wet[i] = 0.35 * belt + 0.3 * winds[i]! + 0.35 * damp[i]! + (shore[i] === 1 ? 0.05 : 0);
  }
  // Rain as a rank among the land (0 driest .. 1 wettest), so each biome keeps
  // a steady share in the driest or wettest places whatever the noise drew;
  // the climate setting shifts the whole world drier or wetter.
  const order: number[] = [];
  for (let i = 0; i < n; i++) if (land(i)) order.push(i);
  order.sort((a, b) => wet[a]! - wet[b]! || a - b);
  const rain = new Float32Array(n);
  order.forEach((i, k) => { rain[i] = k / Math.max(1, order.length - 1) + (climate - 1) * 0.1; });

  // ---- terrain -------------------------------------------------------------
  const kind = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const y = Math.floor(i / w);
    if (y === 0 || y === h - 1) kind[i] = Terrain.Arctic;
    else if (!land(i)) kind[i] = Terrain.Ocean;
    else if (heat[i]! < ICE) kind[i] = Terrain.Arctic;
    else if (relief[i]! >= mountainsAt) kind[i] = Terrain.Mountains;
    else if (relief[i]! >= hillsAt) kind[i] = Terrain.Hills;
    else kind[i] = biome(heat[i]!, rain[i]!, shore[i]!);
  }
  // Lone squares take the terrain around them, so regions read as regions.
  const settled = new Uint8Array(kind);
  const tally = new Uint8Array(16);
  for (let y = 1; y < h - 1; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!flat(kind[i]!)) continue;
      tally.fill(0);
      for (const [dx, dy] of NEIGHBOURS) {
        const k = kind[(y + dy) * w + ((x + dx + w) % w)]!;
        if (flat(k)) tally[k]!++;
      }
      let best = kind[i]!;
      for (let k = 0; k < tally.length; k++) if (tally[k]! > tally[best]!) best = k;
      if (tally[kind[i]!]! <= 1 && tally[best]! >= 4) settled[i] = best;
    }
  const tiles: Tile[] = Array.from(settled, (k) => blankTile(k as Terrain));
  const map: WorldMap = { width: w, height: h, tiles };

  // ---- rivers --------------------------------------------------------------
  // Downhill is lower relief, and nearer the sea on level ground.
  const fall = (i: number) => relief[i]! + 0.02 * shore[i]!;
  const sources: number[] = [];
  for (let i = 0; i < n; i++) {
    const t = tiles[i]!.terrain;
    if ((t === Terrain.Hills || t === Terrain.Mountains) && rain[i]! > 0.4) sources.push(i);
  }
  const wanted = Math.round([14, 20, 26][landMass]! * [0.7, 1, 1.3][climate]!);
  let placed = 0;
  for (let attempt = 0; attempt < 600 && placed < wanted && sources.length; attempt++) {
    let at = sources[nextInt(rng, sources.length)]!;
    if (tiles[at]!.river) continue;
    const path: number[] = [];
    let ok = false;
    for (let step = 0; step < 30; step++) {
      const x = at % w;
      const y = Math.floor(at / w);
      const spin = nextInt(rng, 4);
      let next = -1;
      for (let k = 0; k < 4; k++) {
        const [dx, dy] = ORTHO[(k + spin) % 4]!;
        const ny = y + dy;
        if (ny < 1 || ny >= h - 1) continue;
        const j = ny * w + ((x + dx + w) % w);
        if (j === at || path.includes(j)) continue;
        // The sea next door ends the river; otherwise the lowest square leads on.
        if (tiles[j]!.terrain === Terrain.Ocean) { next = j; break; }
        if (next < 0 || fall(j) < fall(next)) next = j;
      }
      if (next < 0) break;
      const t = tiles[next]!;
      if (t.terrain === Terrain.Ocean || t.river) { ok = true; break; } // the sea, or a river it joins
      if (t.terrain === Terrain.Arctic) break;
      path.push(next);
      at = next;
    }
    if (ok && path.length >= 2) {
      for (const i of path) tiles[i]!.river = true;
      placed++;
    }
  }
  return map;
}

/** Below this heat a square is ice whatever its relief. */
const ICE = 0.1;

const ORTHO = [[0, -1], [1, 0], [0, 1], [-1, 0]] as const;

/** Terrain that lies flat: what biomes are made of (not ice, hills or mountains). */
function flat(k: number): boolean {
  return k !== Terrain.Ocean && k !== Terrain.Arctic && k !== Terrain.Hills && k !== Terrain.Mountains;
}

/**
 * The terrain of level land of this heat and rain (a rank, 0 driest .. 1
 * wettest); soaked lowland coasts turn to swamp.
 */
function biome(heat: number, rain: number, shore: number): Terrain {
  if (rain > 0.9 && shore <= 1 && heat > 0.3) return Terrain.Swamp;
  if (heat < 0.24) return rain > 0.65 ? Terrain.Forest : Terrain.Tundra;
  if (heat < 0.5) return rain > 0.62 ? Terrain.Forest : rain > 0.3 ? Terrain.Grassland : Terrain.Plains;
  if (heat < 0.75) return rain > 0.74 ? Terrain.Forest : rain > 0.36 ? Terrain.Grassland : rain > 0.12 ? Terrain.Plains : Terrain.Desert;
  return rain > 0.62 ? Terrain.Jungle : rain > 0.36 ? Terrain.Grassland : rain > 0.14 ? Terrain.Plains : Terrain.Desert;
}

/**
 * Smooth noise in 0..1 that wraps east-west: random values on coarse
 * lattices (one per `cells` size, in squares), eased between and summed
 * with `weights`.
 */
function noiseField(rng: RngState, w: number, h: number, cells: number[], weights: number[]): Float32Array {
  const out = new Float32Array(w * h);
  const ease = (t: number) => t * t * (3 - 2 * t);
  cells.forEach((cell, o) => {
    const gw = Math.max(1, Math.round(w / cell));
    const gh = Math.ceil(h / cell) + 1;
    const lattice = new Float32Array(gw * gh);
    for (let k = 0; k < lattice.length; k++) lattice[k] = nextFloat(rng);
    const at = (gx: number, gy: number) => lattice[gy * gw + (gx % gw)]!;
    for (let y = 0; y < h; y++) {
      const fy = y / cell;
      const gy = Math.floor(fy);
      const ty = ease(fy - gy);
      for (let x = 0; x < w; x++) {
        const fx = (x * gw) / w;
        const gx = Math.floor(fx);
        const tx = ease(fx - gx);
        const top = at(gx, gy) + (at(gx + 1, gy) - at(gx, gy)) * tx;
        const bottom = at(gx, gy + 1) + (at(gx + 1, gy + 1) - at(gx, gy + 1)) * tx;
        out[y * w + x]! += (top + (bottom - top) * ty) * weights[o]!;
      }
    }
  });
  return out;
}

/** A 3x3 box blur, `passes` times, wrapping east-west. */
function blur(field: Float32Array, w: number, h: number, passes: number): Float32Array {
  let cur = field;
  for (let p = 0; p < passes; p++) {
    const next = new Float32Array(cur.length);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        let sum = 0;
        let count = 0;
        for (let dy = -1; dy <= 1; dy++) {
          const yy = y + dy;
          if (yy < 0 || yy >= h) continue;
          for (let dx = -1; dx <= 1; dx++) { sum += cur[yy * w + ((x + dx + w) % w)]!; count++; }
        }
        next[y * w + x] = sum / count;
      }
    cur = next;
  }
  return cur;
}

/** Squares to the nearest sea square (0 at sea), counting diagonal steps. */
function seaDistance(elev: Uint8Array, w: number, h: number): Uint8Array {
  const dist = new Uint8Array(w * h).fill(255);
  const queue: number[] = [];
  for (let i = 0; i < w * h; i++) if (elev[i] === 0) { dist[i] = 0; queue.push(i); }
  for (let q = 0; q < queue.length; q++) {
    const i = queue[q]!;
    const x = i % w;
    const y = Math.floor(i / w);
    for (const [dx, dy] of NEIGHBOURS) {
      const ny = y + dy;
      if (ny < 0 || ny >= h) continue;
      const j = ny * w + ((x + dx + w) % w);
      if (dist[j]! <= dist[i]! + 1) continue;
      dist[j] = dist[i]! + 1;
      queue.push(j);
    }
  }
  return dist;
}

/**
 * Rain the prevailing wind brings, 0..1: each row's wind (from the east in
 * the tropics and near the poles, from the west between) fills up over the
 * sea and loses some over every land square it crosses, most over hills and
 * mountains, so windward coasts are wet and interiors and lee sides dry.
 */
function windRain(elev: Uint8Array, relief: Float32Array, hillsAt: number, mountainsAt: number, w: number, h: number): Float32Array {
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const lat = Math.abs(y - (h - 1) / 2) / ((h - 1) / 2);
    const step = lat < 1 / 3 || lat > 2 / 3 ? -1 : 1; // easterlies blow westward
    let from = 0;
    while (from < w && elev[y * w + from]! > 0) from++;
    let carry = from < w ? 1 : 0.6;
    for (let k = 0; k < w; k++) {
      const i = y * w + ((((from % w) + step * k) % w) + w) % w;
      if (elev[i] === 0) { carry = 1; out[i] = 1; continue; }
      out[i] = carry;
      carry *= relief[i]! >= mountainsAt ? 0.45 : relief[i]! >= hillsAt ? 0.7 : 0.85;
    }
  }
  return blur(out, w, h, 2);
}
/** An unimproved tile of the given terrain. */
export function blankTile(terrain: Terrain): Tile {
  return {
    terrain, river: false, special: false, road: false, irrigation: false, mine: false, hut: false,
    railroad: false, fortress: false, pollution: false, continent: 0,
  };
}

/**
 * Specials on a drifting lattice (so they appear in the familiar spread) and
 * minor-tribe villages, roughly one per 60 land tiles and never on the poles.
 * Shared by generated and premade worlds; the lattice offset and the
 * villages come from the game's RNG, so each seed scatters them anew.
 */
export function scatterSpecials(map: WorldMap, rng: RngState): void {
  const { width: w, height: h, tiles } = map;
  const sx = nextInt(rng, 4);
  const sy = nextInt(rng, 4);
  for (let y = 1; y < h - 1; y++)
    for (let x = 0; x < w; x++) {
      const t = tiles[y * w + x]!;
      const lattice = ((x + sx) * 13 + (y + sy) * 11 + ((x + sx) >> 2)) % 32 === 0;
      if (lattice) t.special = true;
      else if (t.terrain === Terrain.Ocean && (x * 7 + y * 3 + sx) % 29 === 0) t.special = true;
    }
  for (let y = 2; y < h - 2; y++)
    for (let x = 0; x < w; x++) {
      const t = tiles[y * w + x]!;
      if (t.terrain === Terrain.Ocean || t.terrain === Terrain.Arctic) continue;
      if (nextInt(rng, 60) === 0) t.hut = true;
    }
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
