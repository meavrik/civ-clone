import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { ADVANCES, CLASSIC_ADVANCES, newGame } from "@civ/core";
import { newTechCard, techPicture } from "@civ/renderer-api";
import { describe, expect, it } from "vitest";
import { wrapText } from "../src/font.js";
import { drawNewTech, NEW_TECH_PICTURE, NEW_TECH_TEXT_W, newTechHit } from "../src/index.js";
import { Surface } from "../src/surface.js";
import { encodePng } from "./png.js";

describe("New Technology window", () => {
  it("has the user's picture for every advance of the tree new games play, and a square frame for it", () => {
    for (const a of ADVANCES) {
      expect(techPicture(a.id), a.id).toBe(a.id);
      expect(existsSync(new URL(`../../../apps/web/src/techs/${a.id}.webp`, import.meta.url)), a.id).toBe(true);
    }
    expect(techPicture("future_tech")).toBeNull();
    expect(NEW_TECH_PICTURE.w).toBe(NEW_TECH_PICTURE.h);
  });

  it("describes every advance of either tree in three lines at most", () => {
    for (const a of [...ADVANCES, ...CLASSIC_ADVANCES]) {
      expect(a.text.length, a.id).toBeGreaterThan(20);
      expect(wrapText(a.text, NEW_TECH_TEXT_W).length, a.id).toBeLessThanOrEqual(3);
    }
  });

  it("lists what an advance unlocks, or the advances it leads to when it brings nothing itself", () => {
    const state = newGame(5, { opponents: 2 });
    const wheel = newTechCard(state, "the_wheel");
    expect(wheel.unlocks.some((u) => u.unit === "chariot" && u.kind === "unit")).toBe(true);
    expect(wheel.era).toBe("Ancient Era");
    const alphabet = newTechCard(state, "alphabet");
    expect(alphabet.leads).toBe(true);
    expect(alphabet.unlocks.map((u) => u.name)).toContain("Writing");
    expect(alphabet.needs).toEqual([]);
    expect(newTechCard(state, "monarchy").unlocks.some((u) => u.kind === "government")).toBe(true);
    expect(newTechCard(state, "chivalry").needs.map((n) => n.name)).toEqual(["Feudalism", "Horseback Riding"]);
  });

  it("draws the window after the user's template, its buttons and close box answering to clicks", () => {
    const state = newGame(5, { opponents: 2 });
    const s = Surface.screen();
    mkdirSync(new URL("./out/", import.meta.url), { recursive: true });
    for (const id of ["alphabet", "the_wheel", "monarchy", "bronze_working", "industrialization", "railroad", "artificial_intelligence", "the_corporation"]) {
      drawNewTech(s, state, { advance: id, selected: 1 });
      writeFileSync(new URL(`./out/newtech-${id}.png`, import.meta.url), encodePng(s, 3));
    }
    const view = { advance: "alphabet", selected: 1 };
    const hits = new Set<string | null>();
    for (let y = 0; y < 200; y++) for (let x = 0; x < 320; x++) hits.add(newTechHit(view, x, y));
    expect([...hits].sort()).toEqual(["close", "continue", "tree", null].sort());
    expect(newTechHit(view, 30, 190)).toBe("tree");
    expect(newTechHit(view, 290, 190)).toBe("continue");
  });
});
