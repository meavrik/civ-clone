import { applyCommand, newGame, unitById, type Command, type GameState } from "@civ/core";
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

// ---- game bootstrap --------------------------------------------------------
const params = new URLSearchParams(location.search);
const seed = Number(params.get("seed")) || 2026;
const state: GameState = newGame(seed, { difficulty: Number(params.get("difficulty") ?? 2) });

/** Command log: with the seed this replays the whole game. Saves come from it. */
const log: Command[] = [];
function dispatch(cmd: Command): void {
  const r = applyCommand(state, cmd);
  if (r.ok) {
    log.push(cmd);
    view.message = undefined;
  } else {
    view.message = REASONS[r.reason] ?? r.reason;
  }
  blinkOn = true;
  lastBlink = performance.now();
}
const REASONS: Record<string, string> = {
  terrain: "Can't go there",
  zoc: "Zone of control",
  attack: "Combat: phase 5",
  "no-moves": "No moves left",
};

const view: MainScreenView = {
  originX: 0,
  originY: 0,
  blink: true,
  gold: 0,
  taxRate: 5,
  luxRate: 0,
  sciRate: 5,
};

function centerOn(x: number, y: number): void {
  view.originX = x - (VIEW_TILES_X >> 1);
  view.originY = Math.max(0, Math.min(state.map.height - VIEW_TILES_Y, y - (VIEW_TILES_Y >> 1)));
}

/** Keep the active unit in view, scrolling only when it nears the edge. */
function followActive(force = false): void {
  if (state.activeUnit === null) return;
  const u = unitById(state, state.activeUnit);
  if (!u) return;
  const w = state.map.width;
  const rx = (((u.x - view.originX) % w) + w) % w;
  const ry = u.y - view.originY;
  if (force || rx < 2 || rx > VIEW_TILES_X - 3 || ry < 2 || ry > VIEW_TILES_Y - 3) centerOn(u.x, u.y);
}
followActive(true);

// ---- input: original keypad movement and order hotkeys -------------------
const MOVES: Record<string, [number, number]> = {
  Numpad8: [0, -1], ArrowUp: [0, -1],
  Numpad2: [0, 1], ArrowDown: [0, 1],
  Numpad4: [-1, 0], ArrowLeft: [-1, 0],
  Numpad6: [1, 0], ArrowRight: [1, 0],
  Numpad7: [-1, -1], Numpad9: [1, -1], Numpad1: [-1, 1], Numpad3: [1, 1],
};

addEventListener("keydown", (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const active = state.activeUnit;
  const mv = MOVES[e.code];
  if (mv) {
    e.preventDefault();
    if (active === null) return;
    const before = state.activeUnit;
    dispatch({ type: "move", unit: active, dx: mv[0], dy: mv[1] });
    followActive(state.activeUnit !== before);
    return;
  }
  switch (e.code) {
    case "Enter":
    case "NumpadEnter":
      if (state.activeUnit === null) {
        dispatch({ type: "endTurn" });
        followActive(true);
      }
      break;
    case "Space":
      if (active !== null) dispatch({ type: "skip", unit: active });
      followActive(true);
      break;
    case "KeyW":
      if (active !== null) dispatch({ type: "wait", unit: active });
      followActive(true);
      break;
    case "KeyF":
      if (active !== null) dispatch({ type: "fortify", unit: active });
      followActive(true);
      break;
    case "KeyS":
      if (active !== null) dispatch({ type: "sentry", unit: active });
      followActive(true);
      break;
    case "KeyI":
      if (active !== null) dispatch({ type: "work", unit: active, work: "irrigate" });
      followActive(true);
      break;
    case "KeyM":
      if (active !== null) dispatch({ type: "work", unit: active, work: "mine" });
      followActive(true);
      break;
    case "KeyR":
      if (active !== null) dispatch({ type: "work", unit: active, work: "road" });
      followActive(true);
      break;
    case "KeyD":
      if (active !== null && e.shiftKey) dispatch({ type: "disband", unit: active });
      followActive(true);
      break;
    case "KeyC":
      followActive(true);
      break;
  }
});

// Mouse: click a map tile to scroll there (the original's right-click "center").
canvas.addEventListener("contextmenu", (e) => e.preventDefault());
canvas.addEventListener("mousedown", (e) => {
  const scale = canvas.clientWidth / SCREEN_W;
  const px = Math.floor(e.offsetX / scale);
  const py = Math.floor(e.offsetY / scale);
  if (px < 80) return;
  const tx = view.originX + Math.floor((px - 80) / 16);
  const ty = view.originY + Math.floor(py / 16);
  centerOn(tx, ty);
});

// ---- frame loop ------------------------------------------------------------
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

// Expose for the console while there's no save/load UI yet.
(window as unknown as { civ: unknown }).civ = { state, log, dispatch };
