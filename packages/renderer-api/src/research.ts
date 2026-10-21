import {
  advance,
  advancesFor,
  attritionCure,
  availableAdvances,
  BUILDINGS,
  computeCity,
  government,
  researchCost,
  SPACE_PARTS,
  Terrain,
  TERRAIN_NAMES,
  TERRAIN_RULES,
  UNIT_TYPES,
  WONDERS,
  type GameState,
} from "@civ/core";
import type { IconName } from "./icons.js";

/**
 * The research panel: where the next research is picked, shown when an
 * advance is found, when research is due, and from the status panel, the
 * science advisor and the Advisors menu. It is built round the choice: a list
 * of what can be researched now, what comes later (the advances one step
 * further, as a hint of what lies ahead) and what is discovered, beside a card
 * for the selected advance (what it brings, what it needs, what it opens the
 * way to), under a band with the research under way.
 */

// ---- where each advance stands for the current player ------------------------------

export type TechStatus = "known" | "researching" | "available" | "locked";

export function techStatus(state: GameState, id: string): TechStatus {
  const p = state.players[state.currentPlayer]!;
  if (p.advances.includes(id)) return "known";
  if (p.researching === id) return "researching";
  const a = advancesFor(state).find((x) => x.id === id);
  return a && a.requires.every((r) => p.advances.includes(r)) ? "available" : "locked";
}

/** A locked advance one step further: everything it needs is known or can be researched now. */
export function comesLater(state: GameState, id: string): boolean {
  const a = advancesFor(state).find((x) => x.id === id);
  return !!a && techStatus(state, id) === "locked" && a.requires.every((r) => techStatus(state, r) !== "locked");
}

/** Beakers the current player's cities make each turn. */
export function sciencePerTurn(state: GameState): number {
  let sum = 0;
  for (const c of state.cities) if (c.owner === state.currentPlayer) sum += computeCity(state, c).science;
  return sum;
}

/** The current player's research as the status panels show it. */
export interface ResearchOutlook {
  /** The advance under study, or null while none is picked. */
  id: string | null;
  name: string;
  /** Beakers gathered toward it and what it costs. */
  have: number;
  cost: number;
  /** Turns until it is found at this rate, or null while no science comes in. */
  turns: number | null;
}

export function researchOutlook(state: GameState): ResearchOutlook {
  const p = state.players[state.currentPlayer]!;
  const cost = researchCost(p.advances.length, p.difficulty);
  const perTurn = sciencePerTurn(state);
  const turns = perTurn > 0 ? Math.max(1, Math.ceil((cost - p.science) / perTurn)) : null;
  const id = p.researching;
  return { id, name: id ? advance(id).name : "", have: p.science, cost, turns };
}

/** Unknown advances that must come first, the advance itself last, in tree order. */
export function techPath(state: GameState, id: string): string[] {
  const known = new Set(state.players[state.currentPlayer]!.advances);
  const tree = advancesFor(state);
  const rule = (a: string) => tree.find((x) => x.id === a);
  const depth = (a: string): number => Math.max(0, ...(rule(a)?.requires ?? []).map((r) => 1 + depth(r)));
  const need = new Set<string>();
  const visit = (a: string): void => {
    if (known.has(a) || need.has(a)) return;
    need.add(a);
    for (const r of rule(a)?.requires ?? []) visit(r);
  };
  visit(id);
  return [...need].sort((a, b) => depth(a) - depth(b) || tree.indexOf(rule(a)!) - tree.indexOf(rule(b)!));
}

export interface TechLink {
  id: string;
  name: string;
  status: TechStatus;
  /** For an advance it opens the way to: what else it still needs (ids; none: it can be researched once this is). */
  also: string[];
}

export interface TechDetails {
  name: string;
  status: TechStatus;
  /** Where it stands for us, in one line: discovered, how far the research is, or what it still needs. */
  standing: string;
  /** What it brings, a row per kind (units, improvements...). */
  rows: { icon: IconName; label: string; items: string[] }[];
  /** What it needs, and the advances it opens the way to (even those not in sight yet). */
  needs: TechLink[];
  opens: TechLink[];
}

