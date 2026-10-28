import { SPRITE_CLEAR } from "./sprites/sheet.js";
import { Surface } from "./surface.js";

/**
 * The game's bitmap font, drawn by hand for this project on the fine grid (two pixels to each screen
 * pixel), a dot one fine pixel: capitals and digits five dots wide and nine tall (I, M, N, W and the
 * like as they need), small letters six tall under three rows of ascender, two rows of descender for
 * g, j, p, q and y; every stroke one dot, square corners, nothing smoothed. Proportional. Drawn
 * 2026-10-24 for a middle size (asked for: "either you make it huge or too tiny... not too big not too
 * small - AND READABLE"): the 4x6-dot letters before it were twelve fine pixels tall with 2x2 dots, or
 * six with single dots, and nothing crisp lies between. On a coarse surface a dot is a screen pixel.
 */
const G: Record<string, string[]> = {
  " ": [""],
  "!": ["#", "#", "#", "#", "#", "#", "#", "", "#"],
  "\"": ["# #", "# #", "# #"],
  "$": ["  #  ", " ####", "# #  ", "# #  ", " ### ", "  # #", "  # #", "#### ", "  #  "],
  "%": ["##  #", "##  #", "   # ", "   # ", "  #  ", " #   ", " #   ", "#  ##", "#  ##"],
  "'": ["#", "#", "#"],
  "(": ["  #", " # ", "#  ", "#  ", "#  ", "#  ", "#  ", " # ", "  #"],
  ")": ["#  ", " # ", "  #", "  #", "  #", "  #", "  #", " # ", "#  "],
  "*": ["", "", "# # #", " ### ", "#####", " ### ", "# # #"],
  "+": ["", "", "  #  ", "  #  ", "#####", "  #  ", "  #  "],
  ",": ["", "", "", "", "", "", "", " #", " #", "# "],
  "-": ["", "", "", "", "####"],
  ".": ["", "", "", "", "", "", "", "", "#"],
  "/": ["    #", "    #", "   # ", "   # ", "  #  ", " #   ", " #   ", "#    ", "#    "],
  "0": [" ### ", "#   #", "#  ##", "# # #", "# # #", "# # #", "##  #", "#   #", " ### "],
  "1": ["  #  ", " ##  ", "# #  ", "  #  ", "  #  ", "  #  ", "  #  ", "  #  ", "#####"],
  "2": [" ### ", "#   #", "    #", "    #", "   # ", "  #  ", " #   ", "#    ", "#####"],
  "3": [" ### ", "#   #", "    #", "    #", "  ## ", "    #", "    #", "#   #", " ### "],
  "4": ["   # ", "  ## ", " # # ", "#  # ", "#  # ", "#####", "   # ", "   # ", "   # "],
  "5": ["#####", "#    ", "#    ", "#### ", "    #", "    #", "    #", "#   #", " ### "],
  "6": ["  ## ", " #   ", "#    ", "#    ", "#### ", "#   #", "#   #", "#   #", " ### "],
  "7": ["#####", "    #", "    #", "   # ", "   # ", "  #  ", "  #  ", "  #  ", "  #  "],
  "8": [" ### ", "#   #", "#   #", "#   #", " ### ", "#   #", "#   #", "#   #", " ### "],
  "9": [" ### ", "#   #", "#   #", "#   #", " ####", "    #", "    #", "   # ", " ##  "],
  ":": ["", "", "", "", "#", "", "", "", "#"],
  ";": ["", "", "", "", " #", "", "", "", " #", "# "],
  "<": ["", "   #", "  # ", " #  ", "#   ", " #  ", "  # ", "   #"],
  "=": ["", "", "", "####", "", "####"],
  ">": ["", "#   ", " #  ", "  # ", "   #", "  # ", " #  ", "#   "],
  // An arrow from one number to the next ("4 → 3"), on the line of the minus sign.
  "→": ["", "", "   #  ", "    # ", "######", "    # ", "   #  "],
  // A row that opens a submenu ("Options ▸").
  "▸": ["", "", "#  ", "## ", "###", "## ", "#  "],
  "?": [" ### ", "#   #", "    #", "   # ", "  #  ", "  #  ", "  #  ", "", "  #  "],
  "A": [" ### ", "#   #", "#   #", "#   #", "#####", "#   #", "#   #", "#   #", "#   #"],
  "B": ["#### ", "#   #", "#   #", "#   #", "#### ", "#   #", "#   #", "#   #", "#### "],
  "C": [" ### ", "#   #", "#    ", "#    ", "#    ", "#    ", "#    ", "#   #", " ### "],
  "D": ["#### ", "#   #", "#   #", "#   #", "#   #", "#   #", "#   #", "#   #", "#### "],
  "E": ["#####", "#    ", "#    ", "#    ", "#### ", "#    ", "#    ", "#    ", "#####"],
  "F": ["#####", "#    ", "#    ", "#    ", "#### ", "#    ", "#    ", "#    ", "#    "],
  "G": [" ### ", "#   #", "#    ", "#    ", "# ###", "#   #", "#   #", "#   #", " ### "],
  "H": ["#   #", "#   #", "#   #", "#   #", "#####", "#   #", "#   #", "#   #", "#   #"],
  "I": ["###", " # ", " # ", " # ", " # ", " # ", " # ", " # ", "###"],
  "J": ["  ###", "   # ", "   # ", "   # ", "   # ", "   # ", "#  # ", "#  # ", " ##  "],
  "K": ["#   #", "#  # ", "# #  ", "##   ", "##   ", "# #  ", "#  # ", "#   #", "#   #"],
  "L": ["#    ", "#    ", "#    ", "#    ", "#    ", "#    ", "#    ", "#    ", "#####"],
  "M": ["#   #", "## ##", "# # #", "# # #", "#   #", "#   #", "#   #", "#   #", "#   #"],
  "N": ["#   #", "##  #", "##  #", "# # #", "# # #", "#  ##", "#  ##", "#   #", "#   #"],
  "O": [" ### ", "#   #", "#   #", "#   #", "#   #", "#   #", "#   #", "#   #", " ### "],
  "P": ["#### ", "#   #", "#   #", "#   #", "#### ", "#    ", "#    ", "#    ", "#    "],
  "Q": [" ### ", "#   #", "#   #", "#   #", "#   #", "#   #", "# # #", "#  # ", " ## #"],
  "R": ["#### ", "#   #", "#   #", "#   #", "#### ", "# #  ", "#  # ", "#   #", "#   #"],
  "S": [" ### ", "#   #", "#    ", "#    ", " ### ", "    #", "    #", "#   #", " ### "],
  "T": ["#####", "  #  ", "  #  ", "  #  ", "  #  ", "  #  ", "  #  ", "  #  ", "  #  "],
  "U": ["#   #", "#   #", "#   #", "#   #", "#   #", "#   #", "#   #", "#   #", " ### "],
  "V": ["#   #", "#   #", "#   #", "#   #", "#   #", "#   #", " # # ", " # # ", "  #  "],
  "W": ["#   #", "#   #", "#   #", "#   #", "# # #", "# # #", "# # #", "## ##", "#   #"],
  "X": ["#   #", "#   #", " # # ", " # # ", "  #  ", " # # ", " # # ", "#   #", "#   #"],
  "Y": ["#   #", "#   #", " # # ", " # # ", "  #  ", "  #  ", "  #  ", "  #  ", "  #  "],
  "Z": ["#####", "    #", "   # ", "   # ", "  #  ", " #   ", " #   ", "#    ", "#####"],
  "a": ["", "", "", " ### ", "    #", " ####", "#   #", "#   #", " ####"],
  "b": ["#    ", "#    ", "#    ", "#### ", "#   #", "#   #", "#   #", "#   #", "#### "],
  "c": ["", "", "", " ###", "#   ", "#   ", "#   ", "#   ", " ###"],
  "d": ["    #", "    #", "    #", " ####", "#   #", "#   #", "#   #", "#   #", " ####"],
  "e": ["", "", "", " ### ", "#   #", "#####", "#    ", "#    ", " ### "],
  "f": ["  ##", " #  ", " #  ", "####", " #  ", " #  ", " #  ", " #  ", " #  "],
  "g": ["", "", "", " ####", "#   #", "#   #", "#   #", "#   #", " ####", "    #", " ### "],
  "h": ["#    ", "#    ", "#    ", "#### ", "#   #", "#   #", "#   #", "#   #", "#   #"],
  "i": ["", "#", "", "#", "#", "#", "#", "#", "#"],
  "j": ["", "  #", "", "  #", "  #", "  #", "  #", "  #", "  #", "# #", " # "],
  "k": ["#    ", "#    ", "#    ", "#  # ", "# #  ", "##   ", "# #  ", "#  # ", "#   #"],
  "l": ["# ", "# ", "# ", "# ", "# ", "# ", "# ", "# ", " #"],
  "m": ["", "", "", "## # ", "# # #", "# # #", "# # #", "# # #", "# # #"],
  "n": ["", "", "", "#### ", "#   #", "#   #", "#   #", "#   #", "#   #"],
  "o": ["", "", "", " ### ", "#   #", "#   #", "#   #", "#   #", " ### "],
  "p": ["", "", "", "#### ", "#   #", "#   #", "#   #", "#   #", "#### ", "#    ", "#    "],
  "q": ["", "", "", " ####", "#   #", "#   #", "#   #", "#   #", " ####", "    #", "    #"],
  "r": ["", "", "", "# ##", "##  ", "#   ", "#   ", "#   ", "#   "],
  "s": ["", "", "", " ####", "#    ", " ### ", "    #", "    #", "#### "],
  "t": ["", " #  ", " #  ", "####", " #  ", " #  ", " #  ", " #  ", "  ##"],
  "u": ["", "", "", "#   #", "#   #", "#   #", "#   #", "#   #", " ####"],
  "v": ["", "", "", "#   #", "#   #", "#   #", " # # ", " # # ", "  #  "],
  "w": ["", "", "", "#   #", "#   #", "# # #", "# # #", "# # #", " # # "],
  "x": ["", "", "", "#   #", " # # ", "  #  ", "  #  ", " # # ", "#   #"],
  "y": ["", "", "", "#   #", "#   #", "#   #", "#   #", "#   #", " ####", "    #", " ### "],
  "z": ["", "", "", "#####", "   # ", "  #  ", " #   ", "#    ", "#####"],
};

