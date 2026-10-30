import { sequenceStep, UNIT_ANIMS } from "./unit-anim.js";
import { UNIT_ATLASES } from "./unit-atlas.js";

/**
 * A city founded by the viewer, made a moment of its own (asked for 2026-10-29: "for new settlement epic effect - add
 * zoom and some effect and delay to let the player see the new settlement establishment"): the view glides in on the
 * city as dusk falls round it, the founders' show plays on its square (their rule's `found`, an atlas with a `show`:
 * the settlers raise their flag), light breaks behind the flag once it unfurls and sparks rise, and the city's name
 * stands under them a while before the game goes on. `foundingMoment` is that timeline, read by the web app each frame
 * (`MainScreenView.founding`) and drawn by the renderers; everything to tune is in `FOUNDING`.
 */
export const FOUNDING = {
  /** The view's glide in, and dusk's fall, eased. */
  zoomMs: 900,
  /** How much closer the view draws the city once it has glided in, against the map at 1x (never less than the player's own zoom). */
  zoom: 4,
  /** The show starts this far in, the glide mostly done. */
  leadMs: 500,
  /** The show's step from which the light breaks behind the flag (it unfurls), and the one from which the city's name stands (the cheer). */
  gloryStep: 3,
  titleStep: 5,
  /** How long the light and the name take to come up. */
  riseMs: 600,
  /** How long the last frame holds once the show is over. */
  holdMs: 2000,
  /** A key or click cuts it short only after this. */
  skipAfterMs: 600,
} as const;

/** Where the founding stands `ms` into it. */
export interface FoundingMoment {
  /** The show's frame (of its atlas). */
  frame: number;
  /** How far the view has glided in and dusk fallen, 0..1. */
  zoom: number;
  /** The light behind the flag and the rising sparks, 0..1. */
  glory: number;
  /** The city's name, 0..1. */
  title: number;
  /** Over: the city stands and the game goes on. */
  done: boolean;
}

/** The show played where a unit of `type` founds a city: its atlas's name, and how long the whole moment lasts; null when it has none. */
export function foundingShow(type: string): { id: string; ms: number } | null {
  const id = UNIT_ANIMS[type]?.found;
  const show = id ? UNIT_ANIMS[id]?.show : undefined;
  return id && show && UNIT_ATLASES[id] ? { id, ms: FOUNDING.leadMs + show.ms.reduce((a, b) => a + b, 0) + FOUNDING.holdMs } : null;
}

/** The founding of show `id` (an atlas with a `show`) `ms` into it. */
export function foundingMoment(id: string, ms: number): FoundingMoment {
  const rule = UNIT_ANIMS[id];
  const show = rule?.show;
  const clamp = (u: number) => Math.max(0, Math.min(1, u));
  const zoom = 1 - (1 - clamp(ms / FOUNDING.zoomMs)) ** 3;
  if (!show) return { frame: rule?.idle ?? 0, zoom, glory: 0, title: 0, done: ms >= FOUNDING.zoomMs + FOUNDING.holdMs };
  const t = ms - FOUNDING.leadMs;
  const frame = show.frames[sequenceStep(show.ms, Math.max(0, t), false).step]!;
  // When step `n` of the show begins.
  const from = (n: number) => FOUNDING.leadMs + show.ms.slice(0, n).reduce((a, b) => a + b, 0);
  const rise = (n: number) => clamp((ms - from(n)) / FOUNDING.riseMs);
  const total = from(show.ms.length) + FOUNDING.holdMs;
  return { frame, zoom, glory: rise(FOUNDING.gloryStep), title: rise(FOUNDING.titleStep), done: ms >= total };
}
