import { describe, expect, it } from "vitest";
import { MORE_BOB, moreArrowDrop, showTab, type MenuPicture, type MenuState, type MenuTab } from "@civ/renderer-api";
import { C, drawMenu, INK, menuRect, menuRows, menuScrollAt, shade, Surface, TOUCH_MENU, TOUCH_MENU_SMALL } from "../src/index.js";

const NAMES = ["Barracks", "Temple", "Granary", "Library", "Marketplace", "City Walls", "Courthouse", "Aqueduct", "Colosseum", "Bank", "University"];

function tab(label: string, n: number): MenuTab {
  const items = NAMES.slice(0, n);
  return { label, items, right: items.map(() => "2 turns"), pictures: items.map((): MenuPicture => ({ icon: "house" })), selected: 0, ...(n ? {} : { off: true }) };
}

/** The build menu over the city screen, its Buildings tab shown: 11 rows, and a short Units tab beside them. */
function buildMenu(body?: string[]): MenuState {
  const m: MenuState = { title: "Rome: build what?", items: [], selected: 0, tabs: [tab("Units", 3), tab("Buildings", 11), tab("Wonders", 0)], keepClear: "cityUnits", ...(body ? { body } : {}) };
  showTab(m, 1);
  return m;
}

/** The fine pixels of the arrow in a menu's foot, as `[x, y]`, drawn as on the game's screen: the dark ink under the last row. */
function arrowAt(m: MenuState, w = 320, size?: typeof TOUCH_MENU): [number, number][] {
  const s = new Surface(w, 200, undefined, 2);
  s.fill(C.BLACK!);
  drawMenu(s, m, undefined, size);
  const r = menuRect(m, w, size);
  const out: [number, number][] = [];
  // The foot's room, inside the window's rim; the last row's words end above it.
  for (let y = (r.y + r.h - 9) * 2; y < (r.y + r.h - 1) * 2; y++) for (let x = (r.x + 2) * 2; x < (r.x + r.w - 2) * 2; x++) if (s.fget(x, y) === INK) out.push([x, y]);
  return out;
}

describe("the arrow at the foot of a long list", () => {
  it("stands there while rows lie below those on view, and goes at the end of the list", () => {
    const m = buildMenu();
    const r = menuRect(m);
    expect(arrowAt(m).length).toBeGreaterThan(10);
    m.selected = 10;
    m.top = 7;
    expect(arrowAt(m)).toEqual([]);
    // Nor on a tab whose rows all show, though the window keeps its size for the longest.
    showTab(m, 0);
    expect(m.items).toHaveLength(3);
    expect(menuRect(m)).toEqual(r);
    expect(arrowAt(m)).toEqual([]);
  });

  it("is small and plain: a chevron on the stone in the middle of the foot, no button, the same on the phone", () => {
    for (const [w, size] of [[320, undefined], [420, TOUCH_MENU]] as const) {
      const m = buildMenu();
      const dots = arrowAt(m, w, size);
      const xs = dots.map((d) => d[0]);
      const ys = dots.map((d) => d[1]);
      const width = Math.max(...xs) - Math.min(...xs) + 1;
      expect(width).toBe(12);
      expect(Math.max(...ys) - Math.min(...ys) + 1).toBe(5);
      // In the middle of the window, a fine pixel either way.
      const r = menuRect(m, w, size);
      expect(Math.abs((Math.min(...xs) + Math.max(...xs)) / 2 - (r.x + r.w / 2) * 2)).toBeLessThanOrEqual(1);
      // None of the lit blue of the button it was.
      const s = new Surface(w, 200, undefined, 2);
      drawMenu(s, m, undefined, size);
      for (let x = r.x + 4; x < r.x + r.w - 4; x++) expect([shade("azure", 2), shade("azure", 3)]).not.toContain(s.get(x, r.y + r.h - 4));
    }
  });

  it("bobs down and back up, eased, staying in the foot, and rests without a clock", () => {
    expect(moreArrowDrop(0)).toBe(0);
    expect(moreArrowDrop(MORE_BOB.ms / 2)).toBe(MORE_BOB.fine);
    expect(moreArrowDrop(MORE_BOB.ms)).toBe(0);
    expect(moreArrowDrop(MORE_BOB.ms * 1.5)).toBe(MORE_BOB.fine);
    expect(moreArrowDrop(MORE_BOB.ms / 8)).toBe(moreArrowDrop((7 * MORE_BOB.ms) / 8));
    expect(moreArrowDrop(-50)).toBe(0);
    // It goes through every height on the way, no jump.
    const heights = Array.from({ length: 60 }, (_, i) => moreArrowDrop((i * MORE_BOB.ms) / 60));
    expect(new Set(heights)).toEqual(new Set([0, 1, 2, 3]));
    for (let i = 1; i < heights.length; i++) expect(Math.abs(heights[i]! - heights[i - 1]!)).toBeLessThanOrEqual(1);
    // On the screen: the same chevron, lower by that much, the whole of its way inside the window.
    const m = buildMenu();
    const r = menuRect(m);
    const top = (clock?: number) => Math.min(...arrowAt(clock === undefined ? m : { ...m, clock }).map((d) => d[1]));
    expect(top(0)).toBe(top());
    expect(top(MORE_BOB.ms / 2)).toBe(top() + MORE_BOB.fine);
    expect(arrowAt({ ...m, clock: MORE_BOB.ms / 2 })).toHaveLength(arrowAt(m).length);
    expect(Math.max(...arrowAt({ ...m, clock: MORE_BOB.ms / 2 }).map((d) => d[1]))).toBeLessThan((r.y + r.h - 1) * 2);
  });

  it("costs the build menu no row, over the city screen, on the desktop or the phone", () => {
    expect(menuRows(buildMenu())).toBe(4);
    expect(menuRows(buildMenu(), 420, TOUCH_MENU)).toBe(3);
    expect(menuRows(buildMenu(["A note on our roads"]))).toBe(3);
    expect(menuRows(buildMenu(["A note on our roads"]), 420, TOUCH_MENU_SMALL)).toBe(3);
    for (const [w, size] of [[320, undefined], [420, TOUCH_MENU]] as const) {
      const r = menuRect(buildMenu(), w, size);
      expect(r.y).toBeGreaterThanOrEqual(0);
      expect(r.y + r.h + 2).toBeLessThanOrEqual(116);
    }
  });

  it("answers a click on all of the foot, and a click there once the list has ended does nothing", () => {
    const m = buildMenu();
    const r = menuRect(m);
    const foot = r.y + r.h - 3;
    expect(menuScrollAt(m, r.x + r.w / 2, foot)).toBe(1);
    expect(menuScrollAt(m, r.x + 6, foot)).toBe(1);
    // Off the window it is no part of the list.
    expect(menuScrollAt(m, r.x - 2, foot)).toBeNull();
    expect(menuScrollAt(m, r.x + r.w / 2, r.y + r.h + 1)).toBeNull();
    // At the end, not -1 or null: the click must not page back, nor close the window.
    m.selected = 10;
    m.top = 7;
    expect(menuScrollAt(m, r.x + r.w / 2, foot)).toBe(0);
  });

  it("leaves a list that all fits alone: no deeper foot, and the foot no part of it", () => {
    const m: MenuState = { title: "Pick", items: ["A", "B", "C", "D", "E"], selected: 0, right: ["1", "2", "3", "4", "5"] };
    const r = menuRect(m);
    expect(r.h).toBe(16 + 5 * 9 + 6);
    expect(menuScrollAt(m, r.x + r.w / 2, r.y + r.h - 3)).toBeNull();
  });
});
