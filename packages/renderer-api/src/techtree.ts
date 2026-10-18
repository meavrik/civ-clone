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
  type AdvanceRule,
  type GameState,
} from "@civ/core";
import type { IconName } from "./icons.js";

/**
 * The tech tree as a graph, shown when an advance is found and whenever the
 * next research is chosen. It holds only what the player knows and what is
 * within reach (the next phase); everything further on stays hidden until it
 * comes within reach. Every advance shown sits in a column, its tier (the
 * longest chain of shown prerequisites beneath it), and a row; both renderers
 * draw the same layout, a few columns at a time, scrolled by the web app. Rows
 * are ordered so that an advance sits near the ones it needs and the ones it
 * leads to, which keeps edges short.
 */

export interface TechNode {
  id: string;
  name: string;
  tier: number;
  row: number;
  /** Prerequisites and successors among the advances shown. */
  requires: string[];
  leadsTo: string[];
}

export interface TechLayout {
  nodes: TechNode[];
  byId: Map<string, TechNode>;
  /** Columns: the deepest advance's tier plus one. */
  tiers: number;
  /** Rows: the most advances any one tier holds. */
  rows: number;
}

/** True while an advance shows in the tree: known, under study, or within reach. */
export function techShown(state: GameState, id: string): boolean {
  return techStatus(state, id) !== "locked";
}

const layoutCache = new Map<string, TechLayout>();

/** The tree as the current player sees it: the advances shown, laid out in tiers and rows. */
export function techLayout(state: GameState): TechLayout {
  const tree = advancesFor(state);
  const shown = tree.filter((a) => techShown(state, a.id));
  const key = `${state.classicAdvances ? "1991" : "ours"}:${shown.map((a) => a.id).join(",")}`;
  const cached = layoutCache.get(key);
  if (cached) return cached;
  const layout = layOut(shown);
  if (layoutCache.size > 32) layoutCache.clear();
  layoutCache.set(key, layout);
  return layout;
}

function layOut(shown: readonly AdvanceRule[]): TechLayout {
  const ids = new Set(shown.map((a) => a.id));
  const needs = (a: AdvanceRule) => a.requires.filter((r) => ids.has(r));
  const tierOf = new Map<string, number>();
  const tier = (id: string): number => {
    const known = tierOf.get(id);
    if (known !== undefined) return known;
    const req = needs(shown.find((x) => x.id === id)!);
    const t = req.length ? 1 + Math.max(...req.map(tier)) : 0;
    tierOf.set(id, t);
    return t;
  };
  const nodes: TechNode[] = shown.map((a) => ({
    id: a.id, name: a.name, tier: tier(a.id), row: 0, requires: needs(a),
    leadsTo: shown.filter((n) => n.requires.includes(a.id)).map((n) => n.id),
  }));
  const byId = new Map(nodes.map((n) => [n.id, n]));
  if (!nodes.length) return { nodes, byId, tiers: 1, rows: 1 };
  const tiers = Math.max(...nodes.map((n) => n.tier)) + 1;
  const columns: TechNode[][] = Array.from({ length: tiers }, (_, t) => nodes.filter((n) => n.tier === t));
  const rows = Math.max(...columns.map((c) => c.length));

  // Barycentre sweeps: each column is sorted by the mean row of its neighbours on one side,
  // then rows are handed out as close to that mean as the column's order allows.
  const place = (col: TechNode[], want: (n: TechNode) => number): void => {
    const keyed = col.map((n) => ({ n, d: want(n) })).sort((a, b) => a.d - b.d || a.n.row - b.n.row);
    let prev = -1;
    keyed.forEach(({ n, d }, i) => {
      const lo = Math.max(prev + 1, i);
      const hi = rows - keyed.length + i;
      // Halves round toward the middle, else the tree drifts to one edge.
      const r = d % 1 === 0.5 ? (d < (rows - 1) / 2 ? Math.ceil(d) : Math.floor(d)) : Math.round(d);
      n.row = Math.max(lo, Math.min(hi, r));
      prev = n.row;
    });
    col.sort((a, b) => a.row - b.row);
  };
  const mean = (list: string[], fallback: number): number =>
    list.length ? list.reduce((s, id) => s + byId.get(id)!.row, 0) / list.length : fallback;
  for (const col of columns) place(col, (n) => col.indexOf(n) + (rows - col.length) / 2);
  for (let pass = 0; pass < 4; pass++) {
    for (let t = tiers - 2; t >= 0; t--) place(columns[t]!, (n) => mean(n.leadsTo, n.row));
    for (let t = 1; t < tiers; t++) place(columns[t]!, (n) => mean(n.requires, n.row));
  }
  return { nodes, byId, tiers, rows };
}

