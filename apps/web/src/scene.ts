import { civ, type GameState } from "@civ/core";
import { LEADER_PORTRAITS } from "@civ/renderer-api";

/**
 * The leaders' audience pictures, the user's own (2026-10-22), shown as they are: full size and true
 * colour (scenes/<leader>.webp, the PNGs as supplied, kept as WebP at quality 92), not drawn into the
 * 320x200 palette screen, which cannot hold them (asked for: "use the images as is"). An image laid
 * over the canvas exactly where the audience screen leaves room for it (`AUDIENCE_PICTURE`); it lets
 * clicks through to the canvas. Until it has loaded, the screen's own stand-in (the leader's portrait)
 * shows beneath.
 */

/** A leader's picture by portrait name ("caesar"). */
const pictureUrl = (name: string): string => new URL(`./scenes/${name}.webp`, import.meta.url).href;

/** The picture's name for civilization `player`, if its leader has one. */
export function sceneOf(state: GameState, player: number): string | undefined {
  return LEADER_PORTRAITS[civ(state.players[player]!.civ).id];
}

/** Fetch the pictures of a game's leaders as it starts, so an audience never waits for one. */
export function preloadScenes(state: GameState): void {
  for (const p of state.players) {
    const name = sceneOf(state, p.id);
    if (name) new Image().src = pictureUrl(name);
  }
}

export interface ScenePlace {
  name: string;
  /** Where it goes on the canvas, in logical pixels of a canvas `logicalW` by `logicalH`. */
  x: number; y: number; w: number; h: number;
  logicalW: number; logicalH: number;
}

let img: HTMLImageElement | null = null;
let placed = "";

/** Show the picture at its place over `canvas`, or hide it (null). Call once a frame; it changes the page only when something moved. */
export function showScene(canvas: HTMLCanvasElement, at: ScenePlace | null): void {
  if (!at) {
    if (img && placed) { img.style.display = "none"; placed = ""; }
    return;
  }
  if (!img) {
    img = document.createElement("img");
    img.alt = "";
    img.draggable = false;
    Object.assign(img.style, { position: "fixed", pointerEvents: "none", userSelect: "none", imageRendering: "auto", zIndex: "1", display: "none" });
    img.addEventListener("load", () => { if (img) img.style.visibility = "visible"; });
    document.body.appendChild(img);
  }
  const r = canvas.getBoundingClientRect();
  const sx = r.width / at.logicalW, sy = r.height / at.logicalH;
  const box = [r.left + at.x * sx, r.top + at.y * sy, at.w * sx, at.h * sy].map((v) => Math.round(v * 100) / 100);
  const key = `${at.name} ${box.join(" ")}`;
  if (key === placed) return;
  if (!placed.startsWith(`${at.name} `)) {
    img.style.visibility = "hidden";
    img.src = pictureUrl(at.name);
    if (img.complete && img.naturalWidth) img.style.visibility = "visible";
  }
  Object.assign(img.style, { display: "block", left: `${box[0]}px`, top: `${box[1]}px`, width: `${box[2]}px`, height: `${box[3]}px` });
  placed = key;
}
