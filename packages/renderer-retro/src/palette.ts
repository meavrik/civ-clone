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
while (PALETTE.length < 256) PALETTE.push([0, 0, 0]);

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
