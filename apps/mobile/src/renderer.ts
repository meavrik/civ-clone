import type { GameState } from "@civ/core";
import type { MainScreenView, Renderer, TextInputState } from "@civ/renderer-api";
import { TILE } from "@civ/renderer-retro";
import type * as WebRenderer from "../../web/src/retro-renderer.js";
import { createRetroRenderer as webRenderer } from "../../web/src/retro-renderer.js";
import { MapPan } from "./pan.js";

/**
 * Stands in for apps/web/src/retro-renderer.ts (vite.config.ts swaps it in): the web game's own
 * renderer, with the map drawn and hit-tested where the player's finger has dragged it, and what
 * the last frame showed kept for the touch layer.
 */
export const pan = new MapPan();

/** Logical pixels across a map square. */
export const TILE_PX = TILE;

interface Shown {
  renderer?: Renderer;
  state?: GameState;
  /** The game's view of the map, and the view drawn (moved by the pan). */
  view?: MainScreenView;
  drawn?: MainScreenView;
  /** The text the game is asking for, when this frame shows the prompt. */
  input?: TextInputState | undefined;
}

export const shown: Shown = {};

export function createRetroRenderer(canvas: HTMLCanvasElement): Renderer {
  const r = webRenderer(canvas);
  shown.renderer = r;
  return {
    ...r,
    beginFrame() {
      shown.input = undefined;
      r.beginFrame();
    },
    main(state, view) {
      const drawn = pan.shift(view, state.map, r.viewTilesY, state.activeUnit, performance.now());
      shown.state = state;
      shown.view = view;
      shown.drawn = drawn;
      r.main(state, drawn);
    },
    tileAt(state, view, px, py) {
      return r.tileAt(state, view === shown.view && shown.drawn ? shown.drawn : view, px, py);
    },
    textInput(input, cursorOn) {
      shown.input = input;
      r.textInput(input, cursorOn);
    },
  };
}

/** The map square under a logical pixel of the main screen as last drawn, or null. */
export function tileUnder(px: number, py: number): { x: number; y: number } | null {
  const { renderer, state, drawn } = shown;
  return renderer && state && drawn ? renderer.tileAt(state, drawn, px, py) : null;
}

createRetroRenderer satisfies typeof WebRenderer.createRetroRenderer;
