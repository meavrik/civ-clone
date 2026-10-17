/** Tiny deterministic hash in 0..1 for drawing variety (never the game RNG). */
export function hash(x: number, y: number, salt: number): number {
  let n = (x * 374761393 + y * 668265263 + salt * 1274126177) | 0;
  n = (n ^ (n >>> 13)) * 1274126177;
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

/** Smooth value noise in -1..1 with `f` lattice points per square, wrapping every `width` squares. */
export function valueNoise(wx: number, wy: number, f: number, width: number, salt: number): number {
  const period = Math.round(width * f);
  const gx = wx * f;
  const gy = wy * f;
  const ix = Math.floor(gx);
  const iy = Math.floor(gy);
  const tx = gx - ix;
  const ty = gy - iy;
  const sx = tx * tx * (3 - 2 * tx);
  const sy = ty * ty * (3 - 2 * ty);
  const x0 = ((ix % period) + period) % period;
  const x1 = (x0 + 1) % period;
  const a = hash(x0, iy, salt);
  const b = hash(x1, iy, salt);
  const c = hash(x0, iy + 1, salt);
  const d = hash(x1, iy + 1, salt);
  return (a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy) * 2 - 1;
}
