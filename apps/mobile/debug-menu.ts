/**
 * The deployed app has no Debug menu (reveal map, gold, research...); the dev server keeps it.
 * vite.config.ts runs this on packages/renderer-api/src/index.ts in a production build: the menu
 * bar's titles lose their last, "Debug", so the bar never draws it and the web game never opens
 * it (its other titles keep their places, and their Alt keys). Throws if the titles are no longer
 * written as expected, so a build never ships the menu by surprise.
 */
const MENU_BAR = /(export const MENU_BAR = \[[^\]]*?),\s*"Debug"\s*\]/;

export function withoutDebugMenu(code: string): string {
  if (!MENU_BAR.test(code)) throw new Error('renderer-api\'s MENU_BAR no longer ends with "Debug": update apps/mobile/debug-menu.ts');
  return code.replace(MENU_BAR, "$1]");
}
