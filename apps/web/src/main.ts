import {
  applyCommand,
  buildOptions,
  building,
  cityAt,
  lastTurnEvents,
  newGame,
  unitById,
  unitType,
  type Command,
  type GameState,
  type Production,
} from "@civ/core";
import {
  citySlotAt,
  drawCityScreen,
  drawMainScreen,
  drawMenu,
  drawStatusLine,
  menuHit,
  PALETTE_RGBA,
  SCREEN_H,
  SCREEN_W,
  Surface,
  TILE,
  VIEW_TILES_X,
  VIEW_TILES_Y,
  VIEW_X,
  type CityScreenView,
  type MainScreenView,
  type MenuState,
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

/** Command log: with the seed this replays the whole game. */
const log: Command[] = [];
let status: string | undefined;
let statusUntil = 0;

function say(text: string, ms = 2500): void {
  status = text;
  statusUntil = performance.now() + ms;
}

const REASONS: Record<string, string> = {
  terrain: "Can't go there",
  zoc: "Zone of control",
  attack: "Combat: phase 5",
  "no-moves": "No moves left",
};

function dispatch(cmd: Command): boolean {
  const r = applyCommand(state, cmd);
  if (r.ok) log.push(cmd);
  else say(REASONS[r.reason] ?? r.reason);
  blinkOn = true;
  lastBlink = performance.now();
  return r.ok;
}

// ---- screens ---------------------------------------------------------------
type Screen =
  | { kind: "map" }
  | { kind: "city"; view: CityScreenView }
  | { kind: "menu"; menu: MenuState; onPick: (i: number) => void; under: Screen };

let screenState: Screen = { kind: "map" };
const view: MainScreenView = { originX: 0, originY: 0, blink: true };

function centerOn(x: number, y: number): void {
  view.originX = x - (VIEW_TILES_X >> 1);
  view.originY = Math.max(0, Math.min(state.map.height - VIEW_TILES_Y, y - (VIEW_TILES_Y >> 1)));
}

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

function openCity(id: number): void {
  screenState = { kind: "city", view: { city: id } };
}

function openProductionMenu(cityId: number): void {
  const city = state.cities.find((c) => c.id === cityId)!;
  const options = buildOptions(state, city);
  const menu: MenuState = {
    title: `${city.name}: build what?`,
    items: options.map((p) => (p.kind === "unit" ? unitType(p.id).name : building(p.id).name)),
    right: options.map((p) => {
      const cost = p.kind === "unit" ? unitType(p.id).cost : building(p.id).cost;
      const t = p.kind === "unit" ? unitType(p.id) : null;
      return t ? `${t.attack}/${t.defense}/${t.moves} ${cost}` : `${cost}`;
    }),
    selected: Math.max(0, options.findIndex((p) => p.kind === city.production.kind && p.id === city.production.id)),
  };
  screenState = {
    kind: "menu",
    menu,
    under: screenState,
    onPick: (i) => {
      const p: Production | undefined = options[i];
      if (p) dispatch({ type: "setProduction", city: cityId, production: p });
    },
  };
}

function endTurn(): void {
  dispatch({ type: "endTurn" });
  const ev = lastTurnEvents[0];
  if (ev) {
    const city = state.cities.find((c) => c.id === ev.city);
    const name = city?.name ?? "City";
    const msg = {
      grew: `${name} grows`,
      shrank: `${name} shrinks`,
      built: `${name} builds ${ev.detail}`,
      disorder: `Civil disorder in ${name}!`,
      starving: `${name} is starving`,
      famine: `Famine in ${name}: ${ev.detail} lost`,
    }[ev.kind];
    say(msg, 4000);
  }
  followActive(true);
}

// ---- input -----------------------------------------------------------------
const MOVES: Record<string, [number, number]> = {
  Numpad8: [0, -1], ArrowUp: [0, -1],
  Numpad2: [0, 1], ArrowDown: [0, 1],
  Numpad4: [-1, 0], ArrowLeft: [-1, 0],
  Numpad6: [1, 0], ArrowRight: [1, 0],
  Numpad7: [-1, -1], Numpad9: [1, -1], Numpad1: [-1, 1], Numpad3: [1, 1],
};

function mapKey(e: KeyboardEvent): void {
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
  const order = (cmd: Command) => {
    if (active !== null) dispatch(cmd);
    followActive(true);
  };
  switch (e.code) {
    case "Enter":
    case "NumpadEnter":
      if (state.activeUnit === null) endTurn();
      break;
    case "Space": order({ type: "skip", unit: active! }); break;
    case "KeyW": order({ type: "wait", unit: active! }); break;
    case "KeyF": order({ type: "fortify", unit: active! }); break;
    case "KeyS": order({ type: "sentry", unit: active! }); break;
    case "KeyI": order({ type: "work", unit: active!, work: "irrigate" }); break;
    case "KeyM": order({ type: "work", unit: active!, work: "mine" }); break;
    case "KeyR": order({ type: "work", unit: active!, work: "road" }); break;
    case "KeyB": {
      if (active === null) break;
      const u = unitById(state, active)!;
      if (dispatch({ type: "found", unit: active })) {
        const c = cityAt(state, u.x, u.y);
        if (c) openCity(c.id);
      }
      followActive(true);
      break;
    }
    case "KeyD":
      if (e.shiftKey) order({ type: "disband", unit: active! });
      break;
    case "KeyC":
      followActive(true);
      break;
  }
}

function cityKey(e: KeyboardEvent, cv: CityScreenView): void {
  switch (e.code) {
    case "Escape":
      screenState = { kind: "map" };
      break;
    case "KeyC":
      openProductionMenu(cv.city);
      break;
    case "KeyB":
      dispatch({ type: "buy", city: cv.city });
      break;
    case "KeyN": {
      const name = prompt("City name:");
      if (name) dispatch({ type: "renameCity", city: cv.city, name });
      break;
    }
  }
}

function menuKey(e: KeyboardEvent, sc: Extract<Screen, { kind: "menu" }>): void {
  const m = sc.menu;
  switch (e.code) {
    case "ArrowUp": case "Numpad8": m.selected = (m.selected + m.items.length - 1) % m.items.length; break;
    case "ArrowDown": case "Numpad2": m.selected = (m.selected + 1) % m.items.length; break;
    case "Enter": case "NumpadEnter": case "Space":
      screenState = sc.under;
      sc.onPick(m.selected);
      break;
    case "Escape":
      screenState = sc.under;
      break;
  }
}

addEventListener("keydown", (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const sc = screenState;
  if (sc.kind === "map") mapKey(e);
  else if (sc.kind === "city") cityKey(e, sc.view);
  else menuKey(e, sc);
});

canvas.addEventListener("contextmenu", (e) => e.preventDefault());
canvas.addEventListener("mousedown", (e) => {
  const scale = canvas.clientWidth / SCREEN_W;
  const px = Math.floor(e.offsetX / scale);
  const py = Math.floor(e.offsetY / scale);
  const sc = screenState;
  if (sc.kind === "menu") {
    const i = menuHit(sc.menu, px, py);
    if (i >= 0) {
      screenState = sc.under;
      sc.onPick(i);
    } else screenState = sc.under;
    return;
  }
  if (sc.kind === "city") {
    const slot = citySlotAt(px, py);
    if (slot !== null && slot !== 0) dispatch({ type: "toggleTile", city: sc.view.city, slot });
    return;
  }
  if (px < VIEW_X) return;
  const tx = view.originX + Math.floor((px - VIEW_X) / TILE);
  const ty = view.originY + Math.floor(py / TILE);
  const city = cityAt(state, tx, ty);
  if (city && city.owner === state.currentPlayer && e.button === 0) openCity(city.id);
  else centerOn(tx, ty);
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
  if (status && t > statusUntil) status = undefined;

  const draw = (sc: Screen): void => {
    if (sc.kind === "map") {
      view.message = status;
      drawMainScreen(screen, state, view);
    } else if (sc.kind === "city") {
      sc.view.message = status;
      drawCityScreen(screen, state, sc.view);
    } else {
      draw(sc.under);
      drawMenu(screen, sc.menu);
      if (status && sc.under.kind !== "map") drawStatusLine(screen, status);
    }
  };
  draw(screenState);
  present();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

(window as unknown as { civ: unknown }).civ = { state, log, dispatch };
