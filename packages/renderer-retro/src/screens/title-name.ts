import { shade } from "../palette.js";
import type { Surface } from "../surface.js";

/**
 * The game's name on the title, as the original laid its own out (asked for 2026-11-01, with the original's
 * title as the model, "Avrik's" for its byline): tall, narrow Roman capitals with thick downstrokes, hairline
 * crossbars and bracketed serifs, shaded from brown at the ends of the word to cream in its middle, lit along
 * their left edges and shadowed along their right; above them the byline in small serif letters between two
 * ruled lines. Every letter is our own, built here from shapes (stems, wedges, rings, brush strokes) and
 * filled fine pixel by fine pixel in the palette's colours.
 */

/** Whether a point (fine pixels, in its letter's own frame) lies inside a shape. */
type Shape = (x: number, y: number) => boolean;

const rect = (x0: number, y0: number, x1: number, y1: number): Shape => (x, y) => x >= x0 && x < x1 && y >= y0 && y < y1;

/** A polygon, its corners as x, y pairs. */
function poly(...p: number[]): Shape {
  const n = p.length / 2;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i < p.length; i += 2) {
    x0 = Math.min(x0, p[i]!); x1 = Math.max(x1, p[i]!);
    y0 = Math.min(y0, p[i + 1]!); y1 = Math.max(y1, p[i + 1]!);
  }
  return (x, y) => {
    if (x < x0 || x > x1 || y < y0 || y > y1) return false;
    let inside = false;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const xi = p[2 * i]!, yi = p[2 * i + 1]!, xj = p[2 * j]!, yj = p[2 * j + 1]!;
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  };
}

/** An ellipse, turned `turn` radians. */
function oval(cx: number, cy: number, rx: number, ry: number, turn = 0): Shape {
  const c = Math.cos(turn), s = Math.sin(turn);
  const reach = Math.max(rx, ry);
  return (x, y) => {
    const dx = x - cx, dy = y - cy;
    if (dx > reach || dx < -reach || dy > reach || dy < -reach) return false;
    const u = (dx * c + dy * s) / rx, v = (-dx * s + dy * c) / ry;
    return u * u + v * v <= 1;
  };
}

const union = (...s: Shape[]): Shape => (x, y) => s.some((f) => f(x, y));
const minus = (a: Shape, ...b: Shape[]): Shape => (x, y) => a(x, y) && !b.some((f) => f(x, y));
const both = (a: Shape, b: Shape): Shape => (x, y) => a(x, y) && b(x, y);

/**
 * A serif's bracket: the curve from `a` (on the slab) to `b` (on the stem), bowed into the corner `p` where
 * they meet, filled between it and the corner.
 */
function bracket(px: number, py: number, ax: number, ay: number, bx: number, by: number): Shape {
  const pts = [px, py];
  for (let i = 0; i <= 8; i++) {
    const t = i / 8, u = 1 - t;
    pts.push(u * u * ax + 2 * u * t * px + t * t * bx, u * u * ay + 2 * u * t * py + t * t * by);
  }
  return poly(...pts);
}

/** A brush stroke through points [x, y, width], smooth between them (Catmull-Rom). */
function brush(...pts: [number, number, number][]): Shape {
  const dots: number[] = [];
  const at = (i: number) => pts[Math.max(0, Math.min(pts.length - 1, i))]!;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
    const steps = Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) * 4) + 1;
    for (let k = 0; k <= steps; k++) {
      const t = k / steps, t2 = t * t, t3 = t2 * t;
      const cr = (a: number, b: number, c: number, d: number) =>
        0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      dots.push(cr(p0[0], p1[0], p2[0], p3[0]), cr(p0[1], p1[1], p2[1], p3[1]), (p1[2] + (p2[2] - p1[2]) * t) / 2);
    }
  }
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i < dots.length; i += 3) {
    const r = dots[i + 2]!;
    x0 = Math.min(x0, dots[i]! - r); x1 = Math.max(x1, dots[i]! + r);
    y0 = Math.min(y0, dots[i + 1]! - r); y1 = Math.max(y1, dots[i + 1]! + r);
  }
  return (x, y) => {
    if (x < x0 || x > x1 || y < y0 || y > y1) return false;
    for (let i = 0; i < dots.length; i += 3) {
      const dx = x - dots[i]!, dy = y - dots[i + 1]!, r = dots[i + 2]!;
      if (dx * dx + dy * dy <= r * r) return true;
    }
    return false;
  };
}

