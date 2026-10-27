import { unitType } from "@civ/core";

/**
 * A ship of the viewer's going down (asked for 2026-10-27: "when ship sinks - show it sinking in water -
 * with message above it"): a Trireme left on deep water as the turn ends (core `sinkingShips`), shown
 * before the turn passes, while it still stands on its square. Renderers draw the ship, its cargo with
 * it, listing, then slipping under the waterline as it tips, foam where the hull meets the water, rings
 * and bubbles after, and `text` above the square (`MainScreenView.sinking`).
 */
export interface Sinking {
  /** The ship: it and the units aboard are drawn here, not on their square. */
  unit: number;
  x: number;
  y: number;
  type: string;
  owner: number;
  /** A second shield behind the ship's: it carries units. */
  stacked: boolean;
  /** 0 as it starts to list, 1 as the last ring fades. */
  t: number;
  /** Words above the square (`sinkingWords`). */
  text: string;
}

/** "Our Trireme sinks in deep water!", naming up to two units aboard ("with the Settlers aboard"), else counting them. */
export function sinkingWords(type: string, aboard: readonly string[]): string {
  const ship = unitType(type).name;
  if (!aboard.length) return `Our ${ship} sinks in deep water!`;
  const names = aboard.map((t) => unitType(t).name);
  const who = names.length <= 2 ? `the ${names.join(" and the ")}` : `all ${names.length} units`;
  return `Our ${ship} sinks in deep water, with ${who} aboard!`;
}
