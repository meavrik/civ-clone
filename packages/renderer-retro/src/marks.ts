import type { WorkKind } from "@civ/core";
import type { ArtBox } from "@civ/renderer-api";
import { runHoles } from "./art-holes.js";
import { shade, UNSEEN } from "./palette.js";
import { DETAIL, type Surface } from "./surface.js";

/**
 * The marks of the resources (asked for 2026-11-02: "when a city or improvement is built on a horse or elephant -
 * maybe show a small symbolic icon on the tile edge"; the user picked a tiny silhouette on a round dark token in the
 * top right corner, over a half-size copy of the icon they did not like): where a city or a work's picture stands on
 * a resource's square, the resource is told by a pictogram of our own drawing, 9x9 fine pixels in cream on a dark
 * slate token, the work or the city whole beside it. One per resource, named as its icon in the resources sheet; the
 * icons' own shapes at that size were blobs (coal, gold and gems alike), so these are drawn for it, each the plainest
 * thing that tells the resource: a horse's head, a bull's, antlers, a coin, a drop of oil.
 */
const MARKS: Record<string, readonly string[]> = {
  fish: [
    ".........",
    ".........",
    "...###...",
    ".######.#",
    "###.####.",
    ".######.#",
    "...###...",
    ".........",
    ".........",
  ],
  whales: [
    "#.......#",
    "##.....##",
    ".##...##.",
    "..#####..",
    "...###...",
    "....#....",
    "....#....",
    "..#####..",
    ".#.....#.",
  ],
  // Bison: a bull's head with horns.
  bison: [
    "#.......#",
    "##.....##",
    ".#######.",
    "..#####..",
    "..#.#.#..",
    "..#####..",
    "...###...",
    "...#.#...",
    ".........",
  ],
  cotton: [
    "..#.#.#..",
    ".#######.",
    "#########",
    ".#######.",
    "..#####..",
    "....#....",
    "..#.#.#..",
    "...###...",
    "....#....",
  ],
  // Horse head facing left.
  horses: [
    "....#....",
    "...###...",
    "..#####..",
    ".#.#####.",
    "####.####",
    "##...####",
    ".....####",
    "....#####",
    "....####.",
  ],
  wheat: [
    "....#....",
    "...#.#...",
    "....#....",
    "...#.#...",
    "....#....",
    "...#.#...",
    "....#....",
    "....#....",
    "....#....",
  ],
  // Antlers.
  game: [
    "#.#...#.#",
    "#.#...#.#",
    ".##...##.",
    "..#...#..",
    "...###...",
    "...###...",
    "...###...",
    "....#....",
    ".........",
  ],
  // Spool.
  silk: [
    "#######..",
    ".#####...",
    ".#.#.#...",
    ".#####...",
    ".#.#.#...",
    ".#####...",
    "#######..",
    "......##.",
    ".......##",
  ],
  coal: [
    "...###...",
    "..#####..",
    "..#####..",
    "...###...",
    ".###.###.",
    "####.####",
    "####.####",
    ".###.###.",
    ".........",
  ],
  wine: [
    "....#....",
    "...##....",
    ".#######.",
    ".#.#.#.#.",
    ".#######.",
    "..#.#.#..",
    "..#####..",
    "...#.#...",
    "....#....",
  ],
  // Coin.
  gold: [
    "..#####..",
    ".##...##.",
    "##.###.##",
    "##.#...##",
    "##.###.##",
    "##...#.##",
    "##.###.##",
    ".##...##.",
    "..#####..",
  ],
  // Ingot.
  iron: [
    ".........",
    ".........",
    "..#####..",
    ".#######.",
    "#########",
    "#########",
    ".........",
    ".........",
    ".........",
  ],
  // Palm.
  oasis: [
    ".##.##...",
    "#..#..#..",
    "...#.....",
    "...#.....",
    "....#....",
    "....#....",
    "..#####..",
    ".#######.",
    ".........",
  ],
  // Drop.
  oil: [
    "....#....",
    "....#....",
    "...###...",
    "..#####..",
    ".#######.",
    ".#######.",
    ".#######.",
    "..#####..",
    "...###...",
  ],
  furs: [
    "#.......#",
    ".#.....#.",
    ".#######.",
    "..#####..",
    "..#####..",
    "..#####..",
    ".#######.",
    ".#.....#.",
    "#.......#",
  ],
  seals: [
    ".........",
    "..##.....",
    ".####....",
    "...##....",
    "...###...",
    "...#####.",
    "..#######",
    ".#.....#.",
    ".........",
  ],
  // Tusk.
  ivory: [
    "#........",
    "#........",
    "##.......",
    ".##......",
    ".###.....",
    "..####...",
    "...######",
    ".....####",
    ".........",
  ],
  // Stacked turves.
  peat: [
    ".........",
    "...###...",
    "...###...",
    ".###.###.",
    ".###.###.",
    "###.###.#",
    "###.###.#",
    ".........",
    ".........",
  ],
  // Pepper.
  spices: [
    ".....#...",
    "....#....",
    "...###...",
    "..####...",
    "..####...",
    ".####....",
    ".###.....",
    "##.......",
    ".........",
  ],
  // Diamond.
  gems: [
    ".........",
    "..#####..",
    ".#.#.#.#.",
    "#########",
    ".#######.",
    "..#####..",
    "...###...",
    "....#....",
    ".........",
  ],
  fruit: [
    "....#....",
    "...#.##..",
    ".###.###.",
    "#########",
    "#.#######",
    "#########",
    "#########",
    ".#######.",
    "..##.##..",
  ],
  saltpeter: [
    "....#....",
    "....#....",
    "#..###..#",
    "#..###..#",
    "##.###.##",
    "##.###.##",
    "##.###.##",
    "#########",
    ".........",
  ],
  // Elephant facing left.
  elephants: [
    ".........",
    "..#####..",
    ".#.######",
    "#########",
    "#.#######",
    "#.#######",
    "#.##..##.",
    "..##..##.",
    ".........",
  ],
  // Sheep facing right: a fleece on thin legs.
  sheep: [
    ".........",
    ".#.#.#...",
    "########.",
    "#########",
    "#######..",
    ".######..",
    ".#...#...",
    ".#...#...",
    ".........",
  ],
  // Camel facing right: two humps, the neck up to its head.
  camels: [
    ".......##",
    ".##.##.#.",
    "########.",
    ".######..",
    ".#....#..",
    ".#....#..",
    ".#....#..",
    ".#....#..",
    ".........",
  ],
  // Drop over a wave.
  offshore_oil: [
    "....#....",
    "...###...",
    "..#####..",
    "..#####..",
    "...###...",
    ".........",
    "##..##..#",
    "..##..##.",
    ".........",
  ],
};

