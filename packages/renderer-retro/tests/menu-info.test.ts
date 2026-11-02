import { mkdirSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { applyCommand, newGame, type Production } from "@civ/core";
import { productionInfo, type MenuState } from "@civ/renderer-api";
import { drawMenu, menuHit, menuInfoAt, menuRect, menuTipAt, shade, Surface, TOUCH_MENU } from "../src/index.js";
import { encodePng } from "./png.js";

/** A build menu of Rome's, each row with its info, as the web app makes it. */
function buildMenu(): MenuState {
  const state = newGame(2026);
  applyCommand(state, { type: "found", unit: state.units[0]!.id });
  const city = state.cities[0]!;
  const list: Production[] = [{ kind: "unit", id: "militia" }, { kind: "unit", id: "legion" }, { kind: "building", id: "temple" }, { kind: "building", id: "barracks" }];
  return {
    title: "Rome: build what?",
    items: list.map((p) => (p.kind === "unit" ? (p.id === "militia" ? "Militia" : "Legion") : p.id === "temple" ? "Temple" : "Barracks")),
    right: ["3 turns", "needs Iron", "8 turns", "12 turns"],
    pictures: list.map((p) => (p.kind === "unit" ? { unit: p.id, color: 0 } : { building: p.id })),
    disabled: [1],
    info: list.map((p) => productionInfo(state, 0, p, city)),
    selected: 0,
  };
}

/** The pixels of the info mark's blue in a box of the screen. */
function blue(s: Surface, x: number, y: number, w: number, h: number): number {
  let n = 0;
  for (let j = y * s.k; j < (y + h) * s.k; j++) for (let i = x * s.k; i < (x + w) * s.k; i++) if (s.fget(i, j) === shade("azure", 4)) n++;
  return n;
}

describe("the build menu's info marks", () => {
  it("end every row, answer a pointer on them (not as a pick of the row), and open a tip beside the mark", () => {
    const m = buildMenu();
    const s = Surface.screen();
    drawMenu(s, m);
    const r = menuRect(m);
    // Find each row's mark: a point on it answers with its row, the row's words do not.
    const marks: [number, number][] = [];
    for (let row = 0; row < m.items.length; row++)
      for (let x = r.x + r.w - 1; x > r.x && marks.length === row; x--)
        for (let y = r.y; y < r.y + r.h; y++) if (menuInfoAt(m, x, y) === row) { marks.push([x - 3, y + 3]); break; }
    expect(marks).toHaveLength(m.items.length);
    for (const [row, [x, y]] of marks.entries()) {
      expect(menuInfoAt(m, x, y)).toBe(row);
      expect(blue(s, x - 3, y - 3, 7, 7)).toBeGreaterThan(20);
    }
    // The words of a row are no mark, and its mark still lies in its row (a click there is told apart first).
    expect(menuInfoAt(m, r.x + 40, marks[0]![1])).toBeNull();
    expect(menuHit(m, marks[2]![0], marks[2]![1])).toBe(2);
    // A faded row (lacking Iron) tells of itself all the same.
    expect(menuInfoAt(m, ...marks[1]!)).toBe(1);

    // Shown: the tip stands beside the mark, over the screen, and a point on it is the tip's.
    m.infoShown = 1;
    const tipped = Surface.screen();
    drawMenu(tipped, m);
    mkdirSync(new URL("./out/", import.meta.url), { recursive: true });
    writeFileSync(new URL("./out/menu-info.png", import.meta.url), encodePng(tipped, 3));
    let changed = 0;
    for (let i = 0; i < s.data.length; i++) if (s.data[i] !== tipped.data[i]) changed++;
    expect(changed).toBeGreaterThan(2000);
    const [mx, my] = marks[1]!;
    const onTip = [mx + 20, mx - 20].find((x) => menuTipAt(m, x, my));
    expect(onTip).toBeDefined();
    expect(menuTipAt(m, r.x + 6, r.y + 2)).toBe(false);
  });

  it("are twice the size with the phone's large words", () => {
    const m = buildMenu();
    const s = new Surface(480, 200, undefined, 2);
    drawMenu(s, m, undefined, TOUCH_MENU);
    const r = menuRect(m, 480, TOUCH_MENU);
    let found: [number, number] | null = null;
    for (let x = r.x + r.w - 1; x > r.x && !found; x--)
      for (let y = r.y; y < r.y + r.h; y++) if (menuInfoAt(m, x, y, 480, TOUCH_MENU) === 0) { found = [x, y]; break; }
    expect(found).not.toBeNull();
    // Its blue spans about twice the mark's side.
    const [x, y] = found!;
    expect(blue(s, x - 15, y - 1, 16, 16)).toBeGreaterThan(80);
  });
});
