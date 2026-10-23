import type { AdvisorKind, CityScreenView, MainScreenView, MenuState, Renderer, TextInputState } from "@civ/renderer-api";
import {
  cityButtonAt,
  cityExitHit,
  citySlotAt,
  cityUnitAt,
  cityViewAt,
  drawCityScreen,
  drawCityView,
  diplomacyChoiceAt,
  drawDiplomacyScreen,
  AUDIENCE_PICTURE,
  drawNewTech,
  NEW_TECH_PICTURE,
  newTechHit,
  drawDomesticAdvisor,
  drawEndScreen,
  drawForeignAdvisor,
  drawMainScreen,
  drawMenu,
  squarePainter,
  drawMilitaryAdvisor,
  drawRatesScreen,
  drawScienceScreen,
  drawScoreScreen,
  drawSpaceshipScreen,
  drawStatusLine,
  drawResearch,
  drawTextInput,
  drawTitleScreen,
  drawSetupScreen,
  setupCardAt,
  setupPictureSpots,
  menuHit,
  menuRows,
  menuScrollAt,
  minimapSquare,
  PALETTE_RGBA,
  panOffset,
  SCREEN_H,
  SCREEN_W,
  Surface,
  RESEARCH_LIST_ROWS,
  researchHit,
  statusPanelAt,
  TILE,
  VIEW_TILES_X,
  VIEW_TILES_Y,
  VIEW_H,
  VIEW_W,
  VIEW_X,
  VIEW_Y,
  drawReportScreen,
  drawWorldMap,
  menuBarAnchor,
  menuBarHit,
  DETAIL,
} from "@civ/renderer-retro";
import { wrapX, type GameState } from "@civ/core";
import { portraitPlace, preloadScenes, preloadTech, scenePlace, showPictures, techPlace, type PicturePlace } from "./pictures.js";

/**
 * The 1991-style renderer behind the screen API: an indexed framebuffer laid out on 320x200,
 * its terrain twice as fine (640x400 canvas pixels), blitted through the palette.
 */
export function createRetroRenderer(canvas: HTMLCanvasElement): Renderer {
  const ctx = canvas.getContext("2d", { alpha: false })!;
  const screen = Surface.screen();
  const image = ctx.createImageData(screen.fw, screen.fh);
  /** The user's pictures this frame shows (`showPictures` lays them over the canvas as the frame is presented). */
  let pictures: PicturePlace[] = [];
  const screenBox = { logicalW: SCREEN_W, logicalH: SCREEN_H };
  return {
    id: "retro",
    width: SCREEN_W,
    height: SCREEN_H,
    density: DETAIL,
    viewTilesX: VIEW_TILES_X,
    viewTilesY: VIEW_TILES_Y,
    mapView: { x: VIEW_X, y: VIEW_Y, width: VIEW_W, height: VIEW_H },
    researchListRows: RESEARCH_LIST_ROWS,
    beginFrame() {
      pictures = [];
    },
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
      showPictures(canvas, pictures);
    },
    title: (at) => drawTitleScreen(screen, at),
    setup: (cards, selected, at) => {
      drawSetupScreen(screen, cards, selected, at);
      for (const { portrait, ...box } of setupPictureSpots(cards, selected)) pictures.push(portraitPlace(portrait, { ...box, ...screenBox }));
    },
    setupHit: (cards, px, py) => setupCardAt(cards, px, py),
    main: (state, view) => {
      drawMainScreen(screen, state, view);
      preloadTech(state.players[state.currentPlayer]?.researching);
    },
    city: (state, view: CityScreenView) => drawCityScreen(screen, state, view),
    cityView: (state, view) => drawCityView(screen, state, view),
    research: (state, view) => drawResearch(screen, state, view),
    science: (state) => drawScienceScreen(screen, state),
    rates: (state) => drawRatesScreen(screen, state),
    advisor(state, which: AdvisorKind) {
      if (which === "domestic") drawDomesticAdvisor(screen, state);
      else if (which === "military") drawMilitaryAdvisor(screen, state);
      else if (which === "foreign") drawForeignAdvisor(screen, state);
      else drawScoreScreen(screen, state);
    },
    diplomacy: (state, view) => {
      drawDiplomacyScreen(screen, state, view);
      // The leader's picture as it is, over the room the screen leaves for it.
      const scene = scenePlace(state, view.player, { ...AUDIENCE_PICTURE, ...screenBox });
      if (scene) pictures.push(scene);
    },
    diplomacyChoiceAt: (view, px, py) => diplomacyChoiceAt(view, px, py),
    newTech: (state, view) => {
      drawNewTech(screen, state, view);
      // The advance's picture as it is, in its frame.
      const picture = techPlace(view.advance, { ...NEW_TECH_PICTURE, ...screenBox });
      if (picture) pictures.push(picture);
    },
    newTechHit: (view, px, py) => newTechHit(view, px, py),
    prepare: (state) => preloadScenes(state),
    end: (lines, rank) => drawEndScreen(screen, lines, rank),
    spaceship: (state) => drawSpaceshipScreen(screen, state),
    menu: (menu: MenuState, state) => drawMenu(screen, menu, squarePainter(menu, state)),
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
    researchHit: (state, view, px, py) => researchHit(state, view, px, py),
    statusAt: (state, _view, px, py) => statusPanelAt(state, px, py),
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
