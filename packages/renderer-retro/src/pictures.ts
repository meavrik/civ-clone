import { bare, buildingArt, type Material, type Part, type Picture } from "@civ/renderer-api";
import { C, shade } from "./palette.js";
import { SPRITE_CLEAR } from "./sprites/sheet.js";
import { Surface } from "./surface.js";

/**
 * Pictures of buildings (`PICTURES` in renderer-api) filled pixel by pixel: each shape takes its
 * material's face colour, lit along its left and top edges and shaded along its right, and the
 * whole picture is ringed in black like the sprites, so it reads against sky and street alike.
 */

/** Each material's ramp and face shade; the lit edge is a shade lighter, the shaded edge two darker. */
const LOOK: Record<Material, [string, number] | "flat"> = {
  stone: ["stone", 5],
  marble: ["marble", 6],
  sandstone: ["sand", 4],
  brick: ["brick", 3],
  roof: ["brick", 5],
  slate: ["stone", 2],
  wood: ["earth", 3],
  thatch: ["plains", 5],
  gold: ["plains", 6],
  glass: ["sky", 3],
  deep: ["ocean", 3],
  dark: "flat",
  steel: ["grey", 4],
  concrete: ["grey", 5],
  green: ["grass", 4],
  leaf: ["forest", 5],
  copper: ["steel", 5], // weathered metal: the copper ramp's slots went to the map's city icons
  water: ["ocean", 4],
  white: ["marble", 7],
  light: "flat",
  smoke: ["grey", 6],
  owner: "flat",
};

function colours(m: Material, tone: number, owner: number): { face: number; lit: number; shadow: number } {
  const look = LOOK[m];
  if (look === "flat") {
    const c = m === "owner" ? owner : m === "light" ? C.YELLOW! : shade("grey", 1);
    return { face: c, lit: c, shadow: c };
  }
  const [ramp, f] = look;
  const face = f + tone;
  return { face: shade(ramp, face), lit: shade(ramp, face + 1), shadow: shade(ramp, face - 2) };
}

/**
 * The pixels a shape covers on a grid `gw` wide and `gh` tall, sampled at pixel centres; `o` shifts
 * it right and down, and the shape is clipped to the picture (the grid less `o` all round).
 */
function cover(p: Part, gw: number, gh: number, o: number): Uint8Array {
  const mask = new Uint8Array(gw * gh);
  const set = (x: number, y: number) => {
    if (x >= o && y >= o && x < gw - o && y < gh - o) mask[y * gw + x] = 1;
  };
  switch (p.k) {
    case "rect":
      for (let y = Math.round(p.y); y < Math.round(p.y + p.h); y++)
        for (let x = Math.round(p.x); x < Math.round(p.x + p.w); x++) set(x + o, y + o);
      break;
    case "oval":
      for (let y = Math.floor(p.y - p.ry); y <= Math.ceil(p.y + p.ry); y++)
        for (let x = Math.floor(p.x - p.rx); x <= Math.ceil(p.x + p.rx); x++) {
          const dx = (x + 0.5 - p.x) / p.rx;
          const dy = (y + 0.5 - p.y) / p.ry;
          if (dx * dx + dy * dy <= 1 && (!p.top || y + 0.5 <= p.y)) set(x + o, y + o);
        }
      break;
    case "poly": {
      const xs = p.pts.filter((_, i) => i % 2 === 0);
      const ys = p.pts.filter((_, i) => i % 2 === 1);
      for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y++)
        for (let x = Math.floor(Math.min(...xs)); x <= Math.ceil(Math.max(...xs)); x++)
          if (inside(p.pts, x + 0.5, y + 0.5)) set(x + o, y + o);
      break;
    }
    case "line": {
      const steps = Math.ceil(Math.max(Math.abs(p.x1 - p.x0), Math.abs(p.y1 - p.y0)) * 2) + 1;
      const half = (p.w - 1) / 2;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const x = Math.floor(p.x0 + (p.x1 - p.x0) * t - half);
        const y = Math.floor(p.y0 + (p.y1 - p.y0) * t - half);
        for (let dy = 0; dy < p.w; dy++) for (let dx = 0; dx < p.w; dx++) set(x + dx + o, y + dy + o);
      }
      break;
    }
  }
  return mask;
}

