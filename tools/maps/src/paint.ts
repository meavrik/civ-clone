import type { WorldSize } from "@civ/core";
import type { Patch } from "./frames.js";

/**
 * Earth's small shapes, painted over the real coast (asked for 2026-11-06: Japan "too huge now and far from the main land", then
 * "still huge"; Italy and Sicily "wierd and not recognized"; "missing Baja California peninsula"). Read off the data's land
 * coverage square by square, then thickened only as far as a shape needs to read. See `Patch`: "#" land, "." sea, a space as the data has it.
 */
export const EARTH_PAINT: Partial<Record<WorldSize, readonly Patch[]>> = {
  large: [
    // Japan: its real arc, one square of sea off Korea, Hokkaido over its strait.
    {
      at: [140, 29],
      own: true,
      rows: [
        "  ......",
        "  ..##..",
        "  ..###.",
        "  ..##..",
        "........",
        "...##...",
        "...##...",
        "...##...",
        "..###...",
        ".####...",
        ".###....",
        "###.....",
        "##......",
        "##......",
        "........",
      ],
    },
    // Italy: the leg down from Liguria, the toe longer than the heel and the Gulf of Taranto between them.
    {
      at: [76, 31],
      rows: [
        ".###..",
        "..###..",
        "...###...",
        ".....###.",
        ".....#.#.",
        ".....#...",
        "  .......",
      ],
    },
    { at: [76, 33], own: true, rows: ["#"] }, // Corsica
    { at: [76, 35], own: true, rows: ["#", "#"] }, // Sardinia
    // Sicily, a flat-topped triangle a square of strait off the toe.
    { at: [79, 38], own: true, rows: ["###", ".#."] },
    // Baja California, the Gulf carved out beside it.
    {
      at: [19, 43],
      rows: [
        ".##.",
        "..#.",
        "..#.",
        "..#..",
        "..##.",
        "...#.",
        ".....",
      ],
    },
  ],
  medium: [
    {
      at: [105, 22],
      own: true,
      rows: [
        "   ##.",
        " ..##.",
        "......",
        "...#..",
        "..##..",
        "..##..",
        ".###..",
        ".##...",
        ".##...",
        "##....",
        "#.....",
        "......",
      ],
    },
    {
      at: [57, 23],
      rows: [
        ".##..",
        "..##.",
        "...##.",
        "....#.",
        " .....",
      ],
    },
    { at: [57, 25], own: true, rows: ["#", "#"] }, // Sardinia
    { at: [59, 28], own: true, rows: ["###", ".#."] }, // Sicily
    {
      at: [15, 32],
      rows: [
        "#",
        "#..",
        "##.",
        ".#..",
        ".##.",
        "....",
      ],
    },
  ],
  small: [
    {
      at: [70, 14],
      own: true,
      rows: [
        "  ...",
        "  ##.",
        " ....",
        "..##.",
        ".##..",
        ".##..",
        "###..",
        "##...",
        ".....",
      ],
    },
    {
      at: [38, 15],
      rows: [
        "  .",
        ".#..",
        ".##.",
        "....",
      ],
    },
    { at: [37, 17], own: true, rows: ["#"] }, // Sardinia
    { at: [40, 19], own: true, rows: ["#"] }, // Sicily
    { at: [10, 22], rows: ["#.", "#."] },
  ],
};
