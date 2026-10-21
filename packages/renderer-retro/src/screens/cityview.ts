import { BUILDINGS, formatYear, Terrain, turnToYear, WONDERS, type GameState } from "@civ/core";
import { cityScene, CLOUD_PUFFS, hash, sceneItemAt, type CityScene, type CityViewState } from "@civ/renderer-api";
import { drawText, drawTextCentered, textWidth } from "../font.js";
import { C, shade } from "../palette.js";
import { drawPicture } from "../pictures.js";
import { SCREEN_H, SCREEN_W, Surface } from "../surface.js";
import { DIM, drawStone, drawWindow, INK } from "../widgets.js";
import { playerColor } from "./main.js";

/**
 * The city view (320x200): the city as a picture under a day sky, inside a stone window, with
 * a bar along the bottom that names the building last clicked. Any other click, or a key, goes
 * back to the city screen.
 */
export const SCENE_X = 2;
export const SCENE_Y = 13;
const BAR_Y = 188;
const BACK = { x: SCREEN_W - 34, y: BAR_Y + 1, w: 33, h: 11 };

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const bayer = (x: number, y: number) => BAYER[(y & 3) * 4 + (x & 3)]! / 16;

/** Each kind of ground as a ramp and a shade. */
const GROUND: Record<Terrain, [string, number]> = {
  [Terrain.Ocean]: ["ocean", 4],
  [Terrain.Grassland]: ["grass", 4],
  [Terrain.Plains]: ["plains", 4],
  [Terrain.Forest]: ["forest", 5],
  [Terrain.Hills]: ["earth", 5],
  [Terrain.Mountains]: ["stone", 4],
  [Terrain.Desert]: ["sand", 5],
  [Terrain.Tundra]: ["earth", 4],
  [Terrain.Arctic]: ["ice", 6],
  [Terrain.Swamp]: ["grass", 2],
  [Terrain.Jungle]: ["forest", 4],
};

function inside(pts: number[], x: number, y: number): boolean {
  let hit = false;
  for (let i = 0, j = pts.length - 2; i < pts.length; j = i, i += 2) {
    const xi = pts[i]!, yi = pts[i + 1]!, xj = pts[j]!, yj = pts[j + 1]!;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

/** Fills a polygon of the scene, colouring each pixel with `paint(x, y)` (scene coordinates). */
function fillPoly(s: Surface, pts: number[], paint: (x: number, y: number) => number): void {
  const xs = pts.filter((_, i) => i % 2 === 0);
  const ys = pts.filter((_, i) => i % 2 === 1);
  for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y++)
    for (let x = Math.floor(Math.min(...xs)); x <= Math.ceil(Math.max(...xs)); x++)
      if (inside(pts, x + 0.5, y + 0.5)) s.set(SCENE_X + x, SCENE_Y + y, paint(x, y));
}

function fillOval(s: Surface, cx: number, cy: number, rx: number, ry: number, paint: (x: number, y: number) => number, top = false): void {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = (x + 0.5 - cx) / rx;
      const dy = (y + 0.5 - cy) / ry;
      if (dx * dx + dy * dy <= 1 && (!top || y + 0.5 <= cy)) s.set(SCENE_X + x, SCENE_Y + y, paint(x, y));
    }
}

