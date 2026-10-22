// Draws the portraits sheet: each tribe's leader, 48x48 busts
// in the manner of the terrain and features: two or three flat shades a face, lit from the upper left,
// each part outlined one pixel in the darkest of its own colours, laid back to front so a dark line
// parts them. Each portrait is a shared bust (head, neck, shoulders) with its own skin, hair, beard,
// headgear and dress, so they read as one set; edit the result by hand or as a PNG like any sheet.
// Run from the repo root: npx vite-node --script tools/sprites/draw/portraits.ts
// Rewrites packages/renderer-retro/src/art/portraits.art.ts; the art text stays the source the game reads.
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const N = 48;
type G = string[][];
const blank = (): G => Array.from({ length: N }, () => Array<string>(N).fill("."));
const inGrid = (x: number, y: number) => x >= 0 && y >= 0 && x < N && y < N;

/** A colour as the legend writes it: face, its lit edge, its shaded side, its outline. */
interface Mat { face: string; lit: string; shade: string; line: string }
/** The sprite's ramps: 0-7 skin, a-h hair and beard, A-H the dress. Skin and hair take the portrait's tone. */
const ramp = (base: string, face: number, lit: number, shade: number, line: number): Mat => {
  const c = (n: number) => String.fromCharCode(base.charCodeAt(0) + Math.max(0, Math.min(7, n)));
  return { face: c(face), lit: c(lit), shade: c(shade), line: c(line) };
};
const SKIN_TONES = { light: ramp("0", 6, 7, 4, 2), mid: ramp("0", 5, 6, 3, 1), tan: ramp("0", 3, 4, 2, 0) };
const HAIR_TONES = { dark: ramp("a", 2, 4, 1, 0), mid: ramp("a", 3, 5, 2, 0), light: ramp("a", 5, 7, 4, 2) };
let SKIN: Mat = SKIN_TONES.mid;
let HAIR: Mat = HAIR_TONES.mid;
/** A shade of the skin `d` steps from its face colour. */
const skin = (d: number) => String.fromCharCode(SKIN.face.charCodeAt(0) + d);
const DRESS: Mat = { face: "E", lit: "G", shade: "C", line: "A" };
const DRESS_DARK: Mat = { face: "C", lit: "D", shade: "B", line: "A" };
const GOLD: Mat = { face: "y", lit: "w", shade: "Y", line: "Y" };
const WHITE: Mat = { face: "w", lit: "w", shade: "Z", line: "z" };
const BLACK: Mat = { face: "k", lit: "z", shade: "k", line: "k" };
const STEEL: Mat = { face: "Z", lit: "w", shade: "z", line: "k" };
const RED: Mat = { face: "R", lit: "R", shade: "r", line: "r" };
const BLUE: Mat = { face: "U", lit: "U", shade: "u", line: "u" };
const GREEN: Mat = { face: "N", lit: "N", shade: "n", line: "n" };
const CYAN: Mat = { face: "I", lit: "I", shade: "i", line: "i" };

type Inside = (x: number, y: number) => boolean;

/**
 * A part of the picture: its pixels lit along the upper left, shaded down the right (from `shadeFrom`
 * across, if given) and along the lower right, outlined all round in its darkest colour.
 */
function part(g: G, inside: Inside, m: Mat, shadeFrom = 99): void {
  const at = (x: number, y: number) => inGrid(x, y) && inside(x, y);
  const edge = (x: number, y: number) => at(x, y) && (!at(x - 1, y) || !at(x + 1, y) || !at(x, y - 1) || !at(x, y + 1));
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      if (!at(x, y)) continue;
      let c = m.face;
      if (edge(x, y)) c = m.line;
      else if (x >= shadeFrom || edge(x + 1, y) || edge(x, y + 1)) c = m.shade;
      else if (edge(x - 1, y) || edge(x, y - 1)) c = m.lit;
      g[y]![x] = c;
    }
}
const put = (g: G, x: number, y: number, c: string) => { if (inGrid(x, y)) g[y]![x] = c; };
const ellipse = (cx: number, cy: number, rx: number, ry: number): Inside => (x, y) => ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1;
const rect = (x0: number, y0: number, x1: number, y1: number): Inside => (x, y) => x >= x0 && x <= x1 && y >= y0 && y <= y1;
const or = (...fs: Inside[]): Inside => (x, y) => fs.some((f) => f(x, y));
const and = (...fs: Inside[]): Inside => (x, y) => fs.every((f) => f(x, y));
const not = (f: Inside): Inside => (x, y) => !f(x, y);

