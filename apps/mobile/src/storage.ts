import type { SaveGame } from "@civ/core";
import type * as WebStorage from "../../web/src/storage.js";
import * as web from "../../web/src/storage.js";

/**
 * Stands in for apps/web/src/storage.ts (vite.config.ts swaps it in): the same save slots, with
 * the game's last autosave kept at hand so the game can be saved again when the phone puts it
 * away (save.ts).
 */
export const SLOTS = web.SLOTS;
export const readSlot = web.readSlot;
export const listSlots = web.listSlots;

let autosaved: SaveGame | undefined;

export function writeSlot(slot: number, save: SaveGame): Promise<void> {
  if (slot === 0) autosaved = save;
  return web.writeSlot(slot, save);
}

/** The game in the autosave slot as last written: its options belong to the game in play. */
export function lastAutosave(): SaveGame | undefined {
  return autosaved;
}

({ SLOTS, readSlot, listSlots, writeSlot }) satisfies typeof WebStorage;
