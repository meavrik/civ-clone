import {
  advancesFor,
  atWar,
  canFoundCity,
  cityAt,
  cityById,
  computeCity,
  EXPERIENCE,
  firepower,
  formatYear,
  getTile,
  government,
  governmentsAvailable,
  maxHp,
  moveAllowance,
  specialOf,
  Terrain,
  TERRAIN_NAMES,
  TERRAIN_RULES,
  tileYield,
  turnToYear,
  unitById,
  unitSupport,
  unitType,
  workOptions,
  type GameState,
  type GovernmentRule,
} from "@civ/core";
import { tileIcons, type IconName } from "./icons.js";
import { rankLine, rankProgress } from "./ranks.js";
import { researchOutlook, sciencePerTurn } from "./research.js";
import { TERRAIN_TEXT } from "./terrain-text.js";

/**
 * Tips on the main screen's status panel (asked for 2026-10-26: "add tooltips for each relevant
 * element - not clear now. money, taxes, science, governance type etc"). The panel speaks in icons
 * and bare numbers; resting the mouse on a row (or tapping it on the phone) says what it is and what
 * stands behind its numbers. Each renderer says which part lies under a point (`Renderer.statusPartAt`),
 * `panelTip` puts that part in words, and the renderer draws the tip beside the panel (`MainScreenView.tip`).
 */
export type PanelPart =
  | "minimap" | "population" | "year" | "gold" | "tax" | "lux" | "sci" | "government" | "research"
  | "unit" | "moves" | "home" | "rank" | "terrain" | "yield" | "orders" | "endTurn" | "war";

/** A part of the panel under a point, and the rows it spans on screen (where its tip points). */
export interface PanelSpot {
  part: PanelPart;
  y: number;
  h: number;
}

/** What a tip says: a heading (it may carry {icon} tokens) and a few lines (each wrapped; icons allowed). */
export interface PanelTipWords {
  title: string;
  lines: string[];
}

/** A tip as the panel shows it: its words and the rows it points at. */
export type PanelTip = PanelSpot & PanelTipWords;

/** The people of a civilization's cities as the panel counts them: a city of size n holds n(n+1)/2 times 10,000. */
export function empirePopulation(state: GameState, player: number): number {
  return state.cities.filter((c) => c.owner === player).reduce((n, c) => n + c.size * (c.size + 1) * 5000, 0);
}

/** The panel's short form of a population: "1.2M", "45,000", "0". */
export function populationShort(pop: number): string {
  return pop >= 1000000 ? `${(pop / 1000000).toFixed(1)}M` : pop >= 1000 ? `${Math.floor(pop / 1000)},000` : String(pop);
}

const commas = (n: number): string => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
const plural = (n: number, one: string, many = `${one}s`): string => `${n} ${n === 1 ? one : many}`;
const signed = (n: number): string => (n > 0 ? `+${n}` : String(n));

/** Moves counted in thirds, as words: "1", "2/3", "1 1/3". */
function moves(thirds: number): string {
  const whole = Math.floor(thirds / 3);
  const part = thirds % 3;
  return part ? `${whole ? `${whole} ` : ""}${part}/3` : String(whole);
}

/** Everything a civilization's cities bring in and pay out in gold a turn, and what they put to luxuries and research. */
function treasury(state: GameState, player: number): { tax: number; upkeep: number; lux: number; science: number } {
  const out = { tax: 0, upkeep: 0, lux: 0, science: 0 };
  for (const c of state.cities) {
    if (c.owner !== player) continue;
    const r = computeCity(state, c);
    out.tax += r.tax;
    out.upkeep += r.buildingUpkeep;
    out.lux += r.lux;
    out.science += r.science;
  }
  return out;
}

