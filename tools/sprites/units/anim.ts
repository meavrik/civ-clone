// Lays out the user's sheets of units' moves as atlases the game plays, every pixel as it is: militia-anim.png
// (2026-10-28: the militia in 14 frames, rows of 6 attack, 4 sentry and 4 fortify frames), militia-travel-anim.png
// (2026-10-30: the militia walking, 6 frames, rows of 3, drawn larger than the first sheet), militia-won-anim.png
// (the same day: winning a fight, the club raised and the fists up, 6 frames, rows of 3, on a green screen, keyed
// clear first: `keyGreen`), settlers-anim.png
// (2026-10-29: the settlers in 24 frames, rows of 6 for travel, road building, irrigation and mining) and
// settlers-found-anim.png (the same day: the settlers founding their city in 6 frames, rows of 3, the flag lifted,
// raised and planted, then unfurled, flying, and the family cheering under it), all on a clear background. Run from
// the repo root:
//   npx vite-node --script tools/sprites/units/anim.ts
// The militia's sheet is generated art, not an even grid: each frame is found as its own piece of opaque pixels
// (alpha over 64), its source rectangle the piece's bounds a few pixels out. Each frame's anchor is where it stands:
// its front (right) foot's middle on the ground, the foot planted in all three moves (the back foot steps, the body
// leans, it kneels). The settlers' sheet is an even grid (`cell`: 256 pixels a frame), each frame three people (and
// the dirt flying off a spade), so a frame is every piece whose middle lies in its cell, and its anchor the middle of
// its cell on its row's ground (the lowest foot in the row): the sheet keeps them in register, and the walking feet
// move as drawn. A piece lying across a cell's edge with a share of itself on each side (two frames' drawings that
// touch: the first settlement sheet's posts and logs did) is split at its thinnest column near the edge. The frames go onto canvases of one size, unscaled, each placed so its anchor falls on the canvas's
// one anchor: the feet stay put from frame to frame and the body moves as drawn; the canvas is large enough for
// every frame, club and all. Writes each atlas (the canvases side by side) to apps/web/src/units/<unit>-anim.png and
// their metadata (source rectangles, anchors, the drawing's box in each canvas) to
// packages/renderer-api/src/unit-atlas.ts. The sequences and their timings are set in renderer-api's unit-anim.ts.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { keyGreen } from "../src/chroma.js";
import { decodePng, encodePng } from "../src/png.js";

const here = (p: string) => resolve(fileURLToPath(new URL(p, import.meta.url)));

/**
 * Each sheet: its rows of frames, top to bottom, left to right, by name; its cell's side when it is an even grid; `green`
 * when drawn on a green screen; `align`, runs of frames (first, last) to put in register by the part of the figure that
 * stays put in them (`register`), with the `home` frame (the one the unit stands in).
 */
type Align = [first: string, last: string, by: "legs" | "body" | "wheels"];
type Sheet = { rows: string[][]; cell?: number; green?: boolean; align?: Align[]; home?: string };

/**
 * The layout every unit's sheet takes since the hoplite (2026-10-30, the sheets' prompt): one sheet of 1536x1024 on a
 * green screen, a 256-pixel grid of rows of 6: moving, the attack (striking on its fourth frame), the victory, then the
 * watch (3) and the fortifying (3), the unit standing in the first watch frame. Each run put in register with that one
 * by the part named (`align`), the fortifying left as drawn unless `fortify` names a part.
 */
function oneSheet(by: { travel: Align[2]; attack: Align[2]; won: Align[2]; fortify?: Align[2] }, fortify = ["fortify-1", "fortify-2", "fortify-3"]): Sheet {
  return {
    cell: 256,
    green: true,
    rows: [
      [1, 2, 3, 4, 5, 6].map((n) => `travel-${n}`),
      ["ready", "anticipation", "wind-up", "strike", "follow-through", "recovery"],
      [1, 2, 3, 4, 5, 6].map((n) => `won-${n}`),
      ["sentry-1", "sentry-2", "sentry-3", ...fortify],
    ],
    home: "sentry-1",
    align: [
      ["travel-1", "travel-6", by.travel],
      ["ready", "recovery", by.attack],
      ["won-1", "won-6", by.won],
      ...(by.fortify ? [["sentry-1", fortify[2]!, by.fortify] as Align] : [["sentry-1", "sentry-3", "legs"] as Align]),
    ],
  };
}