/**
 * The marks of a settler's jobs (asked for 2026-11-02: "also change settler icons when working on something. maybe
 * also same style silluette"), worn by a unit at work in the same corner, on the same token, in place of the black
 * square with the panel's icon of the job it wore before; and a unit camped to heal, a heart.
 */
const JOB_MARKS: Record<WorkKind | "camp", readonly string[]> = {
  // A road receding.
  road: [
    "...#.#...",
    "...#.#...",
    "..#...#..",
    "..#.#.#..",
    ".#.....#.",
    ".#..#..#.",
    "#.......#",
    "#...#...#",
    ".........",
  ],
  // Rails on their sleepers.
  railroad: [
    ".#.....#.",
    "#########",
    ".#.....#.",
    ".#.....#.",
    "#########",
    ".#.....#.",
    ".#.....#.",
    "#########",
    ".#.....#.",
  ],
  // A drop of water over furrows.
  irrigate: [
    "....#....",
    "...###...",
    "..#####..",
    "..#####..",
    "...###...",
    ".........",
    "#.#.#.#.#",
    ".#.#.#.#.",
    ".........",
  ],
  // A pickaxe.
  mine: [
    "..#####..",
    ".#..#..#.",
    "#...#...#",
    "....#....",
    "....#....",
    "....#....",
    "....#....",
    "....#....",
    "....#....",
  ],
  // Battlements over a gate.
  fortress: [
    ".........",
    "#.#.#.#.#",
    "#########",
    "#########",
    "###...###",
    "##.....##",
    "##.....##",
    "##.....##",
    ".........",
  ],
  // A broom.
  clean: [
    ".......#.",
    "......#..",
    ".....#...",
    "....#....",
    "..###....",
    ".#####...",
    "#.#.#....",
    "#.#.#....",
    ".........",
  ],
  // A heart: resting to heal.
  camp: [
    ".........",
    ".##...##.",
    "####.####",
    "#########",
    "#########",
    ".#######.",
    "..#####..",
    "...###...",
    "....#....",
  ],
};

