import { civ, wrapX, type GameState } from "@civ/core";
import { scrollRows } from "./menus.js";
import { reignCard, type AdvisorKind, type CityScreenView, type DiplomacyView, type MainScreenView, type MenuState, type NewTechView, type ReignView, type Renderer, type ResearchView, type SetupCards, type TextInputState } from "@civ/renderer-api";
import {
  BAR_H,
  cityButtonAt,
  cityCitizenAt,
  cityFocusAt,
  cityImprovementAt,
  cityImprovementRows,
  cityBoxAt,
  cityZoomPlace,
  cityZoomPoint,
  drawCityZoom,
  type CityZoom,
  cardPicture,
  LEADER_PORTRAITS,
  ratesHit,
  cityExitHit,
  citySlotAt,
  cityUnitAt,
  cityViewAt,
  DETAIL,
  drawCityScreen,
  drawCityView,
  diplomacyChoiceAt,
  drawDiplomacyScreen,
  audiencePicture,
  diplomacyCloseAt,
  drawNewTech,
  newTechPicture,
  newTechHit,
  drawBuilt,
  builtHit,
  drawConquest,
  conquestHit,
  drawReign,
  reignHit,
  reignPicture,
  drawDomesticAdvisor,
  drawEndScreen,
  drawForeignAdvisor,
  drawMainScreen,
  drawMenu,
  squarePainter,
  drawMilitaryAdvisor,
  drawRatesScreen,
  drawReportScreen,
  drawResearch,
  drawScienceScreen,
  drawScoreScreen,
  drawSpaceshipScreen,
  drawStatusLine,
  drawTextInput,
  drawTitleScreen,
  drawSetupScreen,
  setupCardAt,
  setupPictureSpots,
  drawWorldMap,
  menuBarAnchor,
  menuBarHit,
  menuHit,
  menuRect,
  menuRows,
  menuScrollAt,
  menuRowRect,
  TOUCH_MENU,
  choiceAt,
  choicesFit,
  choicesRect,
  drawChoices,
  drawSetupChoose,
  setupChooseAt,
  ORDER_CHOICES,
  SETUP_CHOICES,
  type ChoiceStyle,
  minimapSquare,
  PALETTE_RGBA,
  panOffset,
  RESEARCH_LIST_ROWS,
  researchHit,
  SCREEN_H,
  SCREEN_W,
  statusPanelAt,
  statusPartAt,
  Surface,
  TILE,
  tileToScreen,
  unzoomPoint,
  viewAcross,
  VIEW_X,
  VIEW_Y,
  zoomedTiles,
} from "@civ/renderer-retro";
import type * as WebRenderer from "../../web/src/retro-renderer.js";
import { screenW } from "./display.js";
import { buildingPlaces, portraitPlace, preloadBuildings, preloadScenes, preloadTech, scenePlace, showPictures, techPlace, type PicturePlace } from "../../web/src/pictures.js";
import { MapPan } from "./pan.js";

/**
 * Stands in for apps/web/src/retro-renderer.ts (vite.config.ts swaps it in): the same retro
 * screens, but the map's screen as wide as the phone (`screenW`: the panel at the left, the map
 * filling the rest, the menu bar across), drawn and hit-tested where a finger has dragged it and
 * as large as a pinch has zoomed it. Every other screen keeps the original's 320x200, in the
 * middle; the menus and prompts over the map centre on the whole width. What the last frame showed
 * is kept for the touch layer.
 */
export const pan = new MapPan();

/** Logical pixels across a map square, unzoomed. */
export const TILE_PX = TILE;

/** The map's zoom levels, whole numbers so the pixels stay square; the level is kept per device. */
export const ZOOMS = [1, 2, 3] as const;
const ZOOM_KEY = "epochs.mobile.zoom";
let zoom: number = (() => {
  try {
    const z = Number(localStorage.getItem(ZOOM_KEY));
    return (ZOOMS as readonly number[]).includes(z) ? z : 1;
  } catch {
    return 1;
  }
})();

export function mapZoom(): number {
  return zoom;
}

/**
 * Zoom the map, the square under logical point `at` (the pinch's middle) staying under it: the
 * view moves by the pan, so the game's own camera never changes for a zoom.
 */
export function setMapZoom(z: number, at: [number, number]): void {
  if (z === zoom) return;
  const ax = Math.max(0, at[0] - VIEW_X) / TILE;
  const ay = Math.max(0, at[1] - VIEW_Y) / TILE;
  pan.grab();
  pan.drag(ax / zoom - ax / z, ay / zoom - ay / z);
  pan.drop();
  zoom = z;
  try { localStorage.setItem(ZOOM_KEY, String(z)); } catch { /* private mode */ }
}

