import { Terrain, type Tile } from "@civ/core";
import { FIELD_E, FIELD_N, FIELD_S, FIELD_W, fieldLayout, roadStrokes, type RiverShape, type Stroke } from "@civ/renderer-api";
import type { Context2D } from "./context.js";
import { circle } from "./draw.js";
import { FIELDS, MINE, RAIL, RIVER, ROAD, SEA, TERRAIN, TILE, UI } from "./theme.js";

/** Tiny deterministic hash for per-tile variation (never the game RNG). */
function h(x: number, y: number, salt: number): number {
  let n = (x * 374761393 + y * 668265263 + salt * 1274126177) | 0;
  n = (n ^ (n >>> 13)) * 1274126177;
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

function tree(ctx: Context2D, x: number, y: number, r: number, canopy: string, trunk: string): void {
  ctx.fillStyle = trunk;
  ctx.fillRect(x - 1.5, y, 3, r);
  circle(ctx, x, y - r * 0.2, r, canopy);
}

/** Terrain whose relief stands above its fields: hills keep their knolls. */
const RELIEF = new Set<Terrain>([Terrain.Hills]);

/**
 * Base terrain with a few soft features, drawn flat so the map reads at a glance.
 * `deep` paints open sea, water with no land among its neighbours. An irrigated
 * square is fields instead of its texture (see `paintFields`; `sides` are its
 * irrigated neighbours), under the knolls of hills.
 */
export function paintTile(ctx: Context2D, x: number, y: number, tile: Tile, tx: number, ty: number, deep = false, sides = 0): void {
  const look = deep ? SEA.deep : TERRAIN[tile.terrain];
  ctx.fillStyle = look.base;
  ctx.fillRect(x, y, TILE, TILE);
  if (tile.irrigation) {
    paintFields(ctx, x, y, tx, ty, sides);
    if (!RELIEF.has(tile.terrain)) return;
  }
  const v = h(tx, ty, tile.terrain);
  switch (tile.terrain) {
    case Terrain.Ocean: {
      // Flat, so open water shows no square grid; depth comes from `deep` and the coast pass.
      ctx.strokeStyle = "rgba(255,255,255,0.22)";
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 2; i++) {
        const wy = y + 12 + i * 18 + Math.floor(h(tx, ty, 9 + i) * 8);
        const wx = x + 6 + Math.floor(h(tx, ty, 20 + i) * 20);
        ctx.beginPath();
        ctx.moveTo(wx, wy);
        ctx.quadraticCurveTo(wx + 5, wy - 4, wx + 10, wy);
        ctx.quadraticCurveTo(wx + 15, wy + 4, wx + 20, wy);
        ctx.stroke();
      }
      break;
    }
    case Terrain.Grassland: {
      ctx.strokeStyle = look.dark;
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 4; i++) {
        const gx = x + 6 + Math.floor(h(tx, ty, 30 + i) * 34);
        const gy = y + 10 + Math.floor(h(tx, ty, 40 + i) * 30);
        ctx.beginPath();
        ctx.moveTo(gx, gy + 4);
        ctx.lineTo(gx + 2, gy);
        ctx.moveTo(gx + 2, gy + 4);
        ctx.lineTo(gx + 4, gy + 1);
        ctx.stroke();
      }
      break;
    }
    case Terrain.Plains: {
      ctx.strokeStyle = look.light;
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 3; i++) {
        const py = y + 10 + i * 13 + Math.floor(v * 5);
        ctx.beginPath();
        ctx.moveTo(x + 6, py);
        ctx.lineTo(x + 20 + Math.floor(h(tx, ty, 50 + i) * 20), py);
        ctx.stroke();
      }
      break;
    }
    case Terrain.Forest: {
      for (let i = 0; i < 3; i++) {
        const fx = x + 10 + ((i * 14 + Math.floor(h(tx, ty, 60 + i) * 8)) % 30);
        const fy = y + 14 + Math.floor(h(tx, ty, 70 + i) * 22);
        tree(ctx, fx, fy, 7, look.dark, "#5a3d1f");
      }
      break;
    }
    case Terrain.Jungle: {
      for (let i = 0; i < 3; i++) {
        const fx = x + 10 + ((i * 15 + Math.floor(h(tx, ty, 80 + i) * 8)) % 30);
        const fy = y + 14 + Math.floor(h(tx, ty, 90 + i) * 22);
        circle(ctx, fx, fy, 9, look.dark);
        circle(ctx, fx - 3, fy - 3, 4, look.light);
      }
      break;
    }
    case Terrain.Hills: {
      for (let i = 0; i < 2; i++) {
        const hx = x + 14 + i * 20;
        const hy = y + 30 + Math.floor(h(tx, ty, 100 + i) * 8);
        ctx.beginPath();
        ctx.arc(hx, hy, 13, Math.PI, 0);
        ctx.fillStyle = look.dark;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(hx - 3, hy - 2, 8, Math.PI, 0);
        ctx.fillStyle = look.light;
        ctx.fill();
      }
      break;
    }
    case Terrain.Mountains: {
      for (let i = 0; i < 2; i++) {
        const mx = x + 12 + i * 22 + Math.floor(v * 4);
        const base = y + 42;
        const top = y + 8 + i * 6;
        ctx.beginPath();
        ctx.moveTo(mx - 14, base);
        ctx.lineTo(mx, top);
        ctx.lineTo(mx + 14, base);
        ctx.closePath();
        ctx.fillStyle = look.dark;
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(mx - 5, top + 9);
        ctx.lineTo(mx, top);
        ctx.lineTo(mx + 5, top + 9);
        ctx.closePath();
        ctx.fillStyle = "#f3f6f8";
        ctx.fill();
      }
      break;
    }
    case Terrain.Desert: {
      ctx.strokeStyle = look.light;
      ctx.lineWidth = 2;
      for (let i = 0; i < 2; i++) {
        const dy = y + 16 + i * 18;
        ctx.beginPath();
        ctx.moveTo(x + 6, dy);
        ctx.quadraticCurveTo(x + 20, dy - 8, x + 40, dy);
        ctx.stroke();
      }
      break;
    }
    case Terrain.Tundra: {
      ctx.fillStyle = look.dark;
      for (let i = 0; i < 5; i++) ctx.fillRect(x + 5 + Math.floor(h(tx, ty, 110 + i) * 38), y + 5 + Math.floor(h(tx, ty, 120 + i) * 38), 3, 2);
      break;
    }
    case Terrain.Arctic: {
      ctx.strokeStyle = look.dark;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + 8, y + 30);
      ctx.lineTo(x + 20, y + 22);
      ctx.lineTo(x + 34, y + 28);
      ctx.stroke();
      break;
    }
    case Terrain.Swamp: {
      for (let i = 0; i < 2; i++) {
        const px = x + 14 + i * 20;
        const py = y + 18 + i * 14;
        ctx.beginPath();
        ctx.arc(px, py, 7, 0, Math.PI * 2);
        ctx.fillStyle = "#2f4f6a";
        ctx.fill();
      }
      ctx.strokeStyle = look.light;
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 4; i++) {
        const rx = x + 6 + i * 11;
        ctx.beginPath();
        ctx.moveTo(rx, y + 40);
        ctx.lineTo(rx + 2, y + 28);
        ctx.stroke();
      }
      break;
    }
  }
}

