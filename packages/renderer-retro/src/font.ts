import { SPRITE_CLEAR } from "./sprites/sheet.js";
import { Surface } from "./surface.js";

/**
 * The game's bitmap font, drawn by hand for this project on a grid of dots: glyphs four dots wide
 * (three to five, the font being proportional) and six tall, with a seventh row below the baseline
 * for the descenders of g, j, p, q and y. Each glyph is rows of characters, '#' ink, top row first;
 * missing rows are blank. A dot is one screen pixel (a 2x2 block on the fine screen), so every
 * stroke and every gap is a whole dot: as blocky as the terrain, a little smaller than the 1991
 * game's 5x7 letters.
 */
const G: Record<string, string[]> = {
  " ": [""],
  "!": ["#", "#", "#", "#", "", "#"],
  "\"": ["# #", "# #"],
  "$": [" # ", " ##", "#  ", " # ", "  #", "## ", " # "],
  "%": ["#  #", "   #", "  # ", " #  ", "#   ", "#  #"],
  "'": ["#", "#"],
  "(": [" #", "# ", "# ", "# ", "# ", " #"],
  ")": ["# ", " #", " #", " #", " #", "# "],
  "*": ["", "# #", " # ", "# #"],
  "+": ["", " # ", "###", " # "],
  ",": ["", "", "", "", "", " #", "# "],
  "-": ["", "", "", "###"],
  ".": ["", "", "", "", "", "#"],
  "/": ["   #", "   #", "  # ", " #  ", "#   ", "#   "],
  "0": [" ## ", "#  #", "# ##", "## #", "#  #", " ## "],
  "1": [" # ", "## ", " # ", " # ", " # ", "###"],
  "2": [" ## ", "#  #", "   #", " ## ", "#   ", "####"],
  "3": ["### ", "   #", " ## ", "   #", "   #", "### "],
  "4": ["#  #", "#  #", "####", "   #", "   #", "   #"],
  "5": ["####", "#   ", "### ", "   #", "   #", "### "],
  "6": [" ## ", "#   ", "### ", "#  #", "#  #", " ## "],
  "7": ["####", "   #", "  # ", " #  ", " #  ", " #  "],
  "8": [" ## ", "#  #", " ## ", "#  #", "#  #", " ## "],
  "9": [" ## ", "#  #", "#  #", " ###", "   #", " ## "],
  ":": ["", "", "#", "", "", "#"],
  ";": ["", "", " #", "", "", " #", "# "],
  "<": ["", "  #", " # ", "#  ", " # ", "  #"],
  "=": ["", "", "###", "", "###"],
  ">": ["", "#  ", " # ", "  #", " # ", "#  "],
  "?": [" ## ", "#  #", "  # ", " #  ", "    ", " #  "],
  "A": [" ## ", "#  #", "#  #", "####", "#  #", "#  #"],
  "B": ["### ", "#  #", "### ", "#  #", "#  #", "### "],
  "C": [" ###", "#   ", "#   ", "#   ", "#   ", " ###"],
  "D": ["### ", "#  #", "#  #", "#  #", "#  #", "### "],
  "E": ["####", "#   ", "### ", "#   ", "#   ", "####"],
  "F": ["####", "#   ", "### ", "#   ", "#   ", "#   "],
  "G": [" ###", "#   ", "#   ", "# ##", "#  #", " ###"],
  "H": ["#  #", "#  #", "####", "#  #", "#  #", "#  #"],
  "I": ["###", " # ", " # ", " # ", " # ", "###"],
  "J": ["  ##", "   #", "   #", "   #", "#  #", " ## "],
  "K": ["#  #", "# # ", "##  ", "# # ", "#  #", "#  #"],
  "L": ["#   ", "#   ", "#   ", "#   ", "#   ", "####"],
  "M": ["#   #", "## ##", "# # #", "#   #", "#   #", "#   #"],
  "N": ["#  #", "## #", "####", "# ##", "#  #", "#  #"],
  "O": [" ## ", "#  #", "#  #", "#  #", "#  #", " ## "],
  "P": ["### ", "#  #", "#  #", "### ", "#   ", "#   "],
  "Q": [" ## ", "#  #", "#  #", "#  #", "# # ", " # #"],
  "R": ["### ", "#  #", "#  #", "### ", "# # ", "#  #"],
  "S": [" ###", "#   ", " ## ", "   #", "   #", "### "],
  "T": ["###", " # ", " # ", " # ", " # ", " # "],
  "U": ["#  #", "#  #", "#  #", "#  #", "#  #", " ## "],
  "V": ["#   #", "#   #", "#   #", "#   #", " # # ", "  #  "],
  "W": ["#   #", "#   #", "#   #", "# # #", "# # #", " # # "],
  "X": ["#  #", "#  #", " ## ", " ## ", "#  #", "#  #"],
  "Y": ["# #", "# #", "# #", " # ", " # ", " # "],
  "Z": ["####", "   #", "  # ", " #  ", "#   ", "####"],
  "a": ["", "", " ###", "#  #", "#  #", " ###"],
  "b": ["#   ", "#   ", "### ", "#  #", "#  #", "### "],
  "c": ["", "", " ###", "#   ", "#   ", " ###"],
  "d": ["   #", "   #", " ###", "#  #", "#  #", " ###"],
  "e": ["", "", " ## ", "####", "#   ", " ###"],
  "f": [" ##", " # ", "###", " # ", " # ", " # "],
  "g": ["", "", " ###", "#  #", " ###", "   #", " ## "],
  "h": ["#   ", "#   ", "### ", "#  #", "#  #", "#  #"],
  "i": ["#", "", "#", "#", "#", "#"],
  "j": ["  #", "", "  #", "  #", "  #", "  #", " ##"],
  "k": ["#   ", "#   ", "# # ", "##  ", "# # ", "#  #"],
  "l": ["#", "#", "#", "#", "#", "#"],
  "m": ["", "", "## # ", "# # #", "# # #", "# # #"],
  "n": ["", "", "### ", "#  #", "#  #", "#  #"],
  "o": ["", "", " ## ", "#  #", "#  #", " ## "],
  "p": ["", "", "### ", "#  #", "#  #", "### ", "#   "],
  "q": ["", "", " ###", "#  #", "#  #", " ###", "   #"],
  "r": ["", "", "# ##", "##  ", "#   ", "#   "],
  "s": ["", "", " ###", "##  ", "  ##", "### "],
  "t": ["", " # ", "###", " # ", " # ", " ##"],
  "u": ["", "", "#  #", "#  #", "#  #", " ###"],
  "v": ["", "", "# #", "# #", "# #", " # "],
  "w": ["", "", "#   #", "# # #", "# # #", " # # "],
  "x": ["", "", "#  #", " ## ", " ## ", "#  #"],
  "y": ["", "", "#  #", "#  #", " ###", "   #", " ## "],
  "z": ["", "", "####", "  # ", " #  ", "####"],
};

