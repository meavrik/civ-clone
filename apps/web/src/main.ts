import { aiTurn } from "@civ/ai";
import {
  advance,
  applyCommand,
  atWar,
  canFoundCity,
  civ,
  lastCombat,
  unitAt,
  workOptions,
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
const state: GameState = newGame(seed, {
  difficulty: Number(params.get("difficulty") ?? 2),
  opponents: Number(params.get("opponents") ?? 2),
  ...(params.get("civ") ? { civ: params.get("civ")! } : {}),
});

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
  full: "Ship is full",
  treaty: "We have a treaty (right-click: declare war)",
  "no route": "No route there",
};

function dispatch(cmd: Command): boolean {
  const r = applyCommand(state, cmd);
  if (r.ok) {
    log.push(cmd);
    if (cmd.type === "move" && lastCombat) {
      const c = lastCombat;
      const them = state.players[c.defenderOwner]!.name;
      say(c.attackerWon ? `${unitType(c.attackerType).name} defeats ${them} ${unitType(c.defenderType).name}` : `${unitType(c.attackerType).name} lost to ${them} ${unitType(c.defenderType).name}`, 3500);
    }
  } else say(REASONS[r.reason] ?? r.reason);
  blinkOn = true;
  lastBlink = performance.now();
  return r.ok;
}

/** Move the active unit, offering to declare war when a treaty blocks the attack. */
function tryMove(unit: number, dx: number, dy: number): void {
  const r = applyCommand(state, { type: "move", unit, dx, dy });
  if (r.ok) {
    log.push({ type: "move", unit, dx, dy });
    if (lastCombat) {
      const c = lastCombat;
      const them = state.players[c.defenderOwner]!.name;
      say(c.attackerWon ? `${unitType(c.attackerType).name} defeats ${them} ${unitType(c.defenderType).name}` : `${unitType(c.attackerType).name} lost to ${them} ${unitType(c.defenderType).name}`, 3500);
    }
    return;
  }
  if (r.reason === "treaty") {
    const u = unitById(state, unit)!;
    const tx = u.x + dx;
    const ty = u.y + dy;
    const target = unitAt(state, tx, ty)[0] ?? cityAt(state, tx, ty);
    if (target) openWarMenu(target.owner, () => tryMove(unit, dx, dy));
    return;
  }
  say(REASONS[r.reason] ?? r.reason);
}

function openWarMenu(player: number, then?: () => void): void {
  const name = state.players[player]!.name;
  screenState = {
    kind: "menu",
    under: screenState,
    menu: { title: `Declare war on the ${name}?`, items: ["No, keep the peace", "Yes, declare war!"], selected: 0 },
    onPick: (i) => {
      if (i === 1) {
        dispatch({ type: "declareWar", player });
        say(`War with the ${name}!`, 3000);
        then?.();
      }
    },
  };
}

function openContactMenu(player: number, next: () => void): void {
  const p = state.players[player]!;
  const c = civ(p.civ);
  screenState = {
    kind: "menu",
    under: { kind: "map" },
    menu: {
      title: `${c.leader} of the ${c.name} greets you.`,
      items: ["Exchange peace treaty", "Declare war"],
      selected: 0,
    },
    onPick: (i) => {
      if (i === 1) dispatch({ type: "declareWar", player });
      else dispatch({ type: "makePeace", player });
      next();
    },
  };
}

