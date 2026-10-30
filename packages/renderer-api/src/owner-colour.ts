/**
 * The owner's colour on the user's pictures of units (2026-10-28, with the militia's moves: "Recolour only the
 * magenta clothing, preserving its light and dark shading"). The generated sheets paint whatever shows whose a
 * unit is in magenta, in a smooth run of shades rather than the two the prompt named: on the militia's sheet hue
 * 300-329 at about 99% saturation from value 0.15 to 1, the tunic's lit face near 0.85, and where it meets its
 * outline a dark plum up to hue 335. Skin, wood, leather and brown cloth lie at hue 0-39 and the outlines'
 * dark reds past 340, so a hue range with a floor on saturation takes the clothes and nothing else.
 */
export const OWNER_MAGENTA = {
  /** Hues (degrees) the clothes span, ends included. */
  hue: [288, 336] as const,
  /** Saturation (HSV) under which a pixel is not the clothes (greys, browns, soft blends). */
  saturation: 0.5,
  /** The value (HSV) of the clothes' lit face: it takes the owner's colour as it is. */
  lit: 0.85,
  /** How far toward white the brightest highlights go. */
  shine: 0.5,
};

/** Whether a pixel is the magenta of the clothes. */
export function isOwnerMagenta(r: number, g: number, b: number): boolean {
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  if (max === 0 || d / max < OWNER_MAGENTA.saturation) return false;
  let h: number;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h = (h * 60 + 360) % 360;
  return h >= OWNER_MAGENTA.hue[0] && h <= OWNER_MAGENTA.hue[1];
}

/**
 * Recolour the clothes in RGBA pixels (`data`, in place) to `owner` (r, g, b): each magenta pixel keeps its
 * brightness against the lit face (darker shades the owner's colour darkened as much, brighter ones lifted
 * toward white), its alpha as it was; every other pixel is left alone. Returns how many changed.
 */
export function recolourOwner(data: Uint8ClampedArray | Uint8Array, owner: readonly [number, number, number]): number {
  const { lit, shine } = OWNER_MAGENTA;
  let n = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (!data[i + 3]) continue;
    const r = data[i]!, g = data[i + 1]!, b = data[i + 2]!;
    if (!isOwnerMagenta(r, g, b)) continue;
    const f = Math.max(r, g, b) / 255 / lit;
    for (let c = 0; c < 3; c++) {
      const o = owner[c]!;
      data[i + c] = Math.round(f <= 1 ? o * f : o + (255 - o) * Math.min(1, (f - 1) / (1 / lit - 1)) * shine);
    }
    n++;
  }
  return n;
}
