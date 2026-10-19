import type { Command, GameState } from "@civ/core";

/** What the web game shows of itself on `window.civ` (the last line of apps/web/src/main.ts). */
export interface CivHook {
  readonly state: GameState | undefined;
  readonly log: Command[];
  /** The web game's screen kind: "title", "map", "city", "menu", "input"... */
  readonly screen: string;
}

export function game(): CivHook | undefined {
  return (window as unknown as { civ?: CivHook }).civ;
}

export function screenKind(): string {
  return game()?.screen ?? "title";
}

/** Press a key for the web game, which listens on the window. */
export function press(code: string, key: string): void {
  dispatchEvent(new KeyboardEvent("keydown", { code, key, bubbles: true, cancelable: true }));
}
