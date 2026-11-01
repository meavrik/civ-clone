/**
 * The unit awaiting orders glows: a gold contour traced round its picture (or sprite), breathing between `low` and full
 * over `ms`, eased, never gone; the unit itself, its shield and marks stay as they are. Asked for 2026-11-01, in turn:
 * it blinked out every 400 ms; then faded to 55% and back ("make more subtle. no 0 opacity"); then turned to a grey
 * silhouette ("too subtle now - try something else"); then "still not good - change to glow countor instead". The one
 * place to tune it.
 */
export const ACTIVE_GLOW = { low: 0.4, ms: 1200 };

/** How brightly the unit in play's contour glows `ms` after it came into play (or last acted): 1 then, down to `low` half a breath on. */
export function activeGlow(ms: number): number {
  const { low, ms: period } = ACTIVE_GLOW;
  return low + (1 - low) * (0.5 + 0.5 * Math.cos((2 * Math.PI * Math.max(0, ms)) / period));
}
