import { Terrain } from "@civ/core";
import { hash, isoU, isoV, isoX, isoY, LOT_H, LOT_W, townTerrain, type CityScene, type FieldPlot, type ForestKind, type MountainKind, type SceneItem, type TownStreet, type WallPiece } from "@civ/renderer-api";
import { shade, UNSEEN } from "../palette.js";
import type { Surface } from "../surface.js";
import { terrainPieces, terrainTexture, type TerrainPiece } from "../tiles.js";

/**
 * The ground of the city view (town.ts in renderer-api lays it out), in the manner of the user's terrain sheet and the
 * buildings stood on it (2026-11-05, asked for: "fields and mountens dosnt look good - improve. try to make same style as
 * the 90's buildings look"; a first ground of dithered blotches and smooth grey triangles looked like nothing else in
 * the game): each land its sheet's flat colour with the sheet's own tufts, stones and waves scattered on it, patchwork
 * fields, and mountains and hills of hard faces and dark edges. Worked out once for a scene, a fine pixel at a time in
 * the world's coordinates, so rows and paving run along the town's two axes. All in the palette.
 */

/** The terrain sprite whose ground each land stands on, and whose small marks are scattered on it. */
const GROUND_SPRITE: Record<Terrain, string> = {
  [Terrain.Ocean]: "ocean", [Terrain.Grassland]: "grassland", [Terrain.Plains]: "plains", [Terrain.Forest]: "grassland", [Terrain.Hills]: "grassland",
  [Terrain.Mountains]: "grassland", [Terrain.Desert]: "desert", [Terrain.Tundra]: "tundra", [Terrain.Arctic]: "arctic", [Terrain.Swamp]: "swamp", [Terrain.Jungle]: "jungle",
};
/** How many spots of the scatter hold a mark, by land; the jungle is all texture. */
const MARKS: Record<Terrain, number> = {
  [Terrain.Ocean]: 0.3, [Terrain.Grassland]: 0.5, [Terrain.Plains]: 0.5, [Terrain.Forest]: 0.5, [Terrain.Hills]: 0.5,
  [Terrain.Mountains]: 0.5, [Terrain.Desert]: 0.4, [Terrain.Tundra]: 0.55, [Terrain.Arctic]: 0.3, [Terrain.Swamp]: 0.6, [Terrain.Jungle]: 0,
};
/** Retro pixels between the land's first soundings: no land is narrower. */
const COARSE = 5;
/** The scatter's grid, in fine pixels. */
const SCATTER_W = 19;
const SCATTER_H = 11;

/** What lies on a fine pixel of the ground, over the land. */
const enum Mark { None, Yard, River, Square, Street, Bridge }

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const bayer = (x: number, y: number) => BAYER[(y & 3) * 4 + (x & 3)]! / 16;

/** Stamps a disc of the ground (`r` lots) on a grid of marks. */
function stamp(marks: Uint8Array, fw: number, fh: number, k: number, u: number, v: number, r: number, paint: (old: number) => number): void {
  const cx = isoX(u, v) * k, cy = isoY(u, v) * k;
  const a = Math.ceil(r * LOT_W * 0.71 * k) + 1, b = Math.ceil(r * LOT_H * 0.71 * k) + 1;
  for (let y = Math.max(0, Math.floor(cy - b)); y <= Math.min(fh - 1, Math.ceil(cy + b)); y++)
    for (let x = Math.max(0, Math.floor(cx - a)); x <= Math.min(fw - 1, Math.ceil(cx + a)); x++) {
      const du = isoU((x + 0.5) / k, (y + 0.5) / k) - u, dv = isoV((x + 0.5) / k, (y + 0.5) / k) - v;
      if (du * du + dv * dv <= r * r) marks[y * fw + x] = paint(marks[y * fw + x]!);
    }
}

/** Marks a box of the ground. */
function fillBox(marks: Uint8Array, fw: number, fh: number, k: number, b: { u0: number; v0: number; u1: number; v1: number }, paint: (old: number) => number): void {
  const x0 = Math.floor(isoX(b.u0, b.v1) * k), x1 = Math.ceil(isoX(b.u1, b.v0) * k);
  const y0 = Math.floor(isoY(b.u0, b.v0) * k), y1 = Math.ceil(isoY(b.u1, b.v1) * k);
  for (let y = Math.max(0, y0); y < Math.min(fh, y1); y++)
    for (let x = Math.max(0, x0); x < Math.min(fw, x1); x++) {
      const u = isoU((x + 0.5) / k, (y + 0.5) / k), v = isoV((x + 0.5) / k, (y + 0.5) / k);
      if (u >= b.u0 && u <= b.u1 && v >= b.v0 && v <= b.v1) marks[y * fw + x] = paint(marks[y * fw + x]!);
    }
}

