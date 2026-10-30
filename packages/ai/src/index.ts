export { baselineTurn } from "./baseline.js";
export { barbarianTurn } from "./barbarian.js";
export { acceptsPeace, allianceAnswer, alliancePrice, allianceRefusal, attitude, bordersAnswer, bordersPrice, pactAnswer, withdrawAnswer, CITY_SPACING, describePlan, peaceAnswer, peacePrice, plannerTurn, playTurn, pickResearch, PRICES, resourceAsk, resourceOffers, resourcePrice, roomForCity, siteScore, spareResources, stayPrice, tradeAsk, tributeOffer, wantsResource, type Attitude } from "./planner.js";
export { courtPlayers, ENVOYS } from "./envoys.js";
export { plannerV2Turn } from "./planner-v2.js";
import { plannerTurn } from "./planner.js";
import type { GameState } from "@civ/core";

/**
 * The opponent the game ships with: the planner (AI v2). Every variant has
 * this signature so the browser, replays and the tournament harness can
 * swap them; `baselineTurn` stays available as the yardstick.
 */
export function aiTurn(state: GameState): void {
  plannerTurn(state);
}