interface Shown {
  state?: GameState;
  /** The game's view of the map, and the view drawn (moved by the pan, zoomed). */
  view?: MainScreenView;
  drawn?: MainScreenView;
  /** The text the game is asking for, when this frame shows the prompt. */
  input?: TextInputState | undefined;
  /** The last frame was the map's wide screen (else a 320x200 screen in the middle). */
  wide: boolean;
  /** The last frame was the title screen (the starting game's questions stand over it as large buttons). */
  title: boolean;
  /** The setup question the last frame showed as cards, with its Choose button. */
  setup?: SetupCards | undefined;
  /** The city screen the last frame showed, as the game handed it (the touch layer asks what a tap there would hit). */
  city?: CityScreenView | undefined;
}

export const shown: Shown = { wide: false, title: false };

/** Where a 320x200 screen stands on the wide one. */
function inset(): number {
  return Math.floor((screenW() - SCREEN_W) / 2);
}

/** A point on the phone's screen as a point of the 320x200 screen shown, when one is. */
export function narrowPoint(px: number, py: number): [number, number] {
  return shown.wide ? [px, py] : [px - inset(), py];
}

/**
 * The city screen's box shown enlarged over the rest (asked for 2026-10-27: "on mobile only - inside the
 * city view - when click on a box area - enlarge it to see it bigger"; `drawCityZoom`): a tap on a box
 * opens it, a tap off it (or on its close box) closes it, and taps on it reach its controls. It closes by
 * itself once the city screen is gone.
 */
let cityZoom: { city: number; zoom: CityZoom } | null = null;
let cityDrawn = false;

/** A box of the city screen is shown enlarged. */
export function cityZoomed(): boolean {
  return cityZoom !== null;
}

/** On the city screen with no box enlarged, enlarge the box under logical point (px, py); false off the boxes. */
export function zoomCityAt(px: number, py: number): boolean {
  const view = shown.city;
  if (!view || cityZoom || shown.wide) return false;
  const box = cityBoxAt(px - inset(), py);
  if (!box) return false;
  cityZoom = { city: view.city, zoom: cityZoomPlace(box, screenW()) };
  return true;
}

export function closeCityZoom(): void {
  cityZoom = null;
}

/** A logical point of the phone's screen as the city screen's own point: through the enlarged box when one is shown (off it, none). */
function cityPoint(px: number, py: number): [number, number] {
  if (!cityZoom || !shown.wide) return [px - inset(), py];
  return cityZoomPoint(cityZoom.zoom, px, py) ?? [-1, -1];
}

/** The point is on the enlarged box. */
export function inCityZoom(px: number, py: number): boolean {
  return cityZoom !== null && cityZoomPoint(cityZoom.zoom, px, py) !== null;
}

/**
 * Something of the city screen answers a tap at logical point (px, py): a button, a citizen, a unit, an
 * improvement, a square of its map. The game leaves the city on a click that hits nothing, which a tap
 * on an enlarged box must not do.
 */
export function cityAnswersAt(px: number, py: number): boolean {
  const { state, city: view } = shown;
  if (!state || !view) return false;
  const [x, y] = cityPoint(px, py);
  if (x < 0) return false;
  return cityExitHit(x, y) || cityFocusAt(x, y) !== null || cityButtonAt(x, y) !== null || cityUnitAt(state, view, x, y) !== null
    || cityCitizenAt(state, view, x, y) !== null || cityImprovementAt(state, view, x, y) !== null || citySlotAt(x, y) !== null;
}

/** How many times its size the city screen's enlarged box stands (1 with none): a finger scrolling its list moves that much further a line. */
export function cityZoomScale(): number {
  return cityZoom?.zoom.scale ?? 1;
}

/**
 * How a menu is drawn on the phone (asked for 2026-10-25): a unit's orders as a grid of buttons over the
 * unit (`ORDER_CHOICES`), the starting game's questions over the title screen as large buttons
 * (`SETUP_CHOICES`), when they fit; any other menu as rows sized for a finger (`TOUCH_MENU`).
 */
type Shape = { menu: MenuState; style: ChoiceStyle | null; screenW: number; dx: number };