// ---- the bust --------------------------------------------------------------------------------------------

const CX = 23.5;
/** The face: an oval narrowing to the chin. */
const face: Inside = (x, y) => {
  const t = (y + 0.5 - 20.5) / 10.5;
  if (t < -1 || t > 1) return false;
  const w = 8 * Math.sqrt(1 - t * t) * (t > 0 ? 1 - 0.22 * t : 1);
  return Math.abs(x + 0.5 - CX) <= w;
};
/** The skull a cap of hair or a hat sits on: the face's top, a little larger. */
const skull = ellipse(CX, 19.5, 9, 11);
/** Shoulders from the neck out to the edges, `wide` more each side for stiff or padded dress. */
const shoulders = (wide = 0): Inside => (x, y) => {
  if (y < 35) return false;
  const hw = Math.min(20 + wide, 8 + (y - 35) * 2.6 + (y > 38 ? wide : 0));
  return Math.abs(x + 0.5 - CX) <= hw;
};

interface Look {
  name: string;
  ramps: [string, string, string];
  skin?: keyof typeof SKIN_TONES;
  hairTone?: keyof typeof HAIR_TONES;
  /** Women: no beard, red lips, a softer brow. */
  woman?: boolean;
  /** Hair: the style of its top, and long hair falling behind. */
  hair: "short" | "receding" | "curly" | "long" | "powdered" | "none";
  beard?: "full" | "long" | "square" | "pharaoh" | "moustache" | "drooping" | "braided" | "stubble";
  hat?: "laurel" | "crown" | "imperial" | "circlet" | "nemes" | "feathers" | "headband" | "helmet" | "mian" | "turban" | "eboshi" | "furhat" | "headring" | "cap" | "skullcap" | "tiara" | "diadem" | "veil";
  dress: "robe" | "toga" | "coat" | "armour" | "fur" | "bare" | "kataginu" | "leopard";
  /** Something over the dress: a fur or ermine collar, a ruff, a broad collar, a necklace, a cravat. */
  collar?: "ermine" | "ruff" | "broad" | "necklace" | "cravat" | "fur" | "bones";
}

function portrait(l: Look): G {
  const g = blank();
  SKIN = SKIN_TONES[l.skin ?? "mid"];
  HAIR = HAIR_TONES[l.hairTone ?? "mid"];
  // Back to front: long hair or a headdress falling behind, the shoulders, the neck, the ears, the face.
  if (l.hair === "long") part(g, and(ellipse(CX, 22, 10.5, 15.5), rect(0, 8, 47, 37)), HAIR, 31);
  if (l.hat === "veil") part(g, or(and(ellipse(CX, 22, 12.5, 18), rect(0, 7, 47, 40))), BLACK);
  if (l.hat === "nemes") {
    part(g, (x, y) => y >= 14 && y <= 38 && Math.abs(x + 0.5 - CX) <= 11 + Math.min(2, (y - 14) / 4) && Math.abs(x + 0.5 - CX) >= 5, GOLD);
    for (let y = 15; y <= 37; y += 3) for (let x = 0; x < N; x++) if (g[y]![x] === "y" || g[y]![x] === "w") g[y]![x] = "u";
  }
  dress(g, l);
  part(g, rect(19, 27, 28, 37), SKIN, 26);
  for (let x = 20; x <= 27; x++) put(g, x, 30, SKIN.shade); // the chin's shadow on the neck
  part(g, or(ellipse(15.6, 21.5, 1.8, 2.8), ellipse(31.4, 21.5, 1.8, 2.8)), SKIN);
  part(g, face, SKIN, 29);
  features(g, l);
  beard(g, l);
  hair(g, l);
  hat(g, l);
  collar(g, l);
  return g;
}

