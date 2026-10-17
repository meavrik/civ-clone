import { describe, expect, it } from "vitest";
import { ADVANCES, applyCommand, newGame } from "@civ/core";
import {
  canResearch,
  nextAvailable,
  openTechTree,
  techDetails,
  techLayout,
  techPath,
  techScrollShowing,
  techStatus,
  techStep,
  techTreeTitle,
} from "../src/index.js";

describe("tech tree layout", () => {
  it("places every advance once, after everything it needs, no two in one place", () => {
    const { nodes, byId, tiers, rows } = techLayout();
    expect(nodes.length).toBe(ADVANCES.length);
    expect(tiers).toBe(19);
    expect(rows).toBe(8);
    const seen = new Set<string>();
    for (const n of nodes) {
      expect(n.row).toBeGreaterThanOrEqual(0);
      expect(n.row).toBeLessThan(rows);
      const key = `${n.tier},${n.row}`;
      expect(seen.has(key), `${n.id} shares ${key}`).toBe(false);
      seen.add(key);
      for (const r of n.requires) expect(byId.get(r)!.tier).toBeLessThan(n.tier);
      // A tier is the longest chain beneath: some prerequisite sits in the tier just before.
      if (n.requires.length) expect(Math.max(...n.requires.map((r) => byId.get(r)!.tier))).toBe(n.tier - 1);
      for (const l of n.leadsTo) expect(byId.get(l)!.requires).toContain(n.id);
    }
    expect(byId.get("alphabet")!.tier).toBe(0);
    expect(byId.get("future_tech")!.tier).toBe(tiers - 1);
  });

  it("keeps edges short: an advance sits within a few rows of what it needs", () => {
    const { nodes, byId } = techLayout();
    const drop = nodes.flatMap((n) => n.requires.map((r) => Math.abs(byId.get(r)!.row - n.row)));
    expect(drop.reduce((a, b) => a + b, 0) / drop.length).toBeLessThan(1.5);
  });
});

describe("tech tree state", () => {
  it("tells known, researching, within reach and locked apart, with what each brings", () => {
    const state = newGame(2026);
    const p = state.players[0]!;
    p.advances.push("alphabet", "bronze_working");
    applyCommand(state, { type: "research", advance: "writing" });
    expect(techStatus(state, "alphabet")).toBe("known");
    expect(techStatus(state, "writing")).toBe("researching");
    expect(techStatus(state, "currency")).toBe("available");
    expect(techStatus(state, "philosophy")).toBe("locked");

    const bronze = techDetails(state, "bronze_working");
    expect(bronze.standing).toBe("Known");
    expect(bronze.rows.find((r) => r.label === "Wonders")?.items).toContain("Colossus");
    expect(bronze.rows.find((r) => r.label === "Leads to")?.items).toEqual(expect.arrayContaining(["Currency", "Iron Working"]));
    const monarchy = techDetails(state, "monarchy");
    expect(monarchy.rows.find((r) => r.label === "Government")?.items).toEqual(["Monarchy"]);
    expect(monarchy.standing).toMatch(/^Needs Ceremonial Burial and Code of Laws, 3 advances away$/);
    expect(techPath(state, "monarchy")).toEqual(expect.arrayContaining(["ceremonial_burial", "code_of_laws", "monarchy"]));
    expect(techDetails(state, "iron_working").rows.find((r) => r.label === "Units")?.items[0]).toMatch(/^Legion \d+\/\d+\/\d+$/);
    expect(techDetails(state, "railroad").rows.find((r) => r.label === "Settlers")?.items).toEqual(["Lay railroads"]);
    expect(techDetails(state, "currency").standing).toMatch(/^Within reach/);
    expect(techDetails(state, "writing").standing).toMatch(/^Researching: \d+\/\d+ beakers/);
  });

  it("opens on the advance just found, offers only advances within reach, and names the find", () => {
    const state = newGame(2026);
    state.players[0]!.advances.push("alphabet");
    const tree = openTechTree(state, 4, { discovered: ["alphabet"], choosing: true, closable: false });
    expect(tree.selected).toBe("alphabet");
    expect(tree.scroll).toBe(0);
    expect(techTreeTitle(tree)).toBe("Wise men discover Alphabet!");
    expect(canResearch(state, tree)).toBe(false);
    tree.selected = "writing";
    expect(canResearch(state, tree)).toBe(true);
    tree.selected = "literacy";
    expect(canResearch(state, tree)).toBe(false);
    expect(techTreeTitle({ ...tree, discovered: [] })).toBe("Wise men ask: what shall we research?");
    expect(techTreeTitle({ ...tree, discovered: ["alphabet", "masonry"] })).toBe("Wise men discover Alphabet and Masonry!");
    // Without a find it opens on the first advance within reach, the deep ones centred.
    const fresh = openTechTree(newGame(1), 4, { choosing: true, closable: false });
    expect(techStatus(newGame(1), fresh.selected)).toBe("available");
    state.players[0]!.advances.push(...ADVANCES.filter((a) => a.id !== "future_tech" && a.id !== "fusion_power").map((a) => a.id));
    const late = openTechTree(state, 4, { discovered: ["superconductor"], choosing: true, closable: true });
    expect(late.scroll).toBe(techLayout().tiers - 4);
  });

  it("steps with the arrows to neighbours in the grid and tabs through the choices", () => {
    const { byId } = techLayout();
    const right = byId.get(techStep("alphabet", 1, 0))!;
    expect(right.tier).toBe(1);
    expect(Math.abs(right.row - byId.get("alphabet")!.row)).toBeLessThanOrEqual(1);
    expect(techStep("alphabet", -1, 0)).toBe("alphabet");
    expect(techStep("future_tech", 1, 0)).toBe("future_tech");
    const down = byId.get(techStep("alphabet", 0, 1))!;
    expect(down.tier).toBe(0);
    expect(down.row).toBeGreaterThan(byId.get("alphabet")!.row);

    const state = newGame(2026, { classicCivs: true });
    state.players[0]!.advances.push("alphabet");
    const open = new Set<string>();
    let at = "alphabet";
    for (let i = 0; i < 12; i++) { at = nextAvailable(state, at); open.add(at); }
    for (const id of open) expect(techStatus(state, id)).toBe("available");
    expect(open.size).toBe(9); // six roots left, and Writing, Code of Laws, Map Making
    expect(nextAvailable(state, nextAvailable(state, "writing"), -1)).toBe("writing");
  });

  it("scrolls only as far as needed to show a tier whole", () => {
    expect(techScrollShowing(0, 2, 3.5)).toBe(0);
    expect(techScrollShowing(0, 5, 3.5)).toBe(2.5);
    expect(techScrollShowing(6, 2, 3.5)).toBe(2);
    expect(techScrollShowing(0, 18, 3.5)).toBe(15.5);
  });
});
