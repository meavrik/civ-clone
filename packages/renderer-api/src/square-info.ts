import {
  advance,
  advancesFor,
  attrition,
  attritionCure,
  building,
  climbsMountains,
  CITY_RADIUS,
  cityAt,
  cityStateOf,
  civ,
  fisheryYield,
  inCatalogue,
  claimant,
  learnedOf,
  influenceSpecials,
  maxHp,
  nextRank,
  RESOURCE_BY_ID,
  resourceAt,
  resourceRoaded,
  roadOnly,
  specialFor,
  specialLocked,
  Terrain,
  TERRAIN_NAMES,
  TERRAIN_RULES,
  tileYield,
  UNIT_TYPES,
  unitAt,
  unitCityState,
  wrapX,
  yieldingSpecial,
  type GameState,
  type Player,
  type Unit,
} from "@civ/core";
import { WORK_NAME, type IconName } from "./icons.js";
import { squareTitle } from "./places.js";
import { rankedName } from "./ranks.js";
import { resourceUnits } from "./resources.js";
import { settlerSites, siteReasons } from "./sites.js";
import { ownerAt, territory } from "./territory.js";
import { TERRAIN_TEXT } from "./terrain-text.js";

/**
 * The square's window (`terrainInfo`, right-click on the map), redone 2026-11-02 (asked for: "too messy. arrange with
 * clear sections. clean design", then of the labelled table that followed, "still not good. rethink this modal window
 * layout"): a card rather than lines of text. Its title names the terrain, its resource in brackets and where it lies;
 * the card holds what the square yields, its move cost and defence and a few words on the terrain, then its facts in
 * groups (`SquareGroup`): what is here (the resource, rivers, roads and works, the village, what the ground does to
 * units), whose land it is, the units on it, and what could still be made of it. Each fact is a line of its own, an
 * icon, a name and a short note on what it means (`SquareFact`), so the renderer lays them as a table.
 */
export interface SquareFact {
  /** The picture before it. */
  icon: IconName;
  /** A unit's line: its owner's colour slot, whose shield stands in place of the icon. */
  shield?: number;
  /** What it is, a word or two: "River", "Irrigation", "Veteran Legion". */
  name: string;
  /** What it means, short, {icon} tokens allowed: "+1 {trade}", "worked by Rome". */
  note?: string;
  /** The note's ink: good news, a warning, or an aside. */
  tone?: "good" | "bad" | "quiet";
}

/** A group of the card's facts under a small heading. */
export interface SquareGroup {
  title: string;
  facts: SquareFact[];
}

export interface SquareCard {
  /** What the square yields a city of ours under our government. */
  yields: { food: number; shields: number; trade: number };
  /** Moves it takes to enter. */
  moves: number;
  /** What it adds to a defender, in percent (a river half again, as the original's River); 0 for none. */
  defence: number;
  /** Whose it is, beside the picture: the city on it, or whose land and which city of ours works it. */
  owner?: SquareFact;
  /** A few words on the terrain (`TERRAIN_TEXT`). */
  text: string;
  groups: SquareGroup[];
}

export interface SquareInfo {
  title: string;
  /** Null for a square not explored. */
  card: SquareCard | null;
  /** All of it as text (`squareLines`): the modern renderer's body. */
  lines: string[];
}

/** A count and its noun: "1 move", "2 turns". */
const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;

/** What something adds to a square, in icons: "+2 {shield}", "+1 {food} +1 {trade}". */
export function yieldGain(g: { food?: number; shields?: number; trade?: number }): string {
  return [g.food && `+${g.food} {food}`, g.shields && `+${g.shields} {shield}`, g.trade && `+${g.trade} {trade}`].filter(Boolean).join(" ");
}

/** Names in a short list: the first `max`, then how many more. */
function shortList(names: string[], max: number): string {
  return names.length <= max ? names.join(", ") : `${names.slice(0, max).join(", ")} and ${names.length - max} more`;
}