interface Glyph {
  /** Ink dots as (column, row), left-trimmed; rows 0-8 stand on the baseline, rows 9 and 10 hang below it. */
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
  GLYPHS.set(ch, { dots: dots.map(([c, y]) => [c - minC, y]), advance: ch === " " ? 4 : width + 1 });
}

/** Height of a line of text in screen pixels. */
export const FONT_HEIGHT = 8;
/** On a coarse surface, the row of its line a glyph's top dots sit on. */
const TEXT_TOP = 1;
/**
 * On a fine surface a line is sixteen dots tall (a dot a fine pixel); the capitals' top row sits this
 * many dots down, so the nine rows of capitals stand in the middle of the line, the descenders below.
 */
const FINE_TOP = 3;
/** Rows of a capital, in dots. */
const CAP = 9;

/** Width of a line of text in dots (fine pixels on the screen; a screen pixel is two). */
function dotWidth(text: string): number {
  let w = 0;
  for (const ch of text) w += (GLYPHS.get(ch) ?? GLYPHS.get("?")!).advance;
  return w;
}

/** Width of a line of text in screen pixels, as the (fine) screen draws it, rounded up. */
export function textWidth(text: string): number {
  return Math.ceil(dotWidth(text) / 2);
}

/**
 * Text at (x, y), the top left of its line, in `color`, over a `shadow` one dot down and right;
 * returns the x after it (in screen pixels, rounded up).
 */
