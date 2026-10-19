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
});
