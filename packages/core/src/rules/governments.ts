/**
 * Government rules. Only Despotism and Anarchy are reachable before the tech
 * tree lands; the rest are here so city maths can be written once.
 */
export interface GovernmentRule {
  id: string;
  name: string;
  /** Tiles already yielding 3+ of a resource lose 1 (the despotism penalty). */
  tilePenalty: boolean;
  /** Units a city supports for free before paying shields. */
  freeUnits: number;
  /** Shield upkeep per unit beyond the free ones. */
  unitUpkeep: number;
  /** Settlers eat this much food. */
  settlerFood: number;
  /** Max 3 military units each make one unhappy citizen content. */
  martialLaw: boolean;
  /** Military units away from home cause unhappiness. */
  warWeariness: number;
  /** Corruption base percent per tile of distance from the capital. */
  corruptionPerDistance: number;
  /** Max rate for tax/lux/sci (tenths). */
  maxRate: number;
  /** Trade bonus on tiles already producing trade (Republic/Democracy). */
  tradeBonus: number;
  /** Science penalty percent. */
  sciencePct: number;
}

export const GOVERNMENTS: Record<string, GovernmentRule> = {
  anarchy: {
    id: "anarchy", name: "Anarchy", tilePenalty: true, freeUnits: 3, unitUpkeep: 1, settlerFood: 1,
    martialLaw: true, warWeariness: 0, corruptionPerDistance: 3, maxRate: 6, tradeBonus: 0, sciencePct: 0,
  },
  despotism: {
    id: "despotism", name: "Despotism", tilePenalty: true, freeUnits: 3, unitUpkeep: 1, settlerFood: 1,
    martialLaw: true, warWeariness: 0, corruptionPerDistance: 2, maxRate: 6, tradeBonus: 0, sciencePct: 100,
  },
  monarchy: {
    id: "monarchy", name: "Monarchy", tilePenalty: false, freeUnits: 3, unitUpkeep: 1, settlerFood: 1,
    martialLaw: true, warWeariness: 0, corruptionPerDistance: 1, maxRate: 7, tradeBonus: 0, sciencePct: 100,
  },
  communism: {
    id: "communism", name: "Communism", tilePenalty: false, freeUnits: 3, unitUpkeep: 1, settlerFood: 1,
    martialLaw: true, warWeariness: 0, corruptionPerDistance: 0, maxRate: 8, tradeBonus: 0, sciencePct: 100,
  },
  republic: {
    id: "republic", name: "Republic", tilePenalty: false, freeUnits: 0, unitUpkeep: 1, settlerFood: 2,
    martialLaw: false, warWeariness: 1, corruptionPerDistance: 1, maxRate: 8, tradeBonus: 1, sciencePct: 100,
  },
  democracy: {
    id: "democracy", name: "Democracy", tilePenalty: false, freeUnits: 0, unitUpkeep: 1, settlerFood: 2,
    martialLaw: false, warWeariness: 2, corruptionPerDistance: 0, maxRate: 10, tradeBonus: 1, sciencePct: 100,
  },
};

export function government(id: string): GovernmentRule {
  const g = GOVERNMENTS[id];
  if (!g) throw new Error(`unknown government ${id}`);
  return g;
}