const CENTRE = TILE / 2;
const RIVER_WIDTH = 6;

/** A river's strokes across a square (see `riverShape`): six pixels wide, widening toward the sea. */
export function paintRiver(ctx: Context2D, x: number, y: number, river: RiverShape): void {
  ctx.strokeStyle = RIVER;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const st of river.strokes) {
    const even = st.widths.every((w) => w === st.widths[0]);
    const pts = st.pts;
    if (even) {
      ctx.lineWidth = RIVER_WIDTH * st.widths[0]!;
      ctx.beginPath();
      ctx.moveTo(x + pts[0]! * TILE, y + pts[1]! * TILE);
      for (let k = 2; k < pts.length; k += 2) ctx.lineTo(x + pts[k]! * TILE, y + pts[k + 1]! * TILE);
      ctx.stroke();
      continue;
    }
    for (let k = 0; k + 3 < pts.length; k += 2) {
      ctx.lineWidth = RIVER_WIDTH * (st.widths[k / 2]! + st.widths[k / 2 + 1]!) / 2;
      ctx.beginPath();
      ctx.moveTo(x + pts[k]! * TILE, y + pts[k + 1]! * TILE);
      ctx.lineTo(x + pts[k + 2]! * TILE, y + pts[k + 3]! * TILE);
      ctx.stroke();
    }
  }
}

