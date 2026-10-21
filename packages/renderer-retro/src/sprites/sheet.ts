import { C, PALETTE, shade, type Rgb } from "../palette.js";

/**
 * Sprite sheets as text. Each sprite is a square grid of characters; each
 * character names a palette colour through a small legend, so every pixel
 * is in the palette by construction. The same text round-trips through a
 * PNG for editing in a paint program (see tools/sprites), where any colour
 * outside the sprite's legend is rejected.
 *
 * Legend:
 *   .  clear            k  black        w  white
 *   P  owner colour     p  owner dark   (filled in per civilization)
 *   r/R red  y yellow  Y brown  u/U blue  n/N green  i/I cyan  z/Z grey  (EGA)
 *   0-7  shades of the sprite's first ramp (dark to light)
 *   a-h  shades of its second ramp,  A-H  shades of its third
 * A sheet has default ramps; a sprite may name its own: `@forest ramps=forest,grass,earth`.
 */

/** Palette slot no art uses; `Surface.blit` skips it, so black stays drawable. */
export const SPRITE_CLEAR = 255;
export const CLEAR = -1;
export const OWNER = -2;
export const OWNER_DARK = -3;

const FIXED: Record<string, number> = {
  k: C.BLACK!, w: C.WHITE!, r: C.RED!, R: C.LRED!, y: C.YELLOW!, Y: C.BROWN!, u: C.BLUE!, U: C.LBLUE!,
  n: C.GREEN!, N: C.LGREEN!, i: C.CYAN!, I: C.LCYAN!, z: C.DGREY!, Z: C.LGREY!,
};

export interface SpriteDef {
  name: string;
  ramps: string[];
  /** The `ramps=` text as written, kept so the sheet prints back unchanged. */
  declaredRamps: string | null;
  rows: string[];
}

export interface Sheet {
  name: string;
  /** Pixels across a sprite, in the sheet's own (fine) pixels. */
  size: number;
  /** The sheet's pixels across one of the screen's: 2 for terrain, drawn as fine as the screen. */
  k: number;
  defaultRamps: string[];
  /** Comment lines at the top of the text, kept verbatim. */
  comments: string[];
  sprites: SpriteDef[];
  byName: Map<string, SpriteDef>;
}

/** Palette index for a legend character, or CLEAR / OWNER / OWNER_DARK. Throws on anything else. */
export function colourOf(ch: string, ramps: string[]): number {
  if (ch === ".") return CLEAR;
  if (ch === "P") return OWNER;
  if (ch === "p") return OWNER_DARK;
  const fixed = FIXED[ch];
  if (fixed !== undefined) return fixed;
  const pick = (r: number, n: number): number => {
    const ramp = ramps[r];
    if (!ramp) throw new Error(`'${ch}' needs a ramp ${r + 1}, but only ${ramps.length} are named`);
    return shade(ramp, n);
  };
  const code = ch.charCodeAt(0);
  if (ch >= "0" && ch <= "7") return pick(0, code - 48);
  if (ch >= "a" && ch <= "h") return pick(1, code - 97);
  if (ch >= "A" && ch <= "H") return pick(2, code - 65);
  throw new Error(`'${ch}' is not in the sprite legend`);
}

export function parseSheet(name: string, size: number, text: string, defaultRamps: string[], k = 1): Sheet {
  const comments: string[] = [];
  const sprites: SpriteDef[] = [];
  let cur: SpriteDef | null = null;
  text.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trimEnd();
    if (!line) return;
    if (line.startsWith("#")) {
      if (!cur) comments.push(line);
      return;
    }
    if (line.startsWith("@")) {
      const [head, ...opts] = line.slice(1).trim().split(/\s+/);
      if (!head) throw new Error(`${name}: empty sprite name at line ${i + 1}`);
      let declared: string | null = null;
      for (const o of opts) {
        const m = /^ramps=(.+)$/.exec(o);
        if (!m) throw new Error(`${name}/${head}: unknown option "${o}"`);
        declared = m[1]!;
      }
      cur = { name: head, ramps: declared ? declared.split(",") : defaultRamps, declaredRamps: declared, rows: [] };
      sprites.push(cur);
      return;
    }
    if (!cur) throw new Error(`${name}: pixels before the first @sprite (line ${i + 1})`);
    cur.rows.push(line);
  });
  const byName = new Map<string, SpriteDef>();
  for (const s of sprites) {
    if (byName.has(s.name)) throw new Error(`${name}: sprite "${s.name}" appears twice`);
    byName.set(s.name, s);
    if (s.rows.length !== size) throw new Error(`${name}/${s.name}: ${s.rows.length} rows, expected ${size}`);
    s.rows.forEach((row, y) => {
      if (row.length !== size) throw new Error(`${name}/${s.name}: row ${y} is ${row.length} wide, expected ${size}`);
      for (let x = 0; x < size; x++) {
        try { colourOf(row[x]!, s.ramps); } catch (err) { throw new Error(`${name}/${s.name} (${x},${y}): ${(err as Error).message}`); }
      }
    });
  }
  return { name, size, k, defaultRamps, comments, sprites, byName };
}

