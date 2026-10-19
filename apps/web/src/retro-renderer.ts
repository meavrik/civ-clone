import type { AdvisorKind, CityScreenView, MainScreenView, MenuState, Renderer, TextInputState } from "@civ/renderer-api";
import {
  cityButtonAt,
  cityExitHit,
  citySlotAt,
  cityUnitAt,
  cityViewAt,
  drawCityScreen,
  drawCityView,
  drawDiplomacyScreen,
  drawDomesticAdvisor,
  drawEndScreen,
  drawForeignAdvisor,
  drawMainScreen,
  drawMenu,
  drawMilitaryAdvisor,
  drawRatesScreen,
  drawScienceScreen,
  drawScoreScreen,
  drawSpaceshipScreen,
  drawStatusLine,
  drawTechTree,
  drawTextInput,
  drawTitleScreen,
  menuHit,
  menuRows,
  menuScrollAt,
  minimapSquare,
  PALETTE_RGBA,
  panOffset,
  SCREEN_H,
  SCREEN_W,
  Surface,
  TECH_COLUMNS,
  techTreeHit,
  TILE,
  VIEW_TILES_X,
  VIEW_TILES_Y,
  VIEW_X,
  VIEW_Y,
  drawReportScreen,
  drawWorldMap,
  menuBarAnchor,
  menuBarHit,
} from "@civ/renderer-retro";
import { wrapX, type GameState } from "@civ/core";

/** The 1991-style renderer behind the screen API: a 320x200 indexed framebuffer blitted through the palette. */
export function createRetroRenderer(canvas: HTMLCanvasElement): Renderer {
  const ctx = canvas.getContext("2d", { alpha: false })!;
  const screen = Surface.screen();
  const image = ctx.createImageData(SCREEN_W, SCREEN_H);
  return {
    id: "retro",
    width: SCREEN_W,
    height: SCREEN_H,
    viewTilesX: VIEW_TILES_X,
    viewTilesY: VIEW_TILES_Y,
    techColumns: TECH_COLUMNS,
    beginFrame() {},
    present() {
      const px = image.data;
      const src = screen.data;
      for (let i = 0, j = 0; i < src.length; i++, j += 4) {
        const p = src[i]! * 4;
        px[j] = PALETTE_RGBA[p]!;
        px[j + 1] = PALETTE_RGBA[p + 1]!;
        px[j + 2] = PALETTE_RGBA[p + 2]!;
        px[j + 3] = 255;
      }
      ctx.putImageData(image, 0, 0);
    },
    title: (blink) => drawTitleScreen(screen, blink),
    main: (state, view) => drawMainScreen(screen, state, view),
    city: (state, view: CityScreenView) => drawCityScreen(screen, state, view),
    cityView: (state, view) => drawCityView(screen, state, view),
    techTree: (state, view) => drawTechTree(screen, state, view),
    science: (state) => drawScienceScreen(screen, state),
    rates: (state) => drawRatesScreen(screen, state),
    advisor(state, which: AdvisorKind) {
      if (which === "domestic") drawDomesticAdvisor(screen, state);
      else if (which === "military") drawMilitaryAdvisor(screen, state);
      else if (which === "foreign") drawForeignAdvisor(screen, state);
      else drawScoreScreen(screen, state);
    },
    diplomacy: (state, player, line) => drawDiplomacyScreen(screen, state, player, line),
    end: (lines, rank) => drawEndScreen(screen, lines, rank),
    spaceship: (state) => drawSpaceshipScreen(screen, state),
    menu: (menu: MenuState) => drawMenu(screen, menu),
    textInput: (input: TextInputState, cursorOn) => drawTextInput(screen, input, cursorOn),
    statusLine: (text) => drawStatusLine(screen, text),
    menuHit: (menu, px, py) => menuHit(menu, px, py),
    menuRows: (menu) => menuRows(menu),
    menuScrollAt: (menu, px, py) => menuScrollAt(menu, px, py),
    citySlotAt: (px, py) => citySlotAt(px, py),
    cityExitHit: (px, py) => cityExitHit(px, py),
    cityButtonAt: (px, py) => cityButtonAt(px, py),
    cityUnitAt: (state, view, px, py) => cityUnitAt(state, view, px, py),
    cityViewAt: (state, view, px, py) => cityViewAt(state, view, px, py),
    tileAt(state: GameState, view: MainScreenView, px, py) {
      if (px < VIEW_X || py < VIEW_Y) return null;
      const [ox, oy] = panOffset(view);
      const ty = view.originY + Math.floor((py - VIEW_Y + oy) / TILE);
      if (ty < 0 || ty >= state.map.height) return null;
      return { x: wrapX(state.map, view.originX + Math.floor((px - VIEW_X + ox) / TILE)), y: ty };
    },
    techTreeHit: (state, view, px, py) => techTreeHit(state, view, px, py),
    minimapAt(state: GameState, px, py) {
      if (px >= VIEW_X) return null;
      return minimapSquare(state.map, px, py - (VIEW_Y + 2));
    },
    report: (page) => drawReportScreen(screen, page),
    worldMap: (state) => drawWorldMap(screen, state),
    menuBarHit: (px, py) => menuBarHit(px, py),
    menuBarAnchor: (index) => menuBarAnchor(index),
  };
}
