import type { BattleFrame, UnitMotion } from "./motion.js";
import type { MovePlan } from "./plan.js";
import type { Lifting } from "./fog.js";
import type { ResearchHit, ResearchView } from "./research.js";
import type { Callout } from "./refusal.js";
import { setupQuestionCards, type SetupCards } from "./setup.js";
import type { DiplomacyView } from "./audience.js";
import type { NewTechHit, NewTechView } from "./newtech.js";
export * from "./motion.js";
export * from "./icons.js";
export * from "./citizens.js";
export * from "./blend.js";
export * from "./coast.js";
export * from "./river.js";
export * from "./fog.js";
export * from "./territory.js";
export * from "./research.js";
export * from "./refusal.js";
export * from "./works.js";
export * from "./cityview.js";
export * from "./plan.js";
export * from "./watch.js";
export * from "./sites.js";
import { settlerSites, siteNote } from "./sites.js";
import { ownerAt, territory } from "./territory.js";
export * from "./intro.js";
export * from "./setup.js";
export * from "./audience.js";
export * from "./newtech.js";
export { hash } from "./hash.js";
import { WORK_ICON, WORK_NAME, type IconName } from "./icons.js";
import {
  ACCRUED_CULTURE,
  CITY_RADIUS,
  advance,
  attrition,
  attritionCure,
  bordersOpen,
  building,
  cityAt,
  civ,
  CIV_COLORS,
  CIVS,
  CULTURE,
  esteem,
  hasContact,
  maxHp,
  WONDERS,
  nativeCivs,
  partCount,
  PREMADE_WORLDS,
  premadeWorld,
  relation,
  roadOnly,
  spacePart,
  Terrain,
  TERRAIN_NAMES,
  TERRAIN_RULES,
  tileYield,
  unitAt,
  unitSupport,
  unitType,
  wonder,
  WORLD_SIZES,
  wrapX,
  type BuildingRule,
  type CityTurnEvent,
  type City,
  type GameState,
  type MapGenOptions,
  type NewGameOptions,
  type Production,
  type Unit,
  type WorldSize,
  specialOf,
} from "@civ/core";

/**
 * The screen API every renderer implements. The web app only ever talks to
 * a `Renderer`: it asks for a screen to be drawn in the renderer's own
 * logical coordinate space and hands mouse positions back in that same
 * space for hit-testing. The retro renderer lays out 320x200 palette
 * pixels; the modern one 960x600 canvas units. Game logic never leaks in
 * here: a renderer reads `GameState`, it never changes it.
 */

// ---- view state shared by the screens ----------------------------------------

export interface MainScreenView {
  originX: number;
  originY: number;
  /** Fraction (0..1) of a tile the camera sits past the origin, while it glides; the view shifts up/left by it. */
  panX?: number | undefined;
  panY?: number | undefined;
  /**
   * The map's squares drawn this many times larger (a whole number; 1 when unset), the viewport's
   * top-left corner held: fewer squares show, from the origin. The mobile app's pinch sets it.
   */
  zoom?: number | undefined;
  /** Blink phase for the active unit. */
  blink: boolean;
  /** Status message under the unit box (e.g. a refused move); wrapped to the panel. */
  message?: string | undefined;
  /** A note on the map beside a square: why the unit there could not move. */
  callout?: Callout | undefined;
  /** A note beside the square under the mouse (why it is a good city site), shown when no `callout` is. */
  hint?: Callout | undefined;
  /** A move waiting for a second click on its square (`planMove`): its route and a note at its end. */
  plan?: MovePlan | undefined;
  /** Tile the player clicked to inspect; shown instead of the message. */
  inspect?: { x: number; y: number } | undefined;
  /** The turn ends by itself once no unit needs orders. */
  autoEnd?: boolean | undefined;
  /** Index into MENU_BAR of the dropdown that is open, to highlight its title. */
  menuOpen?: number | undefined;
  /** Units sliding between squares: each is drawn at its position here, not on its square. */
  moving?: UnitMotion[] | undefined;
  /** The fight being shown: both fighters are drawn from here, with hit points, blows and the loser's end. */
  battle?: BattleFrame | undefined;
  /** Fog still lifting off squares just explored (`FogLifter`): square index to fog left, 1 down to 0. */
  lifting?: Lifting | undefined;
  /** Draw civilization borders: the edge of the squares known cities reach (`territory`). */
  borders?: boolean | undefined;
  /**
   * The unit shown as the one in play, when it is not `state.activeUnit`: just after a unit has
   * moved or fought, the view stays with it a moment before the next unit takes over. null while
   * that unit is gone (beaten): no unit is shown in play and the unit box stays empty.
   */
  focus?: number | null | undefined;
}

