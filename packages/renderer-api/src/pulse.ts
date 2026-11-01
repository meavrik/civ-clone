/**
 * The unit awaiting orders (asked for 2026-11-01, in turn: it blinked out every 400 ms; then faded to 55% and back,
 * "make more subtle. no 0 opacity"; then a grey silhouette, "too subtle now"; then a glowing gold contour, "still not
 * good - change to glow countor instead"; then "not noticable at all - add glow noticable animation + subtle unit
 * glow"): a faint gold contour round the unit itself, breathing between `ACTIVE_GLOW.low` and full, and on the ground
 * at its feet a beacon (`activeBeacon`): a pool of gold light and a gold ring, brightening as each breath begins, when
 * a ripple of light leaves the ring and spreads out, fading, over `rippleMs`. The one place to tune them.
 */
export const ACTIVE_GLOW = { low: 0.5, ms: 1400 };

/** How brightly the unit in play's contour glows `ms` after it came into play (or last acted): 1 then, down to `low` half a breath on. */
export function activeGlow(ms: number): number {
  const { low, ms: period } = ACTIVE_GLOW;
  return low + (1 - low) * (0.5 + 0.5 * Math.cos((2 * Math.PI * Math.max(0, ms)) / period));
}

/** The beacon at the unit in play's feet: one breath every `ms` (with the contour's), its ripple taking `rippleMs` to spread and fade. */
export const ACTIVE_BEACON = { ms: ACTIVE_GLOW.ms, rippleMs: 1000 };

export interface Beacon {
  /** How bright the pool and ring are, 0..1: full as a breath begins. */
  pool: number;
  /** How far the ripple has spread, 0 leaving the ring to 1 gone; null between ripples. */
  ripple: number | null;
}

/** The beacon `ms` after the unit came into play (or last acted): a ripple leaves at once, and again every breath. */
export function activeBeacon(ms: number): Beacon {
  const { ms: period, rippleMs } = ACTIVE_BEACON;
  const t = Math.max(0, ms) % period;
  return { pool: 0.5 + 0.5 * Math.cos((2 * Math.PI * t) / period), ripple: t < rippleMs ? t / rippleMs : null };
}
