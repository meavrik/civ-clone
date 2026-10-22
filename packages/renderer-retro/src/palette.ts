/**
 * The game's 256-colour palette. This is our own palette, built in the spirit
 * of 1991 VGA titles: the 16 classic EGA colours first (so UI code can use
 * familiar indices), then hand-picked ramps per terrain family, then a grey
 * ramp. Everything drawn in the game must come from here; the build-time
 * sprite pipeline will reject any other colour.
 *
 * Indices are stable: art and code both reference these by name via `C`.
 */
export type Rgb = readonly [number, number, number];

const EGA: Rgb[] = [
  [0, 0, 0], // 0 black
  [0, 0, 170], // 1 blue
  [0, 170, 0], // 2 green
  [0, 170, 170], // 3 cyan
  [170, 0, 0], // 4 red
  [170, 0, 170], // 5 magenta
  [170, 85, 0], // 6 brown
  [170, 170, 170], // 7 light grey
  [85, 85, 85], // 8 dark grey
  [85, 85, 255], // 9 light blue
  [85, 255, 85], // 10 light green
  [85, 255, 255], // 11 light cyan
  [255, 85, 85], // 12 light red
  [255, 85, 255], // 13 light magenta
  [255, 255, 85], // 14 yellow
  [255, 255, 255], // 15 white
];

function ramp(from: Rgb, to: Rgb, n: number): Rgb[] {
  const out: Rgb[] = [];
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0 : i / (n - 1);
    out.push([
      Math.round(from[0] + (to[0] - from[0]) * t),
      Math.round(from[1] + (to[1] - from[1]) * t),
      Math.round(from[2] + (to[2] - from[2]) * t),
    ]);
  }
  return out;
}

// Each ramp is 8 entries, dark -> light. Base index recorded in `C`.
const RAMPS: Record<string, Rgb[]> = {
  ocean: ramp([0, 28, 92], [40, 120, 200], 8),
  grass: ramp([24, 84, 20], [120, 200, 72], 8),
  plains: ramp([120, 100, 28], [220, 196, 96], 8),
  forest: ramp([8, 48, 16], [56, 128, 48], 8),
  earth: ramp([72, 48, 20], [196, 160, 104], 8), // hills, roads, wood
  stone: ramp([56, 56, 64], [220, 220, 228], 8), // mountains, walls
  sand: ramp([168, 132, 60], [252, 240, 180], 8),
  hide: [[60, 30, 16], [95, 49, 25], [125, 68, 30], [155, 86, 34], [175, 100, 40], [220, 164, 85], [246, 221, 165], [238, 228, 215]], // units: leather, wood, skin, sailcloth; resources: cotton
  mire: [[13, 31, 28], [28, 65, 48], [65, 56, 38], [92, 98, 35], [65, 139, 45], [117, 172, 50], [220, 171, 78], [245, 203, 96]], // swamp: the reference sheet's colours (2026-10-21)
  canopy: [[15, 22, 25], [12, 73, 41], [110, 55, 26], [19, 103, 41], [28, 121, 43], [141, 72, 29], [179, 96, 34], [100, 174, 50]], // jungle
  flesh: ramp([120, 72, 40], [255, 212, 168], 8),
  rock: [[60, 59, 60], [84, 83, 83], [124, 121, 118], [129, 126, 123], [195, 180, 146], [210, 198, 169], [240, 233, 201], [252, 245, 214]], // mountains and their snow
  grey: ramp([16, 16, 16], [240, 240, 240], 8),
  ice: [[4, 94, 200], [16, 113, 215], [42, 135, 228], [88, 171, 251], [137, 195, 253], [159, 204, 252], [194, 225, 253], [230, 242, 254]], // arctic
};

export const PALETTE: Rgb[] = [...EGA];
export const C = {
  BLACK: 0,
  BLUE: 1,
  GREEN: 2,
  CYAN: 3,
  RED: 4,
  MAGENTA: 5,
  BROWN: 6,
  LGREY: 7,
  DGREY: 8,
  LBLUE: 9,
  LGREEN: 10,
  LCYAN: 11,
  LRED: 12,
  LMAGENTA: 13,
  YELLOW: 14,
  WHITE: 15,
} as Record<string, number>;

for (const [name, colors] of Object.entries(RAMPS)) {
  C[name.toUpperCase()] = PALETTE.length;
  PALETTE.push(...colors);
}
// Orange is the one civilization colour the EGA set lacks.
C.ORANGE = PALETTE.length;
PALETTE.push([255, 170, 0]);

