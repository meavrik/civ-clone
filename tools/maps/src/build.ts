import { MAP_WIDTH, NEIGHBOURS, Terrain, TERRAIN_CHARS, WORLD_SIZES, worldSize, type PlaceTable, type WorldSize } from "@civ/core";
import type { Image } from "@civ/sprites-tool";
import { HAND_ZONES, latitudeMix, MIXES, patchNoise, pick, regionZone, ZONE_RANK, type Zone } from "./climate.js";
import { dataLon, fromGrid, project, type Frame } from "./frames.js";
import { bboxOf, prop, ScanFill, supercover, type Polyline, type Pt, type Shape } from "./geo.js";
import { buildPlaces } from "./places.js";

export interface GeoData {
  land: Shape[];
  lakes: Shape[];
  regions: Shape[];
  rivers: Polyline[];
}

export interface BuiltWorld {
  rows: string[];
  /** Each square's landmass (an index from `landmasses`, or an ice row's own), -1 at sea. */
  landmass: Int32Array;
  starts: Record<string, [number, number]>;
  /** Its real places: seas, lakes, landforms, continents and islands (`places.ts`). */
  places: PlaceTable;
  preview: Image;
  report: string[];
}

/** Samples per square along each axis. */
const S = 6;

/**
 * The frame on a bigger world's grid: its breakpoints are given in squares of
 * the original's 80x50, so every column and row is stretched by the size's scale.
 */
export function scaleFrame(frame: Frame, size: WorldSize): Frame {
  const k = worldSize(size).width / MAP_WIDTH;
  if (k === 1) return frame;
  return { ...frame, lon: frame.lon.map(([v, t]) => [v, t * k]), lat: frame.lat.map(([v, t]) => [v, t * k]) };
}

/** Sample positions: S latitudes per row and S longitudes per column, inside the frame. */
function sampleGrid(frame: Frame, W: number, H: number): { lats: number[]; lons: number[] } {
  const lats: number[] = [];
  for (let y = 0; y < H; y++) for (let j = 0; j < S; j++) lats.push(fromGrid(frame.lat, y + (j + 0.5) / S));
  const lons: number[] = [];
  for (let x = 0; x < W; x++) for (let i = 0; i < S; i++) lons.push(dataLon(fromGrid(frame.lon, x + (i + 0.5) / S)));
  return { lats, lons };
}

/** Fraction of each square's samples inside the rings, limited to the rings' bounding box. */
function coverage(rings: readonly (readonly Pt[])[], bbox: readonly number[], lats: number[], lons: number[], W: number, H: number): Float32Array {
  const cov = new Float32Array(W * H);
  const rowsIn: number[] = [];
  for (let r = 0; r < lats.length; r++) if (lats[r]! >= bbox[1]! && lats[r]! <= bbox[3]!) rowsIn.push(r);
  if (!rowsIn.length) return cov;
  const colsIn: number[] = [];
  for (let c = 0; c < lons.length; c++) if (lons[c]! >= bbox[0]! && lons[c]! <= bbox[2]!) colsIn.push(c);
  if (!colsIn.length) return cov;
  const fill = new ScanFill(rings, rowsIn.map((r) => lats[r]!));
  rowsIn.forEach((r, k) => {
    const y = Math.floor(r / S);
    for (const c of colsIn) if (fill.inside(k, lons[c]!)) cov[y * W + Math.floor(c / S)]! += 1 / (S * S);
  });
  return cov;
}

const WORLD_BBOX = [-180, -90, 180, 90];

function wrapDist(frame: Frame, W: number, a: readonly [number, number], b: readonly [number, number]): number {
  const dx = Math.abs(a[0] - b[0]);
  return Math.max(frame.global || frame.seam ? Math.min(dx, W - dx) : dx, Math.abs(a[1] - b[1]));
}

