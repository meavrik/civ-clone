import { readFileSync } from "node:fs";

/** A (longitude, latitude) pair in degrees. */
export type Pt = readonly [number, number];

/** One feature's rings (outer boundaries and holes alike), filled even-odd. */
export interface Shape {
  props: Record<string, unknown>;
  rings: Pt[][];
  /** minLon, minLat, maxLon, maxLat */
  bbox: [number, number, number, number];
}

export interface Polyline {
  props: Record<string, unknown>;
  points: Pt[];
}

interface GeoFeature {
  properties: Record<string, unknown> | null;
  geometry: { type: string; coordinates: unknown } | null;
}

export function readGeo(file: string): GeoFeature[] {
  const geo = JSON.parse(readFileSync(file, "utf8")) as { features?: GeoFeature[] };
  if (!Array.isArray(geo.features)) throw new Error(`${file}: not a GeoJSON feature collection`);
  return geo.features;
}

export function bboxOf(rings: readonly (readonly Pt[])[]): [number, number, number, number] {
  let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
  for (const r of rings) for (const [x, y] of r) { a = Math.min(a, x); b = Math.min(b, y); c = Math.max(c, x); d = Math.max(d, y); }
  return [a, b, c, d];
}

export function shapes(features: GeoFeature[]): Shape[] {
  const out: Shape[] = [];
  for (const f of features) {
    const g = f.geometry;
    if (!g) continue;
    const polys = g.type === "Polygon" ? [g.coordinates as Pt[][]] : g.type === "MultiPolygon" ? (g.coordinates as Pt[][][]) : [];
    const rings = polys.flat();
    if (rings.length) out.push({ props: f.properties ?? {}, rings, bbox: bboxOf(rings) });
  }
  return out;
}

export function polylines(features: GeoFeature[]): Polyline[] {
  const out: Polyline[] = [];
  for (const f of features) {
    const g = f.geometry;
    if (!g) continue;
    const lines = g.type === "LineString" ? [g.coordinates as Pt[]] : g.type === "MultiLineString" ? (g.coordinates as Pt[][]) : [];
    for (const points of lines) out.push({ props: f.properties ?? {}, points });
  }
  return out;
}

/** Text property, whichever case the dataset spells its keys in. */
export function prop(props: Record<string, unknown>, key: string): string {
  const v = props[key] ?? props[key.toUpperCase()] ?? props[key.toLowerCase()];
  return typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : "";
}

/**
 * Even-odd inside test for a fixed list of sample latitudes: every ring edge
 * that crosses a sample latitude records the longitude where it does, and a
 * point is inside when an odd number of crossings lie west of it.
 */
export class ScanFill {
  private readonly rows: Float64Array[];

  constructor(rings: readonly (readonly Pt[])[], lats: readonly number[]) {
    const lists: number[][] = lats.map(() => []);
    for (const ring of rings) {
      const n = ring.length;
      for (let k = 0; k < n; k++) {
        const a = ring[k]!;
        const b = ring[(k + 1) % n]!;
        if (a[1] === b[1]) continue;
        const lo = Math.min(a[1], b[1]);
        const hi = Math.max(a[1], b[1]);
        for (let i = 0; i < lats.length; i++) {
          const lat = lats[i]!;
          if (lat <= lo || lat > hi) continue;
          lists[i]!.push(a[0] + ((lat - a[1]) * (b[0] - a[0])) / (b[1] - a[1]));
        }
      }
    }
    this.rows = lists.map((l) => Float64Array.from(l).sort());
  }

  inside(row: number, lon: number): boolean {
    const xs = this.rows[row]!;
    let lo = 0;
    let hi = xs.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (xs[mid]! < lon) lo = mid + 1;
      else hi = mid;
    }
    return (lo & 1) === 1;
  }
}

/**
 * Cells a segment passes through on a unit grid, corners included, so a
 * river drawn from them is connected north/east/south/west.
 */
export function supercover(x0: number, y0: number, x1: number, y1: number): [number, number][] {
  let cx = Math.floor(x0);
  let cy = Math.floor(y0);
  const ex = Math.floor(x1);
  const ey = Math.floor(y1);
  const out: [number, number][] = [[cx, cy]];
  const dx = x1 - x0;
  const dy = y1 - y0;
  const sx = Math.sign(dx);
  const sy = Math.sign(dy);
  const tdx = sx ? Math.abs(1 / dx) : Infinity;
  const tdy = sy ? Math.abs(1 / dy) : Infinity;
  let tx = sx > 0 ? (cx + 1 - x0) * tdx : sx < 0 ? (x0 - cx) * tdx : Infinity;
  let ty = sy > 0 ? (cy + 1 - y0) * tdy : sy < 0 ? (y0 - cy) * tdy : Infinity;
  let guard = 0;
  while ((cx !== ex || cy !== ey) && guard++ < 1000) {
    if (tx < ty) { cx += sx; tx += tdx; } else { cy += sy; ty += tdy; }
    out.push([cx, cy]);
  }
  return out;
}
