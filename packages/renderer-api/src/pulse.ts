/**
 * The unit awaiting orders breathes (asked for 2026-11-01: "unit turn indication - make more subtle. no 0
 * opacity"; it had blinked out every 400 ms): its picture fades from whole to `low` and back over `ms`, eased,
 * never gone; its shield and marks stay whole. The one place to tune it.
 */
export const ACTIVE_PULSE = { low: 0.55, ms: 1400 };

/** How much of the unit in play shows `ms` after it came into play (or last acted): 1 then, down to `ACTIVE_PULSE.low` half a breath on. */
export function activePulse(ms: number): number {
  const { low, ms: period } = ACTIVE_PULSE;
  return low + (1 - low) * (0.5 + 0.5 * Math.cos((2 * Math.PI * Math.max(0, ms)) / period));
}