/** Which unit the main screen shows as in play: the focus while the view lingers, else the active unit. */
export function shownActive(state: GameState, view: MainScreenView): number | null {
  return view.focus !== undefined ? view.focus : state.activeUnit;
}

export interface CityScreenView {
  city: number;
  message?: string | undefined;
  /** The Happy panel up: the citizens after each stage of the mood reckoning (`CityReport.moods`) in the resources box's place. */
  happy?: boolean | undefined;
  /** The person in the row of citizens under the pointer (`citizenRow`), lit and told of. */
  hover?: number | undefined;
}

/** The city screen's buttons: change what is built or buy it now (the production box), view the city, the Happy panel, and the city's focus. */
export type CityButton = "change" | "buy" | "view" | "happy" | "focus";

/** The city view, a picture of the city (`cityScene`); `picked` is the improvement or wonder last clicked. */
export interface CityViewState {
  city: number;
  picked?: string | undefined;
}

/** A unit on the city screen: in the city (`here`) or supported by it elsewhere, with what it costs the city. */
export interface CityUnit {
  unit: Unit;
  here: boolean;
  shields: number;
  food: number;
}

/**
 * The units a city screen shows, as the original's: those standing in the city first (from any
 * home, so the garrison can be picked and woken), then those the city supports elsewhere.
 * Costs are what each one takes from this city: nothing for a unit another city supports.
 */
export function cityUnits(state: GameState, city: City): CityUnit[] {
  const support = new Map(unitSupport(state, city).map((s) => [s.unit.id, s]));
  const here = unitAt(state, city.x, city.y).filter((u) => u.owner === city.owner);
  const at = new Set(here.map((u) => u.id));
  const cost = (u: Unit) => ({ shields: support.get(u.id)?.shields ?? 0, food: support.get(u.id)?.food ?? 0 });
  return [
    ...here.map((unit) => ({ unit, here: true, ...cost(unit) })),
    ...[...support.values()].filter((s) => !at.has(s.unit.id)).map((s) => ({ ...s, here: false })),
  ];
}

export interface MenuState {
  /** Shown in a header row; an empty title (a dropdown) has no header. */
  title: string;
  /** Open at this point (a dropdown under the menu bar) instead of the centre of the screen. */
  anchor?: { x: number; y: number };
  /** Paragraphs shown between the title and the choices (a modal message); renderers wrap them. */
  body?: string[];
  /** An improvement or wonder whose picture (`PICTURES`) heads the body, flags in this colour slot. */
  picture?: { id: string; slot: number };
  items: string[];
  selected: number;
  /** Optional second column per row (cost, turns...). */
  right?: string[];
  /** The first row shown, when the list is longer than the window holds (`Renderer.menuRows`); it scrolls. */
  top?: number;
  /** An X at the right of the title strip, for a window with nothing to choose but to close it (a click off the choices closes any window). */
  close?: boolean;
  /**
   * A point on the screen (the square right-clicked) the window keeps clear of, by about a square
   * all round, moving above or below it (else beside it), so none of its buttons opens under the
   * pointer and a second click there only closes it. Modern ignores it.
   */
  avoid?: { x: number; y: number };
  /**
   * A map square shown at the head of the window beside its first lines, twice the map's size and as the
   * map draws it (the square's window, `terrainInfo`); drawn when `Renderer.menu` is handed the game.
   * Modern ignores it.
   */
  square?: { x: number; y: number };
}

/** A menu's first row shown, moved as little as it must be to keep the selected row among the `rows` on view. */
export function keepInView(m: MenuState, rows: number): number {
  const top = Math.max(0, Math.min(m.top ?? 0, m.items.length - rows));
  if (m.selected < top) return m.selected;
  if (m.selected >= top + rows) return m.selected - rows + 1;
  return top;
}

/** A modal window grows with its text only up to about this share of the screen's width, then wraps. */
export const MODAL_MAX_SHARE = 0.55;

/**
 * Whether a menu's choices show as buttons: a titled window of a few (a message's
 * OK, a yes or no), each sized to the longest label and centred. Dropdowns and
 * longer lists (what to build, every tribe) keep rows.
 */
export function menuButtons(m: MenuState): boolean {
  return m.title !== "" && !m.anchor && m.items.length <= 4 && !m.right?.some(Boolean);
}

export interface TextInputState {
  title: string;
  text: string;
  maxLength: number;
}

export const TEXT_INPUT_MAX = 14;

export type AdvisorKind = "domestic" | "military" | "foreign" | "score";

/** The menu bar across the top of the map screen, as in the original. */
export const MENU_BAR = ["Game", "Orders", "Advisors", "World", "Debug"] as const;

/** A row of a report page; `slot` colours a civilization's marker. */
export interface ReportLine {
  text: string;
  right?: string;
  slot?: number;
  dim?: boolean;
}

