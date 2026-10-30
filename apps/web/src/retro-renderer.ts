import { reignCard, type AdvisorKind, type CityScreenView, type MainScreenView, type MenuState, type Renderer, type TextInputState } from "@civ/renderer-api";
import {
  cityButtonAt,
  cityCitizenAt,
  cityFocusAt,
  cityImprovementAt,
  cityImprovementRows,
  cityExitHit,
  citySlotAt,
  cityUnitAt,
  cityViewAt,
  drawCityScreen,
  drawCityView,
  diplomacyChoiceAt,
  diplomacyCloseAt,
  drawDiplomacyScreen,
  audiencePicture,
  cardPicture,
  LEADER_PORTRAITS,
  ratesHit,
  drawNewTech,
  newTechPicture,
  newTechHit,
  drawBuilt,
  builtHit,
  drawConquest,
  conquestHit,
  drawReign,
  drawLoading,
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
  menuRowRect,
  minimapSquare,
  minimapButtonAt,
  PALETTE_RGBA,
  panOffset,
  SCREEN_H,
  SCREEN_W,
  Surface,
  RESEARCH_LIST_ROWS,
  researchHit,
  statusPanelAt,
  statusPartAt,
  TILE,
  tileToScreen,
  unzoomPoint,
  viewZoom,
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
import { civ, wrapX, type GameState } from "@civ/core";
import { buildingPlaces, portraitPlace, preloadBuildings, preloadCities, preloadScenes, preloadTech, preloadUnits, scenePlace, showPictures, techPlace, type PicturePlace } from "./pictures.js";

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
      screen.art = [];
      screen.dimmed = false;
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
      showPictures(canvas, [...pictures, ...buildingPlaces(screen.art, { dx: 0, ...screenBox })]);
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
      preloadBuildings(state);
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
      // The leader's picture as it is, over the room the window leaves for it once it stands whole: the palace, or on a civilization's card the portrait.
      if ((view.enter ?? 1) < 1) return;
      const scene = view.card
        ? portraitPlace(LEADER_PORTRAITS[civ(state.players[view.player]!.civ).id] ?? "king", { ...cardPicture(), ...screenBox })
        : scenePlace(state, view.player, { ...audiencePicture(), ...screenBox });
      if (scene) pictures.push(scene);
    },
    diplomacyChoiceAt: (view, px, py) => diplomacyChoiceAt(view, px, py),
    diplomacyCloseAt: (px, py) => diplomacyCloseAt(px, py),
    newTech: (state, view) => {
      drawNewTech(screen, state, view);
      // The advance's picture as it is, in its frame.
      const picture = (view.enter ?? 1) >= 1 ? techPlace(view.advance, { ...newTechPicture(), ...screenBox }) : null;
      if (picture) pictures.push(picture);
    },
    newTechHit: (view, px, py) => newTechHit(view, px, py),
    built: (state, view) => drawBuilt(screen, state, view),
    builtHit: (state, view, px, py) => builtHit(state, view, px, py),
    conquest: (state, view) => drawConquest(screen, state, view),
    conquestHit: (state, view, px, py) => conquestHit(state, view, px, py),
    reign: (state, view) => {
      drawReign(screen, state, view);
      // Our leader's portrait as it is, in its frame, once the window stands whole.
      if ((view.enter ?? 1) >= 1) pictures.push(portraitPlace(reignCard(state).portrait, { ...reignPicture(), ...screenBox }));
    },
    reignHit: (view, px, py) => reignHit(view, px, py),
    prepare: (state) => {
      preloadScenes(state);
      preloadUnits(state);
      preloadCities();
    },
    loading: (view) => drawLoading(screen, view),
    end: (card) => drawEndScreen(screen, card),
    spaceship: (state) => drawSpaceshipScreen(screen, state),
    menu: (menu: MenuState, state) => drawMenu(screen, menu, squarePainter(menu, state)),
    textInput: (input: TextInputState, cursorOn) => drawTextInput(screen, input, cursorOn),
    statusLine: (text) => drawStatusLine(screen, text),
    menuHit: (menu, px, py) => menuHit(menu, px, py),
    menuRows: (menu) => menuRows(menu),
    menuScrollAt: (menu, px, py) => menuScrollAt(menu, px, py),
    menuRowRect: (menu, row) => menuRowRect(menu, row),
    citySlotAt: (px, py) => citySlotAt(px, py),
    cityExitHit: (px, py) => cityExitHit(px, py),
    cityButtonAt: (px, py) => cityButtonAt(px, py),
    cityUnitAt: (state, view, px, py) => cityUnitAt(state, view, px, py),
    cityCitizenAt: (state, view, px, py) => cityCitizenAt(state, view, px, py),
    cityFocusAt: (px, py) => cityFocusAt(px, py),
    cityImprovementAt: (state, view, px, py) => cityImprovementAt(state, view, px, py),
    cityImprovementRows: (state) => cityImprovementRows(state),
    ratesHit: (px, py) => ratesHit(px, py),
    cityViewAt: (state, view, px, py) => cityViewAt(state, view, px, py),
    // Through the map's zoom (`MainScreenView.zoom`): a square wholly off the view as drawn has none.
    squareRect(state: GameState, view: MainScreenView, x, y) {
      const p = tileToScreen(state, view, x, y);
      if (!p) return null;
      const z = viewZoom(view);
      const r = { x: VIEW_X + (p[0] - VIEW_X) * z, y: VIEW_Y + (p[1] - VIEW_Y) * z, w: TILE * z, h: TILE * z };
      return r.x < VIEW_X + VIEW_W && r.y < VIEW_Y + VIEW_H ? r : null;
    },
    tileAt(state: GameState, view: MainScreenView, px, py) {
      [px, py] = unzoomPoint(view, px, py);
      if (px < VIEW_X || py < VIEW_Y) return null;
      const [ox, oy] = panOffset(view);
      const ty = view.originY + Math.floor((py - VIEW_Y + oy) / TILE);
      if (ty < 0 || ty >= state.map.height) return null;
      return { x: wrapX(state.map, view.originX + Math.floor((px - VIEW_X + ox) / TILE)), y: ty };
    },
    researchHit: (state, view, px, py) => researchHit(state, view, px, py),
    statusAt: (state, view, px, py) => statusPanelAt(state, px, py, view),
    statusPartAt: (state, view, px, py) => statusPartAt(state, px, py, view),
    minimapButtonAt: (state, px, py) => minimapButtonAt(state, px, py),
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
