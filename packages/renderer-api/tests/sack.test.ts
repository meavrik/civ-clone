import { describe, expect, it } from "vitest";
import { createUnit, newGame } from "@civ/core";
import { SACK, sackBlows, sackedHut, sackFall, sackLength, sackLoot, UNIT_ANIMS, UnitAnimator } from "../src/index.js";

describe("a village sacked", () => {
  it("lands its blows as the unit's own strikes come round, else on a steady beat", () => {
    // The militia strikes 320 ms into its attack, and again each 640 ms after.
    expect(sackBlows("militia")).toEqual([320, 960]);
    expect(sackBlows("phalanx")).toEqual(sackBlows("militia"));
    // Units without an attack of their own, and the catapult, which shoots.
    expect(sackBlows("legion")).toEqual([SACK.firstMs, SACK.firstMs + SACK.beatMs, SACK.firstMs + 2 * SACK.beatMs]);
    expect(sackBlows("catapult")).toEqual(sackBlows("legion"));
    expect(sackBlows("")).toEqual(sackBlows("legion"));
    for (const type of ["militia", "legion"]) {
      const blows = sackBlows(type);
      expect(blows.every((b) => b <= SACK.blowsMs)).toBe(true);
      // The hut goes down after the last blow; the whole show about two seconds.
      expect(sackFall(blows)).toBe(blows[blows.length - 1]! + SACK.holdMs);
      expect(sackLength(blows)).toBeGreaterThan(1800);
      expect(sackLength(blows)).toBeLessThan(2500);
    }
  });

  it("brings out coins for gold, more for more, a scroll for an advance, nothing for the rest", () => {
    expect(sackLoot({ kind: "gold", amount: 25 })).toEqual({ kind: "coins", count: 4 });
    expect(sackLoot({ kind: "gold", amount: 100 })).toEqual({ kind: "coins", count: 9 });
    expect(sackLoot({ kind: "gold", amount: 200 })).toEqual({ kind: "coins", count: 10 });
    expect(sackLoot({ kind: "advance", advance: "alphabet" })).toEqual({ kind: "scroll" });
    expect(sackLoot({ kind: "unit", unit: "legion" })).toBeNull();
    expect(sackLoot({ kind: "barbarians" })).toBeNull();
    expect(sackLoot({ kind: "empty" })).toBeNull();
  });

  it("shakes the hut after each blow, stands it still between, then lets it down whole", () => {
    const blows = sackBlows("legion");
    const at = (ms: number) => sackedHut({ blows, ms });
    expect(at(0)).toEqual({ shake: 0, down: 0 });
    // A jolt just after the first blow, dying away before the next.
    expect(Math.abs(at(blows[0]! + SACK.shakeMs / 6).shake)).toBeGreaterThan(0.5);
    expect(at(blows[0]! + SACK.shakeMs + 10).shake).toBe(0);
    expect(at(blows[0]! + SACK.shakeMs + 10).down).toBe(0);
    // Going down, slowly then quicker, and gone by the end of the fall.
    const fall = sackFall(blows);
    expect(at(fall).down).toBe(0);
    const quarter = at(fall + SACK.fallMs / 4).down, half = at(fall + SACK.fallMs / 2).down;
    expect(quarter).toBeGreaterThan(0);
    expect(half - quarter).toBeGreaterThan(quarter);
    expect(at(fall + SACK.fallMs).down).toBe(1);
    expect(at(sackLength(blows)).down).toBe(1);
  });

  it("has the unit strike at it as it attacks, its strikes landing with the blows, then cheer as the hut goes down", () => {
    const state = newGame(2026);
    const u = createUnit(state, "militia", 0, 10, 10);
    const anim = new UnitAnimator();
    const start = 1000;
    const blows = sackBlows("militia");
    const sacks = [{ unit: u.id, start, cheer: start + sackFall(blows) }];
    const attack = UNIT_ANIMS.militia!.attack!;
    // Its first frame of attack as the sack begins.
    expect(anim.update(state, undefined, start, [], sacks).frames[u.id]).toBe(attack.frames[0]);
    // Each strike reported as it lands, with the blows.
    const landed: number[] = [];
    for (let t = start; t < start + sackFall(blows); t += 10) if (anim.update(state, undefined, t, [], sacks).impacts.includes(u.id)) landed.push(t - start);
    expect(landed.length).toBe(blows.length);
    landed.forEach((ms, i) => expect(Math.abs(ms - blows[i]!)).toBeLessThan(10));
    // Cheering from the fall, and on through it once the sack is over.
    const won = UNIT_ANIMS.militia!.won!;
    expect(anim.update(state, undefined, start + sackFall(blows), [], sacks).frames[u.id]).toBe(won.frames[0]);
    expect(won.frames).toContain(anim.update(state, undefined, start + sackFall(blows) + 300, [], []).frames[u.id]);
    // Another unit, not sacking, stands as it was.
    const other = createUnit(state, "militia", 0, 12, 10);
    expect(anim.update(state, undefined, start + 50, [], sacks).frames[other.id]).toBe(UNIT_ANIMS.militia!.idle);
  });
});
