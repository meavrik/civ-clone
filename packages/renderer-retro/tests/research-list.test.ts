import { writeFileSync } from "node:fs";
import { ADVANCES, advance, applyCommand, availableAdvances, advancesFor, CLASSIC_ADVANCES, newGame, type GameState } from "@civ/core";
import { advanceInfo, advanceTip, menuButtons, techPictures, type MenuState } from "@civ/renderer-api";
import { describe, expect, it } from "vitest";
import { wrapText } from "../src/font.js";
import { advanceInfoHit, advanceInfoRect, drawAdvanceInfo, drawMenu, LEADS_ROWS, LEADS_TEXT_W, menuHit, menuInfoAt, menuMoreAt, menuRect, menuTipAt, shade, TOUCH_MENU } from "../src/index.js";
import { INFO_MARK, menuTipRect } from "../src/menu-info.js";
import { SCREEN_H, SCREEN_W, Surface } from "../src/surface.js";
import { encodePng } from "./png.js";

/** The list as the web app builds it (`openResearchList`). */
function researchList(state: GameState): MenuState {
  const p = state.players[0]!;
  const ids = availableAdvances(p.advances, advancesFor(state)).map((a) => a.id);
  return {
    title: p.researching ? `Researching ${advance(p.researching).name}: 5 turns left` : "Wise men ask: what shall we research?",
    items: ids.map((id) => advance(id).name),
    selected: Math.max(0, ids.indexOf(p.researching ?? "")),
    right: ids.map((id) => (id === p.researching ? "under way" : "")),
    trail: ids.map((id) => techPictures(id, p.color)),
    info: ids.map((id) => advanceTip(state, id)),
    more: true,
  };
}

/** The first point found on each row's mark, as `at` tells them. */
function marksOf(m: MenuState, r: { x: number; y: number; w: number; h: number }, at: (x: number, y: number) => number | null): Map<number, [number, number]> {
  const found = new Map<number, [number, number]>();
  for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) { const i = at(x, y); if (i !== null && !found.has(i)) found.set(i, [x, y]); }
  return found;
}