/** A titled page of rows (Wonders of the World, Top 5 Cities...). */
export interface ReportPage {
  title: string;
  lines: ReportLine[];
  hint?: string;
}

export interface SetupState {
  step: "world" | "size" | "starts" | "landMass" | "temperature" | "climate" | "age" | "difficulty" | "opponents" | "civ" | "done";
  /** Premade world id, or null for a generated world. */
  world: string | null;
  /** World size (WORLD_SIZES); the original's 80x50 when absent. */
  size?: WorldSize;
  /** On a premade world: civilizations start in their historical homelands. */
  historical: boolean;
  /** "Customize world" answers, 0..2 each (see MapGenOptions); null keeps the defaults. */
  custom: { landMass: number; temperature: number; climate: number; age: number } | null;
  difficulty: number;
  opponents: number;
  civ: string;
}

// ---- the renderer contract -------------------------------------------------------

export interface Renderer {
  /** A short id ("retro", "modern") for settings and the visuals toggle. */
  readonly id: string;
  /** Logical size the screens are laid out in; mouse positions arrive in it. */
  readonly width: number;
  readonly height: number;
  /** Canvas pixels to a logical pixel (the retro renderer draws its terrain twice as fine as its layout); 1 if absent. */
  readonly density?: number;
  /** Map tiles that fit in the main screen's viewport. */
  readonly viewTilesX: number;
  readonly viewTilesY: number;
  /**
   * Where the main screen's map lies, in logical pixels: a mouse resting near its edges pans the
   * camera. Absent on a renderer whose map is moved another way (the phone's drag).
   */
  readonly mapView?: { x: number; y: number; width: number; height: number };
  /** Rows of the research panel's list on view at once; a longer list scrolls (`ResearchView.top`). */
  readonly researchListRows: number;

  /** Called once per frame before any screen is drawn. */
  beginFrame(): void;
  /** Called once per frame after drawing; pushes the frame to the display. */
  present(): void;

  /** The opening and title screen, `at` ms since the opening began (`introAt`; from `INTRO_MS` the title stands complete). */
  title(at: number): void;
  /** A setup question as cards with pictures (`setupCards`), `selected` lit and told of; `at` as the title's. */
  setup(cards: SetupCards, selected: number, at: number): void;
  /** The setup card under a point, or -1. */
  setupHit(cards: SetupCards, px: number, py: number): number;
  main(state: GameState, view: MainScreenView): void;
  city(state: GameState, view: CityScreenView): void;
  /** The city as a picture: its improvements, wonders and homes on its own ground. */
  cityView(state: GameState, view: CityViewState): void;
  /** The research panel: shown when an advance is found and where the next research is picked. */
  research(state: GameState, view: ResearchView): void;
  science(state: GameState): void;
  rates(state: GameState): void;
  advisor(state: GameState, which: AdvisorKind): void;
  /** The audience with a foreign leader: the realm, the leader in their palace, their words, our choices as buttons. */
  diplomacy(state: GameState, view: DiplomacyView): void;
  /** The audience's choice under a point, or -1. */
  diplomacyChoiceAt(view: DiplomacyView, px: number, py: number): number;
  /** The New Technology window: an advance just found, its picture, what it is, unlocks and needed. */
  newTech(state: GameState, view: NewTechView): void;
  /** The New Technology window's button (or close box) under a point, or null. */
  newTechHit(view: NewTechView, px: number, py: number): NewTechHit | null;
  /** A game starts or loads: a renderer may fetch the art its civilizations will want (their leaders' scenes). */
  prepare?(state: GameState): void;
  end(lines: string[], rank: string): void;
  spaceship(state: GameState): void;
  /** Overlays drawn on top of whatever screen is underneath. */
  /** A window or dropdown over the current screen; `state`, when a game is on, draws its `square`. */
  menu(menu: MenuState, state?: GameState): void;
  textInput(input: TextInputState, cursorOn: boolean): void;
  statusLine(text: string): void;