function along(pts: number[], step: number, at: (u: number, v: number) => void): void {
  for (let i = 0; i + 3 < pts.length; i += 2) {
    const [u0, v0, u1, v1] = [pts[i]!, pts[i + 1]!, pts[i + 2]!, pts[i + 3]!];
    const n = Math.max(1, Math.ceil(Math.hypot(u1 - u0, v1 - v0) / step));
    for (let t = 0; t <= n; t++) at(u0 + ((u1 - u0) * t) / n, v0 + ((v1 - v0) * t) / n);
  }
}

/** A street's surface at a fine pixel: packed earth with ruts, cobbles, or asphalt. */
function streetInk(surface: TownStreet["surface"], u: number, v: number, salt: number): number {
  if (surface === "dirt") {
    const r = hash(Math.floor(u * 7), Math.floor(v * 7), salt + 31);
    return shade("mound", r < 0.16 ? 2 : r < 0.72 ? 4 : 6);
  }
  if (surface === "stone") {
    const a = u * 6, b = v * 6;
    if (a - Math.floor(a) < 0.16 || b - Math.floor(b) < 0.16) return shade("rock", 1);
    const r = hash(Math.floor(a), Math.floor(b), salt + 32);
    return shade("rock", r < 0.3 ? 2 : r < 0.8 ? 3 : 4);
  }
  return shade("grey", hash(Math.floor(u * 9), Math.floor(v * 9), salt + 33) < 0.2 ? 3 : 2);
}

/** A town square's paving: beaten earth, flags, or pale slabs. */
function squareInk(surface: TownStreet["surface"], u: number, v: number, salt: number): number {
  if (surface === "dirt") return shade("mound", hash(Math.floor(u * 6), Math.floor(v * 6), salt + 34) < 0.2 ? 4 : 6);
  const a = u * 2.5, b = v * 2.5 + (Math.floor(u * 2.5) & 1) * 0.5;
  if (a - Math.floor(a) < 0.07 || b - Math.floor(b) < 0.07) return shade("rock", 2);
  const r = hash(Math.floor(a), Math.floor(b), salt + 35);
  return surface === "stone" ? shade("rock", r < 0.5 ? 4 : 5) : shade("rock", r < 0.5 ? 5 : 6);
}

/** A plot of fields at a point: rows along its length, a bank round it, light on its far sides and dark on its near ones. */
function fieldInk(p: FieldPlot, u: number, v: number, salt: number): number {
  const edge = 0.09;
  if (p.u1 - u < edge || p.v1 - v < edge) return shade("hide", 0);
  if (u - p.u0 < edge || v - p.v0 < edge) return shade("mound", 6);
  const across = p.turned ? u : v, along = p.turned ? v : u;
  const row = across * 3, f = row - Math.floor(row);
  const stalk = hash(Math.floor(along * 7), Math.floor(row), salt + 51);
  if (p.id === "fields_ploughed") return f < 0.34 ? shade("hide", 1) : f < 0.7 ? shade("hide", 2) : shade("hide", 3);
  if (p.id === "fields_irrigated" && Math.abs(across - (p.turned ? (p.u0 + p.u1) / 2 : (p.v0 + p.v1) / 2)) < 0.14) return shade("sea", stalk < 0.3 ? 5 : 3);
  if (p.id === "fields_wheat") return f < 0.24 ? shade("hide", 3) : f < 0.5 ? shade("dune", 3) : stalk < 0.2 ? shade("dune", 5) : f < 0.82 ? shade("wheat", 4) : shade("wheat", 7);
  return f < 0.18 ? shade("mound", 2) : f < 0.36 ? shade("leaf", 2) : stalk < 0.16 ? shade("leaf", 5) : f < 0.74 ? shade("leaf", 6) : shade("leaf", 7);
}

