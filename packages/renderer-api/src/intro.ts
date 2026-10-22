/**
 * The opening, as the original's (asked for 2026-10-22): the world seen from space as it forms, a line
 * of story at a time (our own words), then the name over the finished planet, and the title menu. One
 * timeline every renderer reads, in ms from the start; `INTRO_MS` and after, the title stands complete.
 */
export const INTRO_MS = 27500;

/** The story, each line shown from `from` to `to` (ms), fading in and out. */
export const INTRO_CAPTIONS: readonly { from: number; to: number; text: string }[] = [
  { from: 2000, to: 6600, text: "Long ago the young world was fire, turning alone in the dark." },
  { from: 7000, to: 11600, text: "It cooled. Rain fell for an age, and the seas were born." },
  { from: 12000, to: 16000, text: "In the warm shallows, life began." },
  { from: 16400, to: 20600, text: "It crept ashore, and the land turned green." },
  { from: 21000, to: 25600, text: "Then came people. They tamed fire, sowed fields and raised the first towns." },
];

/** A caption fades in and out over this long. */
const FADE_MS = 600;

export interface IntroFrame {
  /** How far each change to the planet has come, 0..1: out of the dark, molten crust cooling, seas
   * filling, clouds, green on the land, the lights of towns on its night side. */
  glow: number;
  cool: number;
  sea: number;
  clouds: number;
  life: number;
  lights: number;
  /** The planet's turn so far, in radians (it keeps turning under the title). */
  spin: number;
  /** The line of story on view, `fade` 0 (gone) .. 1 (full). */
  caption?: { text: string; fade: number };
  /** The name coming up out of the dark, 0..1. */
  name: number;
  /** The opening is over: the title stands complete. */
  done: boolean;
}

/** 0 before `from`, 1 after `to`, eased between. */
function ramp(ms: number, from: number, to: number): number {
  const t = Math.max(0, Math.min(1, (ms - from) / (to - from)));
  return t * t * (3 - 2 * t);
}

/** The opening at `ms` from its start. */
export function introAt(ms: number): IntroFrame {
  const line = INTRO_CAPTIONS.find((c) => ms >= c.from && ms < c.to);
  const fade = line ? Math.min(1, (ms - line.from) / FADE_MS, (line.to - ms) / FADE_MS) : 0;
  return {
    glow: ramp(ms, 1200, 3600),
    cool: ramp(ms, 6800, 9800),
    sea: ramp(ms, 8600, 12200),
    clouds: ramp(ms, 10400, 13600),
    life: ramp(ms, 16400, 20200),
    lights: ramp(ms, 21000, 24200),
    spin: (ms / 60000) * Math.PI * 2,
    ...(line && fade > 0 ? { caption: { text: line.text, fade } } : {}),
    name: ramp(ms, 25200, 27200),
    done: ms >= INTRO_MS,
  };
}
