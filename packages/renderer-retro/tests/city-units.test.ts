import { mkdirSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { applyCommand, createUnit, newGame } from "@civ/core";
import { cityUnitNote } from "@civ/renderer-api";
import { cityUnitSlot, drawCityScreen, shade, Surface } from "../src/index.js";
import { AWAY_OPACITY } from "../src/screens/city.js";
import { encodePng } from "./png.js";

/** A city of ours with, in its units box, a fortified militia, a phalanx on sentry, one awake and one spent. */
function garrison() {
  const state = newGame(2026);
  applyCommand(state, { type: "found", unit: state.units[0]!.id });
  const city = state.cities[0]!;
  state.units = state.units.filter((u) => u.owner !== 0);
  const fortified = createUnit(state, "militia", 0, city.x, city.y, city.id);
  const sentry = createUnit(state, "phalanx", 0, city.x, city.y, city.id);
  const ready = createUnit(state, "militia", 0, city.x, city.y, null);
  const spent = createUnit(state, "militia", 0, city.x, city.y, null);
  fortified.order = { kind: "fortified" };
  sentry.order = { kind: "sentry" };
  spent.movesLeft = 0;
  return { state, city, fortified, sentry, ready, spent };
}

describe("the city screen's units", () => {
  it("marks a sleeper with a token in its corner, showing through its picture, and lights one awaiting orders", () => {
    const { state, city, fortified } = garrison();
    const s = Surface.screen();
    drawCityScreen(s, state, { city: city.id });
    mkdirSync(new URL("./out/", import.meta.url), { recursive: true });
    writeFileSync(new URL("./out/city-units-standing.png", import.meta.url), encodePng(s, 3));
    const spots = s.art.filter((a) => a.unit && a.y === cityUnitSlot(0).y);
    expect(spots).toHaveLength(4);
    // The token's slate face, a few fine pixels into the top left corner, under the two sleepers only.
    const slate = (i: number) => {
      const { x, y } = cityUnitSlot(i);
      return s.fget(x * s.k + 3, y * s.k + 6) === shade("steel", 2);
    };
    expect([0, 1, 2, 3].map(slate)).toEqual([true, true, false, false]);
    // The tower and the zZ differ.
    const glyph = (i: number) => {
      const { x, y } = cityUnitSlot(i);
      const out: number[] = [];
      for (let j = 0; j < 13; j++) for (let k = 0; k < 13; k++) out.push(s.fget(x * s.k + 1 + k, y * s.k + 1 + j));
      return out.join();
    };
    expect(glyph(0)).not.toBe(glyph(1));
    // The pictures leave the token showing: a hole over the token's middle.
    const covers = (i: number, px: number, py: number) => (spots[i]!.holes ?? []).some((h) => px >= h.x && px < h.x + h.w && py >= h.y && py < h.y + h.h);
    const { x, y } = cityUnitSlot(0);
    expect(covers(0, x + 3.5, y + 3.5)).toBe(true);
    expect(covers(2, x + 3.5, y + 3.5)).toBe(false);
    // The one awake with moves glows gold; the sleepers and the spent one do not.
    expect(spots.map((a) => (a.contour ?? 0) > 0)).toEqual([false, false, true, false]);

    // Woken, the militia loses its token and glows with the other.
    applyCommand(state, { type: "activate", unit: fortified.id });
    const after = Surface.screen();
    drawCityScreen(after, state, { city: city.id });
    expect(after.fget(x * after.k + 3, y * after.k + 6)).not.toBe(shade("steel", 2));
    expect(after.art.filter((a) => a.unit && a.y === y).map((a) => (a.contour ?? 0) > 0)).toEqual([true, false, true, false]);
  });

  it("darkens and fades a unit supported away from the city", () => {
    const { state, city } = garrison();
    state.units = state.units.filter((u) => u.owner !== 0);
    const here = createUnit(state, "militia", 0, city.x, city.y, city.id);
    const away = createUnit(state, "militia", 0, city.x, city.y + 2, city.id);
    const s = Surface.screen();
    drawCityScreen(s, state, { city: city.id });
    const spot = (id: number) => s.art.find((a) => a.unit && a.x === cityUnitSlot(id === here.id ? 0 : 1).x && a.y === cityUnitSlot(0).y)!;
    expect(spot(here.id).dim).toBeUndefined();
    expect(spot(here.id).opacity).toBeUndefined();
    expect(spot(away.id)).toMatchObject({ dim: true, opacity: AWAY_OPACITY });
  });

  it("tells of the unit under the pointer beside the citizens", () => {
    const { state, city, fortified, sentry, ready, spent } = garrison();
    expect(cityUnitNote(fortified, true)).toBe("Militia: fortified, click to wake");
    expect(cityUnitNote(sentry, true)).toBe("Phalanx: on sentry, click to wake");
    expect(cityUnitNote(ready, true)).toBe("Militia: ready for orders");
    expect(cityUnitNote(spent, true)).toBe("Militia: no moves left");
    expect(cityUnitNote({ ...ready, xp: 3 }, false)).toBe("Veteran Militia, away: ready for orders");
    // Drawn where the hint stands, in place of it.
    const hint = Surface.screen();
    drawCityScreen(hint, state, { city: city.id });
    const told = Surface.screen();
    drawCityScreen(told, state, { city: city.id, hoverUnit: sentry.id });
    let changed = 0;
    for (let i = 0; i < hint.data.length; i++) if (hint.data[i] !== told.data[i]) changed++;
    expect(changed).toBeGreaterThan(0);
  });
});
