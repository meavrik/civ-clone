import { makeSave } from "@civ/core";
import { game } from "./civ.js";
import { lastAutosave, writeSlot } from "./storage.js";

/**
 * A phone closes apps put away without asking. The web game autosaves as each turn begins; here
 * the turn so far is saved too whenever the game leaves the screen, so Continue picks it up there.
 */
function saveTurnSoFar(): void {
  const g = game();
  const auto = lastAutosave();
  if (!g?.state || !auto || g.state.seed !== auto.seed || g.log.length === auto.log.length) return;
  void writeSlot(0, makeSave(g.state, auto.options, g.log)).catch(() => {});
}

addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") saveTurnSoFar();
});
addEventListener("pagehide", saveTurnSoFar);