export function drawText(
  s: Surface,
  x: number,
  y: number,
  text: string,
  color: number,
  shadow?: number,
): number {
  if (s.k >= 2) {
    const f = s.k / 2;
    const ox = x * s.k;
    const oy = y * s.k + FINE_TOP * f;
    let dx = 0;
    for (const ch of text) {
      const g = GLYPHS.get(ch) ?? GLYPHS.get("?")!;
      if (shadow !== undefined) for (const [c, r] of g.dots) s.frect(ox + (dx + c + 1) * f, oy + (r + 1) * f, f, f, shadow);
      for (const [c, r] of g.dots) s.frect(ox + (dx + c) * f, oy + r * f, f, f, color);
      dx += g.advance;
    }
    return x + Math.ceil(dx / 2);
  }
  let cx = x;
  for (const ch of text) {
    const g = GLYPHS.get(ch) ?? GLYPHS.get("?")!;
    if (shadow !== undefined) for (const [c, r] of g.dots) s.set(cx + c + 1, y + TEXT_TOP + r + 1, shadow);
    for (const [c, r] of g.dots) s.set(cx + c, y + TEXT_TOP + r, color);
    cx += g.advance;
  }
  return cx;
}

/**
 * Text `scale` times as large (a window's headline): each dot a `scale` by `scale` block of fine
 * pixels on the screen, set where the ordinary line's middle would be; returns the x after it.
 */