describe("research list", () => {
  it("lists every advance that can be researched now, small pictures of what each unlocks after its name, an info mark each", () => {
    const state = newGame(2026);
    state.players[0]!.advances.push("alphabet", "ceremonial_burial", "code_of_laws");
    const m = researchList(state);
    expect(menuButtons(m)).toBe(false); // a list, however few its rows
    expect(m.trail![m.items.indexOf("Masonry")]!.length).toBe(4);
    expect(m.trail![m.items.indexOf("Monarchy")]).toEqual([{ icon: "crown" }]);
    const s = Surface.screen();
    drawMenu(s, m);
    writeFileSync(new URL("./out/research-list.png", import.meta.url), encodePng(s, 3));
    // Small: the buildings' pictures no taller than the row's room, the window well inside the screen.
    const buildings = s.art.filter((a) => !a.unit);
    expect(buildings.length).toBeGreaterThan(0);
    for (const a of buildings) expect(a.h).toBeLessThanOrEqual(12);
    const r = menuRect(m);
    expect(r.w).toBeLessThan(280);
    // Each row's marks are hit, the arrow before the mark of more.
    const arrows = marksOf(m, r, (x, y) => menuInfoAt(m, x, y));
    const mores = marksOf(m, r, (x, y) => menuMoreAt(m, x, y));
    expect(arrows.size).toBe(m.items.length);
    expect(mores.size).toBe(m.items.length);
    expect(arrows.get(0)![0]).toBeLessThan(mores.get(0)![0]);
    // Under way: its row marked so.
    applyCommand(state, { type: "research", advance: "writing" });
    const browsing = researchList(state);
    expect(browsing.right![browsing.selected]).toBe("under way");
    drawMenu(s, browsing);
    writeFileSync(new URL("./out/research-list-under-way.png", import.meta.url), encodePng(s, 3));
  });

  it("shows what an advance unlocks and leads to in a tip from its arrow, which leaves the mark of more uncovered", () => {
    const state = newGame(2026);
    state.players[0]!.advances.push("alphabet", "ceremonial_burial", "code_of_laws");
    const m = researchList(state);
    const row = m.items.indexOf("Writing");
    const tip = m.info![row]!;
    expect(tip.title).toBe("Writing");
    expect(tip.lines).toContain("{swords}Units: Diplomat 0/0/2");
    expect(tip.lines).toContain("{house}Buildings: Library");
    expect(tip.lines).toContain("Leads to:");
    expect(tip.lines).toContain("{bulb}Literacy");
    // What else an advance further on waits for; what is known already is no next step.
    expect(tip.lines).toContain("{bulb}Religion with Philosophy");
    expect(advanceTip(state, "alphabet").lines).not.toContain("{bulb}Code of Laws");
    const r = menuRect(m);
    const [ax, ay] = marksOf(m, r, (x, y) => menuInfoAt(m, x, y)).get(row)!;
    const [mx, my] = marksOf(m, r, (x, y) => menuMoreAt(m, x, y)).get(row)!;
    m.infoShown = row;
    const s = Surface.screen();
    drawMenu(s, m);
    writeFileSync(new URL("./out/research-list-tip.png", import.meta.url), encodePng(s, 3));
    expect([ax - 20, mx + 20].some((x) => menuTipAt(m, x, ay + 2))).toBe(true);
    // Neither its row's mark of more nor any other is under the tip, wherever it stands.
    for (const [, [x, y]] of marksOf(m, r, (px, py) => menuMoreAt(m, px, py))) expect(menuTipAt(m, x + 2, y + 2)).toBe(false);
    expect(menuHit(m, mx + 2, my + 2)).toBe(row);
    expect([...s.data].filter((c) => c === shade("plains", 5)).length).toBeGreaterThan(30); // its arrow lit, gold
  });

  it("keeps both marks apart and the tip clear of them at the phone's large size", () => {
    const state = newGame(2026);
    state.players[0]!.advances.push("alphabet", "ceremonial_burial", "code_of_laws");
    const m = researchList(state);
    const r = menuRect(m, 480, TOUCH_MENU);
    expect(r.x + r.w).toBeLessThanOrEqual(480);
    const arrows = marksOf(m, r, (x, y) => menuInfoAt(m, x, y, 480, TOUCH_MENU));
    const mores = marksOf(m, r, (x, y) => menuMoreAt(m, x, y, 480, TOUCH_MENU));
    expect(arrows.size).toBe(mores.size);
    expect(arrows.size).toBeGreaterThan(0);
    for (const [row, [ax, ay]] of arrows) {
      const [mx, my] = mores.get(row)!;
      expect(mx).toBeGreaterThan(ax + INFO_MARK * 2); // side by side, each its own target
      m.infoShown = row;
      for (const [, [x, y]] of mores) expect(menuTipAt(m, x + 4, y + 4, 480, TOUCH_MENU)).toBe(false);
      expect(ay).toBe(my);
    }
    m.infoShown = [...arrows.keys()][1]!;
    const s = new Surface(480, SCREEN_H, undefined, 2);
    drawMenu(s, m, undefined, TOUCH_MENU);
    writeFileSync(new URL("./out/research-list-phone.png", import.meta.url), encodePng(s, 2));
  });

  it("keeps every advance's tip on the screen and never leaves one empty", () => {
    const state = newGame(2026);
    const screen = { x: 0, y: 0, w: SCREEN_W, h: SCREEN_H };
    for (const a of [...ADVANCES, ...CLASSIC_ADVANCES]) {
      const tip = advanceTip(state, a.id);
      expect(tip.lines.length, a.id).toBeGreaterThan(0);
      // From a mark at the head of a long list and at its foot.
      for (const y of [20, 185]) {
        const r = menuTipRect(tip, { x: 280, y, w: 7, h: 7 }, screen.w);
        expect(r.x, a.id).toBeGreaterThanOrEqual(screen.x);
        expect(r.x + r.w, a.id).toBeLessThanOrEqual(screen.w);
        expect(r.y, a.id).toBeGreaterThanOrEqual(screen.y);
        expect(r.y + r.h, a.id).toBeLessThanOrEqual(screen.h);
      }
    }
    expect(advanceTip(state, "future_tech").lines).toEqual(["Nothing further to unlock."]);
  });

  it("opens a window of more about an advance: what it is, its history, all it unlocks and what it leads to", () => {
    const state = newGame(2026);
    state.players[0]!.advances.push("alphabet");
    const s = Surface.screen();
    for (const id of ["writing", "masonry", "animal_husbandry", "bronze_working", "monarchy", "industrialization"]) {
      s.art = [];
      drawAdvanceInfo(s, state, { advance: id });
      writeFileSync(new URL(`./out/advance-info-${id}.png`, import.meta.url), encodePng(s, 3));
    }
    const writing = advanceInfo(state, "writing");
    expect(writing.history.length).toBeGreaterThan(40);
    expect(writing.unlocks.map((u) => u.text)).toEqual(["Library", "Diplomat 0/0/2"]);
    expect(writing.leads.map((l) => l.name)).toEqual(expect.arrayContaining(["Literacy"]));
    expect(advanceInfo(state, "masonry").unlocks.map((u) => u.text)).toContain("Pyramids (wonder)");
    expect(advanceInfo(state, "bronze_working").unlocks.map((u) => u.text)).toContain("Reveals Iron on the map");
    // The close box and a click off the window go back; inside it nothing.
    const o = advanceInfoRect();
    expect(advanceInfoHit({ advance: "writing" }, o.x + o.w - 10, o.y + 8)).toBe("close");
    expect(advanceInfoHit({ advance: "writing" }, o.x - 2, o.y + 20)).toBe("close");
    expect(advanceInfoHit({ advance: "writing" }, o.x + 100, o.y + 100)).toBeNull();
  });

  it("tells every advance's history in three lines, its unlocks and what it leads to in their panels", () => {
    const state = newGame(2026);
    for (const a of [...ADVANCES, ...CLASSIC_ADVANCES]) {
      expect(a.history.length, a.id).toBeGreaterThan(30);
      expect(/^[\x20-\x7e]*$/.test(a.history), a.id).toBe(true); // the font's letters only
      expect(wrapText(a.history, advanceInfoRect().w - 20).length, a.id).toBeLessThanOrEqual(3);
      const info = advanceInfo(state, a.id);
      expect(info.unlocks.length, a.id).toBeLessThanOrEqual(6); // two columns of three
      if (info.leads.length > LEADS_ROWS) expect(wrapText(info.leads.map((l) => l.name).join(", "), LEADS_TEXT_W).length, a.id).toBeLessThanOrEqual(LEADS_ROWS);
    }
  });
});