export function buildWorld(base: Frame, data: GeoData, size: WorldSize = "small"): BuiltWorld {
  const { width: W, height: H } = worldSize(size);
  const frame = scaleFrame(base, size);
  const { lats, lons } = sampleGrid(frame, W, H);
  const report: string[] = [];
  const idx = (x: number, y: number) => y * W + (((x % W) + W) % W);

  // ---- land and water ------------------------------------------------------
  // Each square belongs to the landmass covering most of it (see `landmasses`); `owner` is -1 at sea.
  const group = landmasses(data.land);
  const masses = Math.max(0, ...group) + 1;
  const foot = Array.from({ length: masses }, () => ({ squares: [] as number[], cov: [] as number[], area: 0 }));
  const landCov = new Float32Array(W * H);
  const owner = new Int32Array(W * H).fill(-1);
  const ownCov = new Float32Array(W * H);
  const sum = new Float32Array(W * H);
  const byMass = Array.from({ length: masses }, () => [] as Shape[]);
  data.land.forEach((shape, k) => byMass[group[k]!]!.push(shape));
  byMass.forEach((pieces, m) => {
    sum.fill(0);
    for (const shape of pieces) {
      const cov = coverage(shape.rings, shape.bbox, lats, lons, W, H);
      for (let i = 0; i < W * H; i++) sum[i]! += cov[i]!;
    }
    const f = foot[m]!;
    for (let i = 0; i < W * H; i++) {
      const c = sum[i]!;
      if (!c) continue;
      f.squares.push(i);
      f.cov.push(c);
      f.area += c;
      landCov[i]! += c;
      if (c > ownCov[i]!) { ownCov[i] = c; owner[i] = m; }
    }
  });
  // Natural lakes only: reservoirs are modern.
  const lakeShapes = data.lakes.filter((l) => /lake/i.test(prop(l.props, "featurecla")) && Number(prop(l.props, "scalerank")) <= frame.lakeRank);
  const lakeCov = coverage(lakeShapes.flatMap((s) => s.rings), WORLD_BBOX, lats, lons, W, H);
  const land = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) land[i] = landCov[i]! - lakeCov[i]! >= 0.5 ? 1 : 0;

  // Islands smaller than a square still get one if they cover a fair part of it.
  let rescued = 0;
  foot.forEach((f, m) => {
    if (f.area < 0.22 || f.squares.some((i) => land[i])) return;
    let best = 0;
    for (let k = 1; k < f.cov.length; k++) if (f.cov[k]! > f.cov[best]!) best = k;
    const i = f.squares[best]!;
    land[i] = 1;
    owner[i] = m;
    ownCov[i] = f.cov[best]!;
    rescued++;
  });
  report.push(`islands rescued: ${rescued}`);

  // Water specks the grid made out of coastline (not real lakes) fill in, unless they part two landmasses.
  const seen = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) {
    if (land[i] || seen[i]) continue;
    const comp = [i];
    const shores = new Set<number>();
    seen[i] = 1;
    for (let k = 0; k < comp.length; k++) {
      const cx = comp[k]! % W;
      const cy = Math.floor(comp[k]! / W);
      for (const [dx, dy] of NEIGHBOURS) {
        const ny = cy + dy;
        if (ny < 0 || ny >= H) continue;
        const n = idx(cx + dx, ny);
        if (land[n]) { shores.add(owner[n]!); continue; }
        if (seen[n]) continue;
        seen[n] = 1;
        comp.push(n);
      }
    }
    if (comp.length <= 2 && shores.size <= 1 && comp.every((n) => lakeCov[n]! < 0.4))
      for (const n of comp) { land[n] = 1; owner[n] = [...shores][0] ?? -1; }
  }

  const drawLine = (line: Pt[], value: 0 | 1) => {
    for (let k = 0; k < line.length - 1; k++) {
      const [x0, y0] = project(frame, line[k]!);
      const [x1, y1] = project(frame, line[k + 1]!);
      for (const [x, y] of supercover(x0, y0, x1, y1)) if (y >= 0 && y < H && x >= 0 && x < W) land[idx(x, y)] = value;
    }
  };
  for (const line of frame.water ?? []) drawLine(line, 0);
  for (const line of frame.land ?? []) drawLine(line, 1);
  for (const ring of frame.seas ?? []) {
    const closed = [...ring, ring[0]!];
    const cov = coverage([closed], bboxOfRing(closed), lats, lons, W, H);
    for (let i = 0; i < W * H; i++) if (cov[i]! >= 0.5) land[i] = 0;
  }
  if (frame.seam) for (let y = 0; y < H; y++) land[idx(0, y)] = 0;
  const polar = (i: number) => frame.polar && (i < W || i >= (H - 1) * W);
  if (frame.polar)
    for (const row of [0, H - 1]) {
      // The ice row is the landmass covering most of it (Antarctica), or a landmass of its own.
      const tally = new Map<number, number>();
      for (let x = 0; x < W; x++) if (land[row * W + x]) tally.set(owner[row * W + x]!, (tally.get(owner[row * W + x]!) ?? 0) + 1);
      const [top, count] = [...tally].filter(([m]) => m >= 0).sort((a, b) => b[1] - a[1])[0] ?? [-1, 0];
      const ice = count >= W / 2 ? top : masses + row;
      for (let x = 0; x < W; x++) { land[row * W + x] = 1; owner[row * W + x] = ice; }
    }
  const homeSquares = new Set<number>();
  for (const home of Object.values(frame.homes)) {
    const [hx, hy] = project(frame, home);
    if (hy >= 0 && hy < H) homeSquares.add(idx(Math.floor(hx), Math.floor(hy)));
  }
  const separated = separateLandmasses(land, owner, ownCov, foot.map((f) => f.area), W, H, polar, homeSquares);
  for (let i = 0; i < W * H; i++) if (!land[i]) owner[i] = -1;
  const mixed = mixedLandmasses(owner, W, H);
  if (mixed) throw new Error(`${frame.id} ${size}: landmasses ${mixed} joined by land`);
  report.push(`landmasses kept apart: ${separated.sunk} squares sunk${separated.lost ? `, ${separated.lost} islands too small to keep` : ""}`);

  // ---- climate zones ----------------------------------------------------------
  const zoneCov = new Map<Zone, Float32Array>();
  const addZone = (zone: Zone, cov: Float32Array) => {
    const cur = zoneCov.get(zone);
    if (!cur) { zoneCov.set(zone, cov); return; }
    for (let i = 0; i < W * H; i++) cur[i] = Math.max(cur[i]!, cov[i]!);
  };
  for (const r of data.regions) {
    const zone = regionZone(prop(r.props, "FEATURECLA"), prop(r.props, "NAME"), Number(prop(r.props, "SCALERANK")));
    if (zone) addZone(zone, coverage(r.rings, r.bbox, lats, lons, W, H));
  }
  for (const { zone, ring } of HAND_ZONES) {
    const closed = [...ring, ring[0]!];
    addZone(zone, coverage([closed], bboxOfRing(closed), lats, lons, W, H));
  }

  const terrain = new Array<Terrain>(W * H).fill(Terrain.Ocean);
  const seed = [...frame.id].reduce((h, ch) => Math.imul(h ^ ch.charCodeAt(0), 16777619), 2166136261);
  const noise = patchNoise(W, H, seed);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (!land[i]) continue;
      if (frame.polar && (y === 0 || y === H - 1)) { terrain[i] = Terrain.Arctic; continue; }
      const lat = fromGrid(frame.lat, y + 0.5);
      const lon = dataLon(fromGrid(frame.lon, x + 0.5));
      const cov = (z: Zone) => zoneCov.get(z)?.[i] ?? 0;
      let zone: Zone | null = null;
      for (const [z, c] of zoneCov) {
        const need = z === "mountains" ? 0.45 : 0.4;
        if (c[i]! < need) continue;
        if (zone === null || ZONE_RANK.get(z)! < ZONE_RANK.get(zone)!) zone = z;
      }
      // The foot of a range is hilly.
      if (zone === null && cov("mountains") >= 0.2) zone = "hills";
      let mix = zone ? MIXES[zone] : latitudeMix(lon, lat);
      // Hills and peaks in a desert stay dry.
      if ((zone === "hills" || zone === "mountains") && Math.max(cov("desert"), cov("arid"), cov("aridHigh")) >= 0.4)
        mix = mix.map(([t, w]) => [t === Terrain.Forest || t === Terrain.Plains || t === Terrain.Grassland ? Terrain.Desert : t, w]);
      // Far north the cold wins over the zone.
      if (Math.abs(lat) >= 72 && zone !== "ice") mix = latitudeMix(lon, lat);
      terrain[i] = pick(mix, noise[i]!);
    }

  // ---- rivers -------------------------------------------------------------------
  const river = new Uint8Array(W * H);
  const wanted = new Set(frame.riverNames ?? []);
  const isCanal = (name: string) => /canal|csatorna/i.test(name);
  let riverCount = 0;
  for (const r of data.rivers) {
    const name = prop(r.props, "name");
    const rank = Number(prop(r.props, "scalerank"));
    if (isCanal(name) || !(rank <= frame.riverRank || wanted.has(name))) continue;
    riverCount++;
    for (let k = 0; k < r.points.length - 1; k++) {
      const [x0, y0] = project(frame, r.points[k]!);
      const [x1, y1] = project(frame, r.points[k + 1]!);
      if (Math.abs(x1 - x0) > W / 2) continue; // across the seam
      for (const [x, y] of supercover(x0, y0, x1, y1)) {
        if (y < 0 || y >= H || x < 0 || x >= W) continue;
        const i = y * W + x;
        if (terrain[i] !== Terrain.Ocean && terrain[i] !== Terrain.Arctic) river[i] = 1;
      }
    }
  }
  // A river through desert waters a strip of farmland, as the Nile does.
  for (let i = 0; i < W * H; i++) if (river[i] && terrain[i] === Terrain.Desert) terrain[i] = Terrain.Grassland;
  report.push(`rivers drawn: ${riverCount}`);

  // ---- homelands ----------------------------------------------------------------------
  const starts: Record<string, [number, number]> = {};
  const good = (t: Terrain, r: boolean) =>
    t === Terrain.Grassland || t === Terrain.Plains || t === Terrain.Hills || (r && t !== Terrain.Mountains && t !== Terrain.Arctic && t !== Terrain.Ocean);
  for (const [civ, home] of Object.entries(frame.homes)) {
    const [hx, hy] = project(frame, home);
    let best: [number, number] | null = null;
    let bestScore = Infinity;
    for (let dy = -3; dy <= 3; dy++)
      for (let dx = -3; dx <= 3; dx++) {
        const x = Math.floor(hx) + dx;
        const y = Math.floor(hy) + dy;
        if (y < 0 || y >= H || (!frame.global && (x < 0 || x >= W))) continue;
        const i = idx(x, y);
        if (!good(terrain[i]!, river[i] === 1)) continue;
        const ex = x + 0.5 - hx;
        const ey = y + 0.5 - hy;
        const score = ex * ex + ey * ey - (river[i] ? 0.6 : 0) + (terrain[i] === Terrain.Hills ? 0.3 : 0);
        if (score < bestScore) { bestScore = score; best = [((x % W) + W) % W, y]; }
      }
    if (!best) throw new Error(`${frame.id}: no land near the ${civ} homeland`);
    starts[civ] = best;
  }
  const names = Object.keys(starts);
  let closest = Infinity;
  let pair = "";
  for (let a = 0; a < names.length; a++)
    for (let b = a + 1; b < names.length; b++) {
      const d = wrapDist(frame, W, starts[names[a]!]!, starts[names[b]!]!);
      if (d < closest) { closest = d; pair = `${names[a]}/${names[b]}`; }
    }
  report.push(`homelands: ${names.map((n) => `${n} ${starts[n]!.join(",")}`).join("  ")}`);
  report.push(`closest homelands: ${pair} ${closest} squares`);
  const landTiles = terrain.filter((t) => t !== Terrain.Ocean).length;
  report.push(`land: ${Math.round((landTiles / (W * H)) * 100)}%`);

  const places = buildPlaces({
    terrain, landmass: owner, W, H, lakes: data.lakes, regions: data.regions,
    cover: (rings) => coverage(rings, bboxOf(rings), lats, lons, W, H),
  });
  report.push(...places.report);

  const rows: string[] = [];
  for (let y = 0; y < H; y++) {
    let row = "";
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const ch = TERRAIN_CHARS[terrain[i]!];
      row += river[i] ? ch.toUpperCase() : ch;
    }
    rows.push(row);
  }
  return { rows, landmass: owner, starts, places: places.table, preview: preview(terrain, river, starts, W, H), report };
}