/** The shape a menu took as last drawn (an orders menu where it stands over its unit). */
function shapeOf(m: MenuState): Shape {
  if (shown.wide) {
    const at = placed.get(m) ?? m;
    return { menu: at, style: asChoices.has(at) ? ORDER_CHOICES : null, screenW: screenW(), dx: 0 };
  }
  const style = shown.title && choicesFit(m, SCREEN_W, SETUP_CHOICES) ? SETUP_CHOICES : null;
  return { menu: m, style, screenW: SCREEN_W, dx: inset() };
}

/** How many of a menu's rows show at once, as last drawn: all of them as buttons. */
function shownMenuRows(m: MenuState): number {
  const sh = shapeOf(m);
  return sh.style ? m.items.length : menuRows(sh.menu, sh.screenW, TOUCH_MENU);
}

/** Whether a point of the phone's screen is on the setup cards' Choose button, as last drawn. */
export function chooseAt(px: number, py: number): boolean {
  return !shown.wide && shown.setup !== undefined && setupChooseAt(shown.setup, px - inset(), py);
}

/** A finger dragging a list too long for its window: its rows on view move `by` (`scrollRows`). */
export function scrollMenu(m: MenuState, by: number): void {
  scrollRows(m, by, shownMenuRows(m));
}

/** The menu a tap on our unit opens (its orders) goes just above that unit, not in the middle. */
let ordersFor: number | null = null;
const ordersOf = new WeakMap<MenuState, number>();
const placed = new WeakMap<MenuState, MenuState>();
/** The placed orders menus drawn as buttons (`ORDER_CHOICES`), not rows. */
const asChoices = new WeakSet<MenuState>();

/** The next menu the game opens holds this unit's orders: draw it beside the unit (null: no such menu came). */
export function ordersAbove(unit: number | null): void {
  ordersFor = unit;
}

/** The menu as drawn: an orders menu anchored over its unit, without the keys a phone has not got. */
function place(m: MenuState): MenuState {
  if (ordersFor !== null && !ordersOf.has(m)) {
    ordersOf.set(m, ordersFor);
    ordersFor = null;
  }
  const unit = ordersOf.get(m);
  const { state, drawn } = shown;
  const u = unit !== undefined && state ? state.units.find((o) => o.id === unit) : undefined;
  if (!u || !drawn) return m;
  const W = screenW();
  const sq = squareOnScreen(state!, drawn, u.x, u.y);
  if (!sq) return m;
  const { x: sx, y: sy, w: size } = sq;
  const { right: _keys, ...plain } = m;
  // Its orders as buttons where they fit (two or three across), else as rows.
  const grid = choicesRect({ ...plain, anchor: { x: 0, y: 0 } }, W, ORDER_CHOICES);
  const r = grid ?? menuRect({ ...plain, anchor: { x: 0, y: 0 } }, W, TOUCH_MENU);
  // Above the unit, else below it, else beside it, so the unit stays in sight.
  const above = sy - r.h - 2;
  const below = sy + size + 2;
  let x = Math.round(sx + size / 2 - r.w / 2);
  let y: number;
  if (above >= BAR_H) y = above;
  else if (below + r.h <= SCREEN_H) y = below;
  else {
    y = Math.round(sy + size / 2 - r.h / 2);
    x = sx + size + 2 + r.w <= W ? sx + size + 2 : sx - 2 - r.w;
  }
  x = Math.max(0, Math.min(W - r.w, x));
  y = Math.max(BAR_H, Math.min(SCREEN_H - r.h, y));
  const out = { ...plain, anchor: { x, y } };
  placed.set(m, out);
  if (grid) asChoices.add(out);
  return out;
}

