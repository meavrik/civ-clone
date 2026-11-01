import { mkdirSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getTile, newGame, revealAround, Terrain } from "@civ/core";
import { drawMainScreen, Surface, TILE, VIEW_X, VIEW_Y, type MainScreenView } from "../src/index.js";
import { encodePng } from "./png.js";

describe("fisheries on the map (save version 53)", () => {
  it("draw stakes, a net and its floats over the fish or whales they were laid on", () => {
    const state = newGame(5, { opponents: 1 });
    const u = state.units[0]!;
    // A strip of sea below the settlers: fish and whales, each bare and with a fishery.
    const at = (i: number) => [u.x - 3 + i * 2, u.y + 3] as const;
    for (let i = 0; i < 4; i++) {
      const [x, y] = at(i);
      for (const dx of [-1, 0, 1]) for (const dy of [-1, 0, 1]) getTile(state.map, x + dx, y + dy)!.terrain = Terrain.Ocean;
      const t = getTile(state.map, x, y)!;
      delete t.deposit; // land made sea keeps no deposit
      t.special = true;
      t.secondSpecial = i >= 2;
      t.fishery = i % 2 === 1;
    }
    revealAround(state, 0, u.x, u.y + 3, 8);
    const view: MainScreenView = { originX: u.x - 7, originY: Math.max(0, u.y - 4), blink: false };
    const s = Surface.screen();
    drawMainScreen(s, state, view);
    mkdirSync(new URL("./out/", import.meta.url), { recursive: true });
    writeFileSync(new URL("./out/fishery.png", import.meta.url), encodePng(s, 3));
    // A fished square differs from its bare twin, and only by what is drawn over the sea.
    const square = (i: number) => {
      const [x, y] = at(i);
      const px = (VIEW_X + (x - view.originX) * TILE) * s.k;
      const py = (VIEW_Y + (y - view.originY) * TILE) * s.k;
      const out: number[] = [];
      for (let fy = 0; fy < TILE * s.k; fy++) for (let fx = 0; fx < TILE * s.k; fx++) out.push(s.fget(px + fx, py + fy));
      return out;
    };
    const differ = (a: number[], b: number[]) => a.filter((c, i) => c !== b[i]).length;
    expect(differ(square(0), square(1))).toBeGreaterThan(20);
    expect(differ(square(2), square(3))).toBeGreaterThan(20);
  });
});

describe("oil rigs on the map (save version 55)", () => {
  it("stand a steel deck on legs, a derrick and a flame over the oil at sea they were built on", () => {
    const state = newGame(5, { opponents: 1 });
    const u = state.units[0]!;
    state.players[0]!.advances.push("refining");
    // A strip of sea below the settlers: oil, bare and with its rig.
    const at = (i: number) => [u.x - 1 + i * 2, u.y + 3] as const;
    for (let i = 0; i < 2; i++) {
      const [x, y] = at(i);
      for (const dx of [-1, 0, 1]) for (const dy of [-1, 0, 1]) getTile(state.map, x + dx, y + dy)!.terrain = Terrain.Ocean;
      Object.assign(getTile(state.map, x, y)!, { special: true, deposit: "Oil", rig: i === 1 });
    }
    revealAround(state, 0, u.x, u.y + 3, 8);
    const view: MainScreenView = { originX: u.x - 7, originY: Math.max(0, u.y - 4), blink: false };
    const s = Surface.screen();
    drawMainScreen(s, state, view);
    writeFileSync(new URL("./out/rig.png", import.meta.url), encodePng(s, 3));
    const square = (i: number) => {
      const [x, y] = at(i);
      const px = (VIEW_X + (x - view.originX) * TILE) * s.k;
      const py = (VIEW_Y + (y - view.originY) * TILE) * s.k;
      const out: number[] = [];
      for (let fy = 0; fy < TILE * s.k; fy++) for (let fx = 0; fx < TILE * s.k; fx++) out.push(s.fget(px + fx, py + fy));
      return out;
    };
    expect(square(0).filter((c, i) => c !== square(1)[i]).length).toBeGreaterThan(40);
  });
});
