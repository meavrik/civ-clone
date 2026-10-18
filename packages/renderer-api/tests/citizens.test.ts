import { describe, expect, it } from "vitest";
import { CITIZEN_LEGS, CITIZEN_SKINS, citizenLook } from "../src/index.js";

describe("citizens", () => {
  it("are the same people every time a city is drawn", () => {
    for (let i = 0; i < 20; i++) expect(citizenLook(4, i)).toEqual(citizenLook(4, i));
    expect(Array.from({ length: 12 }, (_, i) => citizenLook(4, i))).not.toEqual(Array.from({ length: 12 }, (_, i) => citizenLook(5, i)));
  });

  it("mix men and women of every skin, hair and look", () => {
    const people = Array.from({ length: 30 }, (_, c) => Array.from({ length: 12 }, (_, i) => citizenLook(c, i))).flat();
    expect(new Set(people.map((p) => `${p.woman}${p.style}`)).size).toBe(4);
    expect(new Set(people.map((p) => p.skin)).size).toBe(CITIZEN_SKINS);
    expect(new Set(people.map((p) => p.hair)).size).toBe(6);
    expect(new Set(people.map((p) => p.legs)).size).toBe(CITIZEN_LEGS);
    const women = people.filter((p) => p.woman).length;
    expect(women / people.length).toBeGreaterThan(0.4);
    expect(women / people.length).toBeLessThan(0.6);
  });
});
