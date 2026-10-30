/**
 * City screen (320x200): stone windows on black, each with a blue title strip.
 *   title (View and the close box at its end), Happy and the citizens   across the top
 *   resources | map (the focus toggles in its corners) | improvements
 *   food store | units | production
 * No bar along the bottom (asked for 2026-10-24: its buttons became the icons above). Kept apart from
 * city.ts, importing nothing, so the menus (widgets.ts) can stand clear of a box (`MenuState.keepClear`).
 */
export const TOP = { y: 1, h: 28 };
export const ROW1 = { y: 30, h: 84 };
export const ROW2 = { y: 116, h: 83 };
export const LEFT = { x: 1, w: 106 };
export const MID = { x: 108, w: 84 };
export const RIGHT = { x: 193, w: 126 };

/** A box of the city screen, by what it shows. */
export interface CityBox {
  id: "resources" | "map" | "improvements" | "food" | "units" | "production";
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The city screen's six boxes under its title row (the phone enlarges one on a tap: `drawCityZoom`). */
export const CITY_BOXES: readonly CityBox[] = [
  { id: "resources", x: LEFT.x, y: ROW1.y, w: LEFT.w, h: ROW1.h },
  { id: "map", x: MID.x, y: ROW1.y, w: MID.w, h: ROW1.h },
  { id: "improvements", x: RIGHT.x, y: ROW1.y, w: RIGHT.w, h: ROW1.h },
  { id: "food", x: LEFT.x, y: ROW2.y, w: LEFT.w, h: ROW2.h },
  { id: "units", x: MID.x, y: ROW2.y, w: MID.w, h: ROW2.h },
  { id: "production", x: RIGHT.x, y: ROW2.y, w: RIGHT.w, h: ROW2.h },
];

/** The city screen's units box (`MenuState.keepClear` "cityUnits"). */
export const CITY_UNITS_BOX: CityBox = CITY_BOXES.find((b) => b.id === "units")!;