/** Where two lines meet: the one through a and b, the one through c and d. */
function meet(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, dx: number, dy: number): [number, number] {
  const d = (ax - bx) * (cy - dy) - (ay - by) * (cx - dx);
  const p = ax * by - ay * bx, q = cx * dy - cy * dx;
  return [(p * (cx - dx) - (ax - bx) * q) / d, (p * (cy - dy) - (ay - by) * q) / d];
}

/** A face's measures, fine pixels: cap height, thick stem, hairline, serif reach, slab, bracket. */
interface Face { H: number; S: number; T: number; o: number; st: number; b: number }

interface Glyph { w: number; shape: Shape }

/** Slab serifs on a straight stem whose edges stand at `l` and `r` where it meets the slab (top or foot). */
function serif(f: Face, at: "top" | "foot", l: number, r: number, left: number, right: number, lean = 0, top = 0): Shape {
  const y0 = at === "top" ? top : f.H - f.st;
  const edge = at === "top" ? top + f.st : f.H - f.st;
  const dir = at === "top" ? 1 : -1;
  const reach = f.b * 1.7;
  const parts: Shape[] = [rect(l - left, y0, r + right, y0 + f.st)];
  // The bracket climbs the stem; a leaning stem's edge moves `lean` across for each pixel down.
  if (left) parts.push(bracket(l, edge, l - Math.min(left, f.b), edge, l + lean * reach * dir, edge + dir * reach));
  if (right) parts.push(bracket(r, edge, r + Math.min(right, f.b), edge, r + lean * reach * dir, edge + dir * reach));
  return union(...parts);
}

// ---- the capitals --------------------------------------------------------------------

function capI(f: Face): Glyph {
  const { H, S, o } = f;
  return { w: S + 2 * o, shape: union(rect(o, 0, o + S, H), serif(f, "top", o, o + S, o, o), serif(f, "foot", o, o + S, o, o)) };
}

function capL(f: Face): Glyph {
  const { H, S, T, o } = f;
  const w = Math.round(H * 0.47);
  const arm = T + 1;
  const spur = Math.round(H * 0.24);
  return {
    w,
    shape: union(
      rect(o, 0, o + S, H),
      serif(f, "top", o, o + S, o, o),
      rect(0, H - arm, w, H),
      bracket(o, H - arm, 0, H - arm, o, H - arm - f.b * 1.7),
      bracket(o + S, H - arm, o + S + f.b * 2, H - arm, o + S, H - arm - f.b * 2.5),
      // The arm's end turns up in a spur, leaning out.
      poly(w - T - 6, H - arm, w - T + 0.5, H - spur, w, H - spur - 1, w, H),
    ),
  };
}

function capT(f: Face): Glyph {
  const { H, S, T, o } = f;
  const w = Math.round(H * 0.56);
  const bar = T + 1;
  const spur = Math.round(H * 0.22);
  const l = Math.round((w - S) / 2);
  return {
    w,
    shape: union(
      rect(0, 0, w, bar),
      rect(l, 0, l + S, H),
      serif(f, "foot", l, l + S, o, o),
      bracket(l, bar, l - f.b, bar, l, bar + f.b * 1.5),
      bracket(l + S, bar, l + S + f.b, bar, l + S, bar + f.b * 1.5),
      // The bar's ends drop in spurs, leaning out.
      poly(0, 0, T + 6, bar, T + 0.5, spur, 0, spur + 1),
      poly(w, 0, w - T - 6, bar, w - T - 0.5, spur, w, spur + 1),
    ),
  };
}

/** The V, `share` of its height wide (the byline's small one wider). */
function capV(f: Face, share = 0.62): Glyph {
  const { H, S, T, o } = f;
  const w = Math.round(H * share);
  const thick = S * 1.18, thin = T * 1.33;
  const ax = w / 2;
  const [mx, my] = meet(o + thick, 0, ax + thick, H, w - o - thin, 0, ax - thin, H);
  const lean = (ax - o) / H;
  return {
    w,
    shape: union(
      minus(both(poly(o, 0, w - o, 0, ax, H + 1.5), rect(0, 0, w, H + 0.5)), poly(o + thick, -1, w - o - thin, -1, mx, my)),
      serif(f, "top", o, o + thick, o, o * 0.7, lean),
      serif(f, "top", w - o - thin, w - o, o * 0.7, o, -lean),
    ),
  };
}