/** Paints the ground of a scene with its top left at (`ox`, `oy`) on the screen. */
export function drawTownGround(s: Surface, scene: CityScene, ox: number, oy: number): void {
  const k = s.k;
  const fw = scene.w * k, fh = scene.h * k;
  const { land, salt } = scene;
  const surface = scene.streets[0]?.surface ?? "dirt";

  // What lies where: yards, then rivers, squares and streets, a street over a river making a bridge.
  const marks = new Uint8Array(fw * fh);
  for (const b of scene.yards) fillBox(marks, fw, fh, k, b, () => Mark.Yard);
  for (const c of scene.rivers) along(c, 0.12, (u, v) => stamp(marks, fw, fh, k, u, v, 0.3, () => Mark.River));
  for (const b of scene.squares) fillBox(marks, fw, fh, k, b, (m) => (m === Mark.River ? m : Mark.Square));
  for (const st of scene.streets) along(st.pts, 0.12, (u, v) => stamp(marks, fw, fh, k, u, v, st.w / 2, (m) => (m === Mark.River || m === Mark.Bridge ? Mark.Bridge : Mark.Street)));
  const plots = new Uint8Array(fw * fh);
  scene.fields.forEach((p, i) => fillBox(plots, fw, fh, k, p, () => i + 1));

  // Each house's shadow on the ground, down the screen to the right of it.
  const shadow = new Uint8Array(fw * fh);
  for (const b of scene.yards) fillBox(shadow, fw, fh, k, { u0: b.u1 - 0.12, v0: b.v0 + 0.15, u1: b.u1 + 0.22, v1: b.v1 }, () => 1);

  // The land a retro pixel at a time, its edges chunky; how far each pixel lies from the shore, either way.
  const cols = scene.w, rows = scene.h;
  const kinds = new Uint8Array(cols * rows);
  const toSea = new Uint8Array(cols * rows).fill(255);
  const toLand = new Uint8Array(cols * rows).fill(255);
  // A coarse grid first: a cell whose corners agree is all one land, and only the cells along a border are worked out.
  const at = (x: number, y: number) => townTerrain(land, salt, isoU(x + 0.5, y + 0.5), isoV(x + 0.5, y + 0.5));
  const gridW = Math.ceil(cols / COARSE) + 1, gridH = Math.ceil(rows / COARSE) + 1;
  const grid = new Uint8Array(gridW * gridH);
  for (let j = 0; j < gridH; j++) for (let i = 0; i < gridW; i++) grid[j * gridW + i] = at(i * COARSE, j * COARSE);
  for (let y = 0; y < rows; y++)
    for (let x = 0; x < cols; x++) {
      const i = Math.floor(x / COARSE), j = Math.floor(y / COARSE);
      const corner = grid[j * gridW + i]!;
      const even = corner === grid[j * gridW + i + 1] && corner === grid[(j + 1) * gridW + i] && corner === grid[(j + 1) * gridW + i + 1];
      const t = even ? corner : at(x, y);
      kinds[y * cols + x] = t;
      if (t === Terrain.Ocean) toSea[y * cols + x] = 0;
      else toLand[y * cols + x] = 0;
    }
  const spread = (d: Uint8Array) => {
    const at = (i: number, by: number, v: number) => { if (d[i]! > v + by) d[i] = v + by; };
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const i = y * cols + x;
      if (x) at(i, 2, d[i - 1]!);
      if (y) at(i, 1, d[i - cols]!);
    }
    for (let y = rows - 1; y >= 0; y--) for (let x = cols - 1; x >= 0; x--) {
      const i = y * cols + x;
      if (x < cols - 1) at(i, 2, d[i + 1]!);
      if (y < rows - 1) at(i, 1, d[i + cols]!);
    }
  };
  spread(toSea);
  spread(toLand);

  const fx0 = ox * k, fy0 = oy * k;
  const jungle = terrainTexture("jungle");
  const lands = Object.values(GROUND_SPRITE).map((_, t) => t as Terrain);
  const bases = lands.map((t) => terrainPieces(GROUND_SPRITE[t]).base);
  const scatter = lands.map((t) => terrainPieces(t === Terrain.Mountains ? "mountains" : GROUND_SPRITE[t]).pieces.filter((p) => !p.edge && p.n <= 60));
  const atMark = (x: number, y: number) => (x >= 0 && y >= 0 && x < fw && y < fh ? marks[y * fw + x]! : Mark.None);
  for (let y = 0; y < fh; y++)
    for (let x = 0; x < fw; x++) {
      const m = marks[y * fw + x]!;
      const px = (x + 0.5) / k, py = (y + 0.5) / k;
      const cell = Math.floor(py) * cols + Math.floor(px);
      const plot = plots[y * fw + x]!;
      const placed = m !== Mark.None || plot !== 0;
      const u = placed ? isoU(px, py) : 0, v = placed ? isoV(px, py) : 0;
      let c: number;
      if (m === Mark.Street || m === Mark.Bridge) {
        const edge = [atMark(x - 1, y), atMark(x + 1, y), atMark(x, y - 1), atMark(x, y + 1)].some((n) => n !== Mark.Street && n !== Mark.Bridge && n !== Mark.Square);
        if (m === Mark.Bridge) c = edge ? shade("hide", 0) : shade("hide", Math.floor(u * 4 + v * 4) % 2 ? 3 : 4);
        else c = edge ? (surface === "asphalt" ? shade("rock", 3) : shade("mound", 2)) : streetInk(surface, u, v, salt);
      } else if (m === Mark.Square) {
        c = squareInk(surface, u, v, salt);
      } else if (m === Mark.River) {
        const near = [atMark(x - 2, y), atMark(x + 2, y), atMark(x, y - 2), atMark(x, y + 2)].some((n) => n !== Mark.River && n !== Mark.Bridge);
        c = near ? shade("sea", 6) : shade("sea", (Math.floor(u * 5) + Math.floor(v * 3)) % 7 === 0 ? 5 : 3);
      } else if (plot) {
        c = fieldInk(scene.fields[plot - 1]!, u, v, salt);
      } else {
        const t = kinds[cell]! as Terrain;
        if (t === Terrain.Ocean) {
          const shore = toLand[cell]!, b = bayer(x, y);
          c = shore <= 1 + b * 2 ? shade("marble", 7) : shore <= 4 + b * 3 ? shade("sea", 6) : shore <= 9 + b * 4 ? shade("sea", 4) : bases[Terrain.Ocean]!;
        } else if (toSea[cell]! <= 3 + bayer(x, y) * 3) {
          c = shade("dune", 6);
        } else if (t === Terrain.Jungle) {
          c = jungle[(y & 31) * 32 + (x & 31)]!;
        } else {
          c = bases[t]!;
          // The ground round the houses: worn to bare earth in a young town, a kept lawn in an older one.
          if (m === Mark.Yard) {
            if (surface !== "dirt") c = t === Terrain.Grassland || t === Terrain.Forest || t === Terrain.Hills ? shade("meadow", 3) : c;
            else if (hash(Math.floor(u * 5), Math.floor(v * 5), salt + 43) < 0.34) c = shade("mound", hash(Math.floor(u * 11), Math.floor(v * 11), salt + 44) < 0.6 ? 4 : 6);
          }
        }
      }
      s.fset(fx0 + x, fy0 + y, shadow[y * fw + x] && (x + y) % 2 ? UNSEEN[c]! : c);
    }

  // The sheet's own small marks scattered over what is open: tufts, stones, waves.
  for (let gy = 0; gy < fh; gy += SCATTER_H)
    for (let gx = 0; gx < fw; gx += SCATTER_W) {
      const r = hash(gx, gy, salt + 60);
      const x = gx + Math.floor(hash(gx, gy, salt + 61) * SCATTER_W), y = gy + Math.floor(hash(gx, gy, salt + 62) * SCATTER_H);
      if (x >= fw || y >= fh) continue;
      const cell = Math.floor(y / k) * cols + Math.floor(x / k);
      const t = kinds[cell]! as Terrain;
      if (r >= MARKS[t]) continue;
      const sea = t === Terrain.Ocean;
      if (sea ? toLand[cell]! < 14 : toSea[cell]! < 8) continue;
      const small = scatter[t]!;
      if (!small.length) continue;
      const p = small[Math.floor(hash(gy, gx, salt + 63) * small.length)]!;
      let clear = true;
      for (let j = -1; j <= p.h && clear; j++)
        for (let i = -1; i <= p.w && clear; i++) {
          const fx = x + i, fy = y + j;
          if (fx < 0 || fy < 0 || fx >= fw || fy >= fh || marks[fy * fw + fx] !== Mark.None || plots[fy * fw + fx] !== 0 || kinds[Math.floor(fy / k) * cols + Math.floor(fx / k)] !== t) clear = false;
        }
      if (clear) blitPiece(s, p, fx0 + x, fy0 + y, 0, 0, s.fw, s.fh);
    }
}

