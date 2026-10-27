import { mkdirSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { keepInView, type MenuState } from "@civ/renderer-api";
import { C, DESK_MENU, drawMenu, menuHit, menuRect, menuRowRect, menuRows, menuScrollAt, Surface, TOUCH_MENU, TOUCH_MENU_SMALL } from "../src/index.js";
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

  it("tell where each row lies, so a submenu opens level with its row beside the dropdown", () => {
    for (const size of [DESK_MENU, TOUCH_MENU]) {
      const game: MenuState = { title: "", items: ["Tax Rate", "Find City", "Options", "Save Game"], right: ["T", "", "▸", ""], selected: 2, anchor: { x: 0, y: 9 } };
      const row = menuRowRect(game, 2, 320, size)!;
      expect(menuHit(game, row.x + row.w / 2, row.y + row.h / 2, 320, size)).toBe(2);
      expect(row.x + row.w).toBe(menuRect(game, 320, size).x + menuRect(game, 320, size).w);
      const options: MenuState = { title: "", items: ["Borders", "Place Names", "Tutorial"], right: ["On", "On", "Off"], selected: 0, anchor: { x: row.x + row.w - 2, y: row.y - 2 } };
      expect(menuRowRect(options, 0, 320, size)!.y).toBe(row.y);
      expect(menuHit(options, row.x + row.w + 10, row.y + row.h / 2, 320, size)).toBe(0);
    }
  });
});

describe("menus sized for a finger (the phone app)", () => {
  it("draw taller rows and buttons and a wider bar, hit where they are drawn, on the screen", () => {
    // A dropdown under the bar: every row as tall as TOUCH_MENU's, each hit over its whole height.
    const bar: MenuState = { title: "", items: ["Tax Rate", "Find City", "Revolution!", "Borders: On", "Save Game", "Load Game", "Retire", "New Game"], selected: 0, anchor: { x: 0, y: 9 } };
    const r = menuRect(bar, 320, TOUCH_MENU);
    expect(r.h).toBeGreaterThan(menuRect(bar).h);
    const firstRow = r.y + 3 - 1;
    for (let i = 0; i < bar.items.length; i++)
      for (let dy = 0; dy < TOUCH_MENU.row; dy++) expect(menuHit(bar, r.x + 10, firstRow + i * TOUCH_MENU.row + dy, 320, TOUCH_MENU)).toBe(i);
    // A modal's buttons: as tall as TOUCH_MENU's, the gap between them no button.
    const modal: MenuState = { title: "Buy Granary?", body: ["{purse} 112 gold"], items: ["Buy", "Not now"], selected: 0 };
    const hits = new Map<number, number>();
    const mr = menuRect(modal, 320, TOUCH_MENU);
    for (let y = mr.y; y < mr.y + mr.h; y++) { const i = menuHit(modal, 160, y, 320, TOUCH_MENU); if (i >= 0) hits.set(i, (hits.get(i) ?? 0) + 1); }
    expect([...hits.values()]).toEqual([TOUCH_MENU.button, TOUCH_MENU.button]);
    // A long list shows fewer, taller rows, all on the screen, with a bar TOUCH_MENU.scroll wide.
    const m = longList(30);
    const rows = menuRows(m, 320, TOUCH_MENU);
    expect(rows).toBeLessThan(menuRows(m));
    m.top = keepInView(m, rows);
    const lr = menuRect(m, 320, TOUCH_MENU);
    expect(lr.y + lr.h).toBeLessThanOrEqual(200);
    const barHits = Array.from({ length: 320 }, (_, x) => menuScrollAt(m, x, lr.y + 40, 320, TOUCH_MENU)).filter((v) => v !== null).length;
    expect(barHits).toBe(TOUCH_MENU.scroll + 2);
    expect(DESK_MENU.row).toBeLessThan(TOUCH_MENU.row);
    const s = Surface.screen();
    s.fill(C.BLACK!);
    drawMenu(s, m, undefined, TOUCH_MENU);
    writeFileSync(new URL("./out/menu-touch.png", import.meta.url), encodePng(s, 3));
  });
});

describe("menus with large words (the phone app)", () => {
  it("draw words twice the font's size where the window fits, else at the font's own", () => {
    expect(TOUCH_MENU.text).toBe(2);
    // A message of two lines and two buttons fits large: taller than the small one, and wider.
    const modal: MenuState = { title: "Sell the Granary?", body: ["{purse} 60 gold for it  {coin} 120 in the treasury", "A city sells one building a turn."], items: ["Sell", "Keep it"], selected: 1 };
    const big = menuRect(modal, 320, TOUCH_MENU);
    const small = menuRect(modal, 320, TOUCH_MENU_SMALL);
    expect(big.h).toBeGreaterThan(small.h);
    expect(big.w).toBeGreaterThan(small.w);
    expect(big.y + big.h).toBeLessThanOrEqual(200);
    // Its buttons answer where they are drawn, each TOUCH_MENU.button tall.
    const hits = new Map<number, number>();
    for (let y = big.y; y < big.y + big.h; y++) { const i = menuHit(modal, 160, y, 320, TOUCH_MENU); if (i >= 0) hits.set(i, (hits.get(i) ?? 0) + 1); }
    expect([...hits.values()]).toEqual([TOUCH_MENU.button, TOUCH_MENU.button]);
    const s = Surface.screen();
    s.fill(C.BLACK!);
    drawMenu(s, modal, undefined, TOUCH_MENU);
    writeFileSync(new URL("./out/menu-large.png", import.meta.url), encodePng(s, 3));
    // A window of many lines would run off the screen at that size: it keeps the font's own.
    const tall: MenuState = { title: "Grassland", body: Array.from({ length: 9 }, (_, i) => `Line ${i} of what the square holds`), items: [], selected: 0, close: true };
    expect(menuRect(tall, 320, TOUCH_MENU)).toEqual(menuRect(tall, 320, TOUCH_MENU_SMALL));
    expect(menuRect(tall, 320, TOUCH_MENU).h).toBeLessThanOrEqual(200);
    // A dropdown's rows hold the large words; a long list still scrolls on the screen.
    const bar: MenuState = { title: "", items: ["Tax Rate", "Find City", "Revolution!", "Borders: On", "Save Game", "Load Game", "Retire", "New Game"], selected: 0, anchor: { x: 0, y: 9 } };
    expect(menuRect(bar, 320, TOUCH_MENU).h).toBe(3 + 8 * TOUCH_MENU.row + 3);
    const list = longList(3);
    expect(menuRows(list, 320, TOUCH_MENU)).toBeLessThan(list.items.length);
    const lr = menuRect(list, 320, TOUCH_MENU);
    expect(lr.y + lr.h).toBeLessThanOrEqual(200);
  });
});
