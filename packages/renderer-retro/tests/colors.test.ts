import { mkdirSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createUnit, foundCity, getTile, newGame, recomputeVisibility, Terrain } from "@civ/core";
import { C, DETAIL, DEVICES, drawHpBar, drawMainScreen, drawUnit, PLAYER_COLORS, Surface, type MainScreenView } from "../src/index.js";
import { PALETTE_RGBA } from "../src/palette.js";
import { encodePng } from "./png.js";

const lin = (c: number) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const gam = (c: number) => { c = Math.max(0, Math.min(1, c)); return Math.round(255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055)); };
/** Machado, Oliveira and Fernandes (2009), severity 1: how a dichromat sees a colour. */
const CVD = {
  protan: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
  deutan: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.01182, 0.04294, 0.968881]],
  tritan: [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.3039]],
} as const;

/** The surface as PNGs: as drawn, then as each colour blindness sees it (`civ-colors-protan.png` ...). */
function writeSeen(s: Surface, name: string, scale: number): void {
  mkdirSync(new URL("./out/", import.meta.url), { recursive: true });
  writeFileSync(new URL(`./out/${name}.png`, import.meta.url), encodePng(s, scale));
  for (const [kind, m] of Object.entries(CVD)) {
    const saved = PALETTE_RGBA.slice();
    for (let i = 0; i < 256; i++) {
      const c = [lin(saved[i * 4]!), lin(saved[i * 4 + 1]!), lin(saved[i * 4 + 2]!)];
      for (let k = 0; k < 3; k++) PALETTE_RGBA[i * 4 + k] = gam(m[k]![0]! * c[0]! + m[k]![1]! * c[1]! + m[k]![2]! * c[2]!);
    }
    writeFileSync(new URL(`./out/${name}-${kind}.png`, import.meta.url), encodePng(s, scale));
    PALETTE_RGBA.set(saved);
  }
}

/** CIE L*a*b* of a palette colour. */
function lab(i: number): [number, number, number] {
  const [r, g, b] = [lin(PALETTE_RGBA[i * 4]!), lin(PALETTE_RGBA[i * 4 + 1]!), lin(PALETTE_RGBA[i * 4 + 2]!)];
  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  const x = f((0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047), y = f(0.2126 * r + 0.7152 * g + 0.0722 * b), z = f((0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}

describe("civilization colours", () => {
  it("are far apart to the eye, and each bears its own device, below a wounded unit's hit points too", () => {
    let nearest = Infinity;
    PLAYER_COLORS.forEach((a, i) => PLAYER_COLORS.slice(i + 1).forEach((b) => {
      const [p, q] = [lab(a), lab(b)];
      nearest = Math.min(nearest, Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]));
    }));
    // The nearest pair (green and yellow) at about 39; light cyan and light grey beside white came to 30.
    expect(nearest).toBeGreaterThan(35);
    expect(DEVICES.length).toBe(PLAYER_COLORS.length);
    // What shows of each device from the shield's fifth row down (the hit points cover the four above).
    const below = DEVICES.map((d) => d.slice(4).join("|"));
    expect(new Set(below).size).toBe(DEVICES.length);
  });

  it("draws every shield large, whole and wounded", () => {
    const s = new Surface(8 + PLAYER_COLORS.length * 20, 40, undefined, DETAIL);
    s.fill(C.BLACK!);
    PLAYER_COLORS.forEach((color, i) => {
      const x = 4 + i * 20;
      s.rect(x, 2, 16, 16, 30);
      s.rect(x, 22, 16, 16, 30);
      drawUnit(s, { type: "legion", order: { kind: "none" } }, x, 2, color, false);
      drawUnit(s, { type: "legion", order: { kind: "none" } }, x, 22, color, i % 2 === 0);
      drawHpBar(s, x, 22, 4, 10);
    });
    writeSeen(s, "civ-shields", 12);
  });

  it("draws every colour's units, cities and borders side by side, as seen with each colour blindness", () => {
    const state = newGame(3, { opponents: 7 });
    const { map } = state;
    const x0 = 10, y0 = 20;
    for (let y = y0 - 2; y < y0 + 12; y++) for (let x = x0 - 2; x < x0 + 18; x++) {
      const t = getTile(map, x, y)!;
      t.terrain = (x + y) % 5 === 0 ? Terrain.Forest : (x * 3 + y) % 7 === 0 ? Terrain.Plains : Terrain.Grassland;
      t.river = false; t.hut = false; t.special = false; t.secondSpecial = false;
    }
    state.units = [];
    const civs = state.players.filter((p) => p.id !== state.barbarians);
    civs.forEach((p, i) => {
      const x = x0 + (i % 4) * 4, y = y0 + Math.floor(i / 4) * 5;
      foundCity(state, p.id, x, y);
      createUnit(state, "legion", p.id, x + 1, y + 1);
      createUnit(state, "settlers", p.id, x, y + 2);
      createUnit(state, "cavalry", p.id, x + 1, y + 2);
    });
    createUnit(state, "legion", state.barbarians, x0 + 15, y0 + 2);
    createUnit(state, "cavalry", state.barbarians, x0 + 15, y0 + 7);
    for (const p of state.players) p.explored.fill(1);
    recomputeVisibility(state, 0);
    state.players[0]!.visible.fill(1);
    state.activeUnit = null;
    const view: MainScreenView = { originX: x0 - 1, originY: y0 - 1, blink: false, borders: true, placeNames: false };
    const s = Surface.screen();
    drawMainScreen(s, state, view);
    writeSeen(s, "civ-colors", 3);
  });
});