/** Settler work the engine unlocks by advance (see `workOptions` in core). */
const SETTLER_WORK: Record<string, string> = { railroad: "Lay railroads", construction: "Build fortresses" };

const and = (names: string[]): string =>
  names.length <= 1 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;

/** Turns a research takes at today's rate, in words. */
function eta(state: GameState): string {
  const o = researchOutlook(state);
  const left = Math.max(0, o.cost - o.have);
  const perTurn = sciencePerTurn(state);
  if (perTurn <= 0) return "no science yet";
  const turns = Math.max(1, Math.ceil(left / perTurn));
  return `about ${turns} turn${turns === 1 ? "" : "s"}`;
}

/** What an advance gives and how near it is, for the card beside the list. */
export function techDetails(state: GameState, id: string): TechDetails {
  const tree = advancesFor(state);
  const a = tree.find((x) => x.id === id) ?? advance(id);
  const p = state.players[state.currentPlayer]!;
  const status = techStatus(state, id);
  const o = researchOutlook(state);
  let standing: string;
  if (status === "known") standing = "Discovered";
  else if (status === "researching") standing = `Researching: ${o.have}/${o.cost} beakers, ${eta(state)}`;
  else if (status === "available") standing = `Can research now: ${eta(state)}`;
  else {
    const missing = a.requires.filter((r) => !p.advances.includes(r)).map((r) => advance(r).name);
    standing = `Later: needs ${and(missing)} first (${techPath(state, id).length} steps)`;
  }
  const rows: TechDetails["rows"] = [];
  const add = (icon: IconName, label: string, items: string[]): void => { if (items.length) rows.push({ icon, label, items }); };
  add("crown", "Government", a.government ? [government(a.government).name] : []);
  add("swords", "Units", UNIT_TYPES.filter((u) => u.requires === id).map((u) => `${u.name} ${u.attack}/${u.defense}/${u.moves}`));
  add("house", "Buildings", [
    ...BUILDINGS.filter((b) => b.requires === id).map((b) => b.name),
    ...SPACE_PARTS.filter((s) => s.requires === id).map((s) => s.name),
  ]);
  add("star", "Wonders", WONDERS.filter((w) => w.requires === id).map((w) => w.name));
  add(id === "railroad" ? "railroad" : "fortress", "Settlers", SETTLER_WORK[id] ? [SETTLER_WORK[id]!] : []);
  // What it does to the land: what it adds to specials (pastures, whalers, refineries), wear it ends.
  const terrains = Object.entries(TERRAIN_RULES).map(([t, r]) => ({ name: TERRAIN_NAMES[Number(t) as Terrain], r }));
  const boosted = terrains.flatMap(({ r }) => [r.special, state.oneSpecial ? undefined : r.second]).filter((sp) => sp?.learned?.advance === id);
  const gains = (kind: "food" | "shields" | "trade") => [...new Set(boosted.filter((sp) => sp!.learned![kind]).map((sp) => `${sp!.name} +${sp!.learned![kind]}`))];
  add("food", "Food", gains("food"));
  add("shield", "Shields", gains("shields"));
  add("trade", "Trade", gains("trade"));
  add("heart", "Ends wear", terrains.filter(({ r }) => r.attrition && attritionCure(state, r.attrition) === id).map(({ name }) => name));
  add("hourglass", "Ends", WONDERS.filter((w) => w.obsolete === id).map((w) => w.name));
  const link = (x: string, also: string[] = []): TechLink => ({ id: x, name: advance(x).name, status: techStatus(state, x), also });
  const needs = a.requires.map((r) => link(r));
  const opens = tree.filter((n) => n.requires.includes(id))
    .map((n) => link(n.id, n.requires.filter((r) => r !== id && !p.advances.includes(r))));
  return { name: a.name, status, standing, rows, needs, opens };
}

/** The pictures for what an advance brings, at most three, for its row in the list. */
export function techIcons(state: GameState, id: string): IconName[] {
  return [...new Set(techDetails(state, id).rows.map((r) => r.icon))].slice(0, 3);
}

// ---- the panel's view state and its navigation ----------------------------------------

