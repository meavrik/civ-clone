import { mkdirSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { newGame, Terrain, type GameState } from "@civ/core";
import { terrainInfo, type MenuState } from "@civ/renderer-api";
import { drawMenu, ICON_SHEET, spriteSurface, squarePainter, Surface } from "../src/index.js";
import { ICON } from "../src/icons.js";
import { drawSquareCard } from "../src/square-card.js";
import { drawJobMark, drawResourceMark, MARK_SIZE } from "../src/marks.js";
import { SPRITE_CLEAR } from "../src/sprites/sheet.js";
import { encodePng } from "./png.js";

/** A game with the first square of `terrain` known to the player and laid as `change` has it. */
function squareOf(terrain: Terrain, change: object = {}): { state: GameState; x: number; y: number } {
  const state = newGame(1, {});
  const { map } = state;
  const at = map.tiles.findIndex((t, i) => t.terrain === terrain && i % map.width > 2 && i % map.width < map.width - 3 && i > 3 * map.width && i < (map.height - 3) * map.width);
  Object.assign(map.tiles[at]!, { special: false, river: false, road: false, railroad: false, irrigation: false, mine: false, hut: false, fortress: false }, change);
  state.players[state.currentPlayer]!.explored.fill(1);
  return { state, x: at % map.width, y: Math.floor(at / map.width) };
}

/** The square's window as a picture, in `tests/out`. */
function dump(name: string, state: GameState, x: number, y: number): void {
  const info = terrainInfo(state, x, y);
  const menu: MenuState = { title: info.title, card: info.card!, items: [], selected: -1, close: true, square: { x, y } };
  const s = Surface.screen();
  s.fill(0);
  drawMenu(s, menu, squarePainter(menu, state));
  mkdirSync(new URL("./out/", import.meta.url), { recursive: true });
  writeFileSync(new URL(`./out/${name}.png`, import.meta.url), encodePng(s, 4));
}

describe("the square's window", () => {
  it("draws the yields as large as the words", () => {
    const { state, x, y } = squareOf(Terrain.Grassland);
    const card = terrainInfo(state, x, y).card!;
    const drawn = (food: number) => {
      const s = Surface.fine(240, 80);
      s.fill(15);
      drawSquareCard(s, { ...card, yields: { ...card.yields, food } }, 0, 0, 240);
      return s;
    };
    // What changes with the figure is the figure: as tall as the font's digits, nine fine rows, no more.
    const one = drawn(2), other = drawn(8);
    let rows = 0;
    for (let j = 0; j < one.fh; j++) if (one.data.subarray(j * one.fw, (j + 1) * one.fw).some((c, i) => c !== other.data[j * one.fw + i])) rows++;
    expect(rows).toBeGreaterThan(0);
    expect(rows).toBeLessThanOrEqual(9);
    dump("square-card", state, x, y);
  });

  it("lays what is built on a square as the token the map marks it with", () => {
    const cell = (draw: (s: Surface) => void) => {
      const s = Surface.fine(ICON, ICON);
      s.fill(SPRITE_CLEAR);
      draw(s);
      return s;
    };
    const tokens = [
      ...(["road", "railroad", "irrigate", "mine", "fortress", "clean"] as const).map((w) => [w, cell((s) => drawJobMark(s, 0, 0, w, ICON))] as const),
      ["fishery", cell((s) => drawResourceMark(s, 0, 0, "fish", ICON))] as const,
      ["rig", cell((s) => drawResourceMark(s, 0, 0, "offshore_oil", ICON))] as const,
    ];
    // A mark stands in the corner of its square, two fine pixels in from this cell's left; an icon one.
    for (const [name, mark] of tokens) {
      const icon = spriteSurface(ICON_SHEET, name)!;
      for (let j = 0; j < MARK_SIZE; j++)
        for (let i = 0; i < MARK_SIZE; i++) expect(icon.fget(1 + i, 1 + j), `${name} at ${i},${j}`).toBe(mark.fget(2 + i, 1 + j));
    }
    expect(spriteSurface(ICON_SHEET, "harbour")).toBeTruthy();
  });

  it("gives works on the land their tokens, in both groups", () => {
    const { state, x, y } = squareOf(Terrain.Hills, { road: true, mine: true, fortress: true });
    const groups = terrainInfo(state, x, y).card!.groups;
    const icons = (title: string) => groups.find((g) => g.title === title)!.facts.map((f) => f.icon);
    expect(icons("Here")).toEqual(expect.arrayContaining(["road", "mine", "fortress"]));
    expect(icons("Improve")).toContain("irrigate");
    dump("square-card-works", state, x, y);
  });

  it("gives the sea's works tokens of their own, not the yields' pictures", () => {
    const { state, x, y } = squareOf(Terrain.Ocean, { special: true });
    const facts = terrainInfo(state, x, y).card!.groups.flatMap((g) => g.facts);
    expect(facts.find((f) => f.name === "Harbour")?.icon).toBe("harbour");
    const boat = facts.find((f) => f.name === "Fishing Boat");
    if (boat) expect(boat.icon).toBe("fishery");
    dump("square-card-sea", state, x, y);
  });
});