/** A piece of the terrain sheet at fine (`x`, `y`), within the box given. */
function blitPiece(s: Surface, p: TerrainPiece, x: number, y: number, x0: number, y0: number, x1: number, y1: number): void {
  for (let j = 0; j < p.h; j++)
    for (let i = 0; i < p.w; i++) {
      const c = p.px[j * p.w + i]!;
      if (c >= 0 && x + i >= x0 && x + i < x1 && y + j >= y0 && y + j < y1) s.fset(x + i, y + j, c);
    }
}

/** Fills a polygon of fine pixels on the scene, within (`x0`, `y0`) .. (`x1`, `y1`). */
function fillFine(s: Surface, pts: number[], x0: number, y0: number, x1: number, y1: number, paint: (x: number, y: number) => number): void {
  const ys = pts.filter((_, i) => i % 2 === 1);
  for (let y = Math.max(y0, Math.floor(Math.min(...ys))); y < Math.min(y1, Math.ceil(Math.max(...ys))); y++) {
    const cuts: number[] = [];
    for (let i = 0, j = pts.length - 2; i < pts.length; j = i, i += 2) {
      const xi = pts[i]!, yi = pts[i + 1]!, xj = pts[j]!, yj = pts[j + 1]!;
      if (yi > y + 0.5 !== yj > y + 0.5) cuts.push(((xj - xi) * (y + 0.5 - yi)) / (yj - yi) + xi);
    }
    cuts.sort((a, b) => a - b);
    for (let c = 0; c + 1 < cuts.length; c += 2)
      for (let x = Math.max(x0, Math.ceil(cuts[c]! - 0.5)); x < Math.min(x1, Math.ceil(cuts[c + 1]! - 0.5)); x++) s.fset(x, y, paint(x, y));
  }
}