/** A civilization's adjective, "Roman" (its plain name where it has none: the barbarians). */
function adjectiveOf(p: Player | undefined): string {
  if (!p) return "Unknown";
  try { return civ(p.civ).adjective; } catch { return p.name; }
}

/** What one of our units on the square is about: its job, its orders, its wounds and how far it is from its next rank. */
function unitStatus(state: GameState, u: Unit): Pick<SquareFact, "note" | "tone"> {
  const parts: string[] = [];
  const o = u.order;
  if (o.kind === "work") {
    const job = WORK_NAME[o.work];
    parts.push(`${job[0]!.toUpperCase()}${job.slice(1)}, ${plural(o.turnsLeft, "turn")}`);
  } else if (o.kind === "fortified" || o.kind === "fortifying") parts.push("Fortified");
  else if (o.kind === "sentry") parts.push("Sentry");
  else if (o.kind === "camp") parts.push("Camping");
  else if (o.kind === "goto") parts.push("On the move");
  const max = maxHp(state, u.type);
  const hurt = u.hp < max;
  if (hurt) parts.push(`${u.hp}/${max} hp`);
  const next = u.xp > 0 ? nextRank(u.xp) : null;
  if (next) parts.push(`${u.xp}/${next.xp} to ${next.name}`);
  return hurt ? { note: parts.join(", "), tone: "bad" } : { note: parts.join(", ") };
}

/**
 * What the current player knows about a map square, for the square's window: what it yields under their
 * government, what it takes to enter and adds to a defender; the resource (what it brings, which units need it,
 * the road or rig it waits for), the river, roads and works on it, a village, pollution, where only settlers or no
 * wheels go and the wear on units; whose land it is and which of our cities works it or takes its influence, and
 * the settlers' note on it as a site; the units on it (ours with their jobs, wounds and ranks); and what settlers
 * (at sea a Harbour, a fishery, a rig) could still add.
 */