/** Sky, land, the far country, the river and the streets: everything but the buildings. */
function drawLand(s: Surface, scene: CityScene, salt: number): void {
  const { w, h, horizon } = scene;
  // A day sky, deeper overhead, dithered toward the pale horizon, and a few clouds.
  for (let y = 0; y < horizon; y++)
    for (let x = 0; x < w; x++) s.set(SCENE_X + x, SCENE_Y + y, shade("sky", Math.min(7, Math.floor(2 + (5 * y) / horizon + bayer(x, y)))));
  for (const { x: cx, y: cy } of scene.clouds)
    for (const [ox, oy, r] of CLOUD_PUFFS) fillOval(s, cx + ox, cy + oy, r * 1.4, r * 0.8, (_, y) => (y > cy + 1 ? shade("sky", 6) : shade("marble", 7)));
  // The ground, hazy toward the horizon, speckled.
  const [ramp, base] = GROUND[scene.ground];
  for (let y = horizon; y < h; y++)
    for (let x = 0; x < w; x++) {
      const haze = y - horizon < 8 + bayer(x, y) * 6 ? 1 : 0;
      const r = hash(x, y, salt);
      s.set(SCENE_X + x, SCENE_Y + y, shade(ramp, base + haze + (r < 0.07 ? -1 : r > 0.95 ? 1 : 0)));
    }
  // Other country out to the horizon: the sea, sand, snow, marsh.
  for (const p of scene.patches) {
    const [pr, pb] = GROUND[p.terrain];
    fillPoly(s, p.pts, (x, y) => {
      if (p.terrain === Terrain.Ocean) return shade("ocean", (x + y * 3) % 11 === 0 ? 6 : y - horizon < 3 ? 5 : 4);
      return shade(pr, pb + (hash(x, y, salt) < 0.08 ? -1 : 0) + (y - horizon < 5 ? 1 : 0));
    });
  }
  for (const k of scene.knolls) {
    if (k.kind === "mountain") {
      const peak = horizon - k.h;
      fillPoly(s, [k.x - k.w / 2, horizon, k.x, peak, k.x + k.w / 2, horizon], (x, y) =>
        y < peak + k.h * 0.3 + bayer(x, y) * 2 ? shade("rock", x < k.x ? 7 : 5) : shade("stone", x < k.x ? 4 : 2));
    } else if (k.kind === "hill") {
      fillOval(s, k.x, horizon + 1, k.w / 2, k.h, (x) => shade("grass", x < k.x - k.w / 6 ? 4 : 3), true);
    } else {
      fillOval(s, k.x, horizon - k.h / 2 + 1, k.w / 2, k.h / 2 + 0.5, (x, y) => shade("forest", x < k.x && y < horizon - k.h / 2 ? 5 : 3));
    }
  }
  if (scene.river) {
    const pts = scene.river;
    for (let i = 0; i + 3 < pts.length; i += 2) {
      const [x0, y0, x1, y1] = [pts[i]!, pts[i + 1]!, pts[i + 2]!, pts[i + 3]!];
      for (let t = 0; t <= 1; t += 0.05) {
        const x = Math.round(x0 + (x1 - x0) * t);
        const y = Math.round(y0 + (y1 - y0) * t);
        for (let dy = -1; dy <= 2; dy++) for (let dx = 0; dx < 2; dx++) s.set(SCENE_X + x + dx, SCENE_Y + y + dy, shade("ocean", dy === -1 ? 3 : dy === 0 ? 6 : 4));
      }
    }
  }
  for (const st of scene.streets)
    for (let dy = 0; dy < 3; dy++)
      for (let x = st.x0; x < st.x1; x++) {
        const y = st.y + dy;
        const c = st.surface === "asphalt" ? (dy === 1 && x % 8 < 4 ? shade("grey", 6) : shade("grey", 2))
          : st.surface === "stone" ? shade("stone", (x + dy * 2) % 4 === 0 ? 3 : 5)
          : shade("earth", hash(x, y, salt) < 0.15 ? 3 : dy === 0 ? 5 : 4);
        s.set(SCENE_X + x, SCENE_Y + y, c);
      }
}

/** The name and line of text of an improvement or wonder. */
function about(id: string): { name: string; text: string } | null {
  return BUILDINGS.find((b) => b.id === id) ?? WONDERS.find((w) => w.id === id) ?? null;
}

export function drawCityView(s: Surface, state: GameState, view: CityViewState): void {
  const city = state.cities.find((c) => c.id === view.city);
  if (!city) return;
  s.fill(C.BLACK!);
  drawWindow(s, 0, 0, SCREEN_W, BAR_Y, `${city.name} (Pop ${city.size})   ${formatYear(turnToYear(state.turn))}`, { centred: true });
  const scene = cityScene(state, city);
  drawLand(s, scene, city.id * 7919);
  const color = playerColor(state, city.owner);
  for (const it of scene.items) drawPicture(s, it.pic, SCENE_X + it.x, SCENE_Y + it.y, color);

  // The building last clicked: its name on a stone tag above it, its text along the bar.
  const picked = view.picked ? scene.items.find((it) => it.id === view.picked) : undefined;
  const info = view.picked ? about(view.picked) : null;
  if (picked && info) {
    const tw = textWidth(info.name) + 6;
    const tx = Math.max(SCENE_X, Math.min(SCENE_X + scene.w - tw, SCENE_X + picked.x + Math.round((picked.pic.w - tw) / 2)));
    const ty = Math.max(SCENE_Y, SCENE_Y + picked.y - picked.pic.h - 13);
    s.frame(tx, ty, tw, 11, C.BLACK!);
    drawStone(s, tx + 1, ty + 1, tw - 2, 9);
    drawText(s, tx + 3, ty + 2, info.name, INK);
  }
  drawStone(s, 0, BAR_Y, SCREEN_W, SCREEN_H - BAR_Y);
  const line = info ? (textWidth(`${info.name}: ${info.text}`) <= BACK.x - 8 ? `${info.name}: ${info.text}` : info.name) : "Click a building to name it   Esc Back";
  drawText(s, 4, BAR_Y + 3, line, info ? INK : DIM);
  s.rect(BACK.x, BACK.y, BACK.w, BACK.h, C.RED!);
  s.hline(BACK.x, BACK.y, BACK.w, C.LRED!);
  s.vline(BACK.x, BACK.y, BACK.h, C.LRED!);
  drawTextCentered(s, BACK.x + BACK.w / 2, BACK.y + 2, "Back", C.WHITE!);
}

/** The improvement or wonder under a point of the city view, or null (anywhere else goes back). */
export function cityViewAt(state: GameState, view: CityViewState, px: number, py: number): string | null {
  const city = state.cities.find((c) => c.id === view.city);
  if (!city || py >= BAR_Y) return null;
  return sceneItemAt(cityScene(state, city), px - SCENE_X, py - SCENE_Y)?.id ?? null;
}
