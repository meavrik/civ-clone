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
export const VIEW_TILES_Y = Math.ceil(H / TILE);

export const FONT = "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";
export const font = (px: number, weight: "normal" | "bold" | "600" = "normal") => `${weight} ${px}px ${FONT}`;

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

/** Civ colour slots 0..7, the same order the retro palette uses. */
export const PLAYER_COLORS = ["#f4f6f8", "#58d68d", "#5dade2", "#f4d03f", "#48c9b0", "#ec7063", "#c39bd3", "#aab7b8"];
export const PLAYER_DARK = ["#9aa3ad", "#2e8b57", "#2e6da4", "#b7950b", "#1f8a76", "#b03a2e", "#7d5b9a", "#6d7a7c"];

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

export const RIVER = "#5aa9ff";
export const ROAD = "#8a6a3a";
export const RAIL = "#3a3f46";
export const IRRIGATION = "#8fd3ff";
