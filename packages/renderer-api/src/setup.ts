import { advance, civ, colorSlot, DIFFICULTY_RULES, type CivRule } from "@civ/core";
import { PICTURES, type Part, type Picture } from "./cityview.js";
import { box, cols, disc, dome, door, flag, gable, line, oval, pic, poly, slope, windows } from "./shapes.js";

/**
 * The setup questions shown as cards with pictures (asked for 2026-10-22: a picture for every choice,
 * and the tribes as something better than a long list): difficulty as the ruler's seat growing grander,
 * the number of civilizations as that many towns on a patch of land, the tribes as a grid of emblems.
 * The cards are in the order of `setupMenu`'s items, so `setupChoose` takes a card's index.
 */

/** Ground under a picture: grass, sand or water. */
export type SetupGround = "grass" | "sand" | "water";

export type SetupArt =
  /** A picture (`setupPicture`) standing on its ground, flags in a colour slot. */
  | { kind: "picture"; id: string; ground: SetupGround; slot: number }
  /** A patch of land with a town for each civilization, flying these colour slots. */
  | { kind: "towns"; slots: number[] };

export interface SetupCard {
  label: string;
  /** A word under the label ("Easiest"). */
  note?: string;
  art: SetupArt;
  /** A tribe's colour slot, along the top of its card. */
  band?: number;
  /** The panel under the cards while this one is selected: its title, a word at the title's right,
   * and lines (which may carry `{icon}` tokens). */
  heading: string;
  right?: string;
  lines: string[];
}

export interface SetupCards {
  title: string;
  /** Cards to a row: one row for difficulty and the count, a grid for the tribes. */
  columns: number;
  cards: SetupCard[];
}

// ---- the questions -------------------------------------------------------------------

const LEVEL_NOTES = ["Easiest", "Easy", "Moderate", "Hard", "Hardest"];
const LEVEL_WORDS = [
  "For a first game: patient people, help to begin.",
  "A gentle challenge.",
  "A fair contest.",
  "For seasoned rulers.",
  "The hardest test: restless cities from the start.",
];
const COUNT_WORDS: Record<number, string> = {
  3: "Room to spread out, and few to trade with or fear.",
  4: "Room to grow, and neighbours to meet.",
  5: "A busy world.",
  6: "Neighbours on every side.",
  7: "A crowded world: rivals close from the start.",
};
/** The order the colour slots go to the towns of the count's pictures: no two alike. */
const TOWN_SLOTS = [0, 3, 2, 1, 7, 4, 5];

/** The cards for a setup question (`setupCards` gives the choices), or null when it is asked as a plain menu. */
export function setupQuestionCards(step: string, choices: { counts: number[]; civs: string[] }): SetupCards | null {
  switch (step) {
    case "difficulty":
      return {
        title: "Choose your difficulty level",
        columns: DIFFICULTY_RULES.length,
        cards: DIFFICULTY_RULES.map((d, i) => {
          const pct = Math.round((d.techCost / DIFFICULTY_RULES[2]!.techCost) * 100);
          return {
            label: d.name,
            note: LEVEL_NOTES[i]!,
            art: { kind: "picture", id: `seat${i}`, ground: "grass", slot: 8 },
            heading: d.name,
            right: LEVEL_NOTES[i]!,
            lines: [
              LEVEL_WORDS[i]!,
              `{heart} ${d.content} content citizens in every city`,
              `{coin} ${d.gold} gold and {people} ${d.settlers} settler${d.settlers > 1 ? "s" : ""} to begin`,
              pct === 100 ? "{bulb} Advances at the usual cost" : `{bulb} Advances at ${pct}% of the usual cost`,
            ],
          };
        }),
      };
    case "opponents":
      return {
        title: "How many civilizations?",
        columns: choices.counts.length,
        cards: choices.counts.map((n) => ({
          label: `${n}`,
          note: "civilizations",
          art: { kind: "towns", slots: TOWN_SLOTS.slice(0, n) },
          heading: `${n} civilizations`,
          lines: [`You and ${n - 1} rivals.`, COUNT_WORDS[n] ?? ""],
        })),
      };
    case "civ":
      return {
        title: "Choose your tribe",
        columns: Math.min(5, choices.civs.length),
        cards: choices.civs.map((id) => tribeCard(civ(id))),
      };
    default:
      return null;
  }
}

