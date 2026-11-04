import type { Image } from "../src/png.js";
import type { Piece } from "../src/pieces.js";

/** The improvements on buildings.png, row by row, left to right. */
export const IMPROVEMENT_ROWS = [
  ["palace", "barracks", "granary", "harbour", "temple", "marketplace", "library"],
  ["courthouse", "city_walls", "aqueduct", "bank", "cathedral", "university", "mass_transit"],
  ["colosseum", "factory", "mfg_plant", "sdi_defense", "recycling_center", "power_plant", "hydro_plant"],
  ["nuclear_plant", "data_center", "cell_tower", "solar_plant", "automated_office", "quantum_lab"],
];

/** The sheets of wonders: each file, its cells' size, and the wonder of each row. */
export const WONDER_SHEETS = [
  { file: "wonders-1.png", cell: 418, wonders: ["pyramids", "hanging_gardens", "colossus"] },
  { file: "wonders-2.png", cell: 418, wonders: ["seti_program", "apollo_program", "cure_for_cancer"] },
  { file: "wonders-3.png", cell: 418, wonders: ["hoover_dam", "manhattan_project", "united_nations"] },
  { file: "wonders-4.png", cell: 418, wonders: ["js_bachs", "darwins_voyage", "womens_suffrage"] },
  { file: "wonders-5.png", cell: 418, wonders: ["michelangelos", "shakespeares", "isaac_newtons"] },
  { file: "wonders-6.png", cell: 418, wonders: ["great_wall", "copernicus", "magellans"] },
  { file: "wonders-7.png", cell: 418, wonders: ["lighthouse", "great_library", "oracle"] },
];

/** What each column of a sheet of wonders is called after the wonder's id (renderer-api `wonderStages`); finished, the id alone. */
export const STAGE_SUFFIXES = ["-start", "-construction", ""];

/** Pixels kept round each picture's bounds. */
export const MARGIN = 2;

/** A stage of a wonder: `name`, the box of the sheet that is its own, and where that lies on the wonder's canvas. */
export interface StageCut {
  name: string;
  x0: number; y0: number; w: number; h: number;
  at: [x: number, y: number];
  /** The pieces that are its own. */
  own: Piece[];
}

/**
 * Where the stages of the wonders of a sheet lie. A stage is the pieces whose middle lies in its cell (a picture may run
 * past its cell, even past the edge of the sheet's first column), cut by their bounds a few pixels out. The three of a
 * wonder share one canvas, as big as they need, each where the sheet puts it in its cell, so they lie in register as
 * drawn; the canvas is wider than a cell at times, so a stage is its own box on it, never a box of the sheet at the
 * canvas's size, which would hold part of the stage beside it.
 */
export function wonderCuts({ width: W, height: H }: Image, pieces: Piece[], cell: number, wonders: string[]): { id: string; w: number; h: number; stages: StageCut[] }[] {
  const inCell = (r: number, c: number) => pieces.filter((p) => Math.floor(p.sy / p.n / cell) === r && Math.floor(p.sx / p.n / cell) === c);
  return wonders.map((id, r) => {
    const boxes = STAGE_SUFFIXES.map((suffix, c) => {
      const own = inCell(r, c);
      if (!own.length) throw new Error(`${id + suffix}: its cell is empty`);
      const x0 = Math.max(0, Math.min(...own.map((p) => p.x0)) - MARGIN), y0 = Math.max(0, Math.min(...own.map((p) => p.y0)) - MARGIN);
      const x1 = Math.min(W - 1, Math.max(...own.map((p) => p.x1)) + MARGIN), y1 = Math.min(H - 1, Math.max(...own.map((p) => p.y1)) + MARGIN);
      return { name: id + suffix, own, x0, y0, w: x1 - x0 + 1, h: y1 - y0 + 1, cellX: c * cell, cellY: r * cell };
    });
    const left = Math.min(...boxes.map((b) => b.x0 - b.cellX)), top = Math.min(...boxes.map((b) => b.y0 - b.cellY));
    const w = Math.max(...boxes.map((b) => b.x0 - b.cellX + b.w)) - left, h = Math.max(...boxes.map((b) => b.y0 - b.cellY + b.h)) - top;
    return { id, w, h, stages: boxes.map(({ cellX, cellY, ...b }) => ({ ...b, at: [b.x0 - cellX - left, b.y0 - cellY - top] as [number, number] })) };
  });
}
