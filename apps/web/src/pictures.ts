import { civ, UNIT_TYPES, type GameState } from "@civ/core";
import { artPlace, buildingArt, CITY_ART, LEADER_PORTRAITS, techPicture, unitAnim, unitArt, type ArtBox, type ArtSpot } from "@civ/renderer-api";
import { slotColor } from "@civ/renderer-retro";
import { prepareUnitFrames, unitFrameUrl } from "./unit-frames.js";

/**
 * The user's own pictures (2026-10-22), shown as they are: full size and true colour, not drawn into
 * the 320x200 palette screen, which cannot hold them (asked for: "use the original images, don't change
 * or distort"). The leaders in their palaces for the audience (scenes/<leader>.webp) and the portraits of
 * the setup (portraits/<name>.webp: the difficulty levels' rulers and the tribes' leaders), and the
 * advances for the New Technology window (techs/<advance>.webp, 2026-10-23), and the improvements, wonders
 * and spaceship parts (buildings/<id>.webp, 2026-10-24) wherever a screen leaves a spot for one (`ArtSpot`:
 * the city view, the Building Completed window, the research card), kept as WebP at quality 92 (alpha
 * exact) at their supplied sizes; and the units (units/<id>.png, 2026-10-28, the cells of the user's sheet
 * cut out pixel for pixel: "use the asset I placed as is") on the map and in the unit box, and the cities (cities/<era>-<tier>.png,
 * 2026-10-29, cut from the user's sheet pixel for pixel: "USE AS IS") on the map, the city screen and the square's window. Each is an image laid over the canvas where the screen leaves room for
 * it; they let clicks through to the canvas.
 */

const sceneUrl = (name: string): string => new URL(`./scenes/${name}.webp`, import.meta.url).href;
const portraitUrl = (name: string): string => new URL(`./portraits/${name}.webp`, import.meta.url).href;
const techUrl = (id: string): string => new URL(`./techs/${id}.webp`, import.meta.url).href;
const buildingUrl = (id: string): string => new URL(`./buildings/${id}.webp`, import.meta.url).href;
const unitUrl = (id: string): string => new URL(`./units/${id}.png`, import.meta.url).href;
const cityUrl = (id: string): string => new URL(`./cities/${id}.png`, import.meta.url).href;

export interface PicturePlace {
  url: string;
  /** Where it goes on the canvas, in logical pixels of a canvas `logicalW` by `logicalH`. */
  x: number; y: number; w: number; h: number;
  logicalW: number; logicalH: number;
  /** "fill": the box is the picture's own shape; "contain": the whole picture, its shape kept, standing on the box's foot. */
  fit: "fill" | "contain";
  /** Stacking among the pictures: a higher one covers a lower (the city view's front rows cover its back ones). */
  z?: number;
  /** Ringed in light (the building last clicked in the city view). */
  glow?: boolean;
  /** How much of it stands, from its foot up, 0..1: a wonder rising in the city view; absent, whole. */
  reveal?: number;
  /** Darkened, as the screen it stands on is under a window. */
  dim?: boolean;
  /** Shaded as the map shades what is out of sight (a city there; `UNSEEN`, each colour at 62%). */
  unseen?: boolean;
  /** Only what lies inside this box (logical pixels, as `x`..`h`) shows: a unit at the map view's edge. */
  clip?: ArtBox;
  /** Where it lets what is drawn under it show through (logical pixels): a unit's shield, rank, orders. */
  holes?: ArtBox[];
  /** Tipped this many degrees about its foot (a ship going down), nothing of it showing below `water` (logical pixels down). */
  turn?: number;
  water?: number;
  /** Drawn pixel for pixel, never smoothed (an animated unit's frames), at whole screen pixels. */
  pixelated?: boolean;
  /** Mirrored, facing left (a unit, `UnitFacing`). */
  flip?: boolean;
}

/** The audience picture of civilization `player`'s leader, at a box of the canvas; null if it has none. */
export function scenePlace(state: GameState, player: number, box: Omit<PicturePlace, "url" | "fit">): PicturePlace | null {
  const name = LEADER_PORTRAITS[civ(state.players[player]!.civ).id];
  return name ? { url: sceneUrl(name), fit: "fill", ...box } : null;
}

/** A setup portrait (a ruler or a leader, by name) in a box of the canvas, whole and standing on its foot. */
export function portraitPlace(name: string, box: Omit<PicturePlace, "url" | "fit">): PicturePlace {
  return { url: portraitUrl(name), fit: "contain", ...box };
}

