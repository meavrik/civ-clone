import type { BattleFrame, UnitMotion } from "./motion.js";
import type { MovePlan } from "./plan.js";
import type { Lifting } from "./fog.js";
import type { ResearchHit, ResearchView } from "./research.js";
import type { Callout } from "./refusal.js";
import type { SleepOrder } from "./unit-standing.js";
import type { EndCard } from "./chronicle.js";
import type { MinimapButton, PanelSpot, PanelTip, ZoomButton } from "./panel.js";
import { setupQuestionCards, type SetupCards } from "./setup.js";
import { treaty, type DiplomacyView, type StandingTone } from "./audience.js";
import type { NewTechHit, NewTechView } from "./newtech.js";
import type { AdvanceInfoHit, AdvanceInfoView } from "./advance-info.js";
import type { BuiltHit, BuiltView } from "./built.js";
import type { ConquestHit, ConquestView, Fireworks } from "./conquest.js";
import type { Sinking } from "./sinking.js";
import type { Sacking } from "./sack.js";
import type { MenuInfo } from "./production-info.js";
import type { FoundingMoment } from "./founding.js";
import type { ReignHit, ReignView } from "./reign.js";
import type { ImprovementHit } from "./improvements.js";
export * from "./motion.js";
export * from "./icons.js";
export * from "./citizens.js";
export * from "./improvements.js";
export * from "./blend.js";
export * from "./coast.js";
export * from "./terrain-variant.js";
export * from "./huts.js";
export * from "./work-pictures.js";
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
export * from "./ranks.js";
export * from "./unit-standing.js";
export * from "./panel.js";
export * from "./treasury.js";
export * from "./chronicle.js";
export * from "./city-states.js";
export * from "./terrain-text.js";
export * from "./places.js";
export * from "./intro.js";
export * from "./setup.js";
export * from "./audience.js";
export * from "./newtech.js";
export * from "./advance-info.js";
export * from "./art.js";
export * from "./unit-atlas.js";
export * from "./unit-anim.js";
export * from "./shot.js";
export * from "./owner-colour.js";
export * from "./facing.js";
export * from "./built.js";
export * from "./conquest.js";
export * from "./sinking.js";
export * from "./sack.js";
export * from "./sight-hold.js";
export * from "./production-info.js";
export * from "./founding.js";
export * from "./staging.js";
export * from "./outbuilt.js";
export * from "./reign.js";
export * from "./loading.js";
export * from "./pulse.js";
export * from "./year.js";
import type { LoadingView } from "./loading.js";
export * from "./resources.js";
export * from "./square-info.js";
import type { SquareCard } from "./square-info.js";
export { hash } from "./hash.js";
import type { IconName } from "./icons.js";
import {
  ACCRUED_CULTURE,
  buildingCulture,
  advance,
  building,
  computeCity,
  civ,
  CIV_COLORS,
  CIVS,
  CULTURE,
  esteem,
  hasContact,
  WONDERS,
  nativeCivs,
  partCount,
  PREMADE_WORLDS,
  premadeWorld,
  relation,
  spacePart,
  unitAt,
  unitSupport,
  unitType,
  wonder,
  WORLD_SIZES,
  type BuildingRule,
  type City,
  type CityFocus,
  type GameState,
  type MapGenOptions,
  type NewGameOptions,
  type Production,
  type Unit,
  type WorldSize,
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
  /**
   * The map's zoom buttons, + over - in the view's bottom right corner (asked for 2026-11-02: "place +/- toggle button
   * on main map for zoom"): each faded where the zoom goes no further (`in`, `out` false), `lit` the one under the
   * pointer. None when unset (the phone pinches).
   */
  zoomButtons?: { in: boolean; out: boolean; lit?: ZoomButton | undefined } | undefined;
  /** Blink phase: the unit in play's box on the minimap, "Press Enter" under End of Turn. */
  blink: boolean;
  /** The year the status panel shows while it counts on to the turn's (`countedYear`), lit; the turn's own when unset. */
  year?: number | undefined;
  /** How much of the unit in play shows, 0..1 (`activeOpacity`: it blinks smoothly, its picture fading, its shield and marks dithered); whole when unset. */
  opacity?: number | undefined;
  /** How bright the faint gold glow round the unit in play's figure is, 0..1 (`ACTIVE_GLOW`); none when unset or 0. */
  glow?: number | undefined;
  /** Status message under the unit box (e.g. a refused move); wrapped to the panel. */
  message?: string | undefined;
  /** A note on the map beside a square: why the unit there could not move. */
  callout?: Callout | undefined;
  /** A note beside the square under the mouse (why it is a good city site), shown when no `callout` is. */
  hint?: Callout | undefined;
  /** A tip beside the status panel on the part the mouse rests on (`panelTip`), or the part tapped. */
  tip?: PanelTip | undefined;
  /** A move waiting for a second click on its square (`planMove`): its route and a note at its end. */
  plan?: MovePlan | undefined;
  /** Tile the player clicked to inspect; shown instead of the message. */
  inspect?: { x: number; y: number } | undefined;
  /** Index into MENU_BAR of the dropdown that is open, to highlight its title. */
  menuOpen?: number | undefined;
  /** Units sliding between squares: each is drawn at its position here, not on its square. */
  moving?: UnitMotion[] | undefined;
  /** The fight being shown: both fighters are drawn from here, with hit points, blows and the loser's end. */
  battle?: BattleFrame | undefined;
  /** Each animated unit's frame of its atlas this frame (`UnitAnimator`, by unit id); a unit without one stands idle. */
  unitFrames?: Record<number, number> | undefined;
  /** The units facing left (`UnitFacing`, by unit id): their pictures are drawn mirrored; the rest face right. */
  facingLeft?: Record<number, true> | undefined;
  /** Fireworks bursting over a city the viewer has just taken (`Fireworks`). */
  fireworks?: Fireworks | undefined;
  /** A ship of the viewer's going down on deep water as the turn ends, the words above it (`Sinking`). */
  sinking?: Sinking | undefined;
  /**
   * Villages the viewer's units have entered, still standing in the picture until the unit has walked in and the
   * village opens (asked for 2026-11-02: "first the unit need to visibly enter the hut and only then show the hut
   * result"): drawn on their squares whatever the map says, the units they brought (`units`) not drawn yet.
   */
  villages?: readonly EnteredVillage[] | undefined;
  /** A village of those being sacked by the unit that walked in, before it opens (`Sacking`): the hut shaken, looted and brought down. */
  sacking?: Sacking | undefined;
  /**
   * A city the viewer has just founded, made a moment (asked for 2026-10-29 with the user's sheets, "add the build new
   * settlement", then "for new settlement epic effect - add zoom and some effect and delay"; `founding.ts`): where it
   * stands `ms` in (`FoundingMoment`), the founders' show (atlas `id`) on the city's square in place of the city, which
   * shows once it is over, the view glided in on it, dusk round it, light behind the flag and the city's name (`city`).
   */
  founding?: ({ x: number; y: number; id: string; owner: number; city: string; ms: number } & FoundingMoment) | undefined;
  /**
   * Squares of a strategic resource an advance has just revealed (`resourceReveals`), ringed in gold while the map
   * holds on them; `at` runs 0..1 over that moment, the rings pulsing twice.
   */
  revealed?: { squares: { x: number; y: number }[]; at: number } | undefined;
  /** Fog still lifting off squares just explored (`FogLifter`): square index to fog left, 1 down to 0. */
  lifting?: Lifting | undefined;
  /** Draw civilization borders on the map: the edge of the squares known cities reach (`territory`). The minimap has its own switch. */
  borders?: boolean | undefined;
  /** Write the names of seas, lands and landforms on the map (`placeLabels`); on when unset. */
  placeNames?: boolean | undefined;
  /** Write each civilization's name over its land on the map (`civNameSpots`), with the borders; on when unset. */
  civNames?: boolean | undefined;
  /** The minimap's switches (its buttons, `MinimapButton`): its names, the civilizations' and the continents' (`territoryLabels`, `continentLabels`), and its borders, each civilization's land in its colour; shown when unset. */
  minimapNames?: boolean | undefined;
  minimapBorders?: boolean | undefined;
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

/** A village entered, at (x, y), and the units it brought (mercenaries joining, an ambush): see `MainScreenView.villages`. */
export interface EnteredVillage {
  x: number;
  y: number;
  units: readonly number[];
}

export interface CityScreenView {
  city: number;
  message?: string | undefined;
  /** The Happy panel up: the citizens after each stage of the mood reckoning (`CityReport.moods`) in the resources box's place. */
  happy?: boolean | undefined;
  /** The person in the row of citizens under the pointer (`citizenRow`), lit and told of. */
  hover?: number | undefined;
  /** The control under the pointer (a button, the close box, a focus corner of the map), told of beside the citizens. */
  hoverControl?: CityControl | undefined;
  /** The first line on view of the Improvements box's list (`cityImprovements`), when it is longer than the box: it scrolls. */
  top?: number | undefined;
  /** The improvement under the pointer, lit and told of beside the citizens (`improvementNote`); `toggle` on its Stop or Use button. */
  hoverImprovement?: { id: string; toggle: boolean } | undefined;
  /** The unit (id) in the units box under the pointer (`cityUnits`), told of beside the citizens (`cityUnitNote`). */
  hoverUnit?: number | undefined;
  /** Units woken in the units box while this city is open, by id, with the order each gave up: a second click restores it. */
  woken?: Record<number, SleepOrder> | undefined;
}

/** What can be pointed at on the city screen besides its citizens and squares: its buttons, the close box, the focus toggles. */
export type CityControl = CityButton | "exit" | CityFocus;

/** The city screen's buttons: change what is built or buy it now (the production box), view the city, the Happy panel, and the city's focus. */
export type CityButton = "change" | "buy" | "view" | "happy" | "focus";

/** The city view, a picture of the city (`cityScene`); `picked` is the improvement or wonder last clicked. */
export interface CityViewState {
  city: number;
  picked?: string | undefined;
  /**
   * A wonder just completed, rising in its place (asked for 2026-10-24: "a new wonder build WOW effect,
   * the construction in fast forward in the city view"): `reveal` 0..1 is how much of it stands from the
   * ground up, `sparkle` 0..1 the burst of sparkles round it once it stands whole (0: none yet).
   */
  rising?: { id: string; reveal: number; sparkle: number };
  /** Words along the bar in place of the hint ("Rome completes the Pyramids!"), with no Back button. */
  banner?: string;
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
   * The square the window tells of, on the screen (`Renderer.squareRect`; asked for 2026-11-01: "the tile should be
   * highlited and info window points with an arrow towards the tile"): the window stands by it as the Building
   * Completed window stands by its city, above it, else below or beside it, a point of its stone reaching to a gold
   * ring round the square, which stays lit while the rest darkens; with no room so, `avoid` places it. Modern ignores it.
   */
  point?: { x: number; y: number; w: number; h: number };
  /**
   * A map square shown at the head of the window beside its first lines, twice the map's size and as the
   * map draws it (the square's window, `terrainInfo`); drawn when `Renderer.menu` is handed the game.
   * Modern ignores it.
   */
  square?: { x: number; y: number };
  /**
   * The square's window's card (`terrainInfo`): its yields, moves and defence beside the square's picture, then its
   * facts in groups, a line each. Drawn in place of the body; modern writes it on as body lines (`squareLines`).
   */
  card?: SquareCard;
  /**
   * A unit's picture at the head of the window beside its first lines, in the square's frame and twice the
   * map's size (the new settlers' window, asked for 2026-10-29): its type and its owner's colour slot.
   * Modern ignores it.
   */
  unit?: { type: string; color: number };
  /** How far a window has grown on opening, 0..1 (`WINDOW_ENTER_MS`); absent or 1, it stands whole. Dropdowns ignore it. */
  enter?: number | undefined;
  /** Rows that cannot be picked now (Revolution! with no government to turn to): drawn faded, never hit. */
  disabled?: number[];
  /** Rows that undo something for good (a unit's Disband): drawn in warning red, as a row or a button. Modern ignores it. */
  danger?: number[];
  /**
   * A picture before each row (null: none): a unit's, its type and its owner's colour slot (the stack chooser,
   * asked for 2026-10-24: a click on a square holding several of our units lists them to pick from), or a
   * building's, wonder's or spaceship part's (the build menu, asked for 2026-10-30: "show unit/building image next
   * to each item"). Rows grow to hold it; never buttons. Modern ignores it.
   */
  pictures?: (MenuPicture | null)[];
  /**
   * A part of the screen under the window it keeps clear of and leaves lit, standing above it, its rows
   * scrolling in the room there: the city screen's units box under the build menu (asked for 2026-10-30:
   * "place the menu above the units panel - so player could see all existing units"). Modern ignores it.
   */
  keepClear?: "cityUnits";
  /**
   * Tabs above the rows, `tab` the one shown, its rows being `items`, `right`, `pictures` and `disabled` (`showTab`):
   * the build menu's Buildings and Units (asked for 2026-10-31: "split into 2 tabs - buildings and units"). The window
   * is sized for every tab's rows, so it keeps its size as they change. Never buttons. Modern ignores them (it shows
   * the tab shown).
   */
  tabs?: MenuTab[];
  tab?: number;
  /**
   * What each row is, told in a tip (the build menu, asked for 2026-11-02: "add for each building/unit a info icon - when
   * clicked or hover show building/unit info"; `productionInfo`): rows with one carry an info mark at their right end
   * (`Renderer.menuInfoAt`), and `infoShown` is the row whose tip stands beside its mark. Modern ignores them.
   */
  info?: (MenuInfo | null)[];
  infoShown?: number | undefined;
  /**
   * Small pictures after each row's words, in a column of their own (null: none): what an advance brings in the
   * research list (asked for 2026-11-03: "near each tech can add in small icons the improvements/buildings/units it
   * unlocks - just icons small"). Rows grow to hold them; never buttons. Modern ignores them.
   */
  trail?: (MenuPicture[] | null)[];
  /**
   * Its body's lines never break (the build menu's road note, asked for 2026-10-31: "keep in one text line - do not
   * break"): the window widens to hold them, and where the screen is too narrow takes its smaller size (the phone's).
   * Modern ignores it.
   */
  oneLine?: boolean;
}

/**
 * A row's picture in a list (`MenuState.pictures`, `MenuState.trail`): a unit's in its owner's colours, a building's (a
 * wonder's, a spaceship part's), or one of the panel icons (a government's crown).
 */
export type MenuPicture = { unit: string; color: number } | { building: string } | { icon: IconName };

/** A tab of a list (`MenuState.tabs`): its label and its rows, as the menu's own fields hold them while it is shown. */
export interface MenuTab {
  label: string;
  items: string[];
  right?: string[];
  pictures?: (MenuPicture | null)[];
  disabled?: number[];
  info?: (MenuInfo | null)[];
  /** The row picked while it is shown, kept for when it is shown again. */
  selected: number;
  /** Nothing in it to pick now (the build menu's Wonders with none to build): drawn faded, never shown. */
  off?: boolean;
}

/** Show tab `i` of a tabbed list (`MenuState.tabs`), the tab shown before keeping the row it had picked; scrolled to the top. */
export function showTab(m: MenuState, i: number): void {
  const t = m.tabs?.[i];
  if (!t || t.off) return;
  const was = m.tabs![m.tab ?? 0];
  if (was) was.selected = m.selected;
  m.tab = i;
  m.items = t.items;
  m.selected = t.selected;
  m.top = 0;
  if (t.right) m.right = t.right; else delete m.right;
  if (t.pictures) m.pictures = t.pictures; else delete m.pictures;
  if (t.disabled) m.disabled = t.disabled; else delete m.disabled;
  if (t.info) m.info = t.info; else delete m.info;
  delete m.infoShown;
}

/** How long a window takes to grow to its full size as it opens (asked for 2026-10-24: "animate window modals entrance"). */
export const WINDOW_ENTER_MS = 160;

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
  return m.title !== "" && !m.anchor && m.items.length <= 4 && !m.right?.some(Boolean) && !m.pictures && !m.trail && !m.info && !m.tabs;
}

export interface TextInputState {
  title: string;
  text: string;
  maxLength: number;
}

export const TEXT_INPUT_MAX = 14;

/** The advisors' pages: F1 to F3 and F5, and the strategic resources (Advisors > Resources). */
export type AdvisorKind = "domestic" | "military" | "foreign" | "score" | "resources";

/** The menu bar across the top of the map screen, as in the original. */
export const MENU_BAR = ["Game", "Orders", "Advisors", "Diplomacy", "World", "Debug"] as const;

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
  /** Whether a point lies on the audience window's close box (a renderer that draws it as a window). */
  diplomacyCloseAt?(px: number, py: number): boolean;
  /** The New Technology window: an advance just found, its picture, what it is, unlocks and needed. */
  newTech(state: GameState, view: NewTechView): void;
  /** The New Technology window's button (or close box) under a point, or null. */
  newTechHit(view: NewTechView, px: number, py: number): NewTechHit | null;
  /** The window of more about an advance (`advanceInfo`): its picture, what it is, its history, all it unlocks and what it leads to. */
  advanceInfo(state: GameState, view: AdvanceInfoView): void;
  /** Its close box under a point ("close"), else null. */
  advanceInfoHit(view: AdvanceInfoView, px: number, py: number): AdvanceInfoHit | null;
  /** The Building Completed window: an improvement, wonder or spaceship part a city just finished, said in its title, its picture under it. */
  built(state: GameState, view: BuiltView): void;
  /** The Building Completed window's button (or close box) under a point, or null (its width follows its title). */
  builtHit(state: GameState, view: BuiltView, px: number, py: number): BuiltHit | null;
  /** A city taken, by us or from us (`conquestCard`): a small window by the city, in triumph or in mourning. */
  conquest(state: GameState, view: ConquestView): void;
  /** What lies under a point of the conquest window: View City, Continue, the close box, or nothing. */
  conquestHit(state: GameState, view: ConquestView, px: number, py: number): ConquestHit | null;
  /** The window a new game opens with over the map: our leader's portrait, the people in a sentence, what the tribe brings (`reignCard`). */
  reign(state: GameState, view: ReignView): void;
  /** The opening window's button (or close box) under a point, or null. */
  reignHit(view: ReignView, px: number, py: number): ReignHit | null;
  /** A game starts or loads: a renderer may fetch the art its civilizations will want (their leaders' scenes). */
  prepare?(state: GameState): void;
  /** The window over the screen while a saved game is replayed (`LoadingView`): the save, a bar of how far it has come. */
  loading(view: LoadingView): void;
  /** The end of the game: how it ended and the civilization's whole history (`endCard`). */
  end(card: EndCard): void;
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
  /** Where a row of a menu lies as drawn, across the menu's width (a submenu opens beside it); null for buttons or a row off view. */
  menuRowRect?(menu: MenuState, row: number): { x: number; y: number; w: number; h: number } | null;
  /** The tab under a point of a tabbed menu (`MenuState.tabs`), or null. */
  menuTabAt?(menu: MenuState, px: number, py: number): number | null;
  /** The row of a menu whose info mark (`MenuState.info`) lies under a point, or null. */
  menuInfoAt?(menu: MenuState, px: number, py: number): number | null;
  /** Whether a point lies on the tip a menu shows (`MenuState.infoShown`). */
  menuTipAt?(menu: MenuState, px: number, py: number): boolean;
  /** Radius slot under a point on the city screen's resource map, or null. */
  citySlotAt(px: number, py: number): number | null;
  /** True when the point is on the city screen's exit bar. */
  cityExitHit(px: number, py: number): boolean;
  /** The production box button under a point on the city screen, or null. */
  cityButtonAt(px: number, py: number): CityButton | null;
  /** The unit (id) under a point in the city screen's units (`cityUnits`), or null. */
  cityUnitAt(state: GameState, view: CityScreenView, px: number, py: number): number | null;
  /** The focus toggle under a point (a corner of the city screen's map), or null. */
  cityFocusAt(px: number, py: number): CityFocus | null;
  /** What lies under a point of the city screen's Improvements box: a line or its Stop (or Use) button, or the list's scroll bar; null elsewhere. */
  cityImprovementAt(state: GameState, view: CityScreenView, px: number, py: number): ImprovementHit | null;
  /** How many lines of the Improvements box show at once; a longer list scrolls (`CityScreenView.top`, `scrollImprovements`). */
  cityImprovementRows(state: GameState): number;
  /** What a point on the rates window asks (`RatesHit`), or null off it. */
  ratesHit(px: number, py: number): RatesHit | null;
  /** The person (their place in `citizenRow`) under a point in the city screen's row of citizens, or null. */
  cityCitizenAt(state: GameState, view: CityScreenView, px: number, py: number): number | null;
  /** The improvement or wonder (id) under a point of the city view, or null. */
  cityViewAt(state: GameState, view: CityViewState, px: number, py: number): string | null;
  /** Where a map square lies on the main screen as `view` draws it, in logical pixels, or null off the viewport. */
  squareRect?(state: GameState, view: MainScreenView, x: number, y: number): { x: number; y: number; w: number; h: number } | null;
  /** Map tile under a point in the main screen's viewport, or null. */
  tileAt(state: GameState, view: MainScreenView, px: number, py: number): { x: number; y: number } | null;
  /** Map tile under a point on the main screen's minimap, or null. */
  minimapAt(state: GameState, px: number, py: number): { x: number; y: number } | null;
  /** What lies under a point of the research panel: an advance in the list or on the card, a button, the scroll bar. */
  researchHit(state: GameState, view: ResearchView, px: number, py: number): ResearchHit | null;
  /** What the main screen's status panel holds under a point: the research row opens the research panel, the treasury the rates window. */
  statusAt(state: GameState, view: MainScreenView, px: number, py: number): "research" | "endTurn" | "rates" | null;
  /** The part of the status panel under a point, for its tip (`panelTip`), or null off the panel's parts. */
  statusPartAt(state: GameState, view: MainScreenView, px: number, py: number): PanelSpot | null;
  /** The minimap's switch under a point (its names or its borders), or null; absent on a renderer without them. */
  minimapButtonAt?(state: GameState, px: number, py: number): MinimapButton | null;
  /** The map's zoom button under a point (`MainScreenView.zoomButtons`), or null; absent on a renderer without them. */
  zoomButtonAt?(view: MainScreenView, px: number, py: number): ZoomButton | null;

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

/** What a civilization's cities bring its treasury, luxuries and research in a turn, at the rates set (the rates window's foot). */
export function empireIncome(state: GameState, player: number): { gold: number; lux: number; science: number } {
  const out = { gold: 0, lux: 0, science: 0 };
  for (const c of state.cities) {
    if (c.owner !== player) continue;
    const r = computeCity(state, c);
    out.gold += r.tax - r.buildingUpkeep;
    out.lux += r.lux;
    out.science += r.science;
  }
  return out;
}

/** A row of the rates window: the tax, luxury or science rate. */
export type RateRow = "tax" | "lux" | "sci";
/** What a click on the rates window asks: a rate set to a block, stepped by a button, or the window closed. */
export type RatesHit = { kind: "set"; row: RateRow; value: number } | { kind: "step"; row: RateRow; delta: number } | { kind: "done" };


/**
 * How the current player stands with civilization `player`: a word or two
 * for lists, or (`long`) a line for the audience, and a tone to colour it
 * (`treaty`: war, no treaty, a pact, peace, open borders, an alliance).
 */
export function standing(state: GameState, player: number, long = false): { text: string; tone: StandingTone } {
  return treaty(state, state.currentPlayer, player, long);
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
export function builtNotice(state: GameState, cityId: number, p: Production): { title: string; lines: string[] } | null {
  const city = state.cities.find((c) => c.id === cityId);
  if (!city) return null;
  // Culture is what a city holds; old saves gathered it every turn.
  const perTurn = state.accruedCulture ? " a turn" : "";
  switch (p.kind) {
    case "unit": {
      const u = unitType(p.id);
      if (!u.flags?.includes("settler")) return null;
      // A sentence on the new settlers and what they can do (asked for 2026-10-29: "less technical"; the
      // city's size and yields before and after were the lines from 2026-10-24). The window shows them too.
      return { title: `New ${u.name} in ${city.name}`, lines: [`A family of ${city.name} sets out, ready to found a new city or to build roads, farms and mines.`] };
    }
    case "building": {
      const b = building(p.id);
      // Upkeep and culture share the second line.
      const culture = buildingCulture(state, b.id);
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

/** Colour slots (see CIV_COLORS in core); renderers map each slot to their own palette. */
export const PLAYER_COLOR_SLOTS = CIV_COLORS.length;
export function playerSlot(color: number): number {
  return ((color % PLAYER_COLOR_SLOTS) + PLAYER_COLOR_SLOTS) % PLAYER_COLOR_SLOTS;
}
