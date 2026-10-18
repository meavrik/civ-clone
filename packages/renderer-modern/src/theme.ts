import { Terrain } from "@civ/core";

/**
 * The modern look: one logical 960x600 canvas (three times the retro
 * framebuffer, same 16:10 frame and the same panel/viewport split so the
 * two renderers feel like the same game), soft flat colour, real fonts,
 * rounded translucent panels. Every colour lives here.
 */
export const W = 960;
export const H = 600;
export const TILE = 48;
export const PANEL_W = 240;
export const VIEW_X = PANEL_W;
export const VIEW_W = W - PANEL_W; // 720 = 15 tiles
export const VIEW_TILES_X = Math.ceil(VIEW_W / TILE);
/** The menu bar across the top; the panel and the map sit below it. */
export const BAR_H = 30;
export const VIEW_Y = BAR_H;
export const VIEW_TILES_Y = Math.ceil((H - BAR_H) / TILE);

export const FONT = "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";
export const font = (px: number, weight: "normal" | "bold" | "600" = "normal") => `${weight} ${px}px ${FONT}`;

/** The minimap: its dark ground, and a city's rim and heart (its body is the owner's colour). */
export const MINIMAP = { back: "#05080d", cityRim: "#05080d", cityHeart: "#ffffff" };

export const UI = {
  bg: "#0d1117",
  panel: "rgba(22, 29, 38, 0.94)",
  panelEdge: "#3a4858",
  panelLight: "rgba(255,255,255,0.06)",
  card: "rgba(30, 39, 51, 0.96)",
  ink: "#e9eef4",
  dim: "#9aa8b8",
  faint: "#5f6d7d",
  accent: "#f1c54f",
  danger: "#ff6b6b",
  ok: "#7bd88f",
  info: "#6fc3ff",
  lux: "#e08cff",
  shadow: "rgba(0,0,0,0.45)",
  selection: "rgba(241, 197, 79, 0.28)",
  fog: "rgba(6, 10, 18, 0.55)",
};

/** Buttons on a screen (the city's Change and Buy): a filled one is the one to press, an outlined one a choice, a faded one unavailable. */
export const BUTTON = {
  fill: "#f1c54f",
  ink: "#0d1117",
  edge: "#3a4858",
  label: "#e9eef4",
  off: "#5f6d7d",
};

/** The tech tree: an advance's box by where it stands, the one just found, the selection ring and the edges. */
export const TECH = {
  ground: "rgba(6, 9, 14, 0.55)",
  known: { fill: "#1d3a28", edge: "#3f9a55", ink: "#c9f2d2" },
  researching: { fill: "#163452", edge: "#6fc3ff", ink: "#dff1ff" },
  available: { fill: "#36414f", edge: "#e9eef4", ink: "#ffffff" },
  locked: { fill: "#141a22", edge: "#2a3440", ink: "#5f6d7d" },
  fresh: { fill: "#f1c54f", edge: "#fff1c2", ink: "#0d1117" },
  glow: "rgba(241, 197, 79, 0.75)",
  ring: "#ffffff",
  edge: "rgba(154, 168, 184, 0.22)",
  needs: "#f1c54f",
  leads: "#6fc3ff",
  thumb: "rgba(255, 255, 255, 0.16)",
  button: "#f1c54f",
  buttonInk: "#0d1117",
  arrow: "rgba(30, 39, 51, 0.92)",
};

/** Colours of the info panel icons. */
export const ICON = {
  ink: "#e9eef4",
  dark: "#0d1117",
  gold: "#f1c54f",
  goldDark: "#a8791f",
  gem: "#6fe3ff",
  gemDark: "#2a9fc0",
  bulb: "#ffe27a",
  metal: "#9aa8b8",
  food: "#7bd88f",
  foodDark: "#3f9a55",
  foodShine: "#c9f2d2",
  wood: "#a8743f",
  stone: "#b9c3cf",
  stoneDark: "#6d7886",
  heart: "#ff6b6b",
  roof: "#e0614f",
  wall: "#f4f6f8",
  water: "#5fb4ff",
  waterShine: "#cfe9ff",
  road: "#a7b0ba",
  smoke: "#8c96a3",
  straw: "#e2b45a",
  hut: "#c08a4a",
  keycap: "rgba(255,255,255,0.12)",
  badge: "rgba(10, 14, 20, 0.88)",
  keyEdge: "rgba(255,255,255,0.28)",
};

