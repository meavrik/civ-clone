import { describe, expect, it } from "vitest";
import { ADVANCES, applyCommand, newGame } from "@civ/core";
import {
  canResearch,
  comesLater,
  keepResearchInView,
  nextChoice,
  openResearch,
  researchBand,
  researchHint,
  researchRows,
  researchStep,
  researchTarget,
  researchTitle,
  techDetails,
  techIcons,
  techPath,
  techStatus,
  type ResearchRow,
} from "../src/index.js";

const ids = (rows: ResearchRow[], group: string) => rows.flatMap((r) => (r.kind === "advance" && r.group === group ? [r.id] : []));

describe("research panel: where each advance stands", () => {
  it("tells discovered, researching, can research and later apart, with what each brings", () => {
    const state = newGame(2026);
    const p = state.players[0]!;
    p.advances.push("alphabet", "bronze_working");
    applyCommand(state, { type: "research", advance: "writing" });
    expect(techStatus(state, "alphabet")).toBe("known");
    expect(techStatus(state, "writing")).toBe("researching");
    expect(techStatus(state, "currency")).toBe("available");
    expect(techStatus(state, "philosophy")).toBe("locked");

    const bronze = techDetails(state, "bronze_working");
    expect(bronze.standing).toBe("Discovered");
    expect(bronze.rows.find((r) => r.label === "Wonders")?.items).toContain("Colossus");
    expect(bronze.opens.map((o) => o.name)).toEqual(expect.arrayContaining(["Currency", "Iron Working"]));
    const monarchy = techDetails(state, "monarchy");
    expect(monarchy.rows.find((r) => r.label === "Government")?.items).toEqual(["Monarchy"]);
    expect(monarchy.standing).toBe("Later: needs Ceremonial Burial and Code of Laws first (3 steps)");
    expect(monarchy.needs.map((n) => [n.id, n.status])).toEqual([["ceremonial_burial", "available"], ["code_of_laws", "available"]]);
    expect(techPath(state, "monarchy")).toEqual(expect.arrayContaining(["ceremonial_burial", "code_of_laws", "monarchy"]));
    expect(techDetails(state, "iron_working").rows.find((r) => r.label === "Units")?.items[0]).toMatch(/^Legion \d+\/\d+\/\d+$/);
    expect(techDetails(state, "railroad").rows.find((r) => r.label === "Settlers")?.items).toEqual(["Lay railroads"]);
    expect(techDetails(state, "currency").standing).toMatch(/^Can research now/);
    expect(techDetails(state, "writing").standing).toMatch(/^Researching: \d+\/\d+ beakers/);
    // What an advance opens the way to says what else each of those needs.
    const literacy = techDetails(state, "writing").opens.find((o) => o.id === "literacy")!;
    expect(literacy.also).toEqual(["code_of_laws"]);
    expect(techIcons(state, "bronze_working")).toContain("star");
  });

  it("says what Weaving and Animal Husbandry do to the land", () => {
    const state = newGame(2026);
    expect(techDetails(state, "animal_husbandry").rows.find((r) => r.label === "Food")?.items).toEqual(["Horses +1", "Game +1", "Seals +1"]);
    expect(techDetails(state, "weaving").rows.find((r) => r.label === "Ends wear")?.items).toEqual(["Arctic"]);
    expect(techDetails(state, "medicine").rows.find((r) => r.label === "Ends wear")).toBeUndefined();
    expect(techDetails(newGame(2026, { classicAdvances: true }), "medicine").rows.find((r) => r.label === "Ends wear")?.items).toEqual(["Arctic"]);
  });
});