// Screen chrome, added after the rest so earlier indices keep their place: the main
// screen's light stone grey and the city screen's bright blue, each speckled by `stipple`
// (face 5, specks 4 and 6, bevel 7 and 2). Not even steps: the face shades sit close
// together so text stays readable over the speckle, and 7 is a pale ink and button face.
const CHROME: Record<string, Rgb[]> = {
  panel: [[24, 24, 32], [64, 64, 76], [108, 108, 118], [140, 140, 148], [170, 170, 176], [184, 184, 190], [200, 200, 204], [244, 244, 240]],
  azure: [[10, 10, 52], [26, 30, 110], [44, 48, 156], [66, 70, 188], [84, 88, 210], [96, 100, 222], [112, 116, 232], [208, 216, 255]],
};
for (const [name, colors] of Object.entries(CHROME)) {
  C[name.toUpperCase()] = PALETTE.length;
  PALETTE.push(...colors);
}
// Deep brown skin for the city screen's citizens, darker than the flesh ramp reaches.
C.SKIN = PALETTE.length;
PALETTE.push(...ramp([52, 30, 20], [136, 86, 56], 8));
// The city view's buildings and sky: warm marble, brick and tile, a day sky; and the colours of the
// map's city icons (the user's sheet, 2026-10-22) that no other ramp holds, in the slots the city
// view's weathered copper had: navy outline, slate blues, red roof tiles, warm plaster. Not a ramp
// from dark to light: the icons name each colour, nothing shades through it.
const BUILT: Record<string, Rgb[]> = {
  marble: ramp([96, 88, 80], [252, 248, 236], 8),
  brick: ramp([64, 20, 14], [236, 140, 96], 8),
  town: [[34, 32, 52], [48, 96, 130], [91, 110, 139], [172, 50, 50], [155, 173, 183], [217, 87, 99], [217, 160, 102], [238, 195, 154]],
  sky: ramp([64, 112, 196], [214, 232, 250], 8),
};
for (const [name, colors] of Object.entries(BUILT)) {
  C[name.toUpperCase()] = PALETTE.length;
  PALETTE.push(...colors);
}
// Terrain (2026-10-21): the rest of the colours fitted to the user's reference sheet, each terrain
// drawing on up to three ramps (mire, canopy, rock and ice took the places of unused ramps above).
const LAND: Record<string, Rgb[]> = {
  meadow: [[31, 74, 41], [36, 79, 42], [74, 70, 42], [96, 117, 44], [120, 143, 43], [122, 147, 44], [124, 149, 46], [127, 150, 49]],
  leaf: [[13, 29, 28], [11, 50, 36], [14, 83, 45], [48, 83, 34], [71, 84, 33], [81, 116, 46], [52, 144, 48], [86, 163, 49]],
  mound: [[64, 51, 39], [123, 61, 28], [96, 78, 49], [160, 80, 33], [138, 104, 59], [137, 128, 51], [153, 118, 63], [211, 167, 74]],
  wheat: [[187, 137, 51], [197, 149, 53], [208, 162, 60], [214, 171, 58], [228, 190, 73], [234, 201, 92], [249, 217, 96], [253, 223, 103]],
  dune: [[152, 102, 52], [162, 109, 55], [191, 137, 63], [206, 152, 70], [223, 175, 74], [229, 183, 84], [238, 195, 95], [253, 217, 110]],
  heath: [[50, 67, 36], [55, 73, 38], [88, 75, 57], [70, 88, 39], [102, 84, 67], [111, 96, 75], [109, 130, 41], [133, 119, 96]],
  sea: [[5, 42, 115], [11, 88, 117], [3, 85, 199], [11, 115, 243], [47, 134, 179], [64, 150, 239], [122, 175, 167], [115, 186, 251]],
  steel: [[5, 6, 10], [12, 13, 19], [38, 37, 37], [73, 75, 62], [84, 89, 102], [114, 133, 156], [150, 158, 168], [188, 185, 181]], // units: outlines, iron, hulls
};
for (const [name, colors] of Object.entries(LAND)) {
  C[name.toUpperCase()] = PALETTE.length;
  PALETTE.push(...colors);
}
/** Ramps shorter than eight colours; `shade` keeps within them. */
const RAMP_SIZE: Record<string, number> = {};
// Resources (2026-10-21): the night blue, jewels and gold of the user's resource icons, in the six
// slots the palette had left (255 stays clear for sprites).
C.JEWEL = PALETTE.length;
PALETTE.push([2, 2, 21], [52, 58, 88], [77, 85, 161], [143, 87, 241], [40, 184, 223], [232, 183, 38]);
RAMP_SIZE.jewel = 6;
if (PALETTE.length > 255) throw new Error(`palette has ${PALETTE.length} colours; 255 is kept clear`);
while (PALETTE.length < 256) PALETTE.push([0, 0, 0]);

/** Palette colour for each colour slot, in CIV_COLORS order: white, green, blue, yellow, cyan, magenta, grey, orange, red. */
export const PLAYER_COLORS = [C.WHITE!, C.LGREEN!, C.LBLUE!, C.YELLOW!, C.LCYAN!, C.LMAGENTA!, C.LGREY!, C.ORANGE!, C.LRED!];
export function slotColor(slot: number): number {
  return PLAYER_COLORS[((slot % PLAYER_COLORS.length) + PLAYER_COLORS.length) % PLAYER_COLORS.length]!;
}

/** Index of shade `n` (0 dark .. 7 light) within a named ramp. */
export function shade(rampName: string, n: number): number {
  const base = C[rampName.toUpperCase()];
  if (base === undefined) throw new Error(`unknown ramp ${rampName}`);
  return base + Math.max(0, Math.min((RAMP_SIZE[rampName.toLowerCase()] ?? 8) - 1, n));
}

/** RGBA lookup table (256*4) for fast framebuffer conversion. */
export const PALETTE_RGBA: Uint8ClampedArray = (() => {
  const t = new Uint8ClampedArray(256 * 4);
  PALETTE.forEach(([r, g, b], i) => {
    t[i * 4] = r;
    t[i * 4 + 1] = g;
    t[i * 4 + 2] = b;
    t[i * 4 + 3] = 255;
  });
  return t;
})();