/** What a government means for the empire, a line a rule, read from its `GovernmentRule` (and the save's older rules). */
function governmentLines(state: GameState, gov: GovernmentRule): string[] {
  const lines: string[] = [];
  if (gov.tilePenalty) lines.push(`A square making more than 2 food, shields or trade gives 1 less${state.centrePenalty ? "" : ", but for a city's own"}.`);
  if (gov.tradeBonus) lines.push(`+${gov.tradeBonus} trade on every square that makes some.`);
  if (gov.sciencePct === 0) lines.push("No research while it lasts.");
  lines.push(`No rate above ${gov.maxRate * 10}%.`);
  const free = state.looseUpkeep ? gov.looseFreeUnits : state.sizeFreeUnits ? gov.sizeFreeUnits : gov.freeUnits;
  const shield = plural(gov.unitUpkeep, "shield");
  lines.push(free === "size" ? `A city keeps as many units as its size free, then pays ${shield} a unit.`
    : free > 0 ? `A city keeps ${plural(free, "unit")} free, then pays ${shield} a unit.`
    : `Every unit costs its city ${shield} a turn.`);
  lines.push(`Settlers eat ${gov.settlerFood} food a turn.`);
  const law = state.simpleMoods ? Math.min(3, gov.martialLaw) : gov.martialLaw;
  if (law === Infinity) lines.push("Soldiers in a city keep its unhappy citizens quiet.");
  else if (law > 0) lines.push(`Up to ${law} soldiers in a city each calm an unhappy citizen.`);
  if (gov.warWeariness > 0) lines.push(`Each soldier away from our cities makes ${gov.warWeariness === 1 ? "a citizen" : "two citizens"} at home unhappy.`);
  lines.push(gov.corruptionPerDistance === 0 ? "No corruption from distance to the capital." : `${gov.corruptionPerDistance > 1 ? "Much" : "Some"} trade is lost to corruption far from the capital.`);
  if (!state.simpleMoods) lines.push(`Past ${gov.empireSize} cities, every city has a content citizen fewer.`);
  if (gov.revolutionAfter) lines.push(`A city rioting over ${gov.revolutionAfter} turns brings it down.`);
  return lines;
}

/** How the player may change government: a revolution when another is open, else the advances that open one. */
function changeLine(state: GameState, player: number): string {
  const p = state.players[player]!;
  const open = governmentsAvailable(state, player).filter((g) => g !== p.government);
  if (open.length) return "Game > Revolution! changes it.";
  const next = advancesFor(state).filter((a) => a.government && !p.advances.includes(a.id)).slice(0, 2).map((a) => a.name);
  return next.length ? `Learning ${next.join(" or ")} opens another.` : "";
}

/** Each icon of what stands on a square, with its name, for the square's tip. */
const FEATURE_WORDS: Partial<Record<IconName, string>> = {
  river: "River", road: "Road", railroad: "Railroad", irrigate: "Irrigation", mine: "Mine", fortress: "Fortress", pollution: "Pollution", hut: "Village",
};

