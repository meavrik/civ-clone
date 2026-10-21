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
  /** The glyph as the fine screen draws it (see DOT_X): its ink as fine pixels, and its advance in them. */
  fine: [number, number][];
  fineAdvance: number;
}

/**
 * On a fine surface each dot of a glyph is a 2x2 block of fine pixels, the dots 1.5 fine pixels apart
 * (rounded away from the middle, so glyphs stay symmetric), neighbours overlapping: every stroke two
 * pixels thick, the 16x16 game's letters at three quarters of their size, 8x11 fine pixels.
 */
const DOT_X = [0, 1, 3, 5, 6];
const DOT_Y = [0, 1, 3, 4, 6, 8, 9];

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
  const ink = new Set<string>();
  bits.forEach((m, r) => { for (let c = 0; c < 5; c++) if (m & (1 << (4 - c))) for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) ink.add(`${DOT_X[c]! - DOT_X[minC]! + dx},${DOT_Y[r]! + dy}`); });
  const fine = [...ink].map((k) => k.split(",").map(Number) as [number, number]);
  const fineAdvance = maxC < 0 ? 6 : DOT_X[maxC]! + 2 - DOT_X[minC]! + 2;
  GLYPHS.set(ch, { rows: shifted, advance, fine, fineAdvance });
}

export const FONT_HEIGHT = 8;

/** How far down its 8-pixel line (16 fine rows) a fine glyph's 11 rows start. */
const TEXT_TOP = 2;

/** Width of a line of text in dots, one fine pixel each (`drawTextSmall`). */
function dotWidth(text: string): number {
  let w = 0;
  for (const ch of text) w += (GLYPHS.get(ch) ?? GLYPHS.get("?")!).advance;
  return w;
}

/** Width of a line of text in screen pixels, as the (fine) screen draws it, rounded up. */
export function textWidth(text: string): number {
  let w = 0;
  for (const ch of text) w += (GLYPHS.get(ch) ?? GLYPHS.get("?")!).fineAdvance;
  return Math.ceil(w / 2);
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
    // A fine surface: the glyphs' fine ink (DOT_X), mid-line, the shadow one fine pixel off.
    const f = s.k / 2;
    const ox = x * s.k;
    const oy = y * s.k + TEXT_TOP * f;
    let dx = 0;
    for (const ch of text) {
      const g = GLYPHS.get(ch) ?? GLYPHS.get("?")!;
      if (shadow !== undefined) for (const [gx, gy] of g.fine) s.frect(ox + (dx + gx + 1) * f, oy + (gy + 1) * f, f, f, shadow);
      for (const [gx, gy] of g.fine) s.frect(ox + (dx + gx) * f, oy + gy * f, f, f, color);
      dx += g.fineAdvance;
    }
    return x + Math.ceil(dx / 2);
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
  return dotWidth(text);
}

/**
 * Text placed by fine pixel (a city's size on its plate): the 5x7 bitmaps a fine pixel to each dot,
 * its top left at fine pixel (fx, fy). On a coarse surface, ordinary text.
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

/** Text ringed in another colour, the ring one of the surface's finest pixels wide, so it reads on any ground. */
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
