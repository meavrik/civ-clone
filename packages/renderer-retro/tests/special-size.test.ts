import { describe, expect, it } from "vitest";
import { newGame, specialFor, Terrain } from "@civ/core";
import { C, drawSpecial, SPRITE_CLEAR, specialSprite, Surface } from "../src/index.js";

describe("a resource on its square", () => {
  it("is its icon's own size on the 20-pixel squares and the original's, 0.8 of a larger square, centred", () => {
    const state = newGame(7);
    const tile = state.map.tiles.find((t) => t.terrain !== Terrain.Ocean && !t.rig && specialFor(state, t, 0))!;
    const icon = specialSprite(specialFor(state, tile, 0)!.name)!;
    const drawn = (t: number) => {
      const s = Surface.fine(t, t);
      s.fill(C.MAGENTA!);
      drawSpecial(s, 0, 0, state, tile, 0, t);
      let x0 = s.fw, y0 = s.fh, x1 = -1, y1 = -1;
      for (let j = 0; j < s.fh; j++) for (let i = 0; i < s.fw; i++) if (s.fget(i, j) !== C.MAGENTA!) { x0 = Math.min(x0, i); y0 = Math.min(y0, j); x1 = Math.max(x1, i); y1 = Math.max(y1, j); }
      return { s, box: [x0, y0, x1, y1] };
    };
    // 20 pixels: the icon pixel for pixel, a margin of four fine pixels round it.
    const twenty = drawn(20).s;
    for (let j = 0; j < 32; j++)
      for (let i = 0; i < 32; i++) if (icon.fget(i, j) !== SPRITE_CLEAR) expect(twenty.fget(4 + i, 4 + j), `${i},${j}`).toBe(icon.fget(i, j));
    expect(drawn(20).box.every((v) => v >= 4 && v < 36)).toBe(true);
    // 16 pixels (the original's, the phone's): as before, the icon filling the square, nothing dropped.
    const sixteen = drawn(16).s;
    for (let j = 0; j < 32; j++)
      for (let i = 0; i < 32; i++) if (icon.fget(i, j) !== SPRITE_CLEAR) expect(sixteen.fget(i, j)).toBe(icon.fget(i, j));
    // 32 pixels (zoomed in): 0.8 of the square, 51 fine pixels across, centred.
    expect(drawn(32).box.every((v) => v >= 6 && v < 57)).toBe(true);
  });
});