function dress(g: G, l: Look): void {
  switch (l.dress) {
    case "bare":
      part(g, shoulders(), SKIN, 34);
      return;
    case "toga":
      // White wool over the shoulders, the purple-red border falling from the left.
      part(g, shoulders(), DRESS, 34);
      for (let y = 35; y < N; y++) for (let x = 0; x < N; x++) {
        const d = x - (y - 35) * 0.9;
        if (d >= 13 && d <= 15 && shoulders()(x, y)) put(g, x, y, d === 13 ? "r" : "R");
      }
      return;
    case "coat":
      part(g, shoulders(1), DRESS, 34);
      // Lapels: a V from the collar, the waistcoat inside.
      part(g, (x, y) => y >= 36 && Math.abs(x + 0.5 - CX) <= (y - 34) * 0.55, DRESS_DARK);
      return;
    case "armour":
      part(g, shoulders(), RED, 34);
      // A linen cuirass under the red cloak.
      part(g, (x, y) => y >= 37 && Math.abs(x + 0.5 - CX) <= Math.min(12, 6 + (y - 37) * 1.5), WHITE, 30);
      for (const x of [20, 27]) for (let y = 40; y < 46; y++) put(g, x, y, "Z");
      part(g, ellipse(CX, 42, 2, 2), GOLD);
      return;
    case "fur":
      part(g, shoulders(), DRESS, 34);
      return;
    case "leopard":
      part(g, shoulders(), DRESS, 34);
      for (let y = 37; y < N; y += 3) for (let x = 5 + ((y / 3) % 2) * 2; x < 44; x += 4) if (shoulders()(x, y) && shoulders()(x + 1, y + 1)) { put(g, x, y, "k"); put(g, x + 1, y, "k"); }
      return;
    case "kataginu":
      // Stiff winged shoulders over a dark robe, a white collar crossing at the neck.
      part(g, shoulders(3), DRESS, 34);
      part(g, (x, y) => y >= 35 && Math.abs(x + 0.5 - CX) <= 5 - (y - 35) * 0.2 && y <= 42, WHITE);
      part(g, (x, y) => y >= 35 && Math.abs(x + 0.5 - CX) <= 3.2 - (y - 35) * 0.25, RED);
      return;
    default:
      part(g, shoulders(), DRESS, 34);
      // A round neckline showing the robe's darker inside.
      part(g, and(ellipse(CX, 35, 5, 3), rect(0, 35, 47, 47)), DRESS_DARK);
  }
}

function features(g: G, l: Look): void {
  // Brows, eyes (white and pupil, looking ahead), the nose's shadow, the mouth.
  const brow = l.woman ? SKIN.shade : HAIR.line;
  for (const x of [18, 19, 20, 27, 28, 29]) put(g, x, 18, brow);
  if (!l.woman) { put(g, 21, 18, brow); put(g, 26, 18, brow); }
  for (const [w, p] of [[19, 20], [28, 27]] as const) { put(g, w, 20, "w"); put(g, p, 20, "k"); put(g, w, 19, skin(-3)); put(g, p, 19, skin(-3)); }
  put(g, 24, 21, SKIN.shade); put(g, 24, 22, SKIN.shade); put(g, 24, 23, SKIN.shade); put(g, 22, 24, SKIN.shade); put(g, 23, 24, skin(-1)); put(g, 25, 24, skin(-3));
  if (l.woman) { for (const x of [22, 23, 24, 25]) put(g, x, 27, "R"); put(g, 23, 28, "r"); put(g, 24, 28, "r"); }
  else for (const x of [22, 23, 24, 25]) put(g, x, 27, skin(-3));
}