const SHEETS: Record<string, Sheet> = {
  militia: {
    rows: [
      ["ready", "anticipation", "wind-up", "strike", "follow-through", "recovery"],
      ["sentry-1", "sentry-2", "sentry-3", "sentry-4"],
      ["standing", "lowering", "kneeling", "defensive-hold"],
    ],
  },
  "militia-travel": {
    cell: 512,
    rows: [
      ["travel-1", "travel-2", "travel-3"],
      ["travel-4", "travel-5", "travel-6"],
    ],
  },
  "militia-won": {
    cell: 512,
    green: true,
    rows: [
      ["won-1", "won-2", "won-3"],
      ["won-4", "won-5", "won-6"],
    ],
  },
  settlers: {
    cell: 256,
    rows: ["travel", "road", "irrigate", "mine"].map((move) => [1, 2, 3, 4, 5, 6].map((n) => `${move}-${n}`)),
  },
  "settlers-found": {
    cell: 512,
    rows: [
      ["lift", "raise", "plant"],
      ["unfurl", "fly", "cheer"],
    ],
  },
  // Drawn out of register (the strike 38 pixels behind the ready stance to fit the spear in its cell, the
  // follow-through 35 ahead, the walk drifting back 27 over its six steps): the walk by its body, the thrust, the
  // cheer and the watch by the feet planted under them; the kneeling as drawn, behind the shield that stays put.
  phalanx: oneSheet({ travel: "body", attack: "legs", won: "legs" }, ["lowering", "kneeling", "shield-wall"]),
  // Its crewman crouches, steps away and stumbles back about the cart, so every run by the wheels (the cart drawn up
  // to 14 pixels off from frame to frame; its loosed stone lies across the next cell's edge, kept with its trail).
  catapult: oneSheet({ travel: "wheels", attack: "wheels", won: "wheels", fortify: "wheels" }),
};
/** Alpha over which a pixel is the frame's own (under it: soft edges, kept with their frame). */
const SOLID = 64;
/** Pieces smaller than this are specks: a frame of its own on a sheet without a grid, part of its cell's frame on a grid. */
const SPECK = 500;
const GRID_SPECK = 20;
/** On a grid, a piece with at least this share of itself on each side of a cell's edge is two frames' drawings touching. */
const STRADDLE = 0.1;
/** ... and is split there only at a column this many times thinner than its thickest. */
const THIN = 3;
/** Pixels kept round each frame's bounds, and round the drawings on the canvas. */
const MARGIN = 2;
/** How far a soft pixel looks for the frame it belongs to. */
const REACH = 4;
/** The rows at the foot of a frame read for its ground contact. */
const FOOT_ROWS = 4;
/** In registering frames, the share of the home frame's height (from the ground) that is its legs; the body is above it. */
const LEGS = 0.45;
/** ... and that is its wheels. */
const WHEELS = 0.25;

type Box = { x: number; y: number; w: number; h: number };
const tuple = (b: Box) => `[${b.x}, ${b.y}, ${b.w}, ${b.h}]`;