/** Even-odd rule: is the point inside the polygon `pts` (x0, y0, x1, y1...)? */
function inside(pts: number[], x: number, y: number): boolean {
  let hit = false;
  for (let i = 0, j = pts.length - 2; i < pts.length; j = i, i += 2) {
    const xi = pts[i]!, yi = pts[i + 1]!, xj = pts[j]!, yj = pts[j + 1]!;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

/** A picture as palette indices on a grid one pixel larger all round (for its outline); -1 is clear. */
export function rasterize(pic: Picture, owner: number): Int16Array {
  const gw = pic.w + 2;
  const gh = pic.h + 2;
  const out = new Int16Array(gw * gh).fill(-1);
  const solid = new Uint8Array(gw * gh);
  for (const p of pic.parts) {
    const mask = cover(p, gw, gh, 1);
    const { face, lit, shadow } = colours(p.m, p.tone ?? 0, owner);
    const shaped = p.k !== "line";
    const at = (x: number, y: number) => x >= 0 && y >= 0 && x < gw && y < gh && mask[y * gw + x] === 1;
    for (let y = 0; y < gh; y++)
      for (let x = 0; x < gw; x++) {
        const i = y * gw + x;
        if (!mask[i]) continue;
        let c = face;
        if (shaped) {
          const l = !at(x - 1, y);
          const r = !at(x + 1, y);
          if (l && !r) c = lit;
          else if (r && !l) c = shadow;
          else if (!at(x, y - 1) && !(l && r)) c = lit;
        }
        out[i] = c;
        solid[i] = bare(p) ? 0 : 1;
      }
  }
  for (let y = 0; y < gh; y++)
    for (let x = 0; x < gw; x++) {
      const i = y * gw + x;
      if (out[i] !== -1) continue;
      if ((x > 0 && solid[i - 1]) || (x < gw - 1 && solid[i + 1]) || (y > 0 && solid[i - gw]) || (y < gh - 1 && solid[i + gw])) out[i] = C.BLACK!;
    }
  return out;
}

const cache = new WeakMap<Picture, Map<number, Int16Array>>();

/** Draws a picture with its left edge at `x` and its ground line at `y`; `owner` colours flags and banners. */
export function drawPicture(s: Surface, pic: Picture, x: number, y: number, owner: number): void {
  let byOwner = cache.get(pic);
  if (!byOwner) cache.set(pic, (byOwner = new Map()));
  let px = byOwner.get(owner);
  if (!px) byOwner.set(owner, (px = rasterize(pic, owner)));
  const gw = pic.w + 2;
  const top = y - pic.h - 1;
  const left = x - 1;
  for (let j = 0; j < pic.h + 2; j++)
    for (let i = 0; i < gw; i++) {
      const c = px[j * gw + i]!;
      if (c >= 0) s.set(left + i, top + j, c);
    }
}

/**
 * A building standing in a box `w` by `h` with its left edge at `x` and its ground line at `y`: the
 * spot for the user's picture of it when it has one (the apps lay the picture there, `Surface.art`),
 * else its drawn picture in the middle of the box. `lit` rings the user's picture in light.
 */
export function drawBuilding(s: Surface, id: string, pic: Picture, x: number, y: number, w: number, h: number, owner: number, lit = false, reveal = 1): void {
  if (buildingArt(id)) { s.art.push({ id, x, y: y - h, w, h, ...(lit ? { lit } : {}), ...(reveal < 1 ? { reveal } : {}) }); return; }
  const px = x + Math.floor((w - pic.w) / 2);
  if (reveal >= 1) { drawPicture(s, pic, px, y, owner); return; }
  // Rising (a wonder just completed): only the bottom `reveal` of the drawn picture stands, drawn whole
  // on a scratch surface and copied from that height down to its ground line.
  const t = new Surface(s.width, s.height, undefined, s.k);
  t.fill(SPRITE_CLEAR);
  drawPicture(t, pic, px, y, owner);
  const k = s.k;
  const top = Math.max(0, Math.round((y - pic.h * reveal) * k));
  for (let fy = top; fy < Math.min(s.fh, (y + 1) * k); fy++)
    for (let fx = Math.max(0, px * k); fx < Math.min(s.fw, (px + pic.w + 1) * k); fx++) {
      const c = t.fget(fx, fy);
      if (c !== SPRITE_CLEAR) s.fset(fx, fy, c);
    }
}