function beard(g: G, l: Look): void {
  const mouth = rect(22, 27, 25, 27);
  const moustache = rect(20, 25, 27, 26);
  switch (l.beard) {
    case "full":
      part(g, or(and(face, rect(0, 24, 47, 47), not(mouth)), and(ellipse(CX, 30, 7.5, 6), rect(0, 28, 47, 47)), and(face, rect(0, 19, 17, 30)), and(face, rect(30, 19, 47, 30)), moustache), HAIR, 29);
      for (const x of [22, 23, 24, 25]) put(g, x, 27, skin(-3));
      return;
    case "long":
      // Flowing to a point, in strands.
      part(g, or(and(face, rect(0, 24, 47, 47), not(mouth)), (x, y) => y >= 26 && y <= 41 && Math.abs(x + 0.5 - CX) <= 7 - Math.max(0, y - 32) * 0.65, and(face, rect(0, 19, 17, 30)), and(face, rect(30, 19, 47, 30)), moustache), HAIR, 29);
      for (let y = 29; y <= 40; y++) for (const x of [20, 23, 26]) if ((y + x) % 3 !== 0 && (g[y]![x] === HAIR.face || g[y]![x] === HAIR.lit)) put(g, x, y, HAIR.shade);
      for (const x of [22, 23, 24, 25]) put(g, x, 27, skin(-3));
      return;
    case "square":
      // Long and squared, in rows of curls.
      part(g, or(and(face, rect(0, 24, 47, 47), not(mouth)), (x, y) => y >= 28 && y <= 40 && Math.abs(x + 0.5 - CX) <= 6.5 - Math.max(0, y - 36) * 0.7, and(face, rect(0, 18, 17, 30)), and(face, rect(30, 18, 47, 30)), moustache), HAIR, 29);
      for (const y of [31, 34, 37]) for (let x = 0; x < N; x++) if (g[y]![x] === HAIR.face || g[y]![x] === HAIR.lit) put(g, x, y, HAIR.shade);
      for (const x of [22, 23, 24, 25]) put(g, x, 27, skin(-3));
      return;
    case "braided":
      part(g, or(and(face, rect(0, 24, 47, 47), not(mouth)), and(ellipse(CX, 30, 7, 5.5), rect(0, 28, 47, 47)), and(face, rect(0, 20, 17, 30)), and(face, rect(30, 20, 47, 30)), moustache), HAIR, 29);
      part(g, or(rect(19, 33, 21, 42), rect(26, 33, 28, 42)), HAIR);
      for (const y of [35, 38, 41]) for (const x of [20, 27]) put(g, x, y, HAIR.shade);
      for (const x of [22, 23, 24, 25]) put(g, x, 27, skin(-3));
      return;
    case "pharaoh":
      part(g, rect(22, 30, 25, 39), BLACK);
      for (const y of [32, 34, 36, 38]) for (const x of [23, 24]) put(g, x, y, "z");
      return;
    case "moustache":
      part(g, or(rect(20, 25, 27, 26), rect(19, 26, 19, 26), rect(28, 26, 28, 26)), HAIR);
      return;
    case "drooping":
      part(g, or(rect(20, 25, 27, 26), rect(19, 26, 19, 31), rect(28, 26, 28, 31)), HAIR);
      part(g, or(rect(23, 29, 24, 35), rect(22, 29, 25, 30)), HAIR);
      return;
    case "stubble":
      for (let y = 24; y < 32; y++) for (let x = 0; x < N; x++) if (face(x, y) && (x + y) % 2 === 0 && g[y]![x] === SKIN.face) put(g, x, y, skin(-1));
      return;
  }
}

