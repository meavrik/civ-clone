import { Terrain } from "@civ/core";
import { hash, isoU, isoV, isoX, isoY, townTerrain, valueNoise, type CityScene, type SceneItem, type TownStreet, type WallPiece } from "@civ/renderer-api";
import { shade, UNSEEN } from "../palette.js";
import type { Surface } from "../surface.js";

/**
 * The ground of the city view (town.ts in renderer-api lays it out): the land round the city, its shores, rivers, streets
 * and squares, worked out once for a scene a fine pixel at a time in the world's own coordinates, so speckle and paving
 * run along the town's two axes; and what is drawn standing on it, walls, peaks and mounds. All in the palette.
 */

/** Each terrain's ground: its colour, the colour of its patches, and of its flecks. */
const GROUNDS: Record<Terrain, { base: [string, number]; patch: [string, number]; fleck: [string, number] }> = {
  [Terrain.Ocean]: { base: ["sea", 3], patch: ["sea", 2], fleck: ["sea", 5] },
  [Terrain.Grassland]: { base: ["meadow", 5], patch: ["meadow", 3], fleck: ["leaf", 7] },
  [Terrain.Plains]: { base: ["plains", 5], patch: ["plains", 4], fleck: ["meadow", 5] },
  [Terrain.Forest]: { base: ["leaf", 3], patch: ["leaf", 2], fleck: ["leaf", 5] },
  [Terrain.Hills]: { base: ["meadow", 3], patch: ["mound", 4], fleck: ["meadow", 5] },
  [Terrain.Mountains]: { base: ["heath", 2], patch: ["rock", 1], fleck: ["rock", 2] },
  [Terrain.Desert]: { base: ["dune", 5], patch: ["dune", 4], fleck: ["dune", 7] },
  [Terrain.Tundra]: { base: ["heath", 7], patch: ["heath", 5], fleck: ["rock", 5] },
  [Terrain.Arctic]: { base: ["ice", 6], patch: ["ice", 5], fleck: ["ice", 7] },
  [Terrain.Swamp]: { base: ["mire", 3], patch: ["mire", 1], fleck: ["mire", 5] },
  [Terrain.Jungle]: { base: ["canopy", 3], patch: ["canopy", 1], fleck: ["canopy", 7] },
};

/** What lies on a fine pixel of the ground, over the land. */
const enum Mark { None, Yard, River, Square, Street, Bridge }

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const bayer = (x: number, y: number) => BAYER[(y & 3) * 4 + (x & 3)]! / 16;

