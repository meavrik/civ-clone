import { Terrain } from "@civ/core";
import type { Material } from "@civ/renderer-api";

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
  wheat: "#ecc15c",
  wheatDark: "#a87a2a",
  shirt: "#5f8fe0",
  dress: "#e0614f",
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

/**
 * The city screen's citizens: clothes by mood (yellow happy, white content, red unhappy) or trade,
 * then each person's skin, hair and trousers in the order `citizenLook` counts them.
 */
export const CITIZEN = {
  line: "#14100c",
  clothes: {
    happy: ["#f7dc4a", "#c4a521"],
    content: ["#eef1f4", "#aab4bf"],
    unhappy: ["#ff6b6b", "#c23b3b"],
    entertainer: ["#e08cff", "#a457c4"],
    taxman: ["#ff9f43", "#c46a17"],
    scientist: ["#6fd8ff", "#2b98c2"],
  } as const,
  skin: ["#fbe0c8", "#efc39d", "#d49d70", "#a9744b", "#7a4e30", "#53331f"],
  hair: ["#1c1918", "#3d2617", "#6f4b2b", "#9c4a1d", "#e2c27c", "#bdbdbd"],
  legs: ["#34558f", "#6d4b2c", "#4d5761", "#416c3b"],
  shoe: "#2a2420",
  hat: "#3b4049",
  bell: "#f7dc4a",
  glass: "#eaf8ff",
  flask: "#6fd8ff",
  coin: "#f1c54f",
  coinDark: "#a8791f",
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

/** A road: packed earth between darker verges, with wheel ruts along it and pebbles at its edges. */
export const ROAD = { verge: "#5e4426", surface: "#a88452", rut: "rgba(94, 66, 34, 0.45)", pebble: "#d9c39a" };
/** A railroad over its road: gravel, dark sleepers across it and bright rails. */
export const RAIL = { ballast: "#6c6f73", sleeper: "#4a3420", rail: "#dfe5ea" };

/** Irrigated fields: the canal, and each crop's ground and the darker rows on it (see `fieldLayout`). */
export const FIELDS = {
  canal: "#4b98e6",
  crops: [
    { ground: "#d6be58", rows: "#b49a38" }, // ripe grain
    { ground: "#8fc95e", rows: "#5f9a3c" }, // green shoots
    { ground: "#a57e50", rows: "#7c5a34" }, // ploughed earth
    { ground: "#e8daa0", rows: "#c8b676" }, // pale grain
  ],
};

/** A mine: a rock mound with a timber-framed shaft, rails out of it and a few spoil stones. */
export const MINE = {
  rock: "#8b8f96",
  rockLight: "#b3b8bf",
  rockDark: "#5d6168",
  outline: "#1d2024",
  shaft: "#0d0f12",
  timber: "#a0703a",
  timberLight: "#c99858",
  rail: "#c9cfd5",
  sleeper: "#4a3420",
};

/**
 * The city view: each building material as a face, a lit edge and a shaded edge (the owner's
 * colour stands in for "owner"), the sky from overhead to the horizon, streets, the far country.
 */
export const CITY_VIEW = {
  materials: {
    stone: ["#b4b7c0", "#d6d8df", "#7b7f8a"],
    marble: ["#efe9de", "#fffcf4", "#b9b0a1"],
    sandstone: ["#d8bb79", "#ecd59c", "#a68c50"],
    brick: ["#a4503a", "#c46c52", "#6c2f22"],
    roof: ["#cf6f4e", "#e98f6b", "#923e29"],
    slate: ["#5c6371", "#79818f", "#3c424d"],
    wood: ["#8a6136", "#a87c4b", "#5d3e20"],
    thatch: ["#cdb159", "#e2ca77", "#9a8236"],
    gold: ["#efc449", "#ffe07c", "#b28b22"],
    glass: ["#8fb5e3", "#b9d4f4", "#5c84ba"],
    deep: ["#2f5b92", "#4072ad", "#1d3c65"],
    dark: ["#23272e", "#2e333b", "#181b20"],
    steel: ["#8e959f", "#b0b6be", "#5f656e"],
    concrete: ["#b5b8bc", "#d2d4d7", "#85898e"],
    green: ["#5e9d44", "#7bb95e", "#3f7230"],
    leaf: ["#2e6a38", "#418a4b", "#1c4824"],
    copper: ["#4f9f89", "#70bea6", "#2f7161"],
    water: ["#3c7fc4", "#5c9bdc", "#285d96"],
    white: ["#f5f5f1", "#ffffff", "#c6c8c5"],
    light: ["#ffe35a", "#fff3a6", "#e0b92e"],
    smoke: ["#d8dce1", "#eef1f4", "#a9afb7"],
    owner: ["#ffffff", "#ffffff", "#ffffff"],
  } as Record<Material, [string, string, string]>,
  /** Materials drawn in one colour, without light and shade. */
  flat: ["dark", "light", "owner"] as Material[],
  outline: "rgba(18, 20, 26, 0.8)",
  sky: ["#4a82d4", "#9fc2ec", "#e3eef9"] as const,
  cloud: "#ffffff",
  cloudShade: "#d3e0ef",
  haze: ["rgba(227, 238, 249, 0.55)", "rgba(227, 238, 249, 0)"] as const,
  mountain: { lit: "#9aa2ae", shade: "#686f7c", snow: "#f4f8fb" },
  hill: { lit: "#78b25c", shade: "#5a9142" },
  wood: { lit: "#3f8549", shade: "#2a5f33" },
  river: "#4b98e6",
  street: { dirt: "#a07f50", stone: "#aeb2b9", asphalt: "#3d4249", line: "#e9eef4", edge: "rgba(0, 0, 0, 0.22)" },
  tag: { fill: "rgba(13, 17, 23, 0.88)", ink: "#f1c54f" },
};
