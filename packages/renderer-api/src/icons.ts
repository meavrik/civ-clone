import type { Tile, WorkKind } from "@civ/core";

/**
 * Small pictures the info panels use in place of words. Each renderer draws
 * every one of them in its own style (the retro one from its 8x8 icon sheet).
 */
export const ICONS = [
  "people", "calendar", "purse", "coin", "gem", "bulb", "crown", "hourglass",
  "food", "shield", "trade", "boot", "tower", "heart", "star", "house",
  "river", "road", "railroad", "irrigate", "mine", "fortress", "pollution", "clean", "hut", "city", "swords", "culture",
  "happy", "unhappy",
] as const;
export type IconName = (typeof ICONS)[number];

const ICON_SET = new Set<string>(ICONS);

/** The picture for each settler job, for its order key and the badge on a working unit. */
export const WORK_ICON: Record<WorkKind, IconName> = {
  irrigate: "irrigate", mine: "mine", road: "road", railroad: "railroad", fortress: "fortress", clean: "clean",
};

/** What a working unit is doing, in words. */
export const WORK_NAME: Record<WorkKind, string> = {
  irrigate: "irrigating", mine: "mining", road: "building a road", railroad: "laying a railroad", fortress: "building a fortress", clean: "cleaning up pollution",
};

export type IconSegment = { text: string } | { icon: IconName };

/** True if a line carries {icon} tokens. */
export function hasIcons(line: string): boolean {
  return /\{[a-z]+\}/.test(line) && iconSegments(line).some((s) => "icon" in s);
}

/** A line split into text and icons: "{food} 2" becomes an icon then " 2". Unknown tokens stay text. */
export function iconSegments(line: string): IconSegment[] {
  const out: IconSegment[] = [];
  let rest = line;
  for (let m = /\{([a-z]+)\}/.exec(rest); m; m = /\{([a-z]+)\}/.exec(rest)) {
    if (m.index > 0) out.push({ text: rest.slice(0, m.index) });
    if (ICON_SET.has(m[1]!)) out.push({ icon: m[1] as IconName });
    else out.push({ text: m[0] });
    rest = rest.slice(m.index + m[0].length);
  }
  if (rest) out.push({ text: rest });
  return out;
}

/**
 * Wrap an icon line to a width: groups separated by two spaces stay whole and
 * are packed greedily. `width` measures a piece of the line.
 */
export function wrapIconLine(line: string, maxWidth: number, width: (piece: string) => number): string[] {
  const groups = line.split("  ").filter((g) => g.length > 0);
  const lines: string[] = [];
  let cur = "";
  for (const g of groups) {
    const next = cur ? `${cur}  ${g}` : g;
    if (cur && width(next) > maxWidth) { lines.push(cur); cur = g; } else cur = next;
    // A group too wide on its own wraps by word, each icon kept with the word after it.
    if (width(cur) <= maxWidth) continue;
    const words = cur.split(" ").reduce<string[]>((ws, w) => {
      const last = ws[ws.length - 1];
      if (last !== undefined && /^\{[a-z_]+\}$/.test(last)) ws[ws.length - 1] = `${last} ${w}`;
      else ws.push(w);
      return ws;
    }, []);
    cur = "";
    for (const w of words) {
      const more = cur ? `${cur} ${w}` : w;
      if (cur && width(more) > maxWidth) { lines.push(cur); cur = w; } else cur = more;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

/** Pictures for what stands on a square besides its terrain: river, road or rail, irrigation, mine, fortress, smog, village. */
export function tileIcons(t: Tile): IconName[] {
  const out: IconName[] = [];
  if (t.river) out.push("river");
  if (t.railroad) out.push("railroad");
  else if (t.road) out.push("road");
  if (t.irrigation) out.push("irrigate");
  if (t.mine) out.push("mine");
  if (t.fortress) out.push("fortress");
  if (t.pollution) out.push("pollution");
  if (t.hut) out.push("hut");
  return out;
}
