import { LOADING_TITLE, type LoadingView } from "@civ/renderer-api";
import { drawText, textWidth } from "../font.js";
import { C, shade } from "../palette.js";
import { SCREEN_H, SCREEN_W, type Surface } from "../surface.js";
import { DIM, dimScreen, drawEntering, drawWindow, hideArtUnder, INK, TITLE_H } from "../widgets.js";

/**
 * The window over the screen while a saved game is replayed (asked for 2026-10-28: Continue hung for
 * seconds with no word): the game's stone with its blue title strip, the save as its people and year,
 * a sunken bar filling in the selection's blue as the turns are replayed, the year reached under it.
 * Nothing to press: it goes once the game stands.
 */

type Rect = { x: number; y: number; w: number; h: number };
const WIN = { w: 200, h: 60 };

/** The window, centred on a screen `screenW` wide (the phone's map is wider than 320). */
export function loadingRect(screenW = SCREEN_W): Rect {
  return { x: Math.floor((screenW - WIN.w) / 2), y: Math.floor((SCREEN_H - WIN.h) / 2), ...WIN };
}

export function drawLoading(s: Surface, view: LoadingView): void {
  dimScreen(s);
  const o = loadingRect(s.width);
  hideArtUnder(s, o);
  drawEntering(s, view.enter ?? 1, o, (t) => drawLoadingNow(t, view, o));
}

function drawLoadingNow(s: Surface, view: LoadingView, o: Rect): void {
  // The window on the game, a shadow under it.
  s.rect(o.x + 3, o.y + o.h, o.w, 2, C.BLACK!);
  s.rect(o.x + o.w, o.y + 3, 2, o.h - 1, C.BLACK!);
  drawWindow(s, o.x, o.y, o.w, o.h, LOADING_TITLE, { centred: true });
  const centre = (y: number, text: string, ink: number) => drawText(s, o.x + Math.floor((o.w - textWidth(text)) / 2), y, text, ink);
  const top = o.y + TITLE_H + 6;
  centre(top, view.label, INK);

  // The bar: a sunken well, filled from the left in the selection's blue, lit along its top.
  const bar = { x: o.x + 14, y: top + 13, w: o.w - 28, h: 9 };
  s.rect(bar.x, bar.y, bar.w, bar.h, shade("panel", 1));
  s.hline(bar.x, bar.y, bar.w, shade("panel", 2));
  s.vline(bar.x, bar.y, bar.h, shade("panel", 2));
  s.hline(bar.x, bar.y + bar.h - 1, bar.w, shade("panel", 7));
  s.vline(bar.x + bar.w - 1, bar.y, bar.h, shade("panel", 7));
  const inner = { x: bar.x + 1, y: bar.y + 1, w: bar.w - 2, h: bar.h - 2 };
  const fill = Math.round(inner.w * Math.max(0, Math.min(1, view.done)));
  if (fill > 0) {
    s.rect(inner.x, inner.y, fill, inner.h, shade("azure", 4));
    s.hline(inner.x, inner.y, fill, shade("azure", 6));
    s.hline(inner.x, inner.y + inner.h - 1, fill, shade("azure", 2));
  }

  centre(bar.y + bar.h + 5, view.line, DIM);
}
