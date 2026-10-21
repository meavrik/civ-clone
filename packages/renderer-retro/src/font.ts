import fineArt from "./art/font.art.js";
import { SPRITE_CLEAR } from "./sprites/sheet.js";
import { Surface } from "./surface.js";

/**
 * Original 5x7 bitmap font in an 8px-high cell, drawn by hand for this
 * project. Glyphs are stored as 7 rows of 5 characters; '#' is ink.
 * Advance is per-glyph (proportional), like the original's UI font, which
 * matters for text wrapping in dialogs matching the original's line breaks.
 */
const G: Record<string, string[]> = {
  " ": ["     ", "     ", "     ", "     ", "     ", "     ", "     "],
  "!": ["  #  ", "  #  ", "  #  ", "  #  ", "  #  ", "     ", "  #  "],
  '"': [" # # ", " # # ", "     ", "     ", "     ", "     ", "     "],
  "$": ["  #  ", " ####", "# #  ", " ### ", "  # #", "#### ", "  #  "],
  "%": ["##  #", "## # ", "  #  ", "  #  ", " #   ", "# ## ", "#  ##"],
  "'": ["  #  ", "  #  ", "     ", "     ", "     ", "     ", "     "],
  "(": ["   # ", "  #  ", " #   ", " #   ", " #   ", "  #  ", "   # "],
  ")": [" #   ", "  #  ", "   # ", "   # ", "   # ", "  #  ", " #   "],
  "*": ["     ", "# # #", " ### ", "#####", " ### ", "# # #", "     "],
  "+": ["     ", "  #  ", "  #  ", "#####", "  #  ", "  #  ", "     "],
  ",": ["     ", "     ", "     ", "     ", "  ## ", "  ## ", " #   "],
  "-": ["     ", "     ", "     ", "#####", "     ", "     ", "     "],
  ".": ["     ", "     ", "     ", "     ", "     ", " ##  ", " ##  "],
  "/": ["    #", "    #", "   # ", "  #  ", " #   ", "#    ", "#    "],
  "0": [" ### ", "#   #", "#  ##", "# # #", "##  #", "#   #", " ### "],
  "1": ["  #  ", " ##  ", "  #  ", "  #  ", "  #  ", "  #  ", " ### "],
  "2": [" ### ", "#   #", "    #", "   # ", "  #  ", " #   ", "#####"],
  "3": ["#####", "   # ", "  #  ", "   # ", "    #", "#   #", " ### "],
  "4": ["   # ", "  ## ", " # # ", "#  # ", "#####", "   # ", "   # "],
  "5": ["#####", "#    ", "#### ", "    #", "    #", "#   #", " ### "],
  "6": ["  ## ", " #   ", "#    ", "#### ", "#   #", "#   #", " ### "],
  "7": ["#####", "    #", "   # ", "  #  ", " #   ", " #   ", " #   "],
  "8": [" ### ", "#   #", "#   #", " ### ", "#   #", "#   #", " ### "],
  "9": [" ### ", "#   #", "#   #", " ####", "    #", "   # ", " ##  "],
  ":": ["     ", " ##  ", " ##  ", "     ", " ##  ", " ##  ", "     "],
  ";": ["     ", " ##  ", " ##  ", "     ", " ##  ", " ##  ", "#    "],
  "<": ["    #", "   # ", "  #  ", " #   ", "  #  ", "   # ", "    #"],
  "=": ["     ", "     ", "#####", "     ", "#####", "     ", "     "],
  ">": ["#    ", " #   ", "  #  ", "   # ", "  #  ", " #   ", "#    "],
  "?": [" ### ", "#   #", "    #", "   # ", "  #  ", "     ", "  #  "],
  "A": [" ### ", "#   #", "#   #", "#####", "#   #", "#   #", "#   #"],
  "B": ["#### ", "#   #", "#   #", "#### ", "#   #", "#   #", "#### "],
  "C": [" ### ", "#   #", "#    ", "#    ", "#    ", "#   #", " ### "],
  "D": ["###  ", "#  # ", "#   #", "#   #", "#   #", "#  # ", "###  "],
  "E": ["#####", "#    ", "#    ", "#### ", "#    ", "#    ", "#####"],
  "F": ["#####", "#    ", "#    ", "#### ", "#    ", "#    ", "#    "],
  "G": [" ### ", "#   #", "#    ", "# ###", "#   #", "#   #", " ####"],
  "H": ["#   #", "#   #", "#   #", "#####", "#   #", "#   #", "#   #"],
  "I": [" ### ", "  #  ", "  #  ", "  #  ", "  #  ", "  #  ", " ### "],
  "J": ["  ###", "   # ", "   # ", "   # ", "   # ", "#  # ", " ##  "],
  "K": ["#   #", "#  # ", "# #  ", "##   ", "# #  ", "#  # ", "#   #"],
  "L": ["#    ", "#    ", "#    ", "#    ", "#    ", "#    ", "#####"],
  "M": ["#   #", "## ##", "# # #", "# # #", "#   #", "#   #", "#   #"],
  "N": ["#   #", "##  #", "# # #", "#  ##", "#   #", "#   #", "#   #"],
  "O": [" ### ", "#   #", "#   #", "#   #", "#   #", "#   #", " ### "],
  "P": ["#### ", "#   #", "#   #", "#### ", "#    ", "#    ", "#    "],
  "Q": [" ### ", "#   #", "#   #", "#   #", "# # #", "#  # ", " ## #"],
  "R": ["#### ", "#   #", "#   #", "#### ", "# #  ", "#  # ", "#   #"],
  "S": [" ####", "#    ", "#    ", " ### ", "    #", "    #", "#### "],
  "T": ["#####", "  #  ", "  #  ", "  #  ", "  #  ", "  #  ", "  #  "],
  "U": ["#   #", "#   #", "#   #", "#   #", "#   #", "#   #", " ### "],
  "V": ["#   #", "#   #", "#   #", "#   #", "#   #", " # # ", "  #  "],
  "W": ["#   #", "#   #", "#   #", "# # #", "# # #", "## ##", "#   #"],
  "X": ["#   #", "#   #", " # # ", "  #  ", " # # ", "#   #", "#   #"],
  "Y": ["#   #", "#   #", " # # ", "  #  ", "  #  ", "  #  ", "  #  "],
  "Z": ["#####", "    #", "   # ", "  #  ", " #   ", "#    ", "#####"],
  "a": ["     ", "     ", " ### ", "    #", " ####", "#   #", " ####"],
  "b": ["#    ", "#    ", "#### ", "#   #", "#   #", "#   #", "#### "],
  "c": ["     ", "     ", " ### ", "#    ", "#    ", "#   #", " ### "],
  "d": ["    #", "    #", " ####", "#   #", "#   #", "#   #", " ####"],
  "e": ["     ", "     ", " ### ", "#   #", "#####", "#    ", " ### "],
  "f": ["  ## ", " #  #", " #   ", "###  ", " #   ", " #   ", " #   "],
  "g": ["     ", " ####", "#   #", "#   #", " ####", "    #", " ### "],
  "h": ["#    ", "#    ", "#### ", "#   #", "#   #", "#   #", "#   #"],
  "i": ["  #  ", "     ", " ##  ", "  #  ", "  #  ", "  #  ", " ### "],
  "j": ["   # ", "     ", "  ## ", "   # ", "   # ", "#  # ", " ##  "],
  "k": ["#    ", "#    ", "#  # ", "# #  ", "##   ", "# #  ", "#  # "],
  "l": [" ##  ", "  #  ", "  #  ", "  #  ", "  #  ", "  #  ", " ### "],
  "m": ["     ", "     ", "## # ", "# # #", "# # #", "#   #", "#   #"],
  "n": ["     ", "     ", "#### ", "#   #", "#   #", "#   #", "#   #"],
  "o": ["     ", "     ", " ### ", "#   #", "#   #", "#   #", " ### "],
  "p": ["     ", "#### ", "#   #", "#   #", "#### ", "#    ", "#    "],
  "q": ["     ", " ####", "#   #", "#   #", " ####", "    #", "    #"],
  "r": ["     ", "     ", "# ## ", "##  #", "#    ", "#    ", "#    "],
  "s": ["     ", "     ", " ####", "#    ", " ### ", "    #", "#### "],
  "t": [" #   ", " #   ", "###  ", " #   ", " #   ", " #  #", "  ## "],
  "u": ["     ", "     ", "#   #", "#   #", "#   #", "#  ##", " ## #"],
  "v": ["     ", "     ", "#   #", "#   #", "#   #", " # # ", "  #  "],
  "w": ["     ", "     ", "#   #", "#   #", "# # #", "# # #", " # # "],
  "x": ["     ", "     ", "#   #", " # # ", "  #  ", " # # ", "#   #"],
  "y": ["     ", "#   #", "#   #", "#   #", " ####", "    #", " ### "],
  "z": ["     ", "     ", "#####", "   # ", "  #  ", " #   ", "#####"],
};

