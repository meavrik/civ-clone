import { describe, expect, it } from "vitest";
import { showTab, type MenuPicture, type MenuState, type MenuTab } from "@civ/renderer-api";
import { C, drawMenu, menuRect, menuRows, menuScrollAt, shade, Surface, TOUCH_MENU, TOUCH_MENU_SMALL } from "../src/index.js";

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

/** The blue of the arrow's button at a row of a menu's foot, in screen pixels: how many squares of it, across the middle. */
function blueAt(m: MenuState, y: number, w = 320, size?: typeof TOUCH_MENU): number {
  const s = new Surface(w, 200);
  s.fill(C.BLACK!);
  drawMenu(s, m, undefined, size);
  const r = menuRect(m, w, size);
  const blue = [shade("azure", 2), shade("azure", 3), shade("azure", 7), shade("azure", 0)];
  let n = 0;
  for (let x = r.x; x < r.x + r.w; x++) if (blue.includes(s.get(x, y))) n++;
  return n;
}

describe("the arrow at the foot of a long list", () => {
  it("stands there while rows lie below those on view, and goes at the end of the list", () => {
    const m = buildMenu();
    const r = menuRect(m);
    const foot = r.y + r.h - 5;
    expect(blueAt(m, foot)).toBeGreaterThan(30);
    m.selected = 10;
    m.top = 7;
    expect(blueAt(m, foot)).toBe(0);
    // Nor on a tab whose rows all show, though the window keeps its size for the longest.
    showTab(m, 0);
    expect(m.items).toHaveLength(3);
    expect(menuRect(m)).toEqual(r);
    expect(blueAt(m, foot)).toBe(0);
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

  it("is as tall on the phone as on the desktop, twice as wide", () => {
    const y = (w: number, size?: typeof TOUCH_MENU) => { const m = buildMenu(); const r = menuRect(m, w, size); return blueAt(m, r.y + r.h - 5, w, size); };
    expect(y(420, TOUCH_MENU)).toBeGreaterThan(1.5 * y(320));
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
