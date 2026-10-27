import { mkdirSync, writeFileSync } from "node:fs";
import { applyCommand, newGame, type GameState } from "@civ/core";
import { conquestCard, CONQUEST_FACTS, type ConquestEvent, type ConquestView, type MainScreenView } from "@civ/renderer-api";
import { describe, expect, it } from "vitest";
import { conquestHit, conquestPlace, drawConquest, drawMainScreen, tileToScreen, TILE, VIEW_X, VIEW_Y } from "../src/index.js";
import { Surface } from "../src/surface.js";
import { encodePng } from "./png.js";

const out = (name: string) => new URL(`./out/${name}.png`, import.meta.url);

/** A game with one city, ours, and the map as the web app leaves it for the news: the city two squares below the middle. */
function withCity(): { state: GameState; map: MainScreenView } {
  const state = newGame(5, { opponents: 2 });
  applyCommand(state, { type: "found", unit: state.units[0]!.id });
  const c = state.cities[0]!;
  c.size = 4;
  const map: MainScreenView = { originX: c.x - 7, originY: Math.max(0, c.y - 8), blink: false, placeNames: false };
  return { state, map };
}

/** The city taken: by us from the second civilization (`won`), or from us by it; razed when `razed`. */
function taken(state: GameState, won: boolean, razed = false): ConquestEvent {
  const c = state.cities[0]!;
  const [player, by] = won ? [1, 0] : [0, 1];
  c.owner = by;
  if (razed) state.cities = state.cities.filter((o) => o !== c);
  const base = { name: c.name, player, by, x: c.x, y: c.y, plunder: 45, capital: true };
  return razed ? { kind: "cityLost", ...base } : { kind: "cityCaptured", cityId: c.id, ...base };
}

