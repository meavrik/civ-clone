import { shade, UNSEEN } from "./palette.js";
import type { Surface } from "./surface.js";

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
  // Buffalo: bull's head with horns.
  resources: [
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

/** Fine pixels across the token. */
export const MARK_SIZE = 13;
const RIM = shade("steel", 0);
const FACE = shade("steel", 2);
const INK = shade("rock", 7);

/**
 * The mark of resource `name` (its icon's name, "horses", "offshore_oil") in the top right corner of the square at
 * screen (dx, dy), `t` pixels a side, a fine pixel in from its edges, `shaded` out of sight (`UNSEEN`); nothing for a
 * resource without one.
 */
export function drawResourceMark(s: Surface, dx: number, dy: number, name: string, t: number, shaded = false): void {
  const glyph = MARKS[name];
  if (!glyph) return;
  const tone = (c: number) => (shaded ? UNSEEN[c]! : c);
  const k = s.k;
  const x0 = (dx + t) * k - MARK_SIZE - 1;
  const y0 = dy * k + 1;
  const r = MARK_SIZE / 2;
  for (let j = 0; j < MARK_SIZE; j++)
    for (let i = 0; i < MARK_SIZE; i++) {
      const d = Math.hypot(i + 0.5 - r, j + 0.5 - r);
      if (d <= r) s.fset(x0 + i, y0 + j, tone(d > r - 1 ? RIM : FACE));
    }
  const o = (MARK_SIZE - glyph.length) >> 1;
  glyph.forEach((row, j) => { for (let i = 0; i < row.length; i++) if (row[i] === "#") s.fset(x0 + o + i, y0 + o + j, tone(INK)); });
}
