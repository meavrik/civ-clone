import { newGame, reveal, Terrain, type GameState } from "@civ/core";
import {
  drawMainScreen,
  PALETTE_RGBA,
  SCREEN_H,
  SCREEN_W,
  Surface,
  VIEW_TILES_X,
  VIEW_TILES_Y,
  type MainScreenView,
} from "@civ/renderer-retro";

// ---- display: 320x200 indexed framebuffer -> integer-scaled canvas -------
const canvas = document.getElementById("screen") as HTMLCanvasElement;
const ctx = canvas.getContext("2d", { alpha: false })!;
const image = ctx.createImageData(SCREEN_W, SCREEN_H);
const screen = Surface.screen();

function fitCanvas(): void {
  const scale = Math.max(1, Math.floor(Math.min(innerWidth / SCREEN_W, innerHeight / SCREEN_H)));
  canvas.style.width = `${SCREEN_W * scale}px`;
  canvas.style.height = `${SCREEN_H * scale}px`;
}
addEventListener("resize", fitCanvas);
fitCanvas();

function present(): void {
  const px = image.data;
  const src = screen.data;
  for (let i = 0, j = 0; i < src.length; i++, j += 4) {
    const p = src[i]! * 4;
    px[j] = PALETTE_RGBA[p]!;
    px[j + 1] = PALETTE_RGBA[p + 1]!;
    px[j + 2] = PALETTE_RGBA[p + 2]!;
    px[j + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
}

// ---- game bootstrap (phase 1: a world and one Settlers unit) --------------
const seed = Number(new URLSearchParams(location.search).get("seed")) || 2026;
const state: GameState = newGame(seed);

function findStart(st: GameState): { x: number; y: number } {
  const good = new Set([Terrain.Grassland, Terrain.Plains]);
  for (let y = 10; y < st.map.height - 10; y++)
    for (let x = 0; x < st.map.width; x++)
      if (good.has(st.map.tiles[y * st.map.width + x]!.terrain)) return { x, y };
  return { x: 0, y: st.map.height >> 1 };
}

const unit = { ...findStart(state), name: "Settlers", moves: "1", owner: 0 };
reveal(state, unit.x, unit.y, 1);

const view: MainScreenView = {
  originX: unit.x - (VIEW_TILES_X >> 1),
  originY: unit.y - (VIEW_TILES_Y >> 1),
  unit,
  blink: true,
  gold: 0,
  taxRate: 5,
  luxRate: 0,
  sciRate: 5,
};

function centerOnUnit(): void {
  view.originX = unit.x - (VIEW_TILES_X >> 1);
  view.originY = Math.max(0, Math.min(state.map.height - VIEW_TILES_Y, unit.y - (VIEW_TILES_Y >> 1)));
}
centerOnUnit();

// Original keypad movement: 7 8 9 / 4 _ 6 / 1 2 3, plus arrows.
const MOVES: Record<string, [number, number]> = {
  Numpad8: [0, -1], ArrowUp: [0, -1],
  Numpad2: [0, 1], ArrowDown: [0, 1],
  Numpad4: [-1, 0], ArrowLeft: [-1, 0],
  Numpad6: [1, 0], ArrowRight: [1, 0],
  Numpad7: [-1, -1], Numpad9: [1, -1], Numpad1: [-1, 1], Numpad3: [1, 1],
};

addEventListener("keydown", (e) => {
  const mv = MOVES[e.code];
  if (mv) {
    e.preventDefault();
    const nx = (((unit.x + mv[0]) % state.map.width) + state.map.width) % state.map.width;
    const ny = unit.y + mv[1];
    if (ny < 0 || ny >= state.map.height) return;
    if (state.map.tiles[ny * state.map.width + nx]!.terrain === Terrain.Ocean) return;
    unit.x = nx;
    unit.y = ny;
    reveal(state, nx, ny, 1);
    // Scroll when the unit nears the viewport edge, like the original.
    const rx = (((unit.x - view.originX) % state.map.width) + state.map.width) % state.map.width;
    const ry = unit.y - view.originY;
    if (rx < 2 || rx > VIEW_TILES_X - 3 || ry < 2 || ry > VIEW_TILES_Y - 3) centerOnUnit();
    blinkOn = true;
    lastBlink = performance.now();
  } else if (e.code === "KeyC") {
    centerOnUnit();
  }
});

// ---- frame loop: redraw on a slow blink, like the original cursor --------
let blinkOn = true;
let lastBlink = 0;
function frame(t: number): void {
  if (t - lastBlink > 400) {
    blinkOn = !blinkOn;
    lastBlink = t;
  }
  view.blink = blinkOn;
  drawMainScreen(screen, state, view);
  present();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
