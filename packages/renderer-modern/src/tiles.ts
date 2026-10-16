import { Terrain, type Tile } from "@civ/core";
import type { Context2D } from "./context.js";
import { circle } from "./draw.js";
import { IRRIGATION, RAIL, RIVER, ROAD, TERRAIN, TILE, UI } from "./theme.js";

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

/** Base terrain with a few soft features, drawn flat so the map reads at a glance. */
export function paintTile(ctx: Context2D, x: number, y: number, tile: Tile, tx: number, ty: number): void {
  const look = TERRAIN[tile.terrain];
  ctx.fillStyle = look.base;
  ctx.fillRect(x, y, TILE, TILE);
  const v = h(tx, ty, tile.terrain);
  switch (tile.terrain) {
    case Terrain.Ocean: {
      const g = ctx.createLinearGradient(x, y, x + TILE, y + TILE);
      g.addColorStop(0, look.light);
      g.addColorStop(1, look.dark);
      ctx.fillStyle = g;
      ctx.fillRect(x, y, TILE, TILE);
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

/** Rivers run from the centre to each neighbouring river or sea edge; bits N=1 E=2 S=4 W=8. */
export function paintRiver(ctx: Context2D, x: number, y: number, mask: number): void {
  ctx.strokeStyle = RIVER;
  ctx.lineWidth = 6;
  ctx.lineCap = "round";
  const cx = x + CENTRE;
  const cy = y + CENTRE;
  const ends: [number, number, number][] = [[0, -CENTRE, 1], [CENTRE, 0, 2], [0, CENTRE, 4], [-CENTRE, 0, 8]];
  let any = false;
  for (const [dx, dy, bit] of ends) {
    if (!(mask & bit)) continue;
    any = true;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.quadraticCurveTo(cx + dx * 0.5 + dy * 0.2, cy + dy * 0.5 + dx * 0.2, cx + dx, cy + dy);
    ctx.stroke();
  }
  if (!any) circle(ctx, cx, cy, 5, RIVER);
}

/** Roads and rails toward connected neighbours; mask bits follow NEIGHBOURS order. */
export function paintRoad(ctx: Context2D, x: number, y: number, mask: number, rail: boolean): void {
  const cx = x + CENTRE;
  const cy = y + CENTRE;
  const dirs: [number, number][] = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];
  ctx.lineCap = "round";
  let any = false;
  const pass = (width: number, color: string) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    dirs.forEach(([dx, dy], i) => {
      if (!(mask & (1 << i))) return;
      any = true;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + dx * CENTRE, cy + dy * CENTRE);
      ctx.stroke();
    });
  };
  if (rail) {
    pass(6, RAIL);
    pass(2, "#9aa3ad");
  } else {
    pass(6, ROAD);
    pass(2, "#b8925a");
  }
  if (!any) circle(ctx, cx, cy, 5, rail ? RAIL : ROAD);
}

export function paintIrrigation(ctx: Context2D, x: number, y: number): void {
  ctx.strokeStyle = IRRIGATION;
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  for (let i = 0; i < 3; i++) {
    const ly = y + 30 + i * 6;
    ctx.beginPath();
    ctx.moveTo(x + 8, ly);
    ctx.lineTo(x + 40, ly);
    ctx.stroke();
  }
}

export function paintMine(ctx: Context2D, x: number, y: number): void {
  ctx.beginPath();
  ctx.moveTo(x + 26, y + 22);
  ctx.lineTo(x + 42, y + 22);
  ctx.lineTo(x + 46, y + 40);
  ctx.lineTo(x + 22, y + 40);
  ctx.closePath();
  ctx.fillStyle = "#1b1f24";
  ctx.fill();
  ctx.strokeStyle = "#8a6a3a";
  ctx.lineWidth = 3;
  ctx.stroke();
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
