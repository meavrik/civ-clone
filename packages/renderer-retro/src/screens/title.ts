import { hash, INTRO_MS, introAt, type IntroFrame } from "@civ/renderer-api";
import { drawText, drawTextCentered, FONT_HEIGHT, wrapText } from "../font.js";
import { C, shade } from "../palette.js";
import { SCREEN_H, SCREEN_W, Surface } from "../surface.js";
import { DIM, drawWindow, GOLD, INK } from "../widgets.js";

/**
 * The opening and title, after the original's (asked for 2026-10-22): stars, the world turning
 * in space as it forms (fire, crust, seas, clouds, green land, the lights of towns), a line of
 * story under it (`introAt`), then the name in chiselled gold over the finished planet. `at` is
 * ms since the opening began; from `INTRO_MS` on the title stands complete, the planet still
 * turning. All of it drawn here in the palette, fine pixel by fine pixel; no outside imagery.
 */
export function drawTitleScreen(s: Surface, at = INTRO_MS): void {
  const f = introAt(at);
  s.fill(C.BLACK!);
  drawStars(s, at);
  drawPlanet(s, f);
  if (f.caption) drawCaption(s, f.caption.text, f.caption.fade);
  if (f.name > 0) drawName(s, f.name);
}

// ---- stars ------------------------------------------------------------------------

const STARS = 280;

function drawStars(s: Surface, at: number): void {
  const k = s.k;
  // They come out over the first second.
  const out = Math.min(1, at / 1000);
  const tick = Math.floor(at / 260);
  for (let i = 0; i < STARS; i++) {
    const x = Math.floor(hash(i, 1, 71) * SCREEN_W * k);
    const y = Math.floor(hash(i, 2, 71) * SCREEN_H * k);
    const kind = hash(i, 3, 71);
    if (kind > out + 0.1) continue;
    if (kind < 0.04) {
      // A bright one, twinkling: a small cross.
      const c = hash(i, tick, 72) < 0.25 ? shade("grey", 5) : C.WHITE!;
      s.fset(x, y, c);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) s.fset(x + dx, y + dy, shade("grey", 3));
    } else if (kind < 0.25) s.fset(x, y, hash(i, tick, 73) < 0.08 ? shade("grey", 3) : shade("grey", 6));
    else s.fset(x, y, kind < 0.6 ? shade("grey", 2) : shade("grey", 3));
  }
}

// ---- the planet -------------------------------------------------------------------

/** Where the planet stands, in screen pixels. */
const PLANET = { x: 160, y: 106, r: 62 };
/** Its maps, longitude across and latitude down, wrapping east-west. */
const TW = 384;
const TH = 192;
/** The share of the surface under the seas once they are full. */
const SEA_SHARE = 0.6;
/** Sunlight from the upper left, a little in front: the right limb is in night. */
const SUN = norm(-0.78, -0.34, 0.52);
/** The planet's axis leans this far (radians) toward the right. */
const TILT = 0.38;
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((n) => (n + 0.5) / 16);

function norm(x: number, y: number, z: number): [number, number, number] {
  const l = Math.hypot(x, y, z);
  return [x / l, y / l, z / l];
}

/** The grounds, each a ramp of eight colours (dark to light) in `GROUNDS`. */
const LAVA = 0, CRUST = 1, ROCK = 2, DEEP = 3, SHALLOW = 4, GRASS = 5, FOREST = 6, DESERT = 7, PEAK = 8, ICE = 9, CLOUD = 10;