function hair(g: G, l: Look): void {
  switch (l.hair) {
    case "short": case "long":
      part(g, and(skull, or(rect(0, 0, 47, 13), rect(0, 0, 16, 19), rect(31, 0, 47, 19))), HAIR, 30);
      return;
    case "receding":
      part(g, and(skull, or(rect(0, 0, 47, 11), rect(0, 0, 16, 19), rect(31, 0, 47, 19)), not(and(ellipse(CX, 13, 5, 3), rect(0, 11, 47, 47)))), HAIR, 30);
      return;
    case "curly": {
      const bumps = [[15, 13], [17, 10], [20, 8.5], [23.5, 8], [27, 8.5], [30, 10], [32, 13], [15, 17], [32, 17]].map(([x, y]) => ellipse(x!, y!, 2.6, 2.6));
      part(g, or(and(skull, or(rect(0, 0, 47, 13), rect(0, 0, 16, 18), rect(31, 0, 47, 18))), ...bumps), HAIR, 30);
      for (const [x, y] of [[17, 11], [21, 9], [25, 9], [29, 11], [16, 15], [31, 15]]) put(g, x!, y!, HAIR.shade);
      return;
    }
    case "powdered":
      // Swept back, rolled over each ear.
      part(g, or(and(skull, or(rect(0, 0, 47, 12), rect(0, 0, 16, 17), rect(31, 0, 47, 17))), ellipse(14.5, 20, 2.6, 3.4), ellipse(32.5, 20, 2.6, 3.4)), HAIR, 31);
      return;
  }
}

