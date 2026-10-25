import { civ, type GameState } from "@civ/core";
import { artPlace, buildingArt, LEADER_PORTRAITS, techPicture, type ArtSpot } from "@civ/renderer-api";

/**
 * The user's own pictures (2026-10-22), shown as they are: full size and true colour, not drawn into
 * the 320x200 palette screen, which cannot hold them (asked for: "use the original images, don't change
 * or distort"). The leaders in their palaces for the audience (scenes/<leader>.webp) and the portraits of
 * the setup (portraits/<name>.webp: the difficulty levels' rulers and the tribes' leaders), and the
 * advances for the New Technology window (techs/<advance>.webp, 2026-10-23), and the improvements, wonders
 * and spaceship parts (buildings/<id>.webp, 2026-10-24) wherever a screen leaves a spot for one (`ArtSpot`:
 * the city view, the Building Completed window, the research card), kept as WebP at quality 92 (alpha
 * exact) at their supplied sizes. Each is an image laid over the canvas where the screen leaves room for
 * it; they let clicks through to the canvas.
 */

const sceneUrl = (name: string): string => new URL(`./scenes/${name}.webp`, import.meta.url).href;
const portraitUrl = (name: string): string => new URL(`./portraits/${name}.webp`, import.meta.url).href;
const techUrl = (id: string): string => new URL(`./techs/${id}.webp`, import.meta.url).href;
const buildingUrl = (id: string): string => new URL(`./buildings/${id}.webp`, import.meta.url).href;

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
 * The building pictures a drawn screen left spots for (`Surface.art`), back to front, on a canvas
 * `logicalW` by `logicalH` whose screen starts `dx` across.
 */
export function buildingPlaces(spots: ArtSpot[], screen: { dx: number; logicalW: number; logicalH: number }): PicturePlace[] {
  const out: PicturePlace[] = [];
  spots.forEach((spot, z) => {
    const box = artPlace(spot);
    if (box) out.push({ url: buildingUrl(spot.id), fit: "fill", ...box, x: box.x + screen.dx, logicalW: screen.logicalW, logicalH: screen.logicalH, z, ...(spot.lit ? { glow: true } : {}), ...(spot.reveal !== undefined ? { reveal: spot.reveal } : {}), ...(spot.dim ? { dim: true } : {}) });
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
    const box = [r!.left + at.x * sx, r!.top + at.y * sy, at.w * sx, at.h * sy].map((v) => Math.round(v * 100) / 100);
    const reveal = at.reveal ?? 1;
    const key = `${at.fit} ${box.join(" ")} ${at.z ?? 0} ${at.glow ? 1 : 0} ${reveal.toFixed(3)} ${at.dim ? 1 : 0}`;
    if (key === slot.key) continue;
    // A rising picture shows from its foot up (clipped from the top); one under a window is darkened with the screen.
    const filters = [at.glow ? "drop-shadow(0 0 1px #fff) drop-shadow(0 0 2px #fff)" : "", at.dim ? "brightness(45%)" : ""].filter(Boolean);
    Object.assign(slot.img.style, {
      display: "block", left: `${box[0]}px`, top: `${box[1]}px`, width: `${box[2]}px`, height: `${box[3]}px`,
      objectFit: at.fit === "contain" ? "contain" : "fill", objectPosition: "50% 100%",
      zIndex: String(1 + (at.z ?? 0)), filter: filters.length ? filters.join(" ") : "none",
      clipPath: reveal < 1 ? `inset(${((1 - reveal) * 100).toFixed(1)}% 0 0 0)` : "none",
    });
    slot.key = key;
  }
  for (const slot of images.values()) {
    if (used.has(slot) || !slot.key) continue;
    slot.img.style.display = "none";
    slot.key = "";
  }
}