/** The A, `share` of its height wide (the byline's small one wider, so its counter stays open). */
function capA(f: Face, share = 0.64): Glyph {
  const { H, S, T, o } = f;
  const w = Math.round(H * share);
  const thick = S * 1.18, thin = T * 1.33;
  const ax = w / 2 - 1;
  const lx = o, rx = w - o; // the legs' outer feet
  const [mx, my] = meet(lx + thin, H, ax - 2.5 + thin, -1, rx - thick, H, ax + 3 - thick, -1);
  const lean = (ax - lx) / H;
  const bar = Math.round(H * 0.64);
  const outer = poly(lx, H, ax - 2.5, -1, ax + 3, -1, rx, H);
  return {
    w,
    shape: union(
      minus(outer, poly(lx + thin, H + 1, rx - thick, H + 1, mx, my)),
      both(outer, rect(0, bar, w, bar + T + 1)),
      serif(f, "foot", lx, lx + thin, o, o * 0.7, lean),
      serif(f, "foot", rx - thick, rx, o * 0.7, o, -lean),
      // A beak at the apex, to the left.
      poly(ax - 2.5, -1, ax - 6, -1, ax - 2, 4),
    ),
  };
}

function capN(f: Face): Glyph {
  const { H, S, T, o } = f;
  const w = Math.round(H * 0.62);
  const thick = S * 1.18, thin = T * 1.33;
  const l = o, r = w - o;
  return {
    w,
    shape: union(
      rect(l, 0, l + thin, H),
      rect(r - thin, 0, r, H + 1.5),
      both(poly(l, 0, l + thick, 0, r, H + 1.5, r - thick, H + 1.5), rect(l, 0, r, H + 1.5)),
      serif(f, "top", l, l + thick, o, 0),
      serif(f, "foot", l, l + thin, o * 0.8, o * 0.8),
      serif(f, "top", r - thin, r, o * 0.8, o * 0.8),
    ),
  };
}

function capZ(f: Face): Glyph {
  const { H, S, T } = f;
  const w = Math.round(H * 0.5);
  const thick = S * 1.18, bar = T + 1;
  const spur = Math.round(H * 0.2);
  return {
    w,
    shape: union(
      rect(2, 0, w - 2, bar),
      rect(0, H - bar, w, H),
      both(poly(w - 2 - thick, 0, w - 2, 0, thick, H, 0, H), rect(0, 0, w, H)),
      poly(2, 0, T + 7, bar, T + 2.5, spur, 2, spur + 1),
      poly(w, H, w - T - 7, H - bar, w - T - 0.5, H - spur, w, H - spur - 1),
    ),
  };
}

function capO(f: Face): Glyph {
  const { H, S, T } = f;
  const w = Math.round(H * 0.66);
  const cx = w / 2, cy = H / 2;
  return { w, shape: minus(oval(cx, cy, w / 2, H / 2 + 1), oval(cx, cy, w / 2 - S - 1, H / 2 - T, -0.22)) };
}

function capC(f: Face): Glyph {
  const { H, S, T } = f;
  const w = Math.round(H * 0.56);
  const rx = w / 2 + 3, cx = rx, cy = H / 2;
  const beak = Math.round(H * 0.25);
  return {
    w,
    shape: union(
      minus(oval(cx, cy, rx, H / 2 + 1), oval(cx + 1, cy, rx - S - 1, H / 2 - T, -0.22), rect(cx + rx * 0.3, H * 0.16, w * 2, H * 0.86), rect(w, -2, w * 2, H + 2)),
      // A beak on the upper arm's end, hanging down; the lower arm's end turned up a little.
      both(poly(w - T - 3, 0, w, -1, w, beak, w - T - 1.5, beak - 2), oval(cx - 1, cy, rx + 1, H / 2 + 1.5)),
      both(poly(w - T - 3, H, w, H + 1, w, H - beak * 0.55, w - T - 1, H - beak * 0.5), oval(cx - 1, cy, rx + 1, H / 2 + 1.5)),
    ),
  };
}

const CAPS: Record<string, (f: Face) => Glyph> = { C: capC, I: capI, V: capV, L: capL, Z: capZ, A: capA, T: capT, O: capO, N: capN };

// ---- the byline's small letters -----------------------------------------------------------

/** The byline's face: its capitals, and the height of its small letters. */
interface Small extends Face { x: number }

