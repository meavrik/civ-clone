/**
 * Deterministic PRNG (xoshiro128**). Every game-state mutation that needs
 * randomness draws from the state's own RNG, so a (seed, command log) pair
 * replays to an identical game — the basis for saves, replays and headless
 * AI tournaments later.
 */
export interface RngState {
  s: [number, number, number, number];
}

function splitmix32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x9e3779b9) >>> 0;
    let t = a ^ (a >>> 16);
    t = Math.imul(t, 0x21f0aaad);
    t ^= t >>> 15;
    t = Math.imul(t, 0x735a2d97);
    return (t ^ (t >>> 15)) >>> 0;
  };
}

export function createRng(seed: number): RngState {
  const sm = splitmix32(seed);
  return { s: [sm(), sm(), sm(), sm()] };
}

function rotl(x: number, k: number): number {
  return ((x << k) | (x >>> (32 - k))) >>> 0;
}

/** Advances the state in place and returns a uint32. */
export function nextU32(r: RngState): number {
  const s = r.s;
  const result = Math.imul(rotl(Math.imul(s[1], 5) >>> 0, 7), 9) >>> 0;
  const t = (s[1] << 9) >>> 0;
  s[2] ^= s[0];
  s[3] ^= s[1];
  s[1] ^= s[2];
  s[0] ^= s[3];
  s[2] ^= t;
  s[3] = rotl(s[3], 11);
  return result;
}

/** Float in [0, 1). */
export function nextFloat(r: RngState): number {
  return nextU32(r) / 4294967296;
}

/** Integer in [0, n). */
export function nextInt(r: RngState, n: number): number {
  return Math.floor(nextFloat(r) * n);
}
