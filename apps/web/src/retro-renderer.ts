import type { AdvisorKind, CityScreenView, MainScreenView, MenuState, Renderer, TextInputState } from "@civ/renderer-api";
import {
  citySlotAt,
  drawCityScreen,
  drawDiplomacyScreen,
  drawDiscoveryScreen,
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
  drawTextInput,
  drawTitleScreen,
  menuHit,
  PALETTE_RGBA,
  panOffset,
  SCREEN_H,
  SCREEN_W,
  Surface,
  TILE,
  VIEW_TILES_X,
  VIEW_TILES_Y,
  VIEW_X,
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
    discovery: (state, advance) => drawDiscoveryScreen(screen, state, advance),
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
    citySlotAt: (px, py) => citySlotAt(px, py),
    cityExitHit: (_px, py) => py > SCREEN_H - 12,
    tileAt(state: GameState, view: MainScreenView, px, py) {
      if (px < VIEW_X) return null;
      const [ox, oy] = panOffset(view);
      const ty = view.originY + Math.floor((py + oy) / TILE);
      if (ty < 0 || ty >= state.map.height) return null;
      return { x: wrapX(state.map, view.originX + Math.floor((px - VIEW_X + ox) / TILE)), y: ty };
    },
    minimapAt(state: GameState, px, py) {
      if (px >= VIEW_X || py < 2 || py >= 2 + state.map.height) return null;
      return { x: px, y: py - 2 };
    },
  };
}