/** The picture of an advance for the New Technology window, whole in a box of the canvas; null if it has none. */
export function techPlace(id: string, box: Omit<PicturePlace, "url" | "fit">): PicturePlace | null {
  const name = techPicture(id);
  return name ? { url: techUrl(name), fit: "contain", ...box } : null;
}

/**
 * The pictures of buildings and units a drawn screen left spots for (`Surface.art`), back to front, on a
 * canvas `logicalW` by `logicalH` whose screen starts `dx` across; none showing past the screen (a list of
 * units running off it).
 */
export function buildingPlaces(spots: ArtSpot[], screen: { dx: number; logicalW: number; logicalH: number }): PicturePlace[] {
  const out: PicturePlace[] = [];
  spots.forEach((spot, z) => {
    const box = artPlace(spot);
    // An animated unit shows its frame in its owner's colour (none until its atlas is in).
    const anim = spot.unit ? unitAnim(spot.id) : null;
    const url = anim ? unitFrameUrl(spot.id, spot.frame ?? anim.rule.idle, spot.owner) : spot.unit ? unitUrl(spot.id) : spot.city ? cityUrl(spot.id) : buildingUrl(spot.id);
    if (box && url) out.push({ url, fit: "fill", ...(anim?.rule.pixelated ? { pixelated: true } : {}), ...box, x: box.x + screen.dx, logicalW: screen.logicalW, logicalH: screen.logicalH, z, ...(spot.lit ? { glow: true } : {}), ...(spot.reveal !== undefined ? { reveal: spot.reveal } : {}), ...(spot.dim ? { dim: true } : {}), ...(spot.unseen ? { unseen: true } : {}), clip: spot.clip ? { ...spot.clip, x: spot.clip.x + screen.dx } : { x: screen.dx, y: 0, w: screen.logicalW - 2 * screen.dx, h: screen.logicalH }, ...(spot.holes ? { holes: spot.holes.map((h) => ({ ...h, x: h.x + screen.dx })) } : {}), ...(spot.turn !== undefined ? { turn: spot.turn } : {}), ...(spot.water !== undefined ? { water: spot.water } : {}), ...(spot.flip ? { flip: true } : {}) });
  });
  return out;
}

const fetched = new Set<string>();

/** Fetch the pictures of what the player's cities are building, so a Building Completed window never waits for one. */
export function preloadBuildings(state: GameState): void {
  for (const c of state.cities) {
    const id = c.owner === state.currentPlayer && c.production.kind !== "unit" ? c.production.id : null;
    if (!id || !buildingArt(id) || fetched.has(buildingUrl(id))) continue;
    fetched.add(buildingUrl(id));
    imageFor(buildingUrl(id));
  }
}

/** Fetch the picture of the advance under research before it is found, so its window never waits for it. */
export function preloadTech(id: string | null | undefined): void {
  const name = id && techPicture(id);
  if (!name || fetched.has(name)) return;
  fetched.add(name);
  imageFor(techUrl(name));
}

/**
 * Fetch and decode the pictures of every unit as a game starts or loads, so no unit waits for its own; and
 * make the animated units' frames in the colours of the game's civilizations, a few at a time.
 */
export function preloadUnits(state: GameState): void {
  for (const t of UNIT_TYPES) if (unitArt(t.id) && !unitAnim(t.id)) imageFor(unitUrl(t.id));
  prepareUnitFrames([...new Set(state.players.map((p) => slotColor(p.color)))], (url) => imageFor(url));
}

/** Fetch and decode the pictures of the cities as a game starts or loads (twelve: three ages by four sizes). */
export function preloadCities(): void {
  for (const id of Object.keys(CITY_ART)) imageFor(cityUrl(id));
}

/** Fetch and decode the audience pictures of a game's leaders as it starts, so an audience never waits for one. */
export function preloadScenes(state: GameState): void {
  for (const p of state.players) {
    const name = LEADER_PORTRAITS[civ(p.civ).id];
    if (name) imageFor(sceneUrl(name));
  }
}

/**
 * One image element per picture (and per copy of it on screen at once), never one element handed a new
 * `src`: Chrome keeps painting an element's old picture until its new one is decoded, so a reused element
 * flashed the last leader met before the new one (2026-10-23). Each is shown only once decoded.
 */