/**
 * Natural Earth's land polygons grouped into landmasses: every polygon is a landmass of
 * its own (Afro-Eurasia is one, Britain another), except where the data cuts one at the
 * 180th meridian (Chukotka, Wrangel, Fiji): pieces meeting there at the same latitude join.
 */
export function landmasses(land: readonly Shape[]): number[] {
  const parent = land.map((_, i) => i);
  const find = (i: number): number => {
    while (parent[i] !== i) i = parent[i] = parent[parent[i]!]!;
    return i;
  };
  const east = new Map<string, number>();
  land.forEach((s, k) => { for (const [x, y] of s.rings.flat()) if (x >= 179.9999) east.set(y.toFixed(4), k); });
  land.forEach((s, k) => {
    for (const [x, y] of s.rings.flat()) {
      const e = x <= -179.9999 ? east.get(y.toFixed(4)) : undefined;
      if (e !== undefined) parent[find(k)] = find(e);
    }
  });
  const ids = new Map<number, number>();
  return land.map((_, i) => {
    const root = find(i);
    if (!ids.has(root)) ids.set(root, ids.size);
    return ids.get(root)!;
  });
}

/**
 * Keeps landmasses apart: wherever squares of two landmasses touch, side or corner (a unit
 * steps diagonally, so a corner is a land bridge), one goes under, so Britain stays off
 * France and Sicily off Italy at every size. Which one, in order: never an ice row, never the
 * square of a historical homeland (`homes`), never one whose landmass it would cut in two
 * (Attica stays on Greece when Euboea hugs its coast); an island keeps its last square when it
 * holds half a square of land or more and the neighbours it pushes under hold less land than
 * it does; otherwise the smaller landmass gives up its square unless the bigger one's is mostly
 * sea (a square costs what land of its own it holds, the bigger landmass's half a square more).
 * Land squares without a landmass (filled specks, drawn isthmuses) first take the nearest
 * one's. Returns how many squares sank and how many small islands went with them.
 */
