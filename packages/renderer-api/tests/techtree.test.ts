import { describe, expect, it } from "vitest";
import { ADVANCES, applyCommand, CLASSIC_ADVANCES, newGame, type GameState } from "@civ/core";
import {
  canResearch,
  nextAvailable,
  openTechTree,
  techDetails,
  techLayout,
  techPath,
  techScrollShowing,
  techShown,
  techStatus,
  techStep,
  techTreeTitle,
} from "../src/index.js";

/** A game whose player knows every advance of its tree: the whole tree on show. */
function knowingAll(opts: { classicAdvances?: boolean } = {}): GameState {
  const state = newGame(2026, opts);
  state.players[0]!.advances = (opts.classicAdvances ? CLASSIC_ADVANCES : ADVANCES).map((a) => a.id);
  return state;
}

describe("tech tree layout", () => {
  it("places every advance once, after everything it needs, no two in one place", () => {
    const { nodes, byId, tiers, rows } = techLayout(knowingAll());
    expect(nodes.length).toBe(ADVANCES.length);
    expect(rows).toBeLessThanOrEqual(9); // what both windows fit at full spacing
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
    expect(byId.get("quantum_computing")!.tier).toBe(tiers - 1);
    // A game on the 1991 tree lays out that tree, Future Tech. last.
    const old = techLayout(knowingAll({ classicAdvances: true }));
    expect(old.nodes.length).toBe(CLASSIC_ADVANCES.length);
    expect(old.byId.get("future_tech")!.tier).toBe(old.tiers - 1);
    expect(old.rows).toBeLessThanOrEqual(9);
  });

  it("shows only what is known and within reach: the next phase, nothing beyond", () => {
    const state = newGame(2026, { classicCivs: true });
    state.players[0]!.advances.push("alphabet");
    const { nodes, byId, tiers } = techLayout(state);
    for (const n of nodes) expect(techStatus(state, n.id), n.id).not.toBe("locked");
    expect(byId.has("writing")).toBe(true);
    expect(byId.has("literacy")).toBe(false);
    expect(techShown(state, "literacy")).toBe(false);
    expect(nodes.length).toBe(1 + 9); // Alphabet, six roots, Writing, Code of Laws, Map Making
    expect(tiers).toBe(2);
    // What it leads to is told in the details all the same, for planning.
    expect(techDetails(state, "writing").rows.find((r) => r.label === "Leads to")?.items).toEqual(expect.arrayContaining(["Literacy"]));
  });

  it("says what Weaving and Animal Husbandry do to the land", () => {
    const state = newGame(2026);
    expect(techDetails(state, "animal_husbandry").rows.find((r) => r.label === "Food")?.items).toEqual(["Horses +1", "Game +1", "Seals +1"]);
    expect(techDetails(state, "weaving").rows.find((r) => r.label === "Ends wear")?.items).toEqual(["Arctic"]);
    expect(techDetails(state, "medicine").rows.find((r) => r.label === "Ends wear")).toBeUndefined();
    expect(techDetails(newGame(2026, { classicAdvances: true }), "medicine").rows.find((r) => r.label === "Ends wear")?.items).toEqual(["Arctic"]);
  });

  it("keeps edges short: an advance sits within a few rows of what it needs", () => {
    const { nodes, byId } = techLayout(knowingAll());
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
    state.players[0]!.advances.push(...ADVANCES.filter((a) => a.id !== "quantum_computing").map((a) => a.id));
    const late = openTechTree(state, 4, { discovered: ["superconductor"], choosing: true, closable: true });
    const tier = techLayout(state).byId.get("superconductor")!.tier;
    expect(late.scroll).toBeGreaterThan(0);
    expect(tier).toBeGreaterThanOrEqual(late.scroll);
    expect(tier).toBeLessThan(late.scroll + 4);
  });

  it("steps with the arrows to neighbours in the grid and tabs through the choices", () => {
    const all = knowingAll();
    const { byId } = techLayout(all);
    const right = byId.get(techStep(all, "alphabet", 1, 0))!;
    expect(right.tier).toBe(1);
    expect(Math.abs(right.row - byId.get("alphabet")!.row)).toBeLessThanOrEqual(1);
    expect(techStep(all, "alphabet", -1, 0)).toBe("alphabet");
    expect(techStep(all, "quantum_computing", 1, 0)).toBe("quantum_computing");
    const down = byId.get(techStep(all, "alphabet", 0, 1))!;
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
    expect(techScrollShowing(19, 0, 2, 3.5)).toBe(0);
    expect(techScrollShowing(19, 0, 5, 3.5)).toBe(2.5);
    expect(techScrollShowing(19, 6, 2, 3.5)).toBe(2);
    expect(techScrollShowing(19, 0, 18, 3.5)).toBe(15.5);
    expect(techScrollShowing(2, 0, 1, 3.5)).toBe(0); // a tree narrower than the window never scrolls
  });
});