interface Shown { img: HTMLImageElement; key: string; ready: boolean }
const images = new Map<string, Shown>();

/** The element for picture `url` (`id` names a second copy on screen at once), made and decoding on first ask, hidden. */
function imageFor(url: string, id = url): Shown {
  let s = images.get(id);
  if (s) return s;
  const img = document.createElement("img");
  img.alt = "";
  img.draggable = false;
  Object.assign(img.style, { position: "fixed", pointerEvents: "none", userSelect: "none", imageRendering: "auto", zIndex: "1", display: "none", visibility: "hidden" });
  const shown: Shown = { img, key: "", ready: false };
  const reveal = () => { shown.ready = true; img.style.visibility = "visible"; };
  img.src = url;
  img.decode().then(reveal, () => img.addEventListener("load", reveal, { once: true }));
  document.body.appendChild(img);
  images.set(id, shown);
  return shown;
}

/**
 * The CSS clip of a picture with holes (a unit's marks showing through): what lies inside its clip (or a little
 * round it, room for a glow) and outside every hole, as rectangles in the element's own pixels (`sx`, `sy` CSS
 * pixels to a logical one). The holes' and the clip's edges cut the room into a grid; each row's open cells
 * make a rectangle a run, and rows alike join.
 */
function clipPath(at: PicturePlace, sx: number, sy: number): string {
  const glow = 4;
  const room = at.clip ?? { x: at.x - glow, y: at.y - glow, w: at.w + 2 * glow, h: at.h + 2 * glow };
  const holes = at.holes!;
  const cut = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  const edges = (a: number, b: number, of: (h: ArtBox) => [number, number]) =>
    [...new Set([a, b, ...holes.flatMap((h) => of(h).map((v) => cut(v, a, b)))])].sort((p, q) => p - q);
  const xs = edges(room.x, room.x + room.w, (h) => [h.x, h.x + h.w]);
  const ys = edges(room.y, room.y + room.h, (h) => [h.y, h.y + h.h]);
  const open = (x: number, y: number) => !holes.some((h) => x > h.x && x < h.x + h.w && y > h.y && y < h.y + h.h);
  const rects: ArtBox[] = [];
  let last: { runs: string; rects: ArtBox[] } | null = null;
  for (let j = 0; j + 1 < ys.length; j++) {
    const y = ys[j]!, h = ys[j + 1]! - y, my = y + h / 2;
    const runs: [number, number][] = [];
    for (let i = 0; i + 1 < xs.length; i++) {
      if (!open((xs[i]! + xs[i + 1]!) / 2, my)) continue;
      const run = runs[runs.length - 1];
      if (run && run[1] === xs[i]) run[1] = xs[i + 1]!;
      else runs.push([xs[i]!, xs[i + 1]!]);
    }
    const key = runs.map((r) => r.join(",")).join(" ");
    if (last && last.runs === key) { for (const r of last.rects) r.h += h; continue; }
    const row = runs.map(([a, b]) => ({ x: a, y, w: b - a, h }));
    rects.push(...row);
    last = { runs: key, rects: row };
  }
  const px = (v: number) => Math.round(v * 100) / 100;
  // The element's own x of a screen x: a mirrored picture is clipped before it is turned round, so from its right.
  const lx = (v: number) => px((at.flip ? at.x + at.w - v : v - at.x) * sx);
  const d = rects.map((r) => {
    const [a, b] = at.flip ? [lx(r.x + r.w), lx(r.x)] : [lx(r.x), lx(r.x + r.w)];
    return `M${a} ${px((r.y - at.y) * sy)}H${b}V${px((r.y + r.h - at.y) * sy)}H${a}Z`;
  }).join("");
  return `path("${d || "M0 0Z"}")`;
}

/**
 * The CSS clip of a picture tipped `turn` degrees about its foot that shows nothing below the waterline (a
 * ship going down): its box, cut where the line crosses it once turned, in the element's own pixels (a mirror
 * across does not move a point up or down, so a mirrored ship is cut alike).
 */
