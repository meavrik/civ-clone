# Resources

Specials and strategic resources, their reveals, roads, trades; seafaring, oil at sea, the sea's trade, herds, tundra. Moved word for word from CLAUDE.md, so "above" and "below" may point to another file here: search `docs/` for the name.

  Specials (`SpecialRule`; read a square's with `specialOf(tile)`, never `TERRAIN_RULES[t].special`): every
  land terrain and the sea has a second kind (our departure, asked for 2026-10-21, after Civilization II:
  Whales, Cotton, Wheat, Silk, Wine, Iron, Oil, Furs, Spices, Fruit; tundra's Game is forest's; the arctic's Ivory
  is gone since save version 62, asked for 2026-11-03: "remove ivory completly", its lattice all Seals as the
  original's: `SpecialRule.until` 61, `secondKind`'s `catalogue`, so only games saved before lay it, for their logs to
  replay, and nothing draws it, its picture, sprite and mark gone; headless `--catalogue 61`; planner vs v2, 16 x 300,
  unchanged: 8-8, score 111 vs 97, all replaying exactly), on about half their lattice squares (`Tile.secondSpecial`, a hash of the square, no RNG, so seeds keep
  their worlds); `learned` may add food, shields or trade with an advance, or with each of several (read it with
  `learnedOf`: Sheep's two, see Herds below; a strategic resource no shields since save version 52, see Strategic
  resources below; Navigation, Weaving, Pottery, Iron Working, Refining, Animal Husbandry). Each carries `since` (the save version that brought it); old saves load with
  `resources` (their version), so their worlds have only the kinds they knew (`secondKind`). A kind may
  have a reach (`within`/`beyond` squares from land): Fish within 2, Whales beyond 2 (deep water), from
  version 19 (`SPECIAL_REACH_SINCE`). A city works whales only two squares out off a straight coast;
  the rest pay through influence yields once its border reaches them (see Land below).
  Strategic resources (`rules/resources.ts`, `resources.ts`; asked for 2026-10-27, after Civilization III: "make
  some units dependent on resources inside the civ borders - like legion need iron, musketeer or rifleman needs
  gunpowder, horseman or chariot needs horses etc. also can exchange resources with other civs"): Horses, Iron,
  Saltpeter (Gunpowder is an advance here, so its makings), Coal and Oil are specials a civ holds while a square
  of one lies on its land (`claims`, `resourceSquares`) or another civ trades it one (`GameState.resourceTrades`).
  A unit naming them in `UnitTypeRule.needs` (riders and chariots Horses, Legion Iron, Knights both, Musketeers
  and Riflemen Saltpeter, Cannon and Artillery Iron and Saltpeter, Ironclad Iron and Coal, Transport Coal, the
  engines Oil) is set and finished only while its civ holds them all (`buildOptions`; `unitChoices` gives what
  each still `missing`; `missingResources`). A city whose unit lost its resource waits with its shields, says so
  once (the `lacks` city event: the web app's news, then the build menu "Rome lacks Iron: build what?"), cannot
  buy it, and the planner changes it at once; units in the field keep going; barbarians build from nothing.
  The lattice's specials were far too rare to hang units on (1 civ in 24 held any Iron at turn 220), so worlds
  since save version 33 hold deposits (`Tile.deposit`, `scatterDeposits`: on land without a special, off the
  polar rows, a hash of the square and the seed picks a resource its terrain lists in `ResourceRule.deposits`;
  no RNG), each that resource's special (`specialOf`), drawn and yielding as one. Specials of one kind lie at least
  `SPECIAL_SPACING` (3) squares apart since save version 57 (asked for 2026-11-01: "sometimes many resources are near each
  other - set minimum distance between resources of the same type"; a third of Iron, Horses and Elephants had one of their
  kind next door, half within two, and Fish and Whales bunched along the sea's second lattice): `spreadSpecials`, after
  the deposits, keeps the lattice's first, then the deposits, in an order hashed from the square and the seed, and moves
  one too near to the nearest square that suits it and is clear of its kind, up to `SPREAD_REACH` (4) out (a deposit to a
  terrain its resource lies on, beside what it must be beside, at sea only at sea; a lattice special to its own terrain
  within its reach of land), else leaves it out: none of a kind within two squares of another, and about as many of each
  (Iron 8% fewer, 11% on large worlds, the rest under 4%). A seed's world is the same land, but its sites score anew, so
  the draws that follow differ: over 20 seeds 17 of 120 players start elsewhere and most city-states stand elsewhere. Saves before 57 load with `clusteredResources` (headless `--clustered-resources`). Head to head:
  planner vs v2, 16 x 300, seeds 1-16 and 17-32: spread 7-9 and 6-10, score 108 vs 99 and 101 vs 100, pop 44 vs 29
  and 43 vs 35; clustered (as version 56) 11-5 and 9-7, 108 vs 94 and 118 vs 99, pop 42 vs 30 and 49 vs 33; all replaying
  exactly. The planner loses its edge on the spread worlds (13-19 over the 32 seeds, against 20-12): not tuned for them
  yet (its swaps of spare resources may count for less with fewer of a kind on one civ's land). Since save version 69 (asked
  for 2026-11-04, with a picture of bison, elephants, horses and sheep side by side: "avoid too many resources near each
  other - set a minimum distance between resources") any two specials, of any kind, land or sea, lie that far apart, none in
  the 5x5 round another (`spreadSpecials`). There is no room for them all: a square of land in 8.5 held one, the most this
  leaves is about 1 in 13, and desert (1 in 3.8) and tundra (1 in 4.8) were fullest. So who claims room first decides who
  stays: the land's lattice specials and oil at sea (both few), then the land's deposits, the kinds taking turns (`Item.turn`:
  in one hashed order Camels kept 23%, with herds last almost none), last the sea's Fish and Whales, plenty of which give
  way to the land (claiming before it, they cost it a sixth of what it keeps), a moved one looking `SPREAD_REACH` (6) squares
  out (`CROWDED_REACH`, 4, before). A medium world, kept of what it had: Horses 34 of 51, Iron 26 of 48, Saltpeter 19 of 49,
  Coal 33 of 38, Elephants 19 of 28, land Oil 32 of 50, Bison 19 of 26, Camels 9 of 22, Sheep 14 of 26, Reindeer 8 of 13, Fish
  123 of 143, Whales 201 of 208, sea Oil and the lattice's land specials all (284 specials on land, 425 before; the counts
  given elsewhere here are from before). A land square's 21 hold 1.5 on average, 2.4 before; 4 or more 0.1% of the time, 21%
  before; 2 squares apart was no cure (73% still had one within two), 4 left under a third of what stood on land. Starts
  score 132 on average over 50 seeds, 136 before, none of 300 unfit; 127 of the 300 stand elsewhere. Saves before 69 load
  with `crowdedResources` (headless `--crowded-resources`). Planner vs v2, 16 x 300: seeds 1-16 7-9, score 85 vs 108, pop 33
  vs 37; seeds 17-32 11-5, 118 vs 80, pop 49 vs 31; crowded 11-5, 111 vs 89 (as version 68) and 8-8, 112 vs 111, so over the 32
  seeds 18-14, 102 vs 94, pop 41 vs 34, cities 7.9 vs 6.8, against 19-13, 111 vs 100, pop 49 vs 37, cities 9.3 vs 6.8; all
  replaying exactly (one seed set alone misleads: every world changes). Held at turn 150 (planner in every seat, 6 seeds):
  Horses 54% of civs (57% before), Iron 13% (35%), Coal 17% (26%), Elephants 8% (22%); at 200 Iron 29% (43%). Iron feels it
  most, on narrow hills and mountains shared with Coal and Saltpeter. Since save version 52 (asked for
  2026-10-31: "resources on tiles, like horses, should not give extra shields to the city") a strategic resource's
  square adds no shields, neither its own (Horses 2, Iron 3, Coal 2, Oil 1, Saltpeter 1) nor an advance's (Iron
  Working, Gunpowder, Refining): core `yieldingSpecial`, read by `tileYield`, the square's window and the research
  card's gains; Horses keep Animal Husbandry's food; the other specials keep their shields (Whales, Peat, Cotton).
  Saves before 52 load with `resourceShields` (headless `--resource-shields`). Head to head (planner vs v2, 16 x 300,
  seeds 1-16): with shields 10-6, score 174 vs 114, pop 58 vs 39; without 9-7, 135 vs 114, cities 9.8 vs 6.4, pop 54
  vs 37; all replaying exactly. At turn 150 about 86% of civs
  hold Horses and Iron, 58% Saltpeter, 67% Coal; Oil 50% by turn 220. Trades (`tradeResources`: we give
  `give`, they give `receive`, either alone a gift or a purchase; `endTrade` calls every trade with a civ off):
  a civ trades away only a square it holds and does not trade already, never what it was traded, so a trade can
  take its last; war ends trades (`declareWar`), and as every turn begins so does a giver's loss of what it
  gives (`settleTrades`; the `tradeEnded` event). In an audience, with Currency and not at war: resources in an
  exchange (see Diplomacy in apps/web: their spares we lack, the AI's `resourceOffers`, ours they lack, each a lasting
  trade, paid for each turn if agreed so, `ResourceTrade.pay`), a resource as a gift, End our trade (a demand). The
  planner swaps spares with other computer civs every third turn per pair (`manageResources`; spare: a second
  square, or one it has no use for yet, `spareResources`, `wantsResource`) and calls off a trade that gave away
  what it now needs. Shown in the build menu (faded, "needs Iron"; but a resource marked `unlisted`, Elephants, keeps its
  units out of the menu until the civ holds it, unless the city builds one already: asked for 2026-11-02, "dont show
  war-elephents until have elephents as resource"), the production box ("Needs Iron", Buy
  faded), the square's window ("Iron is needed for Legion, ..."), the civ card's Resources line and Advisors >
  Resources (since 2026-10-31, asked for: "improve the resources main window", its own page, the advisor kind
  `resources`: renderer-api `resourcesView`, retro `drawResourcesAdvisor`; before, the report page's grey rows of
  `resourcesReport`, which the set-aside modern renderer still shows): a band for each resource, its picture on a sunken
  tile (a question mark while unseen), its name, a badge in its colour (`RESOURCE_BADGES`: Held green, Traded in blue,
  Wants road amber, Traded away and None grey, Unseen dark), a line of where it lies, whom it comes from or what is
  missing, and the units that need it as their pictures (those we could build but for it lit, the rest faded, past
  five a count); then our trades, each with the other people's shield and its gold a turn, and the gold a turn all
  told. Saltpeter's sprite is the user's, as every resource's (`resources.art.ts`). Saves before version 33 load
  with `noResources` (headless `--no-resources`, `?resources=off`). Head to head (planner vs v2, 16 x 300, twice:
  seeds 1-16 and 17-32): without resources 1-15 both times, score 125 vs 228 and 135 vs 226; with them 0-16,
  121 vs 246 and 133 vs 261, all replaying exactly. The planner holds its level (pop 45 vs 51 a seat); v2, packing
  more cities onto the richer land, gains.
  Hidden resources (asked for 2026-10-28: "showing terrain resources only when relevant to the civ - when got the
  resource related tech"; save version 40): Iron, Saltpeter and Oil carry `ResourceRule.revealedBy` (Bronze Working,
  Gunpowder, Refining), as Coal does since save version 70 (Steam Engine, below), and a civ sees one once it knows that
  advance or the advance of any unit that needs it (`resourceRevealers`, `seesResource`: Chivalry's Knights want Iron
  without Bronze Working), whichever comes first; Horses, the 1991 game's own plains special, Elephants and all the other
  specials are seen from the start. Until then a square of it is plain terrain to that civ (`specialFor(state, tile, player)`, `tileAsKnown`;
  `specialOf` stays the square as it lies): not drawn (retro `drawSpecial` takes the viewer), no yield from it
  (`tileYield`'s `owner`, `influenceSpecials`), not held or tradeable (`resourceSquares`), not counted in a site's
  worth (`siteScore`'s `player`, the planner's and the settler pins'), absent from the square's window, the panel
  and `resourceAt(..., viewer)`. Advisors > Resources says "Shows on the map with Bronze Working". What an advance reveals
  (core `revealedBy(state, player, found)`: seen with it, unseen without) is a "Reveals" row on the research card
  and an unlock in the New Technology window (`Unlock.resource`, the resource's picture in the box; merged with the
  advance's gain on it, Refining's Oil +3; in a line "Phalanx, Colossus. Reveals Iron", `unlocksLine`). After those
  windows (and the research panel when due) the web app's `showReveals` holds the map a moment (`REVEAL_MS` 2.4 s,
  the `beat` screen) on the square nearest our capital, ours first, else one within 6 squares of our cities
  (`resourceReveals` in renderer-api), every seen square of it ringed in gold, pulsing twice
  (`MainScreenView.revealed`, retro `drawRevealRing`), the note "Iron revealed: 2 on our land, 3 nearby" or "none
  on our land yet"; with none near, or over another screen, the status line. A strategic resource we lack that
  our explorers or a growing border come upon is named in their note before the places ("Discovered: Iron, Lake
  Capua", `discoveryNote`'s `resources`; the web app's `resourceFinds` over `knownResourceSquares`, a just-revealed
  kind left to `showReveals`), even with place names off; since 2026-10-29 once a game, for the first square of it
  that comes to light (asked for: "no need to show each time a new resource has been found - only once for each
  resource"; `foundKinds`, the kinds of which a square is known, so a loaded game tells none it knew). Saves before version 40 load with `visibleResources`
  (headless `--visible-resources`). Head to head (planner vs v2, 16 x 300, seeds 1-16): hidden 10-6, score 208 vs
  179, pop 74 vs 73; visible 10-6, 213 vs 184, pop 77 vs 74; all replaying exactly.
  Coal joined them in save version 70 (asked for 2026-11-05: "why i see coal resource from the start - resources should be
  shown only when relevant - like iron", and of a list offering Horses, Elephants, Fish and Iron too, "change only the coal
  resource apperance"): left in view on 2026-10-28 as the 1991 game's special of the hills, it had done nothing at all since
  version 52 until the Ironclad wants it, 19 advances in. It shows with Steam Engine, or Industrialization's Transport; the
  Ironclad wants Iron as well, so Steam Engine shows that too to a civ yet to see it. A civ cannot trade it before. Starts,
  city-states and tribes stand where they did (`siteScore` with no player reads what lies there); only the planner's own
  sites feel it. Saves before 70 load with `visibleCoal` (headless `--visible-coal`; core `inPlainView`, which `revealedBy`
  reads too, so Steam Engine reveals no Coal there). Head to head (planner vs v2, 16 x 300): seeds 1-16 6-10, score 83 vs 103,
  pop 33 vs 35; seeds 17-32 11-5, 113 vs 74, pop 46 vs 29; so over the 32 seeds 17-15, 98 vs 89, pop 40 vs 32, cities 8.0 vs 6.6;
  Coal in view 7-9 and 11-5, 18-14, 102 vs 94, pop 41 vs 34, cities 7.9 vs 6.8, version 69's figures to the digit; all replaying
  exactly.
  Roads to resources (asked for 2026-10-29: "make roads for resources mandatory for them to be available"; save
  version 43): a square of a strategic resource serves its civilization only with a road or railroad on it
  (`resourceRoaded`; a city's own square has one), so held, traded and counted for builds only then
  (`resourceSquares`, with `all` every square on the land; `ResourceHolding.unroaded`). A river through the square
  serves as its road (asked for 2026-10-30: "if resource have river on its tile - can be reached as a road"; save
  version 48), so a river square never waits for Bridge Building; the square's window says "The river carries it, as a
  road would", and Advisors > Resources "A square serves with a road or river on it". Saves before 48 load with
  `riverNeedsRoad` (headless `--river-needs-road`): a river square wanted its road, which waits for Bridge Building.
  The planner's settlers build the road (`unroadedResources`, a job of
  value 7 where it lacks and wants the resource, 3 where it lacks it, 2 where it holds it already). Told in the
  square's window ("No use to anyone until a road is built on it"), Advisors > Resources ("Wants road: 1 square near Rome
  wants a road: build one to use it", "2 squares near Rome; 1 more wants a road"), the reveal note ("2 on our land (1 wanting a road)") and the build menu
  (`resourcesWantingRoads`, `roadNote`, one line however many, asked for 2026-10-31: "keep in one text line", then
  "too short now": "Our Iron lies unused: build a road on its square", "Our Iron and Horses lie unused: build roads on
  them", past two "Our Iron, Horses and 2 more lie unused: build roads on them"; the menu's `oneLine` widens the
  window for it, and the phone takes its smaller words where the large ones would break it; a window sizes itself by
  its lines' widths as they wrap, so a line that sets its width never breaks by a rounded pixel either). Saves
  before 43 load with `roadlessResources` (headless `--roadless-resources`). Held at turn 150 (planner in every
  seat, 6 seeds): Horses 79% of civs (92% without roads), Iron 67% (63%), Coal 46% (63%). Head to head (planner vs v2,
  16 x 300, seeds 1-16): roads 10-6, score 217 vs 183, pop 77 vs 72; without 10-6, 212 vs 180, pop 75 vs 74; all
  replaying exactly. Rivers as roads (at Prince with city-states, 16 x 300): 8-8, score 160 vs 122, pop 59 vs 37,
  cities 10.9 vs 6.7; river squares wanting roads as before 8-8, 158 vs 124, pop 58 vs 38; all replaying exactly.
  Seafaring, Archery and War Elephants (asked for 2026-11-01: "harbor, fishing boat - to extract food from fish tiles,
  explorer, archer, war elphents - if any elphent resource available", then "do only 1 (Seafaring) and add Elephants and
  Archers - see if need to add new tech"; our departure, after Civilization II; save version 53): two advances in the
  extended tree, Archery (a root) and Seafaring (Pottery, Map Making). Seafaring brings the Harbour (60 shields, 1 gold;
  only by the sea, `BuildingRule.coastal`; +1 food on each ocean square its city works, `oceanFood`, added in
  `cityTileYield` after the government's -1), the Explorer (0/1/1, 30, sight 2, ignores zones of control; the
  `explorer` flag: every step costs it a road's third, `stepCost`, it climbs mountains without a road, `canEnter`, and
  no one minds it on their land, `trespassOn`) and the Fishing Boat (0/1/2, 30; the `fishing` flag: the `fishery`
  command, `whyNoFishery`, spends it on a Fish or Whales square of its own civilization's land with moves left, laying
  `Tile.fishery`, which adds its special's `SpecialRule.fishery` (core `fisheryYield`): Fish +1 food (and +1 shield since
  save version 60, below), Whales +1 food +1 shield; F or the orders' "Lay fishery"). Since save version 54 (asked for 2026-11-01: "fish should give extra food only with fishing
  boat placed on top") Fish feed a city only once fished (`fishery.unlocks`, core `specialLocked`, read by `tileYield`,
  so city screens, the planner and `siteScore` follow): plain sea before (1/0/2), 4 food after; the square's window
  says what a fishery would bring; the planner sends a boat to any fish of a city's, worked or not. A site is still
  scored with fish as they fed a city before (`siteScore` reads the rules as `freeFish`), so starts and the computer
  players' sites stay put: scored as plain sea they cost the planner two cities a seat. Saves before 54 load with
  `freeFish` (headless `--free-fish`): Fish yield as they lie, a fishery adding its 1. Whales are unchanged. Head to head
  (planner vs v2, 16 x 300, seeds 1-16): 9-7, score 123 vs 99, cities 8.8 vs 6.0, pop 46 vs 31 (fish fed both less;
  free fish 10-6, 143 vs 112); all replaying exactly. Since save version 60 (asked for 2026-11-02: "fish with fishery
  should get more than regular water with harbour - more food or production") the fishery on Fish adds a shield too
  (`fishery.shields`, `shieldsSince` 60): fished Fish under Despotism had yielded 3 food 1 trade, the plain sea with a
  Harbour 2 food 2 trade, as much all told; now 3/1/1 (4/1/1 under a Monarchy, a Harbour adding its food and trade to
  both). Saves before 60 load with `foodOnlyFishery` (headless `--food-only-fishery`). Head to head (planner vs v2, 16 x
  300, seeds 1-16): 10-6, score 95 vs 75, pop 41 vs 24; food only 10-6, 95 vs 75, pop 40 vs 24 (fisheries are rare in
  the computers' games); all replaying exactly. Archery brings Archers (3/2/1, 30, no resource, retired by Gunpowder). War Elephants (4/1/1,
  40, Horseback Riding) need the sixth strategic resource, Elephants (`ELEPHANTS`, seen from the start, Animal
  Husbandry's +1 food like Horses): deposits on jungle and on grassland or plains beside jungle (`ResourceRule.besides`;
  7%, 5%, 5% of such squares; appended after the other resources' slices, so every other deposit lies where it did),
  about 11 squares a small world, held by half the civs at turn 250. A unit built from the resource its attacker
  `frightens` (Horses: riders, chariots, knights) defends at two thirds against it (`FRIGHTENED` in `defenseStrength`,
  so `attackOdds` and the planners count it). Older games keep what they knew: each new rule carries `since` 53 and a
  save before loads with `catalogue` (its version; `inCatalogue`, `advancesFor`, `resourcesIn`, `scatterDeposits`'s
  `catalogue`; headless `--catalogue 52`), so it has none of them, and its log replays as it was. The planner researches
  Seafaring after Pottery and Archery next (Archery first of its war goals), builds a Harbour where a city works two ocean
  squares, a fishing boat for the fish or whales a city works (one a city at a time; `orderFishingBoat` lays it or sails
  for the nearest unfished square, else disbands), an explorer as its scout while land is unexplored (`orderExplorer`),
  and Archers and Elephants by `bestUnit`'s scores. Head to head (planner vs v2, 16 x 300, seeds 1-16): with them
  10-6, score 143 vs 112, cities 10.2 vs 7.0, pop 58 vs 39 (with Archery researched before Seafaring 11-5,
  144 vs 113); catalogue 52 9-7, score 135 vs 114, pop 54 vs 37; all replaying exactly. Over 6 all-planner games of 250
  turns: 26 Archers, 2 War Elephants, 4 Fishing Boats and their fisheries, 1 Harbour, no Explorer (the planner
  reaches Seafaring late, most of the game on its war goals against the city-states). Pictures: the four units' are the
  user's (see Unit pictures; `UNIT_PICTURES_WANTED` is empty, retro `UNIT_ABBR`'s letters stand in only where no
  picture is laid); the Harbour's too since the sheet of improvements (see Improvement pictures; `BUILDING_PICTURES_WANTED`
  is empty, `PICTURES.harbour` the fallback); the advances wait for theirs (`TECH_PICTURES_WANTED`): Archery and Seafaring the New Technology frame's bed (Elephants
  have the user's icon since their resource sheet of the same day); a fishery is the user's net since 2026-11-02 (see Tile improvement pictures; before, drawn in code, retro `fishery.ts`: two stakes, a sagging net, red and
  white floats). The Resources advisor's bands close up to fit six (`TRADES_ROOM`). The loader took versions 1-48 and
  the current one only, so saves of 49 to 51 had been refused since; it now takes every version up to `SAVE_VERSION`.
  Oil at sea and oil rigs (asked for 2026-11-01: "add oil for water and also all the tile improvements that would be
  added on top", then "add the new needed rules"; save version 55): Oil also lies at sea (`ResourceRule.offshore`: 1% of
  open sea without a special within 2 squares of land, about 15 squares a small world to land oil's 18; `scatterDeposits`
  rolls the sea squares the land's deposits never took, so every land deposit, and every start, lies where it did).
  Hidden until Refining as land oil is. A square of it serves its civilization only with an oil rig on it (`Tile.rig`),
  the sea's road (`resourceRoaded`): a Fishing Boat builds one in its own waters once its civilization knows Refining
  (the `rig` command, `whyNoRig`: "no oil", "has rig", "needs:refining", "not our waters"; the boat is spent, after
  Civilization IV's work boat; F or its orders' "Build oil rig"), and the rig adds a shield to the square
  (`offshore.rig.shields`, as a mine does; the oil itself adds none, see version 52). Told as roads are: the square's
  window ("No use to anyone until a Fishing Boat builds an oil rig on it", "Oil rig +1"), Advisors > Resources (badge
  "Wants rig", "1 square near Rome wants an oil rig: a Fishing Boat builds one", `ResourceHolding.unrigged`), the build
  menu (`rigNote`: "Our Oil lies unused at sea: a Fishing Boat builds a rig") and the reveal note. The user's picture
  of a rig since 2026-11-02 (see Tile improvement pictures; before, drawn in code, retro `rig.ts`: a steel deck on four
  legs in foam, a derrick and a flare; the oil's icon steps aside under it), the oil at sea an icon of its own, a slick with bubbles (`offshore_oil` in the user's resource sheet of the same day;
  retro `drawSpecial` picks it on the sea, `specialSprite` joining a name's words). The planner's
  fishing boats build the rig on oil their civilization lacks (`rigSpots`), and its cities build a boat for one;
  rarely seen: no planner civ knew Refining by turn 300 in 6 all-planner games, and given it at turn 150 one rig went
  up by 250 (8 of 24 civs knew Seafaring, 8 squares of sea oil lay in anyone's waters). Saves before 55 load with
  `catalogue` (their version; headless `--catalogue 54`). A site counts no oil at sea (`siteScore`), so
  starts and city-states stand where they did (scored +2 as any special, it had moved city-states). Head to head
  (planner vs v2, 16 x 300, seeds 1-16): 9-7, score 122 vs 99, pop 46 vs 31; catalogue 54 9-7, 123 vs 99; all
  replaying exactly.
  The sea's trade (asked for 2026-11-02: "water tile trade - reduce. will be added with harbour"; our departure, save
  version 58): an ocean square yields 1 trade (`TERRAIN_RULES` Ocean; the original's 2 kept as `originalTrade`), and a
  Harbour adds the second to each ocean square its city works (`BuildingRule.oceanTrade`, core `oceanTrade`, added in
  `cityTileYield` with its food), so a port with one has the sea as before plus the food (2 food, 2 trade) and a port
  without one little use for it. Before, the sea was 9 to 17% of the squares the planner's cities worked but 26 to 44%
  of their trade, and 1 city in 223 had a Harbour at turn 200 (6 all-planner games). A site is scored with the sea's 2
  trade, as a port has it in the long run (`siteScore` reads the rules as `richSea`), so starts and the computer
  players' sites stay put. Told in the square's window ("Improvements: Harbour +1 food +1 trade") and the Building
  Completed window (a line each). The planner counts a Harbour's trade on each square (`slotValue`), wants one for the
  sea its city could work, up to half its people (`wantBuilding`; it had counted the sea worked, which a port without
  one hardly works now), and a civilization with half its cities or more by the sea (`maritime`) researches Seafaring
  straight after the Alphabet (`MARITIME_GOALS`; its war goals still come first when threatened). Over the same 6
  games: total trade at turns 50, 100, 150 and 200 is 68%, 88%, 89% and 127% of before, Harbours 0, 0, 6 and 57 (in
  226 cities). Saves before 58 load with `richSea` (headless `--rich-sea`). Head to head (planner vs v2, 16 x 300,
  seeds 1-16): 10-6, score 95 vs 74, pop 40 vs 24, techs 19.4 vs 14.9 (Seafaring in its old place: 8-8, 93 vs 81); rich
  sea 7-9, 108 vs 99, techs 24.0 vs 20.8, as version 57; all replaying exactly. Research runs about a fifth slower for
  everyone (v2 builds no Harbour).
  Herds (asked for 2026-11-03 with the user's updated sheet of resources: "sheep cotton silk - would get bonus with weaving
  tech", "sheep, bison, dear camel, seal - would get food bonus with husbandry tech"; save version 61): `HERDS` in
  `rules/resources.ts`, bonus resources: Sheep on plains (+1 food; Animal Husbandry +1 food, Weaving +1 trade: 2/1/0, 3/1/1
  with both), Camels in the desert (+1 food +2 trade; Animal Husbandry +1 food: 1/1/2, 2/1/2) and Bison on grassland (+1
  shield, as grassland's Resources gave before save version 26, its picture the bison; Animal Husbandry +1 food: 2/1/0,
  3/1/0). Cotton and Silk had Weaving's gains already, Game (the deer) and Seals Animal Husbandry's. A special carries one
  advance's gain or a list (`SpecialRule.learned`, read with `learnedOf`: `tileYield`, `yieldingSpecial`, the research
  card). They lie in deposits as the strategic resources do (`Tile.deposit`; a `DepositRule`, looked up in `DEPOSIT_BY_ID`
  by `specialOf`), rolled after the strategic resources' slices (`scatterDeposits`: Sheep 6% of plains without a special,
  Camels 10% of desert, Bison 4% of grassland) and spread last (`spreadSpecials`, never onto a square another special
  moved to), so every other special lies where it did: about 13 sheep, 9 camels and 10 bison a small world (27, 22 and 23
  medium). Seen from the start; no unit needs them, no one holds or trades them (`RESOURCE_BY_ID`, `isStrategic` and the
  Resources advisor know only the strategic). The research card and the New Technology window name the deposits' gains
  too (Animal Husbandry: Horses, Game, Seals, Elephants, Sheep, Camels, Bison; Weaving's trade: Silk, Sheep), and the
  square's window counts our advances' gains in and names those to come ("Sheep +1 food; Animal Husbandry +1 food,
  Weaving +1 trade"). Sites count them (`siteScore`), so over 20 seeds 17 of 120 players start elsewhere (26 on medium
  worlds). Saves before 61 load with `catalogue` (their version; headless `--catalogue 60`). Head to head (planner vs v2,
  16 x 300, seeds 1-16): 8-8, score 111 vs 97, pop 46 vs 35, techs 21.6 vs 19.9; catalogue 60 10-6, 95 vs 75, pop 41 vs 24
  (as version 60); all replaying exactly. The herds feed everyone; v2, working whatever its cities hold, gains more.
  Tundra (asked for 2026-11-04: "on tundra tile: also should reduce HP for units until have weaving tech", "need to place a
  resource that could provide some food and production"; save version 68): it wears units down as the arctic does, at the
  desert's 10% (`TerrainRule.attrition`, its `since` 68; Weaving ends both, Medicine on the 1991 tree; told by the square's
  window and the research card as the others are), and Reindeer roam it (`HERDS`: +1 food +1 shield, Animal Husbandry +1
  food: 2/1/0, 3/1/0, as Bison on grassland; seen from the start), the only shields on land that can be neither irrigated
  nor mined. 10% of tundra without a special (at 12% `spreadSpecials` lost up to a fifth of them on tundra's thin bands),
  rolled last: about 5 a small world, 13 medium, 34 large, 7 and 15 on Earth; tundra with a resource 12% before, about 20%
  now, and each such square spares units the wear. No picture of their own yet: the Game's deer stands in, picture and mark
  (retro `BORROWED_ICONS`; asked for: "use for now the regular dear we already have"). Since the same version a resource
  still hidden from a civilization spares its units nothing (`HIDDEN_WEAR_SINCE`: `attrition` asks `specialFor`, not
  `t.special`): the square's window saying no Harsh gave the resource away, on desert and arctic too, and tundra holds them
  on 11% of its squares. Sites count Reindeer (`siteScore`): over 20 seeds 1 of 120 players start elsewhere, small or
  medium, and 40 of 160 city-states stand elsewhere (115 of 240 medium). Saves before 68 load with `catalogue` (their
  version; headless `--catalogue 67`). The wear hardly touches the computers: about 0.1% of their land units' turns end on
  wearing tundra, and few learn the cure (2 to 8 of 64 civs by turn 300: Weaving comes after Medicine in the planner's
  goals), so it is the player's explorers and long marches that feel it. Head to head (planner vs v2, 16 x 300, seeds
  1-16): 11-5, score 111 vs 89, pop 47 vs 34, cities 8.9 vs 6.4, techs 20.5 vs 17.1; catalogue 67 7-9, 99 vs 100, pop 40 vs
  38 (as version 67); all replaying exactly. Before the hidden resources' fix, which changes almost nothing, the same games
  came out 9-7, 107 vs 98, so read the gap as much for noise as for an edge.