export function separateLandmasses(
  land: Uint8Array, owner: Int32Array, ownCov: Float32Array, area: readonly number[], W: number, H: number,
  fixed: (i: number) => boolean, homes: ReadonlySet<number> = new Set(),
): { sunk: number; lost: number } {
  const neighbours = (i: number) => {
    const x = i % W;
    const y = Math.floor(i / W);
    const out: number[] = [];
    for (const [dx, dy] of NEIGHBOURS) if (y + dy >= 0 && y + dy < H) out.push((y + dy) * W + (((x + dx) % W) + W) % W);
    return out;
  };
  // Unclaimed land takes the nearest landmass across land.
  const queue: number[] = [];
  for (let i = 0; i < W * H; i++) if (land[i] && owner[i]! >= 0) queue.push(i);
  for (let q = 0; q < queue.length; q++)
    for (const n of neighbours(queue[q]!)) if (land[n] && owner[n]! < 0) { owner[n] = owner[queue[q]!]!; queue.push(n); }
  let fresh = Math.max(area.length, ...owner) + 1;
  for (let i = 0; i < W * H; i++) if (land[i] && owner[i]! < 0) owner[i] = fresh++;

  const size = new Map<number, number>();
  for (let i = 0; i < W * H; i++) if (land[i]) size.set(owner[i]!, (size.get(owner[i]!) ?? 0) + 1);
  const had = new Set(size.keys());
  const areaOf = (i: number) => area[owner[i]!] ?? 0;
  // Sinking a square cuts its landmass when its own neighbours do not join up round it.
  const RING = [[-1, -1], [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0]] as const;
  const cuts = (i: number) => {
    const x = i % W;
    const y = Math.floor(i / W);
    const near = RING.filter(([dx, dy]) => {
      if (y + dy < 0 || y + dy >= H) return false;
      const n = (y + dy) * W + (((x + dx) % W) + W) % W;
      return land[n] === 1 && owner[n] === owner[i];
    });
    if (near.length <= 1) return false;
    const reached = [near[0]!];
    for (let k = 0; k < reached.length; k++)
      for (const c of near) if (!reached.includes(c) && Math.abs(c[0] - reached[k]![0]) <= 1 && Math.abs(c[1] - reached[k]![1]) <= 1) reached.push(c);
    return reached.length < near.length;
  };
  const worthKeeping = (i: number) => {
    if (size.get(owner[i]!) !== 1 || areaOf(i) < 0.5) return false;
    let price = 0;
    for (const n of neighbours(i)) {
      if (!land[n] || owner[n] === owner[i]) continue;
      if (fixed(n) || homes.has(n) || cuts(n)) return false;
      price += ownCov[n]!;
    }
    return price < areaOf(i);
  };
  const cost = (i: number, other: number) => ownCov[i]! + (areaOf(i) > areaOf(other) ? 0.5 : 0);
  const victim = (a: number, b: number) => {
    if (fixed(a) !== fixed(b)) return fixed(a) ? b : a;
    if (homes.has(a) !== homes.has(b)) return homes.has(a) ? b : a;
    if (cuts(a) !== cuts(b)) return cuts(a) ? b : a;
    if (worthKeeping(a) !== worthKeeping(b)) return worthKeeping(a) ? b : a;
    const ca = cost(a, b);
    const cb = cost(b, a);
    if (ca !== cb) return ca < cb ? a : b;
    return areaOf(a) <= areaOf(b) ? a : b;
  };
  let sunk = 0;
  for (let changed = true; changed; ) {
    changed = false;
    for (let i = 0; i < W * H; i++) {
      if (!land[i]) continue;
      for (const n of neighbours(i)) {
        if (!land[n] || owner[n] === owner[i]) continue;
        const v = victim(i, n);
        if (fixed(v)) throw new Error(`landmasses ${owner[i]} and ${owner[n]} meet on the ice rows`);
        land[v] = 0;
        size.set(owner[v]!, size.get(owner[v]!)! - 1);
        sunk++;
        changed = true;
        if (v === i) break;
      }
    }
  }
  const lost = [...had].filter((m) => !size.get(m)).length;
  return { sunk, lost };
}