/** What the panel's part says, for the current player; null when it shows nothing now (no unit in play, no research). */
export function panelTip(state: GameState, part: PanelPart, unitId: number | null): PanelTipWords | null {
  const me = state.players[state.currentPlayer]!;
  const gov = government(me.government);
  const rates = (): string[] => [`${gov.name} allows ${gov.maxRate * 10}% at most.`, "Click to set the rates (T)."];
  switch (part) {
    case "minimap":
      return { title: "World Map", lines: ["The world as far as we have explored it; the white frame is the part on view.", "Cities and units are dots in their owner's colour.", "Click to look elsewhere."] };
    case "population": {
      const mine = state.cities.filter((c) => c.owner === me.id);
      const citizens = mine.reduce((n, c) => n + c.size, 0);
      return {
        title: `{people}Population ${commas(empirePopulation(state, me.id))}`,
        lines: mine.length ? [`${plural(mine.length, "city", "cities")}, ${plural(citizens, "citizen")} in all.`, "It grows as the cities grow."] : ["No cities yet: settlers found one (B)."],
      };
    }
    case "year": {
      const now = turnToYear(state.turn);
      const next = turnToYear(state.turn + 1);
      const step = next - now - (now < 0 && next > 0 ? 1 : 0);
      return { title: `{calendar}${formatYear(now)}`, lines: [`Turn ${state.turn + 1}. A turn passes ${plural(step, "year")} now.`] };
    }
    case "gold": {
      const t = treasury(state, me.id);
      const lines = [`${signed(t.tax - t.upkeep)} gold a turn: ${t.tax} in taxes, ${t.upkeep} for the upkeep of buildings.`, "Gold buys what a city is building, and keeps its buildings."];
      if (t.tax < t.upkeep) lines.push("When the gold runs out, a building is sold to pay.");
      return { title: `{purse}Treasury: ${me.gold} gold`, lines };
    }
    case "tax":
      return { title: `{coin}Tax ${me.taxRate * 10}%`, lines: [`The share of our trade taken as gold: ${treasury(state, me.id).tax} a turn.`, ...rates()] };
    case "lux":
      return { title: `{gem}Luxuries ${me.luxRate * 10}%`, lines: [`The share of our trade spent on luxuries: ${treasury(state, me.id).lux} a turn.`, "Every two make a citizen a step happier.", ...rates()] };
    case "sci":
      return { title: `{bulb}Science ${me.sciRate * 10}%`, lines: [`The share of our trade put to research: ${treasury(state, me.id).science} beakers a turn.`, ...rates()] };
    case "government":
      return { title: `{crown}${gov.name}`, lines: [...governmentLines(state, gov), changeLine(state, me.id)].filter(Boolean) };
    case "research": {
      const r = researchOutlook(state);
      if (!r.id) return null;
      return {
        title: `{bulb}Researching ${r.name}`,
        lines: [
          `${r.have} of ${r.cost} beakers, ${sciencePerTurn(state)} a turn.`,
          r.turns === null ? "No beakers come in: raise the science rate." : `Found in ${plural(r.turns, "turn")}.`,
          "Click to choose what to study.",
        ],
      };
    }
    case "endTurn":
      return { title: "{hourglass}End of Turn", lines: ["No unit is waiting for orders.", "Press Enter, or click here, to end the turn."] };
    case "war": {
      const enemies = state.players.filter((p) => p.id !== me.id && p.alive && p.id !== state.barbarians && atWar(state, me.id, p.id)).map((p) => p.name);
      if (!enemies.length) return null;
      const names = enemies.length > 1 ? `${enemies.slice(0, -1).join(", ")} and ${enemies.at(-1)}` : enemies[0]!;
      return { title: "{swords}At War", lines: [`With the ${names}.`, "Their units attack ours on sight.", "Diplomacy: talk to them about peace."] };
    }
    default:
      break;
  }
  // The rest tell of the unit in play.
  const u = unitId !== null ? unitById(state, unitId) : undefined;
  if (!u) return null;
  const type = unitType(u.type);
  const tile = getTile(state.map, u.x, u.y);
  switch (part) {
    case "unit": {
      const lines = [`Attack ${type.attack}, defence ${type.defense}, moves ${moves(moveAllowance(state, u))}.`, `Hit points ${u.hp} of ${maxHp(state, u.type)}, firepower ${firepower(state, u.type)}.`];
      const flags = type.flags ?? [];
      if (flags.includes("settler")) lines.push("Founds cities, and builds roads, farms and mines.");
      if (flags.includes("diplomat")) lines.push("Steals advances and stirs up foreign cities.");
      if (flags.includes("caravan")) lines.push("Helps build wonders and opens trade routes.");
      if (type.capacity) lines.push(`Carries ${plural(type.capacity, "unit")}.`);
      return { title: type.name, lines };
    }
    case "moves": {
      const all = moveAllowance(state, u);
      return {
        title: `{boot}Moves left: ${moves(u.movesLeft)} of ${moves(all)}`,
        lines: ["A pip a move: bright for a whole one, dim for part of one, dark once spent.", "A road costs a third of a move; forest, hills and swamp cost more."],
      };
    }
    case "home": {
      const home = u.homeCity !== null ? cityById(state, u.homeCity) : undefined;
      if (!home) return null;
      const cost = unitSupport(state, home).find((s) => s.unit.id === u.id);
      const paid = [cost?.shields && plural(cost.shields, "shield"), cost?.food && `${cost.food} food`].filter(Boolean);
      return {
        title: `{house}Home: ${home.name}`,
        lines: [paid.length ? `${home.name} pays ${paid.join(" and ")} a turn for it.` : `One of the units ${home.name} keeps free.`, "H in another of our cities makes that one its home."],
      };
    }
    case "rank":
      return {
        title: rankLine(u.xp),
        lines: [`${rankProgress(u.xp)}.`, `A fight won teaches ${EXPERIENCE.win}, ${EXPERIENCE.win + EXPERIENCE.againstOdds} against the odds; each rank fights harder.`],
      };
    case "terrain": {
      if (!tile) return null;
      const r = TERRAIN_RULES[tile.terrain];
      // As the square's window has it: grassland's first special counts only before version 26, a river defends at +50%.
      const sp = !state.freecivYields && tile.terrain === Terrain.Grassland && !tile.secondSpecial ? undefined : specialOf(tile);
      const defence = tile.river && !state.freecivYields ? Math.max(1.5, r.defense) : r.defense;
      return {
        title: sp ? `${TERRAIN_NAMES[tile.terrain]}: ${sp.name}` : TERRAIN_NAMES[tile.terrain],
        lines: [
          TERRAIN_TEXT[tile.terrain],
          `Entering costs ${plural(r.moveCost, "move")}${defence !== 1 ? `; defence +${Math.round((defence - 1) * 100)}%` : ""}.`,
          "Right-click any square to learn more.",
        ],
      };
    }
    case "yield": {
      if (!tile) return null;
      const y = tileYield(state, tile, cityAt(state, u.x, u.y) !== undefined, me.government, me.id);
      const sp = specialOf(tile);
      const here = [...(tile.special && sp ? [`{star}${sp.name}`] : []), ...tileIcons(tile).map((i) => `{${i}}${FEATURE_WORDS[i] ?? i}`)];
      return {
        title: "This Square",
        lines: [`{food}${y.food} food  {shield}${plural(y.shields, "shield")}  {trade}${y.trade} trade`, "for a city working it.", ...(here.length ? [here.join("  ")] : [])],
      };
    }
    case "orders": {
      const w = workOptions(state, u);
      const job = (key: string, icon: IconName, what: string, turns: number | undefined) => (turns === undefined ? [] : [`${key} {${icon}}${what}, ${plural(turns, "turn")}`]);
      // Irrigating or mining some ground turns it into another terrain (a swamp drained, grassland grown over into forest).
      const r = tile ? TERRAIN_RULES[tile.terrain] : undefined;
      const into = (becomes: Terrain | undefined) => (becomes !== undefined ? ` into ${TERRAIN_NAMES[becomes]}` : "");
      const lines = [
        ...(type.flags?.includes("settler") && !canFoundCity(state, u.x, u.y) ? ["B {city}Found a city"] : []),
        ...job("I", "irrigate", `Irrigate${into(r?.irrigate?.becomes)}`, w.irrigate),
        ...job("M", "mine", `Mine${into(r?.mine?.becomes)}`, w.mine),
        ...(w.road !== undefined ? job("R", "road", "Road", w.road) : job("R", "railroad", "Railroad", w.railroad)),
        ...job("F", "fortress", "Fortress", w.fortress),
        ...job("P", "clean", "Clean up pollution", w.clean),
      ];
      return lines.length ? { title: "Orders: press a key", lines } : null;
    }
    default:
      return null;
  }
}
