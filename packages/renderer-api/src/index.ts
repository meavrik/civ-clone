import type { BattleFrame, UnitMotion } from "./motion.js";
import type { Lifting } from "./fog.js";
import type { TechTreeHit, TechTreeView } from "./techtree.js";
import type { Callout } from "./refusal.js";
export * from "./motion.js";
export * from "./icons.js";
export * from "./citizens.js";
export * from "./coast.js";
export * from "./river.js";
export * from "./fog.js";
export * from "./territory.js";
export * from "./techtree.js";
export * from "./refusal.js";
export * from "./works.js";
export * from "./cityview.js";
export { hash } from "./hash.js";
import { WORK_ICON, WORK_NAME, type IconName } from "./icons.js";
import {
  ACCRUED_CULTURE,
  advance,
  attrition,
  attritionCure,
  building,
  cityAt,
  civ,
  CIV_COLORS,
  CIVS,
  CULTURE,
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
  type City,
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
  /** Blink phase for the active unit. */
  blink: boolean;
  /** Status message under the unit box (e.g. a refused move); wrapped to the panel. */
  message?: string | undefined;
  /** A note on the map beside a square: why the unit there could not move. */
  callout?: Callout | undefined;
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
}

/** The city screen's buttons: change what is built or buy it now (the production box), and view the city. */
export type CityButton = "change" | "buy" | "view";

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
  /** Map tiles that fit in the main screen's viewport. */
  readonly viewTilesX: number;
  readonly viewTilesY: number;
  /** Tiers of the tech tree that fit across its window (may be fractional). */
  readonly techColumns: number;

  /** Called once per frame before any screen is drawn. */
  beginFrame(): void;
  /** Called once per frame after drawing; pushes the frame to the display. */
  present(): void;

  title(blink: boolean): void;
  main(state: GameState, view: MainScreenView): void;
  city(state: GameState, view: CityScreenView): void;
  /** The city as a picture: its improvements, wonders and homes on its own ground. */
  cityView(state: GameState, view: CityViewState): void;
  /** The tech tree: shown when an advance is found and where the next research is picked. */
  techTree(state: GameState, view: TechTreeView): void;
  science(state: GameState): void;
  rates(state: GameState): void;
  advisor(state: GameState, which: AdvisorKind): void;
  diplomacy(state: GameState, player: number, line: string): void;
  end(lines: string[], rank: string): void;
  spaceship(state: GameState): void;
  /** Overlays drawn on top of whatever screen is underneath. */
  menu(menu: MenuState): void;
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
  /** The improvement or wonder (id) under a point of the city view, or null. */
  cityViewAt(state: GameState, view: CityViewState, px: number, py: number): string | null;
  /** Map tile under a point in the main screen's viewport, or null. */
  tileAt(state: GameState, view: MainScreenView, px: number, py: number): { x: number; y: number } | null;
  /** Map tile under a point on the main screen's minimap, or null. */
  minimapAt(state: GameState, px: number, py: number): { x: number; y: number } | null;
  /** What lies under a point of the tech tree: an advance, a button, a scroll arrow or the scroll strip. */
  techTreeHit(state: GameState, view: TechTreeView, px: number, py: number): TechTreeHit | null;

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

/** A leader's greeting line, by mood. */
export function leaderLine(state: GameState, player: number): string {
  const p = state.players[player]!;
  const c = civ(p.civ);
  const r = relation(state, state.currentPlayer, player);
  if (r === "war") return `${c.leader} spits: your cities will burn.`;
  const mine = state.units.filter((u) => u.owner === state.currentPlayer).length;
  const theirs = state.units.filter((u) => u.owner === player).length;
  if (theirs > mine * 2) return "Our armies are mighty. Tread carefully.";
  if (mine > theirs * 2) return "We seek only peace with so great a power.";
  return "Greetings. What brings you to our court?";
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
      return { title: `${city.name} builds ${u.name}`, lines: [`{people} ${city.name} gave one of its people to them.`, `{shield} More ${u.name} shrink it again: pick what to build next.`] };
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
  const defence = r.defense === 1 ? "" : `  {tower} +${Math.round((r.defense - 1) * 100)}%`;
  lines.push(`{food} ${yld.food}  {shield} ${yld.shields}  {trade} ${yld.trade}  {boot} ${r.moveCost}${defence}`);
  const features = [
    t.special && r.special && `{star} ${r.special.name}`,
    t.river && "{river} River",
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
    if (work.length) lines.push(`Settlers:  ${work.join("  ")}`);
  }
  if (city) lines.push(`{city} ${city.name} (${state.players[city.owner]!.name}), size ${city.size}`);
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
  return { title: `${TERRAIN_NAMES[t.terrain]}${t.river ? " (River)" : ""}`, lines };
}

/** Colour slots (see CIV_COLORS in core); renderers map each slot to their own palette. */
export const PLAYER_COLOR_SLOTS = CIV_COLORS.length;
export function playerSlot(color: number): number {
  return ((color % PLAYER_COLOR_SLOTS) + PLAYER_COLOR_SLOTS) % PLAYER_COLOR_SLOTS;
}
