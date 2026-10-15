import { describe, expect, it } from "vitest";
import { createRng, nextInt, nextU32 } from "../src/rng.js";

describe("rng", () => {
  it("is deterministic for a seed", () => {
    const a = createRng(42);
    const b = createRng(42);
    for (let i = 0; i < 1000; i++) expect(nextU32(a)).toBe(nextU32(b));
  });

  it("differs across seeds", () => {
    expect(nextU32(createRng(1))).not.toBe(nextU32(createRng(2)));
  });

  it("nextInt stays in range", () => {
    const r = createRng(7);
    for (let i = 0; i < 10000; i++) {
      const v = nextInt(r, 6);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(6);
    }
  });
});