/** Fine pixels across the token. */
export const MARK_SIZE = 13;
const RIM = shade("steel", 0);
const FACE = shade("steel", 2);
const INK = shade("rock", 7);

/** Whether fine pixel (i, j) of the token lies on it (a disc). */
const onToken = (i: number, j: number) => Math.hypot(i + 0.5 - MARK_SIZE / 2, j + 0.5 - MARK_SIZE / 2) <= MARK_SIZE / 2;

/** The token's top left on the square at screen (dx, dy), `t` a side, in fine pixels: its top right corner, a fine pixel in from its edges. */
function tokenAt(dx: number, dy: number, t: number, k: number): [number, number] {
  return [(dx + t) * k - MARK_SIZE - 1, dy * k + 1];
}

/** `glyph` in cream on the slate token in the top right corner of the square at (dx, dy), `t` a side, `shaded` out of sight (`UNSEEN`). */
function drawToken(s: Surface, dx: number, dy: number, glyph: readonly string[], t: number, shaded: boolean): void {
  const tone = (c: number) => (shaded ? UNSEEN[c]! : c);
  const [x0, y0] = tokenAt(dx, dy, t, s.k);
  const r = MARK_SIZE / 2;
  for (let j = 0; j < MARK_SIZE; j++)
    for (let i = 0; i < MARK_SIZE; i++) if (onToken(i, j)) s.fset(x0 + i, y0 + j, tone(Math.hypot(i + 0.5 - r, j + 0.5 - r) > r - 1 ? RIM : FACE));
  const o = (MARK_SIZE - glyph.length) >> 1;
  glyph.forEach((row, j) => { for (let i = 0; i < row.length; i++) if (row[i] === "#") s.fset(x0 + o + i, y0 + o + j, tone(INK)); });
}

/**
 * The mark of resource `name` (its icon's name, "horses", "offshore_oil") in the top right corner of the square at
 * screen (dx, dy), `t` pixels a side, `shaded` out of sight; nothing for a resource without one.
 */
export function drawResourceMark(s: Surface, dx: number, dy: number, name: string, t: number, shaded = false): void {
  const glyph = MARKS[name];
  if (glyph) drawToken(s, dx, dy, glyph, t, shaded);
}

/** The mark of a unit's job (`WorkKind`, or "camp" resting to heal) in the top right corner of its square at (dx, dy), `t` a side. */
export function drawJobMark(s: Surface, dx: number, dy: number, job: WorkKind | "camp", t: number): void {
  drawToken(s, dx, dy, JOB_MARKS[job], t, false);
}

/** Where a mark's token lies on the square at (dx, dy), `t` a side, in screen pixels: its disc's rows, for a picture over it to leave it showing. */
export function markHoles(dx: number, dy: number, t: number): ArtBox[] {
  const [x0, y0] = tokenAt(dx, dy, t, DETAIL);
  return runHoles(MARK_SIZE, MARK_SIZE, DETAIL, x0 / DETAIL, y0 / DETAIL, onToken);
}
