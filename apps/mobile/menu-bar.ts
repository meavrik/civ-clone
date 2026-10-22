/**
 * The phone's menu bar (renderer-api's `MENU_BAR`, rewritten by vite.config.ts as it is loaded):
 * no Orders, as a tap on a unit opens its orders over it (touch.ts), and in a production build no
 * Debug either (reveal map, gold, research...: the dev server keeps it). The titles left keep their
 * order, and the web game finds each by name. Throws if the titles are no longer written as
 * expected or one to drop is gone, so a build never changes the bar by surprise.
 */
const MENU_BAR = /export const MENU_BAR = \[([^\]]*)\] as const;/;

export function withoutTitles(code: string, drop: readonly string[]): string {
  const m = MENU_BAR.exec(code);
  if (!m) throw new Error("renderer-api's MENU_BAR is no longer written as apps/mobile/menu-bar.ts expects");
  const titles = [...m[1]!.matchAll(/"([^"]*)"/g)].map((t) => t[1]!);
  for (const t of drop) if (!titles.includes(t)) throw new Error(`renderer-api's MENU_BAR has no "${t}" to drop: update apps/mobile/menu-bar.ts`);
  const kept = titles.filter((t) => !drop.includes(t));
  return code.replace(MENU_BAR, `export const MENU_BAR = [${kept.map((t) => JSON.stringify(t)).join(", ")}] as const;`);
}

/** The titles the phone drops: Orders always, Debug from what is deployed. */
export function droppedTitles(command: "serve" | "build"): string[] {
  return command === "build" ? ["Orders", "Debug"] : ["Orders"];
}
