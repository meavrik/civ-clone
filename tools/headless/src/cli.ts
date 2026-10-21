import { writeFileSync } from "node:fs";
import { PREMADE_WORLDS, WORLD_SIZES, type WorldSize } from "@civ/core";
import { AIS, defaultConfig, replayMatches, runGame, seatAis, type GameConfig, type GameResult, type PlayerStats, type Sample } from "./index.js";

/**
 * CLI: run N seeded AI-vs-AI games and print per-game and aggregate stats.
 *
 *   npm run headless -- --games 4 --seed 1 --turns 200 --civs 4 --every 50
 *   npm run headless -- --ai baseline,planner --games 10 --json out.json --verify
 */
interface Options {
  games: number;
  seed: number;
  turns: number;
  civs: number;
  difficulty: number;
  every: number;
  ais: string[];
  json: string | null;
  verify: boolean;
  quiet: boolean;
  world: string | null;
  size: WorldSize | null;
  historical: boolean;
  classicTerrain: boolean;
  classicCivs: boolean;
  openMountains: boolean;
  looseUpkeep: boolean;
  workBeyondBorders: boolean;
  simpleMoods: boolean;
}

const HELP = `headless: seeded AI-vs-AI games for the Epochs engine

  --games N        games to play (default 1); game i uses seed+i
  --seed S         first seed (default 1)
  --turns T        rounds per game (default 200)
  --civs C         civilizations per game, 2..8 (default 4)
  --difficulty D   0 Chieftain .. 4 Emperor (default 2)
  --every K        print a stats row for every civ every K turns (default 0: final only)
  --ai a,b,...     AI per seat, cycled (default planner; known: ${Object.keys(AIS).join(", ")})
  --json FILE      write all results (with per-sample series) as JSON
  --world W        play on a premade world (${PREMADE_WORLDS.map((w) => w.id).join(", ")})
  --size S         world size (${WORLD_SIZES.map((s) => `${s.id} ${s.width}x${s.height}`).join(", ")}; default small)
  --historical     on a premade world, start each civ in its historical homeland
  --classic-terrain  the 1991 terrain: wheels need no roads, no ground wears units down
  --classic-civs     the 1991 civilizations: no traits, no starting advance
  --open-mountains   every land unit climbs mountains, not only settlers
  --loose-upkeep     our first unit upkeep: 3 free units a city under Monarchy and Communism too
  --work-beyond-borders  cities work all 21 squares, inside their border or not (saves before version 16)
  --simple-moods   our first moods: no celebrations, martial law capped at three, no Democracy toppled by riots (saves before version 17)
  --verify         replay each game from its save and check the state matches
  --quiet          only the aggregate summary
  --help`;