function smallV(f: Small): Glyph {
  const g = capV({ ...f, H: f.x }, 0.8);
  const top = f.H - f.x;
  return { w: g.w, shape: (x, y) => g.shape(x, y - top) };
}

function smallI(f: Small): Glyph {
  const { H, S, x: xh, o } = f;
  const top = H - xh;
  const w = S + 2 * o;
  return {
    w,
    shape: union(
      rect(o, top, o + S, H),
      serif(f, "top", o, o + S, o, 0, 0, top),
      serif(f, "foot", o, o + S, o, o),
      oval(o + S / 2, top - 3.6, S * 0.62, S * 0.62),
    ),
  };
}

function smallR(f: Small): Glyph {
  const { H, S, T, x: xh, o } = f;
  const top = H - xh;
  const w = S + 2 * o + 4;
  const r = o + S;
  return {
    w,
    shape: union(
      rect(o, top, r, H),
      serif(f, "top", o, r, o, 0, 0, top),
      serif(f, "foot", o, r, o, o + 1),
      brush([r - 0.5, top + 4.5, T], [r + 2, top + 1.2, T + 0.4], [r + 4.5, top + 0.8, T + 0.8], [r + 6, top + 1.8, T + 1.4]),
    ),
  };
}

function smallK(f: Small): Glyph {
  const { H, S, T, x: xh, o } = f;
  const top = H - xh;
  const r = o + S;
  const w = r + Math.round(xh * 0.62) + 2;
  const join = top + xh * 0.58;
  return {
    w,
    shape: union(
      rect(o, 0, r, H),
      serif(f, "top", o, r, o, 0),
      serif(f, "foot", o, r, o, o * 0.6),
      // The arm, a hairline up to the x-height, its end slabbed; the leg, thick down to the line.
      poly(r - 0.5, join, r - 0.5, join + T + 0.5, w - 3, top + f.st, w - 3 - T - 1.5, top + f.st),
      rect(w - 3 - T - 4, top, w, top + f.st),
      poly(r + 0.5, join - 1, r + 3.2, join - 2.5, w - 2, H, w - 2 - S - 1, H),
      rect(w - S - 5, H - f.st, w + 0.5, H),
    ),
  };
}

function smallS(f: Small): Glyph {
  const { H, S, T, x: xh } = f;
  const top = H - xh;
  const w = Math.round(xh * 0.66);
  const m = w / 2;
  return {
    w,
    shape: union(
      brush(
        [w - 1.2, top + 3.6, T],
        [w - 2.4, top + 1.4, T],
        [m, top + 0.9, T + 0.6],
        [1.8, top + 2.6, T + 1.4],
        [2.2, top + xh * 0.36, S + 0.2],
        [m, top + xh * 0.5, S + 0.6],
        [w - 2, top + xh * 0.66, S + 0.2],
        [w - 1.8, H - 2.4, T + 1.4],
        [m, H - 0.9, T + 0.6],
        [2.2, H - 1.6, T],
        [1, H - 3.8, T],
      ),
      rect(w - T - 0.5, top + 0.4, w, top + 4.6),
      rect(0, H - 4.8, T + 0.5, H - 0.4),
    ),
  };
}

/** The apostrophe: a drop with a tail curling down to the left. */
function smallQuote(f: Small): Glyph {
  const { S, T } = f;
  return { w: S + 3, shape: brush([S / 2 + 1.5, 2.2, S + 1.2], [S / 2 + 1.6, 4.4, S], [S / 2 + 0.6, 7.6, T], [S / 2 - 0.8, 9.6, 1]) };
}

const SMALL: Record<string, (f: Small) => Glyph> = {
  A: (f) => capA(f, 0.8),
  v: smallV,
  r: smallR,
  i: smallI,
  k: smallK,
  "'": smallQuote,
  s: smallS,
};

// ---- the title, laid out -------------------------------------------------------------------

const NAME = "CIVILIZATION";
const BYLINE = "Avrik's";
const NAME_FACE: Face = { H: 80, S: 11, T: 3, o: 6, st: 3, b: 5 };
const BYLINE_FACE: Small = { H: 23, S: 3.6, T: 1.6, o: 2.2, st: 1.5, b: 1.6, x: 15 };
/** Fine pixels between letters: the name's set tight, serif to serif, as cut in stone. */
const NAME_GAP = 2;
const BYLINE_GAP = 1.8;
/** Fine pixels between the byline's rules and its first and last letters. */
const RULE_GAP = 12;

