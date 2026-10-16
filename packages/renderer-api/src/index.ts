import {
  cityAt,
  civ,
  CIV_COLORS,
  CIVS,
  relation,
  Terrain,
  TERRAIN_NAMES,
  TERRAIN_RULES,
  tileYield,
  unitAt,
  unitType,
  wrapX,
  type GameState,
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
}

export interface CityScreenView {
  city: number;
  message?: string | undefined;
}

export interface MenuState {
  title: string;
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

export interface SetupState {
  step: "difficulty" | "opponents" | "civ" | "done";
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
}

// ---- screen logic shared by every renderer -----------------------------------------

export const DIFFICULTIES = ["Chieftain", "Warlord", "Prince", "King", "Emperor"];

export function setupMenu(setup: SetupState): { title: string; items: string[]; selected: number } {
  switch (setup.step) {
    case "difficulty":
      return { title: "Choose your difficulty level", items: DIFFICULTIES, selected: setup.difficulty };
    case "opponents":
      // Civilizations in play, ours included, as in the original: 3 to 7.
      return {
        title: "How many civilizations?",
        items: [3, 4, 5, 6, 7].map((n) => `${n} civilizations`),
        selected: Math.max(0, Math.min(4, setup.opponents - 2)),
      };
    case "civ": {
      const civs = CIVS.filter((c) => c.id !== "barbarians");
      return { title: "Choose your tribe", items: civs.map((c) => c.name), selected: Math.max(0, civs.findIndex((c) => c.id === setup.civ)) };
    }
    default:
      return { title: "", items: [], selected: 0 };
  }
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
    }
  }
  return { title: `${TERRAIN_NAMES[t.terrain]}${t.river ? " (River)" : ""}`, lines };
}

/** Colour slots (see CIV_COLORS in core); renderers map each slot to their own palette. */
export const PLAYER_COLOR_SLOTS = CIV_COLORS.length;
export function playerSlot(color: number): number {
  return ((color % PLAYER_COLOR_SLOTS) + PLAYER_COLOR_SLOTS) % PLAYER_COLOR_SLOTS;
}