  /** Row index under a point in a menu, or -1. */
  menuHit(menu: MenuState, px: number, py: number): number;
  /** How many of a menu's rows show at once; a longer list scrolls (`MenuState.top`, `keepInView`). */
  menuRows(menu: MenuState): number;
  /** A point on a scrolling menu's bar: -1 above its thumb (page up), 1 below (page down), 0 on it; null off the bar. */
  menuScrollAt(menu: MenuState, px: number, py: number): number | null;
  /** Radius slot under a point on the city screen's resource map, or null. */
  citySlotAt(px: number, py: number): number | null;
  /** True when the point is on the city screen's exit bar. */
  cityExitHit(px: number, py: number): boolean;
  /** The production box button under a point on the city screen, or null. */
  cityButtonAt(px: number, py: number): CityButton | null;
  /** The unit (id) under a point in the city screen's units (`cityUnits`), or null. */
  cityUnitAt(state: GameState, view: CityScreenView, px: number, py: number): number | null;
  /** The person (their place in `citizenRow`) under a point in the city screen's row of citizens, or null. */
  cityCitizenAt(state: GameState, view: CityScreenView, px: number, py: number): number | null;
  /** The improvement or wonder (id) under a point of the city view, or null. */
  cityViewAt(state: GameState, view: CityViewState, px: number, py: number): string | null;
  /** Map tile under a point in the main screen's viewport, or null. */
  tileAt(state: GameState, view: MainScreenView, px: number, py: number): { x: number; y: number } | null;
  /** Map tile under a point on the main screen's minimap, or null. */
  minimapAt(state: GameState, px: number, py: number): { x: number; y: number } | null;
  /** What lies under a point of the research panel: an advance in the list or on the card, a button, the scroll bar. */
  researchHit(state: GameState, view: ResearchView, px: number, py: number): ResearchHit | null;
  /** What the main screen's status panel holds under a point: the research row opens the research panel. */
  statusAt(state: GameState, view: MainScreenView, px: number, py: number): "research" | null;

  /** A report page (wonders, top cities...). */
  report(page: ReportPage): void;
  /** The whole world as far as the current player has explored it. */
  worldMap(state: GameState): void;
  /** Index into MENU_BAR of the title under a point on the main screen's menu bar, or -1. */
  menuBarHit(px: number, py: number): number;
  /** Where that title's dropdown opens. */
  menuBarAnchor(index: number): { x: number; y: number };
}

// ---- screen logic shared by every renderer -----------------------------------------

export const DIFFICULTIES = ["Chieftain", "Warlord", "Prince", "King", "Emperor"];

/** "Customize world" questions, in the original's order, with three answers each. */
export const WORLD_QUESTIONS = [
  { key: "landMass", title: "How much land?", items: ["Small continents", "Normal", "Large continents"] },
  { key: "temperature", title: "Temperature?", items: ["Cool", "Temperate", "Warm"] },
  { key: "climate", title: "Climate?", items: ["Arid", "Normal", "Wet"] },
  { key: "age", title: "Age of the world?", items: ["3 billion years", "4 billion years", "5 billion years"] },
] as const;

export const START_CHOICES = ["In their historical homelands", "Anywhere on the map"];

/** The world size question: each size by name, its squares beside it. */
export const SIZE_QUESTION = {
  title: "How big a world?",
  items: WORLD_SIZES.map((s) => s.name),
  right: WORLD_SIZES.map((s) => `${s.width} x ${s.height}`),
};

/** Tribes offered at setup: on a premade world with homelands, only the civilizations native to it. */
export function setupCivs(setup: SetupState): string[] {
  if (setup.world && setup.historical) return nativeCivs(premadeWorld(setup.world));
  return CIVS.filter((c) => c.id !== "barbarians").map((c) => c.id);
}

/** Most civilizations the setup can seat, ours included: one per colour among those offered, at most 7 as in the original. */
export function setupMaxCivs(setup: SetupState): number {
  return Math.max(3, Math.min(7, new Set(setupCivs(setup).map((id) => civ(id).color)).size));
}

export function setupMenu(setup: SetupState): { title: string; items: string[]; selected: number; right?: string[] } {
  switch (setup.step) {
    case "world":
      return { title: "Choose a world", items: PREMADE_WORLDS.map((w) => w.name), selected: Math.max(0, PREMADE_WORLDS.findIndex((w) => w.id === setup.world)) };
    case "size":
      return { ...SIZE_QUESTION, selected: Math.max(0, WORLD_SIZES.findIndex((s) => s.id === (setup.size ?? "small"))) };
    case "starts":
      return { title: "Where do the civilizations begin?", items: START_CHOICES, selected: setup.historical ? 0 : 1 };
    case "landMass": case "temperature": case "climate": case "age": {
      const q = WORLD_QUESTIONS.find((w) => w.key === setup.step)!;
      return { title: q.title, items: [...q.items], selected: setup.custom?.[q.key] ?? 1 };
    }
    case "difficulty":
      return { title: "Choose your difficulty level", items: DIFFICULTIES, selected: setup.difficulty };
    case "opponents": {
      // Civilizations in play, ours included, as in the original: 3 to 7.
      const counts: number[] = [];
      for (let n = 3; n <= setupMaxCivs(setup); n++) counts.push(n);
      return {
        title: "How many civilizations?",
        items: counts.map((n) => `${n} civilizations`),
        selected: Math.max(0, Math.min(counts.length - 1, setup.opponents - 2)),
      };
    }
    case "civ": {
      const civs = setupCivs(setup);
      // Each tribe's strength beside its name.
      return { title: "Choose your tribe", items: civs.map((id) => civ(id).name), right: civs.map((id) => civ(id).trait?.short ?? ""), selected: Math.max(0, civs.indexOf(setup.civ)) };
    }
    default:
      return { title: "", items: [], selected: 0 };
  }
}

