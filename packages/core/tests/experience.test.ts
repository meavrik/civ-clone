import { describe, expect, it } from "vitest";
import {
  applyCommand,
  attackOdds,
  attackStrength,
  building,
  createUnit,
  defenseStrength,
  experienceFor,
  foundCity,
  lastActions,
  lastCombat,
  loadSave,
  makeSave,
  MAX_XP,
  newGame,
  nextFloat,
  nextRank,
  processCityTurn,
  rankOf,
  RANKS,
  resolveCombat,
  setRelation,
  Terrain,
  VETERAN_XP,
  type GameState,
  type UnitBattle,
} from "../src/index.js";

/** Two alike civs plus barbarians at war on a flat world. */
function world(opts: { simpleVeterans?: boolean } = {}): GameState {
  const s = newGame(1, { opponents: 1, classicCivs: true, ...opts });
  for (const t of s.map.tiles) {
    t.terrain = Terrain.Grassland;
    t.river = false; t.road = false; t.irrigation = false; t.mine = false; t.special = false; t.hut = false;
  }
  s.units = []; s.cities = [];
  setRelation(s, 0, 1, "war");
  return s;
}

function lastBattle(mark: number): UnitBattle {
  const b = lastActions.slice(mark).find((a): a is UnitBattle => a.kind === "battle");
  if (!b) throw new Error("no battle");
  return b;
}

describe("combat experience", () => {
  it("climbs five ranks, each stronger than the last", () => {
    expect(RANKS.map((r) => r.name)).toEqual(["Recruit", "Regular", "Veteran", "Hardened", "Elite"]);
    expect([0, 1, 2, 3, 5, 6, 9, 10, 40].map((xp) => rankOf(xp).id)).toEqual(["recruit", "regular", "regular", "veteran", "veteran", "hardened", "hardened", "elite", "elite"]);
    for (let i = 1; i < RANKS.length; i++) expect(RANKS[i]!.power).toBeGreaterThan(RANKS[i - 1]!.power);
    expect(rankOf(VETERAN_XP).power).toBe(1.5); // the old veteran's half again
    expect(nextRank(4)?.name).toBe("Hardened");
    expect(nextRank(MAX_XP)).toBeNull();
    expect(experienceFor(0.9)).toBe(1);
    expect(experienceFor(0.3)).toBe(2);
  });

  it("adds its rank's power to a unit's attack and defence", () => {
    const s = world();
    const a = createUnit(s, "legion", 0, 10, 10);
    const d = createUnit(s, "phalanx", 1, 11, 10);
    const [atk, def] = [attackStrength(a), defenseStrength(s, d, a)];
    a.xp = 6;
    d.xp = MAX_XP;
    expect(attackStrength(a)).toBe(atk * 1.75);
    expect(defenseStrength(s, d, a)).toBe(def * 2);
  });

  it("teaches the winner of a fight, and tells when it rises a rank", () => {
    const s = world();
    const a = createUnit(s, "armor", 0, 10, 10);
    const d = createUnit(s, "militia", 1, 11, 10);
    const mark = lastActions.length;
    expect(applyCommand(s, { type: "move", unit: a.id, dx: 1, dy: 0 }).ok).toBe(true);
    const b = lastBattle(mark);
    expect(b.attackerWon).toBe(true); // 10 against 1 over ten blows each way
    expect(b.attacker.xp).toBe(0); // the rank it fought at
    expect(a.xp).toBe(1);
    expect(b.promoted).toBe("regular");
    expect(lastCombat?.promoted).toBe("Regular");
    expect(s.units.includes(d)).toBe(false);
    // A second easy win teaches one more and no new rank.
    createUnit(s, "militia", 1, 11, 10);
    a.movesLeft = 9;
    const again = lastActions.length;
    applyCommand(s, { type: "move", unit: a.id, dx: 1, dy: 0 });
    expect(a.xp).toBe(2);
    expect(lastBattle(again).promoted).toBeUndefined();
  });

  it("teaches twice as much from a fight won against the odds, and a defender too", () => {
    for (let seed = 1; seed < 200; seed++) {
      const s = world();
      const a = createUnit(s, "legion", 0, 10, 10);
      const d = createUnit(s, "phalanx", 1, 11, 10);
      s.map.tiles[10 * s.map.width + 11]!.terrain = Terrain.Hills; // 3 against 4
      const odds = attackOdds(s, a, d);
      expect(odds).toBeLessThan(0.5);
      s.rng.s[0] = seed;
      const r = resolveCombat(s, a, 1, 0);
      if ("error" in r) throw new Error(r.error);
      if (r.attackerWon) {
        expect(a.xp).toBe(2);
        expect(r.promoted?.id).toBe("regular");
        return;
      }
      expect(d.xp).toBe(1); // the favourite holding learns the least
    }
    throw new Error("the long shot never came off");
  });

  it("counts no further than the top rank", () => {
    const s = world();
    const a = createUnit(s, "armor", 0, 10, 10);
    a.xp = MAX_XP - 1;
    createUnit(s, "militia", 1, 11, 10);
    applyCommand(s, { type: "move", unit: a.id, dx: 1, dy: 0 });
    expect(a.xp).toBe(MAX_XP);
    expect(lastCombat?.promoted).toBe("Elite");
    createUnit(s, "militia", 1, 11, 10);
    a.movesLeft = 9;
    applyCommand(s, { type: "move", unit: a.id, dx: 1, dy: 0 });
    expect(a.xp).toBe(MAX_XP);
  });

  it("trains veterans in a city with barracks, recruits elsewhere", () => {
    const s = world();
    const city = foundCity(s, 0, 10, 10);
    city.production = { kind: "unit", id: "legion" };
    city.shields = 40;
    processCityTurn(s, city);
    expect(s.units.find((u) => u.type === "legion")!.xp).toBe(0);
    s.units = [];
    city.buildings.push(building("barracks").id);
    city.shields = 40;
    processCityTurn(s, city);
    expect(rankOf(s.units.find((u) => u.type === "legion")!.xp).name).toBe("Veteran");
  });

  it("keeps the coin-toss veteran, and its draw, for saves before version 32", () => {
    const opts = { opponents: 1 as const };
    expect(loadSave({ ...makeSave(newGame(321, opts), opts, []), version: 31 as const }, () => {}).state.simpleVeterans).toBe(true);
    expect(loadSave(makeSave(newGame(321, opts), opts, []), () => {}).state.simpleVeterans).toBeUndefined();
    const seen = new Set<number>();
    for (let seed = 1; seed < 30; seed++) {
      const fight = (simpleVeterans: boolean) => {
        const s = world(simpleVeterans ? { simpleVeterans } : {});
        const a = createUnit(s, "armor", 0, 10, 10);
        createUnit(s, "militia", 1, 11, 10);
        s.rng.s[0] = seed;
        resolveCombat(s, a, 1, 0);
        return { s, a };
      };
      const old = fight(true);
      const now = fight(false);
      seen.add(old.a.xp);
      // The old rules draw once more after the fight, for the winner's coin toss.
      const rng = structuredClone(now.s.rng);
      nextFloat(rng);
      expect(old.s.rng.s).toEqual(rng.s);
    }
    expect([...seen].sort()).toEqual([0, VETERAN_XP]);
  });
});
