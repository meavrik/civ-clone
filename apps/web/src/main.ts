import { acceptsMapSwap, acceptsPeace, aiTurn, attitude, bordersAnswer, BORDERS_PRICE, peaceAnswer, PEACE_PRICE, tradeAsk, tributeOffer } from "@civ/ai";
import {
  advance,
  applyCommand,
  atPeace,
  atWar,
  advancesFor,
  availableAdvances,
  bordersOpen,
  buildOptions,
  computeCity,
  cityFocus,
  FOCI,
  shieldsAfterChange,
  buyCost,
  canFoundCity,
  canHelpWonder,
  canTradeRoute,
  checkGameEnd,
  costFor,
  CHEAT_GOLD,
  cityAt,
  civ,
  computeScore,
  defaultCityName,
  esteem,
  FINAL_TURN,
  findPath,
  formatYear,
  getTile,
  government,
  governmentsAvailable,
  hasContact,
  inciteCost,
  lastCombat,
  lastActions,
  lastTurnEvents,
  landOwner,
  loadSave,
  makeSave,
  mapDistance,
  mindsTrespass,
  newGame,
  slotInLand,
  pillageTarget,
  productionName,
  rankTitle,
  relation,
  rewindSave,
  routeBonus,
  runAiPlayers,
  shipStats,
  Terrain,
  traitMoves,
  trespassers,
  turnStarts,
  turnToYear,
  unitAt,
  unitById,
  unitType,
  workOptions,
  WORLD_SIZES,
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
  type UnitBattle,
  type WorldSize,
} from "@civ/core";
import {
  builtNotice,
  canResearch,
  keepResearchInView,
  nextChoice,
  openResearch,
  researchRowOf,
  researchRows,
  researchStep,
  researchTarget,
  DIFFICULTIES,
  leaderLine,
  AUDIENCE_CHOICES,
  FogLifter,
  INTRO_MS,
  MotionPlayer,
  moveRefusal,
  PICTURES,
  setupCards,
  setupChoose,
  planMove,
  setupMenu,
  setupOptions,
  terrainInfo,
  TEXT_INPUT_MAX,
  type ResearchView,
  type CityScreenView,
  type CityViewState,
  type DiplomacyView,
  type MainScreenView,
  type MenuState,
  type Renderer,
  type ReportPage,
  keepInView,
  MENU_BAR,
  topCitiesReport,
  civilizationsReport,
  wondersReport,
  fightReport,
  watchTurn,
  type Callout,
  type HoldFrame,
  type SetupState,
  type TextInputState,
} from "@civ/renderer-api";
import { canvas, configureDisplay, fitCanvas, toLogical } from "./display.js";
import { createRetroRenderer } from "./retro-renderer.js";
import { listSlots, readSlot, SLOTS, writeSlot } from "./storage.js";

// ---- renderer ----------------------------------------------------------------
// The game is drawn retro. The modern renderer (packages/renderer-modern) is set aside for
// now: the app no longer offers it, though it still builds and passes its tests.
const renderer: Renderer = createRetroRenderer(canvas);
configureDisplay(renderer.width, renderer.height, true, renderer.density ?? 1);

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

/** When the note beside a refused unit goes (any key or click takes it sooner). */
let calloutUntil = 0;
const CALLOUT_MS = 4000;

/** A move the rules refused: the unit leans toward the square and springs back, and a note beside it says why. */
function refuseMove(unit: number, dx: number, dy: number, reason: string): void {
  const u = unitById(state, unit);
  if (!u) { say(REASONS[reason] ?? reason); return; }
  const now = performance.now();
  motion.nudge({ id: u.id, type: u.type, owner: u.owner, x: u.x, y: u.y }, dx, dy, now);
  view.callout = { x: u.x, y: u.y, text: moveRefusal(state, unit, dx, dy, reason) };
  calloutUntil = now + CALLOUT_MS;
}