function parseArgs(argv: string[]): Options {
  const o: Options = { games: 1, seed: 1, turns: 200, civs: 4, difficulty: 2, every: 0, ais: ["planner"], json: null, verify: false, quiet: false, world: null, size: null, historical: false, classicTerrain: false, classicCivs: false, openMountains: false, looseUpkeep: false, workBeyondBorders: false, simpleMoods: false };
  const num = (v: string | undefined, name: string): number => {
    const n = Number(v);
    if (v === undefined || !Number.isFinite(n)) throw new Error(`--${name} needs a number`);
    return n;
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    const eq = arg.indexOf("=");
    const key = eq >= 0 ? arg.slice(2, eq) : arg.slice(2);
    const value = eq >= 0 ? arg.slice(eq + 1) : argv[i + 1];
    const takes = () => { if (eq < 0) i++; return value; };
    if (!arg.startsWith("--")) throw new Error(`unexpected argument ${arg}`);
    switch (key) {
      case "games": o.games = num(takes(), key); break;
      case "seed": o.seed = num(takes(), key); break;
      case "turns": o.turns = num(takes(), key); break;
      case "civs": o.civs = num(takes(), key); break;
      case "difficulty": o.difficulty = num(takes(), key); break;
      case "every": o.every = num(takes(), key); break;
      case "ai": o.ais = (takes() ?? "").split(",").map((s) => s.trim()).filter(Boolean); break;
      case "json": o.json = takes() ?? null; break;
      case "verify": o.verify = true; break;
      case "world": o.world = takes() ?? null; break;
      case "size": o.size = (takes() ?? null) as WorldSize | null; break;
      case "historical": o.historical = true; break;
      case "classic-terrain": o.classicTerrain = true; break;
      case "classic-civs": o.classicCivs = true; break;
      case "open-mountains": o.openMountains = true; break;
      case "loose-upkeep": o.looseUpkeep = true; break;
      case "work-beyond-borders": o.workBeyondBorders = true; break;
      case "simple-moods": o.simpleMoods = true; break;
      case "quiet": o.quiet = true; break;
      case "help": console.log(HELP); process.exit(0);
      default: throw new Error(`unknown option --${key}\n\n${HELP}`);
    }
  }
  if (o.civs < 2 || o.civs > 8) throw new Error("--civs must be 2..8");
  if (o.difficulty < 0 || o.difficulty > 4) throw new Error("--difficulty must be 0..4");
  if (o.world && !PREMADE_WORLDS.some((w) => w.id === o.world)) throw new Error(`unknown world "${o.world}"`);
  if (o.size && !WORLD_SIZES.some((s) => s.id === o.size)) throw new Error(`unknown size "${o.size}" (known: ${WORLD_SIZES.map((s) => s.id).join(", ")})`);
  for (const a of o.ais) if (!AIS[a]) throw new Error(`unknown AI "${a}" (known: ${Object.keys(AIS).join(", ")})`);
  return o;
}

// ---- formatting --------------------------------------------------------------
const COLS: [keyof PlayerStats | "name", string, number][] = [
  ["name", "civ", 18],
  ["cities", "cities", 6],
  ["pop", "pop", 5],
  ["units", "units", 5],
  ["military", "mil", 4],
  ["techs", "techs", 5],
  ["overseas", "ovsea", 5],
  ["captured", "took", 4],
  ["lost", "lost", 4],
  ["gold", "gold", 6],
  ["government", "gov", 10],
  ["score", "score", 5],
];

function row(p: PlayerStats, turn?: number): string {
  const name = `${p.civ}${p.alive ? "" : " (dead)"}`;
  const cells = COLS.map(([key, , w]) => {
    const v = key === "name" ? name : key === "ai" || key === "civ" || key === "government" ? String(p[key]) : String(p[key]);
    return key === "name" || key === "government" ? v.padEnd(w) : v.padStart(w);
  });
  return `${turn === undefined ? "" : String(turn).padStart(5) + " "}${cells.join(" ")}  ${p.ai}`;
}

function header(withTurn: boolean): string {
  const cells = COLS.map(([key, label, w]) => (key === "name" || key === "government" ? label.padEnd(w) : label.padStart(w)));
  return `${withTurn ? " turn " : ""}${cells.join(" ")}  ai`;
}

function printSample(s: Sample): void {
  for (const p of s.players) console.log(row(p, s.turn));
}

function printGame(index: number, r: GameResult, verified: boolean | null): void {
  const end = r.end === "conquest" ? "conquest" : r.end === "space" ? "spaceship" : "turn limit";
  const winner = r.winner === null ? "nobody" : r.players.find((p) => p.id === r.winner)!.civ;
  const check = verified === null ? "" : verified ? "  replay ok" : "  REPLAY MISMATCH";
  console.log(`game ${index + 1}  seed ${r.seed}  ${r.turns} turns  ${end}  winner: ${winner}  ${(r.ms / 1000).toFixed(1)}s${check}`);
  console.log("  " + header(false));
  for (const p of r.players) console.log("  " + row(p));
}

interface Agg { games: number; wins: number; cities: number; pop: number; techs: number; score: number; alive: number; overseas: number; captured: number; lost: number }