/** Half-widths of a road: its verges, and the packed earth between them. */
const ROAD_VERGE = 4.5;
const ROAD_SURFACE = 3;
/** A railroad: rails this far either side of the middle, sleepers across about this far apart. */
const RAIL_GAUGE = 2.5;
const SLEEPER_GAP = 6;

function strokePath(ctx: Context2D, x: number, y: number, st: Stroke): void {
  ctx.beginPath();
  ctx.moveTo(x + st[0] * TILE, y + st[1] * TILE);
  ctx.lineTo(x + st[2] * TILE, y + st[3] * TILE);
  ctx.stroke();
}

/**
 * The road (or the railroad, over its road) across a square: `self` when the
 * square has it, `mask` its known neighbours with it (see `roadMask`). Each
 * stroke runs to the neighbour's centre, clipped to this square, so the two
 * halves meet at the border and diagonals pass cleanly through the corners
 * (see `roadStrokes`). Sleepers are spaced evenly from centre to centre, so
 * they meet the next square's too. A road square with no links is a round patch.
 */
export function paintRoad(ctx: Context2D, x: number, y: number, self: boolean, mask: number, rail: boolean): void {
  const strokes = roadStrokes(self, mask);
  if (!strokes.length && !self) return;
  const cx = x + CENTRE;
  const cy = y + CENTRE;
  if (!strokes.length) {
    circle(ctx, cx, cy, ROAD_VERGE + 2, rail ? RAIL.ballast : ROAD.verge);
    circle(ctx, cx, cy, ROAD_SURFACE + 2, rail ? RAIL.sleeper : ROAD.surface);
    return;
  }
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, TILE, TILE);
  ctx.clip();
  ctx.lineCap = "round";
  const pass = (width: number, color: string) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    for (const st of strokes) strokePath(ctx, x, y, st);
  };
  if (!rail) {
    pass(ROAD_VERGE * 2, ROAD.verge);
    pass(ROAD_SURFACE * 2, ROAD.surface);
    pass(2, ROAD.worn);
  } else {
    pass(ROAD_VERGE * 2, RAIL.ballast);
    ctx.lineCap = "butt";
    ctx.strokeStyle = RAIL.sleeper;
    ctx.lineWidth = 2.5;
    for (const st of strokes) {
      const ex = (st[2] - st[0]) * TILE;
      const ey = (st[3] - st[1]) * TILE;
      const len = Math.hypot(ex, ey);
      const n = Math.max(1, Math.round(len / SLEEPER_GAP));
      const [nx, ny] = [(-ey / len) * ROAD_VERGE, (ex / len) * ROAD_VERGE];
      ctx.beginPath();
      for (let k = 0; k <= n; k++) {
        const px = x + st[0] * TILE + (ex * k) / n;
        const py = y + st[1] * TILE + (ey * k) / n;
        ctx.moveTo(px - nx, py - ny);
        ctx.lineTo(px + nx, py + ny);
      }
      ctx.stroke();
    }
    ctx.strokeStyle = RAIL.rail;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (const st of strokes) {
      const ex = (st[2] - st[0]) * TILE;
      const ey = (st[3] - st[1]) * TILE;
      const len = Math.hypot(ex, ey);
      for (const side of [-1, 1]) {
        const [nx, ny] = [(-ey / len) * RAIL_GAUGE * side, (ex / len) * RAIL_GAUGE * side];
        ctx.moveTo(x + st[0] * TILE + nx, y + st[1] * TILE + ny);
        ctx.lineTo(x + st[2] * TILE + nx, y + st[3] * TILE + ny);
      }
    }
    ctx.stroke();
  }
  ctx.restore();
}

