import type { SaveGame } from "@civ/core";
export declare const SLOTS = 6;
export declare function writeSlot(slot: number, save: SaveGame): Promise<void>;
export declare function readSlot(slot: number): Promise<SaveGame | undefined>;
export declare function listSlots(): Promise<(SaveGame | undefined)[]>;