interface Maps {
  height: Float32Array;
  /** The height below which each hundredth of the surface lies: the seas fill through them. */
  ranks: Float32Array;
  seaLine: number;
  /** Ridges 0..1: the cracks the lava shows through, later the mountain chains. */
  ridge: Float32Array;
  cloud: Float32Array;
  /** The cloud above which 22% of the sky lies: the cover once the air is wet. */
  cloudLine: number;
  /** Per square: the ground life brings it (GRASS, FOREST, DESERT or ICE) and how far life must have
   * spread to reach it (coasts and lowlands first), mountains (PEAK, or ICE where snow-capped; 0 for
   * none), polar ice (1), and a shade of grain (high ground and ridges lighter, hollows darker). */
  biome: Uint8Array;
  late: Float32Array;
  mount: Uint8Array;
  polar: Uint8Array;
  grain: Float32Array;
  /** A town's light: when it comes on (-1 for none) and its colour. */
  town: Float32Array;
  townInk: Uint8Array;
}

let maps: Maps | undefined;

/** 3D value noise on the sphere (no seam, no pinch at the poles), in 0..1. */
function noise3(x: number, y: number, z: number, salt: number): number {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  const tx = x - ix, ty = y - iy, tz = z - iz;
  const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty), sz = tz * tz * (3 - 2 * tz);
  const h = (a: number, b: number, c: number) => hash(ix + a, iy + b, (iz + c) * 7919 + salt);
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  return lerp(
    lerp(lerp(h(0, 0, 0), h(1, 0, 0), sx), lerp(h(0, 1, 0), h(1, 1, 0), sx), sy),
    lerp(lerp(h(0, 0, 1), h(1, 0, 1), sx), lerp(h(0, 1, 1), h(1, 1, 1), sx), sy),
    sz,
  );
}

