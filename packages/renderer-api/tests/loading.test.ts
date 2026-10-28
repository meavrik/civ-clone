import { describe, expect, it } from "vitest";
import { loadingView } from "../src/index.js";

describe("the loading window", () => {
  it("makes the world first, then counts the turns replayed and names the year reached", () => {
    expect(loadingView("Romans, 1200 BC")).toEqual({ label: "Romans, 1200 BC", done: 0, line: "Making the world..." });
    expect(loadingView("Romans, 1200 BC", { turn: 0, from: 0, to: 100 })).toMatchObject({ done: 0, line: "Retracing history: 4000 BC" });
    expect(loadingView("Romans, 1200 BC", { turn: 25, from: 0, to: 100 }).done).toBe(0.25);
    expect(loadingView("Romans, 1200 BC", { turn: 100, from: 0, to: 100 }).done).toBe(1);
    // A save made on the turn the game began has nothing to replay but the world.
    expect(loadingView("Romans, 4000 BC", { turn: 0, from: 0, to: 0 }).done).toBe(1);
  });
});