interface Glyph {
  /** Ink dots as (column, row), left-trimmed; rows 0-5 stand on the baseline, row 6 hangs below it. */
  dots: [number, number][];
  /** Dots across, the gap after the glyph included (a space is 3). */
  advance: number;
}

const GLYPHS = new Map<string, Glyph>();
for (const [ch, rows] of Object.entries(G)) {
  const dots: [number, number][] = [];
  rows.forEach((r, y) => { for (let c = 0; c < r.length; c++) if (r[c] === "#") dots.push([c, y]); });
  const minC = dots.length ? Math.min(...dots.map((d) => d[0])) : 0;
  const width = dots.length ? Math.max(...dots.map((d) => d[0])) - minC + 1 : 0;
  GLYPHS.set(ch, { dots: dots.map(([c, y]) => [c - minC, y]), advance: ch === " " ? 3 : width + 1 });
}

/** Height of a line of text in pixels: a dot above the glyphs, six rows of dots, the descender row. */
export const FONT_HEIGHT = 8;
/** The row of its line a glyph's top dots sit on. */
const TEXT_TOP = 1;

/** Width of a line of text in screen pixels. */
export function textWidth(text: string): number {
  let w = 0;
  for (const ch of text) w += (GLYPHS.get(ch) ?? GLYPHS.get("?")!).advance;
  return w;
}

/** Text at (x, y), the top left of its line, in `color`, over a `shadow` one pixel down and right; returns the x after it. */
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
    if (shadow !== undefined) for (const [c, r] of g.dots) s.set(cx + c + 1, y + TEXT_TOP + r + 1, shadow);
    for (const [c, r] of g.dots) s.set(cx + c, y + TEXT_TOP + r, color);
    cx += g.advance;
  }
  return cx;
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

/**
 * Text on a plate (a city's size beside its name): a fill the height of the line, edged one fine
 * pixel, the text one pixel in from the left. Returns the plate's width in screen pixels.
 */
export function drawTextPlate(s: Surface, x: number, y: number, text: string, fill: number, edge: number, ink: number): number {
  const w = textWidth(text) + 2;
  const f = Math.max(1, s.k / 2);
  s.frect(x * s.k - f, y * s.k - f, w * s.k + 2 * f, FONT_HEIGHT * s.k + 2 * f, edge);
  s.rect(x, y, w, FONT_HEIGHT, fill);
  drawText(s, x + 1, y, text, ink);
  return w;
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
