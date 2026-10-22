import { advance, civ, colorSlot, DIFFICULTY_RULES, type CivRule } from "@civ/core";

/**
 * The setup questions shown as cards with portraits (asked for 2026-10-22: a picture for every choice,
 * as the original showed its rulers, and the tribes as more than a long list): difficulty as the
 * ruler of each level, the tribes as their leaders. The number of civilizations stays a plain list.
 * The cards are in the order of `setupMenu`'s items, so `setupChoose` takes a card's index.
 */

export interface SetupCard {
  label: string;
  /** A word under the label ("Easiest"). */
  note?: string;
  /** The portrait (a name in the renderers' portrait art: the levels' rulers, the leaders). */
  portrait: string;
  /** A tribe's colour slot, along the top of its card and round its portrait. */
  band?: number;
  /** The panel for the selected card: its title, a word at the title's right, a name under the
   * portrait, a line picked out, then lines (which may carry `{icon}` tokens). */
  heading: string;
  right?: string;
  subtitle?: string;
  lead?: string;
  lines: string[];
}

export interface SetupCards {
  title: string;
  /** Cards side by side in one row (difficulty), or a grid of small ones beside the panel (tribes). */
  grid: boolean;
  /** Cards to a row, for moving up and down with the keys. */
  columns: number;
  cards: SetupCard[];
}

const LEVEL_PORTRAITS = ["chieftain", "warlord", "prince", "king", "emperor"];
const LEVEL_NOTES = ["Easiest", "Easy", "Moderate", "Hard", "Hardest"];
const LEVEL_WORDS = [
  "For a first game: patient people, help to begin.",
  "A gentle challenge.",
  "A fair contest.",
  "For seasoned rulers.",
  "The hardest test: restless cities from the start.",
];

/** The tribes' grid is this many cards across. */
export const TRIBE_COLUMNS = 4;

/** Each tribe's leader as the portrait art names them. */
export const LEADER_PORTRAITS: Record<string, string> = {
  romans: "caesar", babylonians: "hammurabi", egyptians: "ramesses", greeks: "alexander", chinese: "qin_shi_huang",
  indians: "ashoka", aztecs: "montezuma", zulus: "shaka", germans: "otto", americans: "washington",
  russians: "peter", french: "charlemagne", english: "elizabeth", mongols: "genghis_khan", spanish: "isabella",
  vikings: "harald", hittites: "suppiluliuma", persians: "cyrus", hebrews: "david", japanese: "tokugawa",
};

/** The cards for a setup question (`setupCards` gives the tribes on offer), or null when it is asked as a plain menu. */
export function setupQuestionCards(step: string, civs: string[]): SetupCards | null {
  switch (step) {
    case "difficulty":
      return {
        title: "Choose your difficulty level",
        grid: false,
        columns: DIFFICULTY_RULES.length,
        cards: DIFFICULTY_RULES.map((d, i) => {
          const pct = Math.round((d.techCost / DIFFICULTY_RULES[2]!.techCost) * 100);
          return {
            label: d.name,
            note: LEVEL_NOTES[i]!,
            portrait: LEVEL_PORTRAITS[i]!,
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
    case "civ":
      return { title: "Choose your tribe", grid: true, columns: Math.min(TRIBE_COLUMNS, civs.length), cards: civs.map((id) => tribeCard(civ(id))) };
    default:
      return null;
  }
}

function tribeCard(c: CivRule): SetupCard {
  const t = c.trait;
  return {
    label: c.name,
    portrait: LEADER_PORTRAITS[c.id] ?? "king",
    band: colorSlot(c.color),
    heading: c.name,
    subtitle: c.leader,
    ...(t ? { lead: t.name } : {}),
    lines: [...(t ? [t.text, `Knows ${advance(t.start).name}.`] : []), `Capital: ${c.cities[0] ?? ""}.`],
  };
}
