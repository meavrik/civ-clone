import { BUILDINGS, formatYear, Terrain, turnToYear, WONDERS, type GameState } from "@civ/core";
import { cityScene, HOUSE_BY_ID, isoU, isoV, isoX, isoY, sceneItemAt, townTerrain, type CityScene, type CityViewState } from "@civ/renderer-api";
import type { Context2D } from "../context.js";
import { fillRound, measure, paragraph, text } from "../draw.js";
import { playerColor } from "../markers.js";
import { paintPicture } from "../pictures.js";
import { BUTTON, CITY_VIEW, H, TERRAIN, UI, W } from "../theme.js";

/**
 * The city view, 960x600: the town's scene three times the retro size under a title, a bar
 * along the bottom naming the building last clicked and a Back button. The city screen also
 * shows the scene small, as its View button.
 */
const K = 3;
export const SCENE_X = 6;
export const SCENE_Y = 40;
const HINT_H = 36;
const BACK = { x: W - 120, y: H - HINT_H + 4, w: 108, h: 28 };

function oval(ctx: Context2D, x: number, y: number, rx: number, ry: number, top = false): void {
  ctx.beginPath();
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(rx, ry);
  ctx.arc(0, 0, 1, top ? Math.PI : 0, Math.PI * 2);
  ctx.restore();
  ctx.closePath();
}

function polygon(ctx: Context2D, pts: number[], ox: number, oy: number, k: number): void {
  ctx.beginPath();
  for (let i = 0; i < pts.length; i += 2) {
    if (i === 0) ctx.moveTo(ox + pts[i]! * k, oy + pts[i + 1]! * k);
    else ctx.lineTo(ox + pts[i]! * k, oy + pts[i + 1]! * k);
  }
  ctx.closePath();
}

/** Paints a city's scene with its top left at `ox`, `oy`, `k` canvas units to a retro pixel. */
export function paintCityScene(ctx: Context2D, scene: CityScene, ox: number, oy: number, k: number, owner: string): void {
  const { w, h } = scene;
  const at = (x: number) => ox + x * k;
  const aty = (y: number) => oy + y * k;
  const ground = (u: number, v: number): [number, number] => [isoX(u, v), isoY(u, v)];
  ctx.save();
  ctx.beginPath();
  ctx.rect(ox, oy, w * k, h * k);
  ctx.clip();

  // The land round the city, in blocks of the ground it lies on.
  const CELL = 6;
  for (let y = 0; y < h; y += CELL)
    for (let x = 0; x < w; x += CELL) {
      const t = townTerrain(scene.land, scene.salt, isoU(x + CELL / 2, y + CELL / 2), isoV(x + CELL / 2, y + CELL / 2));
      ctx.fillStyle = t === Terrain.Ocean ? TERRAIN[Terrain.Ocean].light : TERRAIN[t].base;
      ctx.fillRect(at(x), aty(y), CELL * k, CELL * k);
    }
  const stroke = (pts: number[], colour: string, width: number) => {
    ctx.beginPath();
    let open = false;
    for (let i = 0; i < pts.length; i += 2) {
      const [x, y] = ground(pts[i]!, pts[i + 1]!);
      if (x < 0 || y < 0 || x > w || y > h) { open = false; continue; }
      if (open) ctx.lineTo(at(x), aty(y));
      else ctx.moveTo(at(x), aty(y));
      open = true;
    }
    ctx.strokeStyle = colour;
    ctx.lineWidth = width * k;
    ctx.lineCap = "round";
    ctx.stroke();
  };
  for (const c of scene.rivers) stroke(c, CITY_VIEW.river, 5);
  for (const st of scene.streets) stroke(st.pts, CITY_VIEW.street[st.surface], st.w * 9);
  for (const b of scene.squares) {
    polygon(ctx, [...ground(b.u0, b.v0), ...ground(b.u1, b.v0), ...ground(b.u1, b.v1), ...ground(b.u0, b.v1)], ox, oy, k);
    ctx.fillStyle = CITY_VIEW.street[scene.streets[0]?.surface ?? "dirt"];
    ctx.fill();
  }

  // What stands on it, back to front.
  for (const it of scene.items) {
    if (it.site) continue;
    if (it.kind === "peak") {
      const [l, m, r, top, base] = [at(it.x), at(it.x + it.w / 2), at(it.x + it.w), aty(it.y - it.h), aty(it.y)];
      ctx.beginPath(); ctx.moveTo(l, base); ctx.lineTo(m, top); ctx.lineTo(m, base); ctx.closePath();
      ctx.fillStyle = CITY_VIEW.mountain.lit; ctx.fill();
      ctx.beginPath(); ctx.moveTo(m, base); ctx.lineTo(m, top); ctx.lineTo(r, base); ctx.closePath();
      ctx.fillStyle = CITY_VIEW.mountain.shade; ctx.fill();
    } else if (it.kind === "mound") {
      oval(ctx, at(it.x + it.w / 2), aty(it.y), (it.w / 2) * k, it.h * k, true);
      ctx.fillStyle = CITY_VIEW.hill.lit;
      ctx.fill();
    } else if (it.wall) {
      const { u0, v0, u1, v1, tall } = it.wall;
      const [lx, ly] = ground(u0, v1), [mx, my] = ground(u1, v1), [rx, ry] = ground(u1, v0);
      polygon(ctx, [lx, ly, mx, my, mx, my - tall, lx, ly - tall], ox, oy, k);
      ctx.fillStyle = CITY_VIEW.mountain.lit; ctx.fill();
      polygon(ctx, [mx, my, rx, ry, rx, ry - tall, mx, my - tall], ox, oy, k);
      ctx.fillStyle = CITY_VIEW.mountain.shade; ctx.fill();
    } else if (it.pic.parts.length) {
      // A building drawn in the middle of its lot (sized for the user's picture, which this renderer does not show).
      paintPicture(ctx, it.pic, at(it.x + (it.w - it.pic.w) / 2), aty(it.y), k, owner);
    }
  }
  ctx.restore();
}

