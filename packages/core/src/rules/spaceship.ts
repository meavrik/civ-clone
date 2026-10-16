/**
 * The spaceship: once the Apollo Program stands, every civilization may
 * build parts (costs and prerequisites follow FreeCiv's civ1 ruleset).
 * Structurals hold the ship together, modules keep the colonists alive
 * (three make one habitat), components drive it. Launch when at least one
 * habitat and one component are carried; the flight takes fewer turns
 * with more components and succeeds more often with more habitats.
 */
export type SpacePart = "structural" | "component" | "module";

export interface SpacePartRule {
  id: SpacePart;
  name: string;
  cost: number;
  requires: string;
  max: number;
}

export const SPACE_PARTS: SpacePartRule[] = [
  { id: "structural", name: "Space Structural", cost: 80, requires: "space_flight", max: 32 },
  { id: "component", name: "Space Component", cost: 160, requires: "plastics", max: 16 },
  { id: "module", name: "Space Module", cost: 320, requires: "robotics", max: 12 },
];

export const SPACE_PART_BY_ID: Record<SpacePart, SpacePartRule> = Object.fromEntries(SPACE_PARTS.map((p) => [p.id, p])) as Record<SpacePart, SpacePartRule>;

export function spacePart(id: SpacePart): SpacePartRule {
  return SPACE_PART_BY_ID[id];
}

export interface Spaceship {
  structurals: number;
  components: number;
  modules: number;
  /** Turn of launch, or null while still on the ground. */
  launched: number | null;
  /** Turn the ship reaches its star, once launched. */
  arrives: number | null;
  /** True once the colonists have landed: the game is won. */
  arrived: boolean;
}

export function newSpaceship(): Spaceship {
  return { structurals: 0, components: 0, modules: 0, launched: null, arrives: null, arrived: false };
}

export function partCount(ship: Spaceship, id: SpacePart): number {
  return id === "structural" ? ship.structurals : id === "component" ? ship.components : ship.modules;
}

export function addPart(ship: Spaceship, id: SpacePart): void {
  if (id === "structural") ship.structurals++;
  else if (id === "component") ship.components++;
  else ship.modules++;
}

export interface ShipStats {
  /** Modules and components actually held by structurals (modules first). */
  modules: number;
  components: number;
  habitats: number;
  successPct: number;
  flightTurns: number;
  launchable: boolean;
}

export function shipStats(ship: Spaceship): ShipStats {
  const modules = Math.min(ship.modules, ship.structurals);
  const components = Math.min(ship.components, Math.max(0, ship.structurals - modules));
  const habitats = Math.floor(modules / 3);
  const successPct = habitats === 0 ? 0 : Math.min(100, 20 + 20 * habitats);
  const flightTurns = Math.max(8, 30 - Math.floor(components * 1.4));
  return { modules, components, habitats, successPct, flightTurns, launchable: ship.launched === null && habitats >= 1 && components >= 1 };
}