export function createRetroRenderer(canvas: HTMLCanvasElement): Renderer {
  const ctx = canvas.getContext("2d", { alpha: false })!;
  const narrow = Surface.screen();
  let wide = new Surface(screenW(), SCREEN_H, undefined, DETAIL);
  let image = ctx.createImageData(wide.fw, wide.fh);
  let wideFrame = false;
  /** This frame drew the title screen, and (a setup question as cards) its Choose button's cards. */
  let titleFrame = false;
  let setupFrame: SetupCards | undefined;
  /** The user's pictures this frame shows (`showPictures` lays them over the canvas as the frame is presented). */
  let pictures: PicturePlace[] = [];
  /** A box of the 320x200 screen, in the middle of the wide canvas. */
  const onScreen = (b: { x: number; y: number; w: number; h: number }) => ({ ...b, x: b.x + inset(), logicalW: screenW(), logicalH: SCREEN_H });
  const surface = () => (wideFrame ? wide : narrow);
  /** A 320x200 screen: drawn as the web game draws it. */
  const screen = <A extends unknown[]>(draw: (s: Surface, ...args: A) => void) => (...args: A) => {
    wideFrame = false;
    draw(narrow, ...args);
  };
  return {
    id: "retro",
    get width() {
      return screenW();
    },
    height: SCREEN_H,
    density: DETAIL,
    // The squares in view: as many across as the wide map holds, fewer as the zoom grows, so the game
    // centres and follows its units in what shows.
    get viewTilesX() {
      return Math.floor((screenW() - VIEW_X) / (TILE * zoom));
    },
    get viewTilesY() {
      return zoomedTiles(zoom).y;
    },
    researchListRows: RESEARCH_LIST_ROWS,
    beginFrame() {
      pictures = [];
      narrow.art = [];
      wide.art = [];
      narrow.dimmed = false;
      wide.dimmed = false;
      shown.input = undefined;
      wideFrame = false;
      titleFrame = false;
      setupFrame = undefined;
      cityDrawn = false;
      if (wide.width !== screenW()) {
        wide = new Surface(screenW(), SCREEN_H, undefined, DETAIL);
        image = ctx.createImageData(wide.fw, wide.fh);
      }
    },
    present() {
      shown.wide = wideFrame;
      shown.title = titleFrame;
      shown.setup = setupFrame;
      // The enlarged box goes with the city screen.
      if (!cityDrawn) { cityZoom = null; shown.city = undefined; }
      const px = image.data;
      const paint = (j: number, c: number) => {
        const p = c * 4;
        px[j] = PALETTE_RGBA[p]!;
        px[j + 1] = PALETTE_RGBA[p + 1]!;
        px[j + 2] = PALETTE_RGBA[p + 2]!;
        px[j + 3] = 255;
      };
      if (wideFrame) {
        const src = wide.data;
        for (let i = 0; i < src.length; i++) paint(i * 4, src[i]!);
      } else {
        // The 320x200 screen in the middle, black either side.
        px.fill(0);
        for (let j = 3; j < px.length; j += 4) px[j] = 255;
        const off = inset() * narrow.k;
        for (let y = 0; y < narrow.fh; y++)
          for (let x = 0; x < narrow.fw; x++) paint((y * wide.fw + off + x) * 4, narrow.data[y * narrow.fw + x]!);
      }
      ctx.putImageData(image, 0, 0);
      // The building pictures the frame's screen left spots for: the wide map's, or the 320x200 one's in the middle.
      const spots = buildingPlaces(surface().art, { dx: wideFrame ? 0 : inset(), logicalW: screenW(), logicalH: SCREEN_H });
      showPictures(canvas, [...pictures, ...spots]);
    },
    title: screen((s, at: number) => {
      titleFrame = true;
      drawTitleScreen(s, at);
    }),
    setup: screen((s, cards: SetupCards, selected: number, at: number) => {
      drawSetupScreen(s, cards, selected, at);
      // No pointer lights the cards on a phone: a tap lights one, Choose (or a second tap) picks it.
      drawSetupChoose(s, cards);
      setupFrame = cards;
      for (const { portrait, ...box } of setupPictureSpots(cards, selected)) pictures.push(portraitPlace(portrait, onScreen(box)));
    }),
    setupHit: (cards, px, py) => setupCardAt(cards, px - inset(), py),
    main(state, view) {
      wideFrame = true;
      const moved = pan.shift(view, state.map, zoomedTiles(zoom).y, state.activeUnit, performance.now());
      const drawn = zoom > 1 ? { ...moved, zoom } : moved;
      shown.state = state;
      shown.view = view;
      shown.drawn = drawn;
      drawMainScreen(wide, state, drawn);
      preloadTech(state.players[state.currentPlayer]?.researching);
      preloadBuildings(state);
    },
    // The city screen, and over it the box a tap enlarged, on the wide screen (menus then open over both).
    city: (state: GameState, view: CityScreenView) => {
      wideFrame = false;
      cityDrawn = true;
      shown.city = view;
      if (cityZoom && cityZoom.city !== view.city) cityZoom = null;
      drawCityScreen(narrow, state, view);
      if (!cityZoom) return;
      if (cityZoom.zoom.x + cityZoom.zoom.w > screenW()) cityZoom.zoom = cityZoomPlace(cityZoom.zoom.box, screenW());
      wideFrame = true;
      drawCityZoom(wide, narrow, cityZoom.zoom, inset());
    },
    cityView: screen(drawCityView),
    // The research panel is a window over whatever is drawn under it (the wide map, or a 320x200 screen), centred on it.
    research: (state: GameState, view: ResearchView) => drawResearch(surface(), state, view),
    science: screen(drawScienceScreen),
    // The rates window opens over whatever is drawn under it (the wide map, or a 320x200 screen), centred on it.
    rates: (state) => drawRatesScreen(surface(), state),
    advisor: screen((s, state: GameState, which: AdvisorKind) => {
      if (which === "domestic") drawDomesticAdvisor(s, state);
      else if (which === "military") drawMilitaryAdvisor(s, state);
      else if (which === "foreign") drawForeignAdvisor(s, state);
      else drawScoreScreen(s, state);
    }),
    // The audience window opens over whatever is drawn under it (the wide map, or a 320x200 screen), centred on it.
    diplomacy: (state: GameState, view: DiplomacyView) => {
      const s = surface();
      drawDiplomacyScreen(s, state, view);
      // The leader's picture as it is, over the room the window leaves for it once it stands whole: the palace, or on a card the portrait.
      if ((view.enter ?? 1) < 1) return;
      const box = view.card ? cardPicture(s.width) : audiencePicture(s.width);
      const place = wideFrame ? { ...box, logicalW: screenW(), logicalH: SCREEN_H } : onScreen(box);
      const scene = view.card
        ? portraitPlace(LEADER_PORTRAITS[civ(state.players[view.player]!.civ).id] ?? "king", place)
        : scenePlace(state, view.player, place);
      if (scene) pictures.push(scene);
    },
    diplomacyChoiceAt: (view, px, py) => (shown.wide ? diplomacyChoiceAt(view, px, py, screenW()) : diplomacyChoiceAt(view, px - inset(), py)),
    diplomacyCloseAt: (px, py) => (shown.wide ? diplomacyCloseAt(px, py, screenW()) : diplomacyCloseAt(px - inset(), py)),
    // The small windows open over whatever is drawn under them (the wide map, or a 320x200 screen),
    // centred on it.
    newTech: (state: GameState, view: NewTechView) => {
      const s = surface();
      drawNewTech(s, state, view);
      const box = newTechPicture(s.width);
      const picture = (view.enter ?? 1) >= 1 ? techPlace(view.advance, wideFrame ? { ...box, logicalW: screenW(), logicalH: SCREEN_H } : onScreen(box)) : null;
      if (picture) pictures.push(picture);
    },
    newTechHit: (view, px, py) => (shown.wide ? newTechHit(view, px, py, screenW()) : newTechHit(view, px - inset(), py)),
    built: (state, view) => drawBuilt(surface(), state, view),
    builtHit: (view, px, py) => (shown.wide ? builtHit(view, px, py, screenW()) : builtHit(view, px - inset(), py)),
    conquest: (state, view) => drawConquest(surface(), state, view),
    conquestHit: (state, view, px, py) => (shown.wide ? conquestHit(state, view, px, py, screenW()) : conquestHit(state, view, px - inset(), py)),
    reign: (state: GameState, view: ReignView) => {
      const s = surface();
      drawReign(s, state, view);
      const box = reignPicture(s.width);
      if ((view.enter ?? 1) >= 1) pictures.push(portraitPlace(reignCard(state).portrait, wideFrame ? { ...box, logicalW: screenW(), logicalH: SCREEN_H } : onScreen(box)));
    },
    reignHit: (view, px, py) => (shown.wide ? reignHit(view, px, py, screenW()) : reignHit(view, px - inset(), py)),
    prepare: (state) => preloadScenes(state),
    end: screen(drawEndScreen),
    spaceship: screen(drawSpaceshipScreen),
    report: screen(drawReportScreen),
    worldMap: screen(drawWorldMap),
    // Overlays go on whatever screen this frame drew, sized for a finger (`TOUCH_MENU`).
    menu: (m, state) => {
      if (wideFrame) {
        const at = place(m);
        if (asChoices.has(at)) drawChoices(wide, at, ORDER_CHOICES);
        else drawMenu(wide, at, squarePainter(m, state), TOUCH_MENU);
      } else if (titleFrame && choicesFit(m, SCREEN_W, SETUP_CHOICES)) drawChoices(narrow, m, SETUP_CHOICES);
      else drawMenu(narrow, m, squarePainter(m, state), TOUCH_MENU);
    },
    textInput(input, cursorOn) {
      shown.input = input;
      drawTextInput(surface(), input, cursorOn);
    },
    statusLine: (text) => drawStatusLine(surface(), text),
    menuHit: (m, px, py) => {
      const sh = shapeOf(m);
      return sh.style ? choiceAt(sh.menu, px - sh.dx, py, sh.screenW, sh.style) : menuHit(sh.menu, px - sh.dx, py, sh.screenW, TOUCH_MENU);
    },
    menuRows: (m) => shownMenuRows(m),
    menuRowRect: (m, row) => {
      const sh = shapeOf(m);
      const r = sh.style ? null : menuRowRect(sh.menu, row, sh.screenW, TOUCH_MENU);
      return r && { ...r, x: r.x + sh.dx };
    },
    menuScrollAt: (m, px, py) => {
      const sh = shapeOf(m);
      return sh.style ? null : menuScrollAt(sh.menu, px - sh.dx, py, sh.screenW, TOUCH_MENU);
    },
    // The city screen's points, through the enlarged box when one is shown.
    citySlotAt: (px, py) => citySlotAt(...cityPoint(px, py)),
    cityExitHit: (px, py) => cityExitHit(...cityPoint(px, py)),
    cityButtonAt: (px, py) => cityButtonAt(...cityPoint(px, py)),
    cityUnitAt: (state, view, px, py) => cityUnitAt(state, view, ...cityPoint(px, py)),
    cityCitizenAt: (state, view, px, py) => cityCitizenAt(state, view, ...cityPoint(px, py)),
    cityFocusAt: (px, py) => cityFocusAt(...cityPoint(px, py)),
    cityImprovementAt: (state, view, px, py) => cityImprovementAt(state, view, ...cityPoint(px, py)),
    cityImprovementRows: (state) => cityImprovementRows(state),
    ratesHit: (px, py) => (shown.wide ? ratesHit(px, py, screenW()) : ratesHit(px - inset(), py)),
    cityViewAt: (state, view, px, py) => cityViewAt(state, view, px - inset(), py),
    researchHit: (state, view, px, py) => (shown.wide ? researchHit(state, view, px, py, screenW()) : researchHit(state, view, px - inset(), py)),
    // The map's screen: the panel at the left and the bar along the top, as on the original's.
    tileAt(state, view, px, py) {
      const v = view === shown.view && shown.drawn ? shown.drawn : view;
      return squareAt(state, v, px, py);
    },
    squareRect(state, view, x, y) {
      const v = view === shown.view && shown.drawn ? shown.drawn : view;
      return squareOnScreen(state, v, x, y);
    },
    statusAt: (state, view, px, py) => statusPanelAt(state, px, py, view),
    statusPartAt: (state, view, px, py) => statusPartAt(state, px, py, view),
    minimapAt(state, px, py) {
      if (px >= VIEW_X) return null;
      return minimapSquare(state.map, px, py - (VIEW_Y + 2));
    },
    menuBarHit: (px, py) => menuBarHit(px, py),
    menuBarAnchor: (index) => menuBarAnchor(index),
  };
}