/** The sprite as palette indices (or CLEAR / OWNER / OWNER_DARK), row-major. */
export function spriteIndices(def: SpriteDef): Int16Array {
  const n = def.rows.length;
  const out = new Int16Array(n * n);
  def.rows.forEach((row, y) => { for (let x = 0; x < n; x++) out[y * n + x] = colourOf(row[x]!, def.ramps); });
  return out;
}

/** The sheet as text: its comments, then each sprite, optionally with replacement rows. */
export function sheetText(sheet: Sheet, rowsByName?: Map<string, string[]>): string {
  const out = [...sheet.comments, ""];
  for (const s of sheet.sprites) {
    out.push(`@${s.name}${s.declaredRamps ? ` ramps=${s.declaredRamps}` : ""}`);
    out.push(...(rowsByName?.get(s.name) ?? s.rows));
    out.push("");
  }
  return out.join("\n");
}

// ---- PNG round trip (pixels only; the tool owns the file format) -----------------

/** Stand-ins for the owner colours in an exported sheet; neither is a palette colour. */
export const OWNER_RGB: Rgb = [255, 0, 255];
export const OWNER_DARK_RGB: Rgb = [128, 0, 128];
export const SHEET_COLUMNS = 8;

export interface RgbaImage {
  width: number;
  height: number;
  /** RGBA, 4 bytes per pixel, row-major. */
  data: Uint8Array;
}

/** All sprites laid out left to right, top to bottom, eight to a row, clear pixels transparent. */
export function sheetImage(sheet: Sheet): RgbaImage {
  const { size } = sheet;
  const width = SHEET_COLUMNS * size;
  const height = Math.max(1, Math.ceil(sheet.sprites.length / SHEET_COLUMNS)) * size;
  const data = new Uint8Array(width * height * 4);
  sheet.sprites.forEach((s, k) => {
    const ox = (k % SHEET_COLUMNS) * size;
    const oy = Math.floor(k / SHEET_COLUMNS) * size;
    const idx = spriteIndices(s);
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        const v = idx[y * size + x]!;
        if (v === CLEAR) continue;
        const rgb = v === OWNER ? OWNER_RGB : v === OWNER_DARK ? OWNER_DARK_RGB : PALETTE[v]!;
        const o = ((oy + y) * width + ox + x) * 4;
        data[o] = rgb[0];
        data[o + 1] = rgb[1];
        data[o + 2] = rgb[2];
        data[o + 3] = 255;
      }
  });
  return { width, height, data };
}

/**
 * Read an edited sheet image back into text. Sprite names and order come
 * from the current sheet; a colour that no legend character of that sprite
 * produces is an error, reported with its position. Where a colour has
 * several characters, the one already in the text is kept.
 */
export function sheetFromImage(sheet: Sheet, img: RgbaImage): string {
  const expected = sheetImage(sheet);
  if (img.width !== expected.width || img.height !== expected.height)
    throw new Error(`${sheet.name}: image is ${img.width}x${img.height}, expected ${expected.width}x${expected.height}`);
  const { size } = sheet;
  const errors: string[] = [];
  const rowsByName = new Map<string, string[]>();
  sheet.sprites.forEach((s, k) => {
    const options = new Map<string, string[]>();
    const add = (ch: string) => {
      let v: number;
      try { v = colourOf(ch, s.ramps); } catch { return; }
      if (v === CLEAR) return;
      const rgb = v === OWNER ? OWNER_RGB : v === OWNER_DARK ? OWNER_DARK_RGB : PALETTE[v]!;
      const key = rgb.join(",");
      const list = options.get(key) ?? [];
      list.push(ch);
      options.set(key, list);
    };
    for (const ch of "01234567abcdefghABCDEFGH") add(ch);
    for (const ch of Object.keys(FIXED)) add(ch);
    add("P");
    add("p");
    const ox = (k % SHEET_COLUMNS) * size;
    const oy = Math.floor(k / SHEET_COLUMNS) * size;
    const rows: string[] = [];
    for (let y = 0; y < size; y++) {
      let row = "";
      for (let x = 0; x < size; x++) {
        const o = ((oy + y) * img.width + ox + x) * 4;
        if (img.data[o + 3]! < 128) { row += "."; continue; }
        const key = `${img.data[o]},${img.data[o + 1]},${img.data[o + 2]}`;
        const chars = options.get(key);
        if (!chars) {
          const hex = [img.data[o]!, img.data[o + 1]!, img.data[o + 2]!].map((c) => c.toString(16).padStart(2, "0")).join("");
          errors.push(`${s.name} (${x},${y}): #${hex} is not in this sprite's palette`);
          row += ".";
          continue;
        }
        const was = s.rows[y]![x]!;
        row += chars.includes(was) ? was : chars[0]!;
      }
      rows.push(row);
    }
    rowsByName.set(s.name, rows);
  });
  if (errors.length) throw new Error(`${sheet.name}: ${errors.length} pixel(s) outside the palette\n  ${errors.slice(0, 12).join("\n  ")}${errors.length > 12 ? "\n  ..." : ""}`);
  return sheetText(sheet, rowsByName);
}