/** The byline's capital top and the name's, in screen pixels; the name's foot. */
const BYLINE_Y = 4;
const NAME_Y = 19;
/** The first screen row clear of the name (its apexes and outline reach a pixel under its line): whatever is laid over the title keeps to this and below. */
export const TITLE_NAME_BOTTOM = NAME_Y + Math.ceil(NAME_FACE.H / 2) + 2;

/** Each fine pixel of the title block: what it is (OUT empty) and, on a letter's face, how light (0..1). */
const OUT = 0, EDGE = 1, SHADOW = 2, LIT = 3, FACE = 4, BYLINE_INK = 5, RULE_THIN = 6, RULE_THICK = 7;

interface TitleArt { w: number; h: number; kind: Uint8Array; light: Float32Array }


/** A word's letters side by side from x 0, each at its place, and the width they take. */
function setWord(word: string, make: (ch: string) => Glyph, gap: number): { w: number; placed: { x: number; g: Glyph }[] } {
  const placed: { x: number; g: Glyph }[] = [];
  let x = 0;
  for (const ch of word) {
    const g = make(ch);
    placed.push({ x, g });
    x += g.w + gap;
  }
  return { w: x - gap, placed };
}

/** Whether a shape covers at least half a fine pixel: two by two samples, four by four where they disagree. */
function inked(shape: Shape, x: number, y: number): boolean {
  let n = 0;
  for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) if (shape(x + 0.25 + i * 0.5, y + 0.25 + j * 0.5)) n++;
  if (n === 0 || n === 4) return n === 4;
  n = 0;
  for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) if (shape(x + (i + 0.5) / 4, y + (j + 0.5) / 4)) n++;
  return n >= 8;
}

/** Ink a letter into `ink` (`fw` wide, `h` tall) as `mark`, its word's left at `wx`, its cap top at `wy`. */
function inkLetter(ink: Uint8Array, fw: number, h: number, { x: gx, g }: { x: number; g: Glyph }, wx: number, wy: number, H: number, mark: number): void {
  const left = Math.floor(wx + gx) - 4, right = Math.ceil(wx + gx + g.w) + 4;
  for (let y = Math.max(0, wy - 6); y < Math.min(h, wy + H + 4); y++) {
    for (let x = Math.max(0, left); x < Math.min(fw, right); x++) {
      if (!ink[y * fw + x] && inked(g.shape, x - wx - gx, y - wy)) ink[y * fw + x] = mark;
    }
  }
}

/** The title being drawn: the letters still to ink, a step each, then the kinds and light worked out. */
interface Build { fw: number; todo: (() => void)[]; art?: TitleArt }

let build: Build | undefined;

function begin(fw: number, k: number): Build {
  if (build?.fw === fw) return build;
  const name = setWord(NAME, (ch) => CAPS[ch]!(NAME_FACE), NAME_GAP);
  const byline = setWord(BYLINE, (ch) => SMALL[ch]!(BYLINE_FACE), BYLINE_GAP);
  const h = (NAME_Y - BYLINE_Y) * k + NAME_FACE.H + 4;
  const nx = Math.round((fw - name.w) / 2), ny = (NAME_Y - BYLINE_Y) * k;
  const bx = Math.round((fw - byline.w) / 2);
  const ink = new Uint8Array(fw * h);
  const b: Build = { fw, todo: [] };
  for (const p of name.placed) b.todo.push(() => inkLetter(ink, fw, h, p, nx, ny, NAME_FACE.H, 1));
  for (const p of byline.placed) b.todo.push(() => inkLetter(ink, fw, h, p, bx, 0, BYLINE_FACE.H, 2));
  b.todo.push(() => {
    b.art = finish(ink, fw, h, nx, name.w, [[nx + 1, bx - RULE_GAP], [Math.round(bx + byline.w + RULE_GAP), Math.round(nx + name.w - 1)]]);
  });
  build = b;
  return b;
}

/**
 * The title's letters drawn ahead, one a call: the opening calls this each frame before the name shows, so the
 * name costs nothing when it comes.
 */
export function prepareTitleName(fw: number, k: number): void {
  begin(fw, k).todo.shift()?.();
}

/** The title drawn once into kinds and light per fine pixel, on a screen `fw` fine pixels wide. */
function titleArt(fw: number, k: number): TitleArt {
  const b = begin(fw, k);
  while (b.todo.length) b.todo.shift()!();
  return b.art!;
}