function tribeCard(c: CivRule): SetupCard {
  const t = c.trait;
  const e = EMBLEMS[c.id] ?? { id: "palace", ground: "grass" as const };
  const slot = colorSlot(c.color);
  return {
    label: c.name,
    art: { kind: "picture", id: e.id, ground: e.ground, slot },
    band: slot,
    heading: c.name,
    right: `led by ${c.leader}`,
    lines: t
      ? [`{star} ${t.name}`, t.text, `{bulb} Begins knowing ${advance(t.start).name}  {city} Capital ${c.cities[0] ?? ""}`]
      : [],
  };
}

// ---- pictures --------------------------------------------------------------------------

/** Each tribe's emblem: a landmark of its own (some are the city view's wonders) and the ground it stands on. */
export const EMBLEMS: Record<string, { id: string; ground: SetupGround }> = {
  romans: { id: "arch", ground: "grass" },
  babylonians: { id: "ziggurat", ground: "sand" },
  egyptians: { id: "pyramids", ground: "sand" },
  greeks: { id: "parthenon", ground: "grass" },
  chinese: { id: "pagoda", ground: "grass" },
  indians: { id: "stupa", ground: "grass" },
  aztecs: { id: "step_pyramid", ground: "grass" },
  zulus: { id: "shield", ground: "grass" },
  germans: { id: "gate", ground: "grass" },
  americans: { id: "capitol", ground: "grass" },
  russians: { id: "onion_domes", ground: "grass" },
  french: { id: "cathedral", ground: "grass" },
  english: { id: "clock_tower", ground: "grass" },
  mongols: { id: "yurt", ground: "grass" },
  spanish: { id: "galleon", ground: "water" },
  vikings: { id: "longship", ground: "water" },
  hittites: { id: "lion_gate", ground: "sand" },
  persians: { id: "persepolis", ground: "sand" },
  hebrews: { id: "menorah", ground: "sand" },
  japanese: { id: "torii", ground: "grass" },
};

/** An onion dome on `base`, `r` wide each side of `cx`, rising to a point. */
function onion(cx: number, base: number, r: number, m: Part["m"]): Part[] {
  return [
    poly(m, cx - r + 1, base, cx - r - 1, base - r * 0.9, cx - r * 0.5, base - r * 1.8, cx, base - r * 2.5, cx + r * 0.5, base - r * 1.8, cx + r + 1, base - r * 0.9, cx + r - 1, base),
    line(cx, base - r * 2.5 - 2, cx, base - r * 2.5, "gold"),
  ];
}

/** A pagoda's roof over the line `y`, `hw` each side of `cx`, its eaves turned up. */
function eaves(cx: number, y: number, hw: number, m: Part["m"]): Part {
  return poly(m, cx - hw - 3, y - 3, cx - hw, y, cx + hw, y, cx + hw + 3, y - 3, cx + hw - 3, y - 5, cx - hw + 3, y - 5);
}

/** A lower half-ellipse from (cx - dx, top) down to `bottom` and up to (cx + dx, top): a menorah's arm. */
function arm(cx: number, top: number, dx: number, bottom: number): Part[] {
  const out: Part[] = [];
  const n = 6;
  for (let i = 0; i < n; i++) {
    const a = (Math.PI * i) / n, b = (Math.PI * (i + 1)) / n;
    out.push(line(cx - dx * Math.cos(a), top + (bottom - top) * Math.sin(a), cx - dx * Math.cos(b), top + (bottom - top) * Math.sin(b), "gold", 2));
  }
  return out;
}