export function drawTextLarge(s: Surface, x: number, y: number, text: string, color: number, scale = 2): number {
  const f = Math.max(1, s.k / 2) * scale;
  const ox = x * s.k;
  const oy = y * s.k + FINE_TOP * f;
  let dx = 0;
  for (const ch of text) {
    const g = GLYPHS.get(ch) ?? GLYPHS.get("?")!;
    for (const [c, r] of g.dots) s.frect(ox + (dx + c) * f, oy + r * f, f, f, color);
    dx += g.advance;
  }
  return x + Math.ceil((dx * f) / s.k);
}

/** `drawTextLarge` text ringed a dot round in another colour, so it reads on any ground (a cheer over the map). */
export function drawTextLargeRinged(s: Surface, x: number, y: number, text: string, color: number, ring: number, scale = 2): void {
  const f = Math.max(1, s.k / 2) * scale;
  const scratch = new Surface(textWidthLarge(text, scale) + 2, FONT_HEIGHT * scale + 2, undefined, s.k);
  scratch.fill(SPRITE_CLEAR);
  drawTextLarge(scratch, 1, 1, text, ring, scale);
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [1, 1], [-1, 1], [1, -1], [-1, -1]] as const)
    s.fblit(scratch, (x - 1) * s.k + dx * f, (y - 1) * s.k + dy * f, SPRITE_CLEAR);
  drawTextLarge(s, x, y, text, color, scale);
}

/** Width of `drawTextLarge` text on the screen (two fine pixels to a screen pixel), in screen pixels. */
export function textWidthLarge(text: string, scale = 2): number {
  return Math.ceil((dotWidth(text) * scale) / 2);
}

/** Capitals spread a pixel apart, centred on `cx` (title strips). */
export function drawSpaced(s: Surface, cx: number, y: number, text: string, color: number): void {
  const caps = text.toUpperCase();
  if (s.k < 2) {
    let x = Math.floor(cx - spacedDots(caps) / 2);
    for (const ch of caps) x = drawText(s, x, y, ch, color) + 1;
    return;
  }
  // A dot more between the letters than ordinary text has.
  const f = s.k / 2;
  let fx = Math.floor(cx * s.k - (spacedDots(caps) * f) / 2);
  const oy = y * s.k + FINE_TOP * f;
  for (const ch of caps) {
    const g = GLYPHS.get(ch) ?? GLYPHS.get("?")!;
    for (const [c, r] of g.dots) s.frect(fx + c * f, oy + r * f, f, f, color);
    fx += (g.advance + 1) * f;
  }
}