interface Glyph {
  rows: number[]; // 7 bitmasks, bit 4 = leftmost column
  advance: number;
}

const GLYPHS = new Map<string, Glyph>();
for (const [ch, rows] of Object.entries(G)) {
  let minC = 5;
  let maxC = -1;
  const bits = rows.map((r) => {
    let m = 0;
    for (let c = 0; c < 5; c++) {
      if (r[c] === "#") {
        m |= 1 << (4 - c);
        if (c < minC) minC = c;
        if (c > maxC) maxC = c;
      }
    }
    return m;
  });
  const advance = ch === " " ? 4 : maxC - minC + 2;
  // Left-trim so proportional spacing is tight.
  const shifted = minC === 5 ? bits : bits.map((m) => (m << minC) & 0x1f);
  GLYPHS.set(ch, { rows: shifted, advance });
}

export const FONT_HEIGHT = 8;

/**
 * The same glyphs as fine as the screen (art/font.art.ts): two pixels to each screen pixel, stems two
 * wide and horizontal strokes one, each glyph as wide as here so text measures the same. Text on a
 * fine surface is drawn with these; on a coarse one with the bitmaps above.
 */
const FINE = new Map<string, [number, number][]>();
{
  let name: string | null = null;
  let y = 0;
  for (const raw of fineArt.split(/\r?\n/)) {
    const line = raw.trimEnd();
    // Comments only head the file: inside a glyph, '#' is ink.
    if (!line || (name === null && line.startsWith("#"))) continue;
    if (line.startsWith("@")) { name = line === "@space" ? " " : line.slice(1); FINE.set(name, []); y = 0; continue; }
    if (name === null) continue;
    [...line].forEach((c, x) => { if (c === "#") FINE.get(name!)!.push([x, y]); });
    y++;
  }
}

