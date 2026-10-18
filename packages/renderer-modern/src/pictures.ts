import { bare, type Part, type Picture } from "@civ/renderer-api";
import type { Context2D } from "./context.js";
import { CITY_VIEW } from "./theme.js";

/**
 * Pictures of buildings (`PICTURES` in renderer-api) as paths, `k` canvas units to a retro pixel:
 * each shape lit from the left (a gradient from its lit edge through its face to its shaded edge)
 * and edged in a dark line, except masts, poles and smoke.
 */

function colours(p: Part, owner: string): [string, string, string] {
  if (p.m === "owner") return [owner, owner, owner];
  const [face, lit, shade] = CITY_VIEW.materials[p.m];
  const tone = p.tone ?? 0;
  return tone < 0 ? [shade, face, shade] : tone > 0 ? [lit, lit, face] : [face, lit, shade];
}

/** Lays out a shape's path at `ox`, `oy` (the picture's top left) and returns its left and right edges. */
function trace(ctx: Context2D, p: Part, ox: number, oy: number, k: number): [number, number] {
  ctx.beginPath();
  switch (p.k) {
    case "rect":
      ctx.rect(ox + p.x * k, oy + p.y * k, p.w * k, p.h * k);
      return [ox + p.x * k, ox + (p.x + p.w) * k];
    case "poly": {
      let lo = Infinity;
      let hi = -Infinity;
      for (let i = 0; i < p.pts.length; i += 2) {
        const x = ox + p.pts[i]! * k;
        const y = oy + p.pts[i + 1]! * k;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
        lo = Math.min(lo, x);
        hi = Math.max(hi, x);
      }
      ctx.closePath();
      return [lo, hi];
    }
    case "oval":
      ctx.save();
      ctx.translate(ox + p.x * k, oy + p.y * k);
      ctx.scale(p.rx * k, p.ry * k);
      ctx.arc(0, 0, 1, p.top ? Math.PI : 0, Math.PI * 2);
      ctx.restore();
      ctx.closePath();
      return [ox + (p.x - p.rx) * k, ox + (p.x + p.rx) * k];
    case "line":
      ctx.moveTo(ox + p.x0 * k, oy + p.y0 * k);
      ctx.lineTo(ox + p.x1 * k, oy + p.y1 * k);
      return [ox + Math.min(p.x0, p.x1) * k, ox + Math.max(p.x0, p.x1) * k];
  }
}

/** Paints a picture with its left edge at `x` and its ground line at `y`; `owner` colours flags and banners. */
export function paintPicture(ctx: Context2D, pic: Picture, x: number, y: number, k: number, owner: string): void {
  const oy = y - pic.h * k;
  for (const p of pic.parts) {
    const [face, lit, shade] = colours(p, owner);
    const [lo, hi] = trace(ctx, p, x, oy, k);
    if (p.k === "line") {
      ctx.strokeStyle = face;
      ctx.lineWidth = p.w * k;
      ctx.lineCap = "round";
      ctx.stroke();
      continue;
    }
    if (CITY_VIEW.flat.includes(p.m) || hi - lo < 2 * k) ctx.fillStyle = face;
    else {
      const g = ctx.createLinearGradient(lo, 0, hi, 0);
      g.addColorStop(0, lit);
      g.addColorStop(0.3, face);
      g.addColorStop(1, shade);
      ctx.fillStyle = g;
    }
    ctx.fill();
    if (!bare(p)) {
      ctx.strokeStyle = CITY_VIEW.outline;
      ctx.lineWidth = Math.max(1, k * 0.3);
      ctx.lineJoin = "round";
      ctx.stroke();
    }
  }
}
