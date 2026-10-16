import type { SaveGame } from "@civ/core";

/** Save slots in IndexedDB. Slot 0 is the autosave. */
const DB = "epochs";
const STORE = "saves";
export const SLOTS = 6;

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function writeSlot(slot: number, save: SaveGame): Promise<void> {
  const db = await open();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(save, slot);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function readSlot(slot: number): Promise<SaveGame | undefined> {
  const db = await open();
  const out = await new Promise<SaveGame | undefined>((resolve, reject) => {
    const req = db.transaction(STORE).objectStore(STORE).get(slot);
    req.onsuccess = () => resolve(req.result as SaveGame | undefined);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return out;
}

export async function listSlots(): Promise<(SaveGame | undefined)[]> {
  const out: (SaveGame | undefined)[] = [];
  for (let i = 0; i < SLOTS; i++) out.push(await readSlot(i).catch(() => undefined));
  return out;
}
