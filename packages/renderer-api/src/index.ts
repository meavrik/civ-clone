import type { BattleFrame, UnitMotion } from "./motion.js";
export * from "./motion.js";
import {
  cityAt,
  civ,
  CIV_COLORS,
  CIVS,
  hasContact,
  maxHp,
  WONDERS,
  nativeCivs,
  PREMADE_WORLDS,
  premadeWorld,
  relation,
  Terrain,
  TERRAIN_NAMES,
  TERRAIN_RULES,
  tileYield,
  unitAt,
  unitType,
  wrapX,
  type GameState,
  type MapGenOptions,
  type NewGameOptions,
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
}

export interface CityScreenView {
  city: number;
  message?: string | undefined;
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
}

export interface TextInputState {
  title: string;
  text: string;
  maxLength: number;
}

export const TEXT_INPUT_MAX = 14;

export type AdvisorKind = "domestic" | "military" | "foreign" | "score";

/** The menu bar across the top of the map screen, as in the original. */
export const MENU_BAR = ["Game", "Orders", "Advisors", "World"] as const;

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
  step: "world" | "starts" | "landMass" | "temperature" | "climate" | "age" | "difficulty" | "opponents" | "civ" | "done";
  /** Premade world id, or null for a generated world. */
  world: string | null;
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

  /** Called once per frame before any screen is drawn. */
  beginFrame(): void;
  /** Called once per frame after drawing; pushes the frame to the display. */
  present(): void;

  title(blink: boolean): void;
  main(state: GameState, view: MainScreenView): void;
  city(state: GameState, view: CityScreenView): void;
  discovery(state: GameState, advance: string): void;
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
  /** Radius slot under a point on the city screen's resource map, or null. */
  citySlotAt(px: number, py: number): number | null;
  /** True when the point is on the city screen's exit bar. */
  cityExitHit(px: number, py: number): boolean;
  /** Map tile under a point in the main screen's viewport, or null. */
  tileAt(state: GameState, view: MainScreenView, px: number, py: number): { x: number; y: number } | null;
  /** Map tile under a point on the main screen's minimap, or null. */
  minimapAt(state: GameState, px: number, py: number): { x: number; y: number } | null;

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

/** Tribes offered at setup: on a premade world with homelands, only the civilizations native to it. */
export function setupCivs(setup: SetupState): string[] {
  if (setup.world && setup.historical) return nativeCivs(premadeWorld(setup.world));
  return CIVS.filter((c) => c.id !== "barbarians").map((c) => c.id);
}

/** Most civilizations the setup can seat, ours included: one per colour among those offered, at most 7 as in the original. */
export function setupMaxCivs(setup: SetupState): number {
  return Math.max(3, Math.min(7, new Set(setupCivs(setup).map((id) => civ(id).color)).size));
}

export function setupMenu(setup: SetupState): { title: string; items: string[]; selected: number } {
  switch (setup.step) {
    case "world":
      return { title: "Choose a world", items: PREMADE_WORLDS.map((w) => w.name), selected: Math.max(0, PREMADE_WORLDS.findIndex((w) => w.id === setup.world)) };
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
      return { title: "Choose your tribe", items: civs.map((id) => civ(id).name), selected: Math.max(0, civs.indexOf(setup.civ)) };
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
      setup.step = "starts";
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

/** Rival civilizations for the n-th choice of the "How many civilizations?" menu. */
export function opponentsForChoice(index: number): number {
  return Math.max(2, Math.min(6, index + 2));
}

/**
 * What the current player knows about a map square, for the terrain
 * information window: yields under their government, movement and
 * defence, specials and improvements, what settlers could do there, and
 * the city and units on it. Plain ASCII so every font can draw it.
 */
export function terrainInfo(state: GameState, x: number, y: number): { title: string; lines: string[] } {
  const me = state.players[state.currentPlayer]!;
  const { map } = state;
  const idx = y * map.width + wrapX(map, x);
  if (y < 0 || y >= map.height || !me.explored[idx]) return { title: "Unexplored", lines: ["Our explorers have not seen this land."] };
  const t = map.tiles[idx]!;
  const r = TERRAIN_RULES[t.terrain];
  const city = cityAt(state, x, y);
  const yld = tileYield(state, t, city !== undefined, me.government);
  const lines: string[] = [];
  lines.push(`Food ${yld.food}, shields ${yld.shields}, trade ${yld.trade}`);
  lines.push(`Movement cost ${r.moveCost}, defence ${r.defense === 1 ? "normal" : `+${Math.round((r.defense - 1) * 100)}%`}`);
  if (t.special && r.special) lines.push(`Special resource: ${r.special.name}`);
  const improved = [t.railroad ? "Railroad" : t.road && "Road", t.irrigation && "Irrigation", t.mine && "Mine", t.fortress && "Fortress"].filter(Boolean);
  if (improved.length) lines.push(`Improvements: ${improved.join(", ")}`);
  if (t.pollution) lines.push("Polluted: output halved until cleaned.");
  if (t.hut) lines.push("A village of a minor tribe stands here.");
  if (t.terrain !== Terrain.Ocean) {
    const work: string[] = [];
    if (r.irrigate) work.push(r.irrigate.becomes !== undefined ? `irrigate into ${TERRAIN_NAMES[r.irrigate.becomes]}` : `irrigate +${r.irrigate.food ?? 0} food`);
    if (r.mine) work.push(r.mine.becomes !== undefined ? `mine into ${TERRAIN_NAMES[r.mine.becomes]}` : `mine +${r.mine.shields ?? 0} shields`);
    if (r.road.trade > 0) work.push(`road +${r.road.trade} trade`);
    if (work.length) lines.push(`Settlers can ${work.join(", ")}.`);
  }
  if (city) lines.push(`City: ${city.name} (${state.players[city.owner]!.name}), size ${city.size}`);
  if (me.visible[idx]) {
    const units = unitAt(state, x, y);
    if (units.length) {
      const owner = state.players[units[0]!.owner]!;
      const counts = new Map<string, number>();
      for (const u of units) counts.set(unitType(u.type).name, (counts.get(unitType(u.type).name) ?? 0) + 1);
      const names = [...counts].map(([n, k]) => (k > 1 ? `${k} ${n}` : n)).join(", ");
      lines.push(`Units (${owner.id === me.id ? "ours" : owner.name}): ${names}`);
      const hurt = units.filter((u) => u.hp < maxHp(state, u.type));
      if (hurt.length) lines.push(`Wounded: ${hurt.map((u) => `${unitType(u.type).name} ${u.hp}/${maxHp(state, u.type)} hp`).join(", ")}`);
    }
  }
  return { title: `${TERRAIN_NAMES[t.terrain]}${t.river ? " (River)" : ""}`, lines };
}

/** Colour slots (see CIV_COLORS in core); renderers map each slot to their own palette. */
export const PLAYER_COLOR_SLOTS = CIV_COLORS.length;
export function playerSlot(color: number): number {
  return ((color % PLAYER_COLOR_SLOTS) + PLAYER_COLOR_SLOTS) % PLAYER_COLOR_SLOTS;
}
