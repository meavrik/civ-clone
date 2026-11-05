import { BUILDINGS, formatYear, turnToYear, WONDERS, type GameState } from "@civ/core";
import { buildingArt, cityScene, hash, HOUSE_BY_ID, sceneItemAt, wonderRise, type ArtBox, type ArtSpot, type CityScene, type CityViewState, type SceneItem } from "@civ/renderer-api";
import { fineCopy, sealPictures, type Laid } from "../art-holes.js";
import { drawSpaced, drawText, drawTextCentered, textWidth } from "../font.js";
import { C, shade } from "../palette.js";
import { drawBuilding } from "../pictures.js";
import { SCREEN_H, SCREEN_W, Surface } from "../surface.js";
import { DIM, drawStone, drawWindow, INK } from "../widgets.js";
import { playerColor } from "./main.js";
import { drawMound, drawPeak, drawTownGround, drawTree, drawWallPiece, drawWell } from "./town.js";

/**
 * The city view (320x200): the town from above and to one side (`cityScene`), inside a stone window,
 * with a bar along the bottom that names the building or house last clicked. Any other click, or a key,
 * goes back to the city screen. Buildings and houses leave a spot for the user's picture of them (the apps
 * lay it over the canvas); the ground, fields, trees, hills and walls are drawn, and what is drawn in front
 * of a picture shows through it (`sealPictures`).
 */
export const SCENE_X = 2;
export const SCENE_Y = 13;
const BAR_Y = 188;
const BACK = { x: SCREEN_W - 34, y: BAR_Y + 1, w: 33, h: 11 };

/**
 * Sparkles round a wonder just raised: small bright crosses scattered over and about its lot, each
 * flaring in its own moment of the burst (`t` 0..1), white at first and gold as they fade.
 */
function drawSparkles(s: Surface, x: number, ground: number, w: number, h: number, t: number): void {
  for (let k = 0; k < 18; k++) {
    const life = (t * 2.2 + hash(k, 1, 3)) % 1;
    if (life > 0.6) continue;
    const cx = Math.round(x - w * 0.25 + hash(k, 2, 3) * w * 1.5);
    const cy = Math.round(ground - h * 1.3 + hash(k, 3, 3) * h * 1.4);
    const colour = life < 0.3 ? C.WHITE! : C.YELLOW!;
    const r = life < 0.2 ? 1 : 2;
    for (let d = -r; d <= r; d++) { s.set(cx + d, cy, colour); s.set(cx, cy + d, colour); }
  }
}

/** The name and line of text of an improvement, wonder or house. */
function about(item: SceneItem | undefined, id: string): { name: string; text: string } | null {
  return (item?.house && HOUSE_BY_ID[item.house]) || BUILDINGS.find((b) => b.id === id) || WONDERS.find((w) => w.id === id) || null;
}

/** What a scene comes to once drawn: the scene's fine pixels, and the holes in each item's picture for what stands before it. */
interface DrawnTown { pixels: Uint8Array; holes: Map<SceneItem, ArtBox[]> }
const drawnTowns = new WeakMap<CityScene, DrawnTown>();

const hasPicture = (it: SceneItem) => it.kind === "wonder" || it.kind === "building" || it.kind === "gate" || it.kind === "home" || it.kind === "work";

/** Draws a scene's ground and what stands on it, back to front, and notes what lies over each picture; once for a scene. */
function drawTown(s: Surface, scene: CityScene): DrawnTown {
  const fine = s.k;
  drawTownGround(s, scene, SCENE_X, SCENE_Y);
  const room = (x: number, y: number, w: number, h: number) => {
    const x0 = Math.max(SCENE_X, x), y0 = Math.max(SCENE_Y, y);
    return fineCopy(s, x0, y0, Math.max(1, Math.min(SCENE_X + scene.w, x + w) - x0), Math.max(1, Math.min(SCENE_Y + scene.h, y + h) - y0));
  };
  const laid: Laid[] = [];
  const itemLaid = new Map<SceneItem, ArtSpot>();
  for (const it of scene.items) {
    const x = SCENE_X + it.x, y = SCENE_Y + it.y;
    if (hasPicture(it)) {
      const spot: ArtSpot = { id: it.id, x, y: y - it.h, w: it.w, h: it.h };
      itemLaid.set(it, spot);
      laid.push({ spot, copy: room(x, y - it.h, it.w, it.h) });
    } else if (it.kind === "tree") drawTree(s, SCENE_X, SCENE_Y, it, scene.w, scene.h, scene.salt);
    else if (it.kind === "walls") drawWallPiece(s, SCENE_X, SCENE_Y, it.wall!, scene.w, scene.h);
    else if (it.kind === "peak") drawPeak(s, SCENE_X, SCENE_Y, it, scene.w, scene.h, scene.salt);
    else if (it.kind === "mound") drawMound(s, SCENE_X, SCENE_Y, it, scene.w, scene.h, scene.salt);
    else if (it.kind === "well") drawWell(s, SCENE_X, SCENE_Y, it, scene.age);
  }
  sealPictures(s, laid);
  const pixels = new Uint8Array(scene.w * fine * scene.h * fine);
  for (let j = 0; j < scene.h * fine; j++) pixels.set(s.data.subarray((SCENE_Y * fine + j) * s.fw + SCENE_X * fine, (SCENE_Y * fine + j) * s.fw + (SCENE_X + scene.w) * fine), j * scene.w * fine);
  const holes = new Map<SceneItem, ArtBox[]>();
  for (const [it, spot] of itemLaid) if (spot.holes) holes.set(it, spot.holes);
  return { pixels, holes };
}