/** Stamps a disc of the ground (`r` lots) on a grid of marks. */
function stamp(marks: Uint8Array, fw: number, fh: number, k: number, u: number, v: number, r: number, paint: (old: number) => number): void {
  const cx = isoX(u, v) * k, cy = isoY(u, v) * k;
  const a = Math.ceil(r * 14.2 * k) + 1, b = Math.ceil(r * 7.1 * k) + 1;
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
  for (const st of scene.streets) along(st.pts, 0.08, (u, v) => stamp(marks, fw, fh, k, u, v, st.w / 2, (m) => (m === Mark.River || m === Mark.Bridge ? Mark.Bridge : Mark.Street)));

  // Each house's shadow on the ground, down the screen to the right of it.
  const shadow = new Uint8Array(fw * fh);
  for (const b of scene.yards) fillBox(shadow, fw, fh, k, { u0: b.u1 - 0.12, v0: b.v0 + 0.15, u1: b.u1 + 0.22, v1: b.v1 }, () => 1);

  // The land a retro pixel at a time, its edges chunky; how far each pixel lies from the shore, either way.
  const cols = scene.w, rows = scene.h;
  const kinds = new Uint8Array(cols * rows);
  const patches = new Float32Array(cols * rows);
  const toSea = new Uint8Array(cols * rows).fill(255);
  const toLand = new Uint8Array(cols * rows).fill(255);
  for (let y = 0; y < rows; y++)
    for (let x = 0; x < cols; x++) {
      const t = townTerrain(land, salt, isoU(x + 0.5, y + 0.5), isoV(x + 0.5, y + 0.5));
      kinds[y * cols + x] = t;
      patches[y * cols + x] = valueNoise(isoU(x, y) + 64, isoV(x, y) + 64, 0.8, 1000, salt + 40) * 0.5 + valueNoise(isoU(x, y) + 64, isoV(x, y) + 64, 2.3, 1000, salt + 41) * 0.5;
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
  const atMark = (x: number, y: number) => (x >= 0 && y >= 0 && x < fw && y < fh ? marks[y * fw + x]! : Mark.None);
  for (let y = 0; y < fh; y++)
    for (let x = 0; x < fw; x++) {
      const m = marks[y * fw + x]!;
      const px = (x + 0.5) / k, py = (y + 0.5) / k;
      const u = isoU(px, py), v = isoV(px, py);
      const cell = Math.floor(py) * cols + Math.floor(px);
      let c: number;
      if (m === Mark.Street || m === Mark.Bridge) {
        const edge = [atMark(x - 1, y), atMark(x + 1, y), atMark(x, y - 1), atMark(x, y + 1)].some((n) => n !== Mark.Street && n !== Mark.Bridge && n !== Mark.Square);
        if (m === Mark.Bridge) c = edge ? shade("hide", 0) : shade("hide", Math.floor(u * 4 + v * 4) % 2 ? 3 : 4);
        else c = edge ? (surface === "asphalt" ? shade("rock", 3) : shade("mound", 2)) : streetInk(surface, u, v, salt);
      } else if (m === Mark.Square) {
        c = squareInk(surface, u, v, salt);
      } else if (m === Mark.River) {
        const near = [atMark(x - 2, y), atMark(x + 2, y), atMark(x, y - 2), atMark(x, y + 2)].some((n) => n !== Mark.River && n !== Mark.Bridge);
        c = near ? shade("sea", 5) : shade("sea", (Math.floor(u * 5) + Math.floor(v * 3)) % 7 === 0 ? 5 : 3);
      } else {
        const t = kinds[cell]! as Terrain;
        const look = GROUNDS[t];
        if (t === Terrain.Ocean) {
          const shore = toLand[cell]!;
          // Short crests on the swell, here and there, level across the screen.
          const a = (py + Math.sin(px * 0.13) * 1.6) / 6.5, row = Math.floor(a);
          const b = px / 13 + row * 0.37, col = Math.floor(b);
          const crest = a - row < 0.15 && b - col < 0.62 && hash(col, row, salt) < 0.24;
          c = shore <= 1 + bayer(x, y) * 2 ? shade("marble", 7) : shore <= 4 + bayer(x, y) * 3 ? shade("sea", 6) : shore <= 11 + bayer(x, y) * 4 ? shade("sea", 4) : crest ? shade("sea", 5) : shade("sea", 3);
        } else if (toSea[cell]! <= 3 + bayer(x, y) * 3) {
          c = shade("dune", 6);
        } else {
          const p = patches[cell]!;
          const fleck = hash(Math.floor(u * 8), Math.floor(v * 8), salt + 42);
          const [ramp, n] = fleck < 0.05 ? look.fleck : p + (bayer(x, y) - 0.5) * 0.3 > 0.2 ? look.patch : look.base;
          c = shade(ramp, n);
          // The ground worn round the houses: earth showing through what grew there.
          if (m === Mark.Yard && hash(Math.floor(u * 9), Math.floor(v * 9), salt + 43) < 0.62) c = shade("mound", fleck < 0.5 ? 4 : 2);
        }
      }
      s.fset(fx0 + x, fy0 + y, shadow[y * fw + x] && (x + y) % 2 ? UNSEEN[c]! : c);
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

/** A mountain standing on the land: a lit face and a shaded one parted by a crooked ridge, a cap of snow with a ragged foot. */
export function drawPeak(s: Surface, ox: number, oy: number, it: SceneItem, sw: number, sh: number, salt: number): void {
  const k = s.k;
  const lean = (hash(it.x, 3, salt) - 0.5) * it.w * 0.25;
  const cx = (ox + it.x + it.w / 2 + lean) * k, top = (oy + it.y - it.h) * k, base = (oy + it.y) * k;
  const l = (ox + it.x) * k, r = (ox + it.x + it.w) * k;
  const clip = [ox * k, oy * k, (ox + sw) * k, (oy + sh) * k] as const;
  const snow = top + (base - top) * (0.28 + hash(it.y, 4, salt) * 0.12);
  // The ridge wanders down from the summit; each face takes the side of it.
  const zig = (t: number) => { const n = Math.floor(t), f = t - n, a = hash(n, it.x, salt) - 0.5, b = hash(n + 1, it.x, salt) - 0.5; return a + (b - a) * f; };
  const ridge = (y: number) => cx + zig((y - top) / 9) * (6 + (y - top) * 0.22) + (y - top) * 0.08;
  const ragged = (x: number) => snow + zig(x / 5) * 9;
  const rough = (x: number, y: number) => hash(Math.floor(x / 3), Math.floor(y / 2), salt);
  fillFine(s, [l, base, cx, top, r, base], ...clip, (x, y) => {
    const lit = x < ridge(y);
    if (y < ragged(x)) return shade("rock", lit ? 7 : 6);
    const g = rough(x, y);
    return lit ? shade("rock", g < 0.25 ? 2 : 3) : shade("rock", g < 0.3 ? 0 : 1);
  });
  // A dark line down each side, in the rock's own shade.
  for (let t = 0; t <= 1; t += 1 / (base - top + 1)) {
    const y = Math.round(top + (base - top) * t);
    for (const x of [Math.round(cx + (l - cx) * t), Math.round(cx + (r - cx) * t)])
      if (x >= clip[0] && x < clip[2] && y >= clip[1] && y < clip[3]) s.fset(x, y, shade("rock", 0));
  }
}

/** A low hill: grass on its top, earth on its shaded side, lit from the left. */
export function drawMound(s: Surface, ox: number, oy: number, it: SceneItem, sw: number, sh: number, salt: number): void {
  const k = s.k;
  const cx = (ox + it.x + it.w / 2) * k, base = (oy + it.y) * k, rx = (it.w / 2) * k, ry = it.h * k;
  const [x0, y0, x1, y1] = [ox * k, oy * k, (ox + sw) * k, (oy + sh) * k];
  for (let y = Math.max(y0, Math.floor(base - ry)); y < Math.min(y1, Math.ceil(base)); y++)
    for (let x = Math.max(x0, Math.floor(cx - rx)); x < Math.min(x1, Math.ceil(cx + rx)); x++) {
      const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - base) / ry;
      const d = dx * dx + dy * dy;
      if (d > 1) continue;
      const light = -dx * 0.85 - dy * 0.45 + (bayer(x, y) - 0.5) * 0.45;
      const fleck = hash(Math.floor(x / 2), Math.floor(y / 2), salt) < 0.06;
      s.fset(x, y, fleck ? shade("leaf", 5) : d > 0.86 && dy > -0.5 ? shade("mound", 2) : light > 0.55 ? shade("meadow", 6) : light > 0.1 ? shade("meadow", 4) : light > -0.3 ? shade("meadow", 3) : shade("mound", 4));
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

/**
 * A tree on the fine grid: broad-leaved, a pine or a poplar, its leaves lit from the upper left and its edge a dark
 * green, as the bushes in the user's pictures are (the drawn trees of the old view, ringed in black, looked pasted on).
 */
export function drawTree(s: Surface, ox: number, oy: number, it: SceneItem, sw: number, sh: number, salt: number): void {
  const k = s.k;
  const fx = (ox + it.x + it.w / 2) * k, fy = (oy + it.y) * k;
  const [x0, y0, x1, y1] = [ox * k, oy * k, (ox + sw) * k, (oy + sh) * k];
  const kind = it.tree ?? 0;
  const r = hash(it.x, it.y, salt + 8);
  const crown: [number, number, number, number][] = kind === 0 ? [[0, -14, 7, 7], [-5, -10, 5, 5], [5, -10, 5, 5]]
    : kind === 1 ? [[-3, -11, 6, 6], [4, -13, 6, 6], [1, -8, 6, 4]]
    : kind === 2 ? [] : [[0, -14, 4, 11]];
  const inCrown = (x: number, y: number) => {
    if (kind === 2) {
      // Three tiers narrowing to the top.
      for (const [t, half, top] of [[-4, 7, -12], [-9, 6, -17], [-14, 4, -22]] as const) {
        if (y <= t && y >= top && Math.abs(x) <= (half * (y - top + 1)) / (t - top + 1)) return true;
      }
      return false;
    }
    return crown.some(([cx, cy, rx, ry]) => disc(x, y, cx, cy, rx, ry) <= 1);
  };
  const set = (x: number, y: number, c: number) => { if (x >= x0 && x < x1 && y >= y0 && y < y1) s.fset(x, y, c); };
  // The trunk, with its foot in a dab of shade.
  for (let x = -5; x <= 5; x++) for (let y = -2; y <= 1; y++) if (disc(x, y, 1, 0, 5, 2) <= 1) set(fx + x, fy + y, shade("leaf", 1));
  for (let y = -7; y <= 0; y++) { set(fx - 1, fy + y, shade("hide", 2)); set(fx, fy + y, shade("hide", 1)); }
  const dark = kind === 2 ? [shade("leaf", 2), shade("leaf", 1)] : [shade("leaf", 3), shade("leaf", 2)];
  const bright = kind === 2 ? [shade("leaf", 5), shade("leaf", 4)] : r < 0.5 ? [shade("leaf", 7), shade("leaf", 6)] : [shade("meadow", 6), shade("leaf", 6)];
  for (let y = -24; y <= 0; y++)
    for (let x = -11; x <= 11; x++) {
      if (!inCrown(x, y)) continue;
      const edge = !inCrown(x - 1, y) || !inCrown(x + 1, y) || !inCrown(x, y - 1) || !inCrown(x, y + 1);
      if (edge) { set(fx + x, fy + y, shade("leaf", 0)); continue; }
      const light = (-x * 0.7 - (y + 13) * 0.8) / 7 + (bayer(x + 64, y + 64) - 0.5) * 0.5;
      set(fx + x, fy + y, light > 0.55 ? bright[0]! : light > 0.05 ? bright[1]! : light > -0.5 ? dark[0]! : dark[1]!);
    }
}