/** The first two landmasses found joined by land (as "a and b"), or null when every stretch of land is one landmass. */
export function mixedLandmasses(landmass: Int32Array, W: number, H: number): string | null {
  const seen = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) {
    if (landmass[i]! < 0 || seen[i]) continue;
    const stack = [i];
    seen[i] = 1;
    while (stack.length) {
      const c = stack.pop()!;
      const x = c % W;
      const y = Math.floor(c / W);
      for (const [dx, dy] of NEIGHBOURS) {
        if (y + dy < 0 || y + dy >= H) continue;
        const n = (y + dy) * W + (((x + dx) % W) + W) % W;
        if (landmass[n]! < 0 || seen[n]) continue;
        if (landmass[n] !== landmass[i]) return `${landmass[i]} and ${landmass[n]}`;
        seen[n] = 1;
        stack.push(n);
      }
    }
  }
  return null;
}

function bboxOfRing(ring: Pt[]): [number, number, number, number] {
  let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
  for (const [x, y] of ring) { a = Math.min(a, x); b = Math.min(b, y); c = Math.max(c, x); d = Math.max(d, y); }
  return [a, b, c, d];
}

// ---- preview image ------------------------------------------------------------------
/** Preview pixels a square: about 640 wide at every size. */
const previewPx = (W: number) => Math.max(4, Math.round(640 / W));
const COLORS: Record<Terrain, [number, number, number]> = {
  [Terrain.Ocean]: [30, 60, 140],
  [Terrain.Grassland]: [80, 160, 60],
  [Terrain.Plains]: [170, 170, 70],
  [Terrain.Forest]: [30, 100, 40],
  [Terrain.Hills]: [140, 110, 70],
  [Terrain.Mountains]: [110, 100, 100],
  [Terrain.Desert]: [220, 200, 130],
  [Terrain.Tundra]: [150, 160, 150],
  [Terrain.Arctic]: [240, 240, 250],
  [Terrain.Swamp]: [70, 110, 100],
  [Terrain.Jungle]: [20, 130, 70],
};

