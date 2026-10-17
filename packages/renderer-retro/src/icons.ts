import { hasIcons, iconSegments, wrapIconLine, type IconName } from "@civ/renderer-api";
import { drawText, textWidth, wrapText } from "./font.js";
import { ICON_SHEET, spriteSurface } from "./sprites/index.js";
import { SPRITE_CLEAR } from "./sprites/sheet.js";
import type { Surface } from "./surface.js";

/** Icons are 8x8, as tall as a line of text; one pixel of air follows each. */
export const ICON = 8;

export function drawIcon(s: Surface, name: IconName, x: number, y: number): void {
  const sprite = spriteSurface(ICON_SHEET, name);
  if (sprite) s.blit(sprite, x, y, SPRITE_CLEAR);
}

/** Width of a line that may carry {icon} tokens. */
export function iconLineWidth(line: string): number {
  let w = 0;
  for (const seg of iconSegments(line)) w += "icon" in seg ? ICON + 1 : textWidth(seg.text);
  return w;
}

/** Draw a line with {icon} tokens, text in `color`; returns the x just after it. */
export function drawIconLine(s: Surface, x: number, y: number, line: string, color: number): number {
  for (const seg of iconSegments(line)) {
    if ("icon" in seg) { drawIcon(s, seg.icon, x, y); x += ICON + 1; }
    else { drawText(s, x, y, seg.text, color); x += textWidth(seg.text); }
  }
  return x;
}

/** Wrap a line to a width: icon lines break between their "  " groups, plain text between words. */
export function wrapIcons(line: string, maxWidth: number): string[] {
  return hasIcons(line) ? wrapIconLine(line, maxWidth, iconLineWidth) : wrapText(line, maxWidth);
}

/** Draw a line as icons and text, wrapped to a width; returns how many lines it took (at most maxLines). */
export function drawIconsWrapped(s: Surface, x: number, y: number, maxWidth: number, line: string, color: number, maxLines: number, lineH = 9): number {
  const lines = wrapIcons(line, maxWidth).slice(0, Math.max(0, maxLines));
  lines.forEach((l, i) => drawIconLine(s, x, y + i * lineH, l, color));
  return lines.length;
}