/** Hit point bars, the flash of a blow, and the burst of a beaten unit. */
export const COMBAT = {
  hpGood: "#7bd88f",
  hpFair: "#f1c54f",
  hpPoor: "#ff6b6b",
  hpBack: "rgba(8, 11, 16, 0.85)",
  flash: "#ffffff",
  burstCore: "rgba(255, 248, 214, 1)",
  burstMid: "rgba(255, 170, 60, 0.9)",
  burstEdge: "rgba(200, 50, 30, 0)",
  ember: "#ff8a3c",
  smoke: "rgba(80, 84, 92, 0.75)",
};

/** Colour slots in CIV_COLORS order: white, green, blue, yellow, cyan, magenta, grey, orange, red. */
export const PLAYER_COLORS = ["#f4f6f8", "#4cd964", "#3a5ff0", "#f5e642", "#36d6e7", "#e15bd8", "#9aa5ad", "#ff8c00", "#d92b3a"];
export const PLAYER_DARK = ["#9aa3ad", "#24944a", "#1f3ba8", "#b3a51a", "#168f9c", "#9b2f95", "#5e676e", "#b35f00", "#8f1520"];

export interface TerrainLook {
  base: string;
  light: string;
  dark: string;
}

export const TERRAIN: Record<Terrain, TerrainLook> = {
  [Terrain.Ocean]: { base: "#1f5a94", light: "#2d74b8", dark: "#153f6c" },
  [Terrain.Grassland]: { base: "#6aa84f", light: "#86c267", dark: "#4f8a3a" },
  [Terrain.Plains]: { base: "#c5b358", light: "#d9c96f", dark: "#a69641" },
  [Terrain.Forest]: { base: "#3d7a46", light: "#4f9358", dark: "#2a5a33" },
  [Terrain.Hills]: { base: "#9b8f55", light: "#b5a86a", dark: "#7a6f3f" },
  [Terrain.Mountains]: { base: "#7f8691", light: "#9aa2ad", dark: "#5c636d" },
  [Terrain.Desert]: { base: "#dcc686", light: "#ead8a0", dark: "#bda96a" },
  [Terrain.Tundra]: { base: "#b9c0b0", light: "#cdd3c5", dark: "#98a090" },
  [Terrain.Arctic]: { base: "#e7eef3", light: "#f7fafc", dark: "#c6d2dc" },
  [Terrain.Swamp]: { base: "#55725a", light: "#6b8a6f", dark: "#3e5643" },
  [Terrain.Jungle]: { base: "#2f8a58", light: "#3fa56c", dark: "#226a42" },
};

/** Clouds over unexplored squares: the body, and soft light and dark billows over it (each fading out from its colour). */
export const CLOUDS = {
  base: "#0f1319",
  light: ["rgba(130, 144, 166, 0.11)", "rgba(130, 144, 166, 0)"],
  dark: ["rgba(0, 0, 0, 0.28)", "rgba(0, 0, 0, 0)"],
} as const;

/** Water by depth: open sea away from land, the shallows along a shore (pale next to it, then a shelf), and the surf line on it. */
export const SEA = {
  deep: { base: "#16416f", light: "#1d4f86", dark: "#0e2e52" } as TerrainLook,
  shallow: "#3682c2",
  shelf: "#296dab",
  surf: "rgba(232, 244, 255, 0.6)",
};


export const RIVER = "#5aa9ff";
export const ROAD = "#8a6a3a";
export const RAIL = "#3a3f46";
export const IRRIGATION = "#8fd3ff";