function preview(terrain: Terrain[], river: Uint8Array, starts: Record<string, [number, number]>, W: number, H: number): Image {
  const PX = previewPx(W);
  const img: Image = { width: W * PX, height: H * PX, data: new Uint8Array(W * PX * H * PX * 4) };
  const put = (px: number, py: number, [r, g, b]: [number, number, number]) => {
    const o = (py * img.width + px) * 4;
    img.data[o] = r; img.data[o + 1] = g; img.data[o + 2] = b; img.data[o + 3] = 255;
  };
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      for (let py = 0; py < PX; py++) for (let px = 0; px < PX; px++) put(x * PX + px, y * PX + py, COLORS[terrain[i]!]);
      const r0 = PX >> 1;
      if (river[i]) for (let py = r0 - 1; py < r0 + 1; py++) for (let px = r0 - 1; px < r0 + 1; px++) put(x * PX + px, y * PX + py, [60, 140, 255]);
    }
  for (const [x, y] of Object.values(starts))
    for (let py = 1; py < PX - 1; py++) for (let px = 1; px < PX - 1; px++) if (py === 1 || py === PX - 2 || px === 1 || px === PX - 2) put(x * PX + px, y * PX + py, [255, 30, 30]);
  return img;
}

/** A world's real places as lines of its generated module. */
function placeLines(places: PlaceTable): string[] {
  const names = (key: string, list: PlaceTable["waters"]) => [
    `        ${key}: [`,
    ...list.map(([kind, name]) => `          [${JSON.stringify(kind)}, ${JSON.stringify(name)}],`),
    `        ],`,
  ];
  const rows = (key: string, list: readonly string[]) => [`        ${key}: [`, ...list.map((r) => `          ${JSON.stringify(r)},`), `        ],`];
  return [
    `      places: {`,
    ...names("waters", places.waters),
    ...names("landforms", places.landforms),
    ...names("lands", places.lands),
    ...rows("place", places.place),
    ...rows("land", places.land),
    `      },`,
  ];
}