function spacedDots(caps: string): number {
  return [...caps].reduce((n, ch) => n + (GLYPHS.get(ch) ?? GLYPHS.get("?")!).advance + 1, -1);
}

/** Width of `drawSpaced` text, in screen pixels. */
export function spacedWidth(text: string): number {
  return Math.ceil(spacedDots(text.toUpperCase()) / 2);
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

/** `drawSpaced` capitals ringed in another colour, as `drawTextRinged` rings ordinary text (the names of lands on the map). */
export function drawSpacedRinged(s: Surface, cx: number, y: number, text: string, color: number, ring: number): void {
  const w = spacedWidth(text);
  const x0 = Math.floor(cx) - Math.ceil(w / 2) - 2;
  const scratch = new Surface(w + 6, FONT_HEIGHT + 2, undefined, s.k);
  scratch.fill(SPRITE_CLEAR);
  drawSpaced(scratch, cx - x0, 1, text, ring);
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [1, 1], [-1, 1], [1, -1], [-1, -1]] as const)
    s.fblit(scratch, x0 * s.k + dx, (y - 1) * s.k + dy, SPRITE_CLEAR);
  drawSpaced(s, cx, y, text, color);
}

/** Width in screen pixels of `drawTextPlate`'s plate. */
export function textPlateWidth(text: string): number {
  return Math.ceil((dotWidth(text) + 2) / 2);
}

/**
 * Text on a plate (a city's size beside its name): a fill round the letters, a dot of it on every
 * side, edged one fine pixel, in the middle of the line at (x, y). Returns the plate's width in screen pixels.
 */
