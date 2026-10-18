import type { GameState } from "@civ/core";
import type { ReportPage } from "@civ/renderer-api";
import { drawText, drawTextCentered, textWidth } from "../font.js";
import { C, shade } from "../palette.js";
import { SCREEN_H, SCREEN_W, Surface } from "../surface.js";
import { DIM, drawPage, drawWindow, FADED, INK } from "../widgets.js";
import { minimapColor, playerColor, slotColor } from "./main.js";

const ROW = 9;

function fit(text: string, width: number): string {
  if (textWidth(text) <= width) return text;
  let t = text;
  while (t.length > 1 && textWidth(`${t}...`) > width) t = t.slice(0, -1);
  return `${t}...`;
}

/** A titled page of rows; a long list flows into two columns. */
export function drawReportScreen(s: Surface, page: ReportPage): void {
  drawPage(s, page.title, page.hint ? `${page.hint}   (any key)` : "(any key)");
  const rows = Math.floor((SCREEN_H - 24 - 26) / ROW);
  const columns = page.lines.length > rows ? 2 : 1;
  const colW = Math.floor((SCREEN_W - 24) / columns);
  page.lines.slice(0, rows * columns).forEach((line, i) => {
    const col = Math.floor(i / rows);
    const x = 12 + col * colW;
    const y = 24 + (i % rows) * ROW;
    const ink = line.dim ? FADED : INK;
    let tx = x;
    if (line.slot !== undefined) {
      s.rect(x, y + 1, 6, 6, slotColor(line.slot));
      s.frame(x, y + 1, 6, 6, C.BLACK!);
      tx += 9;
    }
    const right = line.right ? line.right : "";
    const avail = colW - (tx - x) - 6;
    const leftW = Math.min(textWidth(line.text), right ? Math.floor(avail * 0.55) : avail);
    drawText(s, tx, y, fit(line.text, leftW + 1), ink);
    if (right) {
      const r = fit(right, avail - leftW - 6);
      drawText(s, x + colW - 6 - textWidth(r), y, r, line.dim ? FADED : DIM);
    }
  });
}

/** The whole world at four pixels a square (80x50 fills the screen): terrain, cities, and the units we can see. */
export function drawWorldMap(s: Surface, state: GameState): void {
  const { map } = state;
  const me = state.players[state.currentPlayer]!;
  const k = Math.floor(Math.min(SCREEN_W / map.width, SCREEN_H / map.height));
  const ox = Math.floor((SCREEN_W - map.width * k) / 2);
  const oy = Math.floor((SCREEN_H - map.height * k) / 2);
  s.fill(C.BLACK!);
  for (let y = 0; y < map.height; y++)
    for (let x = 0; x < map.width; x++) {
      if (!me.explored[y * map.width + x]) continue;
      s.rect(ox + x * k, oy + y * k, k, k, minimapColor(map, x, y, me.explored));
    }
  for (const u of state.units) {
    if (!me.visible[u.y * map.width + u.x]) continue;
    const d = Math.max(1, k >> 1);
    s.rect(ox + u.x * k + ((k - d) >> 1), oy + u.y * k + ((k - d) >> 1), d, d, playerColor(state, u.owner));
  }
  for (const c of state.cities) {
    if (!me.explored[c.y * map.width + c.x]) continue;
    s.rect(ox + c.x * k, oy + c.y * k, k, k, playerColor(state, c.owner));
    if (k >= 4) s.rect(ox + c.x * k + 1, oy + c.y * k + 1, k - 2, k - 2, C.WHITE!);
  }
  drawWindow(s, 2, SCREEN_H - 14, 112, 13, "");
  drawText(s, 6, SCREEN_H - 11, "World Map (any key)", INK);
}
