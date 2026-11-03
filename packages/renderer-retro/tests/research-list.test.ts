import { writeFileSync } from "node:fs";
import { ADVANCES, advance, applyCommand, availableAdvances, advancesFor, CLASSIC_ADVANCES, newGame, type GameState } from "@civ/core";
import { advanceInfo, menuButtons, techPictures, type MenuState } from "@civ/renderer-api";
import { describe, expect, it } from "vitest";
import { wrapText } from "../src/font.js";
import { advanceInfoHit, advanceInfoRect, drawAdvanceInfo, drawMenu, LEADS_ROWS, LEADS_TEXT_W, menuInfoAt, menuRect } from "../src/index.js";
import { Surface } from "../src/surface.js";
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
    info: ids.map((id) => ({ title: advance(id).name, lines: [] })),
  };
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
    // Each row's info mark is hit.
    const marked = new Set<number>();
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) { const i = menuInfoAt(m, x, y); if (i !== null) marked.add(i); }
    expect(marked.size).toBe(m.items.length);
    // Under way: its row marked so.
    applyCommand(state, { type: "research", advance: "writing" });
    const browsing = researchList(state);
    expect(browsing.right![browsing.selected]).toBe("under way");
    drawMenu(s, browsing);
    writeFileSync(new URL("./out/research-list-under-way.png", import.meta.url), encodePng(s, 3));
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