function hat(g: G, l: Look): void {
  switch (l.hat) {
    case "laurel":
      for (let i = 0; i < 9; i++) {
        const a = Math.PI * (0.95 + (i / 8) * 1.1);
        const x = CX + Math.cos(a) * 9.2, y = 17 + Math.sin(a) * 7.5;
        part(g, ellipse(x, y, 1.9, 1.3), GREEN);
      }
      return;
    case "crown":
      part(g, or(rect(15, 9, 32, 13), ...[15.5, 20, 23.5, 27, 31.5].map((x) => and(ellipse(x, 9, 1.8, 4), rect(0, 4, 47, 9)))), GOLD, 29);
      put(g, 19, 11, "r"); put(g, 23, 11, "u"); put(g, 24, 11, "u"); put(g, 28, 11, "r");
      return;
    case "imperial":
      part(g, or(rect(15, 8, 32, 13), and(ellipse(CX, 8, 8.5, 6.5), rect(0, 0, 47, 8))), GOLD, 29);
      part(g, ellipse(CX, 7.5, 6, 4.5), RED);
      part(g, or(rect(23, 1, 24, 6), rect(21, 2, 26, 3)), GOLD);
      for (const x of [17, 20, 27, 30]) put(g, x, 10, "u");
      put(g, 23, 10, "R"); put(g, 24, 10, "R");
      return;
    case "circlet":
      part(g, rect(15, 12, 32, 13), GOLD);
      part(g, ellipse(CX, 12.5, 1.6, 1.6), BLUE);
      return;
    case "diadem":
      part(g, rect(15, 12, 32, 13), WHITE);
      part(g, or(rect(12, 13, 14, 17), rect(11, 17, 13, 22)), WHITE);
      return;
    case "nemes":
      // The striped headcloth over the brow, a cobra at its front.
      part(g, and(skull, rect(0, 0, 47, 14)), GOLD, 30);
      for (const y of [10, 13]) for (let x = 0; x < N; x++) if (g[y]![x] === "y" || g[y]![x] === "w") put(g, x, y, "u");
      part(g, rect(14, 13, 33, 14), BLUE);
      part(g, rect(23, 9, 24, 13), GOLD);
      return;
    case "feathers":
      // A fan of long green plumes behind a golden band.
      for (let i = 0; i < 9; i++) {
        const a = Math.PI * (1.1 + (i / 8) * 0.8);
        const x = CX + Math.cos(a) * 15, y = 13 + Math.sin(a) * 12;
        part(g, (px, py) => {
          const t = ((px + 0.5 - CX) * (x - CX) + (py + 0.5 - 13) * (y - 13)) / ((x - CX) ** 2 + (y - 13) ** 2);
          if (t < 0.25 || t > 1) return false;
          const qx = CX + (x - CX) * t, qy = 13 + (y - 13) * t;
          return Math.hypot(px + 0.5 - qx, py + 0.5 - qy) <= 1.2 + t * 1.3;
        }, i % 2 ? GREEN : CYAN);
      }
      part(g, and(skull, rect(0, 6, 47, 14)), RED, 30);
      part(g, rect(14, 11, 33, 14), GOLD);
      for (const x of [17, 21, 26, 30]) put(g, x, 12, "i");
      return;
    case "headband":
      part(g, and(skull, rect(0, 12, 47, 14)), DRESS);
      part(g, or(and(ellipse(33, 6, 1.6, 6), rect(0, 0, 47, 47)), and(ellipse(36, 8, 1.4, 5.5), rect(0, 0, 47, 47))), WHITE);
      put(g, 33, 1, "r"); put(g, 33, 2, "r"); put(g, 36, 3, "r"); put(g, 36, 4, "r");
      return;
    case "helmet":
      part(g, or(and(ellipse(CX, 15, 10, 9), rect(0, 0, 47, 15)), rect(13, 13, 34, 15)), STEEL, 29);
      part(g, rect(23, 13, 24, 23), STEEL);
      part(g, rect(23, 4, 24, 13), STEEL);
      return;
    case "mian":
      // A black cap under a flat board, strings of beads hanging before the face.
      part(g, and(skull, rect(0, 6, 47, 14)), BLACK);
      part(g, rect(9, 3, 38, 5), BLACK);
      for (const x of [11, 14, 17, 30, 33, 36]) for (let y = 6; y <= 13; y += 2) put(g, x, y, y % 4 === 2 ? "R" : "y");
      part(g, rect(14, 12, 33, 13), GOLD);
      return;
    case "turban":
      part(g, or(and(ellipse(CX, 12, 11, 8), rect(0, 0, 47, 15)), rect(13, 12, 34, 15)), DRESS, 29);
      for (let k = 0; k < 4; k++) for (let x = 15; x < 33; x++) { const y = 7 + k * 2 + Math.round((x - 15) * 0.25); if (g[y]?.[x] === "E" || g[y]?.[x] === "G") put(g, x, y, "C"); }
      part(g, ellipse(CX, 11, 2, 2.2), RED);
      put(g, 23, 10, "w");
      part(g, rect(23, 3, 24, 9), WHITE);
      return;
    case "eboshi":
      part(g, or(and(skull, rect(0, 7, 47, 13)), (x, y) => y >= 0 && y <= 9 && x >= 18 + (9 - y) * 0.2 && x <= 29 + (9 - y) * 0.5), BLACK);
      part(g, rect(16, 13, 31, 14), BLACK);
      return;
    case "furhat":
      part(g, and(ellipse(CX, 9, 7.5, 7), rect(0, 0, 47, 11)), RED, 28);
      part(g, rect(23, 0, 24, 3), GOLD);
      part(g, (x, y) => y >= 9 && y <= 14 && Math.abs(x + 0.5 - CX) <= 11.5 - (y === 9 || y === 14 ? 1 : 0), DRESS, 30);
      for (let x = 13; x < 35; x += 3) put(g, x, 10, "C");
      return;
    case "headring":
      part(g, rect(14, 10, 33, 12), BLACK);
      part(g, or(and(ellipse(13, 6, 1.6, 6.5), rect(0, 0, 47, 47))), WHITE);
      put(g, 13, 0, "R"); put(g, 13, 1, "R");
      return;
    case "cap":
      part(g, or(and(ellipse(CX, 11, 9.5, 8), rect(0, 0, 47, 13)), rect(13, 11, 34, 14)), DRESS, 29);
      part(g, rect(13, 12, 34, 14), DRESS_DARK);
      return;
    case "skullcap":
      part(g, and(ellipse(CX, 13, 9.3, 8), rect(0, 0, 47, 13)), RED, 29);
      part(g, rect(14, 12, 33, 13), GOLD);
      return;
    case "tiara":
      // A tall crown with battlements.
      part(g, or(rect(16, 5, 31, 13), ...[16, 20, 24, 28].map((x) => rect(x, 2, x + 2, 5))), GOLD, 28);
      for (const x of [18, 23, 24, 29]) put(g, x, 9, "u");
      part(g, rect(14, 12, 33, 13), GOLD);
      return;
    case "veil":
      part(g, rect(15, 11, 32, 13), GOLD);
      for (const x of [16, 20, 23, 24, 27, 31]) put(g, x, 10, "y");
      put(g, 23, 12, "R"); put(g, 24, 12, "R");
      return;
  }
}