/** Pictures drawn for the setup alone: the five seats of power, then the emblems the city view lacks. */
const SETUP_PICTURES: Record<string, Picture> = {
  // Chieftain: a thatched round hut, a fire before it, a pole with a pennant.
  seat0: pic(44, 40,
    flag(36, 6, 34),
    box(8, 27, 26, 13, "sandstone"),
    poly("thatch", 3, 28, 21, 9, 39, 28),
    poly("thatch", 6, 30, 3, 28, 39, 28, 36, 30),
    door(21, 40, 6, 9),
    disc(40, 39, 1.5, "stone"), poly("light", 38, 39, 40, 33, 42, 39)),
  // Warlord: a palisade of pointed logs, a gate, a watchtower.
  seat1: pic(46, 40,
    flag(37, 0, 6),
    ...Array.from({ length: 10 }, (_, i) => poly("wood", i * 4 + 1, 40, i * 4 + 1, 26, i * 4 + 3, 23, i * 4 + 5, 26, i * 4 + 5, 40)),
    box(32, 13, 11, 27, "wood", -1), slope(30, 6, 15, 7, 2, "thatch"), box(35, 16, 5, 3, "dark"),
    door(18, 40, 8, 11)),
  // Prince: a stone keep with battlements behind a low wall.
  seat2: pic(46, 42,
    flag(23, 0, 8),
    box(12, 12, 22, 30, "stone"),
    ...Array.from({ length: 6 }, (_, i) => box(12 + i * 4, 9, 2, 3, "stone")),
    windows(12, 15, 22, 12, 3, 2, "dark", 1, 3),
    box(0, 31, 46, 11, "stone", -1),
    ...Array.from({ length: 12 }, (_, i) => box(i * 4, 29, 2, 2, "stone", -1)),
    door(23, 42, 6, 9)),
  // King: a castle, round towers with pointed roofs at the corners of its wall, the keep behind.
  seat3: pic(48, 44,
    flag(24, 0, 7),
    box(15, 12, 18, 20, "stone"), ...Array.from({ length: 5 }, (_, i) => box(15 + i * 4, 9, 2, 3, "stone")),
    windows(15, 15, 18, 6, 3, 1, "dark", 1, 3),
    box(5, 26, 38, 18, "stone", -1), ...Array.from({ length: 10 }, (_, i) => box(5 + i * 4, 24, 2, 2, "stone", -1)),
    box(0, 18, 10, 26, "stone"), gable(-1, 10, 12, 8, "roof"), flag(5, 3, 7),
    box(38, 18, 10, 26, "stone"), gable(37, 10, 12, 8, "roof"), flag(43, 3, 7),
    box(3, 24, 2, 3, "dark"), box(43, 24, 2, 3, "dark"),
    door(24, 44, 8, 11)),
  // Emperor: a palace of marble, colonnade and pediment, a golden dome, wings either side.
  seat4: pic(48, 44,
    flag(2, 12, 12), flag(45, 12, 12),
    box(0, 24, 48, 20, "marble"), slope(-1, 21, 50, 3, 1, "roof"),
    windows(1, 27, 10, 14, 2, 2, "glass", 2, 3), windows(37, 27, 10, 14, 2, 2, "glass", 2, 3),
    box(13, 16, 22, 28, "marble", 1),
    box(17, 11, 14, 6, "marble"), windows(17, 12, 14, 4, 4, 1, "dark", 1, 2),
    dome(24, 11, 8, 8, "gold"), box(23, 1, 2, 3, "gold"),
    gable(12, 18, 24, 6, "marble"),
    box(14, 24, 20, 2, "marble"), cols(15, 26, 18, 18, 5, "white"),
    door(24, 44, 4, 8)),

  // Rome: a triumphal arch, its columns, the attic over the great arch, a statue on top.
  arch: pic(40, 32,
    box(18, 0, 4, 2, "copper"),
    box(4, 2, 32, 6, "marble", 1), box(9, 4, 22, 2, "gold"),
    box(2, 8, 36, 24, "marble"), box(1, 8, 38, 2, "marble", -1),
    box(14, 18, 12, 14, "dark"), dome(20, 18, 6, 6, "dark"),
    box(5, 24, 6, 8, "dark"), dome(8, 24, 3, 3, "dark"), box(29, 24, 6, 8, "dark"), dome(32, 24, 3, 3, "dark"),
    ...[2, 11, 27, 36].map((x) => box(x, 10, 2, 22, "white"))),
  // Greece: a temple of the Parthenon's kind, columns all round, the pediment over them.
  parthenon: pic(40, 26,
    box(4, 9, 32, 12, "dark"), cols(4, 9, 32, 12, 8, "white"),
    box(0, 23, 40, 3, "marble", -1), box(2, 21, 36, 2, "marble"),
    box(2, 6, 36, 3, "marble", 1), gable(2, 0, 36, 6, "marble")),
  // China: a pagoda, red halls under green roofs turned up at the eaves, a golden spire.
  pagoda: pic(32, 36,
    line(16, 0, 16, 4, "gold"), disc(16, 3, 1, "gold"),
    box(6, 32, 20, 4, "stone"),
    box(9, 26, 14, 6, "roof"), door(16, 32, 4, 5),
    box(10, 17, 12, 4, "roof"), windows(10, 17, 12, 4, 3, 1, "dark", 1, 2),
    box(11, 9, 10, 3, "roof"),
    eaves(16, 26, 11, "green"), eaves(16, 17, 9, "green"), eaves(16, 9, 7, "green")),
  // Babylon: a ziggurat of three terraces, a shrine on top, the stair up its face.
  ziggurat: pic(40, 30,
    box(0, 21, 40, 9, "sandstone", -1), box(6, 13, 28, 8, "sandstone"), box(12, 7, 16, 6, "sandstone", 1),
    box(15, 2, 10, 5, "brick"), door(20, 7, 2, 3),
    poly("brick", 18, 7, 22, 7, 25, 30, 15, 30),
    line(6, 25, 34, 25, "brick"), line(12, 17, 28, 17, "brick")),
  // India: a stupa, its dome on a terrace, the parasols of its spire.
  stupa: pic(40, 30,
    box(1, 24, 38, 6, "sandstone"), box(0, 22, 40, 2, "stone"),
    dome(20, 22, 14, 12, "white"),
    box(16, 7, 8, 4, "sandstone"), line(20, 0, 20, 7, "wood"),
    box(15, 5, 10, 1, "gold"), box(16, 3, 8, 1, "gold"), box(17, 1, 6, 1, "gold")),
  // Mexico: a stepped pyramid, the twin shrines on its summit, red and blue.
  step_pyramid: pic(40, 32,
    box(0, 25, 40, 7, "stone", -1), box(5, 18, 30, 7, "stone"), box(10, 12, 20, 6, "stone", 1),
    poly("sandstone", 17, 12, 23, 12, 26, 32, 14, 32),
    box(11, 5, 8, 7, "roof"), box(21, 5, 8, 7, "deep"),
    box(10, 3, 10, 2, "white"), box(20, 3, 10, 2, "white"),
    box(14, 8, 2, 4, "dark"), box(24, 8, 2, 4, "dark")),
  // The Zulu: a tall cowhide shield over two crossed spears.
  shield: pic(32, 36,
    line(2, 35, 28, 4, "wood", 1), poly("steel", 26, 7, 30, 0, 29, 8),
    line(30, 35, 4, 4, "wood", 1), poly("steel", 6, 7, 2, 0, 3, 8),
    oval(16, 18, 9, 16, "white"),
    disc(12, 10, 3, "dark"), oval(19, 23, 3, 4, "dark"), disc(11, 27, 2, "dark"), disc(20, 9, 1.5, "dark"),
    box(15, 0, 2, 36, "wood"),
    ...Array.from({ length: 6 }, (_, i) => box(13, 6 + i * 4, 6, 1, "dark"))),
  // Germany: a city gate of columns, the chariot on its attic.
  gate: pic(44, 32,
    box(3, 14, 38, 18, "dark"),
    cols(3, 14, 38, 18, 6, "sandstone"),
    box(0, 22, 3, 10, "sandstone", -1), box(41, 22, 3, 10, "sandstone", -1),
    box(1, 9, 42, 5, "sandstone"), box(12, 5, 20, 4, "sandstone", 1),
    poly("copper", 15, 5, 16, 1, 18, 3, 20, 0, 22, 2, 24, 0, 26, 3, 28, 1, 29, 5)),
  // America: the Capitol, white wings, a portico and the great dome.
  capitol: pic(44, 34,
    box(0, 22, 44, 12, "white"), windows(1, 24, 12, 8, 3, 2, "dark"), windows(31, 24, 12, 8, 3, 2, "dark"),
    box(14, 18, 16, 16, "white", 1), gable(13, 14, 18, 4, "white"), cols(15, 19, 14, 15, 4, "marble"),
    box(16, 11, 12, 4, "white"), windows(16, 11, 12, 3, 4, 1, "dark"),
    dome(22, 11, 8, 7, "white"), box(21, 1, 2, 3, "white"), line(22, 0, 22, 1, "steel")),
  // Russia: a church crowned with onion domes, gold, green and blue.
  onion_domes: pic(44, 36,
    box(16, 13, 12, 12, "white"), box(6, 18, 8, 7, "white"), box(30, 18, 8, 7, "white"),
    ...onion(10, 18, 4, "green"), ...onion(34, 18, 4, "deep"), ...onion(22, 13, 5, "gold"),
    box(3, 25, 38, 11, "brick"), windows(5, 27, 34, 4, 6, 1, "dark", 1, 2), door(22, 36, 6, 8)),
  // England: the clock tower and the long hall beside it.
  clock_tower: pic(40, 36,
    box(14, 24, 26, 12, "sandstone", -1), windows(15, 26, 24, 8, 6, 2, "dark"),
    ...Array.from({ length: 6 }, (_, i) => box(15 + i * 4, 22, 2, 2, "sandstone", -1)),
    box(3, 14, 10, 22, "sandstone"), windows(3, 16, 10, 18, 2, 4, "dark"),
    box(2, 7, 12, 7, "sandstone", 1), disc(8, 10.5, 2.5, "white"), line(8, 10.5, 8, 9, "dark"), line(8, 10.5, 9.5, 10.5, "dark"),
    box(3, 5, 10, 2, "sandstone"), poly("slate", 2, 5, 8, -1, 14, 5)),
  // The Mongols: a felt tent with a red door, a horse-tail standard beside it.
  yurt: pic(40, 30,
    line(36, 2, 36, 30, "wood"), oval(36, 6, 2, 3.5, "dark"), poly("steel", 35, 2, 36, 0, 37, 2),
    box(5, 17, 28, 13, "white"), box(5, 17, 28, 2, "deep"), box(5, 25, 28, 1, "wood"),
    poly("white", 3, 18, 15, 8, 23, 8, 35, 18), box(15, 6, 8, 2, "wood"),
    box(16, 22, 6, 8, "roof"), box(18, 24, 2, 4, "gold")),
  // Spain: a galleon under sail, the red saltire on its mainsail.
  galleon: pic(44, 36,
    line(13, 4, 13, 27, "wood", 1), line(25, 0, 25, 27, "wood", 1), line(36, 8, 36, 24, "wood", 1),
    poly("white", 8, 6, 18, 6, 19, 13, 7, 13), poly("white", 7, 15, 19, 15, 18, 22, 8, 22),
    poly("white", 19, 3, 31, 3, 32, 11, 18, 11), poly("white", 18, 13, 32, 13, 31, 22, 19, 22),
    line(20, 14, 30, 21, "roof", 1), line(30, 14, 20, 21, "roof", 1),
    poly("white", 36, 9, 42, 21, 36, 21),
    poly("wood", 1, 25, 43, 25, 39, 33, 6, 33), box(33, 20, 10, 5, "wood", 1), box(1, 22, 6, 3, "wood", 1),
    windows(8, 27, 30, 3, 6, 1, "gold", 1, 1)),
  // The Vikings: a longship, striped sail, shields along its side, a dragon at the prow.
  longship: pic(44, 30,
    line(22, 1, 22, 22, "wood", 1),
    box(12, 3, 20, 13, "white"), box(14, 3, 3, 13, "roof"), box(20, 3, 3, 13, "roof"), box(26, 3, 3, 13, "roof"),
    poly("wood", 4, 21, 40, 21, 36, 28, 9, 28),
    poly("wood", 38, 22, 41, 13, 44, 10, 44, 13, 42, 15, 41, 22),
    poly("wood", 6, 22, 3, 14, 0, 12, 1, 16, 3, 22),
    ...Array.from({ length: 6 }, (_, i) => disc(11 + i * 5, 22, 1.8, i % 2 ? "gold" : "owner"))),
  // The Hittites: the lion gate, a corbelled arch in walls of great stones, towers either side.
  lion_gate: pic(40, 32,
    box(0, 10, 15, 22, "stone", -1), box(25, 10, 15, 22, "stone", -1),
    box(0, 4, 8, 28, "stone"), box(32, 4, 8, 28, "stone"),
    ...[0, 3, 6, 32, 35, 38].map((x) => box(x, 1, 2, 3, "stone")),
    box(8, 18, 7, 1, "dark"), box(25, 22, 7, 1, "dark"), line(10, 10, 10, 18, "dark"), line(29, 22, 29, 32, "dark"),
    box(12, 8, 16, 6, "stone", 1),
    poly("dark", 15, 32, 15, 20, 17, 14, 23, 14, 25, 20, 25, 32),
    oval(12.5, 19, 2.5, 3, "sandstone"), oval(27.5, 19, 2.5, 3, "sandstone"),
    box(12, 18, 1, 1, "dark"), box(27, 18, 1, 1, "dark")),
  // Persia: the columns of Persepolis on their terrace, some broken, the stair before them.
  persepolis: pic(44, 34,
    box(0, 27, 44, 7, "sandstone", -1), poly("sandstone", 16, 27, 28, 27, 31, 34, 13, 34),
    ...[[3, 6], [11, 6], [19, 14], [26, 6], [34, 6], [41, 18]].flatMap(([x, top]) => [
      box(x!, top!, 3, 27 - top!, "sandstone", 1),
      ...(top === 6 ? [box(x! - 1, 3, 5, 3, "sandstone")] : []),
    ]),
    box(1, 1, 15, 2, "sandstone", -1), box(24, 1, 15, 2, "sandstone", -1)),
  // The Hebrews: the seven-branched lampstand, lit.
  menorah: pic(36, 34,
    poly("gold", 12, 34, 24, 34, 21, 30, 15, 30), box(17, 7, 2, 23, "gold"),
    ...arm(18, 7, 5, 14), ...arm(18, 7, 10, 20), ...arm(18, 7, 15, 25),
    ...[3, 8, 13, 18, 23, 28, 33].flatMap((x) => [box(x - 2, 6, 4, 2, "gold"), poly("light", x - 1, 6, x, 1, x + 1, 6)])),
  // Japan: a torii gate, its dark lintel curving up at the ends.
  torii: pic(40, 32,
    poly("roof", 8, 32, 9, 7, 12, 7, 12, 32), poly("roof", 28, 32, 28, 7, 31, 7, 32, 32),
    box(4, 12, 32, 2, "roof"), box(19, 7, 2, 5, "roof"),
    box(2, 5, 36, 2, "roof"),
    poly("dark", 0, 1, 4, 3, 36, 3, 40, 1, 40, 4, 36, 5, 4, 5, 0, 4),
    box(6, 30, 8, 2, "stone"), box(26, 30, 8, 2, "stone")),
};

/** A setup picture by id: one of its own, or a building or wonder of the city view. */
export function setupPicture(id: string): Picture {
  return SETUP_PICTURES[id] ?? PICTURES[id] ?? PICTURES.palace!;
}

