import { describe, expect, it } from "vitest";
import { GameSound, hz, SFX, sfxLength, TUNE } from "../src/sound.js";

describe("sound", () => {
  it("gives every effect a short, quiet sound in a playable range", () => {
    expect(hz(69)).toBe(440);
    expect(hz(81)).toBeCloseTo(880);
    for (const [name, r] of Object.entries(SFX)) {
      expect((r.tones?.length ?? 0) + (r.hiss?.length ?? 0), name).toBeGreaterThan(0);
      expect(sfxLength(r), name).toBeGreaterThan(0);
      expect(sfxLength(r), name).toBeLessThan(2);
      for (const t of r.tones ?? []) {
        expect(t.note, name).toBeGreaterThanOrEqual(24);
        expect(t.note, name).toBeLessThanOrEqual(108);
        expect(t.vol, name).toBeLessThanOrEqual(0.3);
      }
      for (const h of r.hiss ?? []) expect(h.vol, name).toBeLessThanOrEqual(0.3);
    }
  });

  it("loops a tune whose bass keeps time with its lead, every held note held from a note", () => {
    expect(TUNE.lead.length).toBe(2 * TUNE.bass.length);
    TUNE.lead.forEach((n, i) => {
      if (n === -1) expect(TUNE.lead[i - 1], `step ${i}`).not.toBeNull();
    });
    expect(TUNE.lead[0]).not.toBe(-1);
  });

  it("stays silent and harmless before the browser allows sound", () => {
    const s = new GameSound();
    expect(s.sound).toBe(true);
    expect(s.music).toBe(true);
    expect(() => s.play("boom")).not.toThrow();
    s.setMusic(false);
    expect(s.music).toBe(false);
  });
});