function collar(g: G, l: Look): void {
  switch (l.collar) {
    case "ermine":
      part(g, (x, y) => y >= 35 && y <= 40 && shoulders()(x, y) && Math.abs(x + 0.5 - CX) >= 4, WHITE);
      for (const [x, y] of [[9, 39], [14, 37], [33, 37], [38, 39], [19, 39], [28, 39]]) put(g, x!, y!, "k");
      return;
    case "fur":
      part(g, (x, y) => y >= 34 && y <= 40 && Math.abs(x + 0.5 - CX) <= Math.min(19, 7 + (y - 34) * 3) && (y < 40 || x % 3 !== 0), DRESS_DARK);
      return;
    case "ruff":
      part(g, and(ellipse(CX, 33, 12, 5), not(and(ellipse(CX, 31, 5, 2.5), rect(0, 0, 47, 33)))), WHITE);
      for (let x = 13; x < 35; x += 2) put(g, x, 34, "Z");
      return;
    case "broad":
      // Bands of gold and blue round the neck and over the shoulders.
      for (const [r, m] of [[9, GOLD], [7.5, BLUE], [6, GOLD]] as const) part(g, and(ellipse(CX, 33, r * 1.7, r), rect(0, 33, 47, 47)), m);
      part(g, and(ellipse(CX, 33, 5, 3), rect(0, 33, 47, 47)), SKIN);
      return;
    case "necklace":
      for (let x = 17; x <= 30; x++) { const y = 36 + Math.round(((x + 0.5 - CX) / 7) ** 2 * -2 + 2); put(g, x, y, x % 2 ? "y" : "Y"); }
      put(g, 23, 39, "R"); put(g, 24, 39, "R");
      return;
    case "cravat":
      part(g, or(rect(21, 34, 26, 38), and(ellipse(CX, 39, 2.5, 3), rect(0, 38, 47, 47))), WHITE);
      return;
    case "bones":
      for (let x = 15; x <= 32; x += 2) { const y = 37 + Math.round(Math.abs(x + 0.5 - CX) * -0.15 + 1.5); put(g, x, y, "w"); put(g, x, y + 1, "Z"); }
      return;
  }
}

// ---- the rulers ------------------------------------------------------------------------------------------

