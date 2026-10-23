import { civ, type GameState } from "@civ/core";
import { LEADER_PORTRAITS, techPicture } from "@civ/renderer-api";

/**
 * The user's own pictures (2026-10-22), shown as they are: full size and true colour, not drawn into
 * the 320x200 palette screen, which cannot hold them (asked for: "use the original images, don't change
 * or distort"). The leaders in their palaces for the audience (scenes/<leader>.webp) and the portraits of
 * the setup (portraits/<name>.webp: the difficulty levels' rulers and the tribes' leaders), and the
 * advances for the New Technology window (techs/<advance>.webp, 2026-10-23), kept as WebP at quality 92
 * (alpha exact) at their supplied sizes. Each is an image laid over the canvas where the screen leaves
 * room for it; they let clicks through to the canvas.
 */

const sceneUrl = (name: string): string => new URL(`./scenes/${name}.webp`, import.meta.url).href;
const portraitUrl = (name: string): string => new URL(`./portraits/${name}.webp`, import.meta.url).href;
const techUrl = (id: string): string => new URL(`./techs/${id}.webp`, import.meta.url).href;

export interface PicturePlace {
  url: string;
  /** Where it goes on the canvas, in logical pixels of a canvas `logicalW` by `logicalH`. */
  x: number; y: number; w: number; h: number;
  logicalW: number; logicalH: number;
  /** "fill": the box is the picture's own shape; "contain": the whole picture, its shape kept, standing on the box's foot. */
  fit: "fill" | "contain";
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

const fetched = new Set<string>();

/** Fetch the picture of the advance under research before it is found, so its window never waits for it. */
export function preloadTech(id: string | null | undefined): void {
  const name = id && techPicture(id);
  if (!name || fetched.has(name)) return;
  fetched.add(name);
  new Image().src = techUrl(name);
}

/** Fetch the audience pictures of a game's leaders as it starts, so an audience never waits for one. */
export function preloadScenes(state: GameState): void {
  for (const p of state.players) {
    const name = LEADER_PORTRAITS[civ(p.civ).id];
    if (name) new Image().src = sceneUrl(name);
  }
}

const pool: { img: HTMLImageElement; key: string; url: string }[] = [];

function makeImage(): { img: HTMLImageElement; key: string; url: string } {
  const img = document.createElement("img");
  img.alt = "";
  img.draggable = false;
  Object.assign(img.style, { position: "fixed", pointerEvents: "none", userSelect: "none", imageRendering: "auto", zIndex: "1", display: "none" });
  img.addEventListener("load", () => { img.style.visibility = "visible"; });
  document.body.appendChild(img);
  return { img, key: "", url: "" };
}

/** Show these pictures over `canvas` and no others. Call once a frame; it changes the page only where something moved. */
export function showPictures(canvas: HTMLCanvasElement, places: PicturePlace[]): void {
  const r = places.length ? canvas.getBoundingClientRect() : null;
  places.forEach((at, i) => {
    const slot = (pool[i] ??= makeImage());
    const sx = r!.width / at.logicalW, sy = r!.height / at.logicalH;
    const box = [r!.left + at.x * sx, r!.top + at.y * sy, at.w * sx, at.h * sy].map((v) => Math.round(v * 100) / 100);
    const key = `${at.url} ${at.fit} ${box.join(" ")}`;
    if (key === slot.key) return;
    if (slot.url !== at.url) {
      slot.img.style.visibility = "hidden";
      slot.img.src = at.url;
      slot.url = at.url;
      if (slot.img.complete && slot.img.naturalWidth) slot.img.style.visibility = "visible";
    }
    Object.assign(slot.img.style, {
      display: "block", left: `${box[0]}px`, top: `${box[1]}px`, width: `${box[2]}px`, height: `${box[3]}px`,
      objectFit: at.fit === "contain" ? "contain" : "fill", objectPosition: "50% 100%",
    });
    slot.key = key;
  });
  for (let i = places.length; i < pool.length; i++) {
    const slot = pool[i]!;
    if (slot.key) { slot.img.style.display = "none"; slot.key = ""; }
  }
}