export interface ResearchView {
  /** The advance whose card is shown. */
  selected: string;
  /** Advances just found, named in the title and the band, marked in the list. */
  discovered: string[];
  /** The next research can be picked here. */
  choosing: boolean;
  /** The panel can be closed without picking (Esc, the close button). */
  closable: boolean;
  /** First row of the list on view. */
  top: number;
  /** Blink phase, for the advances just found. */
  blink: boolean;
}

export type ResearchGroup = "next" | "later" | "known";

export type ResearchRow =
  | { kind: "header"; group: ResearchGroup; text: string }
  | {
    kind: "advance";
    id: string;
    group: ResearchGroup;
    status: TechStatus;
    /** Just discovered. */
    fresh: boolean;
    /** Brought within reach by what was just discovered. */
    unlocked: boolean;
  };

export type ResearchHit =
  | { kind: "row"; id: string }
  | { kind: "link"; id: string } // an advance named on the card: show its card
  | { kind: "research" }
  | { kind: "close" }
  | { kind: "scroll"; by: number };

/**
 * The list, group by group: what can be researched now (the research under
 * way first, then what the latest find brought within reach, then the rest
 * in tree order), what comes later, and what is discovered, newest first.
 */
export function researchRows(state: GameState, view: Pick<ResearchView, "discovered">): ResearchRow[] {
  const p = state.players[state.currentPlayer]!;
  const tree = advancesFor(state);
  const fresh = new Set(view.discovered);
  const unlockedBy = (id: string) => tree.find((a) => a.id === id)!.requires.some((r) => fresh.has(r));
  const rows: ResearchRow[] = [];
  const group = (g: ResearchGroup, text: string, ids: string[]): void => {
    if (!ids.length) return;
    rows.push({ kind: "header", group: g, text });
    for (const id of ids) rows.push({ kind: "advance", id, group: g, status: techStatus(state, id), fresh: fresh.has(id), unlocked: g === "next" && unlockedBy(id) });
  };
  const open = availableAdvances(p.advances, tree).map((a) => a.id).filter((id) => id !== p.researching);
  const next = [...(p.researching ? [p.researching] : []), ...open.filter((id) => unlockedBy(id)), ...open.filter((id) => !unlockedBy(id))];
  group("next", "Research next", next);
  group("later", "Coming later", tree.filter((a) => comesLater(state, a.id)).map((a) => a.id));
  group("known", `Discovered (${p.advances.length})`, [...p.advances].reverse());
  return rows;
}

function advanceRows(state: GameState, view: ResearchView): Extract<ResearchRow, { kind: "advance" }>[] {
  return researchRows(state, view).filter((r): r is Extract<ResearchRow, { kind: "advance" }> => r.kind === "advance");
}

/**
 * What the Research button studies for the selected advance: the advance
 * itself when it can be researched now; for one further on, the first step
 * toward it (null when the research under way is already a step toward it);
 * null when it is discovered, under study, or nothing may be chosen here.
 */
export function researchTarget(state: GameState, view: Pick<ResearchView, "selected" | "choosing">): string | null {
  if (!view.choosing) return null;
  const status = techStatus(state, view.selected);
  if (status === "available") return view.selected;
  if (status !== "locked") return null;
  const path = techPath(state, view.selected);
  if (path.some((id) => techStatus(state, id) === "researching")) return null;
  return path.find((id) => techStatus(state, id) === "available") ?? null;
}

/** True when the panel offers research for the selected advance (itself, or the first step toward it). */
export function canResearch(state: GameState, view: Pick<ResearchView, "selected" | "choosing">): boolean {
  return researchTarget(state, view) !== null;
}

/** How the player's tree stands: advances discovered, those that can be researched now, and all there are. */
export function techTally(state: GameState): { known: number; open: number; total: number } {
  const p = state.players[state.currentPlayer]!;
  const tree = advancesFor(state);
  return { known: p.advances.length, open: availableAdvances(p.advances, tree).length, total: tree.length };
}

/** The panel's title: what was just found, the question asked when research is due, or plain "Research". */
export function researchTitle(state: GameState, view: ResearchView): string {
  const found = view.discovered.map((d) => advance(d).name);
  if (found.length) return `Wise men discover ${and(found)}!`;
  return view.choosing && !state.players[state.currentPlayer]!.researching ? "Wise men ask: what shall we research?" : "Research";
}