/** The setup's current question as cards with portraits (difficulty, the tribe), or null for a plain menu. */
export function setupCards(setup: SetupState): SetupCards | null {
  return setupQuestionCards(setup.step, setupCivs(setup));
}

/**
 * Apply the choice at `index` to the setup and move to the next question.
 * Returns true once every question is answered (`step` is then "done").
 */
export function setupChoose(setup: SetupState, index: number): boolean {
  switch (setup.step) {
    case "world":
      setup.world = PREMADE_WORLDS[index]?.id ?? PREMADE_WORLDS[0]!.id;
      setup.step = "size";
      break;
    case "size":
      setup.size = WORLD_SIZES[index]?.id ?? "small";
      // A premade world asks where the civilizations begin next; a custom one, the land.
      setup.step = setup.world ? "starts" : "landMass";
      break;
    case "starts":
      setup.historical = index === 0;
      setup.step = "difficulty";
      break;
    case "landMass": case "temperature": case "climate": case "age": {
      const order = WORLD_QUESTIONS.map((q) => q.key);
      const at = order.indexOf(setup.step);
      setup.custom = { landMass: 1, temperature: 1, climate: 1, age: 1, ...setup.custom, [setup.step]: Math.max(0, Math.min(2, index)) };
      setup.step = order[at + 1] ?? "difficulty";
      break;
    }
    case "difficulty":
      setup.difficulty = index;
      setup.step = "opponents";
      break;
    case "opponents":
      setup.opponents = opponentsForChoice(index);
      setup.step = "civ";
      break;
    case "civ": {
      const civs = setupCivs(setup);
      setup.civ = civs[index] ?? civs[0]!;
      setup.step = "done";
      break;
    }
    default:
      break;
  }
  return setup.step === "done";
}

/** The new-game options a finished setup asks for. */
export function setupOptions(setup: SetupState): NewGameOptions {
  return {
    difficulty: setup.difficulty,
    opponents: setup.opponents,
    civ: setup.civ,
    ...(setup.world ? { world: setup.world, historical: setup.historical } : {}),
    ...(setup.size && setup.size !== "small" ? { size: setup.size } : {}),
    ...(setup.custom ? (setup.custom as MapGenOptions) : {}),
  };
}

/** A leader's greeting line, by mood and by what they make of our influence. */
export function leaderLine(state: GameState, player: number): string {
  const p = state.players[player]!;
  const c = civ(p.civ);
  const r = relation(state, state.currentPlayer, player);
  if (r === "war") return `${c.leader} spits: your cities will burn.`;
  const regard = esteem(state, player, state.currentPlayer);
  if (regard === "admired") return "Your people's fame goes before you. Welcome.";
  if (regard === "scorned") return "Speak quickly. Greater peoples wait on us.";
  const mine = state.units.filter((u) => u.owner === state.currentPlayer).length;
  const theirs = state.units.filter((u) => u.owner === player).length;
  if (theirs > mine * 2) return "Our armies are mighty. Tread carefully.";
  if (mine > theirs * 2) return "We seek only peace with so great a power.";
  return "Greetings. What brings you to our court?";
}

export type StandingTone = "war" | "contact" | "peace";

/**
 * How the current player stands with civilization `player`: a word or two
 * for lists, or (`long`) a line for the audience, and a tone to colour it.
 */
export function standing(state: GameState, player: number, long = false): { text: string; tone: StandingTone } {
  const me = state.currentPlayer;
  const r = relation(state, me, player);
  if (r === "war") return { text: long ? "We are at WAR" : "WAR", tone: "war" };
  if (r !== "peace") return { text: long ? "No treaty between us" : "No treaty", tone: "contact" };
  const open = bordersOpen(state, me, player);
  return { text: long ? (open ? "At peace, our borders open" : "We are at peace") : open ? "Open borders" : "Peace", tone: "peace" };
}

/** What civilization `player` makes of the current player's influence, in a few words; "" when nothing stands out. */
export function regardWords(state: GameState, player: number): string {
  const regard = esteem(state, player, state.currentPlayer);
  return regard === "admired" ? "admire us" : regard === "scorned" ? "scorn us" : "";
}

