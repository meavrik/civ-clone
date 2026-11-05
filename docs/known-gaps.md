# Known gaps

Departures from the original, measured results, open work. Moved word for word from CLAUDE.md, so "above" and "below" may point to another file here: search `docs/` for the name.

## Known gaps / next steps

1. Rules data verified against FreeCiv's civ1 ruleset (2026-10-16): tech edges, unit/building/
   wonder/terrain numbers. Square yields then set to the 1991 game's own (2026-10-23, asked for: "same as
   civilization 1, the original", not FreeCiv; from CivFanatics' Civ1 terrain chart and the game's data
   tables): the basic terrains were already equal; since save version 26 shield grassland lies on the
   original's diagonal bands two squares wide ((x + y) mod 4 of 0 or 3, `grassShieldAt`, `Tile.grassShield`,
   rivers on grassland too, drained land shows it; drawn as a small stone, `drawGrassShield`) in place of
   grassland's scattered Resources; a road adds no trade on a river (needs Bridge Building), a river square
   defends at +50% (the original's River: grassland with a river yields its 2/0/1); grassland, plains, swamp
   and jungle mine into forest; railroads add half again to food as well as shields; a city's square has no
   free shield. Saves before version 26 load with `freecivYields` (headless `--freeciv-yields`; the
   moved starts `--random-starts`). Still ours: second specials and the advances' bonuses on specials, the
   city square spared Despotism's -1, settlers costing food only. Head to head (planner vs v2, 16 x 300):
   old starts and yields 13-3, score 149 vs 108; moved starts 10-6, 144 vs 136; the original's yields 9-7,
   154 vs 139; both 6-10, 143 vs 156, and 8-8, 141 vs 154 (pop 48 vs 71) once the planner's citizens work
   for a shield first while their city has none (`governCity`). Both changes favour v2, which still packs
   its cities (13.9 vs 12.2): tuning the planner to the new land is open.
   Settlers' jobs (checked 2026-10-29, asked for: "settler actions should take longer - check again the original civ1
   settlers actions time frame"): the turns per terrain are the 1991 game's (roads 2, 4 or 6 by the ground's movement
   cost, irrigation 5 or 10, mines 5 or 10, forest planted or cleared 5 to 15: FreeCiv's civ1 ruleset, CivOne's tile
   data and the Civ1 wiki agree), counted from the order to the turn the settler is free (a 2-turn road ordered on
   turn 10 stands as turn 12 begins), so they stand. Two things ran quicker than the original, fixed in save version
   46: a settler that had spent its moves (walked onto the square that turn) could take up a job at once and have that
   turn count, where the original takes no orders from a unit without moves and FreeCiv counts no work from one (now
   one turn more, `workOptions`; the planner never did it, only giving orders to units awaiting them), and pollution
   cleared in three turns where the manual says four (`CLEAN_TURNS`). Saves before 46 load with `quickWork` (headless
   `--quick-work`). Head to head (planner vs v2, 16 x 300): identical both ways, 8-8, score 158 vs 124, all replaying
   exactly. Since save version 56 (asked for 2026-11-01: "road, irrigation and mine should take longer to build"; our
   departure) roads, irrigation and mines take twice those turns (`IMPROVEMENT_WORK_FACTOR` in `rules/terrain.ts`, applied
   in `workOptions`): a road 4, 8 or 12, irrigation and mines 10 or 20 (a hill's mine 20). A job that turns the land into
   another (clearing forest 5, planting forest 10 or 15, draining swamp or jungle 15) keeps the original's turns, and
   railroads theirs (4, 8 or 12, now as long as a road; FreeCiv's civ1 ruleset has 3). The orders menu shows the turns
   ("Road (4 turns)"). Saves before 56 load with `quickImprovements` (headless `--quick-improvements`). Head to head
   (planner vs v2, 16 x 300, seeds 1-16): doubled 11-5, score 108 vs 94, cities 9.2 vs 5.7, pop 42 vs 30, techs 22.5 vs
   20.4; the original's turns 9-7, 122 vs 99, pop 46 vs 31 (as version 55); all replaying exactly. Still ours: the
   Romans' roads and the Germans' farms and mines in half the time (`fastWork` traits, halving the doubled turns).
   Other deliberate departures: rivers give +1 trade (on grassland that is the original's River), Michelangelo's acts as a
   cathedral everywhere, the sea yields 1 trade until its city has a Harbour (save version 58, see core above). The Colossus is the original's since save version 27 (asked for 2026-10-24: "built a
   Colossus, 0 effect": ours helped only the ocean squares its city worked, which Growth rarely picks): +1 trade on
   every square its city works that yields trade, its own square too, until Electricity; a square's yield for a
   city is core `cityTileYield` (government, celebration, Colossus), which the city's totals, the choice of
   squares (`slotYield`, the planner's `governCity`) and both city screens' square marks read. Saves before 27
   load with `oceanColossus` (headless `--ocean-colossus`). Units have hit points and firepower (`hp`,
   `firepower` in `rules/units.ts`: 10 ancient, 20 gunpowder, 30-40 mechanised/steel; heavy guns hit
   for 2): fights go in rounds won with A/(A+D), survivors keep wounds and heal by resting (`HEALING`).
   A wounded unit (not an aircraft) may make camp (K, its orders' "Camp and heal", "Rest and repair" at sea; the
   `camp` command, `whyNoCamp`; asked for 2026-10-27: "camp and heal/regroup"): skipped like a sentry, it heals at
   least as in a fortress (`HEALING.camp`, a quarter a turn), wakes once whole or when anyone comes near, and wears
   a heart badge on the map; no save version (old logs hold no camp).
   `attackOdds` gives the exact chance. `classicCombat` (version 1 saves, `?combat=classic`) restores
   the original one-roll fights with the same RNG use, so old saves replay unchanged.
   Combat experience (asked for 2026-10-25: "for every unit produced a combat experience factor that will
   add to the unit strength", and "ranks that unit can go up"; our departure, after FreeCiv's veteran
   levels): every unit counts experience (`Unit.xp`, in place of the veteran flag); each fight it wins
   teaches it 1, 2 when its chance was under half (`experienceFor`, `EXPERIENCE` in `rules/experience.ts`),
   never past the top rank's. `RANKS`: Recruit 0, Regular 1 (+25%), Veteran 3 (+50%, the old veteran),
   Hardened 6 (+75%), Elite 10 (+100%); the rank's `power` multiplies attack and defence (`attackStrength`,
   `defenseStrength`, so `attackOdds` and both planners count it). Barracks and the veteran traits train
   units at Veteran (`VETERAN_XP`). A fight that raises its winner says so (`CombatResult.promoted`,
   `UnitBattle.promoted`, `CombatReport.promoted`: "... Now Veteran!" after our attack, ", now Veteran" in
   the enemy turns' notes and the Under attack! report); `BattleSide.xp` is the rank fought at. Shown
   (renderer-api `ranks.ts`): gold chevrons, one a rank (icons `regular` .. `elite`), in the square's top
   right on the map and on the city screen's units (`drawRankMark`; a working settler's badge wins), the
   unit box's line ("Veteran +50%", for units that fight, `showsRank`), the rank before the unit's name in
   the stack list, the square's window and an enemy's attack note, and in the square's window how far each
   of ours has to go ("Legion 3/6 experience to Hardened"). Saves before version 32 load with
   `simpleVeterans` (headless `--simple-veterans`): a win made the winner a veteran half the time, the coin
   drawn as before (6 x 250 planner-v2 games came out identical to the code before). Head to head (planner
   vs v2, 16 x 300): ranks 1-15, score 125 vs 228; simple veterans 1-15, 127 vs 225, both replaying exactly.
   Ground: off the road only settlers, explorers and War Elephants climb `roadOnly` terrain (mountains,
   `climbsMountains`), so a range is a wall to the rest until settlers build a road over it (elephants since save
   version 59, asked for 2026-11-02: "elphents would be the only unit that can enter any tile without any road", then
   "settlers and explorers should also be able to climb", `UnitTypeRule.anyGround`, the only soldiers that do; saves
   before 59 load with `groundedElephants`, headless `--grounded-elephants`. Head to head, planner vs v2, 16 x 300,
   seeds 1-16: 10-6, score 95 vs 75, pop 40 vs 24; grounded 10-6, 95 vs 74; all replaying exactly, elephants being rare); `wheeled` units (chariot, catapult, cannon, artillery, armor, mech inf)
   also keep off `rough` terrain (jungle, swamp, arctic) without one. City squares have a road, and
   attacking onto such ground is fine. One rule, `canEnter`, serves `checkMove`, `findPath`, barbarians
   and the planner (camp squares, scouting to the edge of ground it cannot enter). `openMountains`
   (saves before version 7, `?mountains=open`, headless `--open-mountains`) lets every unit climb. Terrain
   `attrition` (desert 10% until Trade, tundra 10% since save version 68 and arctic 20% until Weaving, Medicine on the 1991 tree) takes hp instead of healing from land
   units ending a turn outside their own cities' radius, never the last one; rivers and specials the owner knows of spare
   them. `classicTerrain` (saves before version 3, `?terrain=classic`) turns both off.
   Deep water (asked for 2026-10-27: "trireme should sink in deep water"): a `coastal` ship (the Trireme)
   left on `deepWater` (sea with no land beside it, corner to corner too: the map's darker blue, which the
   viewer sees by the land it knows) as its owner's turn ends sinks with its cargo, no dice (`sinkAtSea`,
   which `sinkingShips` names, the `lostAtSea` event). The player sees it go down (asked for 2026-10-27: "when
   ship sinks - show it sinking in water - with message above it"): before the turn passes, while it still
   stands there, the web app glides the map to each such ship (`showSinkings`, the `sinking` screen, `SINK_MS`
   3 s, a key or click after 0.4 s cuts it short, the `sink` sound) and the map draws it going down
   (`MainScreenView.sinking`, `Sinking` in renderer-api's `sinking.ts`; retro `drawSinking`, `sinking.ts`: it
   rocks, tips stern first and slips under the foot of its picture, foam at the waterline, then rings and
   bubbles, hashed, never the RNG; it and its cargo not drawn on their square meanwhile) under a callout
   above the square (`sinkingWords`: "Our Trireme sinks in deep water, with the Settlers aboard!"); the
   news then leaves `lostAtSea` out. Its gotos (`findPath`'s `coastalRoute`: breadth-first over
   square and steps taken this turn) may cross deep water mid-turn, a narrow strait, but never stop on it
   at a turn's end, and never aim for it; a meeting that would halt it there lets it sail on; steered onto
   it by hand, a note beside it warns ("Deep water! End the turn beside land, or the Trireme sinks"), once a
   game (asked for 2026-10-27; `deepWaterWarned`: the games warned, by seed, in `epochs.deepWater`). The
   planner's triremes keep within two squares of land as before and never make for deep water.
   `hugsCoast`; saves before version 35 load with `safeTriremes` (headless `--safe-triremes`). Head to head
   (planner vs v2, 16 x 300, versions 34 and 35: three-square cities, sinking triremes): 3-13, score 137 vs 198
   (0-16, 121 vs 246 before), overseas cities 1.1 a planner seat, all replaying exactly.
   Legion 3/1, Musketeers 2/3, Riflemen 3/5 follow the ruleset even though the 1991 manual is often
   quoted as 4/2, 3/3, 5/4.
   Retired units (`UnitTypeRule.obsolete`, the advance that ends one, read only in saves of versions 39 to 64 since
   Replaced units below; asked for 2026-10-27: "when get
   gunpowder - remove militia from the options"): Militia retire with Gunpowder. No city of that civ builds
   them (`unitRetired`, read by `unitChoices`, so the build menu and `setProduction`), and a city building
   them as the advance comes (`discover`, a trade, the Debug grant; else at its turn) turns to its default
   (`defaultProduction`: Militia, or once they are retired the stoutest land defender it can build now, the
   cheaper on a tie; also what a new or taken city starts on and a city turns to after an improvement or
   wonder), a human player's waiting for its pick instead since save version 49 (`City.choosing`); Militia in the
   field stay. Saves before version 39 load with `lastingUnits` (headless
   `--lasting-units`).
   Replaced units (asked for 2026-11-04: "muskeeters should remove phalnex units also", "also knight - replace cavalery
   and chariot", "yes make the replacement - but only if the player have the resources for it. if not he still should be
   able to build the old units"; save version 65, after FreeCiv's civ1 `obsolete_by`): a unit gives way to its successor
   (`UnitTypeRule.replacedBy`) once its civilization can build that unit, knowing its advance and holding all it `needs`,
   the road to the square included (`unitRetired`, read by `unitChoices`), and comes back should a resource go: Militia,
   Phalanx and Archers to Musketeers, Musketeers to Riflemen, Chariot and Cavalry to Knights (Horses alone keeps them),
   Catapult to Cannon, Cannon to Artillery, Trireme to Sail, Sail to Frigate, Ironclad to Cruiser. FreeCiv's rule for
   Cavalry is Musketeers; the user's is Knights. Left out on purpose: Frigate to Ironclad (Ironclads carry nothing, and a
   test refuses a ship giving way to one carrying less), Militia to Phalanx (the Romans start with Bronze Working),
   Riflemen to Mech. Inf., Cruiser to Battleship, War Elephants to Knights. Offered and not yet picked: Legion to Riflemen,
   Knights to Armor, Frigate to Transport. Saltpeter is why it waits on resources: it shows only with Gunpowder and wants
   a road, the Phalanx is the only real defender that needs none, and in 8 all-planner games 5 of the 24 civs that learned
   Gunpowder held Saltpeter that round, 21 by turn 300 (25 of the 27 that knew Chivalry could build Knights). Units in the
   field stay; a human player's city building a replaced unit waits at its turn ("Phalanx replaced: build what?", the web
   app's `askChoices`), a computer player's turns to its default; the build menu's info says "No longer built once we can
   build Musketeers." Saves before 65 load with `noReplacements` (headless `--no-replacements`): only Militia and Archers
   retire, by the advance alone.
   Unit upkeep (`unitSupport`, `freeUnits` in `cities.ts`, `freeUnits` per government in
   `rules/governments.ts`; since save version 29, asked for 2026-10-24: "units should take resources
   from the city, otherwise can generate infinite units and fast"): a city supports a fixed number of
   units free, two under Anarchy and Despotism (our departure: the original's allowance was the city's
   size, so armies grew with the city for nothing), three under Monarchy and Communism (the original's),
   none under a Republic or Democracy, and pays a shield for each beyond; settlers count like any unit
   and eat 1 food (2 under Republic and Democracy). A city that cannot pay disbands units at once,
   newest first and settlers last (cargo of a ship at sea sinks with it), without touching its shield
   box; the `home` command (H) moves a unit's support to the city it stands in. Both city screens mark
   each supported unit's cost. Saves of versions 8 to 28 load with `sizeFreeUnits` (headless
   `--size-free-units`): free units by city size under Despotism and Anarchy, none under the others,
   settlers free of shields from version 24 (`settlerShields` before). 6 planner games x 250 turns, old
   vs new: units a seat 49 vs 38 (military 38 vs 29), cities 12.3 vs 11.6, pop 47 vs 45, score 142 vs 125. `looseUpkeep`
   (saves before version 8, headless `--loose-upkeep`) keeps our first upkeep: 3 free units a city
   under Monarchy and Communism too, debts paid from the shield box.
   Treasury (asked for 2026-10-29: "show a message/notification when going to run out of money -> when run out of
   money - remove support upkeep from buildings until balance is returned - show a notification with all the upkeep
   reduced", and "on the left pane menu - show the gold/money added/removed each turn"; save version 42): as a civ's
   turn ends, before its cities pay, a treasury that cannot meet the turn's building upkeep (core `goldPerTurn`, the
   cities' taxes less their upkeep) stops supporting buildings across the empire until the books balance (core
   `balanceTreasury`, as the `support` command does: `City.idle`, the "unsupported" city event with `building` and
   `upkeep`): the one saving the most gold first (its upkeep less the tax it brings, a city falling into disorder
   without it counting its lost taxes), then the one adding less culture, then the cheaper; never one that saves
   nothing, the Palace or a wonder. Nothing comes back by itself: a city's Improvements list supports it again (Use);
   the planner takes them up again, one a turn, once its treasury holds its cushion and the books still gain after
   the upkeep (`resupportBuildings`). Saves before 42 load with `sellWhenBroke` (headless `--sell-when-broke`): a
   city whose upkeep the treasury could not meet sold its costliest building for its cost. Words in renderer-api
   `treasury.ts`: `treasuryOutlook` (taxes, upkeep, net, `dryIn`: the turn's end at which the gold falls short at
   this rate, 1 being this one), `treasuryWarning` (within `DRY_WARNING_TURNS`, 3) and `unsupportedNotice`. The web
   app warns as our turn begins (`warnTreasury`: "Treasury Running Dry", Tax Rates or Continue; once for the turn the
   gold runs out at, again on that turn, anew when it comes sooner; UI only), and the turn's news gathers the
   buildings stopped into one window ("Buildings Unsupported": city by city, the upkeep cut, how the books stand
   now). The status panel's treasury row shows the turn's gain or loss in brackets beside the gold, "120 (+5)", green,
   red, or dim at nought (nothing before a city), the gold itself red while the warning stands; its tip says when the
   gold runs out. Tax, luxuries and science left the panel (asked for 2026-11-04: "remove tax, luxury and sience. keep
   only treasury"; they had stood beside the treasury, or under it where they did not fit): the treasury's tip gives the
   rates, and a click on its row opens the rates window (the phone's tap too, so there its tip no longer shows), the
   government coming straight under it. The row's picture is what money is to the people (`moneyIcon` in renderer-api
   `treasury.ts`, in the tip's title too, retro and modern alike; only the picture, the game's money is gold throughout): a shell
   (a scallop) before Currency, the gold coin with it, a banknote with The Corporation (the "advanced modern" tech: the
   tree has no Economics and Banking comes in the Renaissance), `shell` and `banknote` in the icon sheet. The purse
   stays everywhere else (upkeep lines, the rates window's foot). Head to head (planner vs v2, 16 x 300, seeds 1-16): selling 10-6, score 208 vs 179, pop 74 vs 73;
   stopping support 10-6, 212 vs 180, pop 75 vs 74, all replaying exactly (an AI civ runs dry a few times a game).
   Growth (asked for 2026-10-23: young cities grew too slowly and could not support settlers; two of four
   measured proposals picked; our departures): the city's own square is spared Despotism's and Anarchy's
   -1 (`tileYield`, an irrigated grassland centre gives 3 food), and, in versions 24 to 28, settlers cost
   only their food, never shields (`paysShields`; the planner's `affordsSettlers` knows it; since 29 they
   pay like any unit again, see upkeep above). A player city on 40 starts (Growth focus): size 4 by turn 32 (was 45),
   size 5 by 49 (was 71); one keeping two settlers home no longer goes without spare shields (12% of
   turns before). Saves before version 24 load with `centrePenalty` and `settlerShields` (headless
   `--old-support`). Head to head (planner vs v2, 16 x 300): old rules 12-4, score 124 vs 99, pop 40 vs 39;
   new 13-3, score 149 vs 108, pop 50 vs 45. Still open: AI cities stay small (the planner's balanced weights prefer forest to
   grassland and it keeps building settlers); the border rule kept young cities to their 8 squares until
   the culture levels came down (version 28, see Land above).
   City focus (asked for; our departure: the original weighed every city alike): `City.focus`
   (`rules/focus.ts`: Growth, Production, Science, Trade) ranks the squares `autoAssignWorkers` and
   `arrangeCity` pick (`slotScore`), never starving the city when another square would feed it
   (`keepFed`); under Science or Trade, spare entertainers become scientists or taxmen while order
   holds. Unset, the player's cities work for Growth and the computer players' weigh food 3, shields 2,
   trade 1 as always (`cityFocus` null), so the AI is unchanged. Since 2026-10-24 (asked for: "4
   multiselect") any foci together (`City.foci`, the `setFoci` command; the city screen's corner toggles,
   F picks one from a menu): their weights added (`combinedFocus`), none picked the old balance, science
   and trade putting spare citizens to study and tax in turn (`FocusRule.spares`); `setFocus` and
   `City.focus` stay for the logs that hold them. Saves before version 23 load with `balancedWorkers` (no focus).
   Since save version 66 (asked for 2026-11-04: "if no growth or no production. place tiles that would be prefered to keep
   city growth and production") the squares picked for a city with a focus hold the line the city screen's warnings
   draw, NO GROWTH and NO PRODUCTION, where its land allows: `keepGoing`, after `autoAssignWorkers` and `dropLostSquares`
   (so as a city grows or shrinks, a click on its square, a focus changed, a border drawn back). While a city is short
   (`shortfall`: a point a food or shield short of one to spare, two more a food or shield owed, so STARVING and upkeep
   past its shields are mended first; a city at its size limit, `sizeLimit`, wants no food to spare; shields as its
   squares make them, riots or not) a worked square gives way to a free one, the swap that mends the most at the least
   cost to the focus, none bringing on disorder; where the land cannot give both, the focus's squares stand.
   `bestFreeSlot` and `weakestWorked` (a citizen clicked back to work or off it, and the entertainers `arrangeCity` takes
   for order) read the same line. Squares the player sets by hand stay until the next growth or arrangement. Computer
   players' cities have no focus and pass it by (the planner's `governCity` minds its own), so all-AI games come out
   digit for digit as before. Saves before 66 load with `fedOnly` (headless `--fed-only`): `keepFed`, from starving
   only. Hands-off cities, 40 seeds x 120 turns (share of city turns with no growth, then no production; size; shields
   gathered), old then new: Growth 6.8%, 0.2%; 6.8; 204 and 6.6%, 0%; 6.8; 204. Production 27.3%, 0%; 5.0; 420 and 5.6%,
   0%; 5.3; 391. Science 37.2%, 13.5%; 4.5; 185 and 5.4%, 0%; 5.2; 244. One swap at a time matched a search of every set
   of squares on all 2880 cities checked over 120 turns of all four foci (113 still short, by their land).
2. AI v3 done (2026-10-17) on top of the Phase 7 harness and planner. New in v3: colonies (sites
   settlers cannot walk to, `landReach` 18 steps and never through a rival city, are "overseas":
   ferries berth beside a port, take settlers and an escort, land them on the site; Map Making then
   Navigation when boxed in), AI-to-AI technology swaps (`manageTrade`, one for one, every third
   turn per pair), campaigns (target judged by `attackersNeeded` from expected damage and a land path
   from the staging city; the army's own gotos keep the target; gather at the staging city with an
   escort, camp on the best square beside the walls, `assault` storms in order of the odds and goes
   all in when the group can clear the city this turn), wars of choice only at twice a rival's
   strength with a city already within reach, and peace by agreement (`acceptsPeace`: a winning AI
   refuses, the player's offers too). Head-to-head against frozen v2 (`--ai planner,v2`, 300 turns,
   4 civs x16 games): on the climate-grown worlds (ef8be01, with traits and the new barbarians) 11-5
   wins, score 207 vs 183, cities 21 vs 16, techs 45 vs 37; on the older scattered-terrain worlds it
   was 10-6, score 219 vs 199 (numbers from before and after ef8be01 do not compare: every seed gives
   a different world). Every civ on v3 vs every civ on v2, old worlds: Earth historical 7 civs score
   160 vs 129, cities 17 vs 14. Under the original's upkeep (version 8) the planner sizes garrisons
   by what a unit costs, builds units only where the city can pay for them, rehomes soldiers to cities
   with free units and disbands its least useful units before the rules take the newest, and goes from
   Despotism straight to the Republic (Monarchy pays for every unit; head to head that won more):
   10-6 wins, score 153 vs 125, cities 20.5 vs 9.6, techs 30.5 vs 29.3 (with `--loose-upkeep` 10-6,
   210 vs 184). On the extended tech tree (version 9; the planner also seeks Weaving after Medicine,
   the modern advances after Fusion Power, and values their improvements): 11-5, score 160 vs 124,
   cities 20.9 vs 10.3, techs 30.0 vs 29.4. Retuned in save version 38 (2026-10-27: the rule changes since had
   left it 3-13 against v2, score 140 vs 199, pop 49 vs 71): it crowns a king again (since version 29 Monarchy
   keeps three units free to Despotism's two and lifts the -1; the old planner sat in Despotism all game), a city
   feeds one settler at a time (two from size six) so small cities grow instead of feeding settlers on the road,
   one wonder city per six cities, and a settled empire's wonder city (8 cities or turn 120, at peace) starts its
   wonder first, spare shields riding there as caravans before improvements that do nothing (a colosseum or
   cathedral where nobody is unhappy, a courthouse where little trade is lost). 16 x 300: 9-7, score 212 vs 178
   (seeds 1-16) and 13-3, 218 vs 174 (seeds 17-32), pop 77 vs 73, all replaying exactly; Monarchy alone gave 9-7
   both ways, 192 vs 193 and 202 vs 185. Saves before 38 load with `oldPlanner` (headless `--old-planner`).
   Tried and dropped: an early Republic (researched after Literacy, garrisons thinned to its upkeep) lost 4-12
   and 2-14 (cities shrank, settlers eating two, and fell); more food in `governCity`, library weights and a
   lower tax cushion made no difference beyond the noise. Open AI gaps: no amphibious invasions, no tribute demands to the player (it asks the player off its land and offers treaties), its units ignore the player's borders,
   colonists sometimes wait long in port. A 7-civ round costs ~1.3-1.6x v2 (~55 ms late game);
   core's `findPath` (typed-array heap, results identical to the old search, see
   `tests/pathfind.test.ts`) is still the hot spot. Measure AI changes with
   `npm run headless -- --ai planner,v2 --games 16 --turns 300 --verify` (8-game runs are too noisy to trust;
   at the default 200 turns the two are close, 124 vs 120: v3 pulls ahead later, with colonies and campaigns).
3. Every wonder is bound (Great Library, sea-move wonders, SETI, Hoover, Women's Suffrage, UN).
   A wonder costs twice an improvement's price to buy, four gold a shield (eight with an empty box), as the
   original charged (save version 31, asked for 2026-10-24: "wonders are now too easy to build"; saves
   before load with `cheapWonderBuy`, headless `--cheap-wonder-buy`).
   Caravans done (help wonder, trade routes: mutual `City.routes`, bonus on opening, route trade in
   `computeCity`). Since save version 65 (asked for 2026-11-04: "caravan - cant make trade routes. when try to move to
   another civ city - it trit it like an attack") a caravan calls at any foreign city not at war with its civilization,
   garrisoned or not (`callsAt`, asked before `checkMove`, which calls any foreign unit on a square an attack; until then
   only an empty city took one in, a garrison brought up the war menu, and the planner's caravans stood at the gate for
   good), by a step or as a goto arrives (`runGoto`; turned away, it waits at the gate). The map shows it first, as it does
   a fight: "Trade route +34" beside the city, "Trade route +34: 3 turns" from further off (`planMove`'s `tradeNote`), a
   second click going; a refused one says why ("Too close to home: a trade route needs 9 squares."), a foreign unit in its
   way is "Someone is in the way.", never the war menu, and a city at war "Can't attack.". The `tradeRoute` event carries
   its `player`: ours is told in the status line, in the news when a goto arrives as our turn begins. Saves before 65 load
   with `barredCaravans` (headless `--barred-caravans`). Over 6 all-planner games of 300 turns, routes abroad 0, now 23
   (at home 16, now 14), caravans standing about at the end 36, now 23. Head to head with Replaced units above (planner vs
   v2, 16 x 300, seeds 1-16): 7-9, score 103 vs 99, pop 43 vs 38, techs 19.8 vs 18.9; with neither 7-9, 103 vs 101, pop 43
   vs 38, techs 19.4 vs 18.5 (version 63's result to the digit); all replaying exactly. Pollution (per-city chance from shields and industrial population, halved tile output, settler
   clean-up, global warming when it spreads), railroads (free moves, +50% shields) and fortresses
   (x2 defence, no stack loss) done. Spaceship done (`rules/spaceship.ts`: parts after Apollo, launch,
   flight, landing wins; lost with the capital; F6 screen; the planner races once it knows Space
   Flight and lands around turn 600-700 in all-AI games). Diplomats done (`diplomat` command next to a
   foreign city: steal an advance, sabotage, incite revolt via `inciteCost`; a victim at peace declares
   war; a diplomat never walks into a foreign city, guarded or not: the move is refused with reason
   `diplomat` and the web app offers the missions, also when a goto brings it to the gate). Nuclear units detonate: everything within a tile dies, the city is halved, fallout is
   left; SDI Defense within three tiles stops them. Triremes sink on deep water (see Ground above). No
   embassies, city investigation or air fuel yet.
   Ranged attacks (talked over 2026-11-01, not built: archers and siege engines firing a volley of a few rounds with
   no return fire, never taking the last hit point or a stack, range 1, 2 for guns; the user picked Seafaring, Archery
   and Elephants first).
4. Diplomacy: no embassies; computer civilizations mind neither each other's land nor the player's
   (only the player is asked to leave), and a refused tribute demand costs nothing.
5. Modern renderer (set aside, not in the app): real sprites/icons for units and specials, animation,
   hover states, if it comes back.
6. Mobile (apps/mobile): not yet tried on real iOS/Android hardware (the keyboard prompt relies on focus
   inside a touch's pointerup); no pinch zoom.