function openActionMenu(unit: number): void {
  const u = unitById(state, unit);
  if (!u) return;
  const w = workOptions(state, u);
  const type = unitType(u.type);
  const items: [string, () => void][] = [];
  if (type.flags?.includes("settler") && canFoundCity(state, u.x, u.y) === null)
    items.push(["Found city (B)", () => { if (dispatch({ type: "found", unit })) { const c = cityAt(state, u.x, u.y); if (c) openCity(c.id); } }]);
  if (w.irrigate !== undefined) items.push([`Irrigate (I) ${w.irrigate}t`, () => dispatch({ type: "work", unit, work: "irrigate" })]);
  if (w.mine !== undefined) items.push([`Mine (M) ${w.mine}t`, () => dispatch({ type: "work", unit, work: "mine" })]);
  if (w.road !== undefined) items.push([`Road (R) ${w.road}t`, () => dispatch({ type: "work", unit, work: "road" })]);
  if (type.domain === "land") items.push(["Fortify (F)", () => dispatch({ type: "fortify", unit })]);
  items.push(["Sentry (S)", () => dispatch({ type: "sentry", unit })]);
  items.push(["Wait (W)", () => dispatch({ type: "wait", unit })]);
  items.push(["Skip turn (Space)", () => dispatch({ type: "skip", unit })]);
  items.push(["Disband (Shift+D)", () => dispatch({ type: "disband", unit })]);
  const atWarWith = state.players.filter((p) => p.id !== 0 && p.alive && p.id !== state.barbarians && atWar(state, 0, p.id));
  for (const p of atWarWith) items.push([`Make peace with ${p.name}`, () => dispatch({ type: "makePeace", player: p.id })]);
  screenState = {
    kind: "menu",
    under: screenState,
    menu: { title: `${type.name}: orders`, items: items.map((i) => i[0]), selected: 0 },
    onPick: (i) => { items[i]?.[1](); followActive(true); },
  };
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
  if (!("city" in ev)) {
    switch (ev.kind) {
      case "warDeclared": return `The ${state.players[ev.player]?.name} declare war!`;
      case "cityLost": return `${ev.name} has been destroyed!`;
      case "cityCaptured": return `${ev.name} captured!`;
      case "unitLost": return `${ev.unit} lost to the ${state.players[ev.by]?.name}`;
      case "barbarians": return "Barbarians have landed!";
      case "eliminated": return `The ${state.players[ev.player]?.name} civilization has been destroyed.`;
      default: return null;
    }
  }
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
    } else if (ev.kind === "contact") {
      openContactMenu(ev.player, next);
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
  const events: TurnEvent[] = [...lastTurnEvents];
  // Other civilizations move now; keep what concerns us.
  let guard = 0;
  while (state.currentPlayer !== 0 && guard++ < 16) {
    const ai = state.currentPlayer;
    aiTurn(state);
    applyCommand(state, { type: "endTurn" });
    for (const ev of lastTurnEvents) {
      if (ev.kind === "contact" && ev.player === 0) events.push({ kind: "contact", player: ai });
      else if ((ev.kind === "cityLost" || ev.kind === "cityCaptured") && ev.player === 0) events.push(ev);
      else if (ev.kind === "eliminated" || ev.kind === "barbarians") events.push(ev);
    }
  }
  // Our own start-of-turn events (contacts found as our turn begins, lost cities).
  for (const ev of lastTurnEvents) if (ev.kind === "contact" || ev.kind === "eliminated") events.push(ev);
  presentEvents(events);
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
    tryMove(active, mv[0], mv[1]);
    blinkOn = true;
    lastBlink = performance.now();
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
    case "Escape":
      if (active !== null) openActionMenu(active);
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
  if (px < VIEW_X) {
    // Minimap click: scroll there.
    if (py >= 2 && py < 52) centerOn(px, py - 2);
    return;
  }
  const tx = ((view.originX + Math.floor((px - VIEW_X) / TILE)) % state.map.width + state.map.width) % state.map.width;
  const ty = view.originY + Math.floor(py / TILE);
  if (ty < 0 || ty >= state.map.height) return;
  const active = state.activeUnit !== null ? unitById(state, state.activeUnit) : undefined;

  if (e.button === 2) {
    // Right-click: orders for the active unit, or centre the view.
    if (active) openActionMenu(active.id);
    else centerOn(tx, ty);
    return;
  }

  const city = cityAt(state, tx, ty);
  if (city && city.owner === state.currentPlayer && !(active && isAdjacent(active, tx, ty) && !(active.x === tx && active.y === ty))) {
    openCity(city.id);
    return;
  }
  if (active) {
    if (active.x === tx && active.y === ty) {
      // Click on the active unit: cycle through the stack.
      const stack = unitAt(state, tx, ty).filter((u) => u.owner === 0 && u.movesLeft > 0);
      const i = stack.findIndex((u) => u.id === active.id);
      const nextUnit = stack[(i + 1) % stack.length];
      if (nextUnit && nextUnit.id !== active.id) dispatch({ type: "activate", unit: nextUnit.id });
      return;
    }
    if (isAdjacent(active, tx, ty)) {
      let dx = tx - active.x;
      if (dx > 1) dx -= state.map.width;
      if (dx < -1) dx += state.map.width;
      const before = state.activeUnit;
      tryMove(active.id, dx, ty - active.y);
      followActive(state.activeUnit !== before);
      return;
    }
    const own = unitAt(state, tx, ty).find((u) => u.owner === 0 && u.movesLeft > 0);
    if (own) {
      dispatch({ type: "activate", unit: own.id });
      return;
    }
    const before = state.activeUnit;
    if (dispatch({ type: "goto", unit: active.id, x: tx, y: ty })) say("Going to...", 1500);
    followActive(state.activeUnit !== before);
    return;
  }
  const own = unitAt(state, tx, ty).find((u) => u.owner === 0);
  if (own) {
    dispatch({ type: "activate", unit: own.id });
    if (state.activeUnit !== own.id) say("No moves left this turn");
    return;
  }
  centerOn(tx, ty);
});

function isAdjacent(u: { x: number; y: number }, tx: number, ty: number): boolean {
  const w = state.map.width;
  return Math.abs(ty - u.y) <= 1 && Math.min(Math.abs(tx - u.x), w - Math.abs(tx - u.x)) <= 1;
}

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