function fbm(x: number, y: number, z: number, freq: number, octaves: number, salt: number): number {
  let sum = 0, amp = 1, total = 0;
  for (let o = 0; o < octaves; o++) {
    sum += noise3(x * freq + 31, y * freq + 17, z * freq + 5, salt + o) * amp;
    total += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / total;
}

/** The noise under the maps, `rows` made so far: it is made a few rows a frame while only the stars show. */
let noise: { height: Float32Array; ridge: Float32Array; wet: Float32Array; cloud: Float32Array; rows: number } | undefined;

/**
 * The planet's maps, made once: hashed noise, never the game's RNG, so every opening shows the same
 * world. Makes up to `rows` more rows of noise and returns nothing until all of them are made.
 */
function planetMaps(rows = TH): Maps | undefined {
  if (maps) return maps;
  const n = TW * TH;
  noise ??= { height: new Float32Array(n), ridge: new Float32Array(n), wet: new Float32Array(n), cloud: new Float32Array(n), rows: 0 };
  const { height, ridge, wet, cloud } = noise;
  const upTo = Math.min(TH, noise.rows + rows);
  for (let v = noise.rows; v < upTo; v++) {
    const lat = ((v + 0.5) / TH) * Math.PI - Math.PI / 2;
    for (let u = 0; u < TW; u++) {
      const lon = (u / TW) * Math.PI * 2;
      const x = Math.cos(lat) * Math.sin(lon), y = Math.sin(lat), z = Math.cos(lat) * Math.cos(lon);
      const i = v * TW + u;
      height[i] = fbm(x, y, z, 1.7, 5, 11);
      ridge[i] = 1 - Math.abs(fbm(x, y, z, 2.6, 3, 23) * 2 - 1);
      wet[i] = fbm(x, y, z, 2.2, 3, 37);
      // Clouds drawn out a little along the latitudes.
      cloud[i] = fbm(x * 0.8, y * 1.5, z * 0.8, 3, 5, 53);
    }
  }
  noise.rows = upTo;
  if (upTo < TH) return undefined;
  // Rank the heights so the seas, once full, cover SEA_SHARE of the surface whatever the noise gave.
  const sorted = Float32Array.from(height).sort();
  const ranks = Float32Array.from({ length: 101 }, (_, p) => sorted[Math.min(n - 1, Math.floor((n * p) / 100))]!);
  const seaLine = ranks[Math.round(SEA_SHARE * 100)]!;
  const peakLine = sorted[Math.floor(n * 0.96)]!, snowLine = sorted[Math.floor(n * 0.985)]!;
  const cloudLine = Float32Array.from(cloud).sort()[Math.floor(n * 0.78)]!;
  const biome = new Uint8Array(n), late = new Float32Array(n), mount = new Uint8Array(n), polar = new Uint8Array(n);
  const grain = new Float32Array(n), town = new Float32Array(n), townInk = new Uint8Array(n);
  const lights = [C.ORANGE!, C.YELLOW!, shade("wheat", 7)];
  for (let i = 0; i < n; i++) {
    const u = i % TW, v = (i - u) / TW;
    const lat = Math.abs((v + 0.5) / TH - 0.5) * 2; // 0 at the equator, 1 at the poles
    const h = height[i]!, above = h - seaLine, w = wet[i]!;
    biome[i] = lat > 0.82 ? ICE : w < 0.42 && lat > 0.15 && lat < 0.55 ? DESERT : w > 0.53 ? FOREST : GRASS;
    late[i] = Math.min(0.96, Math.max(0, above * 4) + hash(u, v, 81) * 0.25);
    // Mountains in chains along the ridges, the highest snow-capped.
    if (ridge[i]! > 0.93 - Math.min(0.1, Math.max(0, h - peakLine) * 2) && above > 0.04) mount[i] = h > snowLine && ridge[i]! > 0.95 ? ICE : PEAK;
    polar[i] = lat > 0.88 ? 1 : 0;
    grain[i] = (ridge[i]! - 0.55) * 2.2 + above * 3;
    // Towns: sparse squares of land, the lowlands by the sea first.
    town[i] = above > 0 && hash(u, v, 61) < 0.08 ? Math.min(1, above * 5 + hash(i, 3, 62) * 0.5) : -1;
    townInk[i] = lights[hash(u, v, 91) < 0.3 ? 0 : hash(u, v, 92) < 0.5 ? 1 : 2]!;
  }
  maps = { height, ranks, seaLine, ridge, cloud, cloudLine, biome, late, mount, polar, grain, town, townInk };
  noise = undefined;
  return maps;
}

interface Disc {
  /** Per fine pixel inside the planet: its index on the screen, its map row, its longitude in map
   * columns before the turn, the sunlight on it (-1..1) and how near the limb it is (0 at the edge). */
  at: Int32Array;
  row: Int32Array;
  col: Float32Array;
  sun: Float32Array;
  edge: Float32Array;
  /** The fine pixels just outside it, with the sunlight there: the air's glow. */
  halo: Int32Array;
  haloSun: Float32Array;
}

let disc: { k: number; fw: number; d: Disc } | undefined;

function planetDisc(s: Surface): Disc {
  if (disc && disc.k === s.k && disc.fw === s.fw) return disc.d;
  const k = s.k;
  const cx = PLANET.x * k, cy = PLANET.y * k, r = PLANET.r * k;
  const at: number[] = [], row: number[] = [], col: number[] = [], sun: number[] = [], edge: number[] = [];
  const halo: number[] = [], haloSun: number[] = [];
  const cos = Math.cos(TILT), sin = Math.sin(TILT);
  for (let fy = Math.floor(cy - r - 3); fy <= cy + r + 3; fy++) {
    for (let fx = Math.floor(cx - r - 3); fx <= cx + r + 3; fx++) {
      if (fx < 0 || fy < 0 || fx >= s.fw || fy >= s.fh) continue;
      const x = (fx + 0.5 - cx) / r, y = (fy + 0.5 - cy) / r;
      const d2 = x * x + y * y;
      if (d2 > 1) {
        const d = Math.sqrt(d2);
        if (d < 1 + 3 / r) { halo.push(fy * s.fw + fx); haloSun.push((x * SUN[0] + y * SUN[1]) / d); }
        continue;
      }
      const z = Math.sqrt(1 - d2);
      // Into the planet's own frame: undo the lean of its axis, then latitude and longitude.
      const px = x * cos + y * sin, py = -x * sin + y * cos;
      const lat = Math.asin(Math.max(-1, Math.min(1, -py)));
      const lon = Math.atan2(px, z);
      at.push(fy * s.fw + fx);
      row.push(Math.min(TH - 1, Math.max(0, Math.floor(((lat + Math.PI / 2) / Math.PI) * TH))));
      col.push((lon / (Math.PI * 2)) * TW);
      sun.push(x * SUN[0] + y * SUN[1] + z * SUN[2]);
      edge.push(1 - Math.sqrt(d2));
    }
  }
  const d: Disc = {
    at: Int32Array.from(at), row: Int32Array.from(row), col: Float32Array.from(col),
    sun: Float32Array.from(sun), edge: Float32Array.from(edge), halo: Int32Array.from(halo), haloSun: Float32Array.from(haloSun),
  };
  disc = { k: s.k, fw: s.fw, d };
  return d;
}

/** The grounds' ramps, eight colours each in the order of LAVA..CLOUD, picked from the palette's own. */
let grounds: Uint8Array | undefined;
function groundRamps(): Uint8Array {
  grounds ??= Uint8Array.from([
    [shade("hide", 0), shade("brick", 0), shade("brick", 2), C.RED!, shade("brick", 5), C.ORANGE!, C.YELLOW!, shade("sand", 7)], // lava
    [shade("steel", 0), shade("hide", 0), shade("brick", 0), shade("brick", 1), shade("hide", 2), shade("brick", 3), shade("brick", 4), shade("hide", 4)], // hot crust
    [shade("steel", 1), shade("steel", 2), shade("mound", 0), shade("earth", 1), shade("earth", 2), shade("earth", 3), shade("earth", 4), shade("earth", 5)], // bare rock
    [shade("jewel", 0), shade("ocean", 0), shade("ocean", 1), shade("ocean", 2), shade("ocean", 3), shade("ocean", 4), shade("ocean", 5), shade("sea", 3)], // deep sea
    [shade("jewel", 0), shade("ocean", 1), shade("ocean", 3), shade("ocean", 4), shade("sea", 2), shade("ocean", 6), shade("sea", 3), shade("sea", 5)], // shallows
    [shade("steel", 1), shade("leaf", 0), shade("leaf", 1), shade("grass", 0), shade("grass", 2), shade("grass", 3), shade("grass", 5), shade("grass", 6)], // grass
    [shade("steel", 1), shade("leaf", 0), shade("leaf", 1), shade("forest", 1), shade("leaf", 2), shade("forest", 4), shade("leaf", 6), shade("leaf", 7)], // forest
    [shade("steel", 1), shade("mound", 0), shade("dune", 0), shade("dune", 1), shade("dune", 3), shade("dune", 5), shade("dune", 7), shade("sand", 6)], // desert
    [shade("steel", 1), shade("steel", 2), shade("rock", 0), shade("rock", 1), shade("rock", 2), shade("rock", 3), shade("rock", 4), shade("rock", 5)], // mountains
    [shade("steel", 2), shade("steel", 4), shade("ice", 1), shade("ice", 3), shade("ice", 4), shade("ice", 5), shade("ice", 6), shade("ice", 7)], // ice
    [shade("steel", 1), shade("steel", 3), shade("grey", 3), shade("grey", 4), shade("grey", 5), shade("marble", 6), shade("grey", 7), C.WHITE!], // cloud
  ].flat());
  return grounds;
}

function drawPlanet(s: Surface, f: IntroFrame): void {
  // Before the planet shows, its maps are made a few rows a frame; then whatever is left at once.
  const m = planetMaps(f.glow > 0 ? TH : 6);
  if (!m || f.glow <= 0) return;
  const d = planetDisc(s);
  const R = groundRamps();
  const fw = s.fw;
  const data = s.data;
  const turn = (f.spin / (Math.PI * 2)) * TW;
  const drift = turn * 1.15; // the clouds run a little ahead of the ground
  // The seas rise through the heights' ranks, so they spread at an even pace.
  const water = f.sea <= 0 ? -1 : m.ranks[Math.round(f.sea * SEA_SHARE * 100)]!;
  const cloudAt = 1 - (1 - m.cloudLine) * f.clouds;
  const lavaAt = 0.8 + 0.17 * f.cool; // cracks narrow as the crust cools
  const wet = f.clouds > 0.3; // ice once the air carries water
  const night = R[DEEP * 8]!;
  const rim = [shade("ice", 4), shade("ice", 5)];
  for (let i = 0; i < d.at.length; i++) {
    const o = d.at[i]!;
    const fx = o % fw, fy = (o - fx) / fw;
    const dither = BAYER[(fy & 3) * 4 + (fx & 3)]!;
    let u = Math.floor(d.col[i]! + turn) % TW;
    if (u < 0) u += TW;
    const row = d.row[i]!;
    const t = row * TW + u;
    const sun = d.sun[i]!;
    // Light 0..1 with a soft terminator; the whole planet comes up out of the dark with `glow`.
    const light = Math.max(0, Math.min(1, (sun + 0.12) / 0.95)) * f.glow;
    const lvl = Math.min(7, Math.floor(light * 7.4 + dither * 0.9));
    const h = m.height[t]!;
    let c: number;
    let glows = false;
    let cu = Math.floor(d.col[i]! + drift) % TW;
    if (cu < 0) cu += TW;
    const cl = m.cloud[row * TW + cu]!;
    if (f.clouds > 0 && cl > cloudAt + (cl < cloudAt + 0.03 ? dither * 0.03 : 0)) {
      // Clouds over everything once the air is wet.
      c = R[CLOUD * 8 + Math.min(7, lvl + 1)]!;
    } else if (h < water) {
      // The seas, filling from the lowest ground; shallows by the coasts, ice at the poles.
      c = R[(m.polar[t] && wet ? ICE : water - h < 0.025 ? SHALLOW : DEEP) * 8 + lvl]!;
    } else if (f.cool < 1 && m.ridge[t]! > lavaAt) {
      // Lava through the cracks, glowing on the night side too.
      const heat = ((m.ridge[t]! - lavaAt) / (1 - lavaAt)) * (1 - f.cool) * f.glow * 9 + dither;
      glows = heat >= 3;
      c = heat < 1 ? R[CRUST * 8 + lvl]! : R[LAVA * 8 + Math.min(7, Math.floor(heat))]!;
    } else {
      // The crust: hot and red, cooling to bare rock; then life spreads over it from the coasts.
      let g = f.cool < dither ? CRUST : ROCK;
      if (g === ROCK) {
        if (f.life > m.late[t]!) g = m.biome[t]!;
        const peak = m.mount[t]!;
        if (peak) g = peak === ICE && !wet ? PEAK : peak;
        if (m.polar[t] && wet) g = ICE;
      }
      const grain = lvl > 0 ? Math.floor(m.grain[t]! + dither) : 0;
      c = R[g * 8 + Math.max(lvl > 0 ? 1 : 0, Math.min(7, lvl + grain))]!;
      // The lights of towns on the night side.
      const town = m.town[t]!;
      if (light < 0.16 && town >= 0 && f.lights > town) { c = m.townInk[t]!; glows = true; }
    }
    // Night: the dark side keeps only what glows.
    if (light <= 0.02 && !glows) c = night;
    // The air: a thin bright rim on the sunlit limb once there are seas.
    if (f.sea > 0.5 && d.edge[i]! < 0.025 && sun > 0.1) c = rim[dither < 0.5 ? 0 : 1]!;
    data[o] = c;
  }
  // A glow round the sunlit edge: the air (blue), or before it the heat (red).
  const air = [shade("azure", 3), shade("azure", 4), shade("azure", 5)], heat = [shade("brick", 1), shade("brick", 2)];
  for (let i = 0; i < d.halo.length; i++) {
    const lit = d.haloSun[i]! * f.glow;
    if (lit <= 0.15) continue;
    const o = d.halo[i]!;
    const fx = o % fw, fy = (o - fx) / fw;
    if (lit < 0.15 + BAYER[(fy & 3) * 4 + (fx & 3)]! * 0.5) continue;
    data[o] = f.sea > 0.5 ? air[Math.min(2, Math.floor(lit * 3))]! : heat[Math.min(1, Math.floor(lit * 2))]!;
  }
}

// ---- the story and the name ---------------------------------------------------------

/** A caption's colour as it fades: dark grey up to warm white. */
const CAPTION = () => [shade("grey", 1), shade("grey", 3), shade("grey", 5), shade("sand", 5), shade("sand", 7)];

function drawCaption(s: Surface, text: string, fade: number): void {
  const inks = CAPTION();
  const ink = inks[Math.min(inks.length - 1, Math.floor(fade * inks.length))]!;
  const lines = wrapText(text, 290);
  const top = 184 - Math.floor((lines.length * FONT_HEIGHT) / 2);
  lines.forEach((l, i) => drawTextCentered(s, SCREEN_W / 2, top + i * FONT_HEIGHT, l, ink));
}

/**
 * The name's letters: our own blocky capitals with slab serifs, thick downstrokes and thin
 * crossbars, as Roman letters cut in stone. Each '#' is a block of NAME_CELL fine pixels.
 */
const LETTERS: Record<string, string[]> = {
  C: ["..#####", ".##...#", "##.....", "##.....", "##.....", "##.....", "##.....", ".##...#", "..#####"],
  I: ["####", ".##.", ".##.", ".##.", ".##.", ".##.", ".##.", ".##.", "####"],
  V: ["###..###", ".##...#.", ".##...#.", "..##.#..", "..##.#..", "..##.#..", "...###..", "...##...", "...##..."],
  L: ["####...", ".##....", ".##....", ".##....", ".##....", ".##....", ".##...#", ".##..##", "#######"],
  Z: ["#######", "#....##", "....##.", "...##..", "..##...", ".##....", "##.....", "##....#", "#######"],
  A: ["...##...", "..####..", "..#.##..", ".##..##.", ".##..##.", ".######.", "##....##", "##....##", "###..###"],
  T: ["########", "#..##..#", "...##...", "...##...", "...##...", "...##...", "...##...", "...##...", "..####.."],
  O: ["..####..", ".##..##.", "##....##", "##....##", "##....##", "##....##", "##....##", ".##..##.", "..####.."],
  N: ["##...###", ".##...#.", ".###..#.", ".###..#.", ".#.##.#.", ".#..###.", ".#...##.", ".#...##.", "###...##"],
};
const NAME = "CIVILIZATION";
const NAME_CELL = 6;
/** The name's top, in screen pixels. */
const NAME_Y = 11;

/** Gold, dark to light: the outline, the shaded and lit faces. */
const GOLD_RAMP = () => [
  shade("hide", 0), shade("hide", 1), shade("mound", 1), shade("mound", 3), shade("dune", 1), shade("dune", 3),
  shade("wheat", 4), shade("wheat", 7), shade("sand", 7), C.WHITE!,
];

/** The name drawn once as levels of GOLD_RAMP per fine pixel (-1 bare); `name` only darkens them. */
let nameArt: { w: number; h: number; level: Int8Array } | undefined;

function nameLevels(): { w: number; h: number; level: Int8Array } {
  if (nameArt) return nameArt;
  const rows = LETTERS.C!.length;
  const cols = [...NAME].reduce((n, ch) => n + LETTERS[ch]![0]!.length + 1, -1);
  const pad = 2;
  const w = cols * NAME_CELL + pad * 2, h = rows * NAME_CELL + pad * 2;
  const ink = new Uint8Array(w * h);
  let cx = pad;
  for (const ch of NAME) {
    const g = LETTERS[ch]!;
    g.forEach((line, r) => {
      for (let c = 0; c < line.length; c++)
        if (line[c] === "#")
          for (let y = 0; y < NAME_CELL; y++) ink.fill(1, (pad + r * NAME_CELL + y) * w + cx + c * NAME_CELL, (pad + r * NAME_CELL + y) * w + cx + (c + 1) * NAME_CELL);
    });
    cx += (g[0]!.length + 1) * NAME_CELL;
  }
  const on = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && ink[y * w + x] === 1;
  const level = new Int8Array(w * h).fill(-1);
  const top = pad, bottom = pad + rows * NAME_CELL;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!on(x, y)) {
        // A one-pixel outline in the gold's darkest brown, two fine pixels wide (a screen pixel).
        let near = false;
        for (let dy = -2; dy <= 2 && !near; dy++) for (let dx = -2; dx <= 2 && !near; dx++) near = on(x + dx, y + dy);
        if (near) level[y * w + x] = 0;
        continue;
      }
      // Lit from above and the left, shaded below and right; the face a band of gold, bright at
      // the top, deepest past the middle, catching light again at the foot.
      const f = (y - top) / (bottom - top);
      const dither = BAYER[(y & 3) * 4 + (x & 3)]! * 0.9;
      let lv = f < 0.12 ? 8 : f < 0.3 ? 7 + (f < 0.21 ? dither : 0) : f < 0.48 ? 6 + (f < 0.39 ? dither : 0) : f < 0.66 ? 5 : f < 0.82 ? 4 + (f > 0.74 ? dither : 0) : 6;
      if (!on(x, y - 1) || !on(x, y - 2)) lv = 9;
      else if (!on(x - 1, y) || !on(x - 2, y)) lv = 8;
      else if (!on(x, y + 1) || !on(x, y + 2)) lv = 2;
      else if (!on(x + 1, y) || !on(x + 2, y)) lv = 3;
      level[y * w + x] = Math.floor(lv);
    }
  }
  nameArt = { w, h, level };
  return nameArt;
}

