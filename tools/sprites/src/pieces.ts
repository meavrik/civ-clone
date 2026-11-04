import type { Image } from "./png.js";

/** A run of a sheet's opaque pixels, touching side or corner: its bounds, its size and the sum of its pixels' places. */
export interface Piece {
  id: number;
  x0: number; y0: number; x1: number; y1: number;
  n: number;
  sx: number; sy: number;
}

/** The sheet's pieces of pixels of alpha over `solid`, and the piece each pixel belongs to (-1: none). */
export function piecesOf({ width: W, height: H, data }: Image, solid = 64): { owner: Int32Array; pieces: Piece[] } {
  const isSolid = (i: number) => data[i * 4 + 3]! > solid;
  const owner = new Int32Array(W * H).fill(-1);
  const pieces: Piece[] = [];
  for (let s = 0; s < W * H; s++) {
    if (!isSolid(s) || owner[s]! >= 0) continue;
    const p = { id: pieces.length, x0: W, y0: H, x1: -1, y1: -1, n: 0, sx: 0, sy: 0 };
    pieces.push(p);
    const stack = [s];
    owner[s] = p.id;
    while (stack.length) {
      const i = stack.pop()!;
      const x = i % W, y = Math.floor(i / W);
      p.n++; p.sx += x; p.sy += y;
      p.x0 = Math.min(p.x0, x); p.x1 = Math.max(p.x1, x); p.y0 = Math.min(p.y0, y); p.y1 = Math.max(p.y1, y);
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const j = ny * W + nx;
          if (isSolid(j) && owner[j]! < 0) { owner[j] = p.id; stack.push(j); }
        }
    }
  }
  return { owner, pieces };
}
