import { hasIcons, iconSegments, wrapIconLine, type IconName } from "@civ/renderer-api";
import type { Context2D } from "./context.js";
import { measure, text, wrap, type TextStyle } from "./draw.js";
import { ICON } from "./theme.js";

type Pt = readonly [number, number];

function poly(ctx: Context2D, pts: readonly Pt[], color: string): void {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

function disc(ctx: Context2D, x: number, y: number, r: number, color: string): void {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}

function line(ctx: Context2D, pts: readonly Pt[], color: string, width: number): void {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.stroke();
}

function box(ctx: Context2D, x: number, y: number, w: number, h: number, color: string): void {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

/** Each icon drawn on a 16x16 grid; paintIcon scales it. */
const DRAW: Record<IconName, (ctx: Context2D) => void> = {
  people: (c) => { disc(c, 8, 4.5, 3.2, ICON.ink); poly(c, [[3, 15], [3, 11], [5, 8.5], [11, 8.5], [13, 11], [13, 15]], ICON.ink); },
  calendar: (c) => {
    box(c, 2, 3, 12, 12, ICON.wall); box(c, 2, 3, 12, 4, ICON.roof);
    box(c, 4.5, 1.5, 1.5, 3, ICON.metal); box(c, 10, 1.5, 1.5, 3, ICON.metal);
    for (const [x, y] of [[4.5, 9], [7.5, 9], [10.5, 9], [4.5, 12], [7.5, 12]] as const) box(c, x, y, 1.6, 1.6, ICON.stoneDark);
  },
  purse: (c) => { disc(c, 8, 10.5, 5, ICON.gold); poly(c, [[5.5, 2], [10.5, 2], [9.5, 5.5], [6.5, 5.5]], ICON.goldDark); line(c, [[5.5, 6], [10.5, 6]], ICON.wood, 1.5); disc(c, 6.5, 9, 1.2, ICON.wall); },
  coin: (c) => { disc(c, 8, 8, 6, ICON.goldDark); disc(c, 8, 8, 4.8, ICON.gold); line(c, [[8, 5], [8, 11]], ICON.goldDark, 1.4); },
  gem: (c) => { poly(c, [[3, 6], [6, 3], [10, 3], [13, 6], [8, 13.5]], ICON.gem); line(c, [[3, 6], [13, 6]], ICON.gemDark, 1); poly(c, [[6, 6], [10, 6], [8, 13]], ICON.gemDark); },
  bulb: (c) => { disc(c, 8, 6.5, 5, ICON.bulb); box(c, 5.8, 10.5, 4.4, 3.5, ICON.metal); line(c, [[6, 12.3], [10, 12.3]], ICON.stoneDark, 0.8); },
  crown: (c) => { poly(c, [[2, 12.5], [2, 5], [5, 8.5], [8, 3], [11, 8.5], [14, 5], [14, 12.5]], ICON.gold); box(c, 2, 12, 12, 2, ICON.goldDark); disc(c, 8, 9.5, 1.2, ICON.roof); },
  hourglass: (c) => {
    line(c, [[3, 2], [13, 2]], ICON.wood, 1.6); line(c, [[3, 14], [13, 14]], ICON.wood, 1.6);
    poly(c, [[4, 3], [12, 3], [8, 8]], ICON.straw); poly(c, [[8, 8], [12, 13], [4, 13]], ICON.straw);
    line(c, [[4, 3], [12, 13]], ICON.stoneDark, 0.8); line(c, [[12, 3], [4, 13]], ICON.stoneDark, 0.8);
  },
  food: (c) => { disc(c, 8, 9.5, 5.5, ICON.food); disc(c, 6, 7.5, 1.4, ICON.foodShine); line(c, [[8, 4.5], [9, 1.5]], ICON.wood, 1.4); poly(c, [[9, 3], [13, 1.5], [11.5, 4.5]], ICON.foodDark); },
  shield: (c) => {
    c.beginPath(); c.moveTo(3, 2); c.lineTo(13, 2); c.lineTo(13, 8); c.quadraticCurveTo(13, 13, 8, 15); c.quadraticCurveTo(3, 13, 3, 8); c.closePath();
    c.fillStyle = ICON.stone; c.fill(); line(c, [[8, 3.5], [8, 13]], ICON.stoneDark, 1.2);
  },
  trade: (c) => {
    line(c, [[2, 5], [12, 5]], ICON.gold, 2); poly(c, [[11, 2], [15, 5], [11, 8]], ICON.gold);
    line(c, [[14, 11], [4, 11]], ICON.gold, 2); poly(c, [[5, 8], [1, 11], [5, 14]], ICON.gold);
  },
  boot: (c) => { poly(c, [[5, 2], [9.5, 2], [9.5, 9.5], [14, 10.5], [14, 14], [4, 14]], ICON.wood); box(c, 4, 12.5, 10, 1.5, ICON.dark); },
  tower: (c) => {
    box(c, 4, 5, 8, 10, ICON.stone);
    for (const x of [4, 7, 10]) box(c, x, 2, 2, 3.5, ICON.stone);
    box(c, 6.8, 10, 2.4, 5, ICON.stoneDark); box(c, 7.2, 6.5, 1.6, 2, ICON.stoneDark);
  },
  heart: (c) => { disc(c, 5.5, 6, 3.3, ICON.heart); disc(c, 10.5, 6, 3.3, ICON.heart); poly(c, [[2.4, 7.2], [13.6, 7.2], [8, 14]], ICON.heart); },
  star: (c) => {
    const pts: Pt[] = [];
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const r = i % 2 ? 2.8 : 6.8;
      pts.push([8 + Math.cos(a) * r, 8.5 + Math.sin(a) * r]);
    }
    poly(c, pts, ICON.gold);
  },
  house: (c) => { poly(c, [[1.5, 8.5], [8, 2], [14.5, 8.5]], ICON.roof); box(c, 3.5, 8, 9, 7, ICON.wall); box(c, 7, 10.5, 2.5, 4.5, ICON.wood); },
  river: (c) => {
    for (const y of [5, 11]) { c.beginPath(); c.moveTo(1.5, y); c.quadraticCurveTo(4.5, y - 3, 8, y); c.quadraticCurveTo(11.5, y + 3, 14.5, y); c.strokeStyle = ICON.water; c.lineWidth = 2; c.lineCap = "round"; c.stroke(); }
  },
  road: (c) => { poly(c, [[6, 2], [10, 2], [14.5, 15], [1.5, 15]], ICON.road); for (const y of [3.5, 7.5, 11.5]) box(c, 7.4, y, 1.4, 2.4, ICON.gold); },
  railroad: (c) => {
    for (const y of [3, 7, 11, 15]) line(c, [[2.5, y - 1], [13.5, y - 1]], ICON.wood, 1.8);
    line(c, [[5, 1], [5, 15]], ICON.ink, 1.4); line(c, [[11, 1], [11, 15]], ICON.ink, 1.4);
  },
  irrigate: (c) => { poly(c, [[8, 1.5], [3.8, 9], [12.2, 9]], ICON.water); disc(c, 8, 10, 4.6, ICON.water); disc(c, 6.5, 10, 1.2, ICON.waterShine); },
  mine: (c) => {
    line(c, [[8.5, 4.5], [5, 15]], ICON.wood, 2);
    c.beginPath(); c.moveTo(2, 7); c.quadraticCurveTo(8, 0, 14.5, 6); c.strokeStyle = ICON.stone; c.lineWidth = 2.6; c.lineCap = "round"; c.stroke();
  },
  fortress: (c) => {
    box(c, 2, 6, 12, 9, ICON.stone);
    for (const x of [2, 5.5, 9, 12]) box(c, x, 3, 2, 3.5, ICON.stone);
    box(c, 6.5, 10, 3, 5, ICON.stoneDark);
  },
  pollution: (c) => { disc(c, 5.5, 9.5, 3.6, ICON.smoke); disc(c, 9.5, 7.5, 4.2, ICON.smoke); disc(c, 12, 10.5, 3, ICON.smoke); box(c, 3, 10, 11, 3.5, ICON.smoke); },
  clean: (c) => { line(c, [[13.5, 1.5], [8, 8.5]], ICON.wood, 1.8); poly(c, [[7, 7.5], [10, 9.5], [8, 15], [2, 14]], ICON.straw); },
  hut: (c) => { poly(c, [[1.5, 9], [8, 2], [14.5, 9]], ICON.straw); box(c, 3.5, 9, 9, 6, ICON.hut); box(c, 7, 11, 2.5, 4, ICON.dark); },
  city: (c) => {
    box(c, 1.5, 7, 4.5, 8, ICON.wall); box(c, 6.5, 3, 4, 12, ICON.wall); box(c, 11, 8.5, 3.5, 6.5, ICON.wall);
    for (const [x, y] of [[7.5, 5], [7.5, 8], [7.5, 11], [2.7, 9], [2.7, 12], [12, 10.5]] as const) box(c, x, y, 1.6, 1.6, ICON.stoneDark);
  },
  swords: (c) => {
    line(c, [[3, 3], [12, 12]], ICON.ink, 1.8); line(c, [[13, 3], [4, 12]], ICON.ink, 1.8);
    line(c, [[10, 14], [14, 10]], ICON.wood, 1.6); line(c, [[6, 14], [2, 10]], ICON.wood, 1.6);
  },
};

/** Draw an icon with its top left at (x, y), `size` pixels square. */
export function paintIcon(ctx: Context2D, name: IconName, x: number, y: number, size = 16): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 16, size / 16);
  DRAW[name](ctx);
  ctx.restore();
}