/** An irrigated square's fields are inset this far from a side without irrigation beyond it. */
const FIELD_MARGIN = 3;
/** The canal through the middle of an irrigated square, and the rows on each plot. */
const CANAL = 3;
const ROW_GAP = 4;

/**
 * Irrigation: fields over the square, plots of crops in rows either side of a
 * canal through its middle (see `fieldLayout`). Toward irrigated neighbours
 * (`sides`, see `fieldSides`) the plots and the canal run to the edge, so
 * farmland reads as one patchwork; elsewhere a strip of the terrain shows.
 */
export function paintFields(ctx: Context2D, x: number, y: number, tx: number, ty: number, sides: number): void {
  const { plots, splits } = fieldLayout(tx, ty);
  const left = sides & FIELD_W ? 0 : FIELD_MARGIN;
  const right = TILE - (sides & FIELD_E ? 0 : FIELD_MARGIN);
  const top = sides & FIELD_N ? 0 : FIELD_MARGIN;
  const bottom = TILE - (sides & FIELD_S ? 0 : FIELD_MARGIN);
  const mid = TILE / 2;
  plots.forEach((plot, k) => {
    const south = k >= 2;
    const split = Math.round(splits[south ? 1 : 0] * TILE);
    const px0 = k % 2 ? split + 0.5 : left;
    const px1 = k % 2 ? right : split - 0.5;
    const py0 = south ? mid + CANAL / 2 : top;
    const py1 = south ? bottom : mid - CANAL / 2;
    const crop = FIELDS.crops[plot.crop]!;
    ctx.fillStyle = crop.ground;
    ctx.fillRect(x + px0, y + py0, px1 - px0, py1 - py0);
    ctx.save();
    ctx.beginPath();
    ctx.rect(x + px0, y + py0, px1 - px0, py1 - py0);
    ctx.clip();
    ctx.strokeStyle = crop.rows;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    if (plot.across) for (let r = ROW_GAP / 2; r < TILE; r += ROW_GAP) { ctx.moveTo(x + px0, y + r); ctx.lineTo(x + px1, y + r); }
    else for (let r = ROW_GAP / 2; r < TILE; r += ROW_GAP) { ctx.moveTo(x + r, y + py0); ctx.lineTo(x + r, y + py1); }
    ctx.stroke();
    ctx.restore();
  });
  ctx.fillStyle = FIELDS.canal;
  ctx.fillRect(x + left, y + mid - CANAL / 2, right - left, CANAL);
}

/**
 * A mine: a mound of rock with a timber-framed shaft in its face, rails
 * running out of it and a few stones of spoil, in the square's lower right.
 */