describe("a city taken", () => {
  it("is a triumph for the side that took it, with View City on a city it holds, and a loss for the side that lost it", () => {
    const { state } = withCity();
    const babylon = state.players[1]!;
    const won = conquestCard(state, { event: taken(state, true), viewer: 0, selected: 1 });
    expect(won).toMatchObject({ won: true, title: "City Conquered", where: `Taken from the ${babylon.name}`, buttons: ["View City", "Continue"] });
    expect(won.cheer).toBe(`${won.name} is ours!`);
    expect(won.facts.map((f) => f.icon)).toEqual(["crown", "coin", "people"]);
    expect(won.facts[1]!.text).toBe("45 gold plundered");
    expect(won.facts[2]!.text).toBe("4 citizens join our people");

    const { state: s2 } = withCity();
    s2.cities[0]!.wonders = ["pyramids"];
    const lost = conquestCard(s2, { event: taken(s2, false), viewer: 0, selected: 1 });
    expect(lost).toMatchObject({ won: false, title: "City Lost", where: `Taken by the ${s2.players[1]!.name}`, buttons: [], cheer: "" });
    expect(lost.facts).toHaveLength(CONQUEST_FACTS);
    expect(lost.facts.map((f) => f.text)).toEqual(["Our capital has fallen!", "Wonder lost: Pyramids", "45 gold carried off"]);
    expect(lost.words.length).toBeGreaterThan(0);
    // The same city always mourns in the same words.
    expect(conquestCard(s2, { event: taken(s2, false), viewer: 0, selected: 1 }).words).toBe(lost.words);

    const { state: s3 } = withCity();
    const razed = conquestCard(s3, { event: taken(s3, false, true), viewer: 0, selected: 1 });
    expect(razed).toMatchObject({ title: "City Destroyed", where: `Razed by the ${s3.players[1]!.name}`, buttons: [] });
    expect(razed.facts.at(-1)!.text).toBe("Its people are lost to us");

    const { state: s4 } = withCity();
    const ours = conquestCard(s4, { event: taken(s4, true, true), viewer: 0, selected: 1 });
    expect(ours).toMatchObject({ won: true, title: "City Razed", buttons: [] });
    expect(ours.cheer).toBe(`${ours.name} is razed!`);

    // Barbarians: a city won back is freed; one they take is seized.
    const { state: s5 } = withCity();
    const ev = taken(s5, true);
    const freed = conquestCard(s5, { event: { ...ev, player: s5.barbarians }, viewer: 0, selected: 1 });
    expect(freed.where).toBe("Freed from the Barbarians");
    expect(freed.facts[0]!.icon).not.toBe("crown");
    const { state: s6 } = withCity();
    expect(conquestCard(s6, { event: { ...taken(s6, false), by: s6.barbarians }, viewer: 0, selected: 1 }).where).toBe("Seized by the Barbarians");
  });

  it("stands above the city on the map, pointing at it, in triumph or in mourning", () => {
    mkdirSync(new URL("./out/", import.meta.url), { recursive: true });
    for (const [name, won, razed] of [["conquest-won", true, false], ["conquest-lost", false, false], ["conquest-razed", false, true], ["conquest-won-razed", true, true]] as const) {
      const { state, map } = withCity();
      const event = taken(state, won, razed);
      const s = Surface.screen();
      drawMainScreen(s, state, map);
      const [x, y] = tileToScreen(state, map, event.x, event.y)!;
      const square = { x, y, w: TILE, h: TILE };
      const view: ConquestView = { event, viewer: 0, selected: 1, square };
      drawConquest(s, state, view);
      writeFileSync(out(name), encodePng(s, 3));
      const place = conquestPlace(state, view);
      expect(place.side, name).toBe("above");
      expect(place.win.y, name).toBeGreaterThan(VIEW_Y);
      const o = place.win;
      expect(conquestHit(state, view, o.x + o.w - 10, o.y + 9), name).toBe("close");
      if (won && !razed) {
        expect(conquestHit(state, view, o.x + 30, o.y + o.h - 10)).toBe("city");
        expect(conquestHit(state, view, o.x + o.w - 30, o.y + o.h - 10)).toBe("continue");
        expect(conquestHit(state, view, x + 8, y + 8)).toBe("city");
      } else {
        // Nothing to choose: no buttons, and the city is no button either.
        expect(conquestHit(state, view, o.x + 30, o.y + o.h - 6), name).toBeNull();
        expect(conquestHit(state, view, x + 8, y + 8), name).toBeNull();
      }
    }
  });

  it("bursts in fireworks over the city taken, the same picture for the same moment, the cheer over them", () => {
    const { state, map } = withCity();
    const c = state.cities[0]!;
    const plain = Surface.screen();
    drawMainScreen(plain, state, map);
    const frames: Surface[] = [];
    for (const t of [0.05, 0.2, 0.45, 0.8]) {
      const s = Surface.screen();
      drawMainScreen(s, state, { ...map, fireworks: { x: c.x, y: c.y, t, owner: 0, cheer: `${c.name} is ours!` } });
      writeFileSync(out(`fireworks-${Math.round(t * 100)}`), encodePng(s, 3));
      frames.push(s);
      const again = Surface.screen();
      drawMainScreen(again, state, { ...map, fireworks: { x: c.x, y: c.y, t, owner: 0, cheer: `${c.name} is ours!` } });
      expect(again.data).toEqual(s.data);
      // Something burst over the map, and nothing touched the panel or the menu bar.
      let changed = 0;
      for (let fy = 0; fy < s.fh; fy++)
        for (let fx = 0; fx < s.fw; fx++) {
          if (s.fget(fx, fy) === plain.fget(fx, fy)) continue;
          changed++;
          expect(fx >= VIEW_X * s.k && fy >= VIEW_Y * s.k).toBe(true);
        }
      expect(changed, `t ${t}`).toBeGreaterThan(t < 0.1 ? 4 : 20);
    }
    // The show moves on.
    expect(frames[1]!.data).not.toEqual(frames[2]!.data);
  });
});
