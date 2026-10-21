/**
 * Government rules. Only Despotism and Anarchy are reachable before the tech
 * tree lands; the rest are here so city maths can be written once.
 */
export interface GovernmentRule {
  id: string;
  name: string;
  /** Tiles already yielding 3+ of a resource lose 1 (the despotism penalty). */
  tilePenalty: boolean;
  /**
   * Units a city supports for free before paying shields: as many as the city's
   * size under Anarchy and Despotism, none under the others, as in the original.
   */
  freeUnits: number | "size";
  /** Free units per city in saves before version 8 (`looseUpkeep`). */
  looseFreeUnits: number;
  /** Shield upkeep per unit beyond the free ones. */
  unitUpkeep: number;
  /** Settlers eat this much food. */
  settlerFood: number;
  /**
   * Martial law: military units in the city each make one unhappy citizen content, up to this
   * many (0: none). Monarchy stops at three, the others never (FreeCiv's civ1 numbers); saves
   * before version 17 stop every government at three (`simpleMoods`).
   */
  martialLaw: number;
  /** Unhappy citizens each military unit away from home makes (Republic 1, Democracy 2). */
  warWeariness: number;
  /**
   * Cities a civilization may hold before one citizen fewer is born content in every city, and
   * one fewer again for each `EMPIRE_SIZE_STEP` cities beyond (the original's unhappiness from size).
   */
  empireSize: number;
  /**
   * How a celebrating city runs (`City.celebrating`: from size `CELEBRATION_SIZE`, nobody unhappy
   * and half the people happy at the turn's end): its squares yield as under another government
   * (Despotism as a Monarchy, Monarchy and Communism as a Democracy), or it grows a citizen every
   * turn it has food to spare (Republic, Democracy). Anarchy gains nothing.
   */
  celebration?: { yieldsAs: string } | { grow: true };
  /** Turns a city may riot in a row before the government falls into anarchy (Democracy: two). */
  revolutionAfter?: number;
  /** Corruption base percent per tile of distance from the capital. */
  corruptionPerDistance: number;
  /** Max rate for tax/lux/sci (tenths). */
  maxRate: number;
  /** Trade bonus on tiles already producing trade (Republic/Democracy). */
  tradeBonus: number;
  /** Science penalty percent. */
  sciencePct: number;
}

/** Cities beyond a government's `empireSize` that cost every city one more content citizen. */
export const EMPIRE_SIZE_STEP = 10;
/** The smallest city that can celebrate. */
export const CELEBRATION_SIZE = 3;

export const GOVERNMENTS: Record<string, GovernmentRule> = {
  anarchy: {
    id: "anarchy", name: "Anarchy", tilePenalty: true, freeUnits: "size", looseFreeUnits: 3, unitUpkeep: 1, settlerFood: 1,
    martialLaw: Infinity, warWeariness: 0, empireSize: 9, corruptionPerDistance: 3, maxRate: 6, tradeBonus: 0, sciencePct: 0,
  },
  despotism: {
    id: "despotism", name: "Despotism", tilePenalty: true, freeUnits: "size", looseFreeUnits: 3, unitUpkeep: 1, settlerFood: 1,
    martialLaw: Infinity, warWeariness: 0, empireSize: 10, celebration: { yieldsAs: "monarchy" }, corruptionPerDistance: 2, maxRate: 6, tradeBonus: 0, sciencePct: 100,
  },
  monarchy: {
    id: "monarchy", name: "Monarchy", tilePenalty: false, freeUnits: 0, looseFreeUnits: 3, unitUpkeep: 1, settlerFood: 1,
    martialLaw: 3, warWeariness: 0, empireSize: 11, celebration: { yieldsAs: "democracy" }, corruptionPerDistance: 1, maxRate: 7, tradeBonus: 0, sciencePct: 100,
  },
  communism: {
    id: "communism", name: "Communism", tilePenalty: false, freeUnits: 0, looseFreeUnits: 3, unitUpkeep: 1, settlerFood: 1,
    martialLaw: Infinity, warWeariness: 0, empireSize: 12, celebration: { yieldsAs: "democracy" }, corruptionPerDistance: 0, maxRate: 8, tradeBonus: 0, sciencePct: 100,
  },
  republic: {
    id: "republic", name: "Republic", tilePenalty: false, freeUnits: 0, looseFreeUnits: 0, unitUpkeep: 1, settlerFood: 2,
    martialLaw: 0, warWeariness: 1, empireSize: 13, celebration: { grow: true }, corruptionPerDistance: 1, maxRate: 8, tradeBonus: 1, sciencePct: 100,
  },
  democracy: {
    id: "democracy", name: "Democracy", tilePenalty: false, freeUnits: 0, looseFreeUnits: 0, unitUpkeep: 1, settlerFood: 2,
    martialLaw: 0, warWeariness: 2, empireSize: 14, celebration: { grow: true }, revolutionAfter: 2, corruptionPerDistance: 0, maxRate: 10, tradeBonus: 1, sciencePct: 100,
  },
};

export function government(id: string): GovernmentRule {
  const g = GOVERNMENTS[id];
  if (!g) throw new Error(`unknown government ${id}`);
  return g;
}