function cut(unit: string, rows: string[][], cell?: number, green?: boolean, align?: Align[], home?: string) {
  const sheet = decodePng(new Uint8Array(readFileSync(here(`./${unit}-anim.png`))));
  const { width: W, height: H, data } = sheet;
  // A green screen made clear behind the figures, their pixels as they are.
  if (green) keyGreen(data);
  let soft = 0;
  for (let i = 3; i < data.length; i += 4) if (data[i]! > 0 && data[i]! < 255) soft++;
  const clear = data.filter((_, i) => i % 4 === 3 && data[i] === 0).length;
  console.log(`${unit}-anim.png ${W}x${H}: ${clear} clear pixels, ${soft} partly clear (a transparent background, not black)`);

  // The pieces of opaque pixels.
  const solid = (i: number) => data[i * 4 + 3]! > SOLID;
  const owner = new Int32Array(W * H).fill(-1);
  const pieces: (Box & { x1: number; y1: number; n: number; id: number })[] = [];
  for (let s = 0; s < W * H; s++) {
    if (!solid(s) || owner[s]! >= 0) continue;
    const id = pieces.length;
    const p = { x: W, y: H, x1: -1, y1: -1, w: 0, h: 0, n: 0, id };
    pieces.push(p);
    const stack = [s];
    owner[s] = id;
    while (stack.length) {
      const i = stack.pop()!;
      const x = i % W, y = Math.floor(i / W);
      p.n++;
      p.x = Math.min(p.x, x); p.x1 = Math.max(p.x1, x); p.y = Math.min(p.y, y); p.y1 = Math.max(p.y1, y);
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const j = ny * W + nx;
          if (solid(j) && owner[j]! < 0) { owner[j] = id; stack.push(j); }
        }
    }
    p.w = p.x1 - p.x + 1; p.h = p.y1 - p.y + 1;
  }
  const count = rows.flat().length;
  // Each frame: its pieces (one on a sheet without a grid, every piece whose middle lies in its cell on a grid).
  type Piece = (typeof pieces)[number];
  let ordered: { pieces: Piece[]; specks?: Piece[]; x: number; y: number; x1: number; y1: number; w: number; h: number }[];
  const bounds = (ps: Piece[]) => {
    const b = { pieces: ps, x: Math.min(...ps.map((p) => p.x)), y: Math.min(...ps.map((p) => p.y)), x1: Math.max(...ps.map((p) => p.x1)), y1: Math.max(...ps.map((p) => p.y1)), w: 0, h: 0 };
    return { ...b, w: b.x1 - b.x + 1, h: b.y1 - b.y + 1 };
  };
  if (cell) {
    // Drawings of two frames that touch across a cell's edge: split at the piece's thinnest column within an
    // eighth of a cell of the edge, where it is thin (a third of its thickest column or less) and leaves a share of
    // it each side. One with no such column is one thing lying across the edge (the catapult's stone flying off).
    const astride = new Set<number>();
    for (const p of pieces.slice()) {
      for (let edge = (Math.floor(p.x / cell) + 1) * cell; edge <= p.x1; edge += cell) {
        const across = new Map<number, number>();
        let left = 0;
        for (let y = p.y; y <= p.y1; y++)
          for (let x = p.x; x <= p.x1; x++)
            if (owner[y * W + x] === p.id) { across.set(x, (across.get(x) ?? 0) + 1); if (x < edge) left++; }
        if (left < p.n * STRADDLE || p.n - left < p.n * STRADDLE) continue;
        const thickest = Math.max(...across.values());
        let seam = -1, before = 0;
        for (let x = p.x; x <= Math.min(p.x1, edge + cell / 8); before += across.get(x) ?? 0, x++) {
          if (x < edge - cell / 8 || before < p.n * STRADDLE || p.n - before < p.n * STRADDLE) continue;
          if (seam < 0 || (across.get(x) ?? 0) < (across.get(seam) ?? 0)) seam = x;
        }
        if (seam < 0 || (across.get(seam) ?? 0) > thickest / THIN) { astride.add(p.id); continue; }
        const q = { id: pieces.length, x: W, y: H, x1: -1, y1: -1, w: 0, h: 0, n: 0 };
        const kept = { x: W, y: H, x1: -1, y1: -1, n: 0 };
        for (let y = p.y; y <= p.y1; y++)
          for (let x = p.x; x <= p.x1; x++) {
            const i = y * W + x;
            if (owner[i] !== p.id) continue;
            const b = x >= seam ? q : kept;
            if (x >= seam) owner[i] = q.id;
            b.n++; b.x = Math.min(b.x, x); b.x1 = Math.max(b.x1, x); b.y = Math.min(b.y, y); b.y1 = Math.max(b.y1, y);
          }
        console.log(`  split a piece at ${seam} (the cell's edge at ${edge}): ${kept.n} and ${q.n} pixels`);
        Object.assign(p, kept, { w: kept.x1 - kept.x + 1, h: kept.y1 - kept.y + 1 });
        pieces.push({ ...q, w: q.x1 - q.x + 1, h: q.y1 - q.y + 1 });
        break;
      }
    }
    const middle = new Map<number, [number, number]>();
    for (let i = 0; i < W * H; i++) {
      const o = owner[i]!;
      if (o < 0) continue;
      const m = middle.get(o) ?? [0, 0];
      m[0] += i % W; m[1] += Math.floor(i / W);
      middle.set(o, m);
    }
    // A piece lying across an edge goes with the piece nearest it (the stone with its trail), whose middle says where.
    const nearest = (p: Piece): number => {
      const seen = new Uint8Array(W * H);
      let front: number[] = [];
      for (let y = p.y; y <= p.y1; y++) for (let x = p.x; x <= p.x1; x++) if (owner[y * W + x] === p.id) { seen[y * W + x] = 1; front.push(y * W + x); }
      for (let step = 0; step < cell / 4 && front.length; step++) {
        const next: number[] = [];
        for (const i of front)
          for (let dy = -1; dy <= 1; dy++)
            for (let dx = -1; dx <= 1; dx++) {
              const x = (i % W) + dx, y = Math.floor(i / W) + dy, j = y * W + x;
              if (x < 0 || y < 0 || x >= W || y >= H || seen[j]) continue;
              seen[j] = 1;
              const o = owner[j]!;
              if (o >= 0 && !astride.has(o)) return o;
              next.push(j);
            }
        front = next;
      }
      throw new Error(`${unit}: a piece at ${p.x},${p.y} lies across a cell's edge with nothing near it`);
    };
    const cells: Piece[][] = rows.flatMap((r) => r.map(() => []));
    const specks: Piece[][] = rows.flatMap((r) => r.map(() => []));
    for (const p of pieces) {
      const by = astride.has(p.id) ? pieces[nearest(p)]! : p;
      if (by !== p) console.log(`  a piece across a cell's edge at ${p.x}-${p.x1},${p.y}-${p.y1} goes with the one at ${by.x}-${by.x1},${by.y}-${by.y1}`);
      const [mx, my] = middle.get(by.id)!;
      const [sx, sy] = [(mx / by.n) * p.n, (my / by.n) * p.n];
      const col = Math.floor(sx / p.n / cell), row = Math.floor(sy / p.n / cell);
      const named = row < rows.length && col < rows[row]!.length;
      const n = named ? rows.slice(0, row).reduce((a, r) => a + r.length, 0) + col : -1;
      // A speck: on a green screen, part of the drawing (the dots trailing a catapult's stone), kept with its cell's
      // frame within the bounds of the rest; on a clear sheet, the glow round the figures, left out.
      if (p.n < GRID_SPECK) {
        if (green && named) specks[n]!.push(p);
        continue;
      }
      if (!named) throw new Error(`${unit}: a piece at ${p.x},${p.y} lies in no named cell`);
      cells[n]!.push(p);
    }
    cells.forEach((c, n) => { if (!c.length) throw new Error(`${unit}: frame ${rows.flat()[n]} is empty`); });
    ordered = cells.map((c, n) => ({ ...bounds(c), specks: specks[n]! }));
  } else {
    const frames = pieces.filter((p) => p.n >= SPECK);
    if (frames.length !== count) throw new Error(`${unit}: the sheet has ${frames.length} frames, the rows name ${count}`);
    const byRow = frames.slice().sort((a, b) => a.y + a.y1 - (b.y + b.y1));
    ordered = [];
    let at = 0;
    for (const row of rows) {
      ordered.push(...byRow.slice(at, at + row.length).sort((a, b) => a.x - b.x).map((p) => bounds([p])));
      at += row.length;
    }
  }

  const nearest = (x: number, y: number): number => {
    let best = -1, bestD = Infinity;
    for (let dy = -REACH; dy <= REACH; dy++)
      for (let dx = -REACH; dx <= REACH; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const o = owner[ny * W + nx]!;
        if (o >= 0 && dx * dx + dy * dy < bestD) { bestD = dx * dx + dy * dy; best = o; }
      }
    return best;
  };

  // On a grid, each row's ground: under the lowest foot in the row.
  const rowOf = (n: number) => rows.findIndex((_, r) => n < rows.slice(0, r + 1).reduce((a, row) => a + row.length, 0));
  const ground = rows.map((_, r) => Math.max(...ordered.filter((_, n) => rowOf(n) === r).map((p) => p.y1 + 1)));

  // Each frame: its source rectangle, and its anchor (sheet pixels): the front foot's middle, on the ground under it
  // (on a grid, the middle of its cell on its row's ground).
  const cuts = ordered.map((p, n) => {
    const source = { x: Math.max(0, p.x - MARGIN), y: Math.max(0, p.y - MARGIN), w: 0, h: 0 };
    source.w = Math.min(W - 1, p.x1 + MARGIN) - source.x + 1;
    source.h = Math.min(H - 1, p.y1 + MARGIN) - source.y + 1;
    let anchor: { x: number; y: number };
    if (cell) {
      const r = rowOf(n);
      const col = n - rows.slice(0, r).reduce((a, row) => a + row.length, 0);
      anchor = { x: col * cell + cell / 2, y: ground[r]! };
    } else {
      const id = p.pieces[0]!.id;
      let front: [number, number] = [-1, -1];
      for (let y = p.y1 - FOOT_ROWS + 1; y <= p.y1; y++) {
        let x = p.x1;
        while (x >= p.x && owner[y * W + x] !== id) x--;
        if (x < p.x) continue;
        let x0 = x;
        while (x0 > p.x && owner[y * W + x0 - 1] === id) x0--;
        if (x0 > front[0]) front = [x0, x];
      }
      anchor = { x: Math.round((front[0] + front[1] + 1) / 2), y: p.y1 + 1 };
    }
    return { name: rows.flat()[n]!, ids: new Set([...p.pieces, ...(p.specks ?? [])].map((q) => q.id)), source, anchor, box: { x: p.x, y: p.y, w: p.w, h: p.h } };
  });

  // Frames drawn out of register (a generated sheet sets its figure a little differently in each cell, so it would
  // shuffle to and fro as it moves): each run named in `align` put in register by the part of the figure that stays put
  // in it, its legs (a thrust, a cheer: the feet planted), its body above them (a walk: the legs swing under a body
  // going steadily on) or its wheels, the lowest quarter of it (an engine's, which outweigh its crew's feet there as
  // they crouch and stumble behind it; its cart rocking up off its front wheel as it shoots kicks back), each frame
  // with the run's first and that with the home frame, by the shift across that lays most of their pixels in that part
  // on each other's (the smaller shift on a tie). Only the anchors move.
  if (align?.length) {
    const names = rows.flat();
    const at = (name: string) => {
      const n = names.indexOf(name);
      if (n < 0) throw new Error(`${unit}: no frame ${name} to register`);
      return n;
    };
    const homeN = at(home ?? names[0]!);
    // Each frame's own pixels round its anchor: 2R across, R up from the ground.
    const R = cell ?? 256;
    const masks = cuts.map((c) => {
      const m = new Uint8Array(2 * R * R);
      for (let y = c.source.y; y < c.source.y + c.source.h; y++)
        for (let x = c.source.x; x < c.source.x + c.source.w; x++) {
          const o = owner[y * W + x]!;
          if (o < 0 || !c.ids.has(o)) continue;
          const mx = x - c.anchor.x + R, my = y - c.anchor.y + R;
          if (mx >= 0 && mx < 2 * R && my >= 0 && my < R) m[my * 2 * R + mx] = 1;
        }
      return m;
    });
    const tall = cuts[homeN]!.anchor.y - cuts[homeN]!.box.y;
    const knee = R - Math.round(LEGS * tall);
    // How far across frame b's figure stands from frame a's, by the part `by`.
    const register = (a: number, b: number, by: Align[2]): number => {
      const [y0, y1] = by === "body" ? [R - tall, knee] : by === "legs" ? [knee, R] : [R - Math.round(WHEELS * tall), R];
      let best = 0, most = -1;
      for (let k = 0; k <= R / 2; k++) {
        const s = k % 2 ? (k + 1) / 2 : -k / 2;
        let sum = 0;
        for (let y = Math.max(0, y0); y < y1; y++)
          for (let x = Math.max(0, -s), row = y * 2 * R; x < Math.min(2 * R, 2 * R - s); x++) sum += masks[a]![row + x]! & masks[b]![row + x + s]!;
        if (sum > most) { most = sum; best = s; }
      }
      return best;
    };
    const moves = align.map(([first, last, by]) => {
      const f = at(first), l = at(last);
      const lead = f === homeN ? 0 : register(homeN, f, by);
      return { f, shifts: Array.from({ length: l - f + 1 }, (_, i) => lead + (i ? register(f, f + i, by) : 0)), first, last, by };
    });
    for (const { f, shifts, first, last, by } of moves) {
      shifts.forEach((s, i) => { cuts[f + i]!.anchor.x += s; });
      console.log(`  ${first}..${last} put in register by the ${by}: ${shifts.join(", ")}`);
    }
  }

  // One canvas for all: room round the anchor for the furthest reach of any frame each way.
  const left = Math.max(...cuts.map((c) => c.anchor.x - c.source.x));
  const right = Math.max(...cuts.map((c) => c.source.x + c.source.w - c.anchor.x));
  const up = Math.max(...cuts.map((c) => c.anchor.y - c.source.y));
  const down = Math.max(...cuts.map((c) => c.source.y + c.source.h - c.anchor.y));
  const cw = left + right, ch = up + down;
  const atlas = new Uint8Array(cw * cuts.length * ch * 4);
  const aw = cw * cuts.length;
  let moved = 0;
  let glow = 0;
  const placed = cuts.map((c, n) => {
    const ox = n * cw + left - c.anchor.x, oy = up - c.anchor.y;
    for (let y = c.source.y; y < c.source.y + c.source.h; y++)
      for (let x = c.source.x; x < c.source.x + c.source.w; x++) {
        const i = y * W + x;
        const o = owner[i]!;
        // A soft pixel goes with the frame whose drawing it edges; on a grid, one edging none is the glow the sheet
        // has round its figures, left out (else it would stop short at the frame's rectangle).
        const near = o >= 0 ? o : nearest(x, y);
        if (near < 0 && cell) { if (data[i * 4 + 3]) glow++; continue; }
        const mine = near < 0 || c.ids.has(near);
        if (!mine) { if (data[i * 4 + 3]) moved++; continue; }
        atlas.set(data.subarray(i * 4, i * 4 + 4), ((oy + y) * aw + ox + x) * 4);
      }
    return { ...c, box: { x: c.box.x - c.anchor.x + left, y: c.box.y - c.anchor.y + up, w: c.box.w, h: c.box.h } };
  });
  if (moved) console.log(`  ${moved} pixels of neighbouring frames left out`);
  if (glow) console.log(`  ${glow} pixels of glow left out`);
  writeFileSync(here(`../../../apps/web/src/units/${unit}-anim.png`), encodePng({ width: aw, height: ch, data: atlas }));
  console.log(`  atlas ${aw}x${ch}: ${cuts.length} frames of ${cw}x${ch}, anchor ${left},${up}`);
  for (const p of placed) console.log(`  ${p.name.padEnd(15)} source ${tuple(p.source)}  anchor ${p.anchor.x},${p.anchor.y}  drawing ${tuple(p.box)}`);
  return { unit, size: [cw, ch], anchor: [left, up], frames: placed };
}