/** A box standing on the ground: its near faces in dressed stone, its top lighter, each corner a dark line. */
function stoneBox(s: Surface, ox: number, oy: number, b: { u0: number; v0: number; u1: number; v1: number }, foot: number, top: number, clip: [number, number, number, number], crown = false): void {
  const k = s.k;
  const fx = (u: number, v: number) => (ox + isoX(u, v)) * k;
  const fy = (u: number, v: number, z: number) => (oy + isoY(u, v) - z) * k;
  const [x0, y0, x1, y1] = clip;
  const rows = 5, stones = 7;
  const faces = (x: number, y: number, lit: boolean, base: (x: number) => number) => {
    const up = base(x) - y;
    const row = Math.floor(up / rows);
    if (Math.floor(up) % rows === 0) return shade("stone", lit ? 3 : 2);
    if (Math.floor(x + row * 3.5) % stones === 0) return shade("stone", lit ? 3 : 2);
    return shade("stone", lit ? 5 : 4);
  };
  const left = fx(b.u0, b.v1), mid = fx(b.u1, b.v1), right = fx(b.u1, b.v0);
  const lb = fy(b.u0, b.v1, foot), mb = fy(b.u1, b.v1, foot), rb = fy(b.u1, b.v0, foot);
  const lt = fy(b.u0, b.v1, top), mt = fy(b.u1, b.v1, top), rt = fy(b.u1, b.v0, top);
  fillFine(s, [left, lb, mid, mb, mid, mt, left, lt], x0, y0, x1, y1, (x, y) => faces(x, y, true, (c) => lb + ((c - left) / Math.max(1, mid - left)) * (mb - lb)));
  fillFine(s, [mid, mb, right, rb, right, rt, mid, mt], x0, y0, x1, y1, (x, y) => faces(x, y, false, (c) => mb + ((c - mid) / Math.max(1, right - mid)) * (rb - mb)));
  const backX = fx(b.u0, b.v0), backY = fy(b.u0, b.v0, top);
  fillFine(s, [left, lt, mid, mt, right, rt, backX, backY], x0, y0, x1, y1, () => shade("stone", crown ? 6 : 5));
  // A dark line up the near corner.
  for (let y = Math.round(mt); y < Math.round(mb); y++) if (mid >= x0 && mid < x1 && y >= y0 && y < y1) s.fset(Math.round(mid), y, shade("stone", 1));
}

/** A stretch of wall or a tower, battlements along its outer edge. */
export function drawWallPiece(s: Surface, ox: number, oy: number, w: WallPiece, sw: number, sh: number): void {
  const k = s.k;
  const clip: [number, number, number, number] = [ox * k, oy * k, (ox + sw) * k, (oy + sh) * k];
  stoneBox(s, ox, oy, w, 0, w.tall, clip, !!w.tower);
  const merlon = 0.17, step = 0.34;
  const along = w.side === "north" || w.side === "south";
  const from = along ? w.u0 : w.v0, to = along ? w.u1 : w.v1;
  // Far battlements first, then the near ones.
  const edges = w.tower
    ? [along ? w.v0 : w.u0, along ? w.v1 : w.u1]
    : [w.side === "north" ? w.v0 : w.side === "south" ? w.v1 : w.side === "west" ? w.u0 : w.u1];
  for (const edge of edges)
    for (let a = from; a < to - 0.02; a += step) {
      const b = Math.min(to, a + merlon);
      const box = along ? { u0: a, u1: b, v0: edge - 0.05, v1: edge + 0.05 } : { u0: edge - 0.05, u1: edge + 0.05, v0: a, v1: b };
      stoneBox(s, ox, oy, box, w.tall, w.tall + 2.5, clip, true);
    }
}