export function textWidth(text: string): number {
  let w = 0;
  for (const ch of text) w += (GLYPHS.get(ch) ?? GLYPHS.get("?")!).advance;
  return w;
}

export function drawText(
  s: Surface,
  x: number,
  y: number,
  text: string,
  color: number,
  shadow?: number,
): number {
  let cx = x;
  if (s.k >= 2) {
    // A fine surface: the fine glyphs, a fine pixel at a time (the shadow one fine pixel off).
    const f = s.k / 2;
    for (const ch of text) {
      const g = GLYPHS.get(ch) ?? GLYPHS.get("?")!;
      const ink = FINE.get(ch) ?? FINE.get("?")!;
      const ox = cx * s.k;
      const oy = y * s.k;
      if (shadow !== undefined) for (const [gx, gy] of ink) s.frect(ox + gx * f + f, oy + gy * f + f, f, f, shadow);
      for (const [gx, gy] of ink) s.frect(ox + gx * f, oy + gy * f, f, f, color);
      cx += g.advance;
    }
    return cx;
  }
  for (const ch of text) {
    const g = GLYPHS.get(ch) ?? GLYPHS.get("?")!;
    for (let r = 0; r < 7; r++) {
      const m = g.rows[r]!;
      if (!m) continue;
      for (let c = 0; c < 5; c++) {
        if (m & (1 << (4 - c))) {
          if (shadow !== undefined) s.set(cx + c + 1, y + r + 1, shadow);
          s.set(cx + c, y + r, color);
        }
      }
    }
    cx += g.advance;
  }
  return cx;
}