/** Icons in a line of text are a little taller than its letters. */
function iconSize(textSize: number): number {
  return Math.round(textSize * 1.15);
}

/** Width of a line that may carry {icon} tokens, at a text size. */
export function iconLineWidth(ctx: Context2D, s: string, size = 15, weight: TextStyle["weight"] = "normal"): number {
  let w = 0;
  for (const seg of iconSegments(s)) w += "icon" in seg ? iconSize(size) + 3 : measure(ctx, seg.text, size, weight ?? "normal");
  return w;
}

/** Draw a line with {icon} tokens; returns the x just after it. */
export function drawIconLine(ctx: Context2D, x: number, y: number, s: string, style: TextStyle = {}): number {
  const size = style.size ?? 15;
  const icon = iconSize(size);
  for (const seg of iconSegments(s)) {
    if ("icon" in seg) { paintIcon(ctx, seg.icon, x, y + Math.round((size * 1.2 - icon) / 2), icon); x += icon + 3; }
    else { text(ctx, x, y, seg.text, style); x += measure(ctx, seg.text, size, style.weight ?? "normal"); }
  }
  return x;
}

/** Wrap a line to a width: icon lines break between their "  " groups, plain text between words. */
export function wrapIcons(ctx: Context2D, s: string, maxWidth: number, size = 15): string[] {
  return hasIcons(s) ? wrapIconLine(s, maxWidth, (piece) => iconLineWidth(ctx, piece, size)) : wrap(ctx, s, maxWidth, size);
}

/** Draw a wrapped icon line; returns the height used. */
export function iconParagraph(ctx: Context2D, x: number, y: number, maxWidth: number, s: string, style: TextStyle = {}, maxLines = 99): number {
  const size = style.size ?? 15;
  const lineH = Math.round(size * 1.45);
  const lines = wrapIcons(ctx, s, maxWidth, size).slice(0, Math.max(0, maxLines));
  lines.forEach((l, i) => drawIconLine(ctx, x, y + i * lineH, l, style));
  return lines.length * lineH;
}