/** A world as an older build drew it, kept so saves from before a change replay on the same land. */
export interface FrozenGrid {
  rows: readonly string[];
  starts: Readonly<Record<string, readonly [number, number]>>;
}

/** The squares and homelands where an older grid differs from a new build, or null where they agree. */
export function joinedDiff(now: BuiltWorld, old: FrozenGrid): { squares: [number, number, string][]; starts: Record<string, [number, number]> } | null {
  const squares: [number, number, string][] = [];
  old.rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) if (row[x] !== now.rows[y]![x]) squares.push([x, y, row[x]!]);
  });
  const starts: Record<string, [number, number]> = {};
  for (const [civ, [x, y]] of Object.entries(old.starts)) if (now.starts[civ]?.[0] !== x || now.starts[civ]?.[1] !== y) starts[civ] = [x, y];
  return squares.length || Object.keys(starts).length ? { squares, starts } : null;
}

/**
 * The generated TypeScript module for a world, built at every size. With `joined` (the grids
 * saves before version 13 played on, `legacy/joined-islands.json`), each size also lists the
 * squares and homelands that differed then, before landmasses were kept apart.
 */
export function worldModule(frame: Frame, worlds: Readonly<Record<WorldSize, BuiltWorld>>, joined?: Readonly<Record<WorldSize, FrozenGrid>>): string {
  const legacy = (size: WorldSize): string[] => {
    const diff = joined?.[size] && joinedDiff(worlds[size], joined[size]);
    if (!diff) return [];
    const squares = diff.squares.map(([x, y, ch]) => `[${x}, ${y}, "${ch}"]`);
    const lines: string[] = [];
    for (let k = 0; k < squares.length; k += 8) lines.push(`          ${squares.slice(k, k + 8).join(", ")},`);
    return [
      `      joinedIslands: {`,
      `        squares: [`,
      ...lines,
      `        ],`,
      `        starts: {`,
      ...Object.entries(diff.starts).map(([civ, [x, y]]) => `          ${civ}: [${x}, ${y}],`),
      `        },`,
      `      },`,
    ];
  };
  const grid = (size: WorldSize) => {
    const world = worlds[size];
    return [
      `    ${size}: {`,
      `      rows: [`,
      ...world.rows.map((r) => `        "${r}",`),
      `      ],`,
      `      starts: {`,
      ...Object.entries(world.starts).map(([civ, [x, y]]) => `        ${civ}: [${x}, ${y}],`),
      `      },`,
      ...placeLines(world.places),
      ...legacy(size),
      `    },`,
    ];
  };
  return [
    `// Generated by tools/maps from Natural Earth data (public domain). Regenerate with \`npm run maps\`;`,
    `// hand edits are lost on the next run. "." ocean, g grassland, p plains, f forest, h hills, m mountains,`,
    `// d desert, t tundra, a arctic, s swamp, j jungle; upper case marks a river.`,
    `import type { PremadeWorld } from "../premade.js";`,
    ``,
    `export const ${frame.constName}: PremadeWorld = {`,
    `  id: ${JSON.stringify(frame.id)},`,
    `  name: ${JSON.stringify(frame.name)},`,
    `  sizes: {`,
    ...WORLD_SIZES.flatMap((s) => grid(s.id)),
    `  },`,
    `};`,
    ``,
  ].join("\n");
}
