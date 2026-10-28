import { writeFileSync } from "node:fs";
import { applyCommand, newGame } from "@civ/core";
import { panelTip } from "@civ/renderer-api";
import { describe, expect, it } from "vitest";
import { drawMainScreen, minimapButtonAt, minimapSize, statusPartAt, Surface, VIEW_Y } from "../src/index.js";
import { DIMMED } from "../src/palette.js";
import { encodePng } from "./png.js";

describe("the minimap's buttons", () => {
  it("stand in its bottom right corner, answer clicks and tell of themselves", () => {
    const state = newGame(4, { opponents: 2 });
    const top = VIEW_Y + 2;
    const { h } = minimapSize(state.map);
    expect(minimapButtonAt(state, 60, top + h - 5)).toBe("names");
    expect(minimapButtonAt(state, 72, top + h - 5)).toBe("borders");
    expect(minimapButtonAt(state, 40, top + h - 5)).toBeNull();
    expect(minimapButtonAt(state, 72, top + h - 12)).toBeNull();
    expect(minimapButtonAt(state, 72, top + h + 1)).toBeNull();
    expect(statusPartAt(state, 60, top + h - 5)).toEqual({ part: "minimapNames", y: top + h - 10, h: 10 });
    expect(statusPartAt(state, 72, top + h - 5)?.part).toBe("minimapBorders");
    expect(panelTip(state, "minimapNames", null)!.lines.at(-1)).toBe("Click to hide them.");
    expect(panelTip(state, "minimapNames", null, { minimapNames: false })!.lines.at(-1)).toMatch(/^Click to show/);
    expect(panelTip(state, "minimapBorders", null, { minimapBorders: false })!.lines[0]).toMatch(/^Hidden/);
  });

  it("are darkened while their layer is hidden, and hide it", () => {
    const state = newGame(4, { opponents: 2 });
    applyCommand(state, { type: "found", unit: state.units.find((u) => u.owner === 0)!.id });
    state.players[0]!.explored.fill(1);
    const view = { originX: 0, originY: 0, blink: false };
    const on = Surface.screen();
    drawMainScreen(on, state, view);
    const off = Surface.screen();
    drawMainScreen(off, state, { ...view, minimapNames: false, minimapBorders: false });
    const top = VIEW_Y + 2;
    const { w, h } = minimapSize(state.map);
    // Each button is the same button, darkened.
    for (let y = (top + h - 10) * on.k; y < (top + h) * on.k; y++)
      for (let x = 58 * on.k; x < 79 * on.k; x++) {
        if (x >= 68 * on.k && x < 69 * on.k) continue;
        expect(off.fget(x, y)).toBe(DIMMED[on.fget(x, y)]);
      }
    // Elsewhere the minimap lost its names and the civilizations' colours.
    let differ = 0;
    for (let y = top; y < top + h - 10; y++) for (let x = 0; x < w; x++) if (on.get(x, y) !== off.get(x, y)) differ++;
    expect(differ).toBeGreaterThan(20);
    // Side by side: on, then off.
    const pair = new Surface(2 * w + 4, h, undefined, on.k);
    for (let y = 0; y < h * on.k; y++)
      for (let x = 0; x < w * on.k; x++) {
        pair.fset(x, y, on.fget(x, top * on.k + y));
        pair.fset((w + 4) * on.k + x, y, off.fget(x, top * on.k + y));
      }
    writeFileSync(new URL("./out/minimap-buttons.png", import.meta.url), encodePng(pair, 6));
  });
});
