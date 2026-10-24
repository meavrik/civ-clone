import { wrapX, type GameState } from "@civ/core";
import type { AdvisorKind, DiplomacyView, MainScreenView, MenuState, NewTechView, Renderer, SetupCards, TextInputState } from "@civ/renderer-api";
import {
  BAR_H,
  cityButtonAt,
  cityCitizenAt,
  cityFocusAt,
  cityExitHit,
  citySlotAt,
  cityUnitAt,
  cityViewAt,
  DETAIL,
  drawCityScreen,
  drawCityView,
  diplomacyChoiceAt,
  drawDiplomacyScreen,
  AUDIENCE_PICTURE,
  drawNewTech,
  NEW_TECH_PICTURE,
  newTechHit,
  drawBuilt,
  builtHit,
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
  minimapSquare,
  PALETTE_RGBA,
  panOffset,
  RESEARCH_LIST_ROWS,
  researchHit,
  SCREEN_H,
  SCREEN_W,
  statusPanelAt,
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
}

export const shown: Shown = { wide: false };

/** Where a 320x200 screen stands on the wide one. */
function inset(): number {
  return Math.floor((screenW() - SCREEN_W) / 2);
}

/** A point on the phone's screen as a point of the 320x200 screen shown, when one is. */
export function narrowPoint(px: number, py: number): [number, number] {
  return shown.wide ? [px, py] : [px - inset(), py];
}

/** The menu a tap on our unit opens (its orders) goes just above that unit, not in the middle. */
let ordersFor: number | null = null;
const ordersOf = new WeakMap<MenuState, number>();
const placed = new WeakMap<MenuState, MenuState>();

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
  const pos = tileToScreen(state!, drawn, u.x, u.y, viewAcross(W));
  if (!pos) return m;
  const z = Math.max(1, drawn.zoom ?? 1);
  const sx = VIEW_X + (pos[0] - VIEW_X) * z;
  const sy = VIEW_Y + (pos[1] - VIEW_Y) * z;
  const size = TILE * z;
  const { right: _keys, ...plain } = m;
  const r = menuRect({ ...plain, anchor: { x: 0, y: 0 } }, W);
  const x = Math.max(0, Math.min(W - r.w, Math.round(sx + size / 2 - r.w / 2)));
  const above = sy - r.h - 2;
  const y = Math.max(0, Math.min(SCREEN_H - r.h, above >= BAR_H ? above : sy + size + 2));
  const out = { ...plain, anchor: { x, y } };
  placed.set(m, out);
  return out;
}

export function createRetroRenderer(canvas: HTMLCanvasElement): Renderer {
  const ctx = canvas.getContext("2d", { alpha: false })!;
  const narrow = Surface.screen();
  let wide = new Surface(screenW(), SCREEN_H, undefined, DETAIL);
  let image = ctx.createImageData(wide.fw, wide.fh);
  let wideFrame = false;
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
  const menuOf = (m: MenuState) => placed.get(m) ?? m;
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
      shown.input = undefined;
      wideFrame = false;
      if (wide.width !== screenW()) {
        wide = new Surface(screenW(), SCREEN_H, undefined, DETAIL);
        image = ctx.createImageData(wide.fw, wide.fh);
      }
    },
    present() {
      shown.wide = wideFrame;
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
    title: screen((s, at: number) => drawTitleScreen(s, at)),
    setup: screen((s, cards: SetupCards, selected: number, at: number) => {
      drawSetupScreen(s, cards, selected, at);
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
    city: screen(drawCityScreen),
    cityView: screen(drawCityView),
    research: screen(drawResearch),
    science: screen(drawScienceScreen),
    rates: screen(drawRatesScreen),
    advisor: screen((s, state: GameState, which: AdvisorKind) => {
      if (which === "domestic") drawDomesticAdvisor(s, state);
      else if (which === "military") drawMilitaryAdvisor(s, state);
      else if (which === "foreign") drawForeignAdvisor(s, state);
      else drawScoreScreen(s, state);
    }),
    diplomacy: screen((s, state: GameState, view: DiplomacyView) => {
      drawDiplomacyScreen(s, state, view);
      // The leader's picture as it is, over the room the screen leaves for it (the screen in the middle).
      const scene = scenePlace(state, view.player, onScreen(AUDIENCE_PICTURE));
      if (scene) pictures.push(scene);
    }),
    diplomacyChoiceAt: (view, px, py) => diplomacyChoiceAt(view, px - inset(), py),
    newTech: screen((s, state: GameState, view: NewTechView) => {
      drawNewTech(s, state, view);
      const picture = techPlace(view.advance, onScreen(NEW_TECH_PICTURE));
      if (picture) pictures.push(picture);
    }),
    newTechHit: (view, px, py) => newTechHit(view, px - inset(), py),
    built: screen(drawBuilt),
    builtHit: (view, px, py) => builtHit(view, px - inset(), py),
    prepare: (state) => preloadScenes(state),
    end: screen(drawEndScreen),
    spaceship: screen(drawSpaceshipScreen),
    report: screen(drawReportScreen),
    worldMap: screen(drawWorldMap),
    // Overlays go on whatever screen this frame drew.
    menu: (m, state) => drawMenu(surface(), wideFrame ? place(m) : m, squarePainter(m, state)),
    textInput(input, cursorOn) {
      shown.input = input;
      drawTextInput(surface(), input, cursorOn);
    },
    statusLine: (text) => drawStatusLine(surface(), text),
    menuHit: (m, px, py) => (shown.wide ? menuHit(menuOf(m), px, py, screenW()) : menuHit(m, px - inset(), py)),
    menuRows: (m) => menuRows(m),
    menuScrollAt: (m, px, py) => (shown.wide ? menuScrollAt(menuOf(m), px, py, screenW()) : menuScrollAt(m, px - inset(), py)),
    citySlotAt: (px, py) => citySlotAt(px - inset(), py),
    cityExitHit: (px, py) => cityExitHit(px - inset(), py),
    cityButtonAt: (px, py) => cityButtonAt(px - inset(), py),
    cityUnitAt: (state, view, px, py) => cityUnitAt(state, view, px - inset(), py),
    cityCitizenAt: (state, view, px, py) => cityCitizenAt(state, view, px - inset(), py),
    cityFocusAt: (px, py) => cityFocusAt(px - inset(), py),
    cityViewAt: (state, view, px, py) => cityViewAt(state, view, px - inset(), py),
    researchHit: (state, view, px, py) => researchHit(state, view, px - inset(), py),
    // The map's screen: the panel at the left and the bar along the top, as on the original's.
    tileAt(state, view, px, py) {
      const v = view === shown.view && shown.drawn ? shown.drawn : view;
      return squareAt(state, v, px, py);
    },
    statusAt: (state, _view, px, py) => statusPanelAt(state, px, py),
    minimapAt(state, px, py) {
      if (px >= VIEW_X) return null;
      return minimapSquare(state.map, px, py - (VIEW_Y + 2));
    },
    menuBarHit: (px, py) => menuBarHit(px, py),
    menuBarAnchor: (index) => menuBarAnchor(index),
  };
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