/**
 * Where an edge that skips tiers runs: along the lane between two rows (below row
 * `k`; -1 is above the first row), the one nearest the middle of its ends, so it
 * passes between the advances of the tiers it crosses instead of behind them,
 * where it would seem to lead to them. An edge to the next tier needs no lane.
 */
export function techLane(layout: TechLayout, from: TechNode, to: TechNode): number | null {
  if (to.tier - from.tier <= 1) return null;
  return Math.max(-1, Math.min(layout.rows - 1, Math.round((from.row + to.row - 1) / 2)));
}

// ---- where each advance stands for the current player ------------------------------

export type TechStatus = "known" | "researching" | "available" | "locked";

export function techStatus(state: GameState, id: string): TechStatus {
  const p = state.players[state.currentPlayer]!;
  if (p.advances.includes(id)) return "known";
  if (p.researching === id) return "researching";
  const a = advancesFor(state).find((x) => x.id === id);
  return a && a.requires.every((r) => p.advances.includes(r)) ? "available" : "locked";
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

export interface TechDetails {
  name: string;
  status: TechStatus;
  /** Where it stands for us, in one line: known, how far the research is, or what it still needs. */
  standing: string;
  /** What it brings, a row per kind (units, improvements...), and the advances it leads to. */
  rows: { icon: IconName; label: string; items: string[] }[];
}

/** Settler work the engine unlocks by advance (see `workOptions` in core). */
const SETTLER_WORK: Record<string, string> = { railroad: "Lay railroads", construction: "Build fortresses" };

const and = (names: string[]): string =>
  names.length <= 1 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;

/** What an advance gives and how near it is, for the details panel of the tech tree. */
export function techDetails(state: GameState, id: string): TechDetails {
  const tree = advancesFor(state);
  const a = tree.find((x) => x.id === id) ?? advance(id);
  const p = state.players[state.currentPlayer]!;
  const status = techStatus(state, id);
  const cost = researchCost(p.advances.length, p.difficulty);
  const perTurn = sciencePerTurn(state);
  const turns = perTurn > 0 ? Math.max(1, Math.ceil((cost - p.science) / perTurn)) : 0;
  const eta = turns ? `about ${turns} turn${turns === 1 ? "" : "s"}` : "no science yet";
  let standing: string;
  if (status === "known") standing = "Known";
  else if (status === "researching") standing = `Researching: ${p.science}/${cost} beakers, ${eta}`;
  else if (status === "available") standing = `Within reach: ${eta}`;
  else {
    const missing = a.requires.filter((r) => !p.advances.includes(r)).map((r) => advance(r).name);
    standing = `Needs ${and(missing)}, ${techPath(state, id).length} advances away`;
  }
  const rows: TechDetails["rows"] = [];
  const add = (icon: IconName, label: string, items: string[]): void => { if (items.length) rows.push({ icon, label, items }); };
  add("crown", "Government", a.government ? [government(a.government).name] : []);
  add("swords", "Units", UNIT_TYPES.filter((u) => u.requires === id).map((u) => `${u.name} ${u.attack}/${u.defense}/${u.moves}`));
  add("house", "Improvements", [
    ...BUILDINGS.filter((b) => b.requires === id).map((b) => b.name),
    ...SPACE_PARTS.filter((s) => s.requires === id).map((s) => s.name),
  ]);
  add("star", "Wonders", WONDERS.filter((w) => w.requires === id).map((w) => w.name));
  add(id === "railroad" ? "railroad" : "fortress", "Settlers", SETTLER_WORK[id] ? [SETTLER_WORK[id]!] : []);
  // What it does to the land: food it adds to specials (pastures), wear it ends.
  const terrains = Object.entries(TERRAIN_RULES).map(([t, r]) => ({ name: TERRAIN_NAMES[Number(t) as Terrain], r }));
  const fed = terrains.filter(({ r }) => r.special?.learned?.advance === id).map(({ r }) => `${r.special!.name} +${r.special!.learned!.food}`);
  add("food", "Food", [...new Set(fed)]);
  add("heart", "Ends wear", terrains.filter(({ r }) => r.attrition && attritionCure(state, r.attrition) === id).map(({ name }) => name));
  add("hourglass", "Ends", WONDERS.filter((w) => w.obsolete === id).map((w) => w.name));
  // What it leads to, even beyond what the tree shows yet: worth knowing when choosing.
  add("bulb", "Leads to", tree.filter((n) => n.requires.includes(id)).map((n) => n.name));
  return { name: a.name, status, standing, rows };
}

// ---- the window's view state and its navigation ---------------------------------------

export interface TechTreeView {
  /** The advance whose details are shown. */
  selected: string;
  /** Advances just found, marked in the tree and named in the title. */
  discovered: string[];
  /** The next research can be picked here: an advance within reach can be confirmed. */
  choosing: boolean;
  /** The window can be closed without picking (Esc, the close button). */
  closable: boolean;
  /** Tier at the left edge of the graph; fractional while the view glides. */
  scroll: number;
  /** Blink phase, for the advance just found. */
  blink: boolean;
}

export type TechTreeHit =
  | { kind: "advance"; id: string }
  | { kind: "research" }
  | { kind: "close" }
  | { kind: "scroll"; by: number }
  | { kind: "scrollTo"; tier: number };

/** True when the details panel offers to research the selected advance. */
export function canResearch(state: GameState, view: TechTreeView): boolean {
  return view.choosing && techStatus(state, view.selected) === "available";
}

/** Keep the scroll within a tree `tiers` wide, for a window `columns` tiers wide. */
export function clampTechScroll(tiers: number, scroll: number, columns: number): number {
  return Math.max(0, Math.min(tiers - columns, scroll));
}

/** Scroll that puts a tier near the middle of the window (just left of it when the count is even). */
export function techScrollCentring(tiers: number, tier: number, columns: number): number {
  return clampTechScroll(tiers, tier - Math.floor((columns - 1) / 2), columns);
}

/** The least change of scroll that shows a tier whole. */
export function techScrollShowing(tiers: number, scroll: number, tier: number, columns: number): number {
  if (tier < scroll) return clampTechScroll(tiers, tier, columns);
  if (tier > scroll + columns - 1) return clampTechScroll(tiers, tier - columns + 1, columns);
  return scroll;
}

/** Open the tech tree on the advance just found, else the research under way, else the first one within reach. */
export function openTechTree(state: GameState, columns: number, opts: { discovered?: string[]; choosing: boolean; closable: boolean }): TechTreeView {
  const p = state.players[state.currentPlayer]!;
  const discovered = opts.discovered ?? [];
  const tree = advancesFor(state);
  const layout = techLayout(state);
  const selected = discovered[0] ?? p.researching ?? availableAdvances(p.advances, tree)[0]?.id ?? p.advances[p.advances.length - 1] ?? layout.nodes[0]!.id;
  const tier = layout.byId.get(selected)?.tier ?? 0;
  return { selected, discovered, choosing: opts.choosing, closable: opts.closable, scroll: techScrollCentring(layout.tiers, tier, columns), blink: true };
}

/**
 * The advance one step away from `id` with the arrow keys: to the side, the
 * nearest row in the next tier that has advances; up or down, the next row in
 * the same tier. Returns `id` when there is nothing that way.
 */
export function techStep(state: GameState, id: string, dTier: number, dRow: number): string {
  const { nodes, byId, tiers } = techLayout(state);
  const at = byId.get(id);
  if (!at) return id;
  if (dTier !== 0) {
    for (let t = at.tier + Math.sign(dTier); t >= 0 && t < tiers; t += Math.sign(dTier)) {
      const col = nodes.filter((n) => n.tier === t);
      if (!col.length) continue;
      return col.reduce((best, n) => (Math.abs(n.row - at.row) < Math.abs(best.row - at.row) ? n : best)).id;
    }
    return id;
  }
  const col = nodes.filter((n) => n.tier === at.tier && Math.sign(n.row - at.row) === Math.sign(dRow));
  if (!col.length) return id;
  return col.reduce((best, n) => (Math.abs(n.row - at.row) < Math.abs(best.row - at.row) ? n : best)).id;
}

/** The next advance within reach after `id` (before it when `dir` is -1), in tree order, wrapping round. */
export function nextAvailable(state: GameState, id: string, dir = 1): string {
  const { nodes } = techLayout(state);
  const order = [...nodes].sort((a, b) => a.tier - b.tier || a.row - b.row);
  const open = order.filter((n) => techStatus(state, n.id) === "available");
  if (!open.length) return id;
  const at = order.findIndex((n) => n.id === id);
  if (dir > 0) return (open.find((n) => order.indexOf(n) > at) ?? open[0]!).id;
  return ([...open].reverse().find((n) => order.indexOf(n) < at) ?? open[open.length - 1]!).id;
}

/** The title of the window: what was just found, or the question asked. */
export function techTreeTitle(view: TechTreeView): string {
  const found = view.discovered.map((d) => advance(d).name);
  if (found.length) return `Wise men discover ${and(found)}!`;
  return view.choosing ? "Wise men ask: what shall we research?" : "The tree of knowledge";
}
