import { acceptsPeace, aiTurn } from "@civ/ai";
import {
  advance,
  applyCommand,
  atWar,
  availableAdvances,
  buildOptions,
  canFoundCity,
  canHelpWonder,
  canTradeRoute,
  checkGameEnd,
  CHEAT_GOLD,
  cityAt,
  civ,
  computeScore,
  defaultCityName,
  FINAL_TURN,
  formatYear,
  government,
  governmentsAvailable,
  hasContact,
  inciteCost,
  lastCombat,
  lastActions,
  lastTurnEvents,
  loadSave,
  makeSave,
  newGame,
  pillageTarget,
  productionCost,
  productionName,
  rankTitle,
  relation,
  routeBonus,
  runAiPlayers,
  shipStats,
  turnToYear,
  unitAt,
  unitById,
  unitType,
  workOptions,
  type Cheat,
  type Command,
  type DiplomatAction,
  type GameState,
  type HutResult,
  type NewGameOptions,
  type Production,
  type SaveGame,
  type TurnEvent,
  type CombatReport,
  type UnitAction,
} from "@civ/core";
import {
  canResearch,
  clampTechScroll,
  DIFFICULTIES,
  leaderLine,
  FogLifter,
  MotionPlayer,
  nextAvailable,
  openTechTree,
  setupChoose,
  setupMenu,
  setupOptions,
  techLayout,
  techScrollCentring,
  techScrollShowing,
  techStep,
  terrainInfo,
  TEXT_INPUT_MAX,
  type TechTreeView,
  type CityScreenView,
  type MainScreenView,
  type MenuState,
  type Renderer,
  type ReportPage,
  MENU_BAR,
  topCitiesReport,
  wondersReport,
  type SetupState,
  type TextInputState,
} from "@civ/renderer-api";
import { createModernRenderer } from "@civ/renderer-modern";
import { backingScale, canvas, configureDisplay, fitCanvas, toLogical } from "./display.js";
import { createRetroRenderer } from "./retro-renderer.js";
import { listSlots, readSlot, SLOTS, writeSlot } from "./storage.js";

// ---- renderer ----------------------------------------------------------------
/** Which visuals to use: ?renderer= on the URL, else the remembered choice, else retro. */
function rendererChoice(): string {
  const fromUrl = new URLSearchParams(location.search).get("renderer");
  if (fromUrl) return fromUrl;
  try { return localStorage.getItem("epochs.renderer") ?? "retro"; } catch { return "retro"; }
}

function createRenderer(id: string): Renderer {
  const r = id === "modern"
    ? createModernRenderer(canvas.getContext("2d", { alpha: false }) as unknown as Parameters<typeof createModernRenderer>[0], backingScale)
    : createRetroRenderer(canvas);
  configureDisplay(r.width, r.height, r.id === "retro");
  return r;
}

let renderer: Renderer = createRenderer(rendererChoice());

function setRenderer(id: string): void {
  renderer = createRenderer(id);
  try { localStorage.setItem("epochs.renderer", renderer.id); } catch { /* private mode */ }
  if (state) { cam.ready = false; followActive(true); }
}

addEventListener("resize", fitCanvas);

// ---- session ----------------------------------------------------------------
let state: GameState;
let options: NewGameOptions;
let log: Command[] = [];
let status: string | undefined;
let statusUntil = 0;
let blinkOn = true;
let lastBlink = 0;

function say(text: string, ms = 2500): void {
  status = text;
  statusUntil = performance.now() + ms;
}

const REASONS: Record<string, string> = {
  terrain: "Can't go there",
  rough: "Wheels need a road there",
  zoc: "Zone of control",
  "no-moves": "No moves left",
  full: "Ship is full",
  treaty: "We have a treaty",
  "no route": "No route there",
  "nothing to pillage": "Nothing to pillage here",
};

type Screen =
  | { kind: "title" }
  | { kind: "setup"; setup: SetupState }
  | { kind: "map" }
  | { kind: "city"; view: CityScreenView }
  | { kind: "techTree"; tree: TechTreeView; target: number; back: Screen; then: () => void }
  | { kind: "science" }
  | { kind: "rates" }
  | { kind: "advisor"; which: "domestic" | "military" | "foreign" | "score" }
  | { kind: "diplomacy"; player: number; line: string }
  | { kind: "end"; lines: string[]; rank: string }
  | { kind: "spaceship" }
  | { kind: "input"; input: TextInputState; onSubmit: (text: string) => void; under: Screen }
  | { kind: "menu"; menu: MenuState; onPick: (i: number) => void; under: Screen; onCancel?: () => void; bar?: number }
  | { kind: "report"; page: ReportPage }
  | { kind: "worldMap" };

let screenState: Screen = { kind: "title" };
const view: MainScreenView = { originX: 0, originY: 0, blink: true };
/** The camera in fractional tile units; it glides to each new target so the eye can follow. */
const cam = { x: 0, y: 0, fromX: 0, fromY: 0, toX: 0, toY: 0, start: 0, animating: false, ready: false };
const CAMERA_MS = 280;

/**
 * Units slide from square to square instead of jumping. The state has
 * already moved; this only times the drawing. Our own moves play at once
 * (a new order snaps any slide still running); after the other
 * civilizations' turns, the moves we could see on screen play back in order.
 */
const motion = new MotionPlayer();
/** Fog lifting off squares as they are explored. */
const lifter = new FogLifter();
const OWN_PACE = { stepMs: 120, maxMs: 1000, battleMs: 1600, battleTotalMs: 1600 };
const OTHERS_PACE = { stepMs: 110, maxMs: 2500, battleMs: 1400, battleTotalMs: 6000 };
/** Things to show once every slide has landed (a village's gift, an audience, the turn's news). */
const afterSlides: (() => void)[] = [];

function whenStill(fn: () => void): void {
  afterSlides.push(fn);
}

function resetMotion(): void {
  motion.clear();
  afterSlides.length = 0;
  handoff = null;
  view.focus = undefined;
}

/**
 * When a unit moves or fights and another unit takes over, the view stays
 * with the first one until its animation has played and a moment more, so
 * the player sees where it went or how the fight ended. Only then does the
 * camera glide to the next unit. A key or click in the meantime just ends
 * the wait: it is never taken as an order for a unit not yet shown.
 */
const HANDOFF_MS = 450;
let handoff: { from: number; idleSince: number | null } | null = null;

function finishHandoff(): void {
  if (!handoff) return;
  handoff = null;
  view.focus = undefined;
  blinkOn = true;
  lastBlink = performance.now();
  followActive(true);
}

/** After a move or goto: linger on the unit if it moved or fought and the turn passed to another unit. */
function afterUnitOrder(before: number | null, mark: number): void {
  const acted = lastActions.length > mark;
  if (acted && before !== null && state.activeUnit !== null && state.activeUnit !== before) {
    handoff = { from: before, idleSince: null };
    return;
  }
  followActive(state.activeUnit !== before);
}

/** Each frame: what the lingering view shows, and whether its wait is over. */
function stepHandoff(now: number, animating: boolean): void {
  if (!handoff) return;
  if (animating || screenState.kind !== "map") handoff.idleSince = null;
  else if (handoff.idleSince === null) handoff.idleSince = now;
  else if (now - handoff.idleSince >= HANDOFF_MS) { finishHandoff(); return; }
  const from = handoff.from;
  view.focus = state.units.some((u) => u.id === from) ? from : null;
}

/** Show what our units just did: slides along their steps, and any fight. */
function slideOwn(actions: readonly UnitAction[]): void {
  if (!actions.length) return;
  motion.clear();
  motion.play(actions, performance.now(), { ...OWN_PACE, width: state.map.width });
}

/** True if a square is in (or one square around) the part of the map on screen. */
function onScreen(x: number, y: number): boolean {
  const w = state.map.width;
  const rx = (((x - view.originX) % w) + w) % w;
  const ry = y - view.originY;
  return (rx <= renderer.viewTilesX || rx >= w - 1) && ry >= -1 && ry <= renderer.viewTilesY;
}

