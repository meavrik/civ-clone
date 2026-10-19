import { MAP_WIDTH, NEIGHBOURS, Terrain, TERRAIN_CHARS, WORLD_SIZES, worldSize, type WorldSize } from "@civ/core";
import type { Image } from "@civ/sprites-tool";
import { HAND_ZONES, latitudeMix, MIXES, patchNoise, pick, regionZone, ZONE_RANK, type Zone } from "./climate.js";
import { dataLon, fromGrid, project, type Frame } from "./frames.js";
import { prop, ScanFill, supercover, type Polyline, type Pt, type Shape } from "./geo.js";

export interface GeoData {
  land: Shape[];
  lakes: Shape[];
  regions: Shape[];
  rivers: Polyline[];
}

export interface BuiltWorld {
  rows: string[];
  starts: Record<string, [number, number]>;
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
  const landCov = coverage(data.land.flatMap((s) => s.rings), WORLD_BBOX, lats, lons, W, H);
  // Natural lakes only: reservoirs are modern.
  const lakeShapes = data.lakes.filter((l) => /lake/i.test(prop(l.props, "featurecla")) && Number(prop(l.props, "scalerank")) <= frame.lakeRank);
  const lakeCov = coverage(lakeShapes.flatMap((s) => s.rings), WORLD_BBOX, lats, lons, W, H);
  const land = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) land[i] = landCov[i]! - lakeCov[i]! >= 0.5 ? 1 : 0;

  // Islands smaller than a square still get one if they cover a fair part of it.
  let rescued = 0;
  for (const shape of data.land) {
    const [a, b, c, d] = shape.bbox;
    if (c - a > 12 || d - b > 12) continue;
    const cov = coverage(shape.rings, shape.bbox, lats, lons, W, H);
    let best = -1;
    let area = 0;
    let has = false;
    for (let i = 0; i < W * H; i++) {
      if (!cov[i]) continue;
      area += cov[i]!;
      if (land[i]) has = true;
      if (best < 0 || cov[i]! > cov[best]!) best = i;
    }
    if (!has && best >= 0 && area >= 0.22) { land[best] = 1; rescued++; }
  }
  report.push(`islands rescued: ${rescued}`);

  // Water specks the grid made out of coastline (not real lakes) fill in.
  const seen = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) {
    if (land[i] || seen[i]) continue;
    const comp = [i];
    seen[i] = 1;
    for (let k = 0; k < comp.length; k++) {
      const cx = comp[k]! % W;
      const cy = Math.floor(comp[k]! / W);
      for (const [dx, dy] of NEIGHBOURS) {
        const ny = cy + dy;
        if (ny < 0 || ny >= H) continue;
        const n = idx(cx + dx, ny);
        if (land[n] || seen[n]) continue;
        seen[n] = 1;
        comp.push(n);
      }
    }
    if (comp.length <= 2 && comp.every((n) => lakeCov[n]! < 0.4)) for (const n of comp) land[n] = 1;
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
  if (frame.polar) for (let x = 0; x < W; x++) { land[x] = 1; land[(H - 1) * W + x] = 1; }

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
  return { rows, starts, preview: preview(terrain, river, starts, W, H), report };
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

/** The generated TypeScript module for a world, built at every size. */
export function worldModule(frame: Frame, worlds: Readonly<Record<WorldSize, BuiltWorld>>): string {
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
