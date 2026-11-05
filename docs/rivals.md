# Rivals

Barbarians, city-states, tribal villages. Moved word for word from CLAUDE.md, so "above" and "below" may point to another file here: search `docs/` for the name.

  Barbarians (`barbarians.ts`, numbers in `rules/barbarians.ts`, roles per unit in `rules/units.ts`) follow
  FreeCiv's summons: from turn 150 a few random squares a round; one 5-8 squares from the nearest city
  starts an uprising (explored land on that city's continent, never tundra or arctic) or a raid (a Sail
  of raiders near land), more often and bigger against big empires. Units come by role (`barbarian.as`),
  the advanced ones once any civ knows their advance. Each band has a Barbarian Leader (`leader` flag:
  never built, 100 gold ransom to a land unit that catches it alone). They hold cities they take
  (razing size 1) and build soldiers there; the `pillage` command wrecks one improvement a turn.
  Stepping off a ship ignores zones of control. Saves before version 4 load with `simpleBarbarians`
  (the old coastal parties that razed everything) and `zocAtSea`.
  City-states (`city-states.ts`, numbers and the thirty in `rules/city-states.ts`; asked for 2026-10-29: "~30 single
  city-states civs ... placed in the start of the game to encounter the real civs. no diplomacy or leader to talk to.
  always aggressive - player could only conquer them or pay tribute ... only produce war units to attack
  occasionally", "make sure on a start of a new game, no civs gets to be alone on a mass of land"; save version 45):
  single cities of peoples of history not among the civilizations (Knossos, Tyre, Carthage, Axum, Angkor, Cuzco,
  Venice...; none a civilization's city name), each a city of the barbarians' seat marked `City.cityState` (its rule's
  id), so always at war, never met or talked to, out of scores and victory, and the planner's "barbarian city on our
  land" a war to win back once it holds `CITY_STATE_WAR` (4) cities. `NewGameOptions.cityStates` places them
  (`placeCityStates`, after the starts, drawn with the game's RNG): first one on the land of each civilization alone
  on its landmass, 6-10 squares from its start (else 4-14), the best city site; then, to `cityStateCount` (8 on the
  original's width, 12 medium, 16 large), at random among the better half of sites 8-16 squares from the nearest
  start; 6 apart; size 2, no palace, two defenders fortified. The web app's `startGame` asks for them in every new
  game (`?citystates=off` not); the headless harness too (`--no-city-states`); games before version 45 never had
  them, so they replay as they were. They raise only soldiers (`cityStateUnits`: land soldiers whose advance half
  the living civilizations know, needing no resource; defenders until the garrison of 2 stands, then attackers) and
  the AI (`barbarian.ts`, `cityStateTurn`; the old barbarians' play untouched) keeps the garrison home and, from
  turn 30 (`grace`), sends every 2 spare soldiers at the nearest civilization's city within 12 squares on its land,
  first demanding tribute of its owner (the `cityStateDemand` command, `tributePrice`: 0.4 of the payer's `goldScale`,
  at least 30, in tens; `state.cityStateDemands`, lapsing as the city-states' turn comes round, `settleCityStates`).
  Since save version 50 (asked for 2026-10-31: "city-state bump each turn a threat message", "show city-state threat
  only when encounter the city-state unit or city") it asks only a civilization that has come upon it (`cameUpon`:
  the city's square explored, or one of its soldiers in sight now), as the raid sets out or, unannounced, once its
  band comes into sight, and the same civilization once in `CITY_STATE.askEvery` (10) turns at most, paid, refused or
  lapsed (`state.cityStateAsked`, `askedLately`, `noteDemand`): a band held at home had asked again every turn. Saves
  before 50 load with `eagerCityStates` (headless `--eager-city-states`). Head to head (planner vs v2, 16 x 300, seeds
  1-16): eager 12-4, score 172 vs 106, pop 56 vs 34; now 10-6, 174 vs 114, pop 58 vs 39; all replaying exactly.
  Since save version 63 (asked for 2026-11-03: "city-state units - need to also pillage. and more aggresive - more
  attack, less fortify near units"; the AI's `prowl`) its soldiers out of the city fortify only at home; from the grace
  they strike what is next door at worse odds for themselves (`RAID_ODDS` 0.2 in the field, the barbarians' 0.3 before;
  a city at `STORM_ODDS` 0.1 as before), go after a unit in the open within `HUNT_RANGE` (3) squares they have those
  odds against (`hunt`), and wreck the farms, mines, railroads and fortresses they stand on (the `pillage` command) on
  the land of any civilization that has not paid them off (`plunder`). A city they cannot storm (their odds at its gates
  were under 1% nine times in ten) they lay waste instead of waiting at its gates: they make for what lies on its land
  within `LOOT_RANGE` (3) of it, roads too (`lootNear`), stepping out of its defenders' zone of control first where it
  bars the way along the walls (`stepToward`); and a raid takes, of the three nearest cities, the nearest it could storm
  or has something to wreck round (`raidTarget`), else the nearest. Saves before 63 load with `meekCityStates`
  (headless `--meek-city-states`): raiders fought at the barbarians' odds and only next door, wrecked nothing and
  fortified wherever they stopped. In 6 all-planner games of 200 turns: before, 833 of the raiders' 2194 turns a game
  ended fortified away from home, 792 of them beside an enemy, now none; squares pillaged 0.5 a game, now 11; attacks 43,
  now 44 (the computers' cities have few improvements round them and are rarely stormable, so a band with nothing left to
  wreck still waits at the gates, unfortified, striking once the odds turn). Head to head (planner vs v2, 16 x 300, seeds
  1-16): 7-9, score 103 vs 101, pop 43 vs 38, cities 8.5 vs 7.1, cities lost 1.2 vs 0.9 a seat; meek 8-8, 111 vs 97, pop
  46 vs 35 (as version 62); all replaying exactly. The planner, its settlers and soldiers more often in the open near
  the city-states, loses the most: not tuned for the bolder raiders yet.
  Since save version 71 (asked for 2026-11-05: "city states unit come in massive units - and just walk arownd my cities -
  make no sense and make each turn very long, waiting for all those units to move forward and backward - FIX this. if you
  need to attack just attack, or reduce the units amount or make them move at batches") a city-state raises only its
  garrison and one band of `CITY_STATE.band` (3), its box waiting once all stand (core `cityStateManned`; up to 14 a city
  before), and the AI is `bandTurn`, not `swarmTurn`. The band sets out whole, past the grace, and no one follows until the
  last of it has fallen or come home (a new soldier used to set off alone). It marches on the nearest city it can reach,
  chosen from its home so it holds (`raidTarget`; the old choice moved as the farms went), and goes straight there (`press`):
  it attacks what it comes next to at any odds (a field fight at `RAID_ODDS`, a city at `STORM_ODDS` before), the city above
  all, passing by whoever paid it off (`strike`), and wrecks what it stands on, but hunts nothing, looks for no loot and
  does not wait at the gates, so a raid ends in a fight. With nothing to raid it goes home and stays. A goto left standing
  walks first as the turn begins, spending the moves, so `press` replaces one for elsewhere at once: before, a band sent home
  took that step forward each turn and never turned round, and raiders stepping out of a zone of control and back were the
  rest of the "forward and backward". Saves before 71 load with `swarmingCityStates` (headless `--swarming-city-states`).
  About 34 of 48 city-states at turn 100 hold all five, the rest rebuilding, or (2 of 48, at 2 shields or fewer) short of a
  band for good, their upkeep taking the shields, so those never raid; raids set out 2.8 times a city-state per 100 turns.
  Measured from a human seat refusing every demand, 7 civs on a small world, 6 x 250 (the planner stand-in sees little and
  hunts raiders, so sight widened to 8 squares round its cities and units; at turns 60-100, version 70 then 71, batched
  playback included, see docs/map-screen.md): the city-states' playback 2.2 s a round then 1.1 s, of it walking 2.1 s then
  0.6 s, fights 0.1 s then 0.5 s; rounds over 3 s 29% then 10%, over 5 s 14% then 7%; the longest of the game 15.5 s then 10.3 s; soldiers
  at most 57 then 40, of one city-state 14 then 5, abroad 17 then 8; the barbarians' turn 10.7 then 2.2 ms. Left alone from turn 120 on a
  medium world, 5 civs: at our gates at most 13 then 6, 2.5 then 0.4 at a time. Head to head (planner vs v2, 16 x 300, seeds
  1-16 and 17-32): 6-10 and 6-10, score 107 vs 140 and 126 vs 125, pop 46 vs 48 and 51 vs 47, cities 8.7 vs 8.2 and 9.2 vs
  8.6; swarming 6-10 and 11-5, 83 vs 103 and 113 vs 74, pop 33 vs 35 and 46 vs 29, cities 7.0 vs 6.8 and 8.9 vs 6.4; all
  replaying exactly. Over the 32 seeds the planner gains (score 98 to 117, pop 40 to 48) and v2 gains more (89 to 133, pop 32
  to 47): the swarm held back whoever would not fight it, so the rivals are stronger now and the planner's edge on v2 is gone.
  Paid (`cityStateTribute`), that city-state leaves the payer be for 20 turns (`state.cityStatePeace`,
  `peaceUntil`/`boughtOff`: its units may not strike the payer's), until the payer strikes it (`breakPeace`). Taken,
  it is a city-state no more (`endCityState`); its soldiers fight on as barbarians. The planner pays while its
  treasury keeps its cushion after. Told by name: the web app's "Knossos Demands Tribute" window (Pay, or Refuse by
  default; `cityStateDemandCard`), the news, the conquest window ("Taken from the city-state of Tyre", "Burned by
  ..."), fights ("Legion of Tyre attacks!", `BattleSide.cityState`, `unitTitle`), the square's window ("Tyre (a
  city-state of the Phoenicians)", "Land of Tyre"); the barbarians' land bears no civ name on the maps. The first time
  the player comes upon a city-state in a game (`cameUpon`; asked for 2026-11-03: "when encouter a city-state add a
  small notification explanation about it"), the map glides to it (its city, else its soldier in sight) and a small
  window stands by it pointing at it (renderer-api `cityStateIntro`: "Petra, a City-State", three lines: a lone city of
  its people at war with all, it raids unless paid, click it to buy peace or take it; the web app's `newCityStates`,
  `introduceCityState`, a `cityStateMet` item of the news, `News`, before what it demands). Once a game (asked for the
  same day: "make sure intoduction message appear once, and not each time you encouter a city-state unit or city"; it
  had come for each city-state, and again for one met only by its soldiers after a reload): the others come upon pass
  quietly (`metCityStates`), and the game is remembered per browser by its seed (`epochs.cityStateIntro`,
  `shownThisGame`/`markShownThisGame`, shared with the deep-water warning's `epochs.deepWater`), a loaded game that
  had come upon one counting as told. Peace is bought unasked too (asked for the same day: "allow clicking each city-state
  unit+city and asking to pay tribute to stop city aggresion"): a left-click on a city-state's city (explored) or a
  soldier of it in sight (renderer-api `cityStateAt`), or the square's window's "City-state..." (the phone's way, as
  a tap there with a unit in play moves it), opens its window by the square (`cityStateCard`, `openCityStateCard`; the
  menu screen's `pointTo`): its size, how we stand (open to its raids, a demand standing, or paid off until a year),
  "Pay N gold" and Leave (Leave alone without the gold, no button while its peace holds); paying is the core
  `cityStateOffer` command (`whyNoOffer`: a city-state we have come upon, not paid already, the gold in hand;
  `offerTribute`: its standing demand's gold, else `offerPrice`, `tributePrice`; the same `CITY_STATE.peaceTurns`), told
  in the status line. No save version: the AI never offers, and old logs hold no offer. Head to head
  (planner vs v2, 16 x 300, seeds 1-16): without them 10-6, score 217 vs 183, cities 12.3 vs 11.6, pop 77 vs 72; with
  them 8-8, 158 vs 124, cities 10.7 vs 6.8, pop 58 vs 38 (the planner takes 1.4 cities a seat, v2 never fights them),
  all replaying exactly. At turn 200 (planner in every seat, 3 seeds) cities a civ 7.4 without, 4.9 with (5.8 with
  raids off: two thirds of it the land they hold).
  Tribal villages (`openHut` in commands.ts, numbers in `rules/villages.ts`; asked for 2026-11-04: "what about settler and
  new settlement like in the original civ"; save version 67): a land unit stepping into a village (1 land square in 60)
  opens it, one roll deciding, of every hundred: a tribe 20, gold 20 (25 to 100; it was 40), an advance 20, mercenaries 20,
  two barbarian Legions 10, nothing 10. A tribe 4 squares or more from any city joins its finder (`joinTribe`): a city on
  the village's square where `siteScore` reaches `VILLAGES.goodLand` (100: 37% of villages, 48% standing on land fit for a
  city at all, starts as drawn averaging 109), size 1, the capital if its civilization had no city, as the original's
  tribe; else Settlers with no home city, so they eat nothing (our departure, after Civilization II's nomads: the original
  gave 50 gold there). Under 4 squares from a city it sends mercenaries, as the original's did; barbarians never find one.
  The 1991 game's roll, from the CivFanatics thread "Civ1 explained: tribal huts visit outcomes" (reverse-engineered; it
  gives no odds): one of four: a city (50 gold on land value under 13, mercenaries near a city); an advance (50 gold on
  the first turn or after 1000 AD); 50 gold; barbarians (mercenaries near a city or with no city yet). It has no Settlers.
  Still ours: gold of 25 to 100, mercenaries by what the finder knows (the original's Legion or Cavalry), the empty
  village, advances at any date, and the city's size (the sources do not say). Over 6 all-planner games of 300 turns, 16
  villages opened a game, 0.7 cities and 1.3 Settlers from tribes. Saves before 67 load with `noTribes` (headless
  `--no-tribes`). Head to head (planner vs v2, 16 x 300, seeds 1-16): 7-9, score 99 vs 100, cities 7.9 vs 7.5, pop 40 vs
  38, techs 18.9 vs 19.0; without tribes 7-9, 103 vs 99, cities 8.5 vs 7.0, pop 43 vs 38, techs 19.8 vs 18.9; all
  replaying exactly. No more cities a seat all told; v2 gains what the planner gives up.