/** A civilization's name as the current player knows it: unmet civilizations stay anonymous. */
function knownName(state: GameState, owner: number): string {
  const me = state.currentPlayer;
  const p = state.players[owner]!;
  if (owner === me || hasContact(state, me, owner)) return p.name;
  return "a distant civilization";
}

/** Wonders of the World: every wonder built so far, with its city and civilization. */
export function wondersReport(state: GameState): ReportPage {
  const lines: ReportLine[] = [];
  for (const w of WONDERS) {
    const city = state.cities.find((c) => c.wonders.includes(w.id));
    if (!city) continue;
    const mine = city.owner === state.currentPlayer;
    const known = mine || hasContact(state, state.currentPlayer, city.owner);
    lines.push({ text: w.name, right: known ? `${city.name} (${knownName(state, city.owner)})` : knownName(state, city.owner), slot: state.players[city.owner]!.color, dim: !known });
  }
  if (!lines.length) lines.push({ text: "No wonder has been built yet.", dim: true });
  return { title: "Wonders of the World", lines, hint: `${lines.length && !lines[0]!.dim ? lines.length : 0} of ${WONDERS.length} built` };
}

/**
 * Civilizations: ours and every one we have met, each with its trait's name
 * and what it does. Without traits (classic civilizations) the page says so.
 */
export function civilizationsReport(state: GameState): ReportPage {
  const me = state.currentPlayer;
  if (state.classicCivs) return { title: "Civilizations", lines: [{ text: "In this game every civilization is alike.", dim: true }] };
  const lines: ReportLine[] = [];
  for (const p of state.players) {
    if (p.id === state.barbarians || !p.alive || (p.id !== me && !hasContact(state, me, p.id))) continue;
    const t = civ(p.civ).trait;
    if (!t) continue;
    lines.push({ text: p.name, right: t.name, slot: p.color });
    lines.push({ text: `  ${t.text}`, dim: true });
  }
  return { title: "Civilizations", lines, hint: "Ours and those we have met" };
}

/** Top 5 Cities: the largest cities the current player knows of, by size. */
export function topCitiesReport(state: GameState): ReportPage {
  const me = state.players[state.currentPlayer]!;
  const known = state.cities.filter((c) => c.owner === me.id || me.explored[c.y * state.map.width + c.x]);
  const top = [...known].sort((a, b) => b.size - a.size || b.wonders.length - a.wonders.length || a.id - b.id).slice(0, 5);
  const lines: ReportLine[] = top.map((c, i) => ({
    text: `${i + 1}. ${c.name}`,
    right: `size ${c.size}${c.wonders.length ? `, ${c.wonders.length} wonder${c.wonders.length > 1 ? "s" : ""}` : ""} (${knownName(state, c.owner)})`,
    slot: state.players[c.owner]!.color,
  }));
  if (!lines.length) lines.push({ text: "We know of no cities yet.", dim: true });
  return { title: "Top 5 Cities", lines };
}

function buildingIcon(b: BuildingRule): IconName {
  if (b.id === "palace") return "crown";
  if (b.content) return "heart";
  if (b.sciencePct) return "bulb";
  if (b.taxPct) return "coin";
  if (b.shieldsPct) return "shield";
  if (b.granary || b.aqueduct) return "food";
  if (b.wallsPct) return "tower";
  if (b.barracks) return "swords";
  if (b.pollutionPct) return "clean";
  return "house";
}

/**
 * The window a city opens when it finishes an improvement, a wonder, a
 * spaceship part or settlers: what it made and what that does. Its builders
 * then ask what comes next. Other units open none: their city goes on
 * building them. Settlers cost the city a citizen, so it asks before
 * shrinking again.
 */