export function drawTextPlate(s: Surface, x: number, y: number, text: string, fill: number, edge: number, ink: number): number {
  const w = textPlateWidth(text);
  if (s.k < 2) {
    s.rect(x, y, w, FONT_HEIGHT, fill);
    drawText(s, x + 1, y, text, ink);
    return w;
  }
  const f = s.k / 2;
  const top = y * s.k + (FINE_TOP - 1) * f;
  s.frect(x * s.k - f, top - f, w * s.k + 2 * f, (CAP + 4) * f, edge);
  s.frect(x * s.k, top, w * s.k, (CAP + 2) * f, fill);
  const g = Math.floor((w * s.k - dotWidth(text) * f) / 2);
  let fx = x * s.k + g + f;
  for (const ch of text) {
    const gl = GLYPHS.get(ch) ?? GLYPHS.get("?")!;
    for (const [c, r] of gl.dots) s.frect(fx + c * f, top + (r + 1) * f, f, f, ink);
    fx += gl.advance * f;
  }
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

/**
 * Small capitals for quiet labels where the font would shout (the minimap's continents; asked for
 * 2026-10-28: "make continents name smaller and less noticeable - to distinct from the civ names"):
 * drawn by hand on the fine grid as the font is, a dot a fine pixel, one dot a stroke, five dots tall and
 * three wide (I one; N, O, D, G, Q and U four; M and W five). Written letter-spaced, a map's region
 * labels; small letters are written as capitals and accents dropped.
 */
const SMALL: Record<string, string[]> = {
  A: [" # ", "# #", "###", "# #", "# #"],
  B: ["## ", "# #", "## ", "# #", "## "],
  C: [" ##", "#  ", "#  ", "#  ", " ##"],
  D: ["### ", "#  #", "#  #", "#  #", "### "],
  E: ["###", "#  ", "## ", "#  ", "###"],
  F: ["###", "#  ", "## ", "#  ", "#  "],
  G: [" ###", "#   ", "# ##", "#  #", " ###"],
  H: ["# #", "# #", "###", "# #", "# #"],
  I: ["#", "#", "#", "#", "#"],
  J: ["  #", "  #", "  #", "# #", " # "],
  K: ["# #", "# #", "## ", "# #", "# #"],
  L: ["#  ", "#  ", "#  ", "#  ", "###"],
  M: ["#   #", "## ##", "# # #", "#   #", "#   #"],
  N: ["#  #", "## #", "# ##", "#  #", "#  #"],
  O: [" ## ", "#  #", "#  #", "#  #", " ## "],
  P: ["## ", "# #", "## ", "#  ", "#  "],
  Q: [" ## ", "#  #", "#  #", "# # ", " # #"],
  R: ["## ", "# #", "## ", "# #", "# #"],
  S: [" ##", "#  ", " # ", "  #", "## "],
  T: ["###", " # ", " # ", " # ", " # "],
  U: ["#  #", "#  #", "#  #", "#  #", " ## "],
  V: ["# #", "# #", "# #", "# #", " # "],
  W: ["#   #", "#   #", "# # #", "## ##", "#   #"],
  X: ["# #", "# #", " # ", "# #", "# #"],
  Y: ["# #", "# #", " # ", " # ", " # "],
  Z: ["###", "  #", " # ", "#  ", "###"],
  "'": ["#", "#"],
  "-": ["", "", "##"],
  ".": ["", "", "", "", "#"],
};
const SMALL_GLYPHS = new Map<string, Glyph>();
for (const [ch, rows] of Object.entries(SMALL)) {
  const dots: [number, number][] = [];
  rows.forEach((r, y) => { for (let c = 0; c < r.length; c++) if (r[c] === "#") dots.push([c, y]); });
  SMALL_GLYPHS.set(ch, { dots, advance: Math.max(...rows.map((r) => r.length)) });
}
/** Dots between two small capitals, and a space's width. */
const SMALL_GAP = 2;
const SMALL_SPACE = 4;
/** The letters as small capitals write them: capitals, accents dropped, anything else left out. */
function smallLetters(text: string): string[] {
  return [...text.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase()].filter((ch) => ch === " " || SMALL_GLYPHS.has(ch));
}

function smallDots(letters: string[]): number {
  let w = 0;
  letters.forEach((ch, i) => { w += (ch === " " ? SMALL_SPACE : SMALL_GLYPHS.get(ch)!.advance) + (i < letters.length - 1 && ch !== " " && letters[i + 1] !== " " ? SMALL_GAP : 0); });
  return w;
}

/** Width of small capitals in screen pixels (two dots to a pixel on the fine screen), rounded up. */
export function smallCapsWidth(text: string): number {
  return Math.ceil(smallDots(smallLetters(text)) / 2);
}

/** Height of small capitals in screen pixels, a dot of shadow under them included. */
export const SMALL_CAPS_HEIGHT = 3;

/** Small capitals with their top left at (x, y), in `color`, over a `shadow` one dot down and right. */
export function drawSmallCaps(s: Surface, x: number, y: number, text: string, color: number, shadow?: number): void {
  const letters = smallLetters(text);
  const f = Math.max(1, s.k / 2);
  const pass = (ink: number, d: number) => {
    let dx = 0;
    letters.forEach((ch, i) => {
      if (ch === " ") { dx += SMALL_SPACE; return; }
      const g = SMALL_GLYPHS.get(ch)!;
      for (const [c, r] of g.dots) s.frect(x * s.k + (dx + c + d) * f, y * s.k + (r + d) * f, f, f, ink);
      dx += g.advance + (i < letters.length - 1 && letters[i + 1] !== " " ? SMALL_GAP : 0);
    });
  };
  if (shadow !== undefined) pass(shadow, 1);
  pass(color, 0);
}