export function paintMine(ctx: Context2D, x: number, y: number): void {
  ctx.save();
  ctx.lineJoin = "round";
  // The mound, lit from the upper left.
  ctx.beginPath();
  ctx.moveTo(x + 12, y + 44);
  ctx.quadraticCurveTo(x + 13, y + 19, x + 30, y + 19);
  ctx.quadraticCurveTo(x + 47, y + 19, x + 47, y + 44);
  ctx.closePath();
  const g = ctx.createLinearGradient(x + 14, y + 20, x + 44, y + 44);
  g.addColorStop(0, MINE.rockLight);
  g.addColorStop(0.5, MINE.rock);
  g.addColorStop(1, MINE.rockDark);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = MINE.outline;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // The shaft, arched, with rails running out of it over two sleepers.
  ctx.beginPath();
  ctx.moveTo(x + 25, y + 44);
  ctx.lineTo(x + 25, y + 33);
  ctx.arc(x + 30, y + 33, 5, Math.PI, 0);
  ctx.lineTo(x + 35, y + 44);
  ctx.closePath();
  ctx.fillStyle = MINE.shaft;
  ctx.fill();
  ctx.fillStyle = MINE.sleeper;
  ctx.fillRect(x + 24, y + 41, 12, 2);
  ctx.fillRect(x + 23, y + 45, 14, 2);
  ctx.strokeStyle = MINE.rail;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x + 28, y + 37);
  ctx.lineTo(x + 27, y + 48);
  ctx.moveTo(x + 32, y + 37);
  ctx.lineTo(x + 33, y + 48);
  ctx.stroke();
  // The timber frame: two posts and a lintel over them.
  ctx.fillStyle = MINE.timber;
  ctx.fillRect(x + 22, y + 30, 3, 14);
  ctx.fillRect(x + 35, y + 30, 3, 14);
  ctx.fillStyle = MINE.timberLight;
  ctx.fillRect(x + 20, y + 27, 20, 4);
  ctx.strokeStyle = MINE.outline;
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 20, y + 27, 20, 4);
  // Spoil beside it.
  circle(ctx, x + 10, y + 44, 3.5, MINE.rockDark);
  circle(ctx, x + 15, y + 45.5, 2.5, MINE.rock);
  circle(ctx, x + 8, y + 40.5, 2, MINE.rockLight);
  ctx.restore();
}

export function paintFortress(ctx: Context2D, x: number, y: number): void {
  ctx.strokeStyle = "#cfd6dd";
  ctx.lineWidth = 3;
  ctx.strokeRect(x + 7, y + 7, TILE - 14, TILE - 14);
  ctx.fillStyle = "#cfd6dd";
  for (const [tx, ty] of [[5, 5], [TILE - 11, 5], [5, TILE - 11], [TILE - 11, TILE - 11]] as const) ctx.fillRect(x + tx, y + ty, 6, 6);
}

export function paintPollution(ctx: Context2D, x: number, y: number): void {
  for (const [px, py, r] of [[16, 18, 10], [30, 28, 9], [20, 34, 7]] as const) {
    const g = ctx.createRadialGradient(x + px, y + py, 1, x + px, y + py, r);
    g.addColorStop(0, "rgba(60, 50, 40, 0.85)");
    g.addColorStop(1, "rgba(60, 50, 40, 0)");
    ctx.fillStyle = g;
    ctx.fillRect(x + px - r, y + py - r, r * 2, r * 2);
  }
}

export function paintHut(ctx: Context2D, x: number, y: number): void {
  ctx.fillStyle = "#8a5a2b";
  ctx.fillRect(x + 16, y + 24, 16, 12);
  ctx.beginPath();
  ctx.moveTo(x + 12, y + 25);
  ctx.lineTo(x + 24, y + 13);
  ctx.lineTo(x + 36, y + 25);
  ctx.closePath();
  ctx.fillStyle = "#c98a3e";
  ctx.fill();
}

/** A special resource: a small gold-rimmed badge in the tile's corner. */
export function paintSpecial(ctx: Context2D, x: number, y: number): void {
  circle(ctx, x + 38, y + 10, 6, UI.accent);
  circle(ctx, x + 38, y + 10, 3, "#7a5a10");
}

export function paintFog(ctx: Context2D, x: number, y: number): void {
  ctx.fillStyle = UI.fog;
  ctx.fillRect(x, y, TILE, TILE);
}