/** The colours of each kind of rock, lightest first; its edge is the sheet's near black in the rock's own hue. */
const ROCK: Record<MountainKind, { high: number; lit: number; mid: number; dim: number; dark: number; gully: number; edge: number }> = {
  grey: { high: shade("stone", 6), lit: shade("stone", 5), mid: shade("stone", 4), dim: shade("stone", 3), dark: shade("stone", 2), gully: shade("stone", 1), edge: shade("stone", 0) },
  snow: { high: shade("stone", 6), lit: shade("stone", 5), mid: shade("stone", 4), dim: shade("stone", 3), dark: shade("stone", 2), gully: shade("stone", 1), edge: shade("stone", 0) },
  red: { high: shade("hide", 5), lit: shade("hide", 4), mid: shade("hide", 3), dim: shade("hide", 2), dark: shade("hide", 1), gully: shade("hide", 0), edge: shade("hide", 0) },
  ice: { high: shade("ice", 7), lit: shade("ice", 6), mid: shade("ice", 4), dim: shade("ice", 3), dark: shade("ice", 2), gully: shade("ice", 1), edge: shade("ice", 0) },
};

/** A wandering line: a value in -0.5..0.5 at `t`, straight between hashed points, so edges run in facets. */
function zig(t: number, seed: number): number {
  const n = Math.floor(t), f = t - n;
  const a = hash(n, 11, seed) - 0.5, b = hash(n + 1, 11, seed) - 0.5;
  return a + (b - a) * f;
}

/** Sets the dark edge round what is drawn on a grid `w` by `h` (-1 clear). */
function outline(px: Int16Array, w: number, h: number, edge: number): void {
  const add: number[] = [];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (px[y * w + x]! >= 0) continue;
      if ((x > 0 && px[y * w + x - 1]! >= 0) || (x < w - 1 && px[y * w + x + 1]! >= 0) || (y > 0 && px[(y - 1) * w + x]! >= 0) || (y < h - 1 && px[(y + 1) * w + x]! >= 0)) add.push(y * w + x);
    }
  for (const i of add) px[i] = edge;
}

/**
 * A mountain in the manner of the terrain sheet's: a lit face and a shaded one parted by a crooked spine, flaked rock in
 * clusters, dark gullies running down the shaded face and cracks down the lit one, jagged snow where the kind has it,
 * boulders at its foot and a dark edge all round.
 */