export function terrainInfo(state: GameState, x: number, y: number): SquareInfo {
  const me = state.players[state.currentPlayer]!;
  const { map } = state;
  const idx = y * map.width + wrapX(map, x);
  if (y < 0 || y >= map.height || !me.explored[idx]) return { title: "Unexplored", card: null, lines: ["Not explored yet."] };
  const t = map.tiles[idx]!;
  const r = TERRAIN_RULES[t.terrain];
  const sea = t.terrain === Terrain.Ocean;
  const city = cityAt(state, x, y);
  const yields = tileYield(state, t, city !== undefined, me.government, me.id);
  // A river square defends at half again (the original's River) unless its terrain gives more.
  const defence = Math.round(((t.river && !state.freecivYields ? Math.max(1.5, r.defense) : r.defense) - 1) * 100);
  // Grassland's first special counts only in games before version 26 (`tileYield`).
  const sp = !state.freecivYields && t.terrain === Terrain.Grassland && !t.secondSpecial && !t.deposit ? undefined : specialFor(state, t, me.id);
  const strategic = resourceAt(state, x, y, me.id);
  // Whose land it is, by the borders of the cities we know, and which city of ours works it.
  const owner = ownerAt(territory(state), x, y);
  const worker = city ? undefined : state.cities.find((c) => c.owner === me.id && c.worked.some((slot) => {
    const [dx, dy] = CITY_RADIUS[slot]!;
    return wrapX(map, c.x + dx) === wrapX(map, x) && c.y + dy === y;
  }));

  // Here: the resource, then what lies and stands on the square, each with what it adds, then what the ground does to units.
  const here: SquareFact[] = [];
  if (sp) {
    // A strategic resource adds no shields since save version 52 (`yieldingSpecial`); Fish feed no one until a Fishing
    // Boat lays a fishery, since 54 (the Improve group says what one would bring). What our advances add is counted in
    // (Animal Husbandry's pastures), and what those still to come would add follows ("Weaving +1 {trade}").
    const yielding = yieldingSpecial(state, sp);
    const learned = learnedOf(yielding);
    const ours = (a: string) => me.advances.includes(a);
    const total = learned.filter((l) => ours(l.advance)).reduce((g, l) => ({ food: g.food + (l.food ?? 0), shields: g.shields + (l.shields ?? 0), trade: g.trade + (l.trade ?? 0) }),
      { food: yielding.food ?? 0, shields: yielding.shields ?? 0, trade: yielding.trade ?? 0 });
    const gain = yieldGain(total);
    const tree = advancesFor(state);
    const later = learned.filter((l) => !ours(l.advance) && tree.some((a) => a.id === l.advance)).map((l) => `${advance(l.advance).name} ${yieldGain(l)}`).join(", ");
    if (strategic) here.push({ icon: "star", name: sp.name, note: `${gain ? `${gain}, for` : "For"} ${shortList(resourceUnits(strategic), gain ? 2 : 3)}` });
    else if (specialLocked(state, t, sp)) here.push({ icon: "star", name: sp.name, note: "Unfished: feeds no one yet", tone: "quiet" });
    else if (gain || later) here.push({ icon: "star", name: sp.name, note: [gain, later].filter(Boolean).join("; ") });
    else here.push({ icon: "star", name: sp.name });
    // A strategic resource serves its civilization only with a road on it (save version 43; a river serves as one since
    // 48), or at sea an oil rig (55).
    if (strategic && !resourceRoaded(state, t)) here.push(sea
      ? { icon: "rig", name: "No oil rig", note: `${sp.name} unused until a Fishing Boat builds one`, tone: "bad" }
      : { icon: "road", name: "No road", note: `${sp.name} unused until one is built`, tone: "bad" });
  }
  if (t.grassShield && t.terrain === Terrain.Grassland) here.push({ icon: "shield", name: "Shield", note: "+1 {shield}" });
  if (t.river) {
    const carries = strategic && sp && resourceRoaded(state, t) && !t.road && !state.roadlessResources;
    here.push({ icon: "river", name: "River", note: `+1 {trade}${carries ? `, carries the ${sp.name}` : ""}` });
  }
  if (t.railroad) here.push({ icon: "railroad", name: "Railroad", note: state.freecivYields ? "+50% {shield}" : "+50% {food} {shield}" });
  // A city's square has its road always: not worth a line.
  else if (t.road && !city) {
    // A road adds no trade on a river (the original), except in games before version 26.
    const onRiver = t.river && !state.freecivYields;
    here.push({ icon: "road", name: "Road", ...(onRiver ? { note: "No trade on a river", tone: "quiet" as const } : r.road.trade ? { note: `+${r.road.trade} {trade}` } : {}) });
  }
  if (t.irrigation && r.irrigate?.food) here.push({ icon: "irrigate", name: "Irrigation", note: `+${r.irrigate.food} {food}` });
  if (t.mine && r.mine?.shields) here.push({ icon: "mine", name: "Mine", note: `+${r.mine.shields} {shield}` });
  if (t.fortress) here.push({ icon: "fortress", name: "Fortress", note: "Doubles defence" });
  // A fishery (since save version 53) adds what its special's `fishery` says (`fisheryYield`); an oil rig (since 55) its own shields.
  if (t.fishery && sp?.fishery) here.push({ icon: "fishery", name: "Fishery", note: yieldGain(fisheryYield(state, sp)) });
  if (t.rig) here.push({ icon: "rig", name: "Oil rig", note: yieldGain({ shields: RESOURCE_BY_ID[t.deposit ?? ""]?.offshore?.rig.shields ?? 0 }) });
  if (t.hut) here.push({ icon: "hut", name: "Village", note: "Visit it with a unit", tone: "quiet" });
  if (t.pollution) here.push({ icon: "pollution", name: "Pollution", note: "Output halved", tone: "bad" });
  if (roadOnly(state, t) && !t.road) here.push({ icon: "boot", name: "Steep", note: `Only ${climbers(state)} without a road`, tone: "bad" });
  else if (r.rough && !t.road && !state.classicTerrain) here.push({ icon: "boot", name: "No wheels", note: "Wheeled units need a road", tone: "quiet" });
  const wear = attrition(state, me.id, x, y);
  if (wear > 0 && r.attrition) here.push({ icon: "heart", name: "Harsh", note: `${Math.round(wear * 100)}% hp a turn, until ${advance(attritionCure(state, r.attrition)).name}`, tone: "bad" });

  // Whose it is: the city on it, or whose land and which city of ours works it.
  let ownerFact: SquareFact | undefined;
  const cs = cityStateOf(city);
  if (city) {
    const whose = cs ? `a city-state of the ${cs.people}` : city.owner === me.id ? "ours" : adjectiveOf(state.players[city.owner]);
    ownerFact = { icon: "city", name: city.name, note: `${whose}, size ${city.size}` };
  } else if (owner >= 0) {
    const holder = owner === state.barbarians ? cityStateOf(claimant(state, x, y) ?? undefined) : undefined;
    const name = owner === me.id ? "Our land" : holder ? `Land of ${holder.name}` : `${adjectiveOf(state.players[owner])} land`;
    ownerFact = { icon: "borders", name, ...(worker ? { note: `worked by ${worker.name}` } : owner === me.id ? { note: "not worked", tone: "quiet" as const } : {}) };
  }
  // What it brings a city of ours whose border holds it beyond the squares it works; the settlers' note on it as a site.
  if (sp && !city && owner === me.id && !worker) {
    for (const c of state.cities) {
      if (c.owner !== me.id) continue;
      const g = influenceSpecials(state, c).find((i) => i.x === wrapX(map, x) && i.y === y);
      if (g) { here.push({ icon: "culture", name: "Influence", note: `+${g.trade} {trade} to ${c.name}`, tone: "good" }); break; }
    }
  }
  const site = settlerSites(state, state.activeUnit).find((s) => s.x === wrapX(map, x) && s.y === y);
  if (site) here.push({ icon: "city", name: site.best ? "Best city site" : "Good city site", note: siteReasons(state, site, me.id).join(", "), tone: "good" });

  // Units: ours each with what it is about, another civilization's with whose they are, alike ones counted together
  // ("2 Militia"); more kinds than `UNITS_LISTED` counted by kind alone, the rest summed up.
  const units: SquareFact[] = [];
  if (!me.visible[idx]) units.push({ icon: "swords", name: "Out of sight", note: "Units there are not seen", tone: "quiet" });
  else {
    const there = unitAt(state, x, y);
    const first = there[0];
    if (first) {
      const holder = state.players[first.owner]!;
      const ours = holder.id === me.id;
      const serves = cityStateOf(unitCityState(state, first));
      const whose = serves ? serves.name : adjectiveOf(holder);
      const counted = (rows: Pick<SquareFact, "name" | "note" | "tone">[]) => {
        const out: (Pick<SquareFact, "name" | "note" | "tone"> & { k: number })[] = [];
        for (const r of rows) {
          const same = out.find((o) => o.name === r.name && o.note === r.note && o.tone === r.tone);
          if (same) same.k++;
          else out.push({ ...r, k: 1 });
        }
        return out;
      };
      let rows = counted(there.map((u) => ({ name: rankedName(u), ...(ours ? unitStatus(state, u) : { note: whose }) })));
      if (rows.length > UNITS_LISTED) rows = counted(there.map((u) => ({ name: rankedName(u), ...(ours ? {} : { note: whose }) })));
      const shown = rows.length > UNITS_LISTED ? rows.slice(0, UNITS_LISTED - 1) : rows;
      for (const r of shown) units.push({ icon: "swords", shield: holder.color, name: r.k > 1 ? `${r.k} ${r.name}` : r.name, ...(r.note ? { note: r.note } : {}), ...(r.tone ? { tone: r.tone } : {}) });
      const rest = rows.slice(shown.length).reduce((n, r) => n + r.k, 0);
      if (rest) units.push({ icon: "swords", shield: holder.color, name: `${rest} more`, tone: "quiet" });
    }
  }

  // Improve: what settlers could still make of it, each with what it adds or what the land becomes; at sea what a
  // Fishing Boat's fishery adds to unfished fish or whales, and a Harbour (its trade since save version 58).
  const improve: SquareFact[] = [];
  if (!sea && !city) {
    const i = r.irrigate;
    if (i && !t.irrigation) improve.push(i.becomes !== undefined ? { icon: "irrigate", name: "Clear", note: `Into ${TERRAIN_NAMES[i.becomes]}` } : { icon: "irrigate", name: "Irrigate", note: `+${i.food ?? 0} {food}` });
    const m = r.mine;
    if (m && !t.mine) improve.push(m.becomes !== undefined ? { icon: "mine", name: "Plant", note: `Into ${TERRAIN_NAMES[m.becomes]}` } : { icon: "mine", name: "Mine", note: `+${m.shields ?? 0} {shield}` });
    if (!t.road && r.road.trade > 0 && (!t.river || state.freecivYields)) improve.push({ icon: "road", name: "Road", note: `+${r.road.trade} {trade}` });
  } else if (sea) {
    if (sp?.fishery && !t.fishery) {
      const f = fisheryYield(state, sp);
      const gain = specialLocked(state, t, sp) ? { food: (sp.food ?? 0) + f.food, shields: (sp.shields ?? 0) + f.shields, trade: (sp.trade ?? 0) + f.trade } : f;
      improve.push({ icon: "fishery", name: "Fishing Boat", note: yieldGain(gain) });
    }
    const harbour = building("harbour");
    if (!state.richSea && !worker?.buildings.includes("harbour")) improve.push({ icon: "harbour", name: harbour.name, note: yieldGain({ food: harbour.oceanFood ?? 0, trade: harbour.oceanTrade ?? 0 }) });
  }

  const groups = [
    { title: "Here", facts: here },
    { title: "Units", facts: units },
    { title: "Improve", facts: improve },
  ].filter((g) => g.facts.length);
  const card: SquareCard = { yields, moves: r.moveCost, defence, ...(ownerFact ? { owner: ownerFact } : {}), text: TERRAIN_TEXT[t.terrain], groups };
  // The title names the terrain, its resource and where it lies (asked for 2026-10-26: "show land/water mass name in
  // the title - remove duplicates"; the resource in brackets since 2026-11-02): "Plains (Horses), Ausonia".
  const title = squareTitle(state, x, y, TERRAIN_NAMES[t.terrain], sea, sp?.name);
  return { title, card, lines: squareLines(card) };
}

