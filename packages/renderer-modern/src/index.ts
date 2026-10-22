import type { Renderer } from "@civ/renderer-api";
import type { Context2D } from "./context.js";
import { drawCityScreen, cityButtonAt, citySlotAt, cityExitHit, cityUnitAt } from "./screens/city.js";
import { cityViewAt, drawCityView } from "./screens/cityview.js";
import { drawMainScreen, menuBarAnchor, menuBarHit, minimapAt, statusPanelAt, tileAt } from "./screens/main.js";
import { drawAdvisor, drawDiplomacyScreen, drawRatesScreen, drawReport, drawScienceScreen, drawSpaceshipScreen, drawWorldMap } from "./screens/pages.js";
import { drawResearch, RESEARCH_LIST_ROWS, researchHit } from "./screens/research.js";
import { drawEndScreen, drawTitleScreen } from "./screens/title.js";
import { drawMenu, drawStatusLine, drawTextInput, menuHit } from "./screens/widgets.js";
import { H, VIEW_TILES_X, VIEW_TILES_Y, W } from "./theme.js";

export type { Context2D, Gradient } from "./context.js";
export { H as MODERN_H, W as MODERN_W, TILE as MODERN_TILE } from "./theme.js";

/**
 * The modern renderer: the same screens as the retro one, drawn with
 * canvas 2D on a 960x600 logical surface. `scale` says how many backing
 * pixels one logical unit is at the start of each frame (device pixel
 * ratio times the fit), so the host owns the canvas and the renderer
 * only ever draws in its own units.
 */
export function createModernRenderer(ctx: Context2D, scale: () => number = () => 1): Renderer {
  return {
    id: "modern",
    width: W,
    height: H,
    viewTilesX: VIEW_TILES_X,
    viewTilesY: VIEW_TILES_Y,
    researchListRows: RESEARCH_LIST_ROWS,
    beginFrame() {
      const s = scale();
      ctx.setTransform(s, 0, 0, s, 0, 0);
    },
    present() {},
    title: () => drawTitleScreen(ctx),
    main: (state, view) => drawMainScreen(ctx, state, view),
    city: (state, view) => drawCityScreen(ctx, state, view),
    cityView: (state, view) => drawCityView(ctx, state, view),
    research: (state, view) => drawResearch(ctx, state, view),
    science: (state) => drawScienceScreen(ctx, state),
    rates: (state) => drawRatesScreen(ctx, state),
    advisor: (state, which) => drawAdvisor(ctx, state, which),
    diplomacy: (state, player, line) => drawDiplomacyScreen(ctx, state, player, line),
    end: (lines, rank) => drawEndScreen(ctx, lines, rank),
    spaceship: (state) => drawSpaceshipScreen(ctx, state),
    menu: (menu) => drawMenu(ctx, menu),
    textInput: (input, cursorOn) => drawTextInput(ctx, input, cursorOn),
    statusLine: (s) => drawStatusLine(ctx, s),
    menuHit: (menu, px, py) => menuHit(ctx, menu, px, py),
    // Set aside (not in the app): its menus show every row and never scroll.
    menuRows: (menu) => menu.items.length,
    menuScrollAt: () => null,
    citySlotAt: (px, py) => citySlotAt(px, py),
    cityExitHit: (px, py) => cityExitHit(px, py),
    cityButtonAt: (px, py) => cityButtonAt(px, py),
    cityUnitAt: (state, view, px, py) => cityUnitAt(state, view, px, py),
    cityViewAt: (state, view, px, py) => cityViewAt(state, view, px, py),
    tileAt: (state, view, px, py) => tileAt(state, view, px, py),
    minimapAt: (state, px, py) => minimapAt(state, px, py),
    researchHit: (state, view, px, py) => researchHit(ctx, state, view, px, py),
    statusAt: (state, _view, px, py) => statusPanelAt(state, px, py),
    report: (page) => drawReport(ctx, page),
    worldMap: (state) => drawWorldMap(ctx, state),
    menuBarHit: (px, py) => menuBarHit(ctx, px, py),
    menuBarAnchor: (index) => menuBarAnchor(ctx, index),
  };
}