export function drawPeak(s: Surface, ox: number, oy: number, it: SceneItem, sw: number, sh: number, salt: number): void {
  const k = s.k;
  const W = it.w * k, H = it.h * k;
  const pad = 8;
  const gw = W + 2 * pad, gh = H + pad + 4;
  const px = new Int16Array(gw * gh).fill(-1);
  const seed = salt + it.x * 31 + it.y * 17;
  const ink = ROCK[it.rock ?? "grey"];
  const sx = W * (0.4 + hash(1, 2, seed) * 0.2), foot = W * (0.5 + hash(2, 3, seed) * 0.16);
  const left = (y: number) => sx - sx * (y / H) + zig(y / 9, seed + 3) * (3 + (10 * y) / H);
  const right = (y: number) => sx + (W - sx) * (y / H) + zig(y / 9, seed + 4) * (3 + (10 * y) / H);
  const spine = (y: number) => sx + (foot - sx) * (y / H) + zig(y / 8, seed + 5) * (2 + (14 * y) / H);
  const put = (x: number, y: number, c: number) => { if (x >= 0 && y >= 0 && x < gw && y < gh) px[y * gw + x] = c; };
  const inside = (x: number, y: number) => px[y * gw + x]! >= 0;
  // The two faces, each one colour as the sheet's are, the lit one with long strokes down the slope.
  for (let y = 0; y <= H; y++) {
    const a = Math.round(left(y) / 2) * 2, b = Math.round(right(y) / 2) * 2, mid = spine(y);
    for (let x = a; x <= b; x++) {
      const stroke = hash(Math.floor((x + y * 0.55) / 7), Math.floor(y / 14), seed + 6);
      put(x + pad, y + pad, x < mid ? (stroke > 0.82 ? ink.high : stroke < 0.14 ? ink.mid : ink.lit) : stroke > 0.86 ? ink.dim : ink.dark);
    }
  }
  // Gullies down the shaded face from the spine, tapering; cracks down the lit one, away from the light.
  for (let g = 0; g < 8; g++) {
    const y0 = H * (0.12 + hash(g, 4, seed) * 0.68);
    const shaded = g % 3 !== 2;
    const x0 = shaded ? spine(y0) + 1 : left(y0) + (spine(y0) - left(y0)) * (0.3 + hash(g, 5, seed) * 0.5);
    const len = (H - y0) * (0.35 + hash(g, 6, seed) * 0.45);
    const slant = shaded ? 0.25 + hash(g, 7, seed) * 0.35 : -0.3 - hash(g, 7, seed) * 0.2;
    for (let i = 0; i < len; i++) {
      const x = Math.round(x0 + slant * i) + pad, y = Math.round(y0 + i) + pad;
      const wide = Math.ceil((shaded ? 5 : 2) * (1 - i / len));
      for (let d = 0; d < wide; d++) if (y < gh && x + d < gw && inside(x + d, y)) put(x + d, y, shaded ? ink.gully : ink.mid);
    }
  }
  // The spine catches the light down its near side.
  for (let y = 2; y <= H; y++) { const x = Math.round(spine(y)) - 1 + pad; if (inside(x, y + pad)) put(x, y + pad, ink.high); }
  // Snow on the top, its foot in points running down the gullies.
  if (it.rock === "snow" || it.rock === "ice") {
    const reach = H * (0.3 + hash(3, 4, seed) * 0.1);
    for (let x = 0; x < gw; x++) {
      const tooth = Math.floor(x / 8), f = x / 8 - tooth;
      const line = reach + (1 - Math.abs(f - 0.5) * 2) * (5 + hash(tooth, 8, seed) * 12) - 4;
      for (let y = 0; y < line + pad && y < gh; y++) if (inside(x, y)) put(x, y, x - pad < spine(y - pad) ? shade("marble", 7) : (x + y) % 11 === 0 ? ink.mid : shade("marble", 5));
    }
  }
  outline(px, gw, gh, ink.edge);
  const x0 = (ox + it.x) * k - pad, y0 = (oy + it.y - it.h) * k - pad;
  for (let y = 0; y < gh; y++)
    for (let x = 0; x < gw; x++) {
      const c = px[y * gw + x]!, fx = x0 + x, fy = y0 + y;
      if (c >= 0 && fx >= ox * k && fy >= oy * k && fx < (ox + sw) * k && fy < (oy + sh) * k) s.fset(fx, fy, c);
    }
  // Boulders at its foot, each ringed dark.
  for (let b = 0; b < 4; b++) {
    const r = 3 + Math.floor(hash(b, 9, seed) * 3);
    const bx = Math.round(x0 + pad + (b % 2 ? W * (0.84 + hash(b, 10, seed) * 0.24) : W * (0.02 + hash(b, 10, seed) * 0.2))), by = Math.round((oy + it.y) * k + hash(b, 11, seed) * 3 - 1);
    for (let y = -r; y <= 2; y++)
      for (let x = -r - 1; x <= r + 1; x++) {
        const d = disc(x, y, 0, 0, r + 1, y < 0 ? r : 2);
        const fx = bx + x, fy = by + y;
        if (d > 1 || fx < ox * k || fy < oy * k || fx >= (ox + sw) * k || fy >= (oy + sh) * k) continue;
        s.fset(fx, fy, d > 0.62 ? ink.edge : x + y < -1 ? ink.lit : ink.dim);
      }
  }
}

