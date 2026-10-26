import { BUILT_BUTTONS, builtCard, NEW_TECH_BUTTONS, newTechCard, REIGN_BUTTON, reignCard, type DiplomacyView, type MenuState, type Renderer, type SetupCards } from "@civ/renderer-api";
import type { Context2D } from "./context.js";
import { drawCityScreen, cityButtonAt, cityCitizenAt, citySlotAt, cityExitHit, cityUnitAt } from "./screens/city.js";
import { cityViewAt, drawCityView } from "./screens/cityview.js";
import { drawMainScreen, menuBarAnchor, menuBarHit, minimapAt, statusPanelAt, tileAt } from "./screens/main.js";
import { drawAdvisor, drawDiplomacyScreen, drawRatesScreen, drawReport, drawScienceScreen, drawSpaceshipScreen, drawWorldMap } from "./screens/pages.js";
import { drawResearch, RESEARCH_LIST_ROWS, researchHit } from "./screens/research.js";
import { drawEndScreen, drawTitleScreen } from "./screens/title.js";
import { drawMenu, drawStatusLine, drawTextInput, menuHit } from "./screens/widgets.js";
import { BAR_H, H, VIEW_TILES_X, VIEW_TILES_Y, VIEW_W, VIEW_X, VIEW_Y, W } from "./theme.js";

export type { Context2D, Gradient } from "./context.js";
export { H as MODERN_H, W as MODERN_W, TILE as MODERN_TILE } from "./theme.js";

/** An audience's choices as a menu. */
const talkMenu = (view: DiplomacyView): MenuState => ({ title: "", items: view.choices ?? [], selected: view.selected ?? 0, anchor: { x: 20, y: 20 } });

/** A setup question's cards as a menu of their labels. */
const cardMenu = (cards: SetupCards, selected: number): MenuState => ({ title: cards.title, items: cards.cards.map((c) => c.label), selected });

/**
 * The modern renderer: the same screens as the retro one, drawn with
 * canvas 2D on a 960x600 logical surface. `scale` says how many backing
 * pixels one logical unit is at the start of each frame (device pixel
 * ratio times the fit), so the host owns the canvas and the renderer
 * only ever draws in its own units.
 */
export function createModernRenderer(ctx: Context2D, scale: () => number = () => 1): Renderer {
  /** The New Technology window last drawn, as the modal it is here, for its hit test. */
  let newTechShown: MenuState | null = null;
  /** The Building Completed window last drawn, likewise. */
  let builtShown: MenuState | null = null;
  /** The opening window last drawn, likewise. */
  let reignShown: MenuState | null = null;
  return {
    id: "modern",
    width: W,
    height: H,
    viewTilesX: VIEW_TILES_X,
    viewTilesY: VIEW_TILES_Y,
    mapView: { x: VIEW_X, y: VIEW_Y, width: VIEW_W, height: H - BAR_H },
    researchListRows: RESEARCH_LIST_ROWS,
    beginFrame() {
      const s = scale();
      ctx.setTransform(s, 0, 0, s, 0, 0);
    },
    present() {},
    title: () => drawTitleScreen(ctx),
    // Set aside (not in the app): the setup's cards as the plain list they were.
    setup: (cards, selected) => { drawTitleScreen(ctx); drawMenu(ctx, cardMenu(cards, selected)); },
    setupHit: (cards, px, py) => menuHit(ctx, cardMenu(cards, 0), px, py),
    main: (state, view) => drawMainScreen(ctx, state, view),
    city: (state, view) => drawCityScreen(ctx, state, view),
    cityView: (state, view) => drawCityView(ctx, state, view),
    research: (state, view) => drawResearch(ctx, state, view),
    science: (state) => drawScienceScreen(ctx, state),
    rates: (state) => drawRatesScreen(ctx, state),
    advisor: (state, which) => drawAdvisor(ctx, state, which),
    // Set aside (not in the app): its throne room with the choices as its menu.
    diplomacy: (state, view) => {
      drawDiplomacyScreen(ctx, state, view.player, view.line);
      if (view.choices?.length) drawMenu(ctx, talkMenu(view));
    },
    diplomacyChoiceAt: (view, px, py) => (view.choices?.length ? menuHit(ctx, talkMenu(view), px, py) : -1),
    // Set aside (not in the app): the New Technology window as a modal with its two buttons.
    newTech: (state, view) => {
      const card = newTechCard(state, view.advance);
      newTechShown = { title: `New Technology: ${card.name}`, body: [card.text], items: [...NEW_TECH_BUTTONS], selected: view.selected };
      drawMenu(ctx, newTechShown);
    },
    newTechHit: (_view, px, py) => {
      const i = newTechShown ? menuHit(ctx, newTechShown, px, py) : -1;
      return i === 0 ? "tree" : i === 1 ? "continue" : null;
    },
    // Set aside (not in the app): the Building Completed window as a modal with its two buttons.
    built: (state, view) => {
      const card = builtCard(state, view);
      builtShown = { title: `${card?.title ?? "Completed"}: ${card?.name ?? ""}`, body: [card?.where ?? "", card?.text ?? ""], items: [...BUILT_BUTTONS], selected: view.selected };
      drawMenu(ctx, builtShown);
    },
    builtHit: (_view, px, py) => {
      const i = builtShown ? menuHit(ctx, builtShown, px, py) : -1;
      return i === 0 ? "city" : i === 1 ? "continue" : null;
    },
    // Set aside (not in the app): the opening window as a modal with its button.
    reign: (state) => {
      const card = reignCard(state);
      reignShown = { title: card.name, body: [card.under, card.text, ...(card.trait ? [card.trait] : []), ...card.bonuses.map((b) => `{${b.icon}} ${b.text}`)], items: [REIGN_BUTTON], selected: 0 };
      drawMenu(ctx, reignShown);
    },
    reignHit: (_view, px, py) => (reignShown && menuHit(ctx, reignShown, px, py) === 0 ? "begin" : null),
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
    cityCitizenAt: (state, view, px, py) => cityCitizenAt(state, view, px, py),
    // Its Focus button opens the menu; the focus toggles are the retro map's corners.
    cityFocusAt: () => null,
    // Set aside (the app draws retro only): its city screen keeps its plain list of improvements.
    cityImprovementAt: () => null,
    cityImprovementRows: () => Infinity,
    // Its own rates screen takes keys; a click anywhere closes it.
    ratesHit: () => null,
    cityViewAt: (state, view, px, py) => cityViewAt(state, view, px, py),
    tileAt: (state, view, px, py) => tileAt(state, view, px, py),
    minimapAt: (state, px, py) => minimapAt(state, px, py),
    researchHit: (state, view, px, py) => researchHit(ctx, state, view, px, py),
    statusAt: (state, _view, px, py) => statusPanelAt(state, px, py),
    // Set aside (2026-10-19): the panel's tips are drawn by the retro renderer only.
    statusPartAt: () => null,
    report: (page) => drawReport(ctx, page),
    worldMap: (state) => drawWorldMap(ctx, state),
    menuBarHit: (px, py) => menuBarHit(ctx, px, py),
    menuBarAnchor: (index) => menuBarAnchor(ctx, index),
  };
}
