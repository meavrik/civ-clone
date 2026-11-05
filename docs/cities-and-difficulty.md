# Cities and difficulty

City moods and celebrations, difficulty and the computer players. Moved word for word from CLAUDE.md, so "above" and "below" may point to another file here: search `docs/` for the name.

  Moods (`computeCity`; asked for 2026-10-21, checked against FreeCiv's civ1 ruleset): citizens are born
  content up to the difficulty's base (6 Chieftain .. 2 Emperor, `DIFFICULTY_RULES` in `rules/difficulty.ts`
  with each level's starting gold, settlers and research cost; our departure, FreeCiv plays 4) and unhappy
  beyond; an empire holding more cities than its government's `empireSize` (Anarchy 9 .. Democracy 14) loses one
  content citizen a city, one more per `EMPIRE_SIZE_STEP` (10) cities. Then stage by stage (`CityReport.moods`,
  shown by the city screen's Happy panel, H or the face before the citizens, as the original's Happy analysis did): luxuries (two
  a step, content to happy first), buildings (`BuildingRule.content`, the Oracle doubling temples,
  Michelangelo's a cathedral everywhere), soldiers (martial law: each military unit in the city calms one
  unhappy citizen, up to `GovernmentRule.martialLaw`, Monarchy 3, Despotism, Anarchy and Communism unlimited;
  war weariness: each unit away from any city under the Republic (1) or Democracy (2) sours a content citizen,
  then a happy one for two steps; Women's Suffrage excuses one a city), wonders (Hanging Gardens, Cure for
  Cancer, Bach's, then Shakespeare's). Disorder when the unhappy outnumber the happy: no shields (the units'
  upkeep still owed), tax or science; food and luxuries go on (the city screen's production box lays a red
  PRODUCTION HALTED strip across its shields, "Halted by disorder" at its foot; asked for 2026-10-27; since
  2026-10-31, asked for: "warning banners for when: 0 city production or no extra food for grows", the city screen's
  `warnAcross` also lays NO PRODUCTION across the shields with no shield to spare and NO GROWTH across the food with
  no food to spare, in amber, red where the city loses: STARVING, or its units' upkeep past its shields). `City.unrest` counts the turns in a row, and a
  Democracy falls into anarchy once a city passes `revolutionAfter` (2): the `overthrown` event. Celebration
  (the original's festival, in our words): from size `CELEBRATION_SIZE` (3) with nobody unhappy and half the
  people happy at the turn's end (`CityReport.celebration` becomes `City.celebrating`, a `celebration` city
  event): a Despotism's squares then yield as a Monarchy's (no tile penalty), a Monarchy's or Communism's as a
  Democracy's (+1 trade), `cityYieldGovernment`; a Republic or Democracy grows a citizen every turn it has
  food to spare, keeping its store. The map flags the viewer's own cities (`cityMood` in renderer-api): red
  in disorder, yellow when the unhappy equal the happy, green while celebrating; the city screen names the
  standing (CIVIL DISORDER, UNREST, CELEBRATING) and riots open the city with the Happy panel up. Saves before
  version 17 load with `simpleMoods` (headless `--simple-moods`): our first rules (martial law 3 everywhere,
  weariness stopping at the content, wonders calming with the buildings, no celebrations or fall, one content
  citizen fewer per four cities past eight, whatever the government).
  Difficulty and the computer players (`DifficultyRule.computer` in `rules/difficulty.ts`, `levels.ts`; asked for
  2026-10-30: "the other civs AI should be more ruthless and more advanced as the difficulty grows"; save version 47):
  until then every civilization, the computers too, played under the human's rules of the level, so a harder level
  made them weaker (fewer content citizens, dearer advances). Now a computer player (not the barbarians nor their
  city-states) has its own (`computerRule(state, owner)`): the original's handicaps and advantages (it charged the
  computer 160% of the human's costs and food box at Chieftain down to 80% at Emperor, 14 - level beakers an advance,
  and kept its content citizens fixed), taken from Prince so a Prince game plays as before: costs and food box 133,
  117, 100, 83, 67% (`levelPct`, read by `costFor` and `cityFoodBox`, so buying follows), 14 .. 10 beakers an advance
  (`researchCostFor`: use it, not `researchCost`, for a player's next advance), 4 content citizens at every level
  (`levelContent`, in `contentBase`), no starting gold; at King and Emperor, from 1 AD while a human knows more
  advances than every computer, 17 points off again (`spur`, `leaderSpurred`: the original's computers caught up with
  a leading human so). Toward a human their leaders follow the human's level (`TemperRule`, `temperToward`; computer
  pairs deal alike at every level, so all-AI games are unchanged): wars of choice (`warRatio` never at Chieftain,
  then 3, 2, 1.5, 1.25 times the human's strength; `treatyRatio` to break a treaty, 4 .. 1.5; from turn `warFrom`,
  120 .. 40; `warChance` 3 .. 12% a turn; a friend spared but at Emperor; at King and Emperor even while fighting
  city-states or barbarians, `twoFronts`), war over trespass after the last warning (`trespassRatio` 1 .. 0.4 of the
  intruder's strength; at Chieftain only complaints), peace (`holdsWar`: Chieftain's leaders always take it, as the
  original's always offered it; `peaceWill` on their envoys), tribute (`tributeRatio` 4 .. 2 times the strength,
  `tributeShare` the original's parley multipliers taken from Prince, at most three quarters of the treasury,
  `tributeChance` 5 .. 20% a turn, a refusal war `refusalWar` 25 .. 100% of the time; none at Chieftain). Prince's
  numbers are the planner's from before. The difficulty card says it ("Rivals pay 67% to build and grow, ruthless").
  Saves before 47 load with `evenDifficulty` (headless `--even-difficulty`). Measured with headless `--human` (seat 0
  a human seat, the level's human rules, played by the planner, which pays tribute only when far the weaker and signs
  peace unless winning; not replayable; the summary's warred and tribute columns count wars declared on a seat and
  tribute demanded of it), 8 games x 250 turns, 4 civs, Chieftain to Emperor: the computers' score a seat 154, 137,
  123, 118, 105 before (weaker as the level rose), now 68, 75, 123, 147, 179; the stand-in won 0, 2, 1, 1, 1 of 8
  before, now 5, 4, 1, 0, 0; wars declared on it a game 0, 0.3, 0.9, 1.3, 2.6 (0.4 to 0.9 at every level before),
  tribute demanded 0, 0, 0.3, 1.6, 5.1, its cities lost 0.3, 0.9, 0.4, 0.9, 1.9. Planner vs v2 at Prince (16 x 300):
  unchanged, 8-8, score 158 vs 124, all replaying exactly.
