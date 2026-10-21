/**
 * The touch controls for each screen of the web game: a direction pad and a few buttons, each
 * pressing the key the web game already answers to there (see `mapKey`, `cityKey`, `menuKey`...
 * in apps/web/src/main.ts). `screen` is the web game's screen kind.
 */
export interface Key {
  label: string;
  code: string;
  key: string;
}

export interface Context {
  screen: string;
  /** A unit of ours awaits orders on the map. */
  activeUnit: boolean;
}

const k = (label: string, code: string, key: string): Key => ({ label, code, key });
const OK = k("OK", "Enter", "Enter");
const BACK = k("Back", "Escape", "Escape");

export function keysFor(c: Context): Key[] {
  switch (c.screen) {
    case "map":
      return c.activeUnit
        ? [k("Orders", "Escape", "Escape"), k("Skip", "Space", " "), k("Wait", "KeyW", "w"), k("Menu", "F10", "F10")]
        : [k("End turn", "Enter", "Enter"), k("Menu", "F10", "F10")];
    case "city":
      return [k("Change", "KeyC", "c"), k("Buy", "KeyB", "b"), k("Happy", "KeyH", "h"), k("View", "KeyV", "v"), k("Rename", "KeyN", "n"), k("Exit", "Escape", "Escape")];
    case "research":
      return [k("Research", "Enter", "Enter"), k("Next", "Tab", "Tab"), k("Close", "Escape", "Escape")];
    case "science":
      return [k("Research", "KeyA", "a"), BACK];
    case "rates":
      return [k("Done", "Enter", "Enter")];
    case "spaceship":
      return [k("Launch", "Enter", "Enter"), BACK];
    case "menu":
    case "setup":
      return [OK, BACK];
    case "advisor":
    case "cityView":
      return [BACK];
    case "input":
      return []; // a text field and the phone's keyboard instead
    case "title":
      return [k("Start", "Enter", "Enter")];
    default: // beat, diplomacy, report, worldMap, end: any key goes on
      return [OK];
  }
}

/** One of the pad's nine buttons: the eight directions round a middle. */
export interface PadKey {
  /** Grid position, 0..2 each way. */
  col: number;
  row: number;
  code: string;
  key: string;
}

/**
 * The direction pad: on the map it moves the active unit (the diagonals are the numeric keypad's,
 * the middle centres the map on the unit); elsewhere the arrows walk menus, the research list and the rates.
 * null where the arrows do nothing.
 */
export function padFor(screen: string): PadKey[] | null {
  const arrows: PadKey[] = [
    { col: 1, row: 0, code: "ArrowUp", key: "ArrowUp" },
    { col: 0, row: 1, code: "ArrowLeft", key: "ArrowLeft" },
    { col: 2, row: 1, code: "ArrowRight", key: "ArrowRight" },
    { col: 1, row: 2, code: "ArrowDown", key: "ArrowDown" },
  ];
  switch (screen) {
    case "map":
      return [
        ...arrows,
        { col: 0, row: 0, code: "Numpad7", key: "7" },
        { col: 2, row: 0, code: "Numpad9", key: "9" },
        { col: 0, row: 2, code: "Numpad1", key: "1" },
        { col: 2, row: 2, code: "Numpad3", key: "3" },
        { col: 1, row: 1, code: "KeyC", key: "c" },
      ];
    case "menu":
    case "setup":
    case "research":
    case "rates":
      return arrows;
    default:
      return null;
  }
}
