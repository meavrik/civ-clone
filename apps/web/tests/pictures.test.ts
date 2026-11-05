import { describe, expect, it } from "vitest";
import { underWindow, type PicturePlace } from "../src/pictures.js";

describe("pictures under a window", () => {
  it("darken and are cut round the window, so a leader's picture does not cover their answer", () => {
    const scene: PicturePlace = { url: "caesar.webp", fit: "fill", x: 64, y: 22, w: 192, h: 108, logicalW: 320, logicalH: 200 };
    const window = { x: 100, y: 70, w: 120, h: 50 };
    expect(underWindow([scene], window)).toEqual([{ ...scene, dim: true, holes: [window] }]);
    expect(scene.holes).toBeUndefined();
    // Holes it had already stay.
    const hole = { x: 0, y: 0, w: 4, h: 4 };
    expect(underWindow([{ ...scene, holes: [hole] }], window)[0]!.holes).toEqual([hole, window]);
  });
});