describe("research panel: the list", () => {
  it("lists what can be researched now, what comes later and what is discovered, nothing further", () => {
    const state = newGame(2026, { classicCivs: true });
    const p = state.players[0]!;
    p.advances.push("alphabet");
    const rows = researchRows(state, { discovered: [] });
    expect(rows.filter((r) => r.kind === "header").map((r) => r.kind === "header" && r.group)).toEqual(["next", "later", "known"]);
    expect(ids(rows, "next")).toEqual(expect.arrayContaining(["writing", "code_of_laws", "map_making"]));
    expect(ids(rows, "next").length).toBe(9); // six roots left, and Writing, Code of Laws, Map Making
    expect(ids(rows, "later")).toContain("literacy"); // Writing and Code of Laws can both be researched now
    expect(comesLater(state, "literacy")).toBe(true);
    expect(ids(rows, "later")).not.toContain("the_republic"); // it needs Literacy, itself only coming later
    expect(ids(rows, "known")).toEqual(["alphabet"]);
    for (const id of ids(rows, "later")) expect(techStatus(state, id)).toBe("locked");
  });

  it("puts the research under way first, then what the latest find brought within reach, once each", () => {
    const state = newGame(2026);
    const p = state.players[0]!;
    p.advances.push("alphabet", "ceremonial_burial", "code_of_laws");
    let next = ids(researchRows(state, { discovered: ["code_of_laws"] }), "next");
    expect(next[0]).toBe("monarchy");
    expect(researchRows(state, { discovered: ["code_of_laws"] }).find((r) => r.kind === "advance" && r.id === "monarchy")).toMatchObject({ unlocked: true });
    applyCommand(state, { type: "research", advance: "writing" });
    next = ids(researchRows(state, { discovered: [] }), "next");
    expect(next[0]).toBe("writing");
    expect(next.filter((id) => id === "writing").length).toBe(1);
    // Discovered, newest first.
    expect(ids(researchRows(state, { discovered: [] }), "known").slice(0, 3)).toEqual(["code_of_laws", "ceremonial_burial", "alphabet"]);
  });

  it("opens on the research under way, else on what the find brought within reach, and keeps the selection in view", () => {
    const state = newGame(2026);
    const p = state.players[0]!;
    p.advances.push("alphabet", "ceremonial_burial", "code_of_laws");
    const found = openResearch(state, 17, { discovered: ["code_of_laws"], choosing: true, closable: false });
    expect(found.selected).toBe("monarchy");
    expect(researchTitle(state, found)).toBe("Wise men discover Code of Laws!");
    expect(researchBand(state, found)).toBe("Code of Laws brings {house}Courthouse");
    applyCommand(state, { type: "research", advance: "writing" });
    const browsing = openResearch(state, 17, { choosing: true, closable: true });
    expect(browsing.selected).toBe("writing");
    expect(researchTitle(state, browsing)).toBe("Research");
    expect(researchBand(state, browsing)).toBeNull(); // the band shows the progress instead
    p.researching = null;
    expect(researchTitle(state, openResearch(state, 17, { choosing: true, closable: false }))).toBe("Wise men ask: what shall we research?");
    // Late on the list is long: the selection scrolls into view.
    p.advances = ADVANCES.map((a) => a.id).filter((id) => id !== "quantum_computing");
    const late = openResearch(state, 5, { choosing: false, closable: true });
    late.selected = "alphabet"; // the oldest find, at the bottom
    keepResearchInView(state, late, 5);
    const rows = researchRows(state, late);
    const at = rows.findIndex((r) => r.kind === "advance" && r.id === "alphabet");
    expect(at).toBeGreaterThanOrEqual(late.top);
    expect(at).toBeLessThan(late.top + 5);
  });

  it("steps through the advances, skipping headings, and tabs through the choices", () => {
    const state = newGame(2026, { classicCivs: true });
    state.players[0]!.advances.push("alphabet");
    const view = openResearch(state, 17, { choosing: true, closable: false });
    const rows = researchRows(state, view).filter((r) => r.kind === "advance");
    expect(view.selected).toBe(rows[0]!.kind === "advance" ? rows[0]!.id : "");
    const second = researchStep(state, view, 1);
    expect(second).not.toBe(view.selected);
    expect(researchStep(state, view, -1)).toBe(view.selected); // held at the top
    expect(researchStep(state, view, 1000)).toBe("alphabet"); // the end: the oldest find
    const open = new Set<string>();
    for (let i = 0; i < 12; i++) { view.selected = nextChoice(state, view); open.add(view.selected); }
    for (const id of open) expect(techStatus(state, id)).toBe("available");
    expect(open.size).toBe(9);
  });
});

describe("research panel: what to research", () => {
  it("researches the advance itself, or the first step toward one further on, only where research is picked", () => {
    const state = newGame(2026);
    state.players[0]!.advances.push("alphabet");
    const view = openResearch(state, 17, { discovered: ["alphabet"], choosing: true, closable: false });
    view.selected = "writing";
    expect(researchTarget(state, view)).toBe("writing");
    expect(researchHint(state, view)).toBe("Enter: research");
    view.selected = "literacy";
    expect(researchTarget(state, view)).toBe("writing");
    expect(researchHint(state, view)).toBe("First step toward Literacy");
    view.selected = "alphabet";
    expect(canResearch(state, view)).toBe(false); // discovered
    expect(researchHint(state, view)).toBe("Tab: the choices");
    applyCommand(state, { type: "research", advance: "code_of_laws" });
    view.selected = "literacy";
    expect(researchTarget(state, view)).toBeNull(); // the research under way is a step toward it
    expect(researchHint(state, view)).toBe("On the way: Code of Laws");
    expect(researchTarget(state, { ...view, selected: "writing", choosing: false })).toBeNull();
  });
});
