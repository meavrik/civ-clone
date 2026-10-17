import { borderSides, ownerAt, type Territory } from "@civ/renderer-api";
import type { Context2D } from "./context.js";
import { playerColor } from "./markers.js";
import { TILE } from "./theme.js";

/** Width of a border line, and how far its glow reaches into the territory. */
const LINE = 3;
const GLOW = 11;

/** A colour `#rrggbb` at opacity `a`. */
function alpha(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

/**
 * Civilization borders over the squares drawn (see `territory`): along each
 * edge of a civilization's land, a soft glow of its colour inside and a line
 * just within the edge, reaching past the corner where it rounds an inner
 * corner, so two civilizations that meet each show their own. `squares` are
 * the map squares in view and where they are drawn.
 */
export function paintBorders(ctx: Context2D, terr: Territory, squares: { mx: number; my: number; x: number; y: number }[], slotOf: (owner: number) => number): void {
  const lines = new Map<number, number[]>();
  ctx.save();
  for (const { mx, my, x, y } of squares) {
    const owner = ownerAt(terr, mx, my);
    if (owner < 0) continue;
    const sides = borderSides(terr, mx, my);
    if (!sides.length) continue;
    const color = playerColor(slotOf(owner));
    const segs = lines.get(owner) ?? [];
    lines.set(owner, segs);
    for (const { side, startOut, endOut } of sides) {
      const a = startOut ? -LINE : 0;
      const b = TILE + (endOut ? LINE : 0);
      const across = side === 0 || side === 2;
      const at = side === 0 || side === 3 ? LINE / 2 : TILE - LINE / 2;
      if (across) segs.push(x + a, y + at, x + b, y + at);
      else segs.push(x + at, y + a, x + at, y + b);
      // The glow, from the edge inward.
      const inward = side === 0 || side === 3 ? 1 : -1;
      const edge = side === 0 || side === 3 ? 0 : TILE;
      const g = across ? ctx.createLinearGradient(0, y + edge, 0, y + edge + inward * GLOW) : ctx.createLinearGradient(x + edge, 0, x + edge + inward * GLOW, 0);
      g.addColorStop(0, alpha(color, 0.32));
      g.addColorStop(1, alpha(color, 0));
      ctx.fillStyle = g;
      if (across) ctx.fillRect(x, inward > 0 ? y : y + TILE - GLOW, TILE, GLOW);
      else ctx.fillRect(inward > 0 ? x : x + TILE - GLOW, y, GLOW, TILE);
    }
  }
  ctx.lineWidth = LINE;
  ctx.lineCap = "butt";
  for (const [owner, segs] of lines) {
    ctx.beginPath();
    for (let k = 0; k < segs.length; k += 4) {
      ctx.moveTo(segs[k]!, segs[k + 1]!);
      ctx.lineTo(segs[k + 2]!, segs[k + 3]!);
    }
    ctx.strokeStyle = alpha(playerColor(slotOf(owner)), 0.9);
    ctx.stroke();
  }
  ctx.restore();
}