/** The inked letters as kinds of pixel, with the face's light; the byline's rules, each run from x to x. */
function finish(ink: Uint8Array, fw: number, h: number, nx: number, nameW: number, rules: [number, number][]): TitleArt {
  const kind = new Uint8Array(fw * h);
  const light = new Float32Array(fw * h);
  const at = (x: number, y: number) => (x >= 0 && y >= 0 && x < fw && y < h ? ink[y * fw + x]! : 0);
  // Brown at the word's ends, cream in its middle.
  const glow = (x: number) => 1 - Math.pow(Math.min(1, Math.abs(x - nx - nameW / 2) / (nameW / 2)), 1.5);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < fw; x++) {
      const i = y * fw + x;
      const v = ink[i]!;
      if (v === 2) kind[i] = BYLINE_INK;
      else if (v === 1) {
        // Lit from the left: the edge facing it pale, the edge away from it in shadow.
        kind[i] = at(x + 1, y) !== 1 ? SHADOW : at(x - 1, y) !== 1 ? LIT : FACE;
        light[i] = glow(x);
      } else {
        let near = false;
        for (let dy = -1; dy <= 1 && !near; dy++) for (let dx = -1; dx <= 1 && !near; dx++) near = at(x + dx, y + dy) !== 0;
        if (near) kind[i] = EDGE;
      }
    }
  }
  // The byline's rules: a hairline over a band, their foot on its line.
  const foot = BYLINE_FACE.H;
  for (const [from, to] of rules) {
    for (let x = from; x < to; x++) {
      for (let y = foot - 7; y < foot; y++) {
        const i = y * fw + x;
        kind[i] = y < foot - 5 ? RULE_THIN : y === foot - 5 ? OUT : RULE_THICK;
        light[i] = glow(x);
      }
    }
  }
  return { w: fw, h, kind, light };
}

/** The faces' colours, dark to light: deep browns (the dark it comes up out of), browns, then creams. */
const FACE_RAMP = () => [
  shade("hide", 0), shade("hide", 1), shade("earth", 2), shade("earth", 3), shade("earth", 4), shade("earth", 5),
  shade("earth", 6), shade("earth", 7), shade("rock", 4), shade("rock", 5), shade("rock", 6), shade("rock", 7),
];
/** Where a face's light starts on FACE_RAMP: its darkest at the word's ends. */
const FACE_FROM = 4;
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((n) => (n + 0.5) / 16);

/**
 * The title, `name` 0..1 of the way up out of the dark (the opening's last moments), a glint sweeping across it
 * as it lands.
 */
export function drawTitleName(s: Surface, name: number): void {
  const { w, h, kind, light } = titleArt(s.fw, s.k);
  const ramp = FACE_RAMP();
  const top = ramp.length - 1;
  const y0 = BYLINE_Y * s.k;
  const dark = (1 - name) * (top + 1);
  const glint = name > 0.3 && name < 1 ? -40 + (w + 80) * ((name - 0.3) / 0.7) : -1e9;
  const edge = shade("azure", 0), shadow = shade("azure", 1), lit = shade("azure", 7);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const kd = kind[i]!;
      if (kd === OUT) continue;
      if (kd === EDGE) {
        if (dark < 4) s.fset(x, y0 + y, edge);
        continue;
      }
      let lv: number;
      if (kd === BYLINE_INK) lv = top - 0.5;
      else if (kd === RULE_THIN) lv = FACE_FROM + 2 + light[i]! * (top - FACE_FROM - 3);
      else if (kd === RULE_THICK) lv = FACE_FROM - 1 + light[i]! * (top - FACE_FROM - 3);
      else lv = FACE_FROM + light[i]! * (top - FACE_FROM);
      if (Math.abs(x + y * 0.7 - glint) < 7) lv += 3;
      lv -= dark;
      if (lv < 0) continue;
      if (name >= 1 && kd === SHADOW) { s.fset(x, y0 + y, shadow); continue; }
      if (name >= 1 && kd === LIT) { s.fset(x, y0 + y, lit); continue; }
      const step = Math.min(top, Math.floor(lv + BAYER[(y & 3) * 4 + (x & 3)]! - 0.5));
      s.fset(x, y0 + y, ramp[Math.max(0, step)]!);
    }
  }
}