function drawName(s: Surface, name: number): void {
  const { w, h, level } = nameLevels();
  const ramp = GOLD_RAMP();
  const x0 = Math.floor((s.fw - w) / 2), y0 = NAME_Y * s.k;
  // Up out of the dark, and a glint sweeping across as it lands.
  const dark = Math.round((1 - name) * 9);
  const glint = name > 0.3 && name < 1 ? -40 + (w + 80) * ((name - 0.3) / 0.7) : -1e9;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const lv = level[y * w + x]!;
      if (lv < 0) continue;
      let l = lv === 0 ? 0 : Math.max(1, lv - dark);
      if (lv > 0 && Math.abs(x + y * 0.7 - glint) < 7) l = Math.min(9, l + 3);
      if (lv === 0 && dark > 6) continue; // the outline last, as the letters show
      s.fset(x0 + x, y0 + y, ramp[l]!);
    }
  }
}

/** End of game: score sheet and rank. */
export function drawEndScreen(s: Surface, lines: string[], rank: string): void {
  s.fill(C.BLACK!);
  drawWindow(s, 30, 24, SCREEN_W - 60, SCREEN_H - 48, "The End", { centred: true });
  let y = 50;
  for (const l of lines) {
    drawText(s, 48, y, l, INK);
    y += 10;
  }
  drawTextCentered(s, SCREEN_W / 2, SCREEN_H - 56, `Your rule was ${rank}.`, GOLD);
  drawTextCentered(s, SCREEN_W / 2, SCREEN_H - 36, "Press any key for a new game", DIM);
}
