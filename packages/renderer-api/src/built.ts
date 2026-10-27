import {
  ACCRUED_CULTURE, advance, BUILDINGS, building, buildingCulture, CULTURE, partCount, spacePart, wonder,
  type BuildingRule, type GameState, type Production, type WonderRule,
} from "@civ/core";
import type { IconName } from "./icons.js";

/**
 * The Building Completed window (asked for 2026-10-24, after the user's template): a city of ours
 * finished an improvement, a wonder or a spaceship part. Under its title the thing's name and the city,
 * the user's picture of it, what it is, what it does for the city in numbers, its upkeep; View City
 * (the city screen, whose builders then ask what comes next) and Continue (they ask over the map).
 */
export interface BuiltView {
  city: number;
  /** What was finished: an improvement, a wonder or a spaceship part. */
  production: Production;
  /** The lit button: 0 View City, 1 Continue. */
  selected: number;
  /** How far the window has grown on opening, 0..1 (`WINDOW_ENTER_MS`); absent or 1, it stands whole. */
  enter?: number | undefined;
  /**
   * The city's square on the screen under the window, when that is the map (`Renderer.squareRect`): the
   * window stands above it (else below, else beside it) and points at it, the square left lit (asked for
   * 2026-10-25: "smaller, and placed above the relevant built city with an arrow"). Absent, it is centred.
   */
  square?: { x: number; y: number; w: number; h: number } | undefined;
}

export const BUILT_BUTTONS = ["View City", "Continue"] as const;

/** A button of the window, or its close box (which goes on as Continue does); a click on the city it points at is View City. */
export type BuiltHit = "city" | "continue" | "close";

export interface BuiltEffect {
  icon: IconName;
  text: string;
}

export interface BuiltCard {
  /** The title strip's words: "Building Completed", "Wonder Completed"... */
  title: string;
  name: string;
  /** "Completed in Rome". */
  where: string;
  text: string;
  /** A line or two more, said more quietly: what it builds on, when a wonder stops working. */
  more: string[];
  /** What it does for the city (or the empire), in numbers. */
  effects: BuiltEffect[];
  /** Gold it costs a turn. */
  upkeep: number;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** An improvement's effects, field by field. */
function buildingEffects(state: GameState, b: BuildingRule): BuiltEffect[] {
  const out: BuiltEffect[] = [];
  if (b.id === "palace") out.push({ icon: "crown", text: "Seat of government" });
  if (b.content) out.push({ icon: "heart", text: `+${plural(b.content, "content citizen")}` });
  if (b.sciencePct) out.push({ icon: "bulb", text: `+${b.sciencePct}% science` });
  if (b.taxPct) out.push({ icon: "coin", text: b.luxPct === b.taxPct ? `+${b.taxPct}% tax and luxuries` : `+${b.taxPct}% tax` });
  if (b.shieldsPct) out.push({ icon: "shield", text: `+${b.shieldsPct}% shields` });
  if (b.halveCorruption) out.push({ icon: "trade", text: "-50% corruption" });
  if (b.granary) out.push({ icon: "food", text: "Half the food kept on growth" });
  if (b.aqueduct) out.push({ icon: "people", text: "Grows past size 10" });
  if (b.barracks) out.push({ icon: "swords", text: "Land units trained as veterans" });
  if (b.wallsPct) out.push({ icon: "tower", text: `x${1 + b.wallsPct / 100} defence against land attacks` });
  if (b.id === "sdi_defense") out.push({ icon: "fortress", text: "Stops nuclear attacks within 3 squares" });
  if (b.pollutionPct) out.push({ icon: "clean", text: b.id === "mass_transit" ? "No pollution from population" : `-${b.pollutionPct}% pollution` });
  const culture = buildingCulture(state, b.id);
  if (culture && !state.fixedBorders) out.push({ icon: "culture", text: `+${culture} culture${state.accruedCulture ? " a turn" : ""}` });
  return out;
}

/** A wonder's effect in numbers. */
function wonderEffect(w: WonderRule): BuiltEffect {
  const e = w.effect;
  switch (e.kind) {
    case "contentAll": return { icon: "heart", text: `+${e.amount} content in every city` };
    case "contentCity": return { icon: "heart", text: `+${plural(e.amount, "content citizen")}` };
    case "contentContinent": return { icon: "heart", text: `+${e.amount} content on its continent` };
    case "noUnhappyCity": return { icon: "heart", text: "No unhappy citizens here" };
    case "sciencePct": return { icon: "bulb", text: `+${e.amount}% science here` };
    case "scienceAll": return { icon: "bulb", text: `+${e.amount}% science in every city` };
    case "tradeSquares": return { icon: "trade", text: `+${e.amount} trade on squares with trade` };
    case "templeDouble": return { icon: "heart", text: "Temples calm twice as many" };
    case "cathedralEverywhere": return { icon: "heart", text: "A cathedral in every city" };
    case "noAnarchy": return { icon: "crown", text: "No anarchy, any government" };
    case "seaMoves": return { icon: "boot", text: `+${plural(e.amount, "move")} for ships` };
    case "wallsEverywhere": return { icon: "tower", text: "Walls in every city" };
    case "freeAdvances": return { icon: "bulb", text: `${plural(e.amount, "advance")} at once` };
    case "revealMap": return { icon: "star", text: "The whole world seen" };
    case "allowNuclear": return { icon: "swords", text: "Nuclear weapons for all" };
    case "greatLibrary": return { icon: "bulb", text: "Advances two other civs know" };
    case "policeEverywhere": return { icon: "swords", text: "1 unit abroad a city: no unrest" };
    case "powerPlantContinent": return { icon: "shield", text: "A power plant in every factory near" };
  }
}

/** What the window says of a city's new improvement, wonder or spaceship part; null for anything else. */
export function builtCard(state: GameState, view: BuiltView): BuiltCard | null {
  const city = state.cities.find((c) => c.id === view.city);
  if (!city) return null;
  const where = `Completed in ${city.name}`;
  const p = view.production;
  if (p.kind === "building") {
    const b = building(p.id);
    const more: string[] = [];
    if (b.needs) more.push(`Builds on the ${building(b.needs).name}.`);
    const next = BUILDINGS.filter((o) => o.needs === b.id).map((o) => o.name);
    if (next.length) more.push(`${next.join(" and ")} ${next.length > 1 ? "build" : "builds"} on it.`);
    return { title: "Building Completed", name: b.name, where, text: b.text, more, effects: buildingEffects(state, b), upkeep: b.upkeep };
  }
  if (p.kind === "wonder") {
    const w = wonder(p.id);
    const effects = [wonderEffect(w)];
    if (!state.fixedBorders) effects.push({ icon: "culture", text: `+${state.accruedCulture ? ACCRUED_CULTURE.wonder : CULTURE.wonder} culture${state.accruedCulture ? " a turn" : ""}` });
    const more = ["A Wonder of the World: there is only one."];
    if (w.obsolete) more.push(`It stops working with ${advance(w.obsolete).name}.`);
    return { title: "Wonder Completed", name: w.name, where, text: w.text, more, effects, upkeep: 0 };
  }
  if (p.kind === "spaceship") {
    const part = spacePart(p.id);
    const ship = state.players[city.owner]!.spaceship;
    return {
      title: "Spaceship Part Completed", name: part.name, where, text: part.text,
      more: ["The ship is lost if the capital falls."],
      effects: [{ icon: "star", text: `${partCount(ship, p.id)} of ${part.max} built` }],
      upkeep: 0,
    };
  }
  return null;
}
