import { LEADER_PORTRAITS } from "@civ/renderer-api";
import { civ, type GameState } from "@civ/core";
import { DETAIL, Surface } from "./surface.js";

/**
 * The leaders' audience scenes (the user's pictures, converted by tools/sprites/draw/scenes.ts): palace
 * views 316x124, as fine as the screen, each its own module, fetched when first wanted (a game's
 * civilizations as it starts, `prepareScenes`) so the game does not load all twenty up front.
 */
interface SceneArt { w: number; h: number; rle: string }

const LOADERS: Record<string, () => Promise<{ default: SceneArt }>> = {
  alexander: () => import("./art/scenes/alexander.js"),
  ashoka: () => import("./art/scenes/ashoka.js"),
  caesar: () => import("./art/scenes/caesar.js"),
  charlemagne: () => import("./art/scenes/charlemagne.js"),
  cyrus: () => import("./art/scenes/cyrus.js"),
  david: () => import("./art/scenes/david.js"),
  elizabeth: () => import("./art/scenes/elizabeth.js"),
  genghis_khan: () => import("./art/scenes/genghis_khan.js"),
  hammurabi: () => import("./art/scenes/hammurabi.js"),
  harald: () => import("./art/scenes/harald.js"),
  isabella: () => import("./art/scenes/isabella.js"),
  montezuma: () => import("./art/scenes/montezuma.js"),
  otto: () => import("./art/scenes/otto.js"),
  peter: () => import("./art/scenes/peter.js"),
  qin_shi_huang: () => import("./art/scenes/qin_shi_huang.js"),
  ramesses: () => import("./art/scenes/ramesses.js"),
  shaka: () => import("./art/scenes/shaka.js"),
  suppiluliuma: () => import("./art/scenes/suppiluliuma.js"),
  tokugawa: () => import("./art/scenes/tokugawa.js"),
  washington: () => import("./art/scenes/washington.js"),
};

const scenes = new Map<string, Surface>();
const loading = new Map<string, Promise<Surface | undefined>>();

/** A scene's palette indices from its run-length code (base64 of colour, run - 1 pairs). */
function decode(art: SceneArt): Surface {
  const bin = atob(art.rle);
  const s = new Surface(art.w, art.h, undefined, DETAIL);
  let o = 0;
  for (let i = 0; i + 1 < bin.length; i += 2) {
    const c = bin.charCodeAt(i), n = bin.charCodeAt(i + 1) + 1;
    s.data.fill(c, o, o + n);
    o += n;
  }
  return s;
}

/** Fetch a leader's scene (by portrait name: "caesar"); resolves once it can be drawn, undefined if there is none. */
export function loadScene(name: string): Promise<Surface | undefined> {
  const have = scenes.get(name);
  if (have) return Promise.resolve(have);
  const pending = loading.get(name);
  if (pending) return pending;
  const load = LOADERS[name];
  if (!load) return Promise.resolve(undefined);
  const p = load().then((m) => { const s = decode(m.default); scenes.set(name, s); return s; }, () => undefined);
  loading.set(name, p);
  return p;
}

/** A leader's scene if it has been fetched (asking for it fetches it for a later frame). */
export function sceneFor(name: string): Surface | undefined {
  const s = scenes.get(name);
  if (!s) void loadScene(name);
  return s;
}

/** Fetch the scenes of a game's civilizations, so an audience never waits for its picture. */
export function prepareScenes(state: GameState): Promise<unknown> {
  return Promise.all(state.players.map((p) => {
    const name = LEADER_PORTRAITS[civ(p.civ).id];
    return name ? loadScene(name) : undefined;
  }));
}

/** The leaders that have a scene. */
export const SCENE_NAMES = Object.keys(LOADERS);
