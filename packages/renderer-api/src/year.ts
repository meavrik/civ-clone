/**
 * The year counting on as a turn passes (asked for 2026-11-01: "when years pass - show numbers animation passing
 * quickly to new updated year"): the status panel runs through the years between, quickly at first and slowing onto
 * the new one, over `YEAR_COUNT_MS`, lit while it counts (`MainScreenView.year`).
 */
export const YEAR_COUNT_MS = 900;

/** The year shown `t` (0..1) of the way from `from` to `to`, eased out; no year 0 (1 BC is followed by 1 AD). */
export function countedYear(from: number, to: number, t: number): number {
  const k = Math.max(0, Math.min(1, t));
  const eased = 1 - (1 - k) ** 3;
  const across = from < 0 && to > 0 ? 1 : 0;
  const year = from + Math.round((to - from - across) * eased);
  return across && year >= 0 ? year + 1 : year;
}
