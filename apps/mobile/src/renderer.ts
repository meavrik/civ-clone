import type { GameState } from "@civ/core";
import type { MainScreenView, Renderer, TextInputState } from "@civ/renderer-api";
import { TILE, unzoomPoint, VIEW_W, VIEW_X, VIEW_Y, zoomedTiles } from "@civ/renderer-retro";
import type * as WebRenderer from "../../web/src/retro-renderer.js";
import { createRetroRenderer as webRenderer } from "../../web/src/retro-renderer.js";
import { MapPan } from "./pan.js";

/**
 * Stands in for apps/web/src/retro-renderer.ts (vite.config.ts swaps it in): the web game's own
 * renderer, with the map drawn and hit-tested where the player's finger has dragged it and as
 * large as a pinch has zoomed it, and what the last frame showed kept for the touch layer.
 */
export const pan = new MapPan();

/** Logical pixels across a map square, unzoomed. */
export const TILE_PX = TILE;

/** The map's zoom levels, whole numbers so the pixels stay square; the level is kept per device. */
export const ZOOMS = [1, 2, 3] as const;
const ZOOM_KEY = "epochs.mobile.zoom";
let zoom: number = (() => {
  try {
    const z = Number(localStorage.getItem(ZOOM_KEY));
    return (ZOOMS as readonly number[]).includes(z) ? z : 1;
  } catch {
    return 1;
  }
})();

export function mapZoom(): number {
  return zoom;
}

/**
 * Zoom the map, the square under logical point `at` (the pinch's middle) staying under it: the
 * view moves by the pan, so the game's own camera never changes for a zoom.
 */
export function setMapZoom(z: number, at: [number, number]): void {
  if (z === zoom) return;
  const ax = Math.max(0, at[0] - VIEW_X) / TILE;
  const ay = Math.max(0, at[1] - VIEW_Y) / TILE;
  pan.grab();
  pan.drag(ax / zoom - ax / z, ay / zoom - ay / z);
  pan.drop();
  zoom = z;
  try { localStorage.setItem(ZOOM_KEY, String(z)); } catch { /* private mode */ }
}

interface Shown {
  renderer?: Renderer;
  state?: GameState;
  /** The game's view of the map, and the view drawn (moved by the pan, zoomed). */
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
    // The squares in view shrink with the zoom, so the game centres and follows its units in what shows.
    get viewTilesX() {
      return Math.floor(VIEW_W / (TILE * zoom));
    },
    get viewTilesY() {
      return zoomedTiles(zoom).y;
    },
    beginFrame() {
      shown.input = undefined;
      r.beginFrame();
    },
    main(state, view) {
      const moved = pan.shift(view, state.map, zoomedTiles(zoom).y, state.activeUnit, performance.now());
      const drawn = zoom > 1 ? { ...moved, zoom } : moved;
      shown.state = state;
      shown.view = view;
      shown.drawn = drawn;
      r.main(state, drawn);
    },
    tileAt(state, view, px, py) {
      const v = view === shown.view && shown.drawn ? shown.drawn : view;
      return r.tileAt(state, v, ...unzoomPoint(v, px, py));
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
  return renderer && state && drawn ? renderer.tileAt(state, drawn, ...unzoomPoint(drawn, px, py)) : null;
}

createRetroRenderer satisfies typeof WebRenderer.createRetroRenderer;
