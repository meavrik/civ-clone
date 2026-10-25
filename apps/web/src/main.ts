import { acceptsMapSwap, acceptsPeace, aiTurn, attitude, bordersAnswer, BORDERS_PRICE, peaceAnswer, PEACE_PRICE, tradeAsk, tributeOffer, withdrawAnswer } from "@civ/ai";
import {
  advance,
  applyCommand,
  atPeace,
  atWar,
  bordersOpen,
  advancesFor,
  availableAdvances,
  buildOptions,
  computeCity,
  cityFoci,
  FOCI,
  shieldsAfterChange,
  buyCost,
  building,
  sellPrice,
  whyNoSale,
  canFoundCity,
  exitSquare,
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
  routeBonus,
  runAiPlayers,
  shipStats,
  Terrain,
  traitMoves,
  trespassers,
  turnToYear,
  unitAt,
  unitById,
  unitType,
  wonder,
  wrapX,
  weakestWorked,
  workOptions,
  WORLD_SIZES,
  type Cheat,
  type CityFocus,
  type CityTurnEvent,
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
  type Unit,
} from "@civ/core";
import {
  builtNotice,
  canResearch,
  civCard,
  standing,
  citizenRole,
  citizenRow,
  improvementNote,
  scrollImprovements,
  isWorker,
  nextSpecialist,
  keepResearchInView,
  nextChoice,
  openResearch,
  researchRowOf,
  researchRows,
  researchStep,
  researchTarget,
  DIFFICULTIES,
  leaderLine,
  leaderTitle,
  AUDIENCE_CHOICES,
  FogLifter,
  INTRO_MS,
  MotionPlayer,
  moveRefusal,
  workRefusal,
  settlerSites,
  siteNote,
  setupCards,
  setupChoose,
  planMove,
  setupMenu,
  setupOptions,
  terrainInfo,
  TEXT_INPUT_MAX,
  WINDOW_ENTER_MS,
  type RateRow,
  type ResearchView,
  type CityScreenView,
  type CityViewState,
  type DiplomacyView,
  type NewTechView,
  type BuiltView,
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
  WORK_NAME,
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

/**
 * A click on a person in a city's row of citizens (`citizenRow`), as in the original: a worker leaves the
 * square worth least to entertain; a specialist takes the next trade (entertainer, taxman, scientist).
 */
function changeCitizen(cityId: number, i: number): void {
  const city = state.cities.find((c) => c.id === cityId);
  const row = city ? citizenRow(state, city) : [];
  const who = row[i];
  if (!city || !who) return;
  if (isWorker(who)) {
    const slot = weakestWorked(state, city);
    if (slot !== undefined && dispatch({ type: "toggleTile", city: city.id, slot })) say(`Now an ${citizenRole("entertainer").toLowerCase()}`);
    return;
  }
  const next = nextSpecialist(who);
  const index = i - row.filter(isWorker).length;
  if (dispatch({ type: "setSpecialist", city: city.id, index, specialist: next })) say(`Now a${next === "entertainer" ? "n" : ""} ${citizenRole(next).toLowerCase()}`);
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

/** A job the settler cannot take up here: a note beside it says why. */
function refuseWork(unit: number, reason: string): void {
  const u = unitById(state, unit);
  const text = workRefusal(reason);
  if (!u) { say(text); return; }
  view.callout = { x: u.x, y: u.y, text };
  calloutUntil = performance.now() + CALLOUT_MS;
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
  "sold this turn": "A city sells one building a turn",
  palace: "The Palace is never sold",
  wonder: "Wonders are never sold",
};

type Screen =
  | { kind: "title" }
  | { kind: "setup"; setup: SetupState }
  | { kind: "map" }
  | { kind: "city"; view: CityScreenView; then?: () => void } // `then`: the turn's news that waits for the city to close
  | { kind: "cityView"; view: CityViewState; city: Extract<Screen, { kind: "city" }> } // the city as a picture, over its city screen
  | { kind: "wonderShow"; view: CityViewState; start: number; then: () => void } // a wonder just completed rising in its city's picture, before its window
  | { kind: "research"; view: ResearchView; back: Screen; then: () => void }
  // An advance just found, `found[at]` of those found together; the research is `due` to be picked after.
  | { kind: "newTech"; view: NewTechView; found: string[]; at: number; due: boolean; back: Screen; then: () => void }
  | { kind: "built"; view: BuiltView; then: () => void; under: Screen } // a city of ours finished an improvement, a wonder or a spaceship part, the window over `under`
  | { kind: "science" }
  | { kind: "rates" }
  | { kind: "advisor"; which: "domestic" | "military" | "foreign" | "score" }
  | { kind: "diplomacy"; player: number; line: string; talk?: Talk; card?: string[] } // an audience, or (`card`) a civilization's card from the Diplomacy tab
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
 * Play back what we saw of the other civilizations' turns, and our gotos as ours began: moves on
 * squares we see now (so a unit shown is one that stays in sight, or is seen walking out of it; a
 * unit shown on a square we no longer see vanished the moment its slide ended, "shown for a glimpse",
 * 2026-10-24), the camera taken from where it is headed. Fights with our units are always shown
 * (`watchTurn`), so a unit lost takes nothing of its last fight with it; `sawBefore` stands for the
 * squares its sight covered, for the steps that led to that fight.
 */
function watchOthers(actions: readonly UnitAction[], sawBefore: Uint8Array): void {
  const me = state.players[0]!;
  const w = state.map.width;
  // Squares whose sight we lost with a unit this turn: seen before, not now, by nobody's eyes but the lost unit's.
  const lost = new Set<number>();
  for (const a of actions) {
    if (a.kind !== "battle") continue;
    const ours = a.attacker.owner === 0 ? (a.attackerWon ? null : a.attacker) : a.defender.owner === 0 && a.attackerWon ? a.defender : null;
    if (!ours) continue;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const y = ours.y + dy;
      if (y >= 0 && y < state.map.height) lost.add(y * w + wrapX(state.map, ours.x + dx));
    }
  }
  const seen = (x: number, y: number) => {
    const i = y * w + x;
    return me.explored[i] === 1 && (me.visible[i] === 1 || (sawBefore[i] === 1 && lost.has(i)));
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

/**
 * The turn ends by itself only once the player has ordered the last unit awaiting orders this turn
 * (asked for 2026-10-24: "auto next turn when no actions left, but not auto when no actions at all"):
 * a moment after the last order the turn ends; a turn that began with nothing to order waits for Enter
 * (or a click on the panel's End of Turn), as the original did.
 */
let actedThisTurn = false;
let autoEndAt: number | null = null;
const AUTO_END_MS = 1000;

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
    if ("unit" in cmd) actedThisTurn = true;
    if (cmd.type !== "endTurn") slideOwn(lastActions.slice(mark));
    if (cmd.type === "move" && lastCombat) reportCombat(lastCombat);
    if (cmd.type !== "endTurn") afterAction();
  } else if (cmd.type === "work") refuseWork(cmd.unit, r.reason);
  else say(REASONS[r.reason] ?? r.reason);
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

/**
 * Edge scrolling (asked for 2026-10-23): the mouse resting near an edge of the map pans the camera
 * that way, gathering speed, after a moment's pause so a pointer passing on to the panel or the menu
 * bar does not move it. Only a mouse does this; fingers drag the map on the phone (no `mapView`).
 */
const EDGE = {
  /** Depth of the band along each edge, as a share of the map's shorter side. */
  zone: 0.06,
  /** The pointer waits this long in the band before the map moves. */
  delayMs: 220,
  /** Squares a second at full speed, reached after `rampMs`. */
  speed: 8,
  rampMs: 350,
};
/** The mouse over the canvas, in logical pixels; null when it is elsewhere. */
let pointer: { x: number; y: number } | null = null;
let edgeSince: number | null = null;
let edgeLast = 0;

/** Which way the pointer asks the map to move: -1, 0 or 1 across and down; null when it asks nothing. */
function edgeDirection(): { dx: number; dy: number } | null {
  const area = renderer.mapView;
  if (!area || !pointer || screenState.kind !== "map" || watching || !cam.ready) return null;
  const { x, y } = pointer;
  // Over the panel or the menu bar: nothing.
  if (x < area.x || y < area.y || x >= area.x + area.width || y >= area.y + area.height) return null;
  const band = Math.max(4, Math.round(Math.min(area.width, area.height) * EDGE.zone));
  const dx = x < area.x + band ? -1 : x >= area.x + area.width - band ? 1 : 0;
  const dy = y < area.y + band ? -1 : y >= area.y + area.height - band ? 1 : 0;
  return dx || dy ? { dx, dy } : null;
}

/** Each frame: the mouse over a square the map suggests for our settlers says why it is good (`view.hint`). */
function siteHint(): void {
  view.hint = undefined;
  if (!pointer || screenState.kind !== "map" || watching || handoff) return;
  const hit = renderer.tileAt(state, view, pointer.x, pointer.y);
  const active = state.activeUnit;
  if (!hit || active === null) return;
  const site = settlerSites(state, active).find((s) => s.x === hit.x && s.y === hit.y);
  if (site) view.hint = { x: site.x, y: site.y, text: siteNote(state, site, 0) };
}

/** Each frame: pan the camera while the pointer rests in an edge band. */
function stepEdgePan(now: number): void {
  const dt = Math.min(100, now - edgeLast);
  edgeLast = now;
  const dir = edgeDirection();
  if (!dir) { edgeSince = null; return; }
  edgeSince ??= now;
  const held = now - edgeSince - EDGE.delayMs;
  if (held <= 0) return;
  const step = (EDGE.speed * Math.min(1, held / EDGE.rampMs) * dt) / 1000;
  const w = state.map.width;
  cam.animating = false;
  cam.x = (((cam.x + dir.dx * step) % w) + w) % w;
  cam.y = Math.max(0, Math.min(state.map.height - renderer.viewTilesY, cam.y + dir.dy * step));
  applyCamera();
}

/** A unit's standing in a word or two, for the stack chooser: its orders, or whether it can still move. */
function unitStanding(u: Unit): string {
  switch (u.order.kind) {
    case "fortified": return "Fortified";
    case "fortifying": return "Fortifying";
    case "sentry": return "Sentry";
    case "goto": return "Going";
    case "work": { const job = WORK_NAME[u.order.work]; return `${job[0]!.toUpperCase()}${job.slice(1)}, ${u.order.turnsLeft}`; }
    default: return u.movesLeft > 0 ? "Ready" : "No moves";
  }
}

/**
 * A square holding several of our units (asked for 2026-10-24): a window lists them, each with its
 * sprite and standing, the active one lit; the one picked wakes and comes into play (one with no
 * moves left keeps its orders, as the city screen has it). The X or Esc leaves them be.
 */
function openStack(x: number, y: number, units: Unit[]): void {
  const me = state.players[0]!;
  const active = units.findIndex((u) => u.id === state.activeUnit);
  const ready = units.findIndex((u) => u.movesLeft > 0);
  screenState = {
    kind: "menu",
    under: screenState,
    menu: {
      title: `Our units here (${units.length})`,
      items: units.map((u) => unitType(u.type).name),
      right: units.map(unitStanding),
      units: units.map((u) => ({ type: u.type, color: me.color })),
      selected: Math.max(0, active >= 0 ? active : ready),
      close: true,
    },
    onPick: (i) => {
      const u = units[i];
      if (!u || !state.units.some((o) => o.id === u.id)) return;
      if (u.movesLeft === 0) { say(`${unitType(u.type).name}: no moves left this turn`); return; }
      centerOn(x, y);
      if (!dispatch({ type: "activate", unit: u.id })) return;
      finishHandoff();
      followActive(true);
    },
    onCancel: () => {},
  };
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
 * A city finished an improvement, a wonder or a spaceship part: the Building Completed window (asked
 * for 2026-10-24, after the user's template), then the city's builders ask what comes next, over the
 * city screen (View City) or the map (Continue). Settlers get a window over the city saying what
 * they cost it. Either way the turn's news goes on after.
 */
function builtWindow(cityId: number, p: Production, then: () => void, change?: CityTurnEvent["change"]): void {
  const city = state.cities.find((c) => c.id === cityId);
  const notice = builtNotice(state, cityId, p, change);
  if (!city || city.owner !== 0 || !notice) { then(); return; }
  if (p.kind === "wonder") {
    // A wonder is a spectacle (asked for 2026-10-24): it rises in the city's picture, sparkles, and
    // only then does its window open, over that picture.
    wonderShow(cityId, p.id, () => {
      const under: Screen = { kind: "cityView", view: { city: cityId }, city: { kind: "city", view: { city: cityId } } };
      screenState = { kind: "built", view: { city: cityId, production: p, selected: 1 }, then, under };
    });
    return;
  }
  if (p.kind !== "unit") {
    // A small window over the game; one after another, each over the same screen. The map glides to
    // the city first (asked for 2026-10-24), so the window names a city that can be seen.
    const under = screenState.kind === "built" ? screenState.under : screenState;
    if (under.kind === "map") centerOn(city.x, city.y);
    screenState = { kind: "built", view: { city: cityId, production: p, selected: 1 }, then, under };
    return;
  }
  openCity(cityId, then);
  modal(notice.title, notice.lines, ["Build next..."], () => openProductionMenu(cityId));
}

type BuiltScreen = Extract<Screen, { kind: "built" }>;
type WonderShowScreen = Extract<Screen, { kind: "wonderShow" }>;

/** The wonder's show: it rises over `WONDER_RISE_MS`, then sparkles for `WONDER_SPARKLE_MS`; a key or click after the first moment ends it early. */
const WONDER_RISE_MS = 1800;
const WONDER_SPARKLE_MS = 1600;
const WONDER_SKIP_AFTER_MS = 400;

/** A wonder just completed in one of our cities: the city's picture with the wonder rising from the ground, named along the bar. */
function wonderShow(cityId: number, id: string, then: () => void): void {
  const city = state.cities.find((c) => c.id === cityId);
  if (!city) { then(); return; }
  screenState = { kind: "wonderShow", view: { city: cityId, rising: { id, reveal: 0, sparkle: 0 }, banner: `${city.name} completes the ${wonder(id).name}!` }, start: performance.now(), then };
}

/** Each frame of the show: how far the wonder has risen and how far its sparkles have burst; over, it goes on. */
function stepWonderShow(sc: WonderShowScreen, t: number): void {
  const el = t - sc.start;
  const r = sc.view.rising!;
  const rise = Math.min(1, el / WONDER_RISE_MS);
  r.reveal = 1 - (1 - rise) * (1 - rise);
  r.sparkle = el < WONDER_RISE_MS ? 0 : Math.min(1, (el - WONDER_RISE_MS) / WONDER_SPARKLE_MS);
  if (el >= WONDER_RISE_MS + WONDER_SPARKLE_MS) sc.then();
}

/** A key or click ends the show once it has had its first moment. */
function skipWonderShow(sc: WonderShowScreen): void {
  if (performance.now() - sc.start >= WONDER_SKIP_AFTER_MS) sc.then();
}

/** Leave the Building Completed window: into the city (`toCity`) or onto the map, the builders asking what next. */
function leaveBuilt(sc: BuiltScreen, toCity: boolean): void {
  const id = sc.view.city;
  if (!state.cities.some((c) => c.id === id)) { screenState = { kind: "map" }; sc.then(); return; }
  if (toCity) { openCity(id, sc.then); openProductionMenu(id); return; }
  screenState = { kind: "map" };
  openProductionMenu(id, sc.then);
}

/** Keys on the window: Left, Right or Tab move between its buttons, Enter (not held) presses the lit one, V views the city, Esc goes on. */
function builtKey(e: KeyboardEvent, sc: BuiltScreen): void {
  switch (e.code) {
    case "ArrowLeft": case "ArrowRight": case "Tab": e.preventDefault(); sc.view.selected = 1 - sc.view.selected; break;
    case "Enter": case "NumpadEnter": case "Space": e.preventDefault(); if (!e.repeat && settled(sc.view)) leaveBuilt(sc, sc.view.selected === 0); break;
    case "KeyV": leaveBuilt(sc, true); break;
    case "Escape": leaveBuilt(sc, false); break;
  }
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

/**
 * Sell an improvement of the city (the Improvements box's Sell button, or its line, as the original
 * asked on a click): what it brings against the treasury first, Keep by default. One a city a turn,
 * never the Palace or a wonder: those say why instead.
 */
function askSell(cityId: number, id: string): void {
  const city = state.cities.find((c) => c.id === cityId);
  if (!city) return;
  if (whyNoSale(state, city, id)) { say(improvementNote(state, city, id)); return; }
  const name = building(id).name;
  const price = sellPrice(state, city, id);
  const gold = state.players[city.owner]!.gold;
  modal(`Sell the ${name}?`, [`{purse} ${price} gold for it  {coin} ${gold} in the treasury`, "A city sells one building a turn."], ["Sell", "Keep it"], (i) => {
    if (i === 0 && dispatch({ type: "sell", city: cityId, building: id })) say(`${name} sold for ${price} gold`);
  }, 1);
}

/**
 * A modal window: a title, a few paragraphs, and choices. A message with nothing to choose but to
 * close it ("OK") gets no button (asked for 2026-10-24: "replace all close buttons with a generic
 * modal X"): the X in its title strip, Enter, Esc or a click off it close it and go on.
 */
function modal(title: string, body: string[], items: string[], onPick: (i: number) => void, selected = 0, onCancel?: () => void): void {
  const plain = items.length === 1 && /^(OK|Close|Done|Continue)$/.test(items[0]!);
  const cancel = onCancel ?? (plain ? () => onPick(0) : undefined);
  screenState = { kind: "menu", under: screenState, menu: { title, body, items: plain ? [] : items, selected, ...(plain ? { close: true } : {}) }, onPick, ...(cancel ? { onCancel: cancel } : {}) };
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
function openTerrainInfo(tx: number, ty: number, at?: { x: number; y: number }): void {
  const info = terrainInfo(state, tx, ty);
  // Only our city's square has a button (no Go here, asked for 2026-10-23: units move from the map).
  const items: [string, () => void][] = [];
  const city = cityAt(state, tx, ty);
  if (city && city.owner === 0) items.push(["Open city", () => openCity(city.id)]);
  // Closed by its X (or any click off its choices, or Esc); nothing is picked until a choice is.
  modal(info.title, info.lines, items.map((i) => i[0]), (i) => items[i]?.[1](), -1);
  if (screenState.kind === "menu") {
    screenState.menu.close = true;
    // The square itself heads the window, as the map draws it.
    screenState.menu.square = { x: tx, y: ty };
    // Opened by a click on the map: the window stands clear of that square, so a second click there only closes it.
    if (at) screenState.menu.avoid = at;
  }
}

/** What the city works its squares for (F): one focus picked from a menu, every citizen put to work for it at once. */
function openFocusMenu(cityId: number): void {
  const city = state.cities.find((c) => c.id === cityId);
  if (!city || state.balancedWorkers) return;
  const now = cityFoci(state, city)[0];
  screenState = {
    kind: "menu",
    under: screenState,
    menu: { title: `${city.name} works for...`, items: FOCI.map((f) => f.name), right: FOCI.map((f) => f.text), selected: Math.max(0, FOCI.findIndex((f) => f.id === now)) },
    onPick: (i) => {
      const f = FOCI[i];
      if (f && dispatch({ type: "setFoci", city: cityId, foci: [f.id] })) say(`${city.name} works for ${f.name.toLowerCase()}`);
    },
  };
}

/** A focus toggle in a corner of the city's map: the city works for that focus too, or no longer (any of the four together). */
function toggleFocus(cityId: number, focus: CityFocus): void {
  const city = state.cities.find((c) => c.id === cityId);
  if (!city) return;
  const now = cityFoci(state, city);
  const foci = now.includes(focus) ? now.filter((f) => f !== focus) : [...now, focus];
  if (!dispatch({ type: "setFoci", city: cityId, foci })) return;
  const names = FOCI.filter((f) => foci.includes(f.id)).map((f) => f.name.toLowerCase());
  say(names.length ? `${city.name} works for ${names.join(" and ")}` : `${city.name} works for everything alike`);
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

/** What a city should build next; `then` runs once it is picked or the menu is left. */
function openProductionMenu(cityId: number, then?: () => void): void {
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
      then?.();
    },
    ...(then ? { onCancel: then } : {}),
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

/** Advances gained along the way (a village, a diplomat, a treaty): a New Technology window for each. */
function showFound(ids: string[], then: () => void = () => {}): void {
  if (!ids.length) { then(); return; }
  announce(ids, false, then, screenState);
}

// ---- the New Technology window -------------------------------------------------------
type NewTechScreen = Extract<Screen, { kind: "newTech" }>;

/**
 * The New Technology window (asked for 2026-10-23, after the user's template) for each advance found,
 * one after another; then, when the research is `due`, the research panel to pick the next. View Tech
 * Tree opens the panel at once on the advance; Continue, the close box and Esc go on.
 */
function announce(found: string[], due: boolean, then: () => void, back: Screen = { kind: "map" }, at = 0): void {
  screenState = { kind: "newTech", view: { advance: found[at]!, selected: 1 }, found, at, due, back, then };
}

function leaveNewTech(sc: NewTechScreen, tree: boolean): void {
  if (tree) {
    openTree({ discovered: sc.found, choosing: true, closable: !sc.due }, sc.then, sc.back);
    if (screenState.kind === "research") treeSelect(screenState, sc.view.advance);
  } else if (sc.at + 1 < sc.found.length) announce(sc.found, sc.due, sc.then, sc.back, sc.at + 1);
  else if (sc.due) openTree({ discovered: sc.found, choosing: true, closable: false }, sc.then, sc.back);
  else {
    screenState = sc.back;
    sc.then();
  }
}

/** Keys on the window: Left, Right or Tab move between its buttons, Enter (not held) presses the lit one, T the tree, Esc goes on. */
function newTechKey(e: KeyboardEvent, sc: NewTechScreen): void {
  switch (e.code) {
    case "ArrowLeft": case "ArrowRight": case "Tab": e.preventDefault(); sc.view.selected = 1 - sc.view.selected; break;
    case "Enter": case "NumpadEnter": case "Space": e.preventDefault(); if (!e.repeat && settled(sc.view)) leaveNewTech(sc, sc.view.selected === 0); break;
    case "KeyT": leaveNewTech(sc, true); break;
    case "Escape": leaveNewTech(sc, false); break;
  }
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
type MenuEntry = [label: string, key: string, run: () => void, disabled?: boolean];

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
        ["Revolution!", "G", () => askRevolution(), governmentsAvailable(state, 0).length <= 1],
        [`Borders: ${borders ? "On" : "Off"}`, "", () => { setBorders(!borders); say(`Borders ${borders ? "on" : "off"}`); }],
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
    case "Diplomacy": {
      // Every civilization met: its leader, how we stand, and a click opens its card.
      const met = state.players.filter((p) => p.id !== 0 && p.alive && p.id !== state.barbarians && hasContact(state, 0, p.id));
      if (!met.length) return [["No one met yet", "", () => {}, true]];
      return met.map((p): MenuEntry => [leaderTitle(state, p.id), standing(state, p.id).text, () => openCivCard(p.id)]);
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
    menu: { title: "", items: items.map((e) => e[0]), right: items.map((e) => e[1]), selected: items.findIndex((e) => !e[3]), anchor: renderer.menuBarAnchor(i), disabled: items.flatMap((e, k) => (e[3] ? [k] : [])) },
    onPick: (k) => { if (!items[k]?.[3]) items[k]?.[2](); },
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
  // The window's close box (or Esc) is the way back: no "Never mind" (asked for 2026-10-24).
  talkMenu([...items, ...(more ? ["More..."] : [])], (i) => {
    if (i < shown) onPick(start + i);
    else if (more && i === shown) pagedChoices(labels, onPick, onCancel, start + shown);
    else onCancel();
  }, onCancel);
}

/** Pick an audience choice: the screen loses its buttons, then the choice runs (and usually shows new ones). */
function pickTalk(sc: Extract<Screen, { kind: "diplomacy" }>, i: number): void {
  const t = sc.talk;
  if (!t || i < 0 || i >= t.items.length) return;
  screenState = { kind: "diplomacy", player: sc.player, line: sc.line, ...(sc.card ? { card: sc.card } : {}) };
  t.onPick(i);
}

/**
 * Keys on the audience window: arrows move among the buttons (two to a row), Enter or 1-4 picks, Esc
 * (the close box too) steps back, or with nothing to choose goes on. A key held down, or one that
 * arrives before the window stands whole, is not an answer.
 */
function diplomacyKey(e: KeyboardEvent, sc: Extract<Screen, { kind: "diplomacy" }>): void {
  const t = sc.talk;
  if (!t) { screenState = { kind: "map" }; return; }
  if (e.repeat || !settled(audienceKey)) return;
  const back = () => { screenState = { kind: "diplomacy", player: sc.player, line: sc.line, ...(sc.card ? { card: sc.card } : {}) }; t.onCancel(); };
  const n = t.items.length;
  if (!n) {
    if (e.code === "Enter" || e.code === "NumpadEnter" || e.code === "Space" || e.code === "Escape") back();
    return;
  }
  const move = (d: number) => { t.selected = (t.selected + d + n) % n; };
  const digit = /^(?:Digit|Numpad)([1-4])$/.exec(e.code);
  if (digit) { pickTalk(sc, Number(digit[1]) - 1); return; }
  switch (e.code) {
    case "ArrowLeft": move(-1); break;
    case "ArrowRight": move(1); break;
    case "ArrowUp": move(n > 2 ? -2 : -1); break;
    case "ArrowDown": move(n > 2 ? 2 : 1); break;
    case "Enter": case "NumpadEnter": case "Space": pickTalk(sc, t.selected); break;
    case "Escape": back(); break;
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
 * time (asked for). Peace (or war) and Farewell always; the rest grows with our knowledge (asked for
 * 2026-10-24): with Writing (the Diplomat's advance; the tree has no Diplomacy) a Diplomacy screen
 * (demand their units off our land, exchange maps, open or close borders, demand tribute, war), with
 * Trade a Trade screen (trade knowledge, give an advance, a gift of gold). Before them, only the
 * demand to leave and the gift stand on the first screen. Each proposal is made once an audience; the
 * leader's answer becomes their words and the talk goes on until Farewell.
 */
function audience(player: number, line: string, done: () => void = () => { screenState = { kind: "map" }; }, first = false): void {
  const them = state.players[player]!;
  const tried = new Set<string>();
  const speak = (words: string) => { screenState = { kind: "diplomacy", player, line: words }; };
  /** Proposals not yet made, each marked made when picked. */
  const fresh = (list: [string, () => void][]): [string, () => void][] =>
    list.filter(([label]) => !tried.has(label)).map(([label, fn]) => [label, () => { tried.add(label); fn(); }]);
  const me = () => state.players[0]!;
  const knows = (id: string) => me().advances.includes(id);
  const declareWar = (words: string): [string, () => void] => {
    const treaty = atPeace(state, 0, player);
    return [treaty ? "Break the treaty" : "Declare war", () => {
      speak(treaty ? "Would you break our treaty?" : "Would you make war on us?");
      talkMenu(["Keep the peace", "Declare war!"], (i) => {
        if (i !== 1) { talk(words); return; }
        dispatch({ type: "declareWar", player });
        tried.add("Propose peace");
        talk("So be it. Our armies will answer you.");
      }, () => talk(words));
    }];
  };
  /** The Diplomacy screen's proposals (with Writing); without it, only the demand to leave. */
  const diplomacy = (words: string): [string, () => void][] => {
    const peace = atPeace(state, 0, player);
    const open = bordersOpen(state, 0, player);
    return fresh([
      ...(trespassers(state, 0, player).length ? [["Demand they leave our land", () => demandWithdraw(player, talk)] as [string, () => void]] : []),
      ...(knows("writing") ? [
        ["Exchange maps", () => {
          if (!peace) { talk("Make peace with us first."); return; }
          if (!acceptsMapSwap(state, player, 0)) { talk("Our maps are our own."); return; }
          dispatch({ type: "shareMaps", player });
          talk("Our cartographers have spoken with yours. Study the maps well.");
        }] as [string, () => void],
        [open ? "Close borders" : "Open borders", () => {
          if (open) { dispatch({ type: "closeBorders", player }); talk("Our borders are closed to you again."); return; }
          if (!peace) { talk("Make peace with us first."); return; }
          proposeDeal(player, bordersAnswer(state, player, 0), BORDERS_PRICE, talk, {
            no: "Our land is not open to your armies.",
            price: `For a gift of ${BORDERS_PRICE} gold, our borders are open to you.`,
            question: `Pay ${BORDERS_PRICE} gold for open borders?`,
            declined: "Then our borders stay closed.",
          }, () => { dispatch({ type: "openBorders", player }); talk("Our borders are open to you, and yours to us."); });
        }] as [string, () => void],
        ["Demand tribute", () => {
          const gold = tributeOffer(state, player, 0);
          if (gold > 0) { dispatch({ type: "tribute", player, amount: gold }); talk(`Take these ${gold} gold, and leave us in peace.`); return; }
          const paid = state.tributePaid?.[`${player}>0`];
          talk(paid !== undefined && state.turn - paid < 20 ? "We paid you not long ago. Do not ask again so soon."
            : them.gold < 10 ? "Our treasury is bare; there is nothing to give."
            : "We pay tribute to no one. Come and take it, if you dare.");
        }] as [string, () => void],
        ...(!atWar(state, 0, player) ? [declareWar(words)] : []),
      ] : []),
    ]);
  };
  /** The Trade screen's proposals (with Trade); without it, only a gift of gold. */
  const trade = (): [string, () => void][] => fresh([
    ...(knows("trade") && them.advances.some((a) => !me().advances.includes(a)) && tradeAsk(state, player, 0) ? [["Trade knowledge", () => tradeKnowledge(player, talk)] as [string, () => void]] : []),
    ...(knows("trade") && me().advances.some((a) => !them.advances.includes(a)) ? [["Give an advance", () => giveAdvance(player, talk)] as [string, () => void]] : []),
    ...(me().gold >= 50 ? [["Give 50 gold", () => { dispatch({ type: "giveGold", player, amount: 50 }); talk("Your generosity will be remembered."); }] as [string, () => void]] : []),
  ]);
  /** A screen of proposals (pages when they are many); the window's close box or Esc goes back. */
  const sub = (words: string, items: [string, () => void][]) => {
    speak(words);
    const back = () => talk(words);
    if (items.length <= AUDIENCE_CHOICES) talkMenu(items.map((i) => i[0]), (i) => items[i]?.[1](), back);
    else pagedChoices(items.map((i) => i[0]), (i) => items[i]?.[1](), back);
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
    } else if (!atPeace(state, 0, player)) items.push(...fresh([["Propose peace", () => proposePeace(player, talk)]]));
    const dip = diplomacy(words);
    const deals = trade();
    if (knows("writing")) { if (dip.length) items.push(["Diplomacy", () => sub(words, dip)]); }
    else items.push(...dip);
    if (knows("trade")) { if (deals.length) items.push(["Trade", () => sub(words, deals)]); }
    else items.push(...deals);
    if (!knows("writing") && !atWar(state, 0, player)) items.push(declareWar(words));
    items.push([first ? "Part in peace" : "Farewell", done]);
    talkMenu(items.map((i) => i[0]), (i) => items[i]?.[1](), done);
  };
  talk(line);
}

/** Give `player` one of our advances they lack (with Trade): goodwill, and their thanks. */
function giveAdvance(player: number, talk: (words: string) => void): void {
  const them = state.players[player]!;
  const ours = state.players[0]!.advances.filter((a) => !them.advances.includes(a)).slice(-12);
  if (!ours.length) { talk("You know nothing we do not."); return; }
  screenState = { kind: "diplomacy", player, line: "Which of our advances would you give them?" };
  pagedChoices(ours.map((a) => advance(a).name), (i) => {
    const id = ours[i];
    if (!id || !dispatch({ type: "giveAdvance", player, advance: id })) { talk("As you wish."); return; }
    talk(`${advance(id).name}! We thank you for this knowledge; it will not be forgotten.`);
  }, () => talk("As you wish."));
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
    const talk = (words: string): void => {
      screenState = { kind: "diplomacy", player: owner, line: words };
      const items: [string, () => void][] = [];
      items.push(["We will leave", () => {
        const n = withdraw(owner);
        then();
        say(n ? `Our units leave the land of the ${them.name}.` : "Our units find no way out.", 3000);
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

/** Send each of our units on `owner`'s land to the nearest square it can reach outside it (core `exitSquare`); how many set off. */
function withdraw(owner: number): number {
  let sent = 0;
  for (const u of trespassers(state, owner, 0)) {
    const exit = exitSquare(state, u, owner);
    if (exit && dispatch({ type: "goto", unit: u.id, x: exit.x, y: exit.y })) sent++;
  }
  return sent;
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
  talkMenu([], () => then(), then); // nothing to answer: the close box, Enter or Esc go on
}

function openDiplomacy(player: number): void {
  audience(player, leaderLine(state, player));
}

function openForeignTalkMenu(): void {
  const known = state.players.filter((p) => p.id !== 0 && p.alive && p.id !== state.barbarians && hasContact(state, 0, p.id));
  if (!known.length) { say("We have met no one."); return; }
  menu("Send an emissary to...", known.map((p) => p.name), (i) => { const p = known[i]; if (p) openCivCard(p.id); });
}

/**
 * A civilization's card (the menu bar's Diplomacy tab): the leader's portrait beside what we know of
 * them (`civCard`), how we stand with them as the line (or `words`, a leader's answer), and the
 * choices: talk (an audience, back to the card after), demand their units off our land, back.
 */
function openCivCard(player: number, words?: string): void {
  const them = state.players[player]!;
  if (!them.alive) { screenState = { kind: "map" }; return; }
  const leader = civ(them.civ).leader;
  screenState = { kind: "diplomacy", player, line: words ?? standing(state, player, true).text, card: civCard(state, player, attitude(state, player, 0)) };
  const back = () => { screenState = { kind: "map" }; };
  const items: [string, () => void][] = [[`Talk to ${leader}`, () => audience(player, leaderLine(state, player), () => openCivCard(player))]];
  if (trespassers(state, 0, player).length) items.push(["Demand they leave our land", () => demandWithdraw(player, (answer) => openCivCard(player, answer))]);
  // The window's close box (or Esc) goes back to the map.
  talkMenu(items.map((i) => i[0]), (i) => items[i]?.[1](), back);
}

/** Demand that `player` take its units off our land: a friendly leader agrees (their units set off for the nearest way out), a wary one yields to strength, a hostile one refuses. */
function demandWithdraw(player: number, talk: (words: string) => void): void {
  if (!trespassers(state, 0, player).length) { talk("None of our units stand on your land."); return; }
  if (!withdrawAnswer(state, player, 0)) {
    talk(attitude(state, player, 0) === "hostile" ? "Our units go where they please. Move them yourself, if you can." : "Our soldiers stay where they are.");
    return;
  }
  talk(dispatch({ type: "withdraw", player }) ? `Very well. Our units will leave the land of the ${state.players[0]!.name}.` : "Our units would leave, but find no way out.");
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
      announce(found, due >= 0, next);
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
    else if ((ev.kind === "built" || ev.kind === "wonder") && ev.production && builtNotice(state, ev.city, ev.production)) builtWindow(ev.city, ev.production, next, ev.change);
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
  actedThisTurn = false;
  autoEndAt = null;
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
    actedThisTurn = true; // a move is an order too: the turn may end by itself after the last one
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
      // A road where there is none, rails on a road; a refusal says why (a river wants Bridge Building).
      order({ type: "work", unit: active!, work: u && getTile(state.map, u.x, u.y)?.road ? "railroad" : "road" });
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

/**
 * Set one rate: science takes what tax and luxuries leave, and a change to science comes out of tax.
 * The other rate gives way rather than let science go below nothing, and what the government's limit
 * will not let science hold goes to luxuries (tax at 30% under Despotism's 60%: science 60, luxuries 10).
 */
function setRateTo(row: RateRow, value: number): void {
  const p = state.players[0]!;
  const max = government(p.government).maxRate;
  let tax = p.taxRate;
  let lux = p.luxRate;
  if (row === "tax") tax = value;
  else if (row === "lux") lux = value;
  else tax = 10 - lux - value;
  if (10 - tax - lux < 0) { if (row === "lux") tax = 10 - lux; else lux = 10 - tax; }
  if (10 - tax - lux > max) { if (row === "lux") tax += 10 - tax - lux - max; else lux += 10 - tax - lux - max; }
  const sci = 10 - tax - lux;
  if (tax < 0 || lux < 0 || sci < 0) return;
  dispatch({ type: "setRates", tax, lux, sci });
}
function stepRate(row: RateRow, delta: number): void {
  const p = state.players[0]!;
  setRateTo(row, (row === "tax" ? p.taxRate : row === "lux" ? p.luxRate : p.sciRate) + delta);
}

function ratesKey(e: KeyboardEvent): void {
  switch (e.code) {
    case "ArrowRight": stepRate("tax", 1); break;
    case "ArrowLeft": stepRate("tax", -1); break;
    case "ArrowUp": stepRate("lux", 1); break;
    case "ArrowDown": stepRate("lux", -1); break;
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
  // A window answers Enter only once it stands whole, and never a key held down: a key held or mashed
  // through the playback must not dismiss the window that follows it. Dropdowns answer at once.
  const ready = sc.bar !== undefined || (!e.repeat && settled(m));
  if (!m.items.length) {
    // A message with nothing to choose: Enter or Esc close it and go on.
    if (!ready) return;
    if (e.code === "Enter" || e.code === "NumpadEnter" || e.code === "Space") { screenState = sc.under; sc.onPick(0); }
    else if (e.code === "Escape") { screenState = sc.under; sc.onCancel?.(); }
    return;
  }
  switch (e.code) {
    case "ArrowUp": case "Numpad8": stepSelection(m, -1); break;
    case "ArrowDown": case "Numpad2": stepSelection(m, 1); break;
    case "PageUp": case "Numpad9": moveSelection(m, -page); break;
    case "PageDown": case "Numpad3": moveSelection(m, page); break;
    case "Home": case "Numpad7": moveSelection(m, -m.items.length); break;
    case "End": case "Numpad1": moveSelection(m, m.items.length); break;
    case "Enter": case "NumpadEnter": case "Space": if (!ready) return; screenState = sc.under; sc.onPick(m.selected); return;
    case "Escape": screenState = sc.under; sc.onCancel?.(); return;
  }
  m.top = keepInView(m, renderer.menuRows(m));
}

/** Move a menu's selection by `by` rows, stopping at the ends, and scroll it into view. */
/** The next row up or down, round the ends, passing over rows that cannot be picked (`MenuState.disabled`). */
function stepSelection(m: MenuState, d: number): void {
  const n = m.items.length;
  let i = m.selected;
  for (let k = 0; k < n; k++) {
    i = (i + d + n) % n;
    if (!m.disabled?.includes(i)) break;
  }
  m.selected = i;
}

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
const BAR_KEYS: Record<string, number> = { KeyG: 0, KeyO: 1, KeyA: 2, KeyD: 3, KeyW: 4 };

addEventListener("keydown", (e) => {
  if (e.altKey && !e.metaKey && !e.ctrlKey && BAR_KEYS[e.code] !== undefined) {
    const sc0 = screenState;
    if (sc0.kind === "map" || (sc0.kind === "menu" && sc0.bar !== undefined)) {
      e.preventDefault();
      openBarMenu(BAR_KEYS[e.code]!);
    }
    return;
  }
  if (e.metaKey || e.ctrlKey || e.altKey) return;
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
    case "wonderShow": e.preventDefault(); skipWonderShow(sc); break;
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
    case "newTech": newTechKey(e, sc); break;
    case "built": builtKey(e, sc); break;
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
  if (sc.kind !== "research" && sc.kind !== "city") return;
  e.preventDefault();
  // The list scrolls a row for each line of the wheel (pixels gathered until they make a row): the
  // research list, or on the city screen its improvements, the only list there.
  const page = sc.kind === "city" ? renderer.cityImprovementRows(state) : renderer.researchListRows;
  wheelRows += e.deltaMode === 1 ? e.deltaY : e.deltaMode === 2 ? e.deltaY * page : e.deltaY / 30;
  const rows = Math.trunc(wheelRows);
  if (!rows) return;
  wheelRows -= rows;
  if (sc.kind === "city") scrollCityList(sc, rows);
  else treeScroll(sc, rows);
}, { passive: false });
let wheelRows = 0;

/** The city screen's list of improvements moved `by` lines, kept within its ends. */
function scrollCityList(sc: Extract<Screen, { kind: "city" }>, by: number): void {
  const city = state.cities.find((c) => c.id === sc.view.city);
  if (city) sc.view.top = scrollImprovements(city, sc.view.top, by, renderer.cityImprovementRows(state));
}
/** What the audience screen shows: the leader's words and our choices. */
function diplomacyView(sc: Extract<Screen, { kind: "diplomacy" }>): DiplomacyView {
  // The leader's mood colours the window (the AI's attitude: hostile at war or after a last warning, else by grievance, pride and our influence).
  return { player: sc.player, line: sc.line, mood: attitude(state, sc.player, 0), ...(sc.card ? { card: sc.card } : {}), ...(sc.talk ? { choices: sc.talk.items, selected: sc.talk.selected } : {}) };
}

// Where the mouse is, for edge scrolling (a finger's pointer is not a mouse).
canvas.addEventListener("pointermove", (e) => {
  if (e.pointerType !== "mouse") return;
  const [x, y] = toLogical(e);
  pointer = { x, y };
});
canvas.addEventListener("pointerleave", () => { pointer = null; });
addEventListener("blur", () => { pointer = null; });

// The setup's cards, and the audience's and New Technology window's buttons, light up under the pointer.
canvas.addEventListener("mousemove", (e) => {
  const sc = screenState;
  if (sc.kind === "newTech") {
    const [px, py] = toLogical(e);
    const hit = renderer.newTechHit(sc.view, px, py);
    if (hit === "tree" || hit === "continue") sc.view.selected = hit === "tree" ? 0 : 1;
    return;
  }
  if (sc.kind === "built") {
    const [px, py] = toLogical(e);
    const hit = renderer.builtHit(sc.view, px, py);
    if (hit === "city" || hit === "continue") sc.view.selected = hit === "city" ? 0 : 1;
    return;
  }
  if (sc.kind === "city") {
    const [px, py] = toLogical(e);
    sc.view.hover = renderer.cityCitizenAt(state, sc.view, px, py) ?? undefined;
    sc.view.hoverControl = renderer.cityButtonAt(px, py) ?? (renderer.cityExitHit(px, py) ? "exit" : null) ?? renderer.cityFocusAt(px, py) ?? undefined;
    const line = renderer.cityImprovementAt(state, sc.view, px, py);
    sc.view.hoverImprovement = line?.kind === "line" ? { id: line.id, sell: line.sell } : undefined;
    return;
  }
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
      // A window still opening answers no click (a double click through the playback would close it).
      if (sc.bar === undefined && !settled(sc.menu)) return;
      const i = renderer.menuHit(sc.menu, px, py);
      screenState = sc.under;
      if (i >= 0) sc.onPick(i); else sc.onCancel?.();
      return;
    }
    case "report": case "worldMap": screenState = { kind: "map" }; return;
    case "research": if (e.button === 0) treeClick(sc, px, py); return;
    case "newTech": {
      const hit = e.button === 0 && settled(sc.view) ? renderer.newTechHit(sc.view, px, py) : null;
      if (hit) leaveNewTech(sc, hit === "tree");
      return;
    }
    case "built": {
      const hit = e.button === 0 && settled(sc.view) ? renderer.builtHit(sc.view, px, py) : null;
      if (hit) leaveBuilt(sc, hit === "city");
      return;
    }
    case "end": screenState = { kind: "title" }; return;
    case "diplomacy": {
      // A button picks its choice; the close box steps back (or takes leave), as Esc does; elsewhere nothing.
      if (!settled(audienceKey)) return;
      if (renderer.diplomacyCloseAt?.(px, py)) { diplomacyKey({ code: "Escape" } as KeyboardEvent, sc); return; }
      if (!sc.talk) { screenState = { kind: "map" }; return; }
      pickTalk(sc, renderer.diplomacyChoiceAt(diplomacyView(sc), px, py));
      return;
    }
    case "beat": endBeat(sc); return;
    case "wonderShow": skipWonderShow(sc); return;
    case "rates": {
      const hit = renderer.ratesHit(px, py);
      if (!hit || hit.kind === "done") { screenState = { kind: "map" }; return; }
      if (hit.kind === "set") setRateTo(hit.row, hit.value); else stepRate(hit.row, hit.delta);
      return;
    }
    case "science": case "spaceship": screenState = { kind: "map" }; return;
    case "input": return;
    case "advisor":
      if (sc.which === "foreign") openForeignTalkMenu(); else screenState = { kind: "map" };
      return;
    case "city": {
      if (renderer.cityExitHit(px, py)) { leaveCity(sc); return; }
      const focus = renderer.cityFocusAt(px, py);
      if (focus) { toggleFocus(sc.view.city, focus); return; }
      const button = renderer.cityButtonAt(px, py);
      if (button === "change") { openProductionMenu(sc.view.city); return; }
      if (button === "buy") { askBuy(sc.view.city); return; }
      if (button === "view") { openCityView(sc); return; }
      if (button === "happy") { sc.view.happy = !sc.view.happy; return; }
      if (button === "focus") { openFocusMenu(sc.view.city); return; }
      const unit = renderer.cityUnitAt(state, sc.view, px, py);
      if (unit !== null) { activateFromCity(sc, unit); return; }
      const person = renderer.cityCitizenAt(state, sc.view, px, py);
      if (person !== null) { changeCitizen(sc.view.city, person); return; }
      // The Improvements box: a line (or its Sell button) asks to sell it, the bar scrolls the list.
      const line = renderer.cityImprovementAt(state, sc.view, px, py);
      if (line?.kind === "line") { askSell(sc.view.city, line.id); return; }
      if (line?.kind === "scroll") { scrollCityList(sc, line.by); return; }
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
  // The research row of the status panel opens the research panel; its End of Turn ends the turn.
  const panelHit = e.button === 0 ? renderer.statusAt(state, view, px, py) : null;
  if (panelHit === "research") { openTree({ choosing: true, closable: true }); return; }
  if (panelHit === "endTurn" && state.activeUnit === null) { endTurn(); return; }
  if (handoff) { finishHandoff(); return; }
  const hit = renderer.tileAt(state, view, px, py);
  const active = state.activeUnit !== null ? unitById(state, state.activeUnit) : undefined;
  if (!hit) {
    if (e.button === 2) { if (active) openActionMenu(active.id); else openGameMenu(); }
    return;
  }
  const { x: tx, y: ty } = hit;

  // Right-click: the square's window (terrain, what is on it, and a few things to do about it).
  if (e.button === 2) { openTerrainInfo(tx, ty, { x: px, y: py }); return; }
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
  // Our city opens, our unit is picked, and a stack of ours is listed to pick from.
  const city = cityAt(state, tx, ty);
  const mine = unitAt(state, tx, ty).filter((u) => u.owner === 0);
  if (city && city.owner === 0) {
    centerOn(tx, ty);
    // Next door to the unit in play, a click on our city asks: view the city, or move the unit in (asked
    // for 2026-10-25, after the click moved the unit in at once); with the unit inside, or none in play, the city opens.
    if (active && !(active.x === tx && active.y === ty) && isAdjacent(active, tx, ty)) {
      const unit = active;
      menu(city.name, ["View city", `Move ${unitType(unit.type).name} in`], (i) => {
        if (i === 0) openCity(city.id);
        else tryMove(unit.id, stepTo(unit, tx), ty - unit.y);
      });
      return;
    }
    openCity(city.id);
    return;
  }
  // Next door to the unit in play, a square with our own units is a step: it joins them (asked for
  // 2026-10-24: the click picked the unit there instead). Further off, the click picks from them.
  if (mine.length && active && !(active.x === tx && active.y === ty) && isAdjacent(active, tx, ty)) { tryMove(active.id, stepTo(active, tx), ty - active.y); return; }
  if (mine.length > 1) { openStack(tx, ty, mine); return; }
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
/** When each window first drew, so it can grow in (`WINDOW_ENTER_MS`); keyed by the window's own state. */
const opened = new WeakMap<object, number>();
let frameNow = 0;
function enterOf(window: object): number {
  let at = opened.get(window);
  if (at === undefined) { at = frameNow; opened.set(window, at); }
  return Math.min(1, (frameNow - at) / WINDOW_ENTER_MS);
}

/** Whether a window stands whole, so a key or click may answer it (a key mashed through the playback never dismisses the window that follows). */
function settled(window: object): boolean {
  return enterOf(window) >= 1;
}

/** The audience window's opening, timed from its first frame and kept through the talk (each answer is a new screen); the kind of screen last drawn tells when a new audience begins. */
let audienceKey: object = {};
let lastTop: Screen["kind"] | null = null;

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
    case "cityView": case "wonderShow": renderer.cityView(state, sc.view); break;
    case "research": draw(sc.back); renderer.research(state, sc.view); break; // a window over the screen it opened on (asked for 2026-10-24)
    // The small windows over the screen they opened on.
    case "newTech": draw(sc.back); sc.view.enter = enterOf(sc.view); renderer.newTech(state, sc.view); break;
    case "built": draw(sc.under); sc.view.enter = enterOf(sc.view); renderer.built(state, sc.view); break;
    case "science": renderer.science(state); break;
    case "rates": draw({ kind: "map" }); renderer.rates(state); break;
    case "advisor": renderer.advisor(state, sc.which); break;
    case "diplomacy": {
      // A window over the map (asked for 2026-10-24), growing into place as a new audience opens.
      if (lastTop !== "diplomacy") audienceKey = {};
      draw({ kind: "map" });
      renderer.diplomacy(state, { ...diplomacyView(sc), enter: enterOf(audienceKey) });
      break;
    }
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
      if (sc.bar === undefined) sc.menu.enter = enterOf(sc.menu);
      renderer.menu(sc.menu, state as GameState | undefined);
      if (status && sc.under.kind !== "map") renderer.statusLine(status);
      break;
  }
}

function frame(t: number): void {
  frameNow = t;
  introStart ??= t;
  titleAt = t - introStart;
  if (screenState.kind === "title" && titleAt >= INTRO_MS) void openTitleMenu();
  if (t - lastBlink > 400) { blinkOn = !blinkOn; lastBlink = t; }
  view.blink = blinkOn;
  view.borders = borders;
  if (screenState.kind === "research") screenState.view.blink = blinkOn;
  if (screenState.kind !== "title" && screenState.kind !== "setup") { stepCamera(t); stepEdgePan(t); siteHint(); }
  if (status && t > statusUntil) status = undefined;
  if (view.callout && t > calloutUntil) view.callout = undefined;
  if (view.plan && view.plan.unit !== state.activeUnit) view.plan = undefined;
  if (screenState.kind === "beat" && t >= screenState.until) endBeat(screenState);
  if (screenState.kind === "wonderShow") stepWonderShow(screenState, t);
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
  // The last unit ordered this turn: the turn ends by itself a moment later (see `actedThisTurn`).
  const idle = screenState.kind === "map" && state.activeUnit === null && state.players[0]!.alive && !animating && !afterSlides.length && !handoff;
  if (actedThisTurn && idle) {
    autoEndAt ??= t + AUTO_END_MS;
    if (t >= autoEndAt) { autoEndAt = null; endTurn(); }
  } else autoEndAt = null;
  renderer.beginFrame();
  draw(screenState);
  lastTop = screenState.kind;
  renderer.present();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

(window as unknown as { civ: unknown }).civ = { get state() { return state; }, get log() { return log; }, get moving() { return view.moving; }, get battle() { return view.battle; }, get view() { return view; }, get screen() { return screenState.kind; }, dispatch, atWar, DIFFICULTIES };
