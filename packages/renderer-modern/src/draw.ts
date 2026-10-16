import type { Context2D } from "./context.js";
import { font, UI } from "./theme.js";

/** Drawing helpers shared by every modern screen: rounded panels, text with wrapping, bars. */

export function roundRect(ctx: Context2D, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
}

export function fillRound(ctx: Context2D, x: number, y: number, w: number, h: number, r: number, color: string): void {
  roundRect(ctx, x, y, w, h, r);
  ctx.fillStyle = color;
  ctx.fill();
}

export function strokeRound(ctx: Context2D, x: number, y: number, w: number, h: number, r: number, color: string, width = 1): void {
  roundRect(ctx, x, y, w, h, r);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
}

/** A translucent card with a soft shadow and a hairline edge. */
export function panel(ctx: Context2D, x: number, y: number, w: number, h: number, radius = 12, fill = UI.panel): void {
  ctx.save();
  ctx.shadowColor = UI.shadow;
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 8;
  fillRound(ctx, x, y, w, h, radius, fill);
  ctx.restore();
  strokeRound(ctx, x + 0.5, y + 0.5, w - 1, h - 1, radius, UI.panelEdge);
}

export function circle(ctx: Context2D, x: number, y: number, r: number, color: string): void {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}

export interface TextStyle {
  size?: number;
  weight?: "normal" | "bold" | "600";
  color?: string;
  align?: "left" | "center" | "right";
  shadow?: boolean;
}

export function text(ctx: Context2D, x: number, y: number, s: string, style: TextStyle = {}): void {
  ctx.font = font(style.size ?? 15, style.weight ?? "normal");
  ctx.fillStyle = style.color ?? UI.ink;
  ctx.textAlign = style.align ?? "left";
  ctx.textBaseline = "top";
  if (style.shadow) {
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.7)";
    ctx.shadowBlur = 4;
    ctx.shadowOffsetY = 1;
    ctx.fillText(s, x, y);
    ctx.restore();
    return;
  }
  ctx.fillText(s, x, y);
}

export function measure(ctx: Context2D, s: string, size = 15, weight: "normal" | "bold" | "600" = "normal"): number {
  ctx.font = font(size, weight);
  return ctx.measureText(s).width;
}

/** Break text into lines no wider than `maxWidth` (in the given font), cutting overlong words. */
export function wrap(ctx: Context2D, s: string, maxWidth: number, size = 15, weight: "normal" | "bold" | "600" = "normal"): string[] {
  ctx.font = font(size, weight);
  const lines: string[] = [];
  for (const para of s.split("\n")) {
    let line = "";
    for (const word of para.split(" ")) {
      if (!word) continue;
      const next = line ? `${line} ${word}` : word;
      if (ctx.measureText(next).width <= maxWidth) { line = next; continue; }
      if (line) lines.push(line);
      line = word;
      while (ctx.measureText(line).width > maxWidth && line.length > 1) {
        let cut = line.length - 1;
        while (cut > 1 && ctx.measureText(line.slice(0, cut)).width > maxWidth) cut--;
        lines.push(line.slice(0, cut));
        line = line.slice(cut);
      }
    }
    lines.push(line);
  }
  return lines;
}

/** Wrapped paragraph, at most `maxLines` lines ("..." on the last one if cut). Returns the height used. */
export function paragraph(ctx: Context2D, x: number, y: number, maxWidth: number, s: string, style: TextStyle = {}, maxLines = 99): number {
  const size = style.size ?? 15;
  const lineH = Math.round(size * 1.3);
  const lines = wrap(ctx, s, maxWidth, size, style.weight ?? "normal");
  const shown = lines.slice(0, Math.max(0, maxLines));
  if (lines.length > shown.length && shown.length) {
    let last = shown[shown.length - 1]!;
    ctx.font = font(size, style.weight ?? "normal");
    while (last.length > 1 && ctx.measureText(`${last}...`).width > maxWidth) last = last.slice(0, -1);
    shown[shown.length - 1] = `${last}...`;
  }
  shown.forEach((line, i) => text(ctx, x, y + i * lineH, line, style));
  return shown.length * lineH;
}

/** Horizontal progress bar with a rounded track. */
export function bar(ctx: Context2D, x: number, y: number, w: number, h: number, value: number, max: number, color: string): void {
  fillRound(ctx, x, y, w, h, h / 2, "rgba(0,0,0,0.35)");
  const f = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  if (f > 0) fillRound(ctx, x, y, Math.max(h, w * f), h, h / 2, color);
  strokeRound(ctx, x + 0.5, y + 0.5, w - 1, h - 1, h / 2, "rgba(255,255,255,0.12)");
}

/** A full-screen page: dark ground, a big card with a title and a bottom hint. Returns the card's content box. */
export function page(ctx: Context2D, w: number, h: number, title: string, hint?: string): { x: number; y: number; w: number; h: number } {
  ctx.fillStyle = UI.bg;
  ctx.fillRect(0, 0, w, h);
  const m = 24;
  panel(ctx, m, m, w - 2 * m, h - 2 * m, 16);
  text(ctx, w / 2, m + 16, title, { size: 24, weight: "600", align: "center" });
  ctx.fillStyle = UI.panelEdge;
  ctx.fillRect(m + 24, m + 54, w - 2 * m - 48, 1);
  if (hint) text(ctx, w / 2, h - m - 30, hint, { size: 13, color: UI.dim, align: "center" });
  return { x: m + 28, y: m + 68, w: w - 2 * m - 56, h: h - 2 * m - 110 };
}
