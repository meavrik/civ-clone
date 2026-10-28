import { formatYear, turnToYear, type ReplayProgress } from "@civ/core";

/**
 * The window over the screen while a saved game is rebuilt (asked for 2026-10-28: Continue hung for
 * seconds with no word of it): a save is its seed and its log, so loading replays every turn, the
 * computer players' too. The web app replays it a slice of each frame (core's `replaySave`) under this
 * window: the save as its people and year, a bar of the turns replayed, and the year reached.
 */
export interface LoadingView {
  /** The save: "Romans, 1200 BC". */
  label: string;
  /** The share of the save's turns replayed, 0..1. */
  done: number;
  /** Under the bar: what is under way. */
  line: string;
  /** 0..1 while the window grows into place (`WINDOW_ENTER_MS`); whole when absent. */
  enter?: number;
}

export const LOADING_TITLE = "Loading game";

/** The window's words and bar for a save (`label`) as far as its replay has come; before the first step, the world being made. */
export function loadingView(label: string, at?: ReplayProgress): LoadingView {
  if (!at) return { label, done: 0, line: "Making the world..." };
  const span = at.to - at.from;
  const done = span > 0 ? Math.max(0, Math.min(1, (at.turn - at.from) / span)) : 1;
  return { label, done, line: `Retracing history: ${formatYear(turnToYear(at.turn))}` };
}
