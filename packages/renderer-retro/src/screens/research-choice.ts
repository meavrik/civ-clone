import { advance, type GameState } from "@civ/core";
import {
  researchOutlook,
  researchRows,
  researchTitle,
  techDetails,
  techGainLines,
  techStatus,
  type ResearchHit,
  type ResearchView,
} from "@civ/renderer-api";
import { drawText, FONT_HEIGHT, textWidth } from "../font.js";
import { drawIcon, drawIconsWrapped, drawMark, wrapIcons } from "../icons.js";
import { C, shade } from "../palette.js";
import { SCREEN_H, SCREEN_W, type Surface } from "../surface.js";
import { dimScreen, drawBox, hideArtUnder } from "../widgets.js";
import { drawGiftFrame, giftFrames, GIFT_FRAME_H } from "./gift-frames.js";
import { drawModalFrame, drawModalPanel, drawModalTitle, drawWindowButton, fitText } from "./newtech.js";

/**
 * The research window, where research is picked (asked for 2026-11-03: "too big. minimize", "a shorter list to
 * choose from without more options", "rethink it all"; the user picked rows of this layout from three): the New
 * Technology window's parchment and gold, its navy title strip, and under it a row for each of the few advances on
 * offer (`researchRows` brief: the research under way, then those `choiceScore` ranks first). Each row has the
 * advance's name and the turns it takes, what it brings framed with names on badges (`giftFrames`) and the rest a
 * line each (`techGainLines`; an advance that brings nothing says what it leads to), and its own Research button;
 * the research under way shows its beakers there instead. A click on a row selects it (its button lit), Up/Down and
 * Tab move, Enter or a button researches. No way from here to more choices: the whole panel is View Tech Tree's.
 */

type Rect = { x: number; y: number; w: number; h: number };
const at = (o: Rect, x: number, y: number, w: number, h: number): Rect => ({ x: o.x + x, y: o.y + y, w, h });

const W = 268;
const ROW_H = GIFT_FRAME_H + 4;
/** The name and turns, at the left of a row. */
const NAME_W = 66;
const BUTTON_W = 42;
const BUTTON_H = 13;
const TOP = 19;

// The New Technology window's parchment, gold and brown ink.
const BROWN = () => shade("hide", 0);
const BROWN_DIM = () => shade("hide", 3);
const GOLD_DARK = () => shade("wheat", 0);
const GOLD_LIGHT = () => shade("wheat", 4);
const LIT = () => shade("hide", 6);

interface ChoiceRow { id: string; box: Rect; button: Rect | null }
interface ChoiceLayout { o: Rect; title: Rect; close: Rect | null; panel: Rect; rows: ChoiceRow[] }

/** Where everything stands: the window as tall as its rows, centred on a screen `screenW` wide. */
function choiceLayout(state: GameState, view: ResearchView, screenW: number): ChoiceLayout {
  const ids = researchRows(state, view).flatMap((r) => (r.kind === "advance" ? [r.id] : []));
  const n = Math.max(1, ids.length);
  const panelH = n * ROW_H + (n - 1) + 2;
  const h = TOP + panelH + 5;
  const o = { x: Math.floor((screenW - W) / 2), y: Math.floor((SCREEN_H - h) / 2), w: W, h };
  const panel = at(o, 5, TOP, W - 10, panelH);
  const rows = ids.map((id, i): ChoiceRow => {
    const box = { x: panel.x + 1, y: panel.y + 1 + i * (ROW_H + 1), w: panel.w - 2, h: ROW_H };
    const offered = view.choosing && techStatus(state, id) === "available";
    return { id, box, button: offered ? { x: box.x + box.w - 4 - BUTTON_W, y: box.y + Math.floor((ROW_H - BUTTON_H) / 2), w: BUTTON_W, h: BUTTON_H } : null };
  });
  return { o, title: at(o, 3, 3, W - 6, 13), close: view.closable ? at(o, W - 15, 5, 9, 9) : null, panel, rows };
}