export function drawCityView(s: Surface, state: GameState, view: CityViewState): void {
  const city = state.cities.find((c) => c.id === view.city);
  if (!city) return;
  s.fill(C.BLACK!);
  drawWindow(s, 0, 0, SCREEN_W, BAR_Y, `${city.name} (Pop ${city.size})   ${formatYear(turnToYear(state.turn))}`, { centred: true });
  const scene = cityScene(state, city);
  const color = playerColor(state, city.owner);
  let town = drawnTowns.get(scene);
  if (!town) drawnTowns.set(scene, (town = drawTown(s, scene)));
  const k = s.k;
  for (let j = 0; j < scene.h * k; j++) s.data.set(town.pixels.subarray(j * scene.w * k, (j + 1) * scene.w * k), (SCENE_Y * k + j) * s.fw + SCENE_X * k);
  for (const it of scene.items) {
    if (!hasPicture(it)) continue;
    const at = [SCENE_X + it.x, SCENE_Y + it.y] as const;
    const before = s.art.length;
    if (it.work) s.art.push({ id: it.work, work: true, x: at[0], y: at[1] - it.h, w: it.w, h: it.h });
    else if (it.house) s.art.push({ id: it.house, house: true, x: at[0], y: at[1] - it.h, w: it.w, h: it.h, ...(it.id === view.picked ? { lit: true } : {}) });
    else {
      // A wonder just completed rises from the ground (`rising.reveal`), through its stages where it has them
      // (`wonderRise`); everything else stands whole, a wonder going up at its stage (`it.site`).
      const reveal = view.rising && it.id === view.rising.id ? view.rising.reveal : 1;
      const stages = reveal < 1 ? wonderRise(it.id, reveal) : null;
      if (stages) for (const l of stages) drawBuilding(s, l.art, it.pic, ...at, it.w, it.h, color, false, l.reveal, l.cleared);
      else drawBuilding(s, it.site ?? it.id, it.pic, ...at, it.w, it.h, color, it.id === view.picked, reveal);
    }
    const holes = town.holes.get(it);
    if (holes) for (let i = before; i < s.art.length; i++) s.art[i]!.holes = holes;
  }
  // Sparkles burst round the wonder once it stands whole.
  const risen = view.rising && view.rising.reveal >= 1 && view.rising.sparkle > 0 ? scene.items.find((it) => it.id === view.rising!.id) : undefined;
  if (risen && view.rising) drawSparkles(s, SCENE_X + risen.x, SCENE_Y + risen.y, risen.w, risen.h, view.rising.sparkle);

  // The building last clicked: its text along the bar (its picture ringed in light); a drawn one its name on a stone tag above it.
  const picked = view.picked ? scene.items.find((it) => it.id === view.picked) : undefined;
  const info = view.picked ? about(picked, view.picked) : null;
  if (picked && info && !picked.house && !buildingArt(picked.id)) {
    const tw = textWidth(info.name) + 6;
    const tx = Math.max(SCENE_X, Math.min(SCENE_X + scene.w - tw, SCENE_X + picked.x + Math.round((picked.w - tw) / 2)));
    const ty = Math.max(SCENE_Y, SCENE_Y + picked.y - picked.h - 13);
    s.frame(tx, ty, tw, 11, C.BLACK!);
    drawStone(s, tx + 1, ty + 1, tw - 2, 9);
    drawText(s, tx + 3, ty + 2, info.name, INK);
  }
  drawStone(s, 0, BAR_Y, SCREEN_W, SCREEN_H - BAR_Y);
  if (view.banner) {
    // The news along the bar in spaced gold capitals: the wonder's show has no Back.
    drawSpaced(s, SCREEN_W / 2, BAR_Y + 3, view.banner.toUpperCase(), shade("wheat", 1));
    return;
  }
  const said = info && (picked?.site ? `${info.name}: under construction` : `${info.name}: ${info.text}`);
  const line = said && info ? (textWidth(said) <= BACK.x - 8 ? said : info.name) : "Click a building to name it   Esc Back";
  drawText(s, 4, BAR_Y + 3, line, info ? INK : DIM);
  s.rect(BACK.x, BACK.y, BACK.w, BACK.h, C.RED!);
  s.hline(BACK.x, BACK.y, BACK.w, C.LRED!);
  s.vline(BACK.x, BACK.y, BACK.h, C.LRED!);
  drawTextCentered(s, BACK.x + BACK.w / 2, BACK.y + 2, "Back", C.WHITE!);
}

/** The improvement, wonder or house under a point of the city view, or null (anywhere else goes back). */
export function cityViewAt(state: GameState, view: CityViewState, px: number, py: number): string | null {
  const city = state.cities.find((c) => c.id === view.city);
  if (!city || py >= BAR_Y) return null;
  return sceneItemAt(cityScene(state, city), px - SCENE_X, py - SCENE_Y)?.id ?? null;
}
