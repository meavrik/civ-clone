# Ai

The AI opponents: planner, envoys, city spacing. Moved word for word from CLAUDE.md, so "above" and "below" may point to another file here: search `docs/` for the name.

- `packages/ai` — opponents, speaking only `Command`s: `planner.ts` (AI v3, shipped as `aiTurn`),
  `planner-v2.ts` (frozen copy of v2, the head-to-head yardstick: do not tune it), `baseline.ts`
  (v1) and `barbarian.ts` (the barbarians, reached through `baselineTurn` so every AI seat shares it:
  boats land raiders beside the nearest city, soldiers storm cities at long odds, loot farms and mines
  on the way and keep their best defender home, the leader keeps to its band and slips away alone).
  The planner treats a barbarian-held city on its continent as a war to win back. Borders
  (`guardBorders`): a human civ's units on its land, once noted a turn before, are asked off, warned once
  more a turn later, then war (`reason: "trespass"`) unless the planner is under 0.6x the
  intruder's strength (then it complains every 5 turns); computer civs do not mind each other. The
  player's audience asks pure functions of the state: `attitude` (hostile at war or after a last
  warning; else a grievance (a demand made, not units merely noted), pride (1.5x the strength) and scorn for
  the player's influence each count one against, admiration and the player's recent gifts (`goodwill`) one
  for: none on balance friendly, one wary, two hostile), `peaceAnswer` (a treaty after meeting) and
  `bordersAnswer` (wary: for gold), their prices (`PRICES`, shares of the leader's `goldScale`: `peacePrice`
  0.6 and `bordersPrice` 0.4, moved by half the strength ratio within 0.75x-2x, the stronger side asking more for
  peace and the weaker more for borders, admiration 0.75x, scorn 1.5x; `stayPrice` to look away from our units,
  0.3 and half again a unit more and after a last warning; `resourcePrice` 0.5; in tens), `acceptsPeace` (at
  war: the fighting decides), `tributeOffer` (only far weaker civs, once in 20 turns: a quarter of the treasury
  at half our strength, rising to half at a fifth), what a leader asks of the player or gives them
  (`envoys.ts`, `courtPlayers` after `guardBorders`, `ENVOYS`; human players only, at most one word a turn at
  their court from anyone, peace envoys included): tribute, from a leader not friendly with an army of 8 or more
  at three times the player's strength, when the player holds 30 gold, every 20 turns at most, 10% a turn (a
  quarter of the treasury, up to half at six times the strength); a resource it wants and lacks that the player
  can spare, not while hostile, for one of its spares the player lacks or `resourcePrice` gold, every 15 turns at
  most, 10% a turn; a gift from a friendly leader holding 150 gold and 10 a city, a tenth of it, every 20 turns at
  most, 4% a turn. A refused tribute counts against the refuser in `attitude` for 20 turns, and the asker, still
  three times the stronger, declares war at its turn that round half the time (`reason: "tribute"`).
  `tradeAsk`. Toward a human civ only (computer pairs play as before, so v3-v2 runs are unchanged): the
  planner's envoy offers a treaty to a player it is friendly with (10% a turn, one envoy a turn per player,
  20 turns apart per pair), offers peace to end a war it wants over instead of making it, spares a player
  whose influence it admires from wars of choice, needs 3x the strength to break a treaty, and is twice
  as quick to attack a player it is hostile to. The planner is
  stateless between turns: it re-derives the empire picture (`analyse`) from `GameState` every turn
  (units' goto orders are its only memory, and they are game state), so replays stay exact.
  `describePlan` exposes its view (sites, colony plan, campaign) for tests.
  City spacing (asked for 2026-10-22: AI cities went down two or three squares apart): a new city keeps
  `CITY_SPACING` (4 squares from its own cities, 5 from anyone else's; `roomForCity`) at every founding
  (listed sites, a settler standing on a fit square, a first city, colonists put ashore), and two settlers
  never aim within 4 of each other. The rules allow three squares, two between (`CITY_MIN_DISTANCE` in
  `canFoundCity`; since save version 34, asked for 2026-10-27: the player could found two squares out), and settlers
  never fortify (the `fortify` command refuses them; their F builds a fortress, as in the original); saves before
  34 load with `looseSettlers` (headless `--loose-settlers`): two squares, fortified settlers. Saves before version
  22 load with `packedCities` (the old habit, so their AI turns replay; headless `--packed-cities`).
  Head to head (planner vs v2, 16 x 300): packed 13-3, score 136 vs 94, cities 15.9 vs 7.1; spaced
  12-4, 124 vs 99, cities 13.0 vs 8.4 (4 from every city was worse: 10-6, 116 vs 104).