export function drawResearchChoice(s: Surface, state: GameState, view: ResearchView): void {
  const L = choiceLayout(state, view, s.width);
  dimScreen(s);
  hideArtUnder(s, L.o);
  drawModalFrame(s, L.o);
  drawModalTitle(s, L, "bulb", researchTitle(state, view));
  drawModalPanel(s, L.panel);
  if (!L.rows.length) {
    const text = "Nothing left to research.";
    drawText(s, L.panel.x + Math.floor((L.panel.w - textWidth(text)) / 2), L.panel.y + Math.floor((L.panel.h - FONT_HEIGHT) / 2), text, BROWN());
    return;
  }
  L.rows.forEach((r, i) => {
    if (i > 0) s.hline(L.panel.x + 3, r.box.y - 1, L.panel.w - 6, BROWN_DIM());
    drawRow(s, state, view, r);
  });
}

function drawRow(s: Surface, state: GameState, view: ResearchView, r: ChoiceRow): void {
  const { box } = r;
  const selected = r.id === view.selected;
  const status = techStatus(state, r.id);
  const d = techDetails(state, r.id);
  // The row picked: a deeper parchment ringed in gold (a gold fill swallowed the wonders' gold frames).
  if (selected) {
    s.rect(box.x + 1, box.y + 1, box.w - 2, box.h - 2, LIT());
    s.frame(box.x, box.y, box.w, box.h, GOLD_DARK());
    s.frame(box.x + 1, box.y + 1, box.w - 2, box.h - 2, GOLD_LIGHT());
  }
  // The name, its mark before it (the bulb for the research under way, the diamond for what the latest find
  // brought within reach), and the turns under it.
  const x = box.x + 5;
  const nameY = box.y + Math.floor(ROW_H / 2) - FONT_HEIGHT - 1;
  if (status === "researching") drawIcon(s, "bulb", x, nameY);
  else if (advance(r.id).requires.some((q) => view.discovered.includes(q))) drawMark(s, "new", x * 2 + 2, nameY * 2 + 2);
  drawText(s, x + 10, nameY, fitText(advance(r.id).name, NAME_W - 10), BROWN());
  const o = researchOutlook(state);
  const turns = o.turns === null ? "no science yet" : `${o.turns} turn${o.turns === 1 ? "" : "s"}${status === "researching" ? " left" : ""}`;
  drawText(s, x + 10, nameY + FONT_HEIGHT + 1, turns, BROWN_DIM());

  // What it brings, framed, then the rest a line each where room is left.
  const gx = x + NAME_W;
  const end = box.x + box.w - 4 - BUTTON_W - 6;
  const frames = giftFrames(d.gifts, gx, box.y + 2, end - gx);
  for (const f of frames) drawGiftFrame(s, state, f);
  const last = frames[frames.length - 1];
  const tx = last ? last.x + last.w + 5 : gx;
  let lines = techGainLines(d);
  if (!d.gifts.length && !lines.length) lines = [d.opens.length ? `Leads to ${d.opens.map((n) => n.name).join(", ")}` : "Nothing of its own"];
  if (end - tx >= 40) {
    const wrapped = lines.flatMap((l) => wrapIcons(l, end - tx)).slice(0, 3);
    let ty = box.y + Math.floor((ROW_H - wrapped.length * 9) / 2) + 1;
    for (const l of wrapped) ty += drawIconsWrapped(s, tx, ty, end - tx, l, BROWN(), 1) * 9;
  }

  // Its button, or the beakers of the research under way.
  if (r.button) drawWindowButton(s, r.button, "Research", selected);
  else if (status === "researching") {
    const bx = box.x + box.w - 4 - BUTTON_W;
    const by = box.y + Math.floor(ROW_H / 2);
    drawText(s, bx + Math.floor((BUTTON_W - textWidth("Under way")) / 2), by - FONT_HEIGHT - 1, "Under way", BROWN_DIM());
    drawBox(s, bx, by + 1, BUTTON_W, 6, o.have, o.cost, C.LCYAN!);
  }
}

/** What lies under a point of the window on a screen `screenW` wide: a row's button, a row, the close box. */
export function researchChoiceHit(state: GameState, view: ResearchView, px: number, py: number, screenW = SCREEN_W): ResearchHit | null {
  const L = choiceLayout(state, view, screenW);
  const inside = (b: Rect) => px >= b.x && px < b.x + b.w && py >= b.y && py < b.y + b.h;
  if (L.close && px >= L.close.x - 3 && px < L.close.x + L.close.w + 3 && py >= L.title.y && py < L.title.y + L.title.h) return { kind: "close" };
  for (const r of L.rows) {
    if (r.button && inside(r.button)) return { kind: "research", id: r.id };
    if (inside(r.box)) return { kind: "row", id: r.id };
  }
  return null;
}
