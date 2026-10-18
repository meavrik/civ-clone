import { BUILDINGS, formatYear, Terrain, turnToYear, WONDERS, type GameState } from "@civ/core";
import { cityScene, CLOUD_PUFFS, sceneItemAt, type CityScene, type CityViewState } from "@civ/renderer-api";
import type { Context2D } from "../context.js";
import { fillRound, measure, paragraph, text } from "../draw.js";
import { playerColor } from "../markers.js";
import { paintPicture } from "../pictures.js";
import { BUTTON, CITY_VIEW, H, TERRAIN, UI, W } from "../theme.js";

/**
 * The city view, 960x600: the city's scene three times the retro size under a title, a bar
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
  const { w, h, horizon } = scene;
  const at = (x: number) => ox + x * k;
  const aty = (y: number) => oy + y * k;
  ctx.save();
  ctx.beginPath();
  ctx.rect(ox, oy, w * k, h * k);
  ctx.clip();

  // Sky and clouds.
  const sky = ctx.createLinearGradient(0, oy, 0, aty(horizon));
  sky.addColorStop(0, CITY_VIEW.sky[0]);
  sky.addColorStop(0.6, CITY_VIEW.sky[1]);
  sky.addColorStop(1, CITY_VIEW.sky[2]);
  ctx.fillStyle = sky;
  ctx.fillRect(ox, oy, w * k, horizon * k);
  for (const c of scene.clouds)
    for (const [dx, dy, r] of CLOUD_PUFFS) {
      oval(ctx, at(c.x + dx), aty(c.y + dy), r * 1.4 * k, r * 0.8 * k);
      ctx.fillStyle = dy > 0 ? CITY_VIEW.cloudShade : CITY_VIEW.cloud;
      ctx.fill();
    }

  // The ground, hazy toward the horizon, and the country beyond.
  const look = TERRAIN[scene.ground];
  const land = ctx.createLinearGradient(0, aty(horizon), 0, aty(h));
  land.addColorStop(0, look.light);
  land.addColorStop(0.25, look.base);
  land.addColorStop(1, look.base);
  ctx.fillStyle = land;
  ctx.fillRect(ox, aty(horizon), w * k, (h - horizon) * k);
  for (const p of scene.patches) {
    polygon(ctx, p.pts, ox, oy, k);
    ctx.fillStyle = p.terrain === Terrain.Ocean ? TERRAIN[Terrain.Ocean].light : TERRAIN[p.terrain].base;
    ctx.fill();
  }
  const haze = ctx.createLinearGradient(0, aty(horizon), 0, aty(horizon + 14));
  haze.addColorStop(0, CITY_VIEW.haze[0]);
  haze.addColorStop(1, CITY_VIEW.haze[1]);
  ctx.fillStyle = haze;
  ctx.fillRect(ox, aty(horizon), w * k, 14 * k);
  for (const kn of scene.knolls) {
    if (kn.kind === "mountain") {
      const [l, m, r, top] = [at(kn.x - kn.w / 2), at(kn.x), at(kn.x + kn.w / 2), aty(horizon - kn.h)];
      const base = aty(horizon);
      ctx.beginPath(); ctx.moveTo(l, base); ctx.lineTo(m, top); ctx.lineTo(m, base); ctx.closePath();
      ctx.fillStyle = CITY_VIEW.mountain.lit; ctx.fill();
      ctx.beginPath(); ctx.moveTo(m, base); ctx.lineTo(m, top); ctx.lineTo(r, base); ctx.closePath();
      ctx.fillStyle = CITY_VIEW.mountain.shade; ctx.fill();
      const snow = 0.3;
      ctx.beginPath(); ctx.moveTo(m + (l - m) * snow, top + (base - top) * snow); ctx.lineTo(m, top); ctx.lineTo(m + (r - m) * snow, top + (base - top) * snow);
      ctx.lineTo(m + (r - m) * snow * 0.4, top + (base - top) * snow * 0.8); ctx.lineTo(m, top + (base - top) * snow * 1.1); ctx.closePath();
      ctx.fillStyle = CITY_VIEW.mountain.snow; ctx.fill();
    } else if (kn.kind === "hill") {
      oval(ctx, at(kn.x), aty(horizon + 1), (kn.w / 2) * k, kn.h * k, true);
      const g = ctx.createLinearGradient(at(kn.x - kn.w / 2), 0, at(kn.x + kn.w / 2), 0);
      g.addColorStop(0, CITY_VIEW.hill.lit);
      g.addColorStop(1, CITY_VIEW.hill.shade);
      ctx.fillStyle = g;
      ctx.fill();
    } else {
      oval(ctx, at(kn.x), aty(horizon - kn.h / 2 + 1), (kn.w / 2) * k, (kn.h / 2 + 0.5) * k);
      ctx.fillStyle = CITY_VIEW.wood.shade;
      ctx.fill();
    }
  }
  if (scene.river) {
    const pts = scene.river;
    ctx.beginPath();
    ctx.moveTo(at(pts[0]!), aty(pts[1]!));
    for (let i = 2; i + 3 < pts.length; i += 2) ctx.quadraticCurveTo(at(pts[i]!), aty(pts[i + 1]!), at((pts[i]! + pts[i + 2]!) / 2), aty((pts[i + 1]! + pts[i + 3]!) / 2));
    ctx.strokeStyle = CITY_VIEW.river;
    ctx.lineWidth = 3 * k;
    ctx.lineCap = "round";
    ctx.stroke();
  }

  // Streets, and what stands along them, back to front.
  for (const st of scene.streets) {
    ctx.fillStyle = CITY_VIEW.street[st.surface];
    ctx.fillRect(at(st.x0), aty(st.y), (st.x1 - st.x0) * k, 3 * k);
    ctx.fillStyle = CITY_VIEW.street.edge;
    ctx.fillRect(at(st.x0), aty(st.y + 3) - 1, (st.x1 - st.x0) * k, 1);
    if (st.surface === "asphalt") {
      ctx.fillStyle = CITY_VIEW.street.line;
      for (let x = st.x0 + 2; x + 4 < st.x1; x += 8) ctx.fillRect(at(x), aty(st.y + 1.3), 4 * k, 0.4 * k);
    }
  }
  for (const it of scene.items) paintPicture(ctx, it.pic, at(it.x), aty(it.y), k, owner);
  ctx.restore();
}

/** The name and line of text of an improvement or wonder. */
function about(id: string): { name: string; text: string } | null {
  return BUILDINGS.find((b) => b.id === id) ?? WONDERS.find((w) => w.id === id) ?? null;
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
    const tx = Math.max(SCENE_X, Math.min(SCENE_X + scene.w * K - tw, SCENE_X + (picked.x + picked.pic.w / 2) * K - tw / 2));
    const ty = Math.max(SCENE_Y + 4, SCENE_Y + (picked.y - picked.pic.h) * K - 34);
    fillRound(ctx, tx, ty, tw, 28, 8, CITY_VIEW.tag.fill);
    text(ctx, tx + tw / 2, ty + 6, info.name, { size: 15, weight: "600", color: CITY_VIEW.tag.ink, align: "center" });
  }
  ctx.fillStyle = UI.panel;
  ctx.fillRect(0, H - HINT_H, W, HINT_H);
  paragraph(ctx, 24, H - HINT_H + 10, BACK.x - 40, info ? `${info.name}: ${info.text}` : "Click a building to name it   ·   Esc back to the city", { size: 14, color: info ? UI.ink : UI.dim }, 1);
  fillRound(ctx, BACK.x, BACK.y, BACK.w, BACK.h, 10, BUTTON.fill);
  text(ctx, BACK.x + BACK.w / 2, BACK.y + 6, "Back", { size: 15, weight: "600", color: BUTTON.ink, align: "center" });
}

/** The improvement or wonder under a point of the city view, or null (anywhere else goes back). */
export function cityViewAt(state: GameState, view: CityViewState, px: number, py: number): string | null {
  const city = state.cities.find((c) => c.id === view.city);
  if (!city || py >= H - HINT_H) return null;
  return sceneItemAt(cityScene(state, city), (px - SCENE_X) / K, (py - SCENE_Y) / K)?.id ?? null;
}