/** Steps and fights out of our turn that we could have watched: seen squares on screen. */
function watchable(actions: readonly UnitAction[]): UnitAction[] {
  const me = state.players[0]!;
  const w = state.map.width;
  const sees = (x: number, y: number) => me.visible[y * w + x] === 1 && onScreen(x, y);
  return actions.filter((a) => a.kind === "step"
    ? sees(a.fromX, a.fromY) || sees(a.toX, a.toY)
    : sees(a.attacker.x, a.attacker.y) || sees(a.defender.x, a.defender.y));
}

/** The turn ends by itself once nothing needs orders (game menu toggles it; remembered per browser). */
let autoEnd = (() => { try { return localStorage.getItem("epochs.autoEnd") !== "off"; } catch { return true; } })();
let lastInput = 0;
let lastAutoEnd = 0;
function setAutoEnd(on: boolean): void {
  autoEnd = on;
  try { localStorage.setItem("epochs.autoEnd", on ? "on" : "off"); } catch { /* private mode */ }
}

/** Civilization borders on the map (game menu toggles them; remembered per browser). The original has none. */
let borders = (() => { try { return localStorage.getItem("epochs.borders") !== "off"; } catch { return true; } })();
function setBorders(on: boolean): void {
  borders = on;
  try { localStorage.setItem("epochs.borders", on ? "on" : "off"); } catch { /* private mode */ }
}

/**
 * Civilizations already introduced to the player. Contact is read from the
 * relations after every action and every AI round (the turn's event list
 * is cleared at each end of turn, so a meeting during another civ's move
 * would otherwise go unannounced).
 */
const announced = new Set<number>();

function newContacts(): TurnEvent[] {
  const out: TurnEvent[] = [];
  for (const p of state.players) {
    if (p.id === 0 || p.id === state.barbarians || !p.alive || announced.has(p.id) || !hasContact(state, 0, p.id)) continue;
    announced.add(p.id);
    out.push({ kind: "contact", player: p.id });
  }
  return out;
}

/** After one of our actions: villages our units entered and civilizations we just met, each in its own window. */
function afterAction(): void {
  const events: TurnEvent[] = [];
  for (let i = 0; i < lastTurnEvents.length; ) {
    const ev = lastTurnEvents[i]!;
    if (ev.kind === "hut" && ev.player === 0) { events.push(ev); lastTurnEvents.splice(i, 1); } else i++;
  }
  events.push(...newContacts());
  if (events.length) whenStill(() => presentEvents(events));
}

function dispatch(cmd: Command): boolean {
  view.inspect = undefined;
  const mark = lastActions.length;
  const r = applyCommand(state, cmd);
  if (r.ok) {
    log.push(cmd);
    if (cmd.type !== "endTurn") slideOwn(lastActions.slice(mark));
    if (cmd.type === "move" && lastCombat) reportCombat(lastCombat);
    if (cmd.type !== "endTurn") afterAction();
  } else say(REASONS[r.reason] ?? r.reason);
  blinkOn = true;
  lastBlink = performance.now();
  return r.ok;
}

/** The outcome of our attack, said once the fight has played out (with the survivor's wounds). */
function reportCombat(report: CombatReport): void {
  const c = { ...report };
  const them = state.players[c.defenderOwner]!.name;
  const a = unitType(c.attackerType).name;
  const d = unitType(c.defenderType).name;
  const [hp, max] = c.attackerWon ? [c.attackerHp, c.attackerMaxHp] : [c.defenderHp, c.defenderMaxHp];
  const wounds = hp < max ? ` (${hp}/${max} hp left)` : "";
  whenStill(() => say(c.attackerWon ? `${a} defeats ${them} ${d}${wounds}` : `${a} lost to ${them} ${d}${wounds}`, 3500));
}