/** The most lines the units take: alike ones counted together, then by kind alone, the rest summed up in the last. */
export const UNITS_LISTED = 4;

/** Whose the square is, in a line: "{borders} Our land, worked by Rome". */
export function ownerLine(f: SquareFact): string {
  return `{${f.icon}} ${f.name}${f.note ? `, ${f.note}` : ""}`;
}

/** The card as lines of text, {icon} tokens and all: the yields, moves and defence, the words, then each fact as "Name: note". */
export function squareLines(card: SquareCard): string[] {
  const { yields: y, moves, defence } = card;
  return [
    `{food} ${y.food}  {shield} ${y.shields}  {trade} ${y.trade}`,
    `{boot} ${plural(moves, "move")}${defence ? `  {tower} +${defence}% defence` : ""}`,
    ...(card.owner ? [ownerLine(card.owner)] : []),
    card.text,
    ...card.groups.flatMap((g) => g.facts.map((f) => `{${f.icon}} ${f.name}${f.note ? `: ${f.note}` : ""}`)),
  ];
}

/** Who climbs mountains without a road in this game (`climbsMountains`), by name: "Settlers, Explorer and War Elephants". */
function climbers(state: GameState): string {
  const names = UNIT_TYPES.filter((u) => u.domain === "land" && inCatalogue(state, u) && climbsMountains(state, u)).map((u) => u.name);
  return names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : names.join("");
}