/** Width in fine pixels of `drawTextSmall`'s text. */
export function smallTextWidth(text: string): number {
  return textWidth(text);
}

/**
 * Small text for labels on the map (a city's size): the 5x7 bitmaps a fine pixel to each dot, half
 * the size of other text, its top left at fine pixel (fx, fy). On a coarse surface, ordinary text.
 */
export function drawTextSmall(s: Surface, fx: number, fy: number, text: string, color: number): void {
  if (s.k < 2) { drawText(s, Math.floor(fx / 2), Math.floor(fy / 2), text, color); return; }
  const f = s.k / 2;
  let cx = fx;
  for (const ch of text) {
    const g = GLYPHS.get(ch) ?? GLYPHS.get("?")!;
    for (let r = 0; r < 7; r++) for (let c = 0; c < 5; c++) if (g.rows[r]! & (1 << (4 - c))) s.frect((cx + c) * f, (fy + r) * f, f, f, color);
    cx += g.advance;
  }
}

/** Text ringed in another colour, the ring a pixel of the surface's finest wide, so it reads on any ground. */
export function drawTextRinged(s: Surface, x: number, y: number, text: string, color: number, ring: number): void {
  const scratch = new Surface(textWidth(text) + 2, FONT_HEIGHT + 2, undefined, s.k);
  scratch.fill(SPRITE_CLEAR);
  drawText(scratch, 1, 1, text, ring);
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [1, 1], [-1, 1], [1, -1], [-1, -1]] as const)
    s.fblit(scratch, (x - 1) * s.k + dx, (y - 1) * s.k + dy, SPRITE_CLEAR);
  drawText(s, x, y, text, color);
}

/** Break text into lines no wider than `maxWidth` pixels, on spaces; an overlong word is cut. */
export function wrapText(text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const para of text.split("\n")) {
    let line = "";
    for (const word of para.split(" ")) {
      if (word === "") continue;
      const next = line ? `${line} ${word}` : word;
      if (textWidth(next) <= maxWidth) { line = next; continue; }
      if (line) lines.push(line);
      line = word;
      while (textWidth(line) > maxWidth && line.length > 1) {
        let cut = line.length - 1;
        while (cut > 1 && textWidth(line.slice(0, cut)) > maxWidth) cut--;
        lines.push(line.slice(0, cut));
        line = line.slice(cut);
      }
    }
    lines.push(line);
  }
  return lines;
}

/** Draw wrapped text, at most `maxLines` lines (the last one ends in "..." if cut). Returns lines drawn. */
export function drawTextWrapped(s: Surface, x: number, y: number, maxWidth: number, text: string, color: number, maxLines: number): number {
  if (maxLines <= 0) return 0;
  const lines = wrapText(text, maxWidth);
  const shown = lines.slice(0, maxLines);
  if (lines.length > maxLines && shown.length) {
    let last = shown[shown.length - 1]!;
    while (last.length > 1 && textWidth(`${last}...`) > maxWidth) last = last.slice(0, -1);
    shown[shown.length - 1] = `${last}...`;
  }
  shown.forEach((line, i) => drawText(s, x, y + i * FONT_HEIGHT, line, color));
  return shown.length;
}

export function drawTextCentered(
  s: Surface,
  cx: number,
  y: number,
  text: string,
  color: number,
  shadow?: number,
): void {
  drawText(s, Math.floor(cx - textWidth(text) / 2), y, text, color, shadow);
}
