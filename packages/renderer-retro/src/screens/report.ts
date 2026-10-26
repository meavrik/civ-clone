import { Terrain, type GameState } from "@civ/core";
import { borderSides, territory, territoryLabels, type ReportPage } from "@civ/renderer-api";
import { drawSpacedRinged, drawText, drawTextCentered, FONT_HEIGHT, spacedWidth, textWidth } from "../font.js";
import { C, mixColor, shade } from "../palette.js";
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

/** How far a civilization's colour tints its land, and its sea, on the world map. */
export const WORLD_TINT = { land: 0.65, sea: 0.4 };

/**
 * The whole world as far as we have explored it, each square as many fine pixels as the screen allows
 * (8 on the original's 80x50, 5 on a medium world, 4 on a large one): terrain; each civilization's land
 * filled with its colour (asked for 2026-10-26: "show borders as filled colors - if possible show civ
 * names"), the land tinted toward it and its sea a little, a line of the colour along the border, and its
 * name over the middle of its biggest piece of land (`territoryLabels`); then the units we see and cities.
 */
export function drawWorldMap(s: Surface, state: GameState): void {
  const { map } = state;
  const me = state.players[state.currentPlayer]!;
  const f = Math.floor(Math.min(s.fw / map.width, s.fh / map.height));
  const ox = Math.floor((s.fw - map.width * f) / 2);
  const oy = Math.floor((s.fh - map.height * f) / 2);
  const terr = territory(state);
  const colors = new Map<number, number>();
  const colorOf = (owner: number): number => {
    let c = colors.get(owner);
    if (c === undefined) colors.set(owner, (c = playerColor(state, owner)));
    return c;
  };
  const explored = (x: number, y: number) => y >= 0 && y < map.height && me.explored[y * map.width + (((x % map.width) + map.width) % map.width)] === 1;
  s.fill(C.BLACK!);
  for (let y = 0; y < map.height; y++)
    for (let x = 0; x < map.width; x++) {
      const i = y * map.width + x;
      if (!me.explored[i]) continue;
      const ground = minimapColor(map, x, y, me.explored);
      const own = terr.owner[i]!;
      const tint = map.tiles[i]!.terrain === Terrain.Ocean ? WORLD_TINT.sea : WORLD_TINT.land;
      s.frect(ox + x * f, oy + y * f, f, f, own < 0 ? ground : mixColor(ground, colorOf(own), tint));
    }
  // Borders after every square: a line of the owner's colour just inside each side where the land
  // beyond is another's or no one's, reaching on round an inner corner (`borderSides`) where that
  // square is explored.
  const line = f >= 5 ? 2 : 1;
  for (let y = 0; y < map.height; y++)
    for (let x = 0; x < map.width; x++) {
      if (!me.explored[y * map.width + x]) continue;
      const sides = borderSides(terr, x, y);
      if (!sides.length) continue;
      const c = colorOf(terr.owner[y * map.width + x]!);
      const fx = ox + x * f;
      const fy = oy + y * f;
      for (const { side, startOut, endOut } of sides) {
        const across = side === 0 || side === 2;
        const a = startOut && (across ? explored(x - 1, y) : explored(x, y - 1)) ? line : 0;
        const b = endOut && (across ? explored(x + 1, y) : explored(x, y + 1)) ? line : 0;
        if (across) s.frect(fx - a, side === 0 ? fy : fy + f - line, f + a + b, line, c);
        else s.frect(side === 3 ? fx : fx + f - line, fy - a, line, f + a + b, c);
      }
    }
  // Units we see: a dot of their colour, ringed in black where there is room; then cities, white in black.
  const dot = Math.max(2, f >> 1);
  for (const u of state.units) {
    if (!me.visible[u.y * map.width + u.x]) continue;
    const ux = ox + u.x * f + ((f - dot) >> 1);
    const uy = oy + u.y * f + ((f - dot) >> 1);
    if (f >= 6) s.frect(ux - 1, uy - 1, dot + 2, dot + 2, C.BLACK!);
    s.frect(ux, uy, dot, dot, colorOf(u.owner));
  }
  const inset = Math.max(1, f >> 2);
  for (const c of state.cities) {
    if (!me.explored[c.y * map.width + c.x]) continue;
    s.frect(ox + c.x * f, oy + c.y * f, f, f, C.BLACK!);
    s.frect(ox + c.x * f + inset, oy + c.y * f + inset, f - 2 * inset, f - 2 * inset, C.WHITE!);
  }
  // Names: each civilization's over its land in its colour, ringed in black, the biggest land first.
  // A name keeps clear of the names already written (and the caption) and, where it can nearby, of
  // the cities: up or down half a line or a line; two lines only when nothing nearer is free of names.
  type Box = { x: number; y: number; w: number; h: number };
  const crosses = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  const caption = { x: 2, y: SCREEN_H - 14, w: 112, h: 13 };
  const names: Box[] = [caption];
  const cities: Box[] = state.cities
    .filter((c) => me.explored[c.y * map.width + c.x])
    .map((c) => ({ x: (ox + c.x * f) / s.k, y: (oy + c.y * f) / s.k, w: f / s.k, h: f / s.k }));
  for (const label of territoryLabels(state, terr)) {
    const name = label.owner === state.barbarians ? "Barbarians" : state.players[label.owner]?.name;
    if (!name || label.squares < 3) continue;
    const w = spacedWidth(name) + 4;
    const h = FONT_HEIGHT + 2;
    const cx = Math.max(w / 2 + 1, Math.min(s.width - w / 2 - 1, (ox + (label.x + 0.5) * f) / s.k));
    const cy = Math.round((oy + (label.y + 0.5) * f) / s.k - FONT_HEIGHT / 2);
    const place = (dy: number): Box => ({ x: cx - w / 2, y: Math.max(1, Math.min(SCREEN_H - h, cy + dy)) - 1, w, h });
    const open = (dys: number[]) => dys.map(place).filter((b) => !names.some((t) => crosses(b, t)));
    const clear = (bs: Box[]) => bs.find((b) => !cities.some((t) => crosses(b, t)));
    const near = open([0, -ROW >> 1, (ROW >> 1) + 1, -ROW, ROW]);
    const far = open([-2 * ROW, 2 * ROW]);
    const box = clear(near) ?? near[0] ?? clear(far) ?? far[0];
    if (!box) continue;
    names.push(box);
    drawSpacedRinged(s, cx, box.y + 1, name, colorOf(label.owner), C.BLACK!);
  }
  drawWindow(s, caption.x, caption.y, caption.w, caption.h, "");
  drawText(s, 6, SCREEN_H - 11, "World Map (any key)", INK);
}
