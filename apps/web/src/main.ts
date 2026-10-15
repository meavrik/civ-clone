import {
  advance,
  applyCommand,
  availableAdvances,
  buildOptions,
  cityAt,
  government,
  governmentsAvailable,
  lastTurnEvents,
  newGame,
  productionCost,
  productionName,
  unitById,
  unitType,
  type Command,
  type GameState,
  type Production,
  type TurnEvent,
} from "@civ/core";
import {
  citySlotAt,
  drawCityScreen,
  drawDiscoveryScreen,
  drawMainScreen,
  drawMenu,
  drawRatesScreen,
  drawScienceScreen,
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
  | { kind: "discovery"; advance: string; then: () => void }
  | { kind: "science" }
  | { kind: "rates" }
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
    items: options.map((p) => productionName(p)),
    right: options.map((p) => {
      const cost = productionCost(p);
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

function openResearchMenu(under: Screen): void {
  const options = availableAdvances(state.players[state.currentPlayer]!.advances);
  if (options.length === 0) return;
  screenState = {
    kind: "menu",
    under,
    menu: { title: "Wise men ask: what shall we research?", items: options.map((a) => a.name), selected: 0 },
    onPick: (i) => {
      const a = options[i];
      if (a) dispatch({ type: "research", advance: a.id });
    },
  };
}

function openGovernmentMenu(under: Screen): void {
  const ids = governmentsAvailable(state, state.currentPlayer);
  screenState = {
    kind: "menu",
    under,
    menu: { title: "Choose a new government", items: ids.map((g) => government(g).name), selected: 0 },
    onPick: (i) => {
      const g = ids[i];
      if (g) dispatch({ type: "setGovernment", government: g });
    },
  };
}

function eventMessage(ev: TurnEvent): string | null {
  if (!("city" in ev)) return null;
  const name = state.cities.find((c) => c.id === ev.city)?.name ?? "City";
  switch (ev.kind) {
    case "grew": return `${name} grows`;
    case "shrank": return `${name} shrinks`;
    case "built": return `${name} builds ${ev.detail}`;
    case "wonder": return `${name} completes ${ev.detail}!`;
    case "disorder": return `Civil disorder in ${name}!`;
    case "starving": return `${name} is starving`;
    case "famine": return `Famine in ${name}: ${ev.detail} lost`;
  }
}

/** Play the turn's events as a chain of screens, then land on the map. */
function presentEvents(events: TurnEvent[]): void {
  const next = (): void => {
    const ev = events.shift();
    if (!ev) {
      screenState = { kind: "map" };
      followActive(true);
      return;
    }
    if (ev.kind === "discovered") {
      screenState = { kind: "discovery", advance: ev.advance, then: next };
    } else if (ev.kind === "chooseResearch") {
      openResearchMenu({ kind: "map" });
      const sc = screenState as Extract<Screen, { kind: "menu" }>;
      const pick = sc.onPick;
      sc.onPick = (i) => { pick(i); next(); };
    } else if (ev.kind === "chooseGovernment") {
      openGovernmentMenu({ kind: "map" });
      const sc = screenState as Extract<Screen, { kind: "menu" }>;
      const pick = sc.onPick;
      sc.onPick = (i) => { pick(i); next(); };
    } else {
      const msg = eventMessage(ev);
      if (msg) say(msg, 4000);
      next();
    }
  };
  next();
}

function endTurn(): void {
  dispatch({ type: "endTurn" });
  presentEvents([...lastTurnEvents]);
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
    case "KeyT":
      screenState = { kind: "rates" };
      break;
    case "KeyA":
      screenState = { kind: "science" };
      break;
    case "KeyG":
      if (state.players[state.currentPlayer]!.government === "anarchy") {
        if (state.players[state.currentPlayer]!.anarchyTurns === 0) openGovernmentMenu({ kind: "map" });
        else say("Still in anarchy");
      } else if (confirm("Start a revolution? The government will fall into anarchy.")) {
        dispatch({ type: "revolution" });
        say("Revolution! Anarchy reigns.");
      }
      break;
  }
}

function ratesKey(e: KeyboardEvent): void {
  const p = state.players[state.currentPlayer]!;
  const set = (tax: number, lux: number) => {
    const sci = 10 - tax - lux;
    if (sci < 0 || tax < 0 || lux < 0) return;
    dispatch({ type: "setRates", tax, lux, sci });
  };
  switch (e.code) {
    case "ArrowRight": set(p.taxRate + 1, p.luxRate); break;
    case "ArrowLeft": set(p.taxRate - 1, p.luxRate); break;
    case "ArrowUp": set(p.taxRate, p.luxRate + 1); break;
    case "ArrowDown": set(p.taxRate, p.luxRate - 1); break;
    case "Escape": case "Enter": case "NumpadEnter": screenState = { kind: "map" }; break;
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
  else if (sc.kind === "rates") ratesKey(e);
  else if (sc.kind === "science") {
    if (e.code === "KeyA") openResearchMenu(sc);
    else if (e.code === "Escape") screenState = { kind: "map" };
  } else if (sc.kind === "discovery") {
    sc.then();
  } else menuKey(e, sc);
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
  if (sc.kind === "discovery") {
    sc.then();
    return;
  }
  if (sc.kind === "rates" || sc.kind === "science") {
    screenState = { kind: "map" };
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
    } else if (sc.kind === "discovery") {
      drawDiscoveryScreen(screen, state, sc.advance);
    } else if (sc.kind === "science") {
      drawScienceScreen(screen, state);
    } else if (sc.kind === "rates") {
      drawRatesScreen(screen, state);
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