function printSummary(results: GameResult[]): void {
  const byAi = new Map<string, Agg>();
  const bump = (ai: string): Agg => {
    let a = byAi.get(ai);
    if (!a) { a = { games: 0, wins: 0, cities: 0, pop: 0, techs: 0, score: 0, alive: 0, overseas: 0, captured: 0, lost: 0 }; byAi.set(ai, a); }
    return a;
  };
  let mismatches = 0;
  for (const r of results) {
    for (const p of r.players) {
      const a = bump(p.ai);
      a.games++;
      a.cities += p.cities;
      a.pop += p.pop;
      a.techs += p.techs;
      a.score += p.score;
      a.overseas += p.overseas;
      a.captured += p.captured;
      a.lost += p.lost;
      if (p.alive) a.alive++;
      if (p.id === r.winner) a.wins++;
    }
  }
  const totalMs = results.reduce((s, r) => s + r.ms, 0);
  const conquests = results.filter((r) => r.end === "conquest").length;
  const landings = results.filter((r) => r.end === "space").length;
  console.log(`\nsummary: ${results.length} game(s), ${conquests} by conquest, ${landings} by spaceship, ${(totalMs / 1000).toFixed(1)}s total`);
  console.log("  ai            seats  wins  alive  cities    pop  techs  score  ovsea   took   lost   (means per seat)");
  for (const [ai, a] of byAi) {
    const m = (v: number) => (v / a.games).toFixed(1).padStart(6);
    console.log(`  ${ai.padEnd(13)} ${String(a.games).padStart(5)} ${String(a.wins).padStart(5)} ${String(a.alive).padStart(6)} ${m(a.cities)}  ${m(a.pop)} ${m(a.techs)} ${m(a.score)} ${m(a.overseas)} ${m(a.captured)} ${m(a.lost)}`);
  }
  void mismatches;
}

// ---- main -----------------------------------------------------------------------
function main(argv: string[]): number {
  let o: Options;
  try {
    o = parseArgs(argv);
  } catch (err) {
    console.error((err as Error).message);
    return 2;
  }
  const results: GameResult[] = [];
  let bad = 0;
  for (let g = 0; g < o.games; g++) {
    const config: GameConfig = defaultConfig(o.seed + g, {
      civs: o.civs, difficulty: o.difficulty, turns: o.turns, ais: o.ais, every: o.every,
      ...(o.world ? { world: o.world, historical: o.historical } : {}),
      ...(o.size ? { size: o.size } : {}),
      ...(o.classicTerrain ? { classicTerrain: true } : {}),
      ...(o.classicCivs ? { classicCivs: true } : {}),
      ...(o.openMountains ? { openMountains: true } : {}),
      ...(o.looseUpkeep ? { looseUpkeep: true } : {}),
      ...(o.workBeyondBorders ? { workBeyondBorders: true } : {}),
      ...(o.simpleMoods ? { simpleMoods: true } : {}),
    });
    if (!o.quiet && o.every > 0) {
      console.log(`game ${g + 1}  seed ${config.seed}  seats: ${seatAis(config).join(", ")}`);
      console.log(header(true));
    }
    const r = runGame(config, !o.quiet && o.every > 0 ? printSample : undefined);
    let verified: boolean | null = null;
    if (o.verify) {
      verified = replayMatches(r);
      if (!verified) bad++;
    }
    results.push(r);
    if (!o.quiet) printGame(g, r, verified);
  }
  printSummary(results);
  if (o.verify) console.log(bad === 0 ? `verify: all ${results.length} replay(s) match` : `verify: ${bad} replay(s) DIVERGED`);
  if (o.json) {
    writeFileSync(o.json, JSON.stringify(results.map(({ save, ...rest }) => ({ ...rest, save })), null, 1));
    console.log(`wrote ${o.json}`);
  }
  return bad ? 1 : 0;
}

process.exitCode = main(process.argv.slice(2));
