import {
  advance, climbsMountains, firepower, freeUnits, government, maxHp, missingResources, traitMoves, traitVeteran,
  unitRetired, unitSight, unitType, wonder,
  type City, type GameState, type Production, type UnitTypeRule,
} from "@civ/core";
import { productionEffects } from "./built.js";

/**
 * What the build menu tells of a choice (asked for 2026-11-02: "on the build menu - add for each building/unit a info
 * icon - when clicked or hover show building/unit info"): its name and lines with icons (`{icon}` tokens), its numbers
 * first, then what it does, then what it needs or what ends it. No shield cost: the menu gives the turns it takes.
 */
export interface MenuInfo {
  title: string;
  lines: string[];
}

const plural = (n: number, one: string, many = `${one}s`): string => `${n} ${n === 1 ? one : many}`;

/** "A, B and C". */
function listed(names: readonly string[]): string {
  return names.length < 2 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/** What a unit of `type` can do beyond fighting, a sentence each (the status panel's unit tip says the same). */
export function unitAbilities(state: GameState, type: UnitTypeRule): string[] {
  const lines: string[] = [];
  const flags = type.flags ?? [];
  if (flags.includes("settler")) lines.push("Founds cities, and builds roads, farms and mines.");
  if (flags.includes("diplomat")) lines.push("Steals advances and stirs up foreign cities.");
  if (flags.includes("caravan")) lines.push("Helps build wonders and opens trade routes.");
  if (flags.includes("explorer")) lines.push("Crosses any ground, mountains too, as if on a road; no one minds it on their land.");
  if (type.anyGround && climbsMountains(state, type)) lines.push("Goes anywhere without a road, mountains too: the only soldiers that do.");
  if (flags.includes("fishing")) lines.push("Lays a fishery on fish or whales in our waters: more food and a shield there for good. With Refining, builds an oil rig on oil at sea.");
  if (type.frightens) lines.push(`Frightens units that need ${type.frightens}: they defend at two thirds against it.`);
  if (type.capacity) lines.push(`Carries ${plural(type.capacity, "unit")}.`);
  return lines;
}

/** Moves counted in thirds, as words: "1", "2/3", "1 1/3". */
function moves(thirds: number): string {
  const whole = Math.floor(thirds / 3);
  const part = thirds % 3;
  return part ? `${whole ? `${whole} ` : ""}${part}/3` : String(whole);
}

/** A unit for `owner`'s city (`city`, for its trained veterans and its free units): its numbers, its gifts, its upkeep, its needs. */
function unitInfo(state: GameState, owner: number, id: string, city?: City): MenuInfo {
  const t = unitType(id);
  const flags = t.flags ?? [];
  const lines = [`{swords}Attack ${t.attack}  {tower}Defence ${t.defense}  {boot}Moves ${moves((t.moves + traitMoves(state, owner, id)) * 3)}`];
  lines.push(`{heart}Hit points ${maxHp(state, id)}, firepower ${firepower(state, id)}${unitSight(state, { type: id }) > 1 ? `; sees ${plural(unitSight(state, { type: id }), "square")} round it` : ""}`);
  lines.push(...unitAbilities(state, t));
  if (t.wheeled) lines.push("On wheels: needs a road into jungle, swamp, arctic and mountains.");
  if (flags.includes("coastal")) lines.push("Must end its turn beside land, or it sinks in deep water.");
  if (flags.includes("ignoreZoc") && !flags.includes("explorer")) lines.push("Slips past enemy units' zones of control.");
  if (t.fuel) lines.push(`Must land in a city or on a carrier within ${plural(t.fuel, "turn")}.`);
  if (flags.includes("nuclear")) lines.push("Destroys everything round the square it strikes.");
  // Trained as a veteran in this city (its Barracks, or the people's way with such units).
  if (city && ((t.domain === "land" && city.buildings.includes("barracks")) || traitVeteran(state, owner, id))) lines.push("{veteran}Trained here as a Veteran (+50%).");
  // What its city pays for it under our government: shields once its free units are used, and a settler's food.
  if (city) {
    const gov = government(state.players[owner]!.government);
    const free = freeUnits(state, city);
    const eats = flags.includes("settler") && gov.settlerFood ? `; eats ${gov.settlerFood} food a turn` : "";
    lines.push(`{shield}Upkeep: ${plural(gov.unitUpkeep, "shield")} a turn${free ? ` once ${city.name}'s ${plural(free, "free unit")} are used` : ""}${eats}.`);
  }
  if (t.needs?.length && !state.noResources) {
    // A resource's id is its name.
    const names = listed;
    const lacking = missingResources(state, owner, id);
    const one = t.needs.length === 1;
    const have = !lacking.length ? (one ? "we hold it" : "we hold them") : lacking.length === t.needs.length ? (one ? "we have none" : "we have none of them") : `we lack ${names(lacking)}`;
    lines.push(`Needs ${names(t.needs)}: ${have}.`);
  }
  if (t.obsolete && !unitRetired(state, owner, id)) lines.push(`{hourglass}No longer built once we know ${advance(t.obsolete).name}.`);
  return { title: t.name, lines };
}

/** What a choice of the build menu is, for `owner` (in `city`, when it is built there). */
export function productionInfo(state: GameState, owner: number, p: Production, city?: City): MenuInfo {
  if (p.kind === "unit") return unitInfo(state, owner, p.id, city);
  const { name, text, effects, upkeep } = productionEffects(state, p, owner);
  const lines = [text, ...effects.map((e) => `{${e.icon}}${e.text}`)];
  if (p.kind === "building") {
    lines.push(upkeep ? `{coin}Upkeep: ${plural(upkeep, "gold", "gold")} a turn` : "{coin}No upkeep");
  }
  if (p.kind === "wonder") {
    const w = wonder(p.id);
    lines.push("{star}One in all the world: the first city to finish it has it.");
    if (w.obsolete) lines.push(`{hourglass}Its effect ends once we know ${advance(w.obsolete).name}.`);
  }
  return { title: name, lines: lines.filter(Boolean) };
}