/** A hill in the manner of the terrain sheet's: a long lit slope of pale earth fading into the grass, a short dark one, a dark crest. */
export function drawMound(s: Surface, ox: number, oy: number, it: SceneItem, sw: number, sh: number, salt: number): void {
  const k = s.k;
  const W = it.w * k, H = it.h * k;
  const seed = salt + it.x * 13 + it.y * 29;
  const top = W * (0.56 + hash(1, 1, seed) * 0.16);
  const crest = (x: number) => (x < top ? H * (1 - Math.pow(x / top, 0.8)) : H * Math.pow((x - top) / (W - top), 1.2)) + zig(x / 8, seed) * 3;
  const fx0 = (ox + it.x) * k, fy0 = (oy + it.y - it.h) * k;
  const [x0, y0, x1, y1] = [ox * k, oy * k, (ox + sw) * k, (oy + sh) * k];
  const set = (x: number, y: number, c: number) => { if (x >= x0 && y >= y0 && x < x1 && y < y1) s.fset(x, y, c); };
  for (let x = 0; x < W; x++) {
    const cy = Math.round(crest(x) / 2) * 2;
    const lit = x < top;
    for (let y = cy; y < H; y++) {
      const d = (y - cy) / Math.max(1, H - cy), f = hash(Math.floor((x + y) / 4), Math.floor((y - x * 0.4) / 3), seed);
      // Earth under the crest, breaking into the grass below it, which shows through.
      if (d > 0.62 + f * 0.36) continue;
      if (y === cy || y === cy + 1) set(fx0 + x, fy0 + y, shade("hide", 1));
      else if (lit) set(fx0 + x, fy0 + y, d < 0.22 + f * 0.1 ? shade("dune", 4) : f < 0.5 ? shade("mound", 6) : shade("mound", 4));
      else set(fx0 + x, fy0 + y, f < 0.4 ? shade("hide", 1) : shade("hide", 2));
    }
  }
}

const disc = (x: number, y: number, cx: number, cy: number, rx: number, ry: number) => ((x - cx) * (x - cx)) / (rx * rx) + ((y - cy) * (y - cy)) / (ry * ry);

/** The well of a young town's square under its little roof, or from Construction on a fountain: a ring of stone and water. */
export function drawWell(s: Surface, ox: number, oy: number, it: SceneItem, age: number): void {
  const k = s.k;
  const cx = (ox + it.x + it.w / 2) * k, cy = (oy + it.y - 6) * k;
  const fountain = age >= 1;
  const rx = fountain ? 18 : 12, ry = fountain ? 9 : 6;
  // The kerb's side, then its top, then the water in it.
  for (let y = -ry; y <= ry + 4; y++)
    for (let x = -rx; x <= rx; x++) {
      const ring = disc(x, y, 0, 0, rx, ry), side = disc(x, y - 4, 0, 0, rx, ry);
      if (ring <= 1) s.fset(cx + x, cy + y, ring < 0.5 ? shade("sea", (x + y) % 5 === 0 ? 5 : fountain ? 3 : 1) : shade("stone", y < 0 ? 6 : 5));
      else if (side <= 1) s.fset(cx + x, cy + y, shade("stone", (x & 3) === 0 ? 2 : 3));
    }
  if (fountain) {
    for (let y = 0; y < 12; y++) for (let x = -2; x <= 2; x++) s.fset(cx + x, cy - y, shade("stone", x < 0 ? 6 : x > 0 ? 3 : 5));
    for (let y = -6; y <= 2; y++) for (let x = -5; x <= 5; x++) if (disc(x, y, 0, -2, 5, 3) <= 1) s.fset(cx + x, cy - 12 + y, shade("sea", y < -2 ? 7 : 5));
    return;
  }
  for (let y = 0; y < 15; y++) { s.fset(cx - 10, cy - y, shade("hide", 0)); s.fset(cx + 10, cy - y, shade("hide", 0)); s.fset(cx - 9, cy - y, shade("hide", 2)); s.fset(cx + 11, cy - y, shade("hide", 2)); }
  fillFine(s, [cx - 15, cy - 14, cx, cy - 23, cx + 15, cy - 14, cx, cy - 8], 0, 0, s.fw, s.fh, (x, y) => (x < cx ? shade("hide", (x + y) % 4 === 0 ? 2 : 4) : shade("hide", (y - x) % 4 === 0 ? 1 : 3)));
}

/** The terrain sheet's woods, by kind. */
const WOODS: Record<ForestKind, string> = { broadleaf: "forest", pine: "forest_pine", birch: "forest_birch", autumn: "forest_autumn", mixed: "forest_mixed" };

/** One of the sheet's trees, whole, standing on the item's foot. */
export function drawTree(s: Surface, ox: number, oy: number, it: SceneItem, sw: number, sh: number, salt: number): void {
  const k = s.k;
  const pieces = terrainPieces(WOODS[it.tree ?? "broadleaf"]).pieces;
  const whole = pieces.filter((p) => !p.edge && p.h >= 12 && p.w >= 8);
  const trees = whole.length ? whole : pieces.filter((p) => p.h >= 12 && p.w >= 8);
  const p = trees[Math.floor(hash(it.x, it.y, salt + 8) * trees.length)];
  if (!p) return;
  blitPiece(s, p, Math.round((ox + it.x + it.w / 2) * k) - Math.floor(p.w / 2), (oy + it.y) * k - p.h, ox * k, oy * k, (ox + sw) * k, (oy + sh) * k);
}