export function builtNotice(state: GameState, cityId: number, p: Production, change?: CityTurnEvent["change"]): { title: string; lines: string[] } | null {
  const city = state.cities.find((c) => c.id === cityId);
  if (!city) return null;
  // Culture is what a city holds; old saves gathered it every turn.
  const perTurn = state.accruedCulture ? " a turn" : "";
  switch (p.kind) {
    case "unit": {
      const u = unitType(p.id);
      if (!u.flags?.includes("settler")) return null;
      // Short and in numbers (asked for 2026-10-24): what the city has before and after, each a line.
      const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`);
      const lines = change
        ? [
            `{people} Population ${change.size[0]} → ${change.size[1]}`,
            ...([["food", "Food", change.food], ["shield", "Shields", change.shields], ["trade", "Trade", change.trade]] as const)
              .filter(([, , [a, b]]) => a !== b)
              .map(([icon, name, [a, b]]) => `{${icon}} ${name} ${signed(a)} → ${signed(b)} a turn`),
          ]
        : [`{people} Population ${city.size}`];
      return { title: `${city.name} generates a group of ${u.name}`, lines };
    }
    case "building": {
      const b = building(p.id);
      // Upkeep and culture share the second line.
      const culture = state.accruedCulture ? ACCRUED_CULTURE.buildings[b.id] : b.culture;
      const costs = [b.upkeep ? `{purse} Upkeep ${b.upkeep} gold` : "", culture && !state.fixedBorders ? `{culture} Culture +${culture}${perTurn}` : ""];
      return { title: `${city.name} builds ${b.name}`, lines: [`{${buildingIcon(b)}} ${b.text}`, costs.filter(Boolean).join("  ")].filter(Boolean) };
    }
    case "wonder": {
      const w = wonder(p.id);
      const more = [w.obsolete ? `{hourglass} Ends with ${advance(w.obsolete).name}` : "", state.fixedBorders ? "" : `{culture} Culture +${state.accruedCulture ? ACCRUED_CULTURE.wonder : CULTURE.wonder}${perTurn}`];
      return { title: `${city.name} completes ${w.name}`, lines: [`{star} ${w.text}`, more.filter(Boolean).join("  ")].filter(Boolean) };
    }
    case "spaceship": {
      const part = spacePart(p.id);
      const ship = state.players[city.owner]!.spaceship;
      return { title: `${city.name} builds ${part.name}`, lines: [part.text, `{star} ${partCount(ship, p.id)} of ${part.max} built`] };
    }
  }
}

/** Rival civilizations for the n-th choice of the "How many civilizations?" menu. */
export function opponentsForChoice(index: number): number {
  return Math.max(2, Math.min(6, index + 2));
}

/**
 * What the current player knows about a map square, for the terrain
 * information window: yields under their government, movement and
 * defence, specials and improvements, whether wheels need a road or the
 * ground wears units down, what settlers could do there, and the city and
 * units on it. Plain ASCII so every font can draw it.
 */
/** A few words on each terrain for the square's window: what it is good for (our own words). */
export const TERRAIN_TEXT: Record<Terrain, string> = {
  [Terrain.Ocean]: "Open sea: fish to eat, and trade along the coast.",
  [Terrain.Grassland]: "Rich open land, the best for farms.",
  [Terrain.Plains]: "Open land for fields and herds, with a little timber.",
  [Terrain.Forest]: "Timber for building; slow going for armies.",
  [Terrain.Hills]: "Easy to hold, and rich in ore once mined.",
  [Terrain.Mountains]: "A wall to armies, with gold and iron in the rock.",
  [Terrain.Desert]: "Dry and poor, until water is brought to it.",
  [Terrain.Tundra]: "Cold, thin land at the edge of the ice.",
  [Terrain.Arctic]: "Ice where nothing grows.",
  [Terrain.Swamp]: "Wet and slow; drained, it becomes grassland.",
  [Terrain.Jungle]: "Thick and wet; cleared, it becomes grassland.",
};

/** What a special adds to its square, in icons: "+2 {shield}". */
function specialGain(sp: { food?: number; shields?: number; trade?: number }): string {
  return [sp.food && `+${sp.food} {food}`, sp.shields && `+${sp.shields} {shield}`, sp.trade && `+${sp.trade} {trade}`].filter(Boolean).join(" ");
}

export function terrainInfo(state: GameState, x: number, y: number): { title: string; lines: string[] } {
  const me = state.players[state.currentPlayer]!;
  const { map } = state;
  const idx = y * map.width + wrapX(map, x);
  if (y < 0 || y >= map.height || !me.explored[idx]) return { title: "Unexplored", lines: ["Not explored yet."] };
  const t = map.tiles[idx]!;
  const r = TERRAIN_RULES[t.terrain];
  const city = cityAt(state, x, y);
  const yld = tileYield(state, t, city !== undefined, me.government, me.id);
  // Lines with {icon} tokens are drawn with pictures; "  " separates groups that may wrap apart.
  const lines: string[] = [];
  // A river square defends at half again (the original's River), unless its terrain gives more.
  const defenseMul = t.river && !state.freecivYields ? Math.max(1.5, r.defense) : r.defense;
  const defence = defenseMul === 1 ? "" : `  {tower} +${Math.round((defenseMul - 1) * 100)}%`;
  lines.push(`{food} ${yld.food}  {shield} ${yld.shields}  {trade} ${yld.trade}  {boot} ${r.moveCost}${defence}`);
  lines.push(TERRAIN_TEXT[t.terrain]);
  // Grassland's first special counts only in games before version 26 (`tileYield`).
  const sp = !state.freecivYields && t.terrain === Terrain.Grassland && !t.secondSpecial ? undefined : specialOf(t);
  const features = [
    sp && `{star} ${sp.name} ${specialGain(sp)}`,
    t.grassShield && t.terrain === Terrain.Grassland && "{shield} Shield grassland +1 {shield}",
    t.river && `{river} River +1 {trade}${state.freecivYields ? "" : ", no road trade"}`,
    t.railroad ? "{railroad} Railroad" : t.road && "{road} Road",
    t.irrigation && "{irrigate} Irrigation",
    t.mine && "{mine} Mine",
    t.fortress && "{fortress} Fortress",
  ].filter(Boolean);
  if (features.length) lines.push(features.join("  "));
  if (t.pollution) lines.push("{pollution} Polluted: output halved");
  if (t.hut) lines.push("{hut} A tribal village");
  if (roadOnly(state, t) && !t.road) lines.push("{road} Settlers only, until a road");
  else if (r.rough && !t.road && !state.classicTerrain) lines.push("{road} Wheeled units need a road");
  const wear = attrition(state, me.id, x, y);
  if (wear > 0 && r.attrition) lines.push(`{heart} Wears units down ${Math.round(wear * 100)}% a turn  until ${advance(attritionCure(state, r.attrition)).name}`);
  if (t.terrain !== Terrain.Ocean) {
    const work: string[] = [];
    if (r.irrigate) work.push(r.irrigate.becomes !== undefined ? `{irrigate} into ${TERRAIN_NAMES[r.irrigate.becomes]}` : `{irrigate} +${r.irrigate.food ?? 0} {food}`);
    if (r.mine) work.push(r.mine.becomes !== undefined ? `{mine} into ${TERRAIN_NAMES[r.mine.becomes]}` : `{mine} +${r.mine.shields ?? 0} {shield}`);
    if (r.road.trade > 0) work.push(`{road} +${r.road.trade} {trade}`);
    if (work.length) lines.push(`Improvements:  ${work.join("  ")}`);
  }
  if (city) lines.push(`{city} ${city.name} (${state.players[city.owner]!.name}), size ${city.size}`);
  else {
    // Whose land it is, by the borders of the cities we know, and which city of ours works it.
    const owner = ownerAt(territory(state), x, y);
    const worker = state.cities.find((c) => c.owner === me.id && c.worked.some((slot) => {
      const [dx, dy] = CITY_RADIUS[slot]!;
      return wrapX(map, c.x + dx) === wrapX(map, x) && c.y + dy === y;
    }));
    const land = owner >= 0 ? (owner === me.id ? "Our land" : `Land of the ${state.players[owner]?.name ?? "unknown"}`) : "";
    const worked = worker ? `${land ? "worked" : "Worked"} by ${worker.name}` : "";
    if (land || worked) lines.push(`{crown} ${[land, worked].filter(Boolean).join(", ")}`);
  }
  // A square the map suggests for the settlers in play says why.
  const site = settlerSites(state, state.activeUnit).find((s) => s.x === wrapX(map, x) && s.y === y);
  if (site) lines.push(`{city} ${siteNote(state, site, me.id)}`);
  if (me.visible[idx]) {
    const units = unitAt(state, x, y);
    if (units.length) {
      const owner = state.players[units[0]!.owner]!;
      const counts = new Map<string, number>();
      for (const u of units) counts.set(unitType(u.type).name, (counts.get(unitType(u.type).name) ?? 0) + 1);
      const names = [...counts].map(([n, k]) => (k > 1 ? `${k} ${n}` : n)).join(", ");
      lines.push(`{swords} ${names} (${owner.id === me.id ? "ours" : owner.name})`);
      for (const u of units) {
        if (u.order.kind !== "work") continue;
        const job = WORK_NAME[u.order.work];
        lines.push(`{${WORK_ICON[u.order.work]}} ${job[0]!.toUpperCase()}${job.slice(1)}, ${u.order.turnsLeft} turn${u.order.turnsLeft === 1 ? "" : "s"}`);
      }
      const hurt = units.filter((u) => u.hp < maxHp(state, u.type));
      if (hurt.length) lines.push(hurt.map((u) => `{heart} ${unitType(u.type).name} ${u.hp}/${maxHp(state, u.type)}`).join("  "));
    }
  }
  // The title names the square's resource and river beside its terrain: "Jungle (Cotton)".
  const extras = [sp?.name, t.river ? "River" : undefined].filter(Boolean);
  return { title: `${TERRAIN_NAMES[t.terrain]}${extras.length ? ` (${extras.join(", ")})` : ""}`, lines };
}

/** Colour slots (see CIV_COLORS in core); renderers map each slot to their own palette. */
export const PLAYER_COLOR_SLOTS = CIV_COLORS.length;
export function playerSlot(color: number): number {
  return ((color % PLAYER_COLOR_SLOTS) + PLAYER_COLOR_SLOTS) % PLAYER_COLOR_SLOTS;
}