/**
 * The band under the title when no research is under way: what the advance
 * just found brings, or the call to choose. Null while research is under way
 * (the band shows its progress instead).
 */
export function researchBand(state: GameState, view: ResearchView): string | null {
  const first = view.discovered[0];
  if (first) {
    const d = techDetails(state, first);
    const gifts = d.rows.flatMap((r) => r.items.map((i) => `{${r.icon}}${i.replace(/ \d+\/\d+\/\d+$/, "")}`));
    if (gifts.length) return `${d.name} brings ${gifts.join("  ")}`;
    return `${d.name} opens the way to ${and(d.opens.map((o) => o.name))}`;
  }
  if (state.players[state.currentPlayer]!.researching) return null;
  return view.choosing ? "Pick what to research next" : "Nothing under study";
}

/** The line along the bottom telling the player what to do next. */
export function researchHint(state: GameState, view: ResearchView): string {
  const target = researchTarget(state, view);
  if (target && target !== view.selected) return `First step toward ${advance(view.selected).name}`;
  if (target) return "Enter: research";
  if (!view.choosing) return "Up/Down: look";
  const researching = state.players[state.currentPlayer]!.researching;
  const status = techStatus(state, view.selected);
  if (status === "locked" && researching) return `On the way: ${advance(researching).name}`;
  if (status === "researching") return "Under way";
  return "Tab: the choices";
}

/** Open the panel on the research under way, else the first advance the latest find brought within reach, else the first choice. */
export function openResearch(state: GameState, listRows: number, opts: { discovered?: string[]; choosing: boolean; closable: boolean }): ResearchView {
  const p = state.players[state.currentPlayer]!;
  const discovered = opts.discovered ?? [];
  const rows = researchRows(state, { discovered });
  const first = rows.find((r) => r.kind === "advance" && r.group === "next");
  const selected = p.researching ?? (first?.kind === "advance" ? first.id : undefined) ?? discovered[0] ?? p.advances[p.advances.length - 1] ?? advancesFor(state)[0]!.id;
  const view: ResearchView = { selected, discovered, choosing: opts.choosing, closable: opts.closable, top: 0, blink: true };
  keepResearchInView(state, view, listRows);
  return view;
}

/** The list row of an advance, or -1 when it is not listed (an advance reached through the card). */
export function researchRowOf(state: GameState, view: ResearchView, id: string): number {
  return researchRows(state, view).findIndex((r) => r.kind === "advance" && r.id === id);
}

/** Scroll the list so the selected advance shows, its group's heading too where it fits. */
export function keepResearchInView(state: GameState, view: ResearchView, listRows: number): void {
  const rows = researchRows(state, view);
  const at = researchRowOf(state, view, view.selected);
  const max = Math.max(0, rows.length - listRows);
  if (at >= 0) {
    const head = at > 0 && rows[at - 1]!.kind === "header" ? at - 1 : at;
    if (head < view.top) view.top = head;
    else if (at >= view.top + listRows) view.top = at - listRows + 1;
  }
  view.top = Math.max(0, Math.min(max, view.top));
}

/** The advance `by` rows on in the list (skipping headings), held at its ends; from an advance off the list, the first. */
export function researchStep(state: GameState, view: ResearchView, by: number): string {
  const list = advanceRows(state, view);
  if (!list.length) return view.selected;
  const at = list.findIndex((r) => r.id === view.selected);
  if (at < 0) return list[0]!.id;
  return list[Math.max(0, Math.min(list.length - 1, at + by))]!.id;
}

/** The next advance that can be researched now after the selected one (before it when `dir` is -1), wrapping round. */
export function nextChoice(state: GameState, view: ResearchView, dir = 1): string {
  const list = advanceRows(state, view).filter((r) => r.status === "available");
  if (!list.length) return view.selected;
  const at = list.findIndex((r) => r.id === view.selected);
  if (at < 0) return (dir > 0 ? list[0]! : list[list.length - 1]!).id;
  return list[(at + dir + list.length) % list.length]!.id;
}
