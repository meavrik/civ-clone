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
  snow: ramp([120, 148, 180], [255, 255, 255], 8),
  swamp: ramp([40, 64, 36], [132, 160, 96], 8),
  jungle: ramp([8, 64, 24], [60, 168, 60], 8),
  flesh: ramp([120, 72, 40], [255, 212, 168], 8),
  ui: ramp([40, 32, 24], [224, 200, 160], 8), // parchment-ish panel ramp
  grey: ramp([16, 16, 16], [240, 240, 240], 8),
  fog: ramp([12, 14, 20], [118, 126, 142], 8), // clouds over unexplored squares
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
// The city view's buildings and sky: warm marble, brick and tile, weathered copper, a day sky.
const BUILT: Record<string, Rgb[]> = {
  marble: ramp([96, 88, 80], [252, 248, 236], 8),
  brick: ramp([64, 20, 14], [236, 140, 96], 8),
  copper: ramp([18, 64, 58], [138, 218, 190], 8),
  sky: ramp([64, 112, 196], [214, 232, 250], 8),
};
for (const [name, colors] of Object.entries(BUILT)) {
  C[name.toUpperCase()] = PALETTE.length;
  PALETTE.push(...colors);
}
// Terrain test (2026-10-21): olive meadow, golden wheat, pale dunes, grey-brown heath, olive
// mire, blue-white ice, a navy sea and leaf greens, picked from the user's reference tiles.
const LAND: Record<string, Rgb[]> = {
  meadow: [[18, 50, 31], [28, 72, 40], [44, 90, 42], [74, 112, 44], [102, 133, 46], [127, 150, 48], [148, 168, 58], [176, 191, 82]],
  leaf: [[6, 20, 15], [10, 42, 29], [12, 73, 42], [14, 90, 46], [21, 110, 43], [42, 138, 48], [79, 162, 51], [124, 188, 64]],
  wheat: [[94, 62, 24], [138, 94, 36], [186, 136, 51], [201, 154, 55], [214, 171, 58], [232, 194, 80], [253, 226, 106], [255, 243, 168]],
  dune: [[110, 72, 38], [153, 103, 52], [189, 135, 61], [207, 154, 70], [225, 177, 75], [240, 200, 94], [253, 217, 110], [255, 240, 180]],
  heath: [[46, 38, 30], [74, 62, 50], [102, 85, 68], [118, 103, 82], [134, 119, 96], [152, 139, 116], [176, 166, 142], [210, 202, 180]],
  mire: [[34, 28, 18], [58, 50, 36], [74, 64, 38], [80, 82, 31], [93, 98, 35], [112, 119, 48], [140, 146, 64], [216, 180, 80]],
  ice: [[2, 58, 138], [3, 91, 197], [41, 134, 228], [90, 168, 250], [140, 196, 253], [188, 220, 253], [230, 243, 254], [255, 255, 255]],
  sea: [[2, 26, 74], [4, 36, 106], [5, 44, 120], [6, 58, 152], [7, 82, 192], [10, 110, 232], [58, 152, 251], [124, 192, 252]],
};
for (const [name, colors] of Object.entries(LAND)) {
  C[name.toUpperCase()] = PALETTE.length;
  PALETTE.push(...colors);
}
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
  return base + Math.max(0, Math.min(7, n));
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