/** Where a map square lies on the map's screen, through the pan and the zoom, or null off it. */
function squareOnScreen(state: GameState, view: MainScreenView, x: number, y: number): { x: number; y: number; w: number; h: number } | null {
  const pos = tileToScreen(state, view, x, y, viewAcross(screenW()));
  if (!pos) return null;
  const z = Math.max(1, view.zoom ?? 1);
  return { x: VIEW_X + (pos[0] - VIEW_X) * z, y: VIEW_Y + (pos[1] - VIEW_Y) * z, w: TILE * z, h: TILE * z };
}

/** The map square under a point of the map's screen, through the zoom and the pan. */
function squareAt(state: GameState, view: MainScreenView, px: number, py: number): { x: number; y: number } | null {
  [px, py] = unzoomPoint(view, px, py);
  if (px < VIEW_X || py < VIEW_Y) return null;
  const [ox, oy] = panOffset(view);
  const ty = view.originY + Math.floor((py - VIEW_Y + oy) / TILE);
  if (ty < 0 || ty >= state.map.height) return null;
  return { x: wrapX(state.map, view.originX + Math.floor((px - VIEW_X + ox) / TILE)), y: ty };
}

/** The map square under a logical pixel of the map's screen as last drawn, or null. */
export function tileUnder(px: number, py: number): { x: number; y: number } | null {
  const { state, drawn } = shown;
  return state && drawn ? squareAt(state, drawn, px, py) : null;
}

createRetroRenderer satisfies typeof WebRenderer.createRetroRenderer;
