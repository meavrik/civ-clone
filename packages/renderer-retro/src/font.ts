import type { Surface } from "./surface.js";

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