const REASONS: Record<string, string> = {
  "not in our city": "Only in one of our cities",
  "already home": "This city already supports it",
  terrain: "Can't go there",
  rough: "Needs a road",
  steep: "Needs a road",
  zoc: "Enemy too close",
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
  | { kind: "city"; view: CityScreenView; then?: () => void } // `then`: the turn's news that waits for the city to close
  | { kind: "cityView"; view: CityViewState; city: Extract<Screen, { kind: "city" }> } // the city as a picture, over its city screen
  | { kind: "research"; view: ResearchView; back: Screen; then: () => void }
  | { kind: "science" }
  | { kind: "rates" }
  | { kind: "advisor"; which: "domestic" | "military" | "foreign" | "score" }
  | { kind: "diplomacy"; player: number; line: string; talk?: Talk }
  | { kind: "beat"; until: number; then: () => void } // the map, held a moment on something about to be talked of
  | { kind: "end"; lines: string[]; rank: string }
  | { kind: "spaceship" }
  | { kind: "input"; input: TextInputState; onSubmit: (text: string) => void; under: Screen }
  | { kind: "menu"; menu: MenuState; onPick: (i: number) => void; under: Screen; onCancel?: () => void; bar?: number }
  | { kind: "report"; page: ReportPage }
  | { kind: "worldMap" };

/** Our choices in an audience: buttons under the leader's words, never more than AUDIENCE_CHOICES. */
interface Talk { items: string[]; selected: number; onPick: (i: number) => void; onCancel: () => void }

let screenState: Screen = { kind: "title" };
/** The opening plays under the title from the first frame (`introStart`); `titleAt` is how far it has come. */
let introStart: number | undefined;
let titleAt = 0;
const view: MainScreenView = { originX: 0, originY: 0, blink: true };
/** The camera in fractional tile units; it glides to each new target so the eye can follow. */
const cam = { x: 0, y: 0, fromX: 0, fromY: 0, toX: 0, toY: 0, start: 0, animating: false, ready: false };
const CAMERA_MS = 280;

/**
 * Units slide from square to square instead of jumping. The state has
 * already moved; this only times the drawing. Our own moves play at once
 * (a new order snaps any slide still running); after the other
 * civilizations' turns, what we could see of them plays back in order
 * (`watchTurn`): the map follows each enemy unit and stops on each fight
 * with ours.
 */
const motion = new MotionPlayer();
/** Fog lifting off squares as they are explored. */
const lifter = new FogLifter();
const OWN_PACE = { stepMs: 120, maxMs: 1000, battleMs: 1600, battleTotalMs: 1600 };
/** True while the other civilizations' turns play back; any key or click skips the rest. */
let watching = false;
/** Things to show once every slide has landed (a village's gift, an audience, the turn's news). */
const afterSlides: (() => void)[] = [];

function whenStill(fn: () => void): void {
  afterSlides.push(fn);
}

function resetMotion(): void {
  motion.clear();
  watching = false;
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
  skipWatch();
  motion.play(actions, performance.now(), { ...OWN_PACE, width: state.map.width });
}

/**
 * Play back what we saw of the other civilizations' turns, and our gotos as ours began:
 * squares we saw before those turns or see now, the camera taken from where it is headed.
 */
function watchOthers(actions: readonly UnitAction[], sawBefore: Uint8Array): void {
  const me = state.players[0]!;
  const w = state.map.width;
  const seen = (x: number, y: number) => {
    const i = y * w + x;
    return me.explored[i] === 1 && (sawBefore[i] === 1 || me.visible[i] === 1);
  };
  const camera = {
    originX: ((Math.round(cam.animating ? cam.toX : cam.x) % w) + w) % w,
    originY: Math.round(cam.animating ? cam.toY : cam.y),
    tilesX: renderer.viewTilesX,
    tilesY: renderer.viewTilesY,
  };
  const now = performance.now();
  for (const b of watchTurn(state, actions, { viewer: 0, camera, seen, glideMs: CAMERA_MS })) {
    if (b.kind === "hold") motion.hold(b.ms, now, b);
    else motion.play(b.actions, now, b.timing);
  }
  watching = motion.busy(now);
}

function skipWatch(): void {
  motion.clear();
  watching = false;
}

/** Each frame: a hold in the playback moves the camera once as it begins, and its note stands while it lasts. */
let holdSeq = 0;
let holdNote: Callout | undefined;
function showHold(h: HoldFrame | undefined): void {
  if (h && h.seq !== holdSeq) {
    holdSeq = h.seq;
    if (h.centre) centerOn(h.centre.x, h.centre.y);
  }
  if (h?.note) { view.callout = h.note; holdNote = h.note; }
  else if (holdNote) {
    if (view.callout === holdNote) view.callout = undefined;
    holdNote = undefined;
  }
}

/** The fights with our units in the other civilizations' turns, in one window. */
function battleReport(fights: readonly UnitBattle[], then: () => void): void {
  const lines = fightReport(state, fights, 0);
  if (!lines.length) { then(); return; }
  modal("Under attack!", lines, ["OK"], () => then(), 0, then);
}

/** The turn ends by itself once nothing needs orders (game menu toggles it; remembered per browser). */
let autoEnd = (() => { try { return localStorage.getItem("epochs.autoEnd") !== "off"; } catch { return true; } })();
let lastInput = 0;
let lastAutoEnd = 0;
/** A game just loaded waits for a key or click before its turn can end by itself, so a restored turn is seen first. */
let autoEndHeld = false;
function noteInput(): void {
  lastInput = performance.now();
  autoEndHeld = false;
}
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

/** Civilizations that have asked us off their land this turn: a unit stepping onto it again only gets a note. */
const askedLeave = new Set<number>();

/** After one of our actions: villages our units entered, civilizations we just met, and land we stepped onto uninvited, each in its own window. */
function afterAction(): void {
  const events: TurnEvent[] = [];
  for (let i = 0; i < lastTurnEvents.length; ) {
    const ev = lastTurnEvents[i]!;
    if (ev.kind === "hut" && ev.player === 0) { events.push(ev); lastTurnEvents.splice(i, 1); }
    else if (ev.kind === "trespass" && ev.intruder === 0) {
      lastTurnEvents.splice(i, 1);
      if (!askedLeave.has(ev.player) && !events.some((e) => e.kind === "trespass" && e.player === ev.player)) events.push(ev);
      else {
        view.callout = { x: ev.x, y: ev.y, text: `Land of the ${state.players[ev.player]!.name}` };
        calloutUntil = performance.now() + CALLOUT_MS;
      }
    } else i++;
  }
  events.unshift(...newContacts());
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
/** Keep the game in the autosave slot: written as every turn begins, and when a game starts or is loaded. */
function autosave(): void {
  void writeSlot(0, makeSave(state, options, log)).catch(() => {});
}

/** A save as its civilization and year: "Romans, 1200 BC". */
function saveLabel(s: SaveGame): string {
  let name = s.civ;
  try { name = civ(s.civ).name; } catch { /* a civilization since renamed */ }
  return `${name}, ${formatYear(turnToYear(s.turn))}`;
}

function startGame(opts: NewGameOptions, seed = (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0): void {
  options = opts;
  state = newGame(seed, opts);
  renderer.prepare?.(state);
  log = [];
  announced.clear();
  resetMotion();
  screenState = { kind: "map" };
  cam.ready = false;
  followActive(true);
  autosave();
  say(`${civ(state.players[0]!.civ).leader}, lead the ${state.players[0]!.name} to glory.`, 4000);
  // Our strength, once, as the reign begins.
  const t = civ(state.players[0]!.civ).trait;
  if (t && !state.classicCivs) modal(`The ${state.players[0]!.name}`, [`{star} ${t.name}: ${t.text}`, `We start with ${advance(t.start).name}.`], ["OK"], () => { screenState = { kind: "map" }; }, 0, () => { screenState = { kind: "map" }; });
}

function resumeGame(save: SaveGame): void {
  try {
    const loaded = loadSave(save, aiTurn);
    state = loaded.state;
    renderer.prepare?.(state);
    log = loaded.log;
    options = loaded.options; // an old save keeps its one-roll fights
    announced.clear();
    resetMotion();
    for (const p of state.players) if (p.id !== 0 && hasContact(state, 0, p.id)) announced.add(p.id);
    screenState = { kind: "map" };
    cam.ready = false;
    followActive(true);
    autosave();
    autoEndHeld = true;
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
      ...(WORLD_SIZES.some((w) => w.id === params.get("size")) ? { size: params.get("size") as WorldSize } : {}),
      ...(params.get("combat") === "classic" ? { classicCombat: true } : {}),
      ...(params.get("terrain") === "classic" ? { classicTerrain: true } : {}),
      ...(params.get("mountains") === "open" ? { openMountains: true } : {}),
      ...(params.get("civs") === "classic" ? { classicCivs: true } : {}),
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

function openCity(id: number, then?: () => void): void {
  screenState = { kind: "city", view: { city: id }, ...(then ? { then } : {}) };
}

/** The city as a picture (the original's View); a click names a building, anything else goes back to the city. */
function openCityView(sc: Extract<Screen, { kind: "city" }>): void {
  screenState = { kind: "cityView", view: { city: sc.view.city }, city: sc };
}

/** Back to the map; a city opened by the turn's news goes on with the rest of it. */
function leaveCity(sc: Extract<Screen, { kind: "city" }>): void {
  screenState = { kind: "map" };
  sc.then?.();
}

/**
 * A unit picked on the city screen wakes (fortified or sentried, it gives up those orders) and
 * the map takes it up, as in the original. One with no moves left keeps its orders.
 */
function activateFromCity(sc: Extract<Screen, { kind: "city" }>, unit: number): void {
  const u = unitById(state, unit);
  if (!u) return;
  if (u.movesLeft === 0) { say(`${unitType(u.type).name}: no moves left this turn`); return; }
  if (!dispatch({ type: "activate", unit })) return;
  leaveCity(sc);
  finishHandoff();
  followActive(true);
}

/**
 * A city finished an improvement, a wonder, a spaceship part or settlers: a window over
 * the city says what it does, then the city's builders ask what comes next. Leaving the city goes
 * on with the turn's news.
 */
function builtWindow(cityId: number, p: Production, then: () => void): void {
  const city = state.cities.find((c) => c.id === cityId);
  const notice = builtNotice(state, cityId, p);
  if (!city || city.owner !== 0 || !notice) { then(); return; }
  openCity(cityId, then);
  modal(notice.title, notice.lines, ["Build next..."], () => openProductionMenu(cityId));
  // An improvement or wonder shows its picture, as it will stand in the city view.
  if (screenState.kind === "menu" && p.kind !== "spaceship" && PICTURES[p.id]) screenState.menu.picture = { id: p.id, slot: state.players[city.owner]!.color };
}

/** Buy what a city is building once the price is seen against the treasury, as the original asks. */
function askBuy(cityId: number): void {
  const city = state.cities.find((c) => c.id === cityId);
  if (!city) return;
  const cost = buyCost(state, city);
  const gold = state.players[city.owner]!.gold;
  const name = productionName(city.production);
  if (cost === 0) { say(`${name} is already paid for`); return; }
  const price = `{purse} ${cost} gold  {coin} ${gold} in the treasury`;
  if (gold < cost) { modal(`Buy ${name}?`, [price, "Not enough gold yet."], ["OK"], () => {}); return; }
  modal(`Buy ${name}?`, [price], ["Buy", "Not now"], (i) => {
    if (i === 0 && dispatch({ type: "buy", city: cityId })) say(`${name} will be ready next turn`);
  });
}

/** A modal window: a title, a few paragraphs, and choices (just "OK" for a message). */
function modal(title: string, body: string[], items: string[], onPick: (i: number) => void, selected = 0, onCancel?: () => void): void {
  screenState = { kind: "menu", under: screenState, menu: { title, body, items, selected }, onPick, ...(onCancel ? { onCancel } : {}) };
}

/** What a tribal village held, in a window like the original's. */
function hutModal(r: HutResult, then: () => void): void {
  const body = r.kind === "gold" ? [`The elders give us ${r.amount} gold.`]
    : r.kind === "advance" ? [`Old scrolls teach us ${advance(r.advance).name}!`]
    : r.kind === "unit" ? [`${unitType(r.unit).name} from the village join us.`]
    : r.kind === "barbarians" ? ["A trap! Barbarians pour out."]
    : ["The village is empty."];
  // Scrolls found go on to the tech tree, like any advance found.
  const after = r.kind === "advance" ? () => showFound([r.advance], then) : then;
  modal("A Tribal Village", body, ["OK"], () => after(), 0, after);
}

/** Send a unit to a square on its route there (`goto`). */
function sendTo(unit: number, tx: number, ty: number): void {
  const before = state.activeUnit;
  const mark = lastActions.length;
  if (dispatch({ type: "goto", unit, x: tx, y: ty })) say("Going to...", 1500);
  afterUnitOrder(before, mark);
  // A diplomat that reaches the gate of the foreign city it was sent to asks what to do there.
  const d = unitById(state, unit);
  const gate = cityAt(state, tx, ty);
  if (d && gate && gate.owner !== 0 && gate.owner !== state.barbarians && unitType(d.type).flags?.includes("diplomat") && d.movesLeft > 0 && isAdjacent(d, tx, ty))
    openDiplomatMenu(d.id, gate.id);
}

/** The east-west step from a unit to an adjacent column, the short way round the wrap. */
function stepTo(u: { x: number }, tx: number): number {
  let dx = tx - u.x;
  if (dx > 1) dx -= state.map.width;
  if (dx < -1) dx += state.map.width;
  return dx;
}

/** Right-click on the map: what is known about the square, with a few things to do about it. */
function openTerrainInfo(tx: number, ty: number): void {
  const info = terrainInfo(state, tx, ty);
  const active = state.activeUnit !== null ? unitById(state, state.activeUnit) : undefined;
  const items: [string, () => void][] = [];
  if (active && !(active.x === tx && active.y === ty)) items.push(["Go here", () => sendTo(active.id, tx, ty)]);
  const city = cityAt(state, tx, ty);
  if (city && city.owner === 0) items.push(["Open city", () => openCity(city.id)]);
  // Closed by its X (or any click off its choices, or Esc); nothing is picked until a choice is.
  modal(info.title, info.lines, items.map((i) => i[0]), (i) => items[i]?.[1](), -1);
  if (screenState.kind === "menu") screenState.menu.close = true;
}

/** What the city works its squares for (its Focus button, or F): every citizen is put to work for it at once. */
function openFocusMenu(cityId: number): void {
  const city = state.cities.find((c) => c.id === cityId);
  const now = city && cityFocus(state, city);
  if (!city || !now) return;
  screenState = {
    kind: "menu",
    under: screenState,
    menu: { title: `${city.name} works for...`, items: FOCI.map((f) => f.name), right: FOCI.map((f) => f.text), selected: FOCI.indexOf(now) },
    onPick: (i) => {
      const f = FOCI[i];
      if (f && dispatch({ type: "setFocus", city: cityId, focus: f.id })) say(`${city.name} works for ${f.name.toLowerCase()}`);
    },
  };
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
  const surplus = computeCity(state, city).shieldSurplus;
  // The turns each choice takes from here, counting the shields the change would keep (all of the
  // box for its own kind of production, half for another, as the rules take); "never" while the
  // city makes no shields.
  const turns = (p: Production): string => {
    const left = Math.max(0, costFor(state, city.owner, p) - shieldsAfterChange(state, city, p));
    if (left === 0) return "1 turn";
    if (surplus <= 0) return "never";
    const n = Math.ceil(left / surplus);
    return `${n} turn${n === 1 ? "" : "s"}`;
  };
  screenState = {
    kind: "menu",
    under: screenState,
    menu: {
      title: `${city.name}: build what?`,
      items: opts.map((p) => productionName(p)),
      right: opts.map((p) => {
        const t = p.kind === "unit" ? unitType(p.id) : null;
        return `${t ? `${t.attack}/${t.defense}/${t.moves + traitMoves(state, city.owner, p.id)} ` : ""}${turns(p)}`;
      }),
      selected: Math.max(0, opts.findIndex((p) => p.kind === city.production.kind && p.id === city.production.id)),
    },
    onPick: (i) => {
      const p: Production | undefined = opts[i];
      if (p) dispatch({ type: "setProduction", city: cityId, production: p });
    },
  };
}

// ---- the research panel ------------------------------------------------------------
type ResearchScreen = Extract<Screen, { kind: "research" }>;

/**
 * Open the research panel. `then` runs once it closes (the next of the turn's
 * events), and `back` is the screen it closes onto. When research is due it can
 * only be left by picking the next advance, as the wise men insist.
 */
function openTree(opts: { discovered?: string[]; choosing: boolean; closable: boolean }, then: () => void = () => {}, back: Screen = { kind: "map" }): void {
  const choosing = opts.choosing && availableAdvances(state.players[0]!.advances, advancesFor(state)).length > 0;
  const view = openResearch(state, renderer.researchListRows, { ...opts, choosing, closable: opts.closable || !choosing });
  screenState = { kind: "research", view, back, then };
}

/** Advances gained along the way (a village, a diplomat, a treaty): the panel shows them, and the research can be changed there. */
function showFound(ids: string[], then: () => void = () => {}): void {
  if (!ids.length) { then(); return; }
  openTree({ discovered: ids, choosing: true, closable: true }, then, screenState);
}

/** The research is due: pick the next advance in the panel. */
function askResearch(then: () => void = () => {}): void {
  if (!availableAdvances(state.players[0]!.advances, advancesFor(state)).length) { then(); return; }
  openTree({ choosing: true, closable: false }, then);
}

function closeTree(sc: ResearchScreen): void {
  screenState = sc.back;
  sc.then();
}

/** Research what the panel offers for the selected advance: itself, or the first step toward one further on. */
function pickResearch(sc: ResearchScreen): void {
  const target = researchTarget(state, sc.view);
  if (!target) return;
  if (dispatch({ type: "research", advance: target })) say(target === sc.view.selected ? `Researching ${advance(target).name}` : `Researching ${advance(target).name}, toward ${advance(sc.view.selected).name}`);
  closeTree(sc);
}

/** Show an advance's card, scrolling the list to it when it is listed. */
function treeSelect(sc: ResearchScreen, id: string): void {
  sc.view.selected = id;
  keepResearchInView(state, sc.view, renderer.researchListRows);
}

function treeScroll(sc: ResearchScreen, by: number): void {
  const rows = researchRows(state, sc.view).length;
  sc.view.top = Math.max(0, Math.min(Math.max(0, rows - renderer.researchListRows), sc.view.top + by));
}

function treeKey(e: KeyboardEvent, sc: ResearchScreen): void {
  const v = sc.view;
  const page = renderer.researchListRows - 1;
  switch (e.code) {
    case "ArrowUp": case "Numpad8": treeSelect(sc, researchStep(state, v, -1)); break;
    case "ArrowDown": case "Numpad2": treeSelect(sc, researchStep(state, v, 1)); break;
    case "PageUp": treeSelect(sc, researchStep(state, v, -page)); break;
    case "PageDown": treeSelect(sc, researchStep(state, v, page)); break;
    case "Home": treeSelect(sc, researchStep(state, v, -1000)); break;
    case "End": treeSelect(sc, researchStep(state, v, 1000)); break;
    case "Tab": e.preventDefault(); if (v.choosing) treeSelect(sc, nextChoice(state, v, e.shiftKey ? -1 : 1)); break;
    case "Enter": case "NumpadEnter": case "Space":
      e.preventDefault();
      if (canResearch(state, v)) pickResearch(sc);
      else if (v.choosing) treeSelect(sc, nextChoice(state, v));
      else closeTree(sc);
      break;
    case "Escape": if (v.closable) closeTree(sc); break;
  }
}

/** A click on the panel: an advance shows its card, and a second click on one that can be researched picks it. */
function treeClick(sc: ResearchScreen, px: number, py: number): void {
  const hit = renderer.researchHit(state, sc.view, px, py);
  if (!hit) return;
  switch (hit.kind) {
    case "row":
      if (hit.id === sc.view.selected && canResearch(state, sc.view)) pickResearch(sc);
      else treeSelect(sc, hit.id);
      break;
    case "link": treeSelect(sc, hit.id); break;
    case "research": pickResearch(sc); break;
    case "close": closeTree(sc); break;
    case "scroll": treeScroll(sc, hit.by); break;
  }
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
  menu(`War on the ${name}?`, ["Keep the peace", "Declare war!"], (i) => {
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
  const here = cityAt(state, u.x, u.y);
  if (here && here.owner === u.owner && u.homeCity !== here.id) items.push([`Home city: ${here.name}`, "H", () => setHome(unit)]);
  items.push(["Wait", "W", () => dispatch({ type: "wait", unit })]);
  items.push(["Skip turn", "Space", () => dispatch({ type: "skip", unit })]);
  items.push(["Disband", "Shift+D", () => confirmDisband(unit)]);
  return items;
}

/** Disbanding loses the unit for good, so ask first (Shift+D, Orders > Disband); No is the default. */
function confirmDisband(unit: number): void {
  const u = unitById(state, unit);
  if (!u) return;
  const name = unitType(u.type).name;
  modal("Are you sure?", [`Disband ${name} for good?`], ["No, keep it", "Yes, disband"], (i) => {
    if (i !== 1) return;
    dispatch({ type: "disband", unit });
    followActive(true);
  }, 0, () => {});
}

/** The city the unit stands in pays its upkeep from now on (H), as in the original. */
function setHome(unit: number): void {
  const u = unitById(state, unit);
  const c = u && cityAt(state, u.x, u.y);
  if (u && c && dispatch({ type: "home", unit })) say(`${unitType(u.type).name} now supported by ${c.name}`);
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
  menu("Start a revolution?", ["No", "Yes, revolt"], (i) => {
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
        ["Save Game", "", () => void openSaveMenu()],
        ["Load Game", "", () => void openLoadMenu()],
        ["Back to an Earlier Turn", "", () => openRewindMenu(makeSave(state, options, log))],
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
        ["Research", "", () => openTree({ choosing: true, closable: true })],
      ];
    case "World":
      return [
        ["Wonders of the World", "", () => { screenState = { kind: "report", page: wondersReport(state) }; }],
        ["Top 5 Cities", "", () => { screenState = { kind: "report", page: topCitiesReport(state) }; }],
        ["Civilizations", "", () => { screenState = { kind: "report", page: civilizationsReport(state) }; }],
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
  const items = slots.map((s, i) => (i === 0 ? "(autosave)" : s ? `${i}. ${saveLabel(s)}` : `${i}. empty`));
  menu("Save to slot", items, (i) => {
    if (i === 0) return;
    void writeSlot(i, makeSave(state, options, log)).then(() => say(`Saved to slot ${i}`));
  });
}

async function openLoadMenu(): Promise<void> {
  const slots = await listSlots();
  const items = slots.map((s, i) => (s ? `${i === 0 ? "auto" : i}. ${saveLabel(s)}` : `${i === 0 ? "auto" : i}. empty`));
  menu("Load which game?", items, (i) => {
    void readSlot(i).then((s) => { if (s) resumeGame(s); else say("Empty slot"); });
  });
}

/** How many turns back the game can be taken from its menu. */
const REWIND_TURNS = 8;

/** Go back to the start of an earlier turn of the game in play (Game menu): its log cut back there and replayed, after asking. */
function openRewindMenu(save: SaveGame): void {
  const turns = turnStarts(save).slice(-REWIND_TURNS).reverse();
  const label = (turn: number) => `${formatYear(turnToYear(turn))}${turn === save.turn ? " (this turn)" : ""}`;
  menu("Back to the start of which turn?", [...turns.map((t) => label(t.turn)), "Never mind"], (i) => {
    const t = turns[i];
    const back = t && rewindSave(save, t.turn);
    if (!back) return;
    modal(`Back to ${formatYear(turnToYear(t.turn))}?`, ["Everything since then is lost, unless saved."], ["Go back", "Stay"], (k) => { if (k === 0) resumeGame(back); }, 1);
  });
}

// ---- diplomacy ----------------------------------------------------------------

/** How long the map holds on whom we met, or on our unit asked to leave, before the leader speaks. */
const BEAT_MS = 1600;

/** Show square (x, y) with a note beside it for a moment, then go on (a key or click goes on at once). */
function beat(x: number, y: number, text: string, then: () => void): void {
  screenState = { kind: "map" };
  centerOn(x, y);
  const now = performance.now();
  view.callout = { x, y, text };
  calloutUntil = now + BEAT_MS;
  screenState = { kind: "beat", until: now + BEAT_MS, then };
}

function endBeat(sc: Extract<Screen, { kind: "beat" }>): void {
  screenState = { kind: "map" };
  view.callout = undefined;
  sc.then();
}

/**
 * Our choices on the audience screen now showing, as its buttons. Each screen offers at most
 * AUDIENCE_CHOICES (asked for); longer lists go through `pagedChoices`.
 */
function talkMenu(items: string[], onPick: (i: number) => void, onCancel: () => void): void {
  const sc = screenState;
  if (sc.kind !== "diplomacy") return;
  if (items.length > AUDIENCE_CHOICES) console.warn(`audience: ${items.length} choices, showing ${AUDIENCE_CHOICES}`);
  screenState = { ...sc, talk: { items: items.slice(0, AUDIENCE_CHOICES), selected: 0, onPick, onCancel } };
}

/** A long list as audience screens: two at a time with More... and Never mind, the last few with Never mind alone. */
function pagedChoices(labels: string[], onPick: (i: number) => void, onCancel: () => void, start = 0): void {
  const rest = labels.length - start;
  const shown = rest <= AUDIENCE_CHOICES - 1 ? rest : AUDIENCE_CHOICES - 2;
  const items = labels.slice(start, start + shown);
  const more = shown < rest;
  talkMenu([...items, ...(more ? ["More..."] : []), "Never mind"], (i) => {
    if (i < shown) onPick(start + i);
    else if (more && i === shown) pagedChoices(labels, onPick, onCancel, start + shown);
    else onCancel();
  }, onCancel);
}

/** Pick an audience choice: the screen loses its buttons, then the choice runs (and usually shows new ones). */
function pickTalk(sc: Extract<Screen, { kind: "diplomacy" }>, i: number): void {
  const t = sc.talk;
  if (!t || i < 0 || i >= t.items.length) return;
  screenState = { kind: "diplomacy", player: sc.player, line: sc.line };
  t.onPick(i);
}

/** Keys on the audience screen: arrows move among the buttons (two to a row), Enter or 1-4 picks, Esc steps back. */
function diplomacyKey(e: KeyboardEvent, sc: Extract<Screen, { kind: "diplomacy" }>): void {
  const t = sc.talk;
  if (!t) { screenState = { kind: "map" }; return; }
  const n = t.items.length;
  const move = (d: number) => { t.selected = (t.selected + d + n) % n; };
  const digit = /^(?:Digit|Numpad)([1-4])$/.exec(e.code);
  if (digit) { pickTalk(sc, Number(digit[1]) - 1); return; }
  switch (e.code) {
    case "ArrowLeft": move(-1); break;
    case "ArrowRight": move(1); break;
    case "ArrowUp": move(n > 2 ? -2 : -1); break;
    case "ArrowDown": move(n > 2 ? 2 : 1); break;
    case "Enter": case "NumpadEnter": case "Space": pickTalk(sc, t.selected); break;
    case "Escape": screenState = { kind: "diplomacy", player: sc.player, line: sc.line }; t.onCancel(); break;
  }
}

/** Where we met civilization `player`: the unit (one we can see) or city of theirs nearest one of ours. */
function meetingPlace(player: number): { x: number; y: number } | null {
  const me = state.players[0]!;
  const w = state.map.width;
  const ours = [...state.units.filter((u) => u.owner === 0), ...state.cities.filter((c) => c.owner === 0)];
  const theirs = [
    ...state.units.filter((u) => u.owner === player && me.visible[u.y * w + u.x] === 1),
    ...state.cities.filter((c) => c.owner === player && me.explored[c.y * w + c.x] === 1),
  ];
  let best: { x: number; y: number } | null = null;
  let bestD = Infinity;
  for (const t of theirs) {
    const d = Math.min(...ours.map((o) => mapDistance(state.map, t.x, t.y, o.x, o.y)));
    if (d < bestD) { best = { x: t.x, y: t.y }; bestD = d; }
  }
  return best;
}

/** A leader's first words, by how they regard us and what they make of our influence. */
function greeting(player: number): string {
  const c = civ(state.players[player]!.civ);
  const regard = esteem(state, player, 0);
  switch (attitude(state, player, 0)) {
    case "friendly": return regard === "admired"
      ? `I am ${c.leader} of the ${c.name}. Word of your great cities has reached even us.`
      : `I am ${c.leader} of the ${c.name}. May our peoples prosper side by side.`;
    case "wary": return regard === "scorned"
      ? `I am ${c.leader} of the ${c.name}. We had never heard of your people.`
      : `I am ${c.leader} of the ${c.name}. Our armies are many; walk softly near our lands.`;
    default: return regard === "scorned" ? `I am ${c.leader} of the ${c.name}. What are your villages to our cities?` : leaderLine(state, player);
  }
}

/** First contact: the map shows whom we met, then their leader receives us. */
function meet(player: number, then: () => void): void {
  const place = meetingPlace(player);
  const talk = () => audience(player, greeting(player), then, true);
  if (place) beat(place.x, place.y, `The ${state.players[player]!.name}`, talk);
  else talk();
}

/**
 * An audience with a foreign leader: their palace, their words and our proposals, at most four at a
 * time: peace (or, at peace, borders and maps), gifts and trade, war, farewell; borders and maps, and
 * gifts and trade, open screens of their own. Each proposal is made once an audience; the leader's
 * answer becomes their words and the talk goes on until Farewell.
 */
function audience(player: number, line: string, done: () => void = () => { screenState = { kind: "map" }; }, first = false): void {
  const them = state.players[player]!;
  const tried = new Set<string>();
  const speak = (words: string) => { screenState = { kind: "diplomacy", player, line: words }; };
  /** Proposals not yet made, each marked made when picked. */
  const fresh = (list: [string, () => void][]): [string, () => void][] =>
    list.filter(([label]) => !tried.has(label)).map(([label, fn]) => [label, () => { tried.add(label); fn(); }]);
  const bordersAndMaps = (): [string, () => void][] => fresh([
    bordersOpen(state, 0, player)
      ? ["Close borders", () => { dispatch({ type: "closeBorders", player }); talk("As you wish. Keep to your lands, and we to ours."); }]
      : ["Open borders", () => proposeBorders(player, talk, () => talk("Our lands are open to your people, and yours to ours."))],
    ["Exchange maps", () => {
      if (!acceptsMapSwap(state, player, 0)) { talk("Our maps are not for your eyes."); return; }
      dispatch({ type: "shareMaps", player });
      talk("Our scribes copy your maps, and yours ours.");
    }],
  ]);
  const giftsAndTrade = (): [string, () => void][] => {
    const me = state.players[0]!;
    return fresh([
      ...(them.advances.some((a) => !me.advances.includes(a)) && tradeAsk(state, player, 0) ? [["Trade knowledge", () => tradeKnowledge(player, talk)] as [string, () => void]] : []),
      ...(me.gold >= 50 ? [["Give 50 gold", () => { dispatch({ type: "giveGold", player, amount: 50 }); talk("Your generosity will be remembered."); }] as [string, () => void]] : []),
      ["Demand tribute", () => {
        const gold = tributeOffer(state, player, 0);
        if (gold > 0) { dispatch({ type: "tribute", player, amount: gold }); talk(`Take these ${gold} gold, and leave us in peace.`); return; }
        const paid = state.tributePaid?.[`${player}>0`];
        talk(paid !== undefined && state.turn - paid < 20 ? "We paid you not long ago. Do not ask again so soon."
          : them.gold < 10 ? "Our treasury is bare; there is nothing to give."
          : "We pay tribute to no one. Come and take it, if you dare.");
      }],
    ]);
  };
  /** A screen of proposals with Back to the first. */
  const sub = (words: string, items: [string, () => void][]) => {
    speak(words);
    const all: [string, () => void][] = [...items, ["Back", () => talk(words)]];
    talkMenu(all.map((i) => i[0]), (i) => all[i]?.[1](), () => talk(words));
  };
  const talk = (words: string): void => {
    speak(words);
    const items: [string, () => void][] = [];
    if (atWar(state, 0, player)) {
      items.push(...fresh([["Propose peace", () => {
        // A rival that is winning, with its armies at our gates, will not stop now.
        if (!acceptsPeace(state, player, 0)) { talk("Not while our armies stand at your gates."); return; }
        dispatch({ type: "makePeace", player });
        talk("Peace, then. Let the dead rest.");
      }]]));
    } else {
      // Met but without a treaty: peace comes first, and with it open borders and maps.
      const treaty = atPeace(state, 0, player);
      if (!treaty) items.push(...fresh([["Propose peace", () => proposePeace(player, talk)]]));
      else if (bordersAndMaps().length) items.push(["Borders and maps", () => sub(words, bordersAndMaps())]);
      if (giftsAndTrade().length) items.push(["Gifts and trade", () => sub(words, giftsAndTrade())]);
      items.push([treaty ? "Break the treaty" : "Declare war", () => {
        speak(treaty ? `Would you break our treaty?` : "Would you make war on us?");
        talkMenu(["Keep the peace", "Declare war!"], (i) => {
          if (i !== 1) { talk(words); return; }
          dispatch({ type: "declareWar", player });
          tried.add("Propose peace");
          talk("So be it. Our armies will answer you.");
        }, () => talk(words));
      }]);
    }
    items.push([first ? "Part in peace" : "Farewell", done]);
    talkMenu(items.map((i) => i[0]), (i) => items[i]?.[1](), done);
  };
  talk(line);
}

/**
 * Ask `player` to open borders: a friendly civilization agrees, a wary one
 * asks a gift first, a hostile one refuses. `talk` carries the answer;
 * `agreed` runs once borders are open.
 */
function proposeBorders(player: number, talk: (words: string) => void, agreed: () => void): void {
  proposeDeal(player, bordersAnswer(state, player, 0), BORDERS_PRICE, talk, {
    no: "We will not have your soldiers roam our lands.",
    price: `For a gift of ${BORDERS_PRICE} gold, our lands are open to you.`,
    question: `Pay ${BORDERS_PRICE} gold for open borders?`,
    declined: "Then our borders stay closed.",
  }, () => { dispatch({ type: "openBorders", player }); agreed(); });
}

/** Ask `player`, met without a treaty, for peace: a friendly civilization signs, a wary one asks a gift first, a hostile one refuses. */
function proposePeace(player: number, talk: (words: string) => void): void {
  proposeDeal(player, peaceAnswer(state, player, 0), PEACE_PRICE, talk, {
    no: esteem(state, player, 0) === "scorned" ? "A treaty with a people no one has heard of? No." : "We will bind ourselves to no treaty with you.",
    price: `For a gift of ${PEACE_PRICE} gold, we will sign.`,
    question: `Pay ${PEACE_PRICE} gold for a peace treaty?`,
    declined: "Then we have nothing to sign.",
  }, () => { dispatch({ type: "makePeace", player }); talk("Let there be peace between our peoples."); });
}

/**
 * A deal a leader answers by attitude: yes (`agreed` runs), for a gift of
 * `price` gold (asked first, then paid), or no. `words` are the leader's.
 */
function proposeDeal(player: number, answer: "yes" | "for gold" | "no", price: number, talk: (words: string) => void,
  words: { no: string; price: string; question: string; declined: string }, agreed: () => void): void {
  if (answer === "no") { talk(words.no); return; }
  if (answer === "yes") { agreed(); return; }
  if (state.players[0]!.gold < price) { talk(`For ${price} gold we might. You have not so much.`); return; }
  screenState = { kind: "diplomacy", player, line: words.price };
  talkMenu([`Pay ${price} gold`, "No"], (i) => {
    if (i !== 0) { talk(words.declined); return; }
    dispatch({ type: "giveGold", player, amount: price });
    agreed();
  }, () => talk(words.declined));
}

/** Pick one of their advances; they name the one of ours they want for it. */
function tradeKnowledge(player: number, talk: (words: string) => void): void {
  const me = state.players[0]!;
  const theirs = state.players[player]!.advances.filter((a) => !me.advances.includes(a)).slice(-12);
  const give = tradeAsk(state, player, 0);
  if (!give || !theirs.length) { talk("We have nothing to trade with you."); return; }
  screenState = { kind: "diplomacy", player, line: "Which of our advances would you learn?" };
  pagedChoices(theirs.map((a) => advance(a).name), (i) => {
    const receive = theirs[i];
    if (!receive) { talk("As you wish."); return; }
    screenState = { kind: "diplomacy", player, line: `For ${advance(receive).name}, we ask ${advance(give).name}.` };
    talkMenu(["Trade", "No"], (k) => {
      if (k !== 0 || !dispatch({ type: "exchangeAdvances", player, give, receive })) { talk("As you wish."); return; }
      showFound([receive], () => talk("Knowledge for knowledge: a fair trade."));
    }, () => talk("As you wish."));
  }, () => talk("As you wish."));
}

/** The leader's words when our units stand on their land: a request, then the last warning. */
function leaveWords(warnings: number): string {
  return warnings >= 2 ? "We will not ask again. Take your units off our land, or it is war."
    : "Your units stand on our land without leave. Take them home.";
}

/**
 * `owner` asks us to take our units off its land (a unit just stepped in,
 * or its leader asks at its turn): the map shows one of them, then the
 * leader speaks. We leave (each unit walks to the nearest square outside),
 * ask for open borders, pay them to look away, or stay.
 */
function askToLeave(owner: number, warnings: number, then: () => void, at?: { x: number; y: number }): void {
  const ours = trespassers(state, owner, 0);
  if (!ours.length) { then(); return; }
  askedLeave.add(owner);
  const them = state.players[owner]!;
  const leader = civ(them.civ).leader;
  const where = at ?? ours[0]!;
  beat(where.x, where.y, `Land of the ${them.name}`, () => {
    const tried = new Set<string>();
    const talk = (words: string): void => {
      screenState = { kind: "diplomacy", player: owner, line: words };
      const items: [string, () => void][] = [];
      items.push(["We will leave", () => {
        const n = withdraw(owner);
        then();
        say(n ? `Our units leave the land of the ${them.name}.` : "Our units find no way out.", 3000);
      }]);
      if (!tried.has("borders") && atPeace(state, owner, 0) && bordersAnswer(state, owner, 0) !== "no")
        items.push(["Open borders?", () => {
          tried.add("borders");
          proposeBorders(owner, talk, () => { then(); say(`The ${them.name} open their lands to us.`, 3000); });
        }]);
      if (state.players[0]!.gold >= 50)
        items.push(["Give 50 gold", () => {
          dispatch({ type: "giveGold", player: owner, amount: 50 });
          then();
          say(`${leader} takes the gold and looks away, for now.`, 3500);
        }]);
      items.push(["We stay", () => { then(); say(`${leader}: "Then you have been warned."`, 3500); }]);
      talkMenu(items.map((i) => i[0]), (i) => items[i]?.[1](), then);
    };
    talk(leaveWords(warnings));
  });
}

/** Send each of our units on `owner`'s land to the nearest square it can reach outside it; how many set off. */
function withdraw(owner: number): number {
  let sent = 0;
  for (const u of trespassers(state, owner, 0)) {
    const exit = nearestExit(u, owner);
    if (exit && dispatch({ type: "goto", unit: u.id, x: exit.x, y: exit.y })) sent++;
  }
  return sent;
}

/** The nearest land square outside `owner`'s land (and any other land that minds us) that unit `u` can walk to. */
function nearestExit(u: { id: number; x: number; y: number }, owner: number): { x: number; y: number } | null {
  const unit = unitById(state, u.id);
  if (!unit) return null;
  const w = state.map.width;
  for (let r = 1; r <= 8; r++) {
    let best: { x: number; y: number } | null = null;
    let steps = Infinity;
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const x = (((u.x + dx) % w) + w) % w;
        const y = u.y + dy;
        const t = getTile(state.map, x, y);
        if (!t || t.terrain === Terrain.Ocean) continue;
        const land = landOwner(state, x, y);
        if (land === owner || (land >= 0 && mindsTrespass(state, land, 0))) continue;
        const city = cityAt(state, x, y);
        if ((city && city.owner !== 0) || unitAt(state, x, y).some((o) => o.owner !== 0)) continue;
        const path = findPath(state, unit, x, y);
        if (path && path.length < steps) { best = { x, y }; steps = path.length; }
      }
    if (best) return best;
  }
  return null;
}

/**
 * A computer leader's envoy offers us peace (from war, or as a treaty after
 * meeting): we sign (makePeace) or send the envoy home.
 */
function peaceOfferAudience(player: number, then: () => void): void {
  if (atPeace(state, 0, player) || !state.players[player]?.alive) { then(); return; }
  const war = atWar(state, 0, player);
  const words = war ? "Enough blood has been spilled. Let us make peace."
    : esteem(state, player, 0) === "admired" ? "Your people are much spoken of. Let us bind ourselves in peace."
    : "Let our peoples be at peace, by treaty.";
  screenState = { kind: "diplomacy", player, line: words };
  const refuse = () => { then(); say(`${civ(state.players[player]!.civ).leader}: "The offer will not stand forever."`, 3500); };
  talkMenu(["Sign the treaty", "Refuse"], (i) => {
    if (i !== 0) { refuse(); return; }
    dispatch({ type: "makePeace", player });
    audience(player, "It is done. May it last.", then);
  }, refuse);
}

/** A civilization declares war on us: its leader says so. */
function warAudience(player: number, reason: "trespass" | undefined, then: () => void): void {
  screenState = { kind: "diplomacy", player, line: reason === "trespass" ? "You were warned. Now our armies will drive you from our land." : "Enough words. Our armies march against you." };
  talkMenu(["So be it"], () => then(), then);
}

function openDiplomacy(player: number): void {
  audience(player, leaderLine(state, player));
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
      case "overthrown": return ev.player === 0 ? "Riots have toppled the government: anarchy!" : `Riots topple the ${state.players[ev.player]?.name} government.`;
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
    case "celebration": return `${name} holds a feast in your honour!`;
    case "starving": return `${name} is starving`;
    case "famine": return `Famine in ${name}: ${ev.detail} lost`;
    case "sold": return `${name} sells its ${ev.detail} to pay the bills`;
    case "pollution": return `Pollution near ${name}!`;
    case "disbanded": return `${name} cannot support ${ev.detail}: disbanded`;
    case "borders": return `${name}'s culture spreads: its border grows`;
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
    else if (ev.kind === "disbanded") {
      // Every unit lost to upkeep this turn, in one window.
      const lost = [ev];
      for (let i = 0; i < events.length; ) {
        const e = events[i]!;
        if (e.kind === "disbanded") { lost.push(e); events.splice(i, 1); } else i++;
      }
      const lines = lost.map((e) => `{shield} ${state.cities.find((c) => c.id === e.city)?.name ?? "A city"} can't support its ${e.detail}`);
      modal(lost.length > 1 ? "Units disbanded" : "Unit disbanded", [...lines, "Extra units cost a shield a turn."], ["OK"], () => next(), 0, next);
    }
    else if ((ev.kind === "built" || ev.kind === "wonder") && ev.production && builtNotice(state, ev.city, ev.production)) builtWindow(ev.city, ev.production, next);
    else if (ev.kind === "contact") meet(ev.player, next);
    else if (ev.kind === "trespass" || ev.kind === "leaveDemand") {
      // One request a civilization at a time: the latest says how far it has gone.
      let warnings = ev.warnings;
      for (let i = 0; i < events.length; ) {
        const e = events[i]!;
        if ((e.kind === "trespass" || e.kind === "leaveDemand") && e.player === ev.player) { warnings = Math.max(warnings, e.warnings); events.splice(i, 1); } else i++;
      }
      askToLeave(ev.player, warnings, next, ev.kind === "trespass" ? { x: ev.x, y: ev.y } : undefined);
    }
    else if (ev.kind === "warDeclared" && ev.on === 0) warAudience(ev.player, ev.reason, next);
    else if (ev.kind === "peaceOffer" && ev.to === 0) peaceOfferAudience(ev.player, next);
    else if (ev.kind === "chooseResearch") askResearch(next);
    else if (ev.kind === "chooseGovernment") openGovernmentMenu({ kind: "map" }, next);
    else if (ev.kind === "disorder" && state.cities.find((c) => c.id === ev.city)?.owner === 0) {
      // Riots open the city with its Happy panel up, as the original did, so the trouble can be seen and settled.
      say(eventMessage(ev) ?? "", 4000);
      openCity(ev.city, next);
      if (screenState.kind === "city") screenState.view.happy = true;
    }
    else if (ev.kind === "overthrown" && ev.player === 0) modal("Revolution!", ["Riots have gone on too long: the people have toppled the government.", "Anarchy reigns until a new one is chosen."], ["OK"], () => next(), 0, next);
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
  if (ev.kind === "warDeclared") return ev.on === 0;
  if (ev.kind === "leaveDemand") return ev.to === 0;
  if (ev.kind === "peaceOffer") return ev.to === 0;
  if (ev.kind === "trespass") return ev.intruder === 0; // our gotos, walked as our turn began
  return ev.kind === "eliminated" || ev.kind === "globalWarming" || ev.kind === "nuked"
    || ev.kind === "spaceLaunched" || ev.kind === "spaceArrived" || ev.kind === "spaceLost";
}

function endTurn(): void {
  // Last turn's news has not been shown yet (slides still running): show it first.
  if (afterSlides.length) { skipWatch(); return; }
  skipWatch();
  handoff = null;
  view.focus = undefined;
  const actions: UnitAction[] = [];
  askedLeave.clear();
  // What we can see now; a unit lost in the turns to come takes its sight with it.
  const sawBefore = state.players[0]!.visible.slice();
  dispatch({ type: "endTurn" });
  // Our own end of turn (contacts come from the relations; other civs' villages are theirs).
  const events: TurnEvent[] = lastTurnEvents.filter((ev) => ev.kind !== "contact" && !(ev.kind === "hut" && ev.player !== 0));
  // Other civilizations move now. Each one's moves are read before its own end of turn clears them.
  let seen = lastTurnEvents.length;
  let guard = 0;
  while (state.players[state.currentPlayer]!.isAi && guard++ < 16) {
    aiTurn(state);
    for (const ev of lastTurnEvents.slice(seen)) if (concernsUs(ev)) events.push(ev);
    actions.push(...lastActions);
    applyCommand(state, { type: "endTurn" });
    seen = 0;
  }
  // The last civ's end of turn and the start of ours (a goto may have reached a village).
  for (const ev of lastTurnEvents) if (concernsUs(ev) || (ev.kind === "hut" && ev.player === 0)) events.push(ev);
  actions.push(...lastActions);
  // Whom we met comes first: a new neighbour's other words make sense only after the greeting.
  const contacts = newContacts();
  // A declaration of war from someone we know comes before their attack is seen, so it explains it.
  const met = new Set(contacts.map((ev) => (ev.kind === "contact" ? ev.player : -1)));
  const wars = events.filter((ev) => ev.kind === "warDeclared" && ev.on === 0 && !met.has(ev.player));
  const news = [...contacts, ...events.filter((ev) => !wars.includes(ev))];
  const fights = actions.filter((a): a is UnitBattle => a.kind === "battle" && (a.attacker.owner === 0 || a.defender.owner === 0));
  void runAiPlayers; // replay helper lives in core; here the loop above also harvests events
  autosave();
  // Their moves we could see, then our gotos (begun as our turn started), then the fights told, then the news.
  const watch = (): void => {
    watchOthers(actions, sawBefore);
    whenStill(() => battleReport(fights, () => presentEvents(news, () => {
      const end = checkGameEnd(state, FINAL_TURN);
      if (end) endGame(end);
    })));
  };
  if (wars.length) presentEvents(wars, watch); else watch();
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
  } else refuseMove(unit, dx, dy, r.reason);
  blinkOn = true;
  lastBlink = performance.now();
  afterUnitOrder(before, mark);
}

function mapKey(e: KeyboardEvent): void {
  if (watching && motion.busy(performance.now())) { e.preventDefault(); skipWatch(); return; }
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
    case "KeyD": if (e.shiftKey && active !== null) confirmDisband(active); break;
    case "KeyH": if (active !== null) setHome(active); break;
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

function cityKey(e: KeyboardEvent, sc: Extract<Screen, { kind: "city" }>): void {
  const cv = sc.view;
  switch (e.code) {
    case "Escape": leaveCity(sc); break;
    // Not a held Enter, which would carry on from the menu or notice it just answered.
    case "Enter": case "NumpadEnter": if (!e.repeat) leaveCity(sc); break;
    case "KeyC": openProductionMenu(cv.city); break;
    case "KeyB": askBuy(cv.city); break;
    case "KeyV": openCityView(sc); break;
    case "KeyH": cv.happy = !cv.happy; break;
    case "KeyF": openFocusMenu(cv.city); break;
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
  const page = Math.max(1, renderer.menuRows(m) - 1);
  switch (e.code) {
    case "ArrowUp": case "Numpad8": m.selected = (m.selected + m.items.length - 1) % m.items.length; break;
    case "ArrowDown": case "Numpad2": m.selected = (m.selected + 1) % m.items.length; break;
    case "PageUp": case "Numpad9": moveSelection(m, -page); break;
    case "PageDown": case "Numpad3": moveSelection(m, page); break;
    case "Home": case "Numpad7": moveSelection(m, -m.items.length); break;
    case "End": case "Numpad1": moveSelection(m, m.items.length); break;
    case "Enter": case "NumpadEnter": case "Space": screenState = sc.under; sc.onPick(m.selected); return;
    case "Escape": screenState = sc.under; sc.onCancel?.(); return;
  }
  m.top = keepInView(m, renderer.menuRows(m));
}

/** Move a menu's selection by `by` rows, stopping at the ends, and scroll it into view. */
function moveSelection(m: MenuState, by: number): void {
  m.selected = Math.max(0, Math.min(m.items.length - 1, m.selected + by));
  m.top = keepInView(m, renderer.menuRows(m));
}

function setupKey(e: KeyboardEvent, sc: Extract<Screen, { kind: "setup" }>): void {
  const m = setupMenu(sc.setup);
  const apply = (i: number) => { if (setupChoose(sc.setup, i)) startGame(setupOptions(sc.setup)); };
  setupSelection = Math.min(setupSelection, m.items.length - 1);
  // Cards in rows: left and right step along, up and down a row (one row: the same as left and right).
  const cards = setupCards(sc.setup);
  const n = m.items.length;
  const across = cards && cards.columns < n ? cards.columns : 1;
  const step = (d: number) => {
    const to = setupSelection + d;
    setupSelection = Math.abs(d) > 1 ? (to >= 0 && to < n ? to : setupSelection) : (to + n) % n;
  };
  switch (e.code) {
    case "ArrowLeft": case "Numpad4": if (cards) step(-1); break;
    case "ArrowRight": case "Numpad6": if (cards) step(1); break;
    case "ArrowUp": case "Numpad8": step(-across); break;
    case "ArrowDown": case "Numpad2": step(across); break;
    case "Enter": case "NumpadEnter": case "Space": apply(setupSelection); if (screenState === sc) setupSelection = setupMenu(sc.setup).selected; break;
    case "Escape": screenState = { kind: "title" }; break;
  }
}
let setupSelection = 0;

/** Begin the setup questions at `step`: a random world asks difficulty first, a premade one which world, a custom one its size. */
function openSetup(step: SetupState["step"]): void {
  const setup: SetupState = { step, world: null, historical: true, custom: null, difficulty: 2, opponents: 6, civ: "romans" };
  screenState = { kind: "setup", setup };
  setupSelection = setupMenu(setup).selected;
}

/** A key or click on the title: the opening skips to its end and the menu opens. */
function skipIntro(): void {
  if (titleAt < INTRO_MS) introStart = performance.now() - INTRO_MS;
  void openTitleMenu();
}

/** The title menu, opened once the opening is over; with an autosave, the game left last can be picked up. */
let titleMenuPending = false;
async function openTitleMenu(): Promise<void> {
  if (titleMenuPending) return;
  titleMenuPending = true;
  const auto = await readSlot(0).catch(() => undefined);
  titleMenuPending = false;
  if (screenState.kind !== "title") return;
  const items: [string, () => void][] = [
    ...(auto ? [[`Continue: ${saveLabel(auto)}`, () => resumeGame(auto)] as [string, () => void]] : []),
    ["Start a new game", () => openSetup("difficulty")],
    ["Play on a premade world", () => openSetup("world")],
    ["Customize world", () => openSetup("size")],
    ["Load a saved game", () => void openLoadMenu()],
  ];
  screenState = {
    kind: "menu",
    under: { kind: "title" },
    // No header: the name stands over it, as the original's menu sat under its title.
    menu: { title: "", items: items.map((i) => i[0]), selected: 0 },
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
      noteInput();
      openBarMenu(BAR_KEYS[e.code]!);
    }
    return;
  }
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  noteInput();
  view.inspect = undefined;
  view.callout = undefined;
  view.plan = undefined;
  const sc = screenState;
  switch (sc.kind) {
    case "title": skipIntro(); break;
    case "setup": setupKey(e, sc); break;
    case "map": mapKey(e); break;
    case "city": cityKey(e, sc); break;
    case "cityView": screenState = sc.city; break;
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
    case "research": treeKey(e, sc); break;
    case "diplomacy": diplomacyKey(e, sc); break;
    case "beat": e.preventDefault(); endBeat(sc); break;
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
  // Over a list too long for the screen, the wheel moves the choice a few rows a notch.
  if (sc.kind === "menu" && renderer.menuRows(sc.menu) < sc.menu.items.length) {
    e.preventDefault();
    moveSelection(sc.menu, Math.sign(e.deltaY) * 3);
    return;
  }
  if (sc.kind !== "research") return;
  e.preventDefault();
  // The list scrolls a row for each line of the wheel (pixels gathered until they make a row).
  wheelRows += e.deltaMode === 1 ? e.deltaY : e.deltaMode === 2 ? e.deltaY * renderer.researchListRows : e.deltaY / 30;
  const rows = Math.trunc(wheelRows);
  if (rows) { wheelRows -= rows; treeScroll(sc, rows); }
}, { passive: false });
let wheelRows = 0;
/** What the audience screen shows: the leader's words and our choices. */
function diplomacyView(sc: Extract<Screen, { kind: "diplomacy" }>): DiplomacyView {
  return { player: sc.player, line: sc.line, ...(sc.talk ? { choices: sc.talk.items, selected: sc.talk.selected } : {}) };
}

// The setup's cards, and the audience's buttons, light up under the pointer.
canvas.addEventListener("mousemove", (e) => {
  const sc = screenState;
  if (sc.kind === "diplomacy" && sc.talk) {
    const [px, py] = toLogical(e);
    const i = renderer.diplomacyChoiceAt(diplomacyView(sc), px, py);
    if (i >= 0) sc.talk.selected = i;
    return;
  }
  if (sc.kind !== "setup") return;
  const cards = setupCards(sc.setup);
  if (!cards) return;
  const [px, py] = toLogical(e);
  const i = renderer.setupHit(cards, px, py);
  if (i >= 0) setupSelection = i;
});
canvas.addEventListener("mousedown", (e) => {
  const [px, py] = toLogical(e);
  noteInput();
  view.callout = undefined;
  // A planned move lasts one click: carried out if that click is on its square, dropped otherwise.
  const pending = view.plan;
  view.plan = undefined;
  const sc = screenState;
  switch (sc.kind) {
    case "title": skipIntro(); return;
    case "setup": {
      // A card is picked when it is clicked lit (the pointer lights it on the way, a first tap on a phone).
      const cards = setupCards(sc.setup);
      if (cards) {
        const i = renderer.setupHit(cards, px, py);
        if (i >= 0 && i === setupSelection) setupKey({ code: "Enter" } as KeyboardEvent, sc);
        else if (i >= 0) setupSelection = i;
        return;
      }
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
      // The bar of a long list pages through it, above or below its thumb; the thumb itself does nothing.
      const way = renderer.menuScrollAt(sc.menu, px, py);
      if (way !== null) { if (way) moveSelection(sc.menu, way * Math.max(1, renderer.menuRows(sc.menu) - 1)); return; }
      const i = renderer.menuHit(sc.menu, px, py);
      screenState = sc.under;
      if (i >= 0) sc.onPick(i); else sc.onCancel?.();
      return;
    }
    case "report": case "worldMap": screenState = { kind: "map" }; return;
    case "research": if (e.button === 0) treeClick(sc, px, py); return;
    case "end": screenState = { kind: "title" }; return;
    case "diplomacy": {
      // A button picks its choice; elsewhere nothing (no talk on screen: back to the map).
      if (!sc.talk) { screenState = { kind: "map" }; return; }
      pickTalk(sc, renderer.diplomacyChoiceAt(diplomacyView(sc), px, py));
      return;
    }
    case "beat": endBeat(sc); return;
    case "rates": case "science": case "spaceship": screenState = { kind: "map" }; return;
    case "input": return;
    case "advisor":
      if (sc.which === "foreign") openForeignTalkMenu(); else screenState = { kind: "map" };
      return;
    case "city": {
      const button = renderer.cityButtonAt(px, py);
      if (button === "change") { openProductionMenu(sc.view.city); return; }
      if (button === "buy") { askBuy(sc.view.city); return; }
      if (button === "view") { openCityView(sc); return; }
      if (button === "happy") { sc.view.happy = !sc.view.happy; return; }
      if (button === "focus") { openFocusMenu(sc.view.city); return; }
      const unit = renderer.cityUnitAt(state, sc.view, px, py);
      if (unit !== null) { activateFromCity(sc, unit); return; }
      // A worked square frees its citizen; an unworked one takes a free citizen or the worker on the
      // weakest square; the city's own square puts every citizen on the best squares. A click on
      // nothing that answers leaves the city, as Exit, Esc and Enter do.
      const slot = renderer.citySlotAt(px, py);
      const city = state.cities.find((c) => c.id === sc.view.city);
      if (slot === 0) { if (dispatch({ type: "arrangeCity", city: sc.view.city })) say("Citizens moved to the best tiles"); }
      else if (slot !== null && city && !city.worked.includes(slot) && !slotInLand(state, city, slot)) say(`Beyond ${city.name}'s border`);
      else if (slot !== null && city) dispatch({ type: city.worked.includes(slot) ? "toggleTile" : "workTile", city: city.id, slot });
      else leaveCity(sc);
      return;
    }
    case "cityView": {
      const picked = renderer.cityViewAt(state, sc.view, px, py);
      if (picked) sc.view.picked = picked;
      else screenState = sc.city;
      return;
    }
    case "map": break;
  }

  if (watching && motion.busy(performance.now())) { skipWatch(); return; }
  const bar = renderer.menuBarHit(px, py);
  if (bar >= 0) { openBarMenu(bar); return; }
  const mm = renderer.minimapAt(state, px, py);
  if (mm) { centerOn(mm.x, mm.y); return; }
  // The research row of the status panel opens the research panel.
  if (e.button === 0 && renderer.statusAt(state, view, px, py) === "research") { openTree({ choosing: true, closable: true }); return; }
  if (handoff) { finishHandoff(); return; }
  const hit = renderer.tileAt(state, view, px, py);
  const active = state.activeUnit !== null ? unitById(state, state.activeUnit) : undefined;
  if (!hit) {
    if (e.button === 2) { if (active) openActionMenu(active.id); else openGameMenu(); }
    return;
  }
  const { x: tx, y: ty } = hit;

  // Right-click: the square's window (terrain, what is on it, and a few things to do about it).
  if (e.button === 2) { openTerrainInfo(tx, ty); return; }
  // A double click centres the map on its square (the move its first click showed is dropped, not made).
  // Its second click is matched by where it lands on the screen: the first may have set the map gliding.
  const now = performance.now();
  const first = lastClick;
  lastClick = { px, py, x: tx, y: ty, at: now };
  if (first && now - first.at < DOUBLE_CLICK_MS && Math.abs(px - first.px) <= 4 && Math.abs(py - first.py) <= 4) {
    lastClick = null;
    centerOn(first.x, first.y);
    return;
  }
  // Left-click on a planned move's square, a second time: the unit goes (or fights, or takes the city).
  if (pending && active && pending.unit === active.id && pending.x === tx && pending.y === ty) {
    if (isAdjacent(active, tx, ty)) tryMove(active.id, stepTo(active, tx), ty - active.y);
    else sendTo(active.id, tx, ty);
    return;
  }
  // Our city opens, and our unit is picked (the next of a stack on the active unit's square).
  const city = cityAt(state, tx, ty);
  const mine = unitAt(state, tx, ty).filter((u) => u.owner === 0);
  if (city && city.owner === 0) { centerOn(tx, ty); openCity(city.id); return; }
  if (active && active.x === tx && active.y === ty) {
    const ready = mine.filter((u) => u.movesLeft > 0);
    const nextUnit = ready[(ready.findIndex((u) => u.id === active.id) + 1) % ready.length];
    if (nextUnit && nextUnit.id !== active.id) dispatch({ type: "activate", unit: nextUnit.id });
    return;
  }
  const own = mine.find((u) => u.movesLeft > 0) ?? mine[0];
  if (own) {
    centerOn(tx, ty);
    dispatch({ type: "activate", unit: own.id });
    if (state.activeUnit !== own.id) say("No moves left this turn");
    return;
  }
  // The active unit: a step next door at once; a fight, a city to take or a square further off is
  // shown first (route, turns, odds) and goes on a second click on the same square.
  const move = active ? planMove(state, active.id, tx, ty) : null;
  if (active && move === "step") { tryMove(active.id, stepTo(active, tx), ty - active.y); return; }
  if (move && move !== "step") { view.plan = move; return; }
  // Anywhere else the map centres on the square and shows it in the panel.
  centerOn(tx, ty);
  view.inspect = { x: tx, y: ty };
});

/** Two left clicks on the map this close together, in time and on the screen, are a double click. */
const DOUBLE_CLICK_MS = 300;
let lastClick: { px: number; py: number; x: number; y: number; at: number } | null = null;

// ---- frame loop ---------------------------------------------------------------
function draw(sc: Screen): void {
  switch (sc.kind) {
    case "title": renderer.title(titleAt); break;
    case "setup": {
      const cards = setupCards(sc.setup);
      if (cards) { renderer.setup(cards, setupSelection, titleAt); break; }
      renderer.title(titleAt);
      const m = setupMenu(sc.setup);
      renderer.menu({ ...m, selected: setupSelection });
      break;
    }
    case "map": case "beat": view.message = status; renderer.main(state, view); break;
    case "report": renderer.report(sc.page); break;
    case "worldMap": renderer.worldMap(state); break;
    case "city": sc.view.message = status; renderer.city(state, sc.view); break;
    case "cityView": renderer.cityView(state, sc.view); break;
    case "research": renderer.research(state, sc.view); break;
    case "science": renderer.science(state); break;
    case "rates": renderer.rates(state); break;
    case "advisor": renderer.advisor(state, sc.which); break;
    case "diplomacy": renderer.diplomacy(state, diplomacyView(sc)); break;
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
  introStart ??= t;
  titleAt = t - introStart;
  if (screenState.kind === "title" && titleAt >= INTRO_MS) void openTitleMenu();
  if (t - lastBlink > 400) { blinkOn = !blinkOn; lastBlink = t; }
  view.blink = blinkOn;
  view.autoEnd = autoEnd;
  view.borders = borders;
  if (screenState.kind === "research") screenState.view.blink = blinkOn;
  if (screenState.kind !== "title" && screenState.kind !== "setup") stepCamera(t);
  if (status && t > statusUntil) status = undefined;
  if (view.callout && t > calloutUntil) view.callout = undefined;
  if (view.plan && view.plan.unit !== state.activeUnit) view.plan = undefined;
  if (screenState.kind === "beat" && t >= screenState.until) endBeat(screenState);
  const shown = motion.at(t);
  view.moving = shown.moving.length ? shown.moving : undefined;
  view.battle = shown.battle;
  showHold(shown.hold);
  // No game yet on the title screen and its menus.
  const lifting = (state as GameState | undefined) ? lifter.update(state, t, shown.moving) : undefined;
  view.lifting = lifting?.size ? lifting : undefined;
  const animating = motion.busy(t);
  if (!animating) watching = false;
  stepHandoff(t, animating);
  if (handoff) view.blink = true; // the unit that just acted stays solid while the view lingers
  if (!animating && afterSlides.length && screenState.kind === "map") for (const fn of afterSlides.splice(0)) fn();
  // Auto end turn: nothing to order, the player has been idle a moment, and the map is showing.
  if (autoEnd && !autoEndHeld && screenState.kind === "map" && state.activeUnit === null && state.players[0]!.alive && !animating && !afterSlides.length && !handoff
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
