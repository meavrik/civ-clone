import { describe, expect, it } from "vitest";
import { artPlace, CITY_ART, CITY_SQUARE, cityArt, cityArtPlace, type CityEra, type CityTier } from "../src/index.js";

const ERAS: CityEra[] = ["ancient", "medieval", "industrial"];
const TIERS: CityTier[] = ["village", "town", "city", "capital"];

describe("city pictures", () => {
  it("has the user's picture of every look a city takes on the map", () => {
    for (const era of ERAS) for (const tier of TIERS) expect(cityArt(`${era}-${tier}`), `${era}-${tier}`).toBe(true);
    expect(Object.keys(CITY_ART)).toHaveLength(ERAS.length * TIERS.length);
    expect(cityArt("no-such-look")).toBe(false);
  });

  it("stands each on its square's foot, centred, at the sheet's one scale, so a village is smaller than a capital", () => {
    const square = { id: "", city: true, x: 100, y: 40, w: 16, h: 16 };
    for (const id of Object.keys(CITY_ART)) {
      const box = cityArtPlace({ ...square, id })!;
      const [w, h] = CITY_ART[id]!;
      expect(box.w).toBeCloseTo((w / CITY_SQUARE) * 16);
      expect(box.h).toBeCloseTo((h / CITY_SQUARE) * 16);
      expect(box.x + box.w / 2).toBeCloseTo(108);
      expect(box.y + box.h).toBeCloseTo(40 + 16 - 0.5);
      expect(box.x).toBeGreaterThanOrEqual(100);
      expect(box.y).toBeGreaterThanOrEqual(40);
      expect(artPlace({ ...square, id })).toEqual(box);
    }
    const area = (id: string) => CITY_ART[id]![0] * CITY_ART[id]![1];
    for (const era of ERAS) expect(area(`${era}-village`)).toBeLessThan(area(`${era}-capital`) * 0.5);
    expect(cityArtPlace({ ...square, id: "no-such-look" })).toBeNull();
  });
});
