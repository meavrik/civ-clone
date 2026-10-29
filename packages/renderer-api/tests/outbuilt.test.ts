import { describe, expect, it } from "vitest";
import { foundCity, newGame } from "@civ/core";
import { wonderLostNotice, wondersLost } from "../src/index.js";

describe("a wonder finished first in another city", () => {
  it("finds our cities still building it, and says who finished it, where, and what the city keeps", () => {
    const s = newGame(2026, { opponents: 1 });
    s.cities = [];
    const rome = foundCity(s, 0, 10, 10, "Rome");
    const antium = foundCity(s, 0, 16, 10, "Antium");
    const babylon = foundCity(s, 1, 30, 10, "Babylon");
    rome.production = { kind: "wonder", id: "pyramids" };
    rome.shields = 84;
    antium.production = { kind: "wonder", id: "colossus" };
    babylon.production = { kind: "wonder", id: "pyramids" };
    expect(wondersLost(s, 0)).toEqual([]);
    babylon.wonders.push("pyramids");
    // Babylon's own wonder is theirs to finish; Antium's Colossus still stands to be built.
    expect(wondersLost(s, 0)).toEqual([{ city: rome.id, wonder: "pyramids" }]);
    expect(wonderLostNotice(s, { city: rome.id, wonder: "pyramids" }, 0)).toEqual({
      title: "Wonder Built Elsewhere",
      lines: [`{star} Pyramids was completed in Babylon by the ${s.players[1]!.name}.`, "{shield} Rome keeps its 84 shields: build what next?"],
    });
    // One of our own cities finishing it first, and a city with an empty box.
    antium.wonders.push("colossus");
    rome.production = { kind: "wonder", id: "colossus" };
    rome.shields = 0;
    expect(wonderLostNotice(s, { city: rome.id, wonder: "colossus" }, 0)!.lines).toEqual(["{star} Colossus was completed in Antium.", "{shield} Rome must build something else."]);
  });
});