const LOOKS: Look[] = [
  // Each tribe's leader (the difficulty levels' rulers are the user's portraits: rulers.ts).
  { name: "caesar", ramps: ["flesh", "earth", "marble"], hair: "receding", hat: "laurel", dress: "toga" },
  { name: "hammurabi", ramps: ["flesh", "earth", "ocean"], skin: "tan", hairTone: "dark", hair: "long", beard: "square", hat: "cap", dress: "robe" },
  { name: "ramesses", ramps: ["flesh", "steel", "wheat"], skin: "tan", hair: "none", beard: "pharaoh", hat: "nemes", dress: "bare", collar: "broad" },
  { name: "alexander", ramps: ["flesh", "sand", "brick"], skin: "light", hair: "curly", hat: "diadem", dress: "armour" },
  { name: "qin_shi_huang", ramps: ["flesh", "steel", "steel"], hair: "short", beard: "drooping", hat: "mian", dress: "robe", collar: "necklace" },
  { name: "ashoka", ramps: ["skin", "steel", "dune"], hair: "short", beard: "moustache", hat: "turban", dress: "robe", collar: "necklace" },
  { name: "montezuma", ramps: ["flesh", "steel", "brick"], skin: "tan", hair: "long", hat: "feathers", dress: "robe", collar: "necklace" },
  { name: "shaka", ramps: ["skin", "steel", "dune"], skin: "tan", hair: "short", hat: "headring", dress: "leopard" },
  { name: "otto", ramps: ["flesh", "hide", "brick"], hair: "long", beard: "full", hat: "crown", dress: "robe", collar: "ermine" },
  { name: "washington", ramps: ["flesh", "grey", "ocean"], skin: "light", hairTone: "light", hair: "powdered", dress: "coat", collar: "cravat" },
  { name: "peter", ramps: ["flesh", "steel", "forest"], hair: "curly", beard: "moustache", dress: "coat", collar: "cravat" },
  { name: "charlemagne", ramps: ["flesh", "grey", "ocean"], hairTone: "light", hair: "long", beard: "long", hat: "crown", dress: "robe", collar: "ermine" },
  { name: "elizabeth", ramps: ["flesh", "brick", "steel"], skin: "light", woman: true, hair: "curly", hat: "circlet", dress: "robe", collar: "ruff" },
  { name: "genghis_khan", ramps: ["flesh", "steel", "hide"], hair: "short", beard: "drooping", hat: "furhat", dress: "fur", collar: "fur" },
  { name: "isabella", ramps: ["flesh", "hide", "brick"], skin: "light", woman: true, hair: "long", hat: "veil", dress: "robe", collar: "necklace" },
  { name: "harald", ramps: ["flesh", "sand", "ocean"], skin: "light", hairTone: "dark", hair: "long", beard: "braided", hat: "helmet", dress: "robe", collar: "fur" },
  { name: "suppiluliuma", ramps: ["flesh", "steel", "dune"], skin: "tan", hair: "long", hat: "skullcap", dress: "robe", collar: "necklace" },
  { name: "cyrus", ramps: ["flesh", "earth", "azure"], skin: "tan", hairTone: "dark", hair: "curly", beard: "square", hat: "tiara", dress: "robe" },
  { name: "david", ramps: ["flesh", "hide", "ocean"], hair: "curly", beard: "full", hat: "crown", dress: "robe" },
  { name: "tokugawa", ramps: ["flesh", "steel", "steel"], hair: "short", beard: "moustache", hat: "eboshi", dress: "kataginu" },
];

const LEGEND = [
  "# Portraits, 48x48: two pixels to each screen pixel (drawn large, one to each). The tribes' leaders",
  "# for the setup, named in lower case (the difficulty levels' rulers are the rulers sheet). Drawn by",
  "# tools/sprites/draw/portraits.ts as a shared bust with its own hair, beard, headgear and dress; edit freely.",
  "# Legend: . clear  0-7 skin (first ramp)  a-h hair and beard (second)  A-H dress (third)",
  "#   y/Y gold  w/Z/z white and greys  k black  r/R red  u/U blue  n/N green  i/I cyan",
];

// As an import would write it (sheetText in an art module), so the file round-trips unchanged.
const sprites = LOOKS.map((l) => `@${l.name} ramps=${l.ramps.join(",")}\n${portrait(l).map((r) => r.join("")).join("\n")}\n`);
const out = `// portraits sprites for the retro renderer. Edit the grids by hand, or export/import a PNG with \`npm run sprites\`.
// Every character must be in the legend described in the comment lines below.
export default String.raw\`
${LEGEND.join("\n")}

${sprites.join("\n")}\`;
`;
const file = resolve(fileURLToPath(import.meta.url), "../../../../packages/renderer-retro/src/art/portraits.art.ts");
writeFileSync(file, out);
console.log(`wrote ${file} (${LOOKS.length} portraits)`);