const atlases = Object.entries(SHEETS).map(([unit, { rows, cell, green, align, home }]) => cut(unit, rows, cell, green, align, home));
writeFileSync(
  here("../../../packages/renderer-api/src/unit-atlas.ts"),
  `// Written by tools/sprites/units/anim.ts from the user's sheets of units' moves (tools/sprites/units/<unit>-anim.png):
// each atlas (apps/web/src/units/<unit>-anim.png) is its frames side by side on canvases of one size, unscaled, each
// frame's anchor (its front foot on the ground) on the canvas's \`anchor\`. Per frame: its name, its rectangle on the
// sheet (\`source\`: x, y, w, h), its anchor on the sheet, and the box its drawing fills on its canvas.
export interface UnitAtlasFrame {
  name: string;
  source: readonly [x: number, y: number, w: number, h: number];
  anchor: readonly [x: number, y: number];
  box: readonly [x: number, y: number, w: number, h: number];
}

export interface UnitAtlas {
  /** One frame's canvas, in the sheet's pixels; frame \`n\` is at x = n * size[0] in the atlas. */
  size: readonly [w: number, h: number];
  anchor: readonly [x: number, y: number];
  frames: readonly UnitAtlasFrame[];
}

export const UNIT_ATLASES: Record<string, UnitAtlas> = {
${atlases.map((a) => `  ${/^[A-Za-z_$][\w$]*$/.test(a.unit) ? a.unit : JSON.stringify(a.unit)}: {
    size: [${a.size.join(", ")}],
    anchor: [${a.anchor.join(", ")}],
    frames: [
${a.frames.map((f) => `      { name: "${f.name}", source: ${tuple(f.source)}, anchor: [${f.anchor.x}, ${f.anchor.y}], box: ${tuple(f.box)} },`).join("\n")}
    ],
  },`).join("\n")}
};
`,
);
console.log("wrote unit-atlas.ts");
