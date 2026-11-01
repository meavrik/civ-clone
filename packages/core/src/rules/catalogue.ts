/**
 * Rules added after a game began are left out of it: a unit, improvement, advance or resource carries `since`, the
 * save version that brought it, and a game of an older version (`GameState.catalogue`, set when its save loads) plays
 * without it, so its log replays as it was played. Unset: everything.
 */
export function inCatalogue(state: { catalogue?: number | undefined }, rule: { since?: number | undefined }): boolean {
  return rule.since === undefined || state.catalogue === undefined || rule.since <= state.catalogue;
}