/** The name and line of text of an improvement, wonder or house ("bakery@12"). */
function about(id: string): { name: string; text: string } | null {
  return HOUSE_BY_ID[id.split("@")[0]!] ?? BUILDINGS.find((b) => b.id === id) ?? WONDERS.find((w) => w.id === id) ?? null;
}

export function drawCityView(ctx: Context2D, state: GameState, view: CityViewState): void {
  const city = state.cities.find((c) => c.id === view.city);
  if (!city) return;
  ctx.fillStyle = UI.bg;
  ctx.fillRect(0, 0, W, H);
  text(ctx, W / 2, 10, `${city.name}  ·  size ${city.size}  ·  ${formatYear(turnToYear(state.turn))}`, { size: 18, weight: "600", align: "center" });
  const scene = cityScene(state, city);
  paintCityScene(ctx, scene, SCENE_X, SCENE_Y, K, playerColor(state.players[city.owner]!.color));

  // The building last clicked: its name on a tag above it, its text along the bar.
  const picked = view.picked ? scene.items.find((it) => it.id === view.picked) : undefined;
  const info = view.picked ? about(view.picked) : null;
  if (picked && info) {
    const tw = measure(ctx, info.name, 15, "600") + 20;
    const tx = Math.max(SCENE_X, Math.min(SCENE_X + scene.w * K - tw, SCENE_X + (picked.x + picked.w / 2) * K - tw / 2));
    const ty = Math.max(SCENE_Y + 4, SCENE_Y + (picked.y - picked.h) * K - 34);
    fillRound(ctx, tx, ty, tw, 28, 8, CITY_VIEW.tag.fill);
    text(ctx, tx + tw / 2, ty + 6, info.name, { size: 15, weight: "600", color: CITY_VIEW.tag.ink, align: "center" });
  }
  ctx.fillStyle = UI.panel;
  ctx.fillRect(0, H - HINT_H, W, HINT_H);
  paragraph(ctx, 24, H - HINT_H + 10, BACK.x - 40, info ? `${info.name}: ${info.text}` : "Click a building to name it   ·   Esc back to the city", { size: 14, color: info ? UI.ink : UI.dim }, 1);
  fillRound(ctx, BACK.x, BACK.y, BACK.w, BACK.h, 10, BUTTON.fill);
  text(ctx, BACK.x + BACK.w / 2, BACK.y + 6, "Back", { size: 15, weight: "600", color: BUTTON.ink, align: "center" });
}

/** The improvement, wonder or house under a point of the city view, or null (anywhere else goes back). */
export function cityViewAt(state: GameState, view: CityViewState, px: number, py: number): string | null {
  const city = state.cities.find((c) => c.id === view.city);
  if (!city || py >= H - HINT_H) return null;
  return sceneItemAt(cityScene(state, city), (px - SCENE_X) / K, (py - SCENE_Y) / K)?.id ?? null;
}
