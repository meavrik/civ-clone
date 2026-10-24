import { mkdirSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { keepInView, type MenuState } from "@civ/renderer-api";
import { C, drawMenu, menuHit, menuRect, menuRows, menuScrollAt, Surface } from "../src/index.js";
import { encodePng } from "./png.js";

/** A city late in the game: more to build than the screen holds. */
function longList(selected: number): MenuState {
  const items = Array.from({ length: 40 }, (_, i) => `Choice ${i + 1}`);
  return { title: "Rome: build what?", items, right: items.map((_, i) => `${10 * (i + 1)}`), selected };
}

describe("menus", () => {
  it("scroll a list too long for the screen, keeping the choice on view and hits on the rows shown", () => {
    const m = longList(30);
    const rows = menuRows(m);
    expect(rows).toBeLessThan(m.items.length);
    m.top = keepInView(m, rows);
    expect(m.top).toBe(30 - rows + 1);
    const r = menuRect(m);
    expect(r.y + r.h).toBeLessThanOrEqual(200);
    // The first row on view is the row at `top`.
    const firstRow = r.y + 16 + 1;
    expect(menuHit(m, r.x + 20, firstRow)).toBe(m.top);
    expect(menuHit(m, r.x + 20, firstRow + (rows - 1) * 9)).toBe(m.top + rows - 1);
    // The bar: above the thumb pages up, below it pages down, off it is no part of the bar.
    const barX = r.x + r.w - 7;
    expect(menuScrollAt(m, barX, firstRow)).toBe(-1);
    expect(menuScrollAt(m, barX, firstRow + rows * 9 - 3)).toBe(1);
    expect(menuScrollAt(m, r.x + 20, firstRow)).toBeNull();
    // A short list neither scrolls nor has a bar.
    const short: MenuState = { title: "Pick", items: ["A", "B", "C", "D", "E"], selected: 0, right: ["1", "2", "3", "4", "5"] };
    expect(menuRows(short)).toBe(5);
    expect(menuScrollAt(short, 160, 100)).toBeNull();

    const s = Surface.screen();
    s.fill(C.BLACK!);
    drawMenu(s, m);
    mkdirSync(new URL("./out/", import.meta.url), { recursive: true });
    writeFileSync(new URL("./out/menu-scroll.png", import.meta.url), encodePng(s, 3));
  });

  it("open a square's window clear of the square clicked, so a second click there picks nothing", () => {
    const at = (x: number, y: number): MenuState => ({ title: "Jungle", body: ["{food} 1  {shield} 0", "Improvements: {irrigate} into Grassland"], items: ["Go here"], selected: -1, close: true, avoid: { x, y } });
    const centred = menuRect({ ...at(0, 0), avoid: undefined } as MenuState);
    // Wherever the click falls, nothing of the window lies within a square of it.
    for (const [x, y] of [[centred.x + centred.w / 2, centred.y + centred.h - 8], [200, 100], [200, 180], [200, 20], [90, 100], [310, 100]] as const) {
      const m = at(x, y);
      const r = menuRect(m);
      expect(r.x < x + 16 && r.x + r.w > x - 16 && r.y < y + 16 && r.y + r.h > y - 16).toBe(false);
      expect(menuHit(m, x, y)).toBe(-1);
      expect(r.x).toBeGreaterThanOrEqual(0);
      expect(r.y + r.h).toBeLessThanOrEqual(200);
    }
    // Clear of the point already: it stays centred.
    expect(menuRect(at(300, 190))).toEqual(centred);
  });

  it("move the window as little as it must to show the choice", () => {
    const m = longList(0);
    expect(keepInView(m, 10)).toBe(0);
    m.top = 5;
    m.selected = 8;
    expect(keepInView(m, 10)).toBe(5);
    m.selected = 20;
    expect(keepInView(m, 10)).toBe(11);
    m.selected = 2;
    expect(keepInView(m, 10)).toBe(2);
    m.top = 99;
    m.selected = 39;
    expect(keepInView(m, 10)).toBe(30);
  });

  it("list a stack of units with their sprites on rows tall enough to hold them, never as buttons", () => {
    const m: MenuState = {
      title: "Our units here (3)",
      items: ["Settlers", "Militia", "Phalanx"],
      right: ["Ready", "Fortified", "No moves"],
      units: [{ type: "settlers", color: 0 }, { type: "militia", color: 0 }, { type: "phalanx", color: 0 }],
      selected: 1,
      close: true,
    };
    const s = Surface.screen();
    s.fill(C.BLACK!);
    drawMenu(s, m);
    mkdirSync(new URL("./out/", import.meta.url), { recursive: true });
    writeFileSync(new URL("./out/menu-stack.png", import.meta.url), encodePng(s, 3));
    const r = menuRect(m);
    // Three rows of a sprite's height (18 each) under the title, not three buttons.
    expect(menuRows(m)).toBe(3);
    expect(r.h).toBeGreaterThanOrEqual(16 + 3 * 18 + 6);
    // Each row answers to a click anywhere across it, the sprite's end included.
    const hits = [0, 1, 2].map((i) => menuHit(m, r.x + 12, r.y + 17 + i * 18 + 8));
    expect(hits).toEqual([0, 1, 2]);
    expect(menuHit(m, r.x + r.w - 10, r.y + 17 + 8)).toBe(0);
  });
});
