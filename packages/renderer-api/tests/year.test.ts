import { describe, expect, it } from "vitest";
import { turnToYear } from "@civ/core";
import { countedYear } from "../src/index.js";

describe("the year counting on as a turn passes", () => {
  it("runs from the old year to the new, quickly at first, never back and never through year 0", () => {
    expect(countedYear(-4000, -3980, 0)).toBe(-4000);
    expect(countedYear(-4000, -3980, 1)).toBe(-3980);
    // Eased out: past half the years by a third of the time.
    expect(countedYear(-4000, -3980, 1 / 3)).toBeGreaterThan(-3990);
    let last = -Infinity;
    for (let t = 0; t <= 1; t += 0.01) {
      const y = countedYear(turnToYear(199), turnToYear(200), t);
      expect(y).not.toBe(0);
      expect(y).toBeGreaterThanOrEqual(last);
      last = y;
    }
    expect(countedYear(-20, 1, 1)).toBe(1);
    expect(countedYear(-20, 1, 0.999)).toBeLessThanOrEqual(1);
  });
});
