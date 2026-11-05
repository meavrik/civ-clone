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
  diplomacyPicture,
  LEADER_PORTRAITS,
  ratesHit,
  drawNewTech,
  newTechPicture,
  newTechHit,
  drawAdvanceInfo,
  advanceInfoHit,
  advanceInfoPicture,
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
  menuBox,
  menuPortrait,
  squarePainter,
  drawMilitaryAdvisor,
  drawRatesScreen,
  drawScienceScreen,
  drawScoreScreen,
  drawResourcesAdvisor,
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
  menuTabAt,
  menuInfoAt,
  menuTipAt,
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
  MAP_TILE,
  setMapTile,
  TILE,
  tileToScreen,
  zoomButtonAt,
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
import { buildingPlaces, portraitPlace, preloadBuildings, preloadCities, preloadScenes, preloadTech, preloadUnits, scenePlace, showPictures, techPlace, underWindow, type PicturePlace } from "./pictures.js";

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
  // A trial of bigger map squares (`MAP_TILE`, 2026-11-02): 20 pixels a side unless the page asks otherwise (?tile=16, the original's; 24, 32).
  const baseTile = Math.max(TILE, Number(new URLSearchParams(location.search).get("tile")) || 20);
  /**
   * The map at its zoom (asked for 2026-11-02: "zoom now is too big - reduce"): `MainScreenView.zoom` is the size of its
   * squares against the base's (0.8, 1 or 1.2), each size worked out as it is drawn (`MAP_TILE`), never blown up.
   */
  const sized = (view: MainScreenView): MainScreenView => {
    setMapTile(baseTile * (view.zoom ?? 1));
    return view.zoom === undefined ? view : { ...view, zoom: undefined };
  };
  setMapTile(baseTile);
  return {
    id: "retro",
    width: SCREEN_W,
    height: SCREEN_H,
    density: DETAIL,
    // Counted at the base size: the web app divides them by its zoom.
    viewTilesX: Math.ceil(VIEW_W / baseTile),
    viewTilesY: Math.ceil(VIEW_H / baseTile),
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
      drawMainScreen(screen, state, sized(view));
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
      else if (which === "resources") drawResourcesAdvisor(screen, state);
      else drawScoreScreen(screen, state);
    },
    diplomacy: (state, view) => {
      drawDiplomacyScreen(screen, state, view);
      // The leader's picture as it is, over the room the window leaves for it, growing with the window as it opens: the palace, or on a civilization's card the portrait.
      const box = { ...diplomacyPicture(view), ...screenBox };
      const scene = view.card ? portraitPlace(LEADER_PORTRAITS[civ(state.players[view.player]!.civ).id] ?? "king", box) : scenePlace(state, view.player, box);
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
    advanceInfo: (state, view) => {
      drawAdvanceInfo(screen, state, view);
      // The advance's picture as it is, in its frame, once the window stands whole.
      const picture = (view.enter ?? 1) >= 1 ? techPlace(view.advance, { ...advanceInfoPicture(), ...screenBox }) : null;
      if (picture) pictures.push(picture);
    },
    advanceInfoHit: (view, px, py) => advanceInfoHit(view, px, py),
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
    menu: (menu: MenuState, state) => {
      drawMenu(screen, menu, squarePainter(menu, state));
      if (menu.overWindow) pictures = underWindow(pictures, menuBox(menu));
      const portrait = menuPortrait(menu);
      if (portrait) pictures.push(portraitPlace(menu.portrait!, { ...portrait, ...screenBox }));
    },
    textInput: (input: TextInputState, cursorOn) => drawTextInput(screen, input, cursorOn),
    statusLine: (text) => drawStatusLine(screen, text),
    menuHit: (menu, px, py) => menuHit(menu, px, py),
    menuRows: (menu) => menuRows(menu),
    menuScrollAt: (menu, px, py) => menuScrollAt(menu, px, py),
    menuTabAt: (menu, px, py) => menuTabAt(menu, px, py),
    menuInfoAt: (menu, px, py) => menuInfoAt(menu, px, py),
    menuTipAt: (menu, px, py) => menuTipAt(menu, px, py),
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
    // At the map's zoom (`sized`): a square wholly off the view has none.
    squareRect(state: GameState, view: MainScreenView, x, y) {
      const p = tileToScreen(state, sized(view), x, y);
      if (!p) return null;
      const r = { x: p[0], y: p[1], w: MAP_TILE, h: MAP_TILE };
      return r.x < VIEW_X + VIEW_W && r.y < VIEW_Y + VIEW_H ? r : null;
    },
    tileAt(state: GameState, view: MainScreenView, px, py) {
      view = sized(view);
      if (px < VIEW_X || py < VIEW_Y) return null;
      const [ox, oy] = panOffset(view);
      const ty = view.originY + Math.floor((py - VIEW_Y + oy) / MAP_TILE);
      if (ty < 0 || ty >= state.map.height) return null;
      return { x: wrapX(state.map, view.originX + Math.floor((px - VIEW_X + ox) / MAP_TILE)), y: ty };
    },
    researchHit: (state, view, px, py) => researchHit(state, view, px, py),
    statusAt: (state, view, px, py) => statusPanelAt(state, px, py, view),
    statusPartAt: (state, view, px, py) => statusPartAt(state, px, py, view),
    minimapButtonAt: (state, px, py) => minimapButtonAt(state, px, py),
    zoomButtonAt: (view, px, py) => zoomButtonAt(view, px, py),
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