// ---- game start -------------------------------------------------------------
function startGame(opts: NewGameOptions, seed = (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0): void {
  options = opts;
  state = newGame(seed, opts);
  log = [];
  announced.clear();
  resetMotion();
  screenState = { kind: "map" };
  cam.ready = false;
  followActive(true);
  say(`${civ(state.players[0]!.civ).leader}, lead the ${state.players[0]!.name} to glory.`, 4000);
}

function resumeGame(save: SaveGame): void {
  try {
    const loaded = loadSave(save, aiTurn);
    state = loaded.state;
    log = loaded.log;
    options = loaded.options; // an old save keeps its one-roll fights
    announced.clear();
    resetMotion();
    for (const p of state.players) if (p.id !== 0 && hasContact(state, 0, p.id)) announced.add(p.id);
    screenState = { kind: "map" };
    cam.ready = false;
    followActive(true);
    say(`Loaded: ${formatYear(turnToYear(state.turn))}`);
  } catch (err) {
    say(`Load failed: ${(err as Error).message}`, 4000);
  }
}

const params = new URLSearchParams(location.search);
if (params.has("seed")) {
  startGame(
    {
      difficulty: Number(params.get("difficulty") ?? 2),
      opponents: Number(params.get("opponents") ?? 6),
      ...(params.get("civ") ? { civ: params.get("civ")! } : {}),
      ...(params.get("world") ? { world: params.get("world")!, historical: params.get("historical") !== "0" } : {}),
      ...(params.get("combat") === "classic" ? { classicCombat: true } : {}),
      ...(params.get("terrain") === "classic" ? { classicTerrain: true } : {}),
    },
    Number(params.get("seed")) || 2026,
  );
}

// ---- view helpers -----------------------------------------------------------
function applyCamera(): void {
  view.originX = Math.floor(cam.x);
  view.panX = cam.x - view.originX;
  view.originY = Math.floor(cam.y);
  view.panY = cam.y - view.originY;
}

function centerOn(x: number, y: number, instant = false): void {
  const tx = renderer.viewTilesX;
  const ty = renderer.viewTilesY;
  const w = state.map.width;
  const targetX = ((x - (tx >> 1)) % w + w) % w;
  const targetY = Math.max(0, Math.min(state.map.height - ty, y - (ty >> 1)));
  if (instant || !cam.ready || screenState.kind !== "map") {
    cam.x = targetX;
    cam.y = targetY;
    cam.animating = false;
    cam.ready = true;
    applyCamera();
    return;
  }
  // Shortest way round the world's seam.
  let dx = ((targetX - cam.x) % w + w) % w;
  if (dx > w / 2) dx -= w;
  if (Math.abs(dx) < 0.01 && Math.abs(targetY - cam.y) < 0.01) return;
  cam.fromX = cam.x;
  cam.fromY = cam.y;
  cam.toX = cam.x + dx;
  cam.toY = targetY;
  cam.start = performance.now();
  cam.animating = true;
}

function stepCamera(now: number): void {
  if (!cam.animating) return;
  const t = Math.min(1, (now - cam.start) / CAMERA_MS);
  const e = 1 - Math.pow(1 - t, 3);
  cam.x = cam.fromX + (cam.toX - cam.fromX) * e;
  cam.y = cam.fromY + (cam.toY - cam.fromY) * e;
  if (t >= 1) {
    cam.animating = false;
    const w = state.map.width;
    cam.x = ((cam.x % w) + w) % w;
  }
  applyCamera();
}

function followActive(force = false): void {
  if (handoff || state.activeUnit === null) return;
  const u = unitById(state, state.activeUnit);
  if (!u) return;
  const w = state.map.width;
  const rx = (((u.x - view.originX) % w) + w) % w;
  const ry = u.y - view.originY;
  if (force || rx < 2 || rx > renderer.viewTilesX - 3 || ry < 2 || ry > renderer.viewTilesY - 3) centerOn(u.x, u.y);
}

function isAdjacent(u: { x: number; y: number }, tx: number, ty: number): boolean {
  const w = state.map.width;
  return Math.abs(ty - u.y) <= 1 && Math.min(Math.abs(tx - u.x), w - Math.abs(tx - u.x)) <= 1;
}

// ---- menus ------------------------------------------------------------------
function menu(title: string, items: string[], onPick: (i: number) => void, extra: Partial<Extract<Screen, { kind: "menu" }>> = {}): void {
  screenState = { kind: "menu", under: screenState, menu: { title, items, selected: 0 }, onPick, ...extra };
}

function openCity(id: number): void {
  screenState = { kind: "city", view: { city: id } };
}

/** A modal window: a title, a few paragraphs, and choices (just "OK" for a message). */
function modal(title: string, body: string[], items: string[], onPick: (i: number) => void, selected = 0, onCancel?: () => void): void {
  screenState = { kind: "menu", under: screenState, menu: { title, body, items, selected }, onPick, ...(onCancel ? { onCancel } : {}) };
}

/** What a tribal village held, in a window like the original's. */
function hutModal(r: HutResult, then: () => void): void {
  const body = r.kind === "gold" ? [`The elders welcome you with a gift of ${r.amount} gold.`]
    : r.kind === "advance" ? ["Among the villagers you find scrolls of ancient wisdom.", `We learn ${advance(r.advance).name}!`]
    : r.kind === "unit" ? [`The village warriors swear allegiance: a unit of ${unitType(r.unit).name} joins you.`]
    : r.kind === "barbarians" ? ["The village was a trap!", "A horde of barbarians bursts from the huts."]
    : ["The village stands empty; its people are long gone."];
  // Scrolls found go on to the tech tree, like any advance found.
  const after = r.kind === "advance" ? () => showFound([r.advance], then) : then;
  modal("A Tribal Village", body, ["OK"], () => after(), 0, after);
}

/** Right-click on the map: what is known about the square, with a few things to do about it. */
function openTerrainInfo(tx: number, ty: number): void {
  const info = terrainInfo(state, tx, ty);
  const active = state.activeUnit !== null ? unitById(state, state.activeUnit) : undefined;
  const items: [string, () => void][] = [];
  if (active && !(active.x === tx && active.y === ty))
    items.push([`Send the ${unitType(active.type).name} here`, () => {
      const before = state.activeUnit;
      const mark = lastActions.length;
      if (dispatch({ type: "goto", unit: active.id, x: tx, y: ty })) say("Going to...", 1500);
      afterUnitOrder(before, mark);
    }]);
  const city = cityAt(state, tx, ty);
  if (city && city.owner === 0) items.push(["Open the city", () => openCity(city.id)]);
  items.push(["Center the map here", () => centerOn(tx, ty)]);
  items.push(["Close", () => {}]);
  modal(info.title, info.lines, items.map((i) => i[0]), (i) => items[i]?.[1](), items.length - 1);
}

/** Ask for a line of text in-game (no browser prompt): Enter submits, Esc cancels. */
function askText(title: string, initial: string, onSubmit: (text: string) => void): void {
  screenState = { kind: "input", input: { title, text: initial, maxLength: TEXT_INPUT_MAX }, onSubmit, under: screenState };
}

/** Found a city with the active settlers after asking for its name, then open it. */
function foundWithName(unit: number): void {
  const u = unitById(state, unit);
  if (!u) return;
  const why = canFoundCity(state, u.x, u.y);
  if (why) { say(why); return; }
  askText("Name the new city", defaultCityName(state, 0), (name) => {
    if (dispatch({ type: "found", unit, name })) { const c = cityAt(state, u.x, u.y); if (c) openCity(c.id); }
    followActive(true);
  });
}

function inputKey(e: KeyboardEvent, sc: Extract<Screen, { kind: "input" }>): void {
  const inp = sc.input;
  if (e.code === "Escape") { screenState = sc.under; return; }
  if (e.code === "Enter" || e.code === "NumpadEnter") { screenState = sc.under; if (inp.text.trim()) sc.onSubmit(inp.text.trim()); return; }
  if (e.code === "Backspace") { inp.text = inp.text.slice(0, -1); return; }
  if (e.key.length === 1 && inp.text.length < inp.maxLength) inp.text += e.key;
}

function openProductionMenu(cityId: number): void {
  const city = state.cities.find((c) => c.id === cityId)!;
  const opts = buildOptions(state, city);
  screenState = {
    kind: "menu",
    under: screenState,
    menu: {
      title: `${city.name}: build what?`,
      items: opts.map((p) => productionName(p)),
      right: opts.map((p) => {
        const t = p.kind === "unit" ? unitType(p.id) : null;
        return t ? `${t.attack}/${t.defense}/${t.moves} ${productionCost(p)}` : `${productionCost(p)}`;
      }),
      selected: Math.max(0, opts.findIndex((p) => p.kind === city.production.kind && p.id === city.production.id)),
    },
    onPick: (i) => {
      const p: Production | undefined = opts[i];
      if (p) dispatch({ type: "setProduction", city: cityId, production: p });
    },
  };
}

// ---- the tech tree ---------------------------------------------------------------
type TreeScreen = Extract<Screen, { kind: "techTree" }>;

/**
 * Open the tech tree window. `then` runs once it closes (the next of the turn's
 * events), and `back` is the screen it closes onto. When research is due it can
 * only be left by picking the next advance, as the wise men insist.
 */
function openTree(opts: { discovered?: string[]; choosing: boolean; closable: boolean }, then: () => void = () => {}, back: Screen = { kind: "map" }): void {
  const choosing = opts.choosing && availableAdvances(state.players[0]!.advances).length > 0;
  const tree = openTechTree(state, renderer.techColumns, { ...opts, choosing, closable: opts.closable || !choosing });
  screenState = { kind: "techTree", tree, target: tree.scroll, back, then };
}

/** Advances gained along the way (a village, a diplomat, a treaty): the tree shows them, and the research can be changed there. */
function showFound(ids: string[], then: () => void = () => {}): void {
  if (!ids.length) { then(); return; }
  openTree({ discovered: ids, choosing: true, closable: true }, then, screenState);
}

/** The research is due: pick the next advance in the tree. */
function askResearch(then: () => void = () => {}): void {
  if (!availableAdvances(state.players[0]!.advances).length) { then(); return; }
  openTree({ choosing: true, closable: false }, then);
}

function closeTree(sc: TreeScreen): void {
  screenState = sc.back;
  sc.then();
}

function pickResearch(sc: TreeScreen): void {
  if (!canResearch(state, sc.tree)) return;
  if (dispatch({ type: "research", advance: sc.tree.selected })) say(`Researching ${advance(sc.tree.selected).name}`);
  closeTree(sc);
}

/** Select an advance, scrolling just enough to show it whole. */
function treeSelect(sc: TreeScreen, id: string): void {
  sc.tree.selected = id;
  sc.target = techScrollShowing(sc.target, techLayout().byId.get(id)!.tier, renderer.techColumns);
}

function treeScroll(sc: TreeScreen, to: number): void {
  sc.target = clampTechScroll(to, renderer.techColumns);
}

function treeKey(e: KeyboardEvent, sc: TreeScreen): void {
  const t = sc.tree;
  switch (e.code) {
    case "ArrowLeft": case "Numpad4": treeSelect(sc, techStep(t.selected, -1, 0)); break;
    case "ArrowRight": case "Numpad6": treeSelect(sc, techStep(t.selected, 1, 0)); break;
    case "ArrowUp": case "Numpad8": treeSelect(sc, techStep(t.selected, 0, -1)); break;
    case "ArrowDown": case "Numpad2": treeSelect(sc, techStep(t.selected, 0, 1)); break;
    case "Tab": e.preventDefault(); if (t.choosing) treeSelect(sc, nextAvailable(state, t.selected, e.shiftKey ? -1 : 1)); break;
    case "PageUp": treeScroll(sc, sc.target - Math.floor(renderer.techColumns)); break;
    case "PageDown": treeScroll(sc, sc.target + Math.floor(renderer.techColumns)); break;
    case "Enter": case "NumpadEnter": case "Space":
      e.preventDefault();
      if (canResearch(state, t)) pickResearch(sc);
      else if (t.choosing) treeSelect(sc, nextAvailable(state, t.selected));
      else closeTree(sc);
      break;
    case "Escape": if (t.closable) closeTree(sc); break;
  }
}

/** A click on the tree: an advance shows what it brings, and a second click on one within reach picks it. */
function treeClick(sc: TreeScreen, px: number, py: number): void {
  const hit = renderer.techTreeHit(state, sc.tree, px, py);
  if (!hit) return;
  switch (hit.kind) {
    case "advance":
      if (hit.id === sc.tree.selected && canResearch(state, sc.tree)) pickResearch(sc);
      else treeSelect(sc, hit.id);
      break;
    case "research": pickResearch(sc); break;
    case "close": closeTree(sc); break;
    case "scroll": treeScroll(sc, sc.target + hit.by); break;
    case "scrollTo": sc.target = techScrollCentring(hit.tier, renderer.techColumns); break;
  }
}

let treeFrameAt = 0;
/** The tree's view glides to its scroll target; the visuals may have changed under it. */
function stepTree(sc: TreeScreen, t: number): void {
  const dt = Math.min(100, t - treeFrameAt);
  treeFrameAt = t;
  sc.target = clampTechScroll(sc.target, renderer.techColumns);
  const tree = sc.tree;
  const gap = sc.target - tree.scroll;
  tree.scroll = Math.abs(gap) < 0.01 ? sc.target : tree.scroll + gap * Math.min(1, dt / 90);
  tree.blink = blinkOn;
}

function openGovernmentMenu(under: Screen, then?: () => void): void {
  const ids = governmentsAvailable(state, 0);
  screenState = {
    kind: "menu",
    under,
    menu: { title: "Choose a new government", items: ids.map((g) => government(g).name), selected: 0 },
    onPick: (i) => { const g = ids[i]; if (g) dispatch({ type: "setGovernment", government: g }); then?.(); },
  };
}

function openWarMenu(player: number, then?: () => void): void {
  const name = state.players[player]!.name;
  menu(`Declare war on the ${name}?`, ["No, keep the peace", "Yes, declare war!"], (i) => {
    if (i === 1) {
      dispatch({ type: "declareWar", player });
      say(`War with the ${name}!`, 3000);
      then?.();
    }
  });
}

/** A diplomat at a foreign gate: steal, sabotage or buy the city. */
function openDiplomatMenu(unit: number, cityId: number): void {
  const city = state.cities.find((c) => c.id === cityId);
  if (!city) return;
  const cost = inciteCost(state, city);
  const run = (action: DiplomatAction) => () => {
    if (dispatch({ type: "diplomat", unit, action, x: city.x, y: city.y })) {
      const ev = lastTurnEvents.find((e) => e.kind === "spy");
      const m = ev && eventMessage(ev);
      if (m) say(m, 4000);
      const stolen = lastTurnEvents.flatMap((e) => (e.kind === "discovered" ? [e.advance] : []));
      lastTurnEvents.length = 0;
      showFound(stolen);
    }
  };
  const items: [string, () => void][] = [
    ["Steal technology", run("steal")],
    ["Sabotage", run("sabotage")],
    [Number.isFinite(cost) ? `Incite revolt (${cost} gold)` : "Incite revolt (capital: impossible)", run("incite")],
    ["Never mind", () => {}],
  ];
  menu(`${city.name} (${state.players[city.owner]!.name}): our diplomat...`, items.map((i) => i[0]), (i) => items[i]?.[1]());
}

/** A menu entry: its label, the key that does the same on the map, and what it does. */
type MenuEntry = [label: string, key: string, run: () => void];

/** What the active unit can be ordered to do, with each order's key. */
function unitOrders(unit: number): MenuEntry[] {
  const u = unitById(state, unit);
  if (!u) return [];
  const w = workOptions(state, u);
  const type = unitType(u.type);
  const items: MenuEntry[] = [];
  if (type.flags?.includes("settler") && canFoundCity(state, u.x, u.y) === null) items.push(["Found city", "B", () => foundWithName(unit)]);
  if (w.irrigate !== undefined) items.push([`Irrigate (${w.irrigate} turns)`, "I", () => dispatch({ type: "work", unit, work: "irrigate" })]);
  if (w.mine !== undefined) items.push([`Mine (${w.mine} turns)`, "M", () => dispatch({ type: "work", unit, work: "mine" })]);
  if (w.road !== undefined) items.push([`Road (${w.road} turns)`, "R", () => dispatch({ type: "work", unit, work: "road" })]);
  if (w.railroad !== undefined) items.push([`Railroad (${w.railroad} turns)`, "R", () => dispatch({ type: "work", unit, work: "railroad" })]);
  if (w.fortress !== undefined) items.push([`Fortress (${w.fortress} turns)`, "F", () => dispatch({ type: "work", unit, work: "fortress" })]);
  if (w.clean !== undefined) items.push([`Clean pollution (${w.clean} turns)`, "P", () => dispatch({ type: "work", unit, work: "clean" })]);
  const loot = pillageTarget(state, u);
  if (loot) items.push([`Pillage ${loot}`, "P", () => dispatch({ type: "pillage", unit })]);
  if (type.flags?.includes("caravan")) {
    const c = cityAt(state, u.x, u.y);
    if (c && canHelpWonder(state, u, c) === null) items.push(["Help build wonder", "", () => dispatch({ type: "helpWonder", unit })]);
    if (c && canTradeRoute(state, u, c) === null && u.homeCity !== null)
      items.push([`Establish trade route (+${routeBonus(state, state.cities.find((h) => h.id === u.homeCity)!, c)})`, "", () => dispatch({ type: "tradeRoute", unit })]);
  }
  if (type.flags?.includes("diplomat")) {
    for (const c of state.cities) {
      if (c.owner === 0 || c.owner === state.barbarians || !isAdjacent(u, c.x, c.y)) continue;
      items.push([`Diplomat: ${c.name}`, "", () => openDiplomatMenu(unit, c.id)]);
    }
  }
  if (type.domain === "land") items.push(["Fortify", "F", () => dispatch({ type: "fortify", unit })]);
  items.push(["Sentry", "S", () => dispatch({ type: "sentry", unit })]);
  items.push(["Wait", "W", () => dispatch({ type: "wait", unit })]);
  items.push(["Skip turn", "Space", () => dispatch({ type: "skip", unit })]);
  items.push(["Disband", "Shift+D", () => dispatch({ type: "disband", unit })]);
  return items;
}

function openActionMenu(unit: number): void {
  const u = unitById(state, unit);
  if (!u) return;
  const items = unitOrders(unit);
  screenState = {
    kind: "menu",
    under: screenState,
    menu: { title: `${unitType(u.type).name}: orders`, items: items.map((i) => i[0]), right: items.map((i) => i[1]), selected: 0 },
    onPick: (i) => { items[i]?.[2](); followActive(true); },
  };
}

/** Start a revolution, or pick the new government once anarchy is over (G). */
function askRevolution(): void {
  const p = state.players[0]!;
  if (p.government === "anarchy") {
    if (p.anarchyTurns === 0) openGovernmentMenu({ kind: "map" }); else say("Still in anarchy");
    return;
  }
  menu("Start a revolution?", ["No", "Yes, overthrow the government"], (i) => {
    if (i === 1) { dispatch({ type: "revolution" }); say("Revolution! Anarchy reigns.", 3000); }
  });
}

/** Find City: our cities by name; the map centres on the one picked. */
function openFindCity(): void {
  const mine = state.cities.filter((c) => c.owner === 0).sort((a, b) => a.name.localeCompare(b.name));
  if (!mine.length) { say("We have no cities yet."); return; }
  menu("Find which city?", mine.map((c) => `${c.name} (${c.size})`), (i) => { const c = mine[i]; if (c) { centerOn(c.x, c.y); view.inspect = { x: c.x, y: c.y }; } });
}

/** The entries of one menu bar dropdown, built fresh each time it opens. */
function barEntries(index: number): MenuEntry[] {
  switch (MENU_BAR[index]) {
    case "Game":
      return [
        ["Tax Rate", "T", () => { screenState = { kind: "rates" }; }],
        ["Find City", "", () => openFindCity()],
        ["Revolution!", "G", () => askRevolution()],
        [`Auto End Turn: ${autoEnd ? "On" : "Off"}`, "", () => { setAutoEnd(!autoEnd); say(`Auto end turn ${autoEnd ? "on" : "off"}`); }],
        [`Borders: ${borders ? "On" : "Off"}`, "", () => { setBorders(!borders); say(`Borders ${borders ? "on" : "off"}`); }],
        [`Visuals: ${renderer.id === "retro" ? "Retro" : "Modern"}`, "", () => setRenderer(renderer.id === "retro" ? "modern" : "retro")],
        ["Save Game", "", () => void openSaveMenu()],
        ["Load Game", "", () => void openLoadMenu()],
        ["Retire", "", () => endGame({ kind: "time" })],
        ["New Game", "", () => { screenState = { kind: "title" }; }],
      ];
    case "Orders": {
      const active = state.activeUnit;
      if (active === null) return [["End Turn", "Enter", () => endTurn()]];
      return unitOrders(active).map(([l, k, run]): MenuEntry => [l, k, () => { run(); followActive(true); }]);
    }
    case "Advisors":
      return [
        ["City Status", "F1", () => { screenState = { kind: "advisor", which: "domestic" }; }],
        ["Military Advisor", "F2", () => { screenState = { kind: "advisor", which: "military" }; }],
        ["Foreign Minister", "F3", () => { screenState = { kind: "advisor", which: "foreign" }; }],
        ["Science Advisor", "F4", () => { screenState = { kind: "science" }; }],
        ["Tech Tree", "", () => openTree({ choosing: true, closable: true })],
      ];
    case "World":
      return [
        ["Wonders of the World", "", () => { screenState = { kind: "report", page: wondersReport(state) }; }],
        ["Top 5 Cities", "", () => { screenState = { kind: "report", page: topCitiesReport(state) }; }],
        ["Civilization Score", "F5", () => { screenState = { kind: "advisor", which: "score" }; }],
        ["World Map", "", () => { screenState = { kind: "worldMap" }; }],
        ["Spaceships", "F6", () => { screenState = { kind: "spaceship" }; }],
      ];
    case "Debug":
      return [
        ["Reveal Map", "", () => cheat("revealMap", "The whole world is charted.")],
        [`+${CHEAT_GOLD} Gold`, "", () => cheat("gold", `+${CHEAT_GOLD} gold`)],
        ["Finish Research", "", () => cheat("research")],
        ["Learn All Advances", "", () => cheat("allAdvances", "Every advance is ours.")],
        ["Finish Production", "", () => cheat("production", "Cities finish their builds this turn.")],
        ["Restore Units", "", () => { cheat("moves", "Units rested and ready."); followActive(true); }],
        ["Meet Everyone", "", () => cheat("contact")],
      ];
    default:
      return [];
  }
}

/** A debug menu action, then whatever it brought: a discovery and the research prompt (new neighbours come through `afterAction`). */
function cheat(c: Cheat, message?: string): void {
  if (!dispatch({ type: "cheat", cheat: c })) return;
  if (message) say(message);
  const events: TurnEvent[] = [];
  for (let i = 0; i < lastTurnEvents.length; ) {
    const ev = lastTurnEvents[i]!;
    if (ev.kind === "discovered" || ev.kind === "chooseResearch") { events.push(ev); lastTurnEvents.splice(i, 1); } else i++;
  }
  if (events.length) presentEvents(events);
}

/** Open a menu bar dropdown over the map. */
function openBarMenu(index: number): void {
  const n = MENU_BAR.length;
  const i = ((index % n) + n) % n;
  const items = barEntries(i);
  screenState = {
    kind: "menu",
    under: { kind: "map" },
    bar: i,
    menu: { title: "", items: items.map((e) => e[0]), right: items.map((e) => e[1]), selected: 0, anchor: renderer.menuBarAnchor(i) },
    onPick: (k) => items[k]?.[2](),
  };
}

/** The game menu (F10, or Esc with no unit): the bar's Game dropdown. */
function openGameMenu(): void {
  openBarMenu(0);
}

async function openSaveMenu(): Promise<void> {
  const slots = await listSlots();
  const items = slots.map((s, i) => (i === 0 ? "(autosave)" : s ? `${i}. ${s.civ}, ${formatYear(turnToYear(s.turn))}` : `${i}. empty`));
  menu("Save to slot", items, (i) => {
    if (i === 0) return;
    void writeSlot(i, makeSave(state, options, log)).then(() => say(`Saved to slot ${i}`));
  });
}

async function openLoadMenu(): Promise<void> {
  const slots = await listSlots();
  const items = slots.map((s, i) => (s ? `${i === 0 ? "auto" : i}. ${s.civ}, ${formatYear(turnToYear(s.turn))}` : `${i === 0 ? "auto" : i}. empty`));
  menu("Load which game?", items, (i) => {
    void readSlot(i).then((s) => { if (s) resumeGame(s); else say("Empty slot"); });
  });
}

function openDiplomacy(player: number): void {
  screenState = { kind: "diplomacy", player, line: leaderLine(state, player) };
  const me = state.players[0]!;
  const them = state.players[player]!;
  const r = relation(state, 0, player);
  const items: [string, () => void][] = [];
  if (r === "war") items.push(["Propose peace", () => {
    // A rival that is winning, with its armies at our gates, will not stop now.
    if (!acceptsPeace(state, player, 0)) { say(`${civ(them.civ).leader} refuses: "Not while our armies stand at your gates."`, 4000); return; }
    dispatch({ type: "makePeace", player });
    say("Peace is agreed.");
  }]);
  else items.push(["Declare war", () => openWarMenu(player)]);
  const theirsOnly = them.advances.filter((a) => !me.advances.includes(a));
  const mineOnly = me.advances.filter((a) => !them.advances.includes(a));
  if (r !== "war" && theirsOnly.length && mineOnly.length)
    items.push(["Exchange knowledge", () => {
      // Offer our first unique advance for their first; good enough until a bargaining screen.
      const give = mineOnly[0]!;
      const receive = theirsOnly[0]!;
      menu(`Trade ${advance(give).name} for ${advance(receive).name}?`, ["Yes", "No"], (i) => {
        if (i === 0 && dispatch({ type: "exchangeAdvances", player, give, receive })) { say(`We learn ${advance(receive).name}.`, 3000); showFound([receive]); }
      });
    }]);
  if (me.gold >= 50) items.push(["Give 50 gold as tribute", () => { dispatch({ type: "giveGold", player, amount: 50 }); say("The gift is accepted."); }]);
  items.push(["Farewell", () => {}]);
  screenState = {
    kind: "menu",
    under: screenState,
    menu: { title: "Your proposal?", items: items.map((i) => i[0]), selected: 0 },
    onPick: (i) => { items[i]?.[1](); if (screenState.kind === "diplomacy") screenState = { kind: "map" }; },
    onCancel: () => { screenState = { kind: "map" }; },
  };
}

function openForeignTalkMenu(): void {
  const known = state.players.filter((p) => p.id !== 0 && p.alive && p.id !== state.barbarians && hasContact(state, 0, p.id));
  if (!known.length) { say("We have met no one."); return; }
  menu("Send an emissary to...", known.map((p) => p.name), (i) => { const p = known[i]; if (p) openDiplomacy(p.id); });
}

// ---- turn flow --------------------------------------------------------------
function eventMessage(ev: TurnEvent): string | null {
  if (!("city" in ev)) {
    switch (ev.kind) {
      case "warDeclared": return `The ${state.players[ev.player]?.name} declare war!`;
      case "cityLost": return ev.by === state.barbarians ? `Barbarians sack ${ev.name}!` : `${ev.name} has been destroyed!`;
      case "cityCaptured":
        return ev.by === state.barbarians ? `Barbarians capture ${ev.name}!`
          : ev.player === state.barbarians ? `${ev.name} is freed from the barbarians!`
          : `${ev.name} captured!`;
      case "unitLost": return `${ev.unit} lost to the ${state.players[ev.by]?.name}`;
      case "barbarians": return ev.sea ? `Barbarian ships sighted off ${ev.near}!` : `Barbarians rise up near ${ev.near}!`;
      case "ransom": return `Barbarian leader captured! ${ev.amount} gold ransom.`;
      case "eliminated": return `The ${state.players[ev.player]?.name} civilization has been destroyed.`;
      case "tradeRoute": return `Trade route ${ev.from}-${ev.to}: +${ev.bonus} gold and science`;
      case "globalWarming": return "Global warming! Fields wither and forests turn to jungle.";
      case "spaceLaunched": return ev.player === 0 ? "Our spaceship is on its way." : `The ${state.players[ev.player]?.name} have launched a spaceship!`;
      case "spaceArrived": return ev.player === 0 ? "Our colonists have landed!" : `The ${state.players[ev.player]?.name} have reached their new world.`;
      case "spaceLost": return ev.player === 0 ? "Our spaceship is lost!" : `The ${state.players[ev.player]?.name} spaceship is lost.`;
      case "nuked": return ev.stopped ? "SDI Defense destroys the missile!" : ev.by === 0 ? "Nuclear detonation!" : `The ${state.players[ev.by]?.name} have used a nuclear weapon!`;
      case "spy": return ev.action === "steal" ? `Our diplomat steals ${ev.detail} from ${ev.target}!`
        : ev.action === "sabotage" ? `Our diplomat wrecks ${ev.target}: ${ev.detail} destroyed.`
        : `${ev.target} revolts and joins us!`;
      case "hut": {
        const r = ev.result;
        return r.kind === "gold" ? `The tribe gives you ${r.amount} gold.`
          : r.kind === "advance" ? `Scrolls of ancient wisdom: ${advance(r.advance).name}!`
          : r.kind === "unit" ? `A band of ${unitType(r.unit).name} joins you.`
          : r.kind === "barbarians" ? "You have unleashed a horde of barbarians!"
          : "The village is deserted.";
      }
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
    case "sold": return `${name} sells its ${ev.detail} to pay the bills`;
    case "pollution": return `Pollution near ${name}!`;
  }
}

/** Play the turn's events as a chain of screens, then land on the map. */
function presentEvents(events: TurnEvent[], done?: () => void): void {
  const next = (): void => {
    const ev = events.shift();
    if (!ev) {
      screenState = { kind: "map" };
      followActive(true);
      done?.();
      return;
    }
    if (ev.kind === "discovered") {
      // Everything found this turn (research, Darwin's Voyage, the Great Library) shares one window,
      // and when the research is due the next advance is picked there.
      const found = [ev.advance];
      for (let i = 0; i < events.length; ) {
        const e = events[i]!;
        if (e.kind === "discovered") { found.push(e.advance); events.splice(i, 1); } else i++;
      }
      const due = events.findIndex((e) => e.kind === "chooseResearch");
      if (due >= 0) events.splice(due, 1);
      openTree({ discovered: found, choosing: true, closable: due < 0 }, next);
    }
    else if (ev.kind === "hut") hutModal(ev.result, next);
    else if (ev.kind === "contact") {
      const c = civ(state.players[ev.player]!.civ);
      screenState = { kind: "diplomacy", player: ev.player, line: `${c.leader} of the ${c.name} greets you.` };
      menu("Your reply?", ["Exchange peace treaty", "Declare war"], (i) => {
        if (i === 1) dispatch({ type: "declareWar", player: ev.player });
        else dispatch({ type: "makePeace", player: ev.player });
        next();
      }, { onCancel: next });
    } else if (ev.kind === "chooseResearch") askResearch(next);
    else if (ev.kind === "chooseGovernment") openGovernmentMenu({ kind: "map" }, next);
    else {
      const msg = eventMessage(ev);
      if (msg) say(msg, 4000);
      next();
    }
  };
  next();
}

function endGame(end: NonNullable<ReturnType<typeof checkGameEnd>>): void {
  const me = computeScore(state, 0);
  const lines = [
    end.kind === "conquest" ? (end.winner === 0 ? "You have conquered the world!" : `The ${state.players[end.winner]!.name} rule the world.`)
      : end.kind === "space" ? (end.winner === 0 ? "Your colonists have reached a new world!" : `The ${state.players[end.winner]!.name} have colonized the stars.`)
      : end.kind === "defeat" ? "Your civilization has been destroyed." : `The year is ${formatYear(turnToYear(state.turn))}. Your reign ends.`,
    "",
    `Citizens: ${me.citizens}`,
    `Wonders: ${me.wonders}`,
    `Advances: ${me.techs}`,
    `Peace: ${me.peace}`,
    `Total score: ${me.total}`,
  ];
  screenState = { kind: "end", lines, rank: rankTitle(me.total) };
}

/** Events from another civilization's turn that the player should hear about. */
function concernsUs(ev: TurnEvent): boolean {
  if (ev.kind === "cityLost" || ev.kind === "cityCaptured" || ev.kind === "barbarians") return ev.player === 0;
  return ev.kind === "eliminated" || ev.kind === "globalWarming" || ev.kind === "nuked"
    || ev.kind === "spaceLaunched" || ev.kind === "spaceArrived" || ev.kind === "spaceLost";
}

function endTurn(): void {
  // Last turn's news has not been shown yet (slides still running): show it first.
  if (afterSlides.length) { motion.clear(); return; }
  motion.clear();
  handoff = null;
  view.focus = undefined;
  const watched: UnitAction[] = [];
  dispatch({ type: "endTurn" });
  // Our own end of turn (contacts come from the relations; other civs' villages are theirs).
  const events: TurnEvent[] = lastTurnEvents.filter((ev) => ev.kind !== "contact" && !(ev.kind === "hut" && ev.player !== 0));
  // Other civilizations move now. Each one's moves are read before its own end of turn clears them.
  let seen = lastTurnEvents.length;
  let guard = 0;
  while (state.players[state.currentPlayer]!.isAi && guard++ < 16) {
    aiTurn(state);
    for (const ev of lastTurnEvents.slice(seen)) if (concernsUs(ev)) events.push(ev);
    watched.push(...watchable(lastActions));
    applyCommand(state, { type: "endTurn" });
    seen = 0;
  }
  // The last civ's end of turn and the start of ours (a goto may have reached a village).
  for (const ev of lastTurnEvents) if (concernsUs(ev) || (ev.kind === "hut" && ev.player === 0)) events.push(ev);
  events.push(...newContacts());
  void runAiPlayers; // replay helper lives in core; here the loop above also harvests events
  // Autosave every 5 turns.
  if (state.turn % 5 === 0) void writeSlot(0, makeSave(state, options, log)).catch(() => {});
  // Their moves we could see, then our gotos (begun as our turn started), then the news.
  const now = performance.now();
  motion.play(watched, now, { ...OTHERS_PACE, width: state.map.width });
  motion.play(watchable(lastActions.filter((a) => a.kind === "step" && a.owner === 0)), now, { ...OWN_PACE, width: state.map.width });
  whenStill(() => presentEvents(events, () => {
    const end = checkGameEnd(state, FINAL_TURN);
    if (end) endGame(end);
  }));
}

// ---- input: keyboard --------------------------------------------------------
const MOVES: Record<string, [number, number]> = {
  Numpad8: [0, -1], ArrowUp: [0, -1],
  Numpad2: [0, 1], ArrowDown: [0, 1],
  Numpad4: [-1, 0], ArrowLeft: [-1, 0],
  Numpad6: [1, 0], ArrowRight: [1, 0],
  Numpad7: [-1, -1], Numpad9: [1, -1], Numpad1: [-1, 1], Numpad3: [1, 1],
};

function tryMove(unit: number, dx: number, dy: number): void {
  const before = state.activeUnit;
  const mark = lastActions.length;
  const r = applyCommand(state, { type: "move", unit, dx, dy });
  if (r.ok) {
    log.push({ type: "move", unit, dx, dy });
    slideOwn(lastActions.slice(mark));
    if (lastCombat) reportCombat(lastCombat);
    afterAction();
    const ev = lastTurnEvents.find((e) => e.kind === "cityCaptured" || e.kind === "cityLost" || e.kind === "tradeRoute" || e.kind === "nuked" || e.kind === "ransom");
    if (ev) { const m = eventMessage(ev); if (m) say(m, 4000); lastTurnEvents.length = 0; }
  } else if (r.reason === "treaty") {
    const u = unitById(state, unit)!;
    const target = unitAt(state, u.x + dx, u.y + dy)[0] ?? cityAt(state, u.x + dx, u.y + dy);
    if (target) openWarMenu(target.owner, () => tryMove(unit, dx, dy));
    return;
  } else if (r.reason === "diplomat") {
    const u = unitById(state, unit)!;
    const city = cityAt(state, u.x + dx, u.y + dy);
    if (city) openDiplomatMenu(unit, city.id);
    return;
  } else say(REASONS[r.reason] ?? r.reason);
  blinkOn = true;
  lastBlink = performance.now();
  afterUnitOrder(before, mark);
}

function mapKey(e: KeyboardEvent): void {
  if (handoff && !/^F\d+$/.test(e.code)) { e.preventDefault(); finishHandoff(); return; }
  const active = state.activeUnit;
  const mv = MOVES[e.code];
  if (mv) {
    e.preventDefault();
    if (active !== null) tryMove(active, mv[0], mv[1]);
    return;
  }
  const order = (cmd: Command) => { if (active !== null) dispatch(cmd); followActive(true); };
  switch (e.code) {
    case "Enter": case "NumpadEnter":
      if (motion.busy(performance.now())) motion.clear(); // skip the playback
      else if (active === null) endTurn();
      break;
    case "Space": order({ type: "skip", unit: active! }); break;
    case "KeyW": order({ type: "wait", unit: active! }); break;
    case "KeyF": {
      const u = active !== null ? unitById(state, active) : undefined;
      order(u && workOptions(state, u).fortress !== undefined ? { type: "work", unit: active!, work: "fortress" } : { type: "fortify", unit: active! });
      break;
    }
    case "KeyS": order({ type: "sentry", unit: active! }); break;
    case "KeyI": order({ type: "work", unit: active!, work: "irrigate" }); break;
    case "KeyM": order({ type: "work", unit: active!, work: "mine" }); break;
    case "KeyR": {
      const u = active !== null ? unitById(state, active) : undefined;
      order({ type: "work", unit: active!, work: u && workOptions(state, u).road === undefined ? "railroad" : "road" });
      break;
    }
    case "KeyP": {
      const u = active !== null ? unitById(state, active) : undefined;
      order(u && workOptions(state, u).clean !== undefined ? { type: "work", unit: active!, work: "clean" } : { type: "pillage", unit: active! });
      break;
    }
    case "KeyB": if (active !== null) foundWithName(active); break;
    case "KeyD": if (e.shiftKey) order({ type: "disband", unit: active! }); break;
    case "KeyC": followActive(true); break;
    case "KeyT": screenState = { kind: "rates" }; break;
    case "KeyA": screenState = { kind: "science" }; break;
    case "F1": e.preventDefault(); screenState = { kind: "advisor", which: "domestic" }; break;
    case "F2": e.preventDefault(); screenState = { kind: "advisor", which: "military" }; break;
    case "F3": e.preventDefault(); screenState = { kind: "advisor", which: "foreign" }; break;
    case "F4": e.preventDefault(); screenState = { kind: "science" }; break;
    case "F5": e.preventDefault(); screenState = { kind: "advisor", which: "score" }; break;
    case "F6": e.preventDefault(); screenState = { kind: "spaceship" }; break;
    case "F10": e.preventDefault(); openGameMenu(); break;
    case "Escape": if (active !== null) openActionMenu(active); else openGameMenu(); break;
    case "KeyG": askRevolution(); break;
  }
}

function ratesKey(e: KeyboardEvent): void {
  const p = state.players[0]!;
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
    case "Escape": screenState = { kind: "map" }; break;
    case "KeyC": openProductionMenu(cv.city); break;
    case "KeyB": dispatch({ type: "buy", city: cv.city }); break;
    case "KeyN": {
      const city = state.cities.find((c) => c.id === cv.city);
      if (city) askText("Rename the city", city.name, (name) => dispatch({ type: "renameCity", city: cv.city, name }));
      break;
    }
  }
}

function menuKey(e: KeyboardEvent, sc: Extract<Screen, { kind: "menu" }>): void {
  const m = sc.menu;
  if (sc.bar !== undefined && (e.code === "ArrowLeft" || e.code === "ArrowRight" || e.code === "Numpad4" || e.code === "Numpad6")) {
    openBarMenu(sc.bar + (e.code === "ArrowLeft" || e.code === "Numpad4" ? -1 : 1));
    return;
  }
  switch (e.code) {
    case "ArrowUp": case "Numpad8": m.selected = (m.selected + m.items.length - 1) % m.items.length; break;
    case "ArrowDown": case "Numpad2": m.selected = (m.selected + 1) % m.items.length; break;
    case "Enter": case "NumpadEnter": case "Space": screenState = sc.under; sc.onPick(m.selected); break;
    case "Escape": screenState = sc.under; sc.onCancel?.(); break;
  }
}

function setupKey(e: KeyboardEvent, sc: Extract<Screen, { kind: "setup" }>): void {
  const m = setupMenu(sc.setup);
  const apply = (i: number) => { if (setupChoose(sc.setup, i)) startGame(setupOptions(sc.setup)); };
  setupSelection = Math.min(setupSelection, m.items.length - 1);
  switch (e.code) {
    case "ArrowUp": case "Numpad8": setupSelection = (setupSelection + m.items.length - 1) % m.items.length; break;
    case "ArrowDown": case "Numpad2": setupSelection = (setupSelection + 1) % m.items.length; break;
    case "Enter": case "NumpadEnter": case "Space": apply(setupSelection); if (screenState === sc) setupSelection = setupMenu(sc.setup).selected; break;
    case "Escape": screenState = { kind: "title" }; break;
  }
}
let setupSelection = 0;

/** Begin the setup questions at `step`: a random world asks difficulty first, a premade one which world, a custom one the land. */
function openSetup(step: SetupState["step"]): void {
  const setup: SetupState = { step, world: null, historical: true, custom: null, difficulty: 2, opponents: 6, civ: "romans" };
  screenState = { kind: "setup", setup };
  setupSelection = setupMenu(setup).selected;
}

function openTitleMenu(): void {
  const items: [string, () => void][] = [
    ["Start a new game", () => openSetup("difficulty")],
    ["Play on a premade world", () => openSetup("world")],
    ["Customize world", () => openSetup("landMass")],
    ["Load a saved game", () => void openLoadMenu()],
    [`Visuals: ${renderer.id === "retro" ? "retro" : "modern"}`, () => { setRenderer(renderer.id === "retro" ? "modern" : "retro"); openTitleMenu(); }],
  ];
  screenState = {
    kind: "menu",
    under: { kind: "title" },
    menu: { title: "Epochs", items: items.map((i) => i[0]), selected: 0 },
    onPick: (i) => items[i]?.[1](),
  };
}

/** Alt+G, Alt+O, Alt+A, Alt+W open the bar's dropdowns, as the original's menu keys did. */
const BAR_KEYS: Record<string, number> = { KeyG: 0, KeyO: 1, KeyA: 2, KeyW: 3 };

addEventListener("keydown", (e) => {
  if (e.altKey && !e.metaKey && !e.ctrlKey && BAR_KEYS[e.code] !== undefined) {
    const sc0 = screenState;
    if (sc0.kind === "map" || (sc0.kind === "menu" && sc0.bar !== undefined)) {
      e.preventDefault();
      lastInput = performance.now();
      openBarMenu(BAR_KEYS[e.code]!);
    }
    return;
  }
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  lastInput = performance.now();
  view.inspect = undefined;
  const sc = screenState;
  switch (sc.kind) {
    case "title": openTitleMenu(); break;
    case "setup": setupKey(e, sc); break;
    case "map": mapKey(e); break;
    case "city": cityKey(e, sc.view); break;
    case "rates": ratesKey(e); break;
    case "science":
      if (e.code === "KeyA") openTree({ choosing: true, closable: true }, undefined, sc);
      else if (e.code === "Escape" || e.code === "F4") screenState = { kind: "map" };
      else advisorHotkey(e);
      break;
    case "advisor":
      if (e.code === "Escape") screenState = { kind: "map" };
      else if (sc.which === "foreign" && (e.code === "Enter" || e.code === "NumpadEnter")) openForeignTalkMenu();
      else advisorHotkey(e);
      break;
    case "techTree": treeKey(e, sc); break;
    case "diplomacy": screenState = { kind: "map" }; break;
    case "end": screenState = { kind: "title" }; break;
    case "spaceship":
      if (e.code === "Escape" || e.code === "F6") screenState = { kind: "map" };
      else if ((e.code === "Enter" || e.code === "NumpadEnter") && shipStats(state.players[0]!.spaceship).launchable) openLaunchMenu();
      else advisorHotkey(e);
      break;
    case "menu": menuKey(e, sc); break;
    case "report": case "worldMap": screenState = { kind: "map" }; break;
    case "input": e.preventDefault(); inputKey(e, sc); break;
  }
});

function openLaunchMenu(): void {
  const st = shipStats(state.players[0]!.spaceship);
  menu(`Launch now? ${st.successPct}% success, ${st.flightTurns} turns`, ["Not yet", "Launch!"], (i) => {
    if (i === 1 && dispatch({ type: "launch" })) say("The spaceship lifts off!", 4000);
  });
}

function advisorHotkey(e: KeyboardEvent): void {
  const map: Record<string, Screen> = {
    F1: { kind: "advisor", which: "domestic" },
    F2: { kind: "advisor", which: "military" },
    F3: { kind: "advisor", which: "foreign" },
    F4: { kind: "science" },
    F5: { kind: "advisor", which: "score" },
    F6: { kind: "spaceship" },
  };
  const next = map[e.code];
  if (next) { e.preventDefault(); screenState = next; }
}

// ---- input: mouse -----------------------------------------------------------
canvas.addEventListener("contextmenu", (e) => e.preventDefault());
// The wheel (or a sideways swipe) scrolls the tech tree, about a tier a notch.
canvas.addEventListener("wheel", (e) => {
  const sc = screenState;
  if (sc.kind !== "techTree") return;
  e.preventDefault();
  const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
  const tiers = e.deltaMode === 1 ? d / 3 : e.deltaMode === 2 ? d * renderer.techColumns : d / 100;
  treeScroll(sc, sc.target + tiers);
}, { passive: false });
canvas.addEventListener("mousedown", (e) => {
  const [px, py] = toLogical(e);
  lastInput = performance.now();
  const sc = screenState;
  switch (sc.kind) {
    case "title": openTitleMenu(); return;
    case "setup": {
      const m = setupMenu(sc.setup);
      const i = renderer.menuHit({ ...m }, px, py);
      if (i >= 0) { setupSelection = i; setupKey({ code: "Enter" } as KeyboardEvent, sc); }
      return;
    }
    case "menu": {
      if (sc.bar !== undefined) {
        const t = renderer.menuBarHit(px, py);
        if (t >= 0) { if (t === sc.bar) screenState = sc.under; else openBarMenu(t); return; }
      }
      const i = renderer.menuHit(sc.menu, px, py);
      screenState = sc.under;
      if (i >= 0) sc.onPick(i); else sc.onCancel?.();
      return;
    }
    case "report": case "worldMap": screenState = { kind: "map" }; return;
    case "techTree": if (e.button === 0) treeClick(sc, px, py); return;
    case "end": screenState = { kind: "title" }; return;
    case "diplomacy": screenState = { kind: "map" }; return;
    case "rates": case "science": case "spaceship": screenState = { kind: "map" }; return;
    case "input": return;
    case "advisor":
      if (sc.which === "foreign") openForeignTalkMenu(); else screenState = { kind: "map" };
      return;
    case "city": {
      // A worked square frees its citizen; an unworked one takes a free citizen or the worker on the
      // weakest square; the city's own square puts every citizen on the best squares.
      const slot = renderer.citySlotAt(px, py);
      const city = state.cities.find((c) => c.id === sc.view.city);
      if (slot === 0) { if (dispatch({ type: "arrangeCity", city: sc.view.city })) say("Citizens moved to the best tiles"); }
      else if (slot !== null && city) dispatch({ type: city.worked.includes(slot) ? "toggleTile" : "workTile", city: city.id, slot });
      else if (renderer.cityExitHit(px, py)) screenState = { kind: "map" };
      return;
    }
    case "map": break;
  }

  const bar = renderer.menuBarHit(px, py);
  if (bar >= 0) { openBarMenu(bar); return; }
  const mm = renderer.minimapAt(state, px, py);
  if (mm) { centerOn(mm.x, mm.y); return; }
  if (handoff) { finishHandoff(); return; }
  const hit = renderer.tileAt(state, view, px, py);
  const active = state.activeUnit !== null ? unitById(state, state.activeUnit) : undefined;
  if (!hit) {
    if (e.button === 2) { if (active) openActionMenu(active.id); else openGameMenu(); }
    return;
  }
  const { x: tx, y: ty } = hit;

  // Right-click: step the active unit onto an adjacent square, open its orders on its own square,
  // and anywhere else show the terrain window (which can also send the unit there).
  if (e.button === 2) {
    if (active && active.x === tx && active.y === ty) { openActionMenu(active.id); return; }
    if (active && isAdjacent(active, tx, ty)) {
      let dx = tx - active.x;
      if (dx > 1) dx -= state.map.width;
      if (dx < -1) dx += state.map.width;
      tryMove(active.id, dx, ty - active.y);
      return;
    }
    openTerrainInfo(tx, ty);
    return;
  }
  // Left-click centres the map on the square and shows it in the panel. It opens your city there,
  // or picks your unit there (the next of a stack on the active unit's square), but never moves a
  // unit: moves are the keys, right-click and the terrain window.
  centerOn(tx, ty);
  const city = cityAt(state, tx, ty);
  if (city && city.owner === 0) { openCity(city.id); return; }
  const mine = unitAt(state, tx, ty).filter((u) => u.owner === 0);
  if (active && active.x === tx && active.y === ty) {
    const ready = mine.filter((u) => u.movesLeft > 0);
    const nextUnit = ready[(ready.findIndex((u) => u.id === active.id) + 1) % ready.length];
    if (nextUnit && nextUnit.id !== active.id) dispatch({ type: "activate", unit: nextUnit.id });
    return;
  }
  const own = mine.find((u) => u.movesLeft > 0) ?? mine[0];
  if (own) {
    dispatch({ type: "activate", unit: own.id });
    if (state.activeUnit !== own.id) say("No moves left this turn");
    return;
  }
  view.inspect = { x: tx, y: ty };
});

// ---- frame loop ---------------------------------------------------------------
function draw(sc: Screen): void {
  switch (sc.kind) {
    case "title": renderer.title(blinkOn); break;
    case "setup": {
      renderer.title(false);
      const m = setupMenu(sc.setup);
      renderer.menu({ ...m, selected: setupSelection });
      break;
    }
    case "map": view.message = status; renderer.main(state, view); break;
    case "report": renderer.report(sc.page); break;
    case "worldMap": renderer.worldMap(state); break;
    case "city": sc.view.message = status; renderer.city(state, sc.view); break;
    case "techTree": renderer.techTree(state, sc.tree); break;
    case "science": renderer.science(state); break;
    case "rates": renderer.rates(state); break;
    case "advisor": renderer.advisor(state, sc.which); break;
    case "diplomacy": renderer.diplomacy(state, sc.player, sc.line); break;
    case "end": renderer.end(sc.lines, sc.rank); break;
    case "spaceship": renderer.spaceship(state); break;
    case "input":
      draw(sc.under);
      renderer.textInput(sc.input, blinkOn);
      break;
    case "menu":
      view.menuOpen = sc.bar;
      draw(sc.under);
      view.menuOpen = undefined;
      renderer.menu(sc.menu);
      if (status && sc.under.kind !== "map") renderer.statusLine(status);
      break;
  }
}

function frame(t: number): void {
  if (t - lastBlink > 400) { blinkOn = !blinkOn; lastBlink = t; }
  view.blink = blinkOn;
  view.autoEnd = autoEnd;
  view.borders = borders;
  if (screenState.kind === "techTree") stepTree(screenState, t);
  if (screenState.kind !== "title" && screenState.kind !== "setup") stepCamera(t);
  if (status && t > statusUntil) status = undefined;
  const shown = motion.at(t);
  view.moving = shown.moving.length ? shown.moving : undefined;
  view.battle = shown.battle;
  // No game yet on the title screen and its menus.
  const lifting = (state as GameState | undefined) ? lifter.update(state, t, shown.moving) : undefined;
  view.lifting = lifting?.size ? lifting : undefined;
  const animating = motion.busy(t);
  stepHandoff(t, animating);
  if (handoff) view.blink = true; // the unit that just acted stays solid while the view lingers
  if (!animating && afterSlides.length && screenState.kind === "map") for (const fn of afterSlides.splice(0)) fn();
  // Auto end turn: nothing to order, the player has been idle a moment, and the map is showing.
  if (autoEnd && screenState.kind === "map" && state.activeUnit === null && state.players[0]!.alive && !animating && !afterSlides.length && !handoff
    && t - lastInput > 900 && t - lastAutoEnd > 900) {
    lastAutoEnd = t;
    endTurn();
  }
  renderer.beginFrame();
  draw(screenState);
  renderer.present();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

(window as unknown as { civ: unknown }).civ = { get state() { return state; }, get log() { return log; }, get moving() { return view.moving; }, get battle() { return view.battle; }, get view() { return view; }, get screen() { return screenState.kind; }, dispatch, atWar, DIFFICULTIES };
