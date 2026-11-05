/**
 * The unit awaiting orders blinks, as in the original, but smoothly (asked for 2026-11-01, after a fade to 55%, a grey
 * silhouette, a gold contour and a beacon at its feet were each turned down: "revert unit turn indication to the
 * original - opacity on off. just try make transition more smooth from 0% to 100% opacity + subtle glow silhouette
 * around the unit"): it stands `onMs`, fades out over `fadeMs` (eased), is gone `offMs`, and fades back in over
 * `fadeMs`, the whole unit together (its picture, shield and marks); while it shows, a faint gold glow traced round
 * its figure (`ACTIVE_GLOW`, steady). The one place to tune them.
 */
export const ACTIVE_BLINK = { onMs: 380, fadeMs: 220, offMs: 180 };

/** How faint the gold glow round the unit in play is, 0..1 (`MainScreenView.glow`). */
export const ACTIVE_GLOW = 0.5;

/**
 * The arrow at the foot of a long list bobs down and back up (asked for 2026-11-05: "arrow is too bulcky - subtle and add
 * small cycle down-up animation"), the movement catching the eye now that it is small: `fine` fine pixels down at the
 * bottom of a cycle of `ms`. The one place to tune it.
 */
export const MORE_BOB = { ms: 1200, fine: 3 };

/** How many fine pixels below its place the arrow stands at time `ms`: 0 at the top of its cycle, easing down and back. */
export function moreArrowDrop(ms: number): number {
  const at = (Math.max(0, ms) % MORE_BOB.ms) / MORE_BOB.ms;
  return Math.round((0.5 - 0.5 * Math.cos(2 * Math.PI * at)) * MORE_BOB.fine);
}

/** How much of the unit in play shows `ms` after it came into play (or last acted), 0..1: whole then, gone half a blink on. */
export function activeOpacity(ms: number): number {
  const { onMs, fadeMs, offMs } = ACTIVE_BLINK;
  const t = Math.max(0, ms) % (onMs + offMs + 2 * fadeMs);
  const ease = (f: number) => 0.5 - 0.5 * Math.cos(Math.PI * f);
  if (t < onMs) return 1;
  if (t < onMs + fadeMs) return 1 - ease((t - onMs) / fadeMs);
  if (t < onMs + fadeMs + offMs) return 0;
  return ease((t - onMs - fadeMs - offMs) / fadeMs);
}
