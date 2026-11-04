import { describe, expect, it } from "vitest";
import {
  applyCommand,
  buildOptions,
  createUnit,
  defaultProduction,
  discover,
  foundCity,
  loadSave,
  makeSave,
  newGame,
  processCityTurn,
  Terrain,
  unitChoices,
  unitRetired,
  unitType,
  UNIT_TYPES,
  type City,
  type GameState,
} from "../src/index.js";

function world(): GameState {
  const s = newGame(1, { opponents: 1 });
  for (const t of s.map.tiles) {
    t.terrain = Terrain.Grassland;
    t.river = false; t.road = false; t.special = false; t.hut = false;
    delete t.deposit;
  }
  s.units = [];
  s.cities = [];
  return s;
}

/** Lay a deposit of `id` at (x, y), with a road on it unless `road` is false (a square serves only with one). */
function deposit(s: GameState, x: number, y: number, id: string, road = true): void {
  const t = s.map.tiles[y * s.map.width + x]!;
  t.special = true;
  t.deposit = id;
  t.road = road;
}

const ids = (s: GameState, c: City) => buildOptions(s, c).map((p) => p.id);

describe("units replaced by their successors (save version 65)", () => {
  it("name a later unit of the same domain, and no chain comes round", () => {
    for (const t of UNIT_TYPES) {
      if (!t.replacedBy) continue;
      expect(unitType(t.replacedBy).domain, t.id).toBe(t.domain);
      const seen = new Set([t.id]);
      for (let n = t.replacedBy; n; n = unitType(n).replacedBy ?? "") {
        expect(seen.has(n), t.id).toBe(false);
        seen.add(n);
      }
    }
    // What carries cargo gives way only to what carries more: the Ironclad carries nothing.
    for (const t of UNIT_TYPES) if (t.replacedBy && t.capacity) expect(unitType(t.replacedBy).capacity ?? 0, t.id).toBeGreaterThan(t.capacity);
  });

  it("keeps the Phalanx, Militia and Archers while Gunpowder has no Saltpeter, and takes them off the list once it has", () => {
    const s = world();
    const rome = foundCity(s, 0, 10, 10);
    s.players[0]!.advances.push("bronze_working", "archery", "gunpowder");
    expect(ids(s, rome)).toEqual(expect.arrayContaining(["militia", "phalanx", "archers"]));
    expect(ids(s, rome)).not.toContain("musketeers");
    expect(unitChoices(s, rome).find((c) => c.id === "musketeers")?.missing).toEqual(["Saltpeter"]);
    const saltpeter = s.map.tiles[11 * s.map.width + 11]!;
    // A square of it without a road serves no one yet.
    deposit(s, 11, 11, "Saltpeter", false);
    expect(ids(s, rome)).toContain("phalanx");
    saltpeter.road = true;
    expect(ids(s, rome)).toContain("musketeers");
    for (const old of ["militia", "phalanx", "archers"]) expect(ids(s, rome)).not.toContain(old);
    // Should the resource go, the old units come back.
    saltpeter.road = false;
    expect(ids(s, rome)).toEqual(expect.arrayContaining(["militia", "phalanx", "archers"]));
  });

  it("keeps the units in the field, and refuses to set a replaced one", () => {
    const s = world();
    const rome = foundCity(s, 0, 10, 10);
    s.players[0]!.advances.push("bronze_working", "gunpowder");
    deposit(s, 11, 11, "Saltpeter");
    const phalanx = createUnit(s, "phalanx", 0, 10, 10, rome.id);
    expect(applyCommand(s, { type: "setProduction", city: rome.id, production: { kind: "unit", id: "phalanx" } }).ok).toBe(false);
    processCityTurn(s, rome);
    expect(s.units).toContain(phalanx);
  });

  it("lets Knights replace Chariots and Cavalry only with both their Horses and Iron", () => {
    const s = world();
    const rome = foundCity(s, 0, 10, 10);
    s.players[0]!.advances.push("the_wheel", "horseback_riding", "chivalry");
    deposit(s, 11, 11, "Horses");
    expect(ids(s, rome)).toEqual(expect.arrayContaining(["chariot", "cavalry"]));
    expect(ids(s, rome)).not.toContain("knights");
    deposit(s, 9, 11, "Iron");
    expect(ids(s, rome)).toContain("knights");
    expect(ids(s, rome)).not.toContain("chariot");
    expect(ids(s, rome)).not.toContain("cavalry");
  });

  it("goes by the advance alone where the successor needs no resource", () => {
    const s = world();
    expect(unitRetired(s, 0, "trireme")).toBe(false);
    s.players[0]!.advances.push("navigation");
    expect(unitRetired(s, 0, "trireme")).toBe(true);
    expect(unitRetired(s, 0, "sail")).toBe(false);
    s.players[0]!.advances.push("magnetism");
    expect(unitRetired(s, 0, "sail")).toBe(true);
    expect(unitRetired(s, 0, "frigate")).toBe(false);
  });

  it("carries on down a chain: guns replace the Catapult, and Artillery the Cannon", () => {
    const s = world();
    const rome = foundCity(s, 0, 10, 10);
    s.players[0]!.advances.push("mathematics", "metallurgy", "robotics");
    expect(ids(s, rome)).toContain("catapult");
    deposit(s, 11, 11, "Iron");
    deposit(s, 9, 11, "Saltpeter");
    expect(ids(s, rome)).toContain("artillery");
    expect(ids(s, rome)).not.toContain("cannon");
    expect(ids(s, rome)).not.toContain("catapult");
  });

  it("stops a city building a replaced unit as the resource comes: a human player's asks, a computer player's turns to the new one", () => {
    const s = world();
    const rome = foundCity(s, 0, 10, 10);
    s.players[0]!.advances.push("bronze_working", "gunpowder");
    const set = () => { delete rome.choosing; rome.production = { kind: "unit", id: "phalanx" }; };
    set();
    processCityTurn(s, rome);
    expect(rome.choosing).toBeUndefined();
    deposit(s, 11, 11, "Saltpeter");
    set();
    processCityTurn(s, rome);
    expect(rome.choosing).toBe(true);
    s.players[0]!.isAi = true;
    set();
    processCityTurn(s, rome);
    expect(rome.choosing).toBeUndefined();
    expect(rome.production).toEqual({ kind: "unit", id: "musketeers" });
    expect(defaultProduction(s, rome)).toEqual({ kind: "unit", id: "musketeers" });
  });

  it("retires what an advance found replaces at once, where the resource is already held", () => {
    const s = world();
    const rome = foundCity(s, 0, 10, 10);
    s.players[0]!.advances.push("bronze_working", "invention", "iron_working");
    deposit(s, 11, 11, "Saltpeter");
    rome.production = { kind: "unit", id: "phalanx" };
    discover(s, 0, "gunpowder");
    expect(rome.choosing).toBe(true);
  });

  it("left every unit on offer in saves before version 65, but Militia and Archers at Gunpowder", () => {
    const opts = { opponents: 1 as const };
    const loaded = loadSave({ ...makeSave(newGame(3, opts), opts, []), version: 64 as const }, () => {}).state;
    expect(loaded.noReplacements).toBe(true);
    expect(loadSave(makeSave(newGame(3, opts), opts, []), () => {}).state.noReplacements).toBeUndefined();

    const s = world();
    s.noReplacements = true;
    const rome = foundCity(s, 0, 10, 10);
    s.players[0]!.advances.push("bronze_working", "archery", "gunpowder", "navigation");
    deposit(s, 11, 11, "Saltpeter");
    expect(ids(s, rome)).toEqual(expect.arrayContaining(["phalanx", "musketeers"]));
    expect(unitRetired(s, 0, "trireme")).toBe(false);
    expect(ids(s, rome)).not.toContain("militia");
    expect(ids(s, rome)).not.toContain("archers");
  });
});