function waterClip(at: PicturePlace, sx: number, sy: number): string {
  const w = at.w * sx, h = at.h * sy;
  const a = ((at.turn ?? 0) * Math.PI) / 180;
  // A point of the box (from its top left) lies this far down the screen from its foot, once turned about it.
  const down = (x: number, y: number) => (x - w / 2) * Math.sin(a) + (y - h) * Math.cos(a);
  const line = (at.water! - at.y - at.h) * sy;
  const corners: [number, number][] = [[0, 0], [w, 0], [w, h], [0, h]];
  const kept: [number, number][] = [];
  corners.forEach((p, i) => {
    const q = corners[(i + 1) % 4]!;
    const dp = down(...p) - line, dq = down(...q) - line;
    if (dp <= 0) kept.push(p);
    if (dp * dq < 0) { const f = dp / (dp - dq); kept.push([p[0] + (q[0] - p[0]) * f, p[1] + (q[1] - p[1]) * f]); }
  });
  if (kept.length < 3) return "polygon(0 0, 0 0, 0 0)";
  return `polygon(${kept.map(([x, y]) => `${Math.round(x * 100) / 100}px ${Math.round(y * 100) / 100}px`).join(", ")})`;
}

/** The CSS inset that hides what of a picture lies outside its clip, or above what has risen of it; "" for none. */
function clipInset(at: PicturePlace, reveal: number): string {
  const c = at.clip;
  const share = (v: number, of: number) => Math.max(0, Math.min(100, (v / of) * 100));
  const top = Math.max((1 - reveal) * 100, c ? share(c.y - at.y, at.h) : 0);
  const right = c ? share(at.x + at.w - (c.x + c.w), at.w) : 0;
  const bottom = c ? share(at.y + at.h - (c.y + c.h), at.h) : 0;
  const left = c ? share(c.x - at.x, at.w) : 0;
  if (top + right + bottom + left === 0) return "";
  // A mirrored picture is clipped before it is turned round: its right is the screen's left.
  return (at.flip ? [top, left, bottom, right] : [top, right, bottom, left]).map((v) => `${v.toFixed(1)}%`).join(" ");
}

/** Show these pictures over `canvas` and no others. Call once a frame; it changes the page only where something moved. */
export function showPictures(canvas: HTMLCanvasElement, places: PicturePlace[]): void {
  const r = places.length ? canvas.getBoundingClientRect() : null;
  const used = new Set<Shown>();
  const copies = new Map<string, number>();
  for (const at of places) {
    const n = copies.get(at.url) ?? 0;
    copies.set(at.url, n + 1);
    const slot = imageFor(at.url, n ? `${at.url}#${n}` : at.url);
    used.add(slot);
    const sx = r!.width / at.logicalW, sy = r!.height / at.logicalH;
    // Whole screen pixels for a picture drawn pixel for pixel (its edges never fall between two).
    const box = [r!.left + at.x * sx, r!.top + at.y * sy, at.w * sx, at.h * sy].map((v) => (at.pixelated ? Math.round(v) : Math.round(v * 100) / 100));
    const reveal = at.reveal ?? 1;
    const inset = clipInset(at, reveal);
    const clip = at.water !== undefined ? waterClip(at, sx, sy) : at.holes?.length ? clipPath(at, sx, sy) : inset ? `inset(${inset})` : "none";
    const turn = [at.flip ? "scaleX(-1)" : "", at.turn ? `rotate(${at.turn.toFixed(2)}deg)` : ""].filter(Boolean).join(" ") || "none";
    const key = `${at.fit} ${box.join(" ")} ${at.z ?? 0} ${at.glow ? 1 : 0} ${clip} ${turn} ${at.dim ? 1 : 0} ${at.unseen ? 1 : 0}`;
    if (key === slot.key) continue;
    // A rising picture shows from its foot up (clipped from the top), a unit within the map's view and round its marks; one under a window is darkened with the screen.
    const filters = [at.glow ? "drop-shadow(0 0 1px #fff) drop-shadow(0 0 2px #fff)" : "", at.unseen ? "brightness(62%)" : "", at.dim ? "brightness(45%)" : ""].filter(Boolean);
    Object.assign(slot.img.style, {
      display: "block", left: `${box[0]}px`, top: `${box[1]}px`, width: `${box[2]}px`, height: `${box[3]}px`,
      objectFit: at.fit === "contain" ? "contain" : "fill", objectPosition: "50% 100%",
      zIndex: String(1 + (at.z ?? 0)), filter: filters.length ? filters.join(" ") : "none",
      clipPath: clip, transform: turn, transformOrigin: "50% 100%", imageRendering: at.pixelated ? "pixelated" : "auto",
    });
    slot.key = key;
  }
  for (const slot of images.values()) {
    if (used.has(slot) || !slot.key) continue;
    slot.img.style.display = "none";
    slot.key = "";
  }
}
