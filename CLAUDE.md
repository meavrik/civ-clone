# Epochs (repo: civ-clone)

Browser reimplementation of a 1991-style 4X empire game: same rules and
320x200/256-colour presentation, all artwork and text original. Working title
"Epochs", but the opening and title name the game "Civilization" (the user's call, 2026-10-22).
Never ship the original's sprites, palette art, fonts or text.

## Commands

- `npm run dev` — Vite dev server for apps/web (http://localhost:5173)
- `npm run dev:mobile` / `build:mobile` / `preview:mobile` — the phone app (apps/mobile, http://localhost:5180, on the LAN too)
- `npm test` — vitest, all packages (50+ tests; render tests dump PNGs to `packages/renderer-retro/tests/out/`)
- `npm run typecheck` — `tsc -b` across the workspace (strict, exactOptionalPropertyTypes, noUncheckedIndexedAccess)
- `npm run build` — typecheck + Vite build
- `npm run headless -- --games 4 --turns 200 --civs 4 [--every 25] [--ai baseline,planner] [--world earth [--historical]] [--size medium] [--classic-terrain] [--open-mountains] [--work-beyond-borders] [--difficulty D] [--human] [--verify] [--json out.json]` —
  seeded all-AI tournaments (`tools/headless`); `--verify` replays each game from its save and checks the state digest
- `npm run maps [-- europe]` — rebuild the premade worlds from Natural Earth data (`tools/maps`, cached in `tools/maps/.cache`,
  previews in `tools/maps/out/<world>-<size>.png`; look at them after any change)
- npm and pnpm both work (`workspaces` + `*` deps, `.npmrc` links workspace packages for pnpm); `package-lock.json` is
  the one lockfile (a committed `pnpm-lock.yaml` would make Netlify install with pnpm, and it went stale)
- Netlify (site civ-clone, https://civ-clone.netlify.app) builds the mobile app from `main` on every push:
  `apps/mobile/netlify.toml` (package directory apps/mobile, publish `apps/mobile/dist`, Node 22)

## Layout

- `packages/core` — deterministic game engine, zero DOM. Rules as data in `src/rules/*`
  (terrain, units, buildings, wonders, advances, governments, civs). Map gen (`map/generate.ts`), premade
  worlds (`map/premade.ts` + generated `map/worlds/*.ts`: per world size, rows of terrain chars, upper case = river,
  and each native civ's homeland square), cities,
  combat, pathfinding, diplomacy, barbarians, save/score. Entry: `src/index.ts`.
  World sizes (`WORLD_SIZES` in `types.ts`, `NewGameOptions.size`; our departure, asked for): small is the
  original's 80x50 (and every game without a size), medium 120x75, large 160x100, all 8:5 so the retro
  minimap stays 80x50 pixels (`minimapScale`: a pixel per block of squares, land shown over sea). Never
  read `MAP_WIDTH`/`MAP_HEIGHT` for a game's map: use `map.width`/`map.height`. Bigger generated worlds
  are the same world drawn finer (walks, noise, rivers and start spacing scale with width / 80, small
  unchanged); premade ones are rasterised at each size by `tools/maps` (`scaleFrame` stretches a frame's
  breakpoints, given in the original's squares).
  Premade landmasses stay apart (asked for: Britain had touched France): each Natural Earth land polygon
  is a landmass (`landmasses`, pieces cut at 180 degrees joined), each square goes to the one covering
  most of it, and where two touch, side or corner, `separateLandmasses` sinks one (never an ice row or
  a homeland's square, never one that would cut its landmass in two; an island of half a square or more
  keeps its last square if that costs its neighbours less land; else the smaller landmass yields). The
  polar ice rows are a landmass of their own (Antarctica's in the south). `npm run maps` throws if any
  land joins two landmasses (`mixedLandmasses`). Saves before version 13 on premade worlds load with
  `joinedIslands`: the old grids, kept as per-size diffs (`PremadeGrid.joinedIslands`) that the tool
  derives from the frozen `tools/maps/legacy/joined-islands.json` (never rebuild that file). Setup asks the size after a premade world and first in
  "Customize world"; "Start a new game" plays the original's size; `?size=large` in the web app.
  Generated worlds: land from random-walk chunks, terrain from the climate (`climateWorld`): smooth
  heat and rain fields that wrap east-west, rain in latitude belts and on prevailing winds that dry out
  over land and mountains (rain shadows), ranked so biome shares stay steady; mountains on noise ridges
  with hills as foothills; lone squares join their neighbours; rivers rise in wet highlands and run
  to the sea. `scatteredTerrain` keeps the first per-square generator for saves before version 6.
  Starts (`newGame`): drawn at random on grassland or plains of a big landmass, spread apart, then each
  moved onto the best city site (`siteScore`, `sites.ts`, the planner's score moved to core) within
  `START_NUDGE` (2) squares on the same land (asked for 2026-10-23; no randomness, so a seed keeps its
  world and its draws; historical homelands stay). Starts score 126 on average over 50 seeds (109 as drawn),
  none unfit for a city (3 of 350). Saves before version 25 load with `randomStarts` (the squares drawn).
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
  yet (its swaps of spare resources may count for less with fewer of a kind on one civ's land). Since save version 52 (asked for
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
  Gunpowder, Refining), and a civ sees one once it knows that advance or the advance of any unit that needs it
  (`resourceRevealers`, `seesResource`: Chivalry's Knights want Iron without Bronze Working), whichever comes first;
  Horses and Coal, the 1991 game's own plains and hills specials, are seen from the start, as are all the other
  specials. Until then a square of it is plain terrain to that civ (`specialFor(state, tile, player)`, `tileAsKnown`;
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
  Paid (`cityStateTribute`), that city-state leaves the payer be for 20 turns (`state.cityStatePeace`,
  `peaceUntil`/`boughtOff`: its units may not strike the payer's), until the payer strikes it (`breakPeace`). Taken,
  it is a city-state no more (`endCityState`); its soldiers fight on as barbarians. The planner pays while its
  treasury keeps its cushion after. Told by name: the web app's "Knossos Demands Tribute" window (Pay, or Refuse by
  default; `cityStateDemandCard`), the news, the conquest window ("Taken from the city-state of Tyre", "Burned by
  ..."), fights ("Legion of Tyre attacks!", `BattleSide.cityState`, `unitTitle`), the square's window ("Tyre (a
  city-state of the Phoenicians)", "Land of Tyre"); the barbarians' land bears no civ name on the maps. The first time
  the player comes upon each city-state (`cameUpon`; asked for 2026-11-03: "when encouter a city-state add a small
  notification explanation about it"), the map glides to it (its city, else its soldier in sight) and a small window
  stands by it pointing at it (renderer-api `cityStateIntro`: "Petra, a City-State", three lines: a lone city of its
  people at war with all, it raids unless paid, click it to buy peace or take it; the web app's `newCityStates`,
  `introduceCityState`, a `cityStateMet` item of the news, `News`, before what it demands; a loaded game knows those it
  had come upon, `metCityStates`). Peace is bought unasked too (asked for the same day: "allow clicking each city-state
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
  Civilization traits (our departure, asked for: the original's civs were alike): each `CivRule.trait`
  in `rules/civs.ts` has a name, a few words for the tribe choice (`short`), a line of text, an
  advance it starts with (a root advance) and `TraitEffect`s (cheaper builds, faster settler jobs,
  science/tax/corruption, content, growth (food kept, smaller food box), veterans, moves, short
  anarchy, friendly villages). `traits.ts` answers each kind; `costFor` is a production's cost for its owner (use it, not
  `productionCost`, for anything a city pays). `classicCivs` (old saves before version 5,
  `?civs=classic`, `--classic-civs`) turns them all off. Tests of base rules play classic civs.
  Each civ also has `CivRule.text`, the people in a sentence of our own, and a `veteran`/`moves` effect
  naming unit types carries `who` ("Foot soldiers") for the words.
  Diplomacy (`diplomacy.ts`): civilizations meet face to face (`contactRange` 1, as the original), and
  the unit that walked into the meeting stops for the turn, on a goto too (`meetAround`), so each side
  sees whom it met; a civilization sees its land and a square beyond it (Sight below). Meeting leaves them in contact, no treaty
  (`Relation` "contact", `metRelation`; asked for 2026-10-20): neither may attack before `declareWar`,
  and `openBorders`/`shareMaps` wait for a peace treaty (`makePeace`, `atPeace`); a computer leader's
  envoy offers one with `offerPeace` (`state.peaceOffers`, a `peaceOffer` event the player answers with
  `makePeace` or not at all). Influence (asked for): `civInfluence` is the culture of all a civ's cities;
  `esteem(judge, of)` weighs it against the judge's own (`INFLUENCE` in `rules/culture.ts`: admired at 1.5x,
  scorned at half, both sides counting 10 more), and the AI's `attitude` reads it. Saves before version 15
  load with `peaceOnContact` (meeting made peace at once). Land (`territory.ts`: `claims`, `landOwner`):
  each city the squares within its border, which grows with its culture (`borderRadius`: 1 square out
  when founded, one more at each of `CULTURE.levels` in `rules/culture.ts`, radius 2 being the 21 squares
  it works); a shared square goes to the nearer city, then the one with more culture, then the older
  (`claimant` names the city, `landOwner` its owner). The levels are 4, 12, 24, 40 since save version
  28 (asked for 2026-10-24, "unbalanced city and culture growth": the first levels, 8/16/28/45, kept a
  young city to its 8 squares until size six with a temple, which starved it; now the capital has its 21
  squares at size three (its palace's 1 culture), another city at size four, or two with a temple; saves before 28 load
  with `slowCulture`, headless `--slow-culture`; 6 planner games x 250 turns: pop 47 vs 40 a seat,
  techs 25.7 vs 22.5, score 142 vs 112). Until save version 36 the palace gave 3, so the capital had its 21
  squares the day it was founded (asked for 2026-10-27: "influence growth at first city is instant - shouldnt
  be"; saves before 36 load with `wideCapital`, `CULTURE.widePalace`, headless `--wide-capital`; read a
  building's culture with `buildingCulture`). Influence yields (same version; asked for: "whales or other
  resources can't be reached by a city, so think of other value they can provide when in the city
  influence"): a special inside a city's border but beyond the 21 squares it can work (whales in deep
  water, anything in its outer rings), claimed by that city and worked by no one, brings it half the
  resource's trade a turn, at least one (`influenceSpecials`, `INFLUENCE_YIELD`, `CityReport.influence`;
  the city screen's "Influence +N" line, the square's window "In Rome's influence: +1 trade"); nothing
  before the border reaches 3 squares out; saves before 28 load with `noInfluenceYields` (headless
  `--no-influence-yields`).
  A city's culture is what it holds now (`cityCulture`: one per citizen, `BuildingRule.culture` from palace,
  temple, library, courthouse, colosseum, cathedral and university, and each wonder), never more turn after
  turn (asked for), so it falls when the city shrinks or loses a building; a `borders` city event says when
  the border grows; the city screen shows culture against the next level. A city works only squares of
  its own land (asked for 2026-10-21; `slotInLand`: within its border, on land its civilization holds, so a
  new city has the 8 round it until its culture reaches the first level); `slotAvailable` and both AI
  planners' `slotFree` read it, `dropLostSquares` moves workers off squares lost since as the owner's turn
  begins, and the city screen shades the squares beyond and rings the city's land in its owner's colour
  (a click there says "Beyond Rome's border"). Saves before version 16 load with `workBeyondBorders`
  (headless `--work-beyond-borders`). Head to head (planner vs v2, 16 x 300 turns): old rule 9-7, score 144 vs
  131, pop 59 vs 51; new rule 12-4, score 129 vs 94, pop 49 vs 36 (cities grow slower; v2 suffers more).
  Saves before version 14 load with
  `accruedCulture`: `City.culture` gathered every turn (`cultureRate`, frozen numbers in `ACCRUED_CULTURE`). Met and not at war, without open borders
  (`openBorders`/`closeBorders` commands, `state.openBorders`) a civilization minds land units on its
  land (`trespassOn`: not diplomats, caravans or units aboard): stepping in, or being found there as the
  owner's turn begins, notes the units (`noteTrespass`: `state.trespass` with `warnings` 0, a `trespass`
  event), and they have a turn to leave before the first demand (asked for 2026-10-27: "wait for another turn
  before asking to go away"; saves before version 37 load with `askOnEntry`: stepping in was the first
  demand); `demandLeave` adds one, a gift (`giveGold`) forgives, and the record drops at the owner's turn once
  the units are gone. Other deals: `tribute` (`tributePaid`); `shareMaps` stays for the logs that hold it (the
  audience no longer offers maps, asked for the same day). Gold between civilizations (same day: every gift
  and price was 50 gold, "make the money tribute more sophisticated"; `rules/diplomacy.ts`): what gold is worth
  to a realm (`goldScale`: 20, half its treasury, 5 a citizen) prices the leaders' deals and weighs gifts;
  `giveGold` keeps each gift (`state.gifts`, `recordGift`: gold and its share of the receiver's worth), and gifts
  within `GOODWILL.turns` (20) worth half its worth all told leave its leader a step warmer (`goodwill`, read by
  the AI's `attitude`; saves before 37 load with `noGoodwill`). The AI never gives gold, so neither changes
  all-AI games (planner vs v2, 16 x 300: identical, 3-13, score 140 vs 199). A computer leader's demands and
  requests (asked for 2026-10-27: "let computer leaders use the new diplomacy on you"): its `demandTribute` and
  `askResource` commands leave a `Proposal` standing (`state.proposals`, "asker>asked"; a `proposal` event;
  `state.asked` spaces them), which the player answers with `answer` (yes: the tribute paid, `tributePaid`, or the
  resource traded and their gold taken; no: a refused tribute is kept, `state.refusals`); an unanswered one lapses
  as the asker's next turn begins. `giveGold` says so (`gift` event). Saves before version 38 load with
  `quietLeaders`. `warDeclared` says who declared on whom (`on`) and why (`reason`: trespass, tribute, alliance).
  Pacts and alliances (asked for 2026-10-29: "add alliance against other civ option", "add a non-aggression pact
  option"; save version 41, `PACTS` in `rules/diplomacy.ts`): a non-aggression pact (`makePact`, `state.pacts`:
  the turn it runs out, `pactUntil`/`hasPact`) bars war on either side for `PACTS.pactTurns` (20), then ends with
  a `pactEnded` event as a turn begins (`endPacts`); an alliance (`ally`, `state.alliances`: `Alliance.against`)
  makes a treaty between the two if they had none and takes whichever of them is not yet at war with the enemy
  to war (`warDeclared` reason alliance); allies may not declare war on each other and do not mind each other's
  units (`mindsTrespass`), and a separate peace with the enemy ends the alliance (`leaveAlliances`, the
  `allianceEnded` event; the web app's `makePeaceWith` says so), as does the enemy's fall. `declareWar` is
  refused while either binds (`warBarred`: "pact", "allied"). Only the player proposes them, in an audience's
  proposals ("Non-aggression pact", "Alliance against..." then the enemy, from those both know and the player
  may make war on: `allianceTargets`); the AI answers (`pactAnswer`: yes unless hostile or at war, for
  nothing; `allianceAnswer`/`allianceRefusal`: no when hostile, bound to the enemy, at peace with it by treaty
  and not friendly, or not yet at war with it while the two together are weaker; else yes if already at war
  with it, friendly yes, wary for `alliancePrice` gold), keeps an alliance (no separate peace: `acceptsPeace`
  and its own peace-making pass the enemy by), counts an ally a step warmer (`attitude`), and passes bound
  civs by for wars of choice. Computer pairs never make either, so all-AI games are unchanged.
  Saves before version 10 load with `farContact` and `noTrespass` (meeting at two squares, no stop),
  saves before version 12 with `fixedBorders` (each city its 21 squares, the nearer then older winning).
  Sight (`visibility.ts`; asked for 2026-10-24: "an area of observability: one tile beyond the empire's
  influence and borders + surrounding each unit outside the borders; some units can have a bigger
  observability; in this area the player should see every other civ's activity and units"): `Player.visible`
  is a civilization's land (`claims`) and one square beyond it all round (`landSight`, cached until a city
  is founded, lost or changes culture), and the squares round each unit as far as its sight (`unitSight`:
  one; two for warships and aircraft, as in the original, and for horsemen (`cavalry`) and diplomats, our
  departure, `sightSince` 30). What it sees it has explored, so a growing border uncovers land. Foreign
  units show only there (map, minimap, the square's window, the other civs' playback); a city taken or
  bought away leaves its old owner's sight at once. Saves before version 30 load with `narrowSight`
  (headless `--narrow-sight`): round units, scouts one square out, and the squares next to cities.
  Head to head (planner vs v2, 16 x 300, version 29 upkeep): narrow sight 0-16, score 133 vs 237; this
  sight 1-15, 127 vs 229, both replaying exactly, ~5% slower.
  Places (`map/geography.ts`, `rules/places.ts`; asked for 2026-10-25: "names for great masses of land or
  water, like the great desert of..., lake x, the sea of..., x mountains; the name could be driven from the
  civ or leader who discovers them first; on the premade maps give the real names"): `WorldMap.geography`
  puts each square in up to two places (`Region`: kind, size, name, `by`, `turn`): a water body or landform
  (`place`: ocean, sea, bay, lake; desert, mountains, hills, forest, jungle, swamp, tundra, ice) and, on
  land, a continent or island (`land`). A generated world finds them from its terrain as dealt
  (`findGeography`, in `generateMap`): water bodies up to `PLACES.lakeMax` are lakes, to `inlandSeaMax`
  seas, the open water cut into basins round centres picked from the water furthest from land,
  `basinSpacing` apart through the water (small ones merged; ocean, sea or gulf by how much is open
  water and size), landforms are pieces of one terrain (mountains with hills a range) of at least a size,
  the polar rows an ice field, land pieces continents from `continentMin`. The first civilization to
  explore a square of a place (`discoverSquare`, from `revealAround` and the land sight; `discoverExplored`
  after the map is revealed at once) discovers it, and a place without a name takes one of the discoverer's own
  (`placeNames`): since 2026-10-26 (asked for: "more creative - a list of real earth and fantasy known worlds
  names - each civ would own its own land masses names") each civ's lists in `rules/civ-places.ts`
  (`CIV_PLACES`, `CivRule.places`): lands (its homeland first, then the lands of its legends and its world:
  Hellas, Hyperborea, Atlantis; Midgard, Vinland, Asgard), waters (the Sea of Ran, the Gulf of Ginnungagap,
  Lake Moeris) and wilds by the landform they suit (the Pomptine Marshes, the Great Gobi Desert), written by
  each kind's `PLACE_RULES.own`; old myths and real places only, no modern books' worlds (theirs to name).
  Each own name goes to one place before any goes to a second (a landform borrowing its civ's other kinds'
  names first), then again written for the new kind, then after its leader, adjective or cities ("Lake
  Caesar", "the Great Desert of Hammurabi", "Shaka's Land"); never the barbarians. The starting lands are
  named as the game begins, the player's first, so a homeland two peoples share bears the first's name. A premade world carries its real places (`PremadeGrid.places`, a `PlaceTable`: names
  per layer and rows of one `PLACE_CHARS` character a square; `premadeGeography`), drawn by `tools/maps`
  (`places.ts`). A landform shows on a square only while its terrain still fits (`placeAt`, `landAt`).
  Nothing in the rules or the AI reads places: no RNG, no save version (old saves replay and name them).
  The map writes one name at a time (`placeLabel` in renderer-api; asked for 2026-10-25: every place on
  view was "too crowded", then the places near every unit still were: "show only 1 at a time - the closest
  to the unit"): the place nearest the unit in play (none while no unit of ours is in play), from the
  explored squares on view within `NAME_REACH` (2) of it, its own square's sea or landform before the land
  under it (the Alps before Europe), a tie to the bigger place; written where the place's own anchors stand,
  not beside the unit (asked for 2026-10-26: the continent's name "follow the unit - fix that - show static"):
  in each block of `ANCHOR_CELL` (8x6) squares it covers, its square furthest inside it, none on its edge where
  it has an inside, fixed by the world alone; the anchor nearest the unit first, an anchor off the view or
  unexplored giving way to the place's explored square on view nearest it, a square in from the view's sides
  (`PlaceLabel.at`, the first where the name fits); retro `drawPlaceNames`: waters pale blue, landforms
  parchment, lands in spaced gold capitals, ringed dark, over the fog and the shade, under cities and units,
  never across a city's name or out over the dark, kept inside the view. A land's name has what it is
  written small under it in parchment, "continent" or "island" (`landWord`: none when the name says it, "the
  Isle of Capua"; asked for 2026-10-27: "not clear that is a continent name - maybe add continent to it"). The
  minimap names the continents the viewer has found (asked for the same day; `continentLabels`: each continent
  with a square explored, over its explored square nearest the middle of what was explored of it, the most
  explored first; islands left out), retro `drawMinimapNames`: since 2026-10-28 (asked for: "make continents
  name smaller and less noticeable - to distinct from the civ names") in small capitals, letter-spaced, pale
  parchment (`rock` 5) over a dark shadow (`drawSmallCaps` in font.ts: our own letters, five dots tall, three
  wide, accents dropped; the map's gold ringed dark before), over the view's white frame and under the unit's
  blinking box, nudged four pixels off a name before it (else left out) and off the unit's box where it can. Game > Options > Place Names (asked for the
  same day: "add option to disable mass names visibility"; `MainScreenView.placeNames`, kept per browser)
  turns off the map's names and the notes of places found (the minimap's names have their own button since
  2026-10-28, see Borders below). The square's window says where it lies in its title
  (`squareTitle`; see Map clicks), and a unit of ours that finds places says so beside it (`discoveryNote`:
  "Discovered: Lake Caesar, the Roman Hills"; the web app's `announcePlaces`; found at the turn's start, in
  the status line).
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
  picture is laid); the rest wait for theirs (renderer-api `BUILDING_PICTURES_WANTED`, `TECH_PICTURES_WANTED`): the Harbour its
  drawn city-view picture (`PICTURES.harbour`), Archery and Seafaring the New Technology frame's bed (Elephants
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
- `packages/renderer-api` — the `Renderer` interface every renderer implements (draw each screen
  in its own logical size, hit-test menus/city map/city buttons/tiles/minimap/menu bar), the shared view types and the
  DOM-free screen logic (`setupMenu`, `leaderLine`, `wondersReport`, `topCitiesReport`, `builtNotice`).
  City screen: Change and Buy buttons in the production box (`cityButtonAt`); no bottom bar (asked for
  2026-10-24: "remove all buttons", after a bulky one and two redos): a close box at the title strip's
  end leaves (`cityExitHit`), a city icon beside it is View, a smiling face (the `happy` icon) before
  the citizens is Happy (lit blue while its panel is up), and the four focus toggles fill the map's
  empty corners (`FOCUS_CORNERS`, `cityFocusAt`: Growth food top left, Production shield top right,
  Trade coin bottom right, Science bulb bottom left; lit for each the city works for, any of them
  together, `setFoci`). Whatever the pointer rests on is told of beside the citizens (`cityControlNote`,
  `CityScreenView.hoverControl`), and the latest word (`view.message`) shows there too; the worked squares of its
  map carry their yield in the City Resources box's own icons (wheat ear food, hammer shields, arrows
  trade), straight on the ground with no shade: food along the top half, shields then trade along the
  bottom, overlapping when a row is long (asked for 2026-10-22: the shade looked bad and the old 3x3
  marks could not be told apart); the box gives each a named row of icons (Food, Shields, Trade, then
  Tax, Lux and Sci a row each; the buildings' upkeep heads the Improvements box). The Improvements box
  (asked for 2026-10-25: a small picture of each building, a scroll to see them all, and the option to sell
  each) lists the city's wonders (gold) then its buildings (`cityImprovements` in renderer-api), a line each:
  the user's picture of it in a 14x10 spot (`Surface.art`), its name, its upkeep and, for a building but the
  Palace, a Stop button; more lines than fit (5, 6 in saves without culture) scroll (`CityScreenView.top`,
  `scrollImprovements`; the wheel anywhere on the city screen, the bar's arrows a line and its track a page,
  a drag on the phone). Selling gave way to stopping a building's support (asked for 2026-10-27: "remove
  building sell option - replace with stop supporting the building - reduce the upkeep and disable building
  effect"): a click on a line or its Stop button asks first ("Stop supporting the Temple?", the gold a turn it
  saves and the rule's `text` of what stops working, Keep it by default; `askSupport` in the web app), then
  the core `support` command (`on: false`; `whyNoSupportChange`: never the Palace, which costs nothing, or a
  wonder) moves it from `City.buildings` to `City.idle`, so every rule reading the buildings passes it by: no
  upkeep, no effect, no culture (the city's workers leaving squares a shrunken border gives up,
  `dropLostSquares`), never built twice (`buildOptions`); it stands on in the city view. Idle buildings come
  last in the list, faded, their pictures darkened (`ArtSpot.dim`), with a Use button (`on: true`, at once).
  A conqueror finds them standing and supports them (`captureCity`). The line pointed at is lit and told of
  beside the citizens (`improvementNote`, `CityScreenView.hoverImprovement`). No save version: old logs hold
  no `support`; the core `sell` command (`sellPrice`, `whyNoSale`, `City.soldOn`) stays for the logs that
  hold it. A bankrupt treasury stops supporting buildings itself since save version 42 (see Treasury under
  Known gaps 1); it sold the costliest building before. Tidied 2026-10-24
  (asked for: "a bit chaotic", a granary indication, citizens to click "like in the original civ"):
  the row of citizens (`citizenRow` in renderer-api: workers by mood, then specialists) is clickable
  (`cityCitizenAt`; the web app's `changeCitizen`): a worker leaves the square worth least to entertain
  (`toggleTile` on `weakestWorked`), a specialist turns entertainer, taxman, scientist (`setSpecialist`,
  `nextSpecialist`), then goes back to work on the best free square (core `bestFreeSlot`; `workTile` with
  `specialist`, the one clicked; asked for 2026-10-25: a changed citizen could not go back), round again
  to entertainer only when no square is free; the person under the pointer (`CityScreenView.hover`) is
  ringed in gold, traced round the figure (`Surface.halo`; asked for 2026-10-25 in place of a light
  patch behind them, as Happy's face is), drawn in front of the row and told of beside it (`citizenNote`),
  else a faint hint. The food and shield stores (`drawStore`,
  `storeLayout`) are grids of empty slots waiting to be filled (asked for 2026-10-24), ten to a row,
  the grid in the middle of its box's room with the same padding on every side (`storeRegion`), a slot
  standing for more than one good only when the box has more goods than the room has slots (then each
  slot shows the goods it holds so far as a stack, one copy a good climbing up and right by up to three
  fine pixels, so the slot being filled grows good by good until it is full, `drawStack`; asked for
  2026-10-24 in place of a "{food}=2" key, and 2026-10-25 "each and every shield stacked until the
  placeholder is full"); the slots of what a growing city keeps (core `foodKept`: a Granary's half, or
  a trait's share) are edged in gold and named Granary (or Kept) at the foot, room allowing. Taxmen and scientists need no size of city (the 1991 game is said to want size 5: not checked, not asked for).
  Esc, Enter (not held), the close box or a click
  on nothing that answers (not a button, unit or city square) leaves it; Buy (button or B) shows the
  price against the treasury first. The build menu (`openProductionMenu` in the web app) shows beside
  each choice only the turns it takes from here, counting the shields a change would keep ("never"
  without a surplus); no costs or shield counts (asked for). Its choices stand under three tabs, in this order, Units,
  Buildings (spaceship parts with them) and Wonders (asked for 2026-10-31: "split into 2 tabs - buildings and units",
  then "add wonders tab - if no wonder to build disabled", and the order; `MenuState.tabs`/`tab`, a `MenuTab` each,
  shown by renderer-api `showTab`, which keeps each tab's pick for when it comes back): it opens on the tab of what the
  city builds (or last built, waiting for a choice), a tab with nothing to build stands faded and never shows
  (`MenuTab.off`), a click on a tab (`Renderer.menuTabAt`, retro `menuTabAt`, none on a faded one), Left/Right or Tab
  switch (passing a faded one), and the window is sized for every tab's rows so it keeps its size; retro draws the
  tabs as stone buttons sharing the window's width under the title, the one shown lit. Each choice has its picture before it (asked for
  2026-10-30: "show unit/building image next to each item"; `MenuState.pictures`, a `MenuPicture`: the unit's, the
  user's picture of the building, wonder or spaceship part in a 16-pixel square, retro `drawRowPicture`; darkened on
  a row that cannot be picked), and over the city screen the window stands above the units box, which stays lit
  (asked for the same day: "place the menu above the units panel - so player could see all existing units";
  `MenuState.keepClear` "cityUnits", the box from renderer-retro `screens/city-layout.ts`, which holds the city
  screen's boxes so widgets.ts can read them), its rows scrolling in the room there (4 on the desktop, 3 on the
  phone, with the tabs); where that leaves fewer than 3 rows (a note above the list, on the phone) the phone takes
  its smaller menu, else the window stands in the middle as before (`CLEAR_ROWS`). Each row ends in an info mark, a
  small blue disc with a white i (asked for 2026-11-02: "on the build menu - add for each building/unit a info icon -
  when clicked or hover show building/unit info"; `MenuState.info`/`MenuTab.info`, renderer-api `production-info.ts`,
  `productionInfo`: a `MenuInfo`, its name and lines with icons; retro `menu-info.ts`, `drawInfoMark`, `drawMenuTip`):
  the mouse on it shows a tip beside it (`MenuState.infoShown`; right of the mark, else left of it over the window,
  pointing at it, the font's size on the phone too), a click or tap keeps it up (the menu screen's `infoPinned`), a
  second click on the mark or one on the tip lets it go (`Renderer.menuInfoAt`, `menuTipAt`), and I shows the selected
  row's, following the selection, Esc hiding it before it closes the window. A unit's tells its attack, defence and
  moves, hit points, firepower and sight, what it can do (`unitAbilities`, shared with the panel's unit tip), wheels,
  deep water, zones of control, fuel, a veteran trained here (Barracks, traits), its upkeep in this city (its free
  units, a settler's food), the resources it needs and whether we hold them, and the advance that retires it; a
  building's its sentence, its effects in numbers (the Building Completed window's, `productionEffects`) and its upkeep;
  a wonder's its sentence, effect and culture, and the advance that ends its effect. No shield costs (the menu gives
  the turns). A change of production keeps the box for the kind it was
  gathered for and half of it for another kind (`shieldsAfterChange`: reckoned from the box as the turn
  began, `City.turnShields`/`turnKind`, or as bought, so changing and changing back in a turn costs
  nothing; FreeCiv's model). Units are one kind and improvements, wonders and spaceship parts another,
  as the original had it, and a finished improvement's leftover keeps its kind whatever the city turned
  to meanwhile (Militia; since save version 28, asked for 2026-10-24: "building starting already with
  production already processed": the Militia made the leftover a unit's box, halved for the next
  improvement; saves before 28 load with `halvedCarryOver`, headless `--halved-carry-over`). Since save version 49
  nothing is left over (asked for 2026-10-31: "when a unit/building production is complete - next production start
  from 0"): whatever is finished, for every player, takes the whole box (saves before load with `leftoverShields`,
  headless `--leftover-shields`). And a human player's city never turns to a default by itself (asked for the same day:
  "do not select automatically the militia or any other default unit - always let the player select the next
  production"; core `choosesNext`, `City.choosing`, saves before load with `defaultBuilds`, headless
  `--default-builds`): founded, taken, having finished anything (a unit too), or its wonder built elsewhere or its unit
  retired, it waits for its owner's pick, its shields gathering whole for it, nothing finished or bought meanwhile
  (`buy` refused, "nothing chosen"); `production` stays a placeholder. Computer players' cities turn to their default
  and go on with a finished unit as ever (the planner, seated for a human by headless `--human`, picks at once). The
  production box says "Build what?", Choose lit, "Nothing chosen yet" (the domestic advisor "Nothing chosen"); founding
  opens the city with "Rome: build what first?", and after the turn's news each city still waiting and not asked that
  turn opens with its build menu, "Militia completed: build what next?" (the web app's `askChoices`); left without a
  pick, it is asked again next turn. Head to head (planner vs v2, 16 x 300, Prince, city-states): 12-4, score 172 vs
  106, cities 10.0 vs 6.4, pop 56 vs 34; with the leftovers as before 8-8, 160 vs 122; all replaying exactly. Saves
  before version 21 load with `compoundingPenalty`: every change of kind halved the box again. Its units (`cityUnits`: those in the city from any home, then those it
  supports elsewhere, darkened, each with its cost) are picked with `cityUnitAt`: the unit wakes (fortify or
  sentry dropped, the `activate` command) and comes into play; one with no moves left keeps its orders. Since
  2026-11-02 (asked for: "distinct on the units view when unit is fortified or sentry - also when player activate a
  unit - show it activated and dont automaticlly close window, so player could activate several units") the city stays
  open (the web app's `activateFromCity`, `woke` on the city `Screen`) and the map takes up the last one woken once it
  is left (`leaveCity`); what each unit is doing shows in its slot (renderer-api `unit-standing.ts`,
  `cityUnitStanding`): a sleeper wears a slate token with a cream glyph of our own in its top left corner, where the
  map puts the shield (retro `SLEEP_MARKS` in `screens/city.ts`: a tower fortified or fortifying, zZ on sentry, a heart
  camped), its picture holed round it; a unit awaiting orders glows gold as the unit in play does on the map
  (`READY_GLOW`, twice `ACTIVE_GLOW` on the stone), so one just woken lights up; the pointer on a unit tells of it
  beside the citizens (`CityScreenView.hoverUnit`, `cityUnitNote`: "Legion: on sentry, click to wake"). A second click
  on a unit woken there gives it back the order it gave up (asked for the same day: "a second click would return the
  unit to the previous state"; `CityScreenView.woken`, the `SleepOrder` by unit, `SLEEP_AGAIN` for the note): the
  `fortify`, `sentry` or `camp` command, a fortifying unit standing fortified as our turn ends, before anyone strikes, so
  no save version. A unit the city supports away from it is only darkened (asked for the same day, after a fade and a
  glow: "remove filters and opacity - just make darker"; `ArtSpot.dark`, `AWAY_LIGHT` 0.35, no glow), its token whole
  over it, and a click on it closes the city and centres the map on it (`findUnit`), bringing it into play when it
  awaits orders, its orders otherwise untouched ("click to find it on the map"). A city that finishes an improvement, wonder or spaceship part opens
  the Building Completed window (`built.ts`, `builtCard`; asked for 2026-10-24 with the user's template; retro
  `screens/built.ts`, modern a plain modal), a small window over the game since 2026-10-24 ("should be a
  modal opened on top of the game and not a full screen window"; smaller again since 2026-10-25 and standing
  by its city, "smaller - and placed above the relevant built city with an arrow": `builtPlace`;
  over the map the map glides to put the city a square below the middle and rests there `BUILT_SETTLE_MS` (250 ms) before
  the window opens (asked for 2026-11-02: "first let the camera set on the city, and only than show building complete
  popup"; the `beat` screen, a key or click opening it at once; its sound with it), the web app hands each frame the
  city's square on screen (`BuiltView.square`, `Renderer.squareRect`, the phone's through its pan and zoom)
  and the window stands above it, else below, else beside it, a point of its stone reaching to a gold ring
  round the square, which `dimScreen`'s `keep` leaves lit; it grows out of that point (`drawEntering`'s
  `from`) and a click on the city is View City; elsewhere it is centred; a wonder first rises in its city's picture (the web app's
  `wonderShow` screen: the city view with `CityViewState.rising`, the user's picture clipped from the
  top (`ArtSpot.reveal`, `PicturePlace.reveal`) or the drawn one copied from its ground line up, over
  1.8 s, then sparkles round it for 1.6 s (`drawSparkles`) with the news along the bar (`banner`), a key or
  click after 0.4 s ending it; "a new wonder build WOW effect, the construction in fast forward") and
  its window opens over that picture, darkened with it (`ArtSpot.dim`: the pictures under a window take
  `brightness(45%)`); the web app draws the screen under it,
  `under`): since 2026-10-27 (asked for: "make more simplified. place all the text in the title - <building>
  is completed in <city name> - smaller image and modal", then "keep the building benefits"; the name large
  and the city line are gone) a navy title strip saying what and where in gold, "Temple is completed in Rome"
  (`BuiltCard.title`; shield, close box), the window as wide as that and its lines need (140x74 at least, was
  168x88; `builtSize`, so `builtHit` takes the state), under it the user's picture in a 28-square spot on a
  slate bed at the left (was 36), beside it a parchment panel of its effects (icon and numbers from the rule's
  fields: "+50% science", "+2 culture"), three lines with the upkeep last, and one button along the foot, View
  City (asked for the same day: "enter the city view to select the next building"; the map's Continue is gone):
  it, Enter, V, Esc, the close box and a click on the city all open the city screen with its build menu up
  (`leaveBuilt`); the rule's `text` is the modern renderer's body only. Leaving the city, the
  turn's news goes on (`then`).
  `Renderer.built`/`builtHit`. Finished units have no window of their own (the city then waits for a choice, asked after
  the news, see above), except Settlers: they cost a citizen, so their window asks what to build next (Build next...) over its city screen: "New Settlers in Rome",
  the user's picture of them on a slate in the square's window's frame (`MenuState.unit`, twice the map's size)
  beside one sentence on them and what they can do (asked for 2026-10-29: "add settler image. less technical";
  from 2026-10-24 it gave the city's size and yields before and after in numbers, which core still records on
  the `built` event, `CityTurnEvent.change`); leaving the city goes on with the turn's news (the city `Screen`'s `then`).
  A wonder finished first in another city (asked for 2026-10-29: the city "just halt and move to another without
  a notice"): after the turn's news each city of ours still building one that stands elsewhere (`wondersLost` in
  renderer-api `outbuilt.ts`) gets its build menu with the news above the list, "Wonder Built Elsewhere":
  where, by whom, and the shields it keeps (`wonderLostNotice`, the build menu's `body`; the web app's
  `askWondersLost`; a city's own finished wonder, its placeholder while it waits, is never one); Esc leaves it be, to be
  asked again next turn. A city whose box fills on such a wonder keeps its shields and says so (core's `outbuilt`
  city event, which opens the same menu): a computer's turns to its default, a human's waits (since save version 49).
  A city taken (`conquest.ts` in renderer-api and renderer-retro; asked for 2026-10-27: "a sad message (if lost) and
  celebration message + animation if player won"; core's `cityCaptured`/`cityLost` events carry the square, `plunder`,
  `capital` and the held city's `cityId`): one we take, once the unit has marched in (`tryMove`), glides the map to it
  (two squares below the middle, so the window fits above) and plays fireworks there (the web app's `triumph` screen,
  `FIREWORKS_MS` 2.6 s, a key or click after 0.4 s cuts it short; `MainScreenView.fireworks`, retro `fireworks.ts`:
  dusk falls over the view through the Bayer dither to `DIMMED`, the city's square kept lit, nine rockets climb and
  burst in rings of gold, our colour and the bright EGA colours, placed by hashes, and the cheer, "Rome is ours!",
  `drawTextLargeRinged` under the city's name); then the window by the city (`conquestCard`, `drawConquest`, placed and
  pointed as the Building Completed window, `builtPlace` with its size): the square as the map draws it
  (`drawSquarePicture`), the name large over "Taken from the Babylonians", a cheering line, then on parchment up to
  three facts (capital fallen, wonders won, gold plundered, citizens, buildings kept), View City and Continue. One of
  ours taken or razed (the turn's news, `presentEvents`): the map glides to it and the window mourns, a black strip with
  the frowning face, name, words and ring in dark red ("Its streets fall silent under foreign soldiers.", a line hashed
  from the city), what was lost, no buttons (the close box, Enter, Esc or any click go on). Razed by us: City Razed,
  fireworks too; freed from the barbarians: "Freed from the Barbarians". `Renderer.conquest`/`conquestHit`; modern
  draws a plain modal. No save version (events are a UI side channel). City view (`cityview.ts`, the original's View:
  the city screen's View icon or V; the modern city screen shows it small as the button): every improvement
  and wonder has a `PICTURES` entry made of shapes (`Part`: rect, poly, oval, line, each of a `Material`) on a
  grid of retro pixels; `cityScene` lays a city out (wonders on the back row, the palace in the middle, then
  improvements and homes of the owner's age filling the middle rows outward, trees beyond, walls before the
  front row, the land to the north on the horizon, a river if the city has one), hashed, never the RNG. Retro
  fills the shapes pixel by pixel (`pictures.ts`: lit left, shaded right, outlined in black); modern paints
  them as paths three times larger. The user's pictures of buildings (2026-10-24, asked for: "use the attached
  images for game buildings ... replace buildings also in the city view"; all 50 since Barracks, Granary and
  the Great Library came later that day; the drawn ones stay as the fallback for an id without a picture)
  stand in their place: `BUILDING_ART` (`art.ts`)
  gives the box each one's drawing fills in its 1254 square, `artLot` the room it takes in the city view
  (the drawn picture's area in the picture's own shape, at most 46 high; `SceneItem.w`/`h`), and the walls'
  picture stands as their gatehouse over the drawn run (`kind: "gate"`). Retro draws buildings through
  `drawBuilding`, which leaves an `ArtSpot` in `Surface.art` (back to front) where a picture exists; the
  apps lay the pictures there (`artPlace`, `buildingPlaces`), stacked by `z`, the one clicked ringed in light
  (no stone tag, which a picture would hide). The research card's strip of buildings does the same. A click
  names a building (`cityViewAt`), anything else goes back. The web app
  only talks to a `Renderer`. Info panels prefer icons to words: `ICONS` (`renderer-api/src/icons.ts`)
  names them, every renderer draws all of them, and text may carry `{icon}` tokens (modal bodies and
  panel lines; groups separated by two spaces wrap apart). The main screen has a menu bar (`MENU_BAR`: Game, Orders, Advisors,
  Diplomacy, World, Debug) above map and panel; a `MenuState` with an `anchor` and an empty title is a bar
  dropdown; rows in its `disabled` list are drawn faded and never hit (the web app's `MenuEntry` fourth
  element; Game > Revolution! while `governmentsAvailable` offers one government only, asked for
  2026-10-24). The game's switches (Sound, Music, Borders, Civ Names, Place Names, each On or Off) are a submenu, Game >
  Options ▸ (asked for 2026-10-27: "move all Game menu switch options to be sub menu under options"; the web
  app's `openOptions`, a menu `Screen` with `sub`): a dropdown opened beside the Options row
  (`Renderer.menuRowRect`), over the Game dropdown, which stays drawn under it; a pick flips the switch and
  leaves it open, Esc or Left goes back to the Game menu, and a click off it goes on to the Game menu (its
  rows, the bar, or off both to close). Diplomacy (added 2026-10-24, asked for) lists every civilization met with how we stand,
  and opens its card: the audience screen with the leader's portrait at the left (`CARD_PICTURE`) and
  `civCard`'s sections beside it (since 2026-10-29, asked for: "split to sections of civ stats etc. improve
  content design"; `DiplomacyView.card`, `CardSection`: Realm (government and capital in icon rows; their cities,
  citizens, advances and gold were taken off 2026-10-31, asked for: "remove stats that you should not know in this
  stage"), Toward us (their mood, the AI's `attitude`, with our treaty, pact or alliance, `treaty`;
  what they make of our influence; their units on our land), their trait, Resources; retro draws each a dim
  heading ruled across over its rows, a line opening with an icon wrapping clear of it, the line and the one
  row of buttons lower down), our envoy's word as the line (`envoyLine`), and Talk (an audience; since
  2026-10-29 the talk over goes back to the map, asked for: "dont return again to the talk to x screen"), Demand they leave our land
  (when their units stand on it: the AI's `withdrawAnswer`, friendly yes, wary only to a neighbour at least
  as strong, hostile never; yes is the core `withdraw` command: each of their trespassers gets a goto to
  `exitSquare`, the nearest way off our land, walked at their turn's start, and their trespass is
  forgiven) and Back. The planner may march them elsewhere after; it still ignores borders itself.
  Tax Rates (Game > Tax Rate, T; redone 2026-10-24, "not good") is a stone window over the map
  (`screens/rates.ts`, `ratesRect`): a row each for tax, luxuries and science with its icon, - and +
  buttons and ten blocks (filled to the rate, dark past the government's limit), what the cities bring
  a turn at the foot (`empireIncome`), the close box (no Done since 2026-10-24); `ratesHit` (set a
  block, step, done) through `Renderer.ratesHit`, `ratesAt` for the phone's sliding finger; science
  takes what the others leave, and moving it takes from tax (`setRateTo`).
  Windows (asked for 2026-10-24: "all screen windows should be a modal style", "replace all close
  buttons with generic modal X", "darken backdrop", buttons "stone like texture"): every titled window
  (modals, the rates, text input, New Technology, Building Completed, the audience) darkens the game it
  opens over first (`dimScreen` in widgets.ts, once a frame by `Surface.dimmed`, through `DIMMED` in
  palette.ts: each colour's nearest twin at 45% light, built from the palette so the renderer still draws
  indices); dropdowns and the title screen's untitled list do not. A message with nothing to choose but
  to close it (the web app's `modal` with "OK") has no button: an X in its title strip (`MenuState.close`,
  zero items), Enter, Esc or a click off it go on. The research panel's Close button is a close box in
  its title strip (`researchHit` "close"); the audience's X (or Esc) steps back or takes leave, and since
  2026-10-31 every screen of a talk also says so in a button (asked for: "sometimes there is one option, with no back
  or cancel option"): a list's Back (Done in an exchange's lists), a price's No, war's Keep the peace, Farewell after
  the last words (the web app's `talkMenu` `exit`). `drawButton` is the speckled stone with a light top-left and dark
  bottom-right bevel. Every button takes one of four looks (`ButtonLook`, `buttonFace` in widgets.ts; since
  2026-11-01, asked for: "button hover/selected change style", "add new button style (maybe red) for aggresive
  actions"): plain stone with black words; lit (under the pointer, the modals' default choice, Research, the tab
  shown) the same grain and bevel in the blue of the title strips and menus' lit rows, white words (parchment gold
  from 2026-10-25 till then); danger, red stone with white words, for what makes an enemy or undoes something for
  good; lit danger the same red ringed white inside its bevel. A faded button is plain stone. The audience's choices
  (`DiplomacyView.danger`, renderer-api `talkDanger`: war, each demand and Make demands; the civ card's demand) and
  the parchment windows' buttons (`drawWindowButton`) take them too. Red elsewhere (`MenuState.danger`, the web
  app's `menu`/`modal`/`talkMenu` `danger`): Declare war! (the map's and the talk's), Disband and its Yes, disband,
  Pillage, the diplomat's steal, sabotage and incite. A menu's row or button under the mouse is lit (its `selected`, as the
  windows' buttons were already; never a faded one). A window answers
  no Enter, Space or click until it stands whole (`WINDOW_ENTER_MS`; the web app's `settled`), and never
  a key held down: a key mashed through the playback cannot dismiss the window that follows it (asked for
  2026-10-24, "building is built, and skip building screen"). The Building Completed window first glides
  the map to its city (`centerOn` in `builtWindow`).
  A titled menu of up to four choices is a modal (`menuButtons`): its choices are buttons sized to the
  longest label and centred, and its text wraps rather than widen it past `MODAL_MAX_SHARE` of the
  screen; keep modal text to a line or two. A list longer than the screen (what to build late in the game) scrolls:
  `MenuState.top` kept by `keepInView`, `Renderer.menuRows` and `menuScrollAt` (retro draws a bar with
  arrows); arrows, PgUp/PgDn, Home/End, the wheel and clicks on the bar move through it.
  Debug's entries (reveal map, gold, research, production, moves, contact) are the core `cheat` command, logged and replayed like any order.
  Opening and title (`intro.ts`; asked for 2026-10-22, after the original's intro, in place of the old
  sunrise and its "an empire game" line): one timeline, `introAt(ms)`, `INTRO_MS` (27.5 s) long: stars,
  a planet turning in space as it forms (molten, cooling, seas, clouds, green land, towns' lights on its
  night side) under five lines of story in our own words (`INTRO_CAPTIONS`), then the name CIVILIZATION
  over it. `Renderer.title(at)` draws it `at` ms in; from `INTRO_MS` the title stands complete, the
  planet still turning. The web app starts it on the first frame; a key or click skips to the end, and
  the title menu (no header) opens by itself once it is over and whenever the title shows again. Retro
  draws it in `screens/title.ts`: the planet lit per fine pixel from hashed noise maps (made a few rows a
  frame while only the stars show), the name in `screens/title-name.ts` (since 2026-11-01, asked for with the original's title as the model: "more like
  the original one ... instead of "sid meier's" - "Avrik's""; before, our slab capitals in flat gold, 2026-10-30): tall,
  narrow Roman capitals of our own, built from shapes (stems, wedges, rings, bracketed serifs, brush strokes) and filled
  per fine pixel, 80 fine pixels tall, thick downstrokes and hairline bars, shaded through the Bayer dither from brown at
  the word's ends to cream in its middle (`FACE_RAMP`: earth then rock), lit pale lavender along each left edge, navy
  along each right, ringed in navy; over it the byline "Avrik's" in small serif letters, cream, between two ruled lines
  (a hairline over a band) running out to the name's ends. It comes up out of the dark from the middle of the word
  outward, a glint sweeping across. Its letters are drawn ahead, one a frame, once the planet glows into view
  (`prepareTitleName`), so the name costs nothing when it comes. `TITLE_NAME_BOTTOM` is the first row clear of it: the
  phone's title buttons keep below it (`SETUP_CHOICES.top`, shortened to 22 when five would not fit), the web's menu
  stands lower already; modern keeps a
  still title with the name.
  Setup cards (`setup.ts`; asked for 2026-10-22, then redone the same day: the first pictures, seats of
  power, town patches and landmarks, were not liked): `setupCards(setup)` gives difficulty and the tribe as
  cards with portraits, in `setupMenu`'s order (null for the rest, the number of civilizations included:
  plain menus). Difficulty: a row of its rulers (chieftain, warlord, prince, king, emperor, as the original
  showed them), the panel under
  them saying what the level changes (`DIFFICULTY_RULES`). Tribes: a grid of
  their leaders (`LEADER_PORTRAITS`, `TRIBE_COLUMNS` across), framed in the tribe's colour, beside a panel
  with the leader large, the trait, the first advance and the capital. All of them are the user's
  portraits shown as supplied (asked for 2026-10-22, "don't change or distort": converted into the palette
  they had lost detail and colour): `apps/web/src/portraits/<name>.webp` (the PNGs at their own sizes,
  WebP quality 92 with exact alpha), laid over the canvas whole, shape kept, standing on the foot of the
  places `setupPictureSpots` gives (every card's, and the panel's), the screen drawing only a sky
  behind them; `pictures.ts` in the web app as for the audience. `Renderer.setup`/`setupHit`; the web app lights
  the card under the pointer and picks it on a click (a first tap on the phone lights it); arrows move in
  two dimensions, Enter picks. Modern shows the cards' labels as its old menu.
  Map clicks (since 2026-10-27, asked for: "make same as civ1 movement: units move with right click. left
  click will center map or enter city view. when a stack of units is clicked open a units menu"; until then
  the left button did both, 2026-10-22): left-click opens our city, picks our unit (centred), and on a square
  holding several of ours lists them in a window (`openStack` in the web app; `MenuState.pictures` puts
  each unit's sprite before its row, the row grown to hold it, with its standing at the right: Fortified,
  Sentry, Going, Mining 3, Ready, No moves; asked for 2026-10-24), the one picked waking and coming
  into play (one with no moves left keeps its orders); anywhere else it centres the map on the square
  (`view.inspect` shows it in the panel), and a second left-click on that square opens the square's window
  (asked for the same day: with the right button moving units, "cant see tile terrain info"). Right-click with a unit in play moves it (`moveClick`):
  `planMove` (renderer-api `plan.ts`) decides: a step next door goes at once (a refused one says why),
  into our city or onto our units' square too; a fight ("Attack: 62%", `attackOdds`), an empty enemy city
  ("Take Rome") or a square further off (the `findPath` route, "This turn"/"3 turns" by `routeTurns`)
  becomes `view.plan`, drawn as dots on the way, corners round the end and the note, and goes only on a
  second right-click on the same square; any other click or key drops it. A right-click on the unit's own
  square opens its orders; where it has no way, a note says "No way there.".
  Shift with either button, a right-click with no unit in play, or a second left-click, opens the square's window (`terrainInfo`: titled with the terrain and where it lies,
  `squareTitle` in renderer-api's `places.ts`: "Grassland, Ausonia", "Hills, the Alps, Europe"; since 2026-10-26,
  asked for: "show land/water mass name in the title - remove duplicates": the terrain's word left out where
  the place's name says it, "The Apennine Mountains, Ausonia", and a water's name standing for its square,
  "The Sea of Neptune"; the resource and river, in the title from 2026-10-23, and the body's line naming the
  place are gone; since 2026-11-02 the resource it shows us (`specialFor`) is named in brackets after the first name,
  asked for: "if have a tile resource - show in "()" in the title": "Plains (Horses), Ausonia", "The Sea of Neptune
  (Fish)", `squareTitle`'s `resource`); headed by the square itself as the map draws it, twice the size in a sunken frame
  (`MenuState.square`, retro's `drawSquarePicture`/`squarePainter`, `Renderer.menu(menu, state)`; asked for
  2026-10-23: "more stylish, add the terrain image, more details"). Since 2026-11-02 a card (asked for: "too messy.
  arrange with clear sections. clean design", then of a table of labels and lines, "still not good. rethink this modal
  window layout"; renderer-api `square-info.ts`: `SquareInfo.card`, a `SquareCard`, `MenuState.card`; retro
  `square-card.ts`, `drawSquareCard`, laid by widgets.ts in place of a body): beside the picture the yields in large
  figures, a nought faded, the moves and defence ("{boot} 1 move  {tower} +50% defence"), whose it is (`owner`: "Rome,
  ours, size 4", "Our land, worked by Rome", "Land of Tyre") and a few words on the terrain (`TERRAIN_TEXT`, our own)
  in dim ink; under them one parchment panel, as the Building Completed window's, of facts (`SquareFact`: an icon or
  a unit's owner's shield, a name in black, a short note in a column of its own, grey, green for good news, red for a
  warning) in groups, each under a small brown heading in small capitals with a rule running on, each only when it has
  something to say: Here (the resource, what it adds or the units that need it, the road or rig it waits for; river,
  road, railroad, irrigation, mine, fortress, fishery, rig, village, pollution, each with what it adds; where only
  settlers or no wheels go and the wear on units; a city's influence yield; the settlers' site note), Units (ours with
  their jobs, orders, wounds and ranks, another civ's with whose, alike ones counted, `UNITS_LISTED`) and Improve
  (what settlers could still add or turn it into, at sea a Fishing Boat's fishery and the Harbour). The card keeps the
  font's size on the phone (its window laid at `TOUCH_MENU_SMALL`); modern writes it as lines (`squareLines`, also
  `SquareInfo.lines`). The only button
  Open city, on our city (Go
  here removed 2026-10-23, asked for); it stands by its square and points at it (asked for 2026-11-01: "the tile
  should be highlited and info window points with an arrow towards the tile"; `MenuState.point`, the square's rect
  from `Renderer.squareRect` each frame): above it, else below or beside it, a point of its stone reaching to a gold
  ring round the square, which stays lit while the map darkens, as the Building Completed window stands by its city
  (renderer-retro `pointing.ts`: `pointedPlace`, `drawSquareRing`, `drawWindowPoint`, shared by the three); with no
  room above or below, the card narrows to stand beside it (`pointedLayout`, `sideRoom`, at least
  `CARD_NARROW_W` 160 and its title's width), its notes wrapping; with no room so it opens clear of the square clicked (`MenuState.avoid`); either way a second click there closes it), closed by the X in its title
  strip (`MenuState.close`; retro draws it, modern ignores it; any click off a window's choices closes
  it). On the phone a tap moves the unit in play onto a square not ours, else is a left-click; a hold on
  our city or units moves it in, elsewhere shows the square's window (see apps/mobile).
  Edge scrolling (asked for 2026-10-23): a mouse resting in the band along an edge of the map
  (`Renderer.mapView`, the band 6% of its shorter side) pans the camera that way after 220 ms, gathering
  speed to 8 squares a second (`stepEdgePan` in the web app); not over the panel or the menu bar, not
  while the other civs' turns play back, and only for a mouse (the phone drags its map: no `mapView`).
  A unit's own move still brings the camera back when it steps out of view (`followActive`).
  City sites (asked for 2026-10-23): while our settlers are in play the map pins the best few squares near
  them to found a city on (`settlerSites` in renderer-api: within 6 squares on their own landmass, scored by
  core `siteScore` from what the player has seen, unseen squares counting a plain grassland's worth, clear of
  known cities by `CITY_SPACING`, apart from each other, nearer preferred; only squares in sight now, the
  area observed (`Player.visible`, asked for 2026-10-25: never land merely explored), so a lone first settler
  sees one pin at most, its own 3x3), marked quietly (the first pins
  were "bad": "more abstract, subtle"): a dotted edge round the square (`drawSiteMark`), gold for the best,
  pale for the rest. The mouse resting on one shows why beside it (`siteNote`: "Best place for a city: by a
  river, on the coast, 2 resources nearby.", `MainScreenView.hint`, set each frame by the web app's
  `siteHint`), and the square's window (right-click, or a hold on the phone) carries the same line.
  A refused move (`tryMove` in the web app) nudges the unit toward the square (`MotionPlayer.nudge`,
  a UI-only beat) and puts a note beside it (`view.callout`, words from `moveRefusal` in `refusal.ts`),
  gone after 4 s or at the next key or click. A refused settler job does the same without the nudge
  (core `whyNoWork` gives the code, "needs:<advance>" for a missing advance; `workRefusal` the words);
  R asks for a road where the square has none, rails only on a road. A river takes a road once its civ
  knows Bridge Building, as in the original (before, never; no save version: the planner builds no
  roads on rivers and an old log holds no refused order). As a turn passes the status panel's year counts on to
  the new one (asked for 2026-11-01: "when years pass - show numbers animation passing quickly to new updated year"):
  through the years between, fast then slowing, over `YEAR_COUNT_MS` (900), in blue while it counts (renderer-api
  `year.ts`, `countedYear`, never year 0; `MainScreenView.year`, the web app's `stepYear`; a game started or loaded
  shows its year at once). Both status panels show the research under way
  (`researchOutlook`: advance, beakers, turns to go), and nothing while none is picked. Panel tips
  (asked for 2026-10-26: "add tooltips for each relevant element - not clear now. money, taxes, science,
  governance type etc"): every part of the status panel but the minimap (`PanelPart`: population, year, treasury,
  tax, luxuries and science each, government, research, the unit's name, moves, home, rank, terrain,
  yields and orders, End of Turn, the wars) is told of in words (`panelTip` in renderer-api `panel.ts`,
  numbers from the rules: the treasury's taxes and upkeep, a rate's yield and the government's cap, the
  government's rules read from its `GovernmentRule` and the save's older rules, the unit's stats and upkeep)
  in a stone box right of the panel pointing at the part (retro `drawPanelTip`, `MainScreenView.tip`),
  shown when the mouse rests on it 350 ms (the next part at once while one shows) or a click or tap on a
  part with no action (4 s); retro's `panelLayout` places the panel's rows for drawing and hit tests alike
  (`statusPartAt`, `Renderer.statusPartAt`). A click on tax, luxuries or science opens the rates. Disbanding
  (Shift+D, Orders > Disband) asks "Are you sure?" first, No by default (`confirmDisband`).
  A unit of ours stepping aboard a ship wakes the ship (asked for 2026-10-31: "when unit go into the transport unit -
  activate it from sleep, ready to move"; the web app's `wakeShip` after `tryMove`): sentry or camp dropped by the
  `activate` order, logged as any, and with moves left the ship comes into play to sail; a ship on a goto keeps it.
  The rules are untouched (the unit aboard still sentries), so the AI and old logs are unchanged.
  A unit's orders (`unitOrders` in the web app; asked for 2026-10-27) end with Disband, in red (`MenuState.danger`:
  a red row, lit in the red buttons' red, or a red button on the phone), then Pillage last, red too; settlers have no Fortify,
  and Found city stands faded ("Found city: too close", `MenuState.disabled`) within `CITY_MIN_DISTANCE` of a
  city (B says which city, beside the settlers); a job that changes the land says so ("Plant forest", "Clear to
  plains": mining grassland, plains, swamp or jungle grows forest, as in the original; nothing mines forest,
  tundra or arctic, so no Mine there).
  Width: the retro main screen draws as wide as its surface (`viewAcross`: the panel and bar as ever, the
  map's viewport taking the rest), menus, prompts and the status line centre on the surface they are
  drawn on, and the menu hit tests take the width (default 320); the web game draws 320 wide, the mobile
  app as wide as the phone.
  Zoom (`MainScreenView.zoom`, set by the mobile app's pinch, and since 2026-10-28 by the web game, asked
  for: "add also in the web browser game version a main map zoom option"): retro draws the
  map as usual, then `magnifyViewport` blows the viewport's top-left 1/zoom up to fill it (fine pixels,
  in place) before the panel and bar; `zoomedTiles` sizes the minimap's box, `unzoomPoint` maps a tap
  back. The modern renderer ignores it. The web game (only with a mouse: `renderer.mapView`; the phone
  zooms in its own renderer) keeps its zoom in `view.zoom` (`epochs.zoom` per browser) but draws it as the square's
  size, never magnified (see Map square size below; 1x, 2x or 3x until 2026-11-02): the wheel over
  the map (a notch a level, the square under the pointer staying put, `setZoom`), the + and - buttons in the map's
  corner, the keys + and - (about the middle, the unit in play kept on view) and World > Zoom In / Zoom Out (faded at
  the ends), with "Map zoom 120%" in the panel. `Renderer.viewTilesX`/`viewTilesY` stay the unzoomed count: the web app's camera
  (centring, following, edge scrolling at the same speed on screen, the other civs' playback) reads
  `viewTiles()`, the whole squares shown at the zoom, and the web adapter's `tileAt` and `squareRect` go
  through the zoom (a square off the zoomed view has no rect). A fight on the map zooms it closer
  (asked for 2026-10-29: "when there is a battle zoom in to the battle - when finish zoom out to the previous
  zoom"; the web app's `battleZoom`, `stepBattleZoom`): at once as the fight begins, centred on it (a later
  fight glided to), held through the playback's notes beside it so a run of attacks stays close, and
  `BATTLE_LINGER_MS` (700) after the last, then the player's zoom again about the view's middle; the turn's
  news and the turn's end wait for that. Never kept per browser (`setZoom`'s `keep`); a zoom of the player's own
  meanwhile stands; at the closest zoom it only centres. Not on the phone, whose renderer keeps its own pinch zoom.
  Map square size (asked for 2026-11-02: "enlarge the base tile size and all that related (units, cities etc) - see
  how it looks", tried on branch big-tiles at 24, then "try something in between - 20px", then merged): renderer-retro
  `MAP_TILE` (`setMapTile`; 16, the original's, by default) is the main map's square in screen pixels; the web adapter
  sets 20 unless the page asks `?tile=16` (or 24, 32). The map then shows fewer squares (12x10 at 20, the last
  row cut, 10x8 at 24; `viewAcross`, `viewDown`), works out terrain, shores, rivers, roads, fog, the shade
  out of sight and borders at that size (`terrainSquare`, `fogSquare`, `unseenSquare`, `wayPixels`'s `t`; widths in the
  original's fine pixels, so a river or road is as much of a square as before), draws works, resources, villages and
  forts at 16 and lays them on stretched (`onSquare`, `stretchSquare`, `Surface.blitScaled`: nearest, so the terrain art's
  pixels come 1 and 2 fine pixels wide at 20 (one in four doubled) and 24 (every other), even at 32), and lays the units' and cities' pictures over squares that size;
  but a resource is drawn at the square's size, `SPECIAL_SHARE` (0.8) of it across, centred, never below its icon's own
  32 fine pixels (`drawSpecial`'s `t`; asked for 2026-11-02: "on tile resources are bit too big now - reduce size":
  stretched, they had filled the 20-pixel squares), so at 20 an icon is its own pixels, unstretched, and at 16 as before;
  shields, hit points, ranks, names and labels keep their size. The city screen's map, the square's window and the
  phone app (its own renderer) keep 16. The web game's zoom is the square's size there (asked for the same day: "zoom
  now is too big - reduce and place +/- toggle button on main map for zoom"): `view.zoom` 0.8, 1 or 1.2 times
  the base (16, 20 or 24 pixels on 20; five levels to 1.6, 32 pixels, until 2026-11-03, asked for: "reduce to 3 levels
  only"), which the adapter draws as `MAP_TILE` (`sized`), never magnified, its `viewTilesX`/`viewTilesY` counted at
  the base; "Map zoom 120%"; a fight two levels closer, at most the closest (`BATTLE_ZOOM_STEPS`). Two
  buttons, + over -, stand in the map's bottom right corner (`MainScreenView.zoomButtons`, retro `zoomButtonAt`,
  `Renderer.zoomButtonAt`, the web app's `stepZoomButtons`; since the same day, asked for: "button too big - more
  subtle", one plate 9x18 of the map darkened, `DIMMED`, edged and parted by a fine black line, the signs thin, pale,
  `ZOOM_SIGN`; at first two 12-pixel stone buttons): the sign white under the mouse, dim at the zoom's end, the map's
  names kept off them, pictures cut round them, no edge scrolling while the mouse rests on them. The phone's pinch still magnifies whole times.
  Unit animation: core appends every step (`applyMove`) and fight (`resolveCombat`, round by round) to
  `lastActions` (a UI side channel like `lastTurnEvents`, emptied by `endTurn`, never read by replays or
  AI); `MotionPlayer` (`renderer-api/src/motion.ts`) times them into `view.moving` (slides) and
  `view.battle` (lunge, blows, hp draining, the loser's burst), and renderers draw from those.
  The other civilizations' turns (asked for 2026-10-22: enemies "come as a surprise, too swift"):
  `watchTurn` (`renderer-api/src/watch.ts`) plans the playback from their actions and the squares we
  see (`seen`, the web app's `watchOthers`: squares we see now, so a unit shown stays in sight or is seen
  walking out of it, and since 2026-11-03 every square we saw as our turn ended, held in sight meanwhile (below;
  before, only the squares a unit of ours lost in a fight saw, for the steps that led to it); until 2026-10-24 any square seen before or after counted, and a unit shown on one we no longer
  saw vanished the moment its slide ended, "shown for a glimpse and disappear"): every move of a civ at
  war with us (or barbarians) on seen squares, one unit at a
  time at a slow pace, a `MotionPlayer.hold` first gliding the camera there when it is not well on screen;
  each fight with our units is announced beside the attacker ("Babylonian Legion attacks!"), played
  slower, and its outcome said beside our square ("Phalanx destroyed"); other civs' moves play only
  where the map already looks. A long turn is sped up to `WATCH_BUDGET_MS` (at most ~3x). Any key or
  click skips the rest. Then an "Under attack!" window lists the turn's fights with our units
  (`fightReport`), then the news; a war declared on us by a civ we already knew is told before the playback.
  Until the playback is over the map draws the cities as they stood when our turn ended (asked for 2026-10-29:
  a city taken, and its new borders, showed while the fight for it still played): renderer-api `staging.ts`,
  the web app's `staging` and `mapState` (a copy of the state with `stagedCities`), so borders, flags and sizes
  wait; a city taken, razed or founded by a step the playback shows changes as that step lands (`cityChanges`:
  the conqueror's, raider's or settlers' last step onto its square; `MotionPlayer.playing`). Sight lost in the
  fighting stays until it is all over (asked for 2026-11-03: "when city is conquered or unit is lost - visibilty
  around should stay until the battle is COMPLETLY over and all fight animations and all enemy and player units done
  fighting"; renderer-api `SightHold`, the web app's `sightHold`, `holdIfLost`, `releaseSight`): what we saw as our
  turn ended, and what we saw before a fight of ours that cost a unit's sight (`sightLost`), stays seen on the map
  (`mapState`'s sight: what we see now and what is held), whatever stands there drawn, until no slide or fight plays,
  the fight's zoom and the view's linger are over and the news after them is closed, the map shown; then the shade
  falls. A UI side channel: `Player.visible` is the rules' as ever. Before, a city of ours kept its land in sight only
  until it fell (`stagedSight`, gone) and a unit lost took its sight with it at once.
  Coasts: `coast.ts` gives both renderers one shoreline field (square depth 0 land / 1 water touching
  land / 2 open sea, interpolated between square centres plus noise that wraps with the map), so shores
  and the edge of deep water wander across square borders while every square's centre keeps its kind.
  Rivers (`river.ts`): curves from a meeting point near each square's centre to a crossing point
  picked per border (both squares agree, the curve leaves square to the border), meandering between,
  widening toward the sea; the sea square carries the mouth on through spilled shore. Strokes show on
  land only. Retro blends coast and river per pixel (`terrainSquare` in `tiles.ts`, cached by
  neighbourhood); modern fills marching-squares paths (`renderer-modern/src/coast.ts`) and strokes rivers.
  Fog of war (`fog.ts`): unexplored squares are fog, and fog drifts into explored squares beside them
  (solid at the border, clear before the centre, a ragged edge). `FogLifter` (a UI side channel run by
  `apps/web` each frame, like `MotionPlayer`) fades fog off newly explored squares over 700 ms, held
  until a sliding unit of the viewer comes within reach, into `view.lifting`; foreign units and cities
  wait for it to half clear. Retro: `fogSquare`, solid black (asked for 2026-10-19: no grey cloud
  shades; keep the drifting edge), the edge and the lifting dissolving through the Bayer dither;
  modern (set aside) still draws grey clouds (`cloudTone`): `Clouds` gathers the view's fog and fills
  each layer as one path (per-square fills leave seams, and thousands of tiny polygons cost ~600 ms a
  frame), lifting squares as alpha layers grouped by fog left, bodies before billows (else edges show).
  Explored squares out of sight (core's `visible`, see Sight above) are shaded, so the area observed
  shows on the map (2026-10-24): retro `unseenSquare`/`shadeUnseen` map what is drawn through `UNSEEN`
  (palette.ts: each colour's twin at 62% light, as `DIMMED` is at 45%), over the borders and under the
  fog; a square in sight is never shaded (asked for 2026-10-24: "inside the borders 100% visible"; the
  shade drifted into them at first), the shade on a square out of sight giving way where a seen
  neighbour's clearing reaches with the fog's ragged dithered edge (`clearingPatch`; `sightPatch` is the
  patch the other way round); a city there is shaded with its square, its name not; the minimap shades a block with
  no square in sight; the square's window says "Out of sight". Modern (set aside) does not shade.
  Research list (asked for 2026-11-03, after two redesigns of the research panel were turned down and reverted, "very
  BAD. revert all ... start from the start - a basic simple tech list - like the original civ1 game"): research is
  picked from a plain game menu, the web app's `openResearchList`: the advances that can be researched now in the
  tree's order, "Wise men ask: what shall we research?" (or "Researching Writing: 5 turns left", its row "under way"),
  after each name small pictures of what it unlocks (asked for: "just icons small"; `MenuState.trail`, renderer-api
  `techPictures`: the government's crown, wonders, buildings and spaceship parts, units; retro draws them 14x12 in a
  column past the longest name, rows 14 high, `drawSmallPicture` in widgets.ts) and an info mark at the row's end
  (`MenuState.info`, the build menu's mark) that opens the window of more about the advance (the menu `Screen`'s
  `onInfo`, no tip; I too). A click or Enter researches the row; while research is due the list cannot be left
  without a pick (Esc or a click off it leave it standing). A list with pictures after its words or info marks is
  never buttons (`menuButtons`). It opens wherever research is picked: after the New Technology windows when research
  is due, science advisor A, Advisors > Research, the status panel's research row. The advance window (renderer-api
  `advance-info.ts`, `advanceInfo`; retro `screens/advance-info.ts`, `drawAdvanceInfo`/`advanceInfoHit`,
  `Renderer.advanceInfo`; the web app's `advanceInfo` screen over the list, which it goes back to): the New
  Technology window's parchment and gold, 288x184, the advance's name in the title strip, the user's picture of it in
  a gold frame (`advanceInfoPicture`), Description (`AdvanceRule.text`, its era and what it needs, where it stands for
  us), History (`AdvanceRule.history`, a few sentences of our own each, plain ASCII, three lines at most:
  core `rules/advance-history.ts`), Unlocks (every gift with its small picture, units with their attack, defence and
  moves, then the other gains a line each with their icons; two columns past three) and Leads to (each advance with
  what else it waits for; past four, their names as one list). The close box, Esc, Enter or a click off it go back.
  Modern draws it as a plain modal.
  Research panel (`research.ts`; redesigned 2026-10-20, asked for: the old tier graph was confusing and
  disliked, so it is gone; a window over the screen it opened on since 2026-10-24, "should not take 100%
  of the screen": `researchRect` 300x188 centred, the game darkened behind, 15 list rows, its parts laid
  from `layout(screenW)`, `researchHit` taking the screen's width for the phone's wide map; the web app
  draws the screen's `back` under it): built round the choice. Under the title a band with the research under way
  (bulb, beaker bar, turns) or what the advance just found brings (`researchBand`); on the left a list
  (`researchRows`) of three groups: Research next (the research under way first, then what the latest
  find brought within reach, marked with a yellow diamond, then the rest; each row with icons of what it
  brings, `techIcons`), Coming later (`comesLater`: everything it needs is known or can be researched now;
  the hint of what lies ahead, faint) and Discovered (ticked, newest first); it scrolls (`ResearchView.top`,
  `keepResearchInView`, `Renderer.researchListRows`). On the right a card for the selected advance
  (`techDetails`): its standing ("Discovered", "Researching", "Can research now", "Later: needs ...
  first"), what it brings, what it needs and what it opens the way to (each with what else it waits for,
  "with Mysticism" or "then ready"), all links to their own cards, and along its bottom the city view's
  pictures of its wonders and buildings and its units' sprites where there is room. The Research button
  studies `researchTarget`: the advance, or for one further on the first step toward it. Keys: Up/Down,
  PgUp/PgDn, Home/End, Tab (the next choice), Enter, Esc. `Renderer.research`/`researchHit`. Since 2026-11-03 the
  web app opens it (`openTree`) only from the New Technology window's View Tech Tree; research is picked from the
  research list above everywhere else. When research is due it closes only on a pick.
  Opening window (`reign.ts` in renderer-api and renderer-retro; asked for 2026-10-26: "improve the
  starting game first message ... add civ image + short description and civ bonuses", in place of a plain
  message with the trait's line): a new game opens on the map with "A New Civilization", the New
  Technology window's parchment and gold a little larger (248x151, `reignRect`), centred over the darkened
  map: the people's name large over their leader and the year, the leader's setup portrait (the user's
  picture, laid at `reignPicture` on the setup cards' sky, `drawPortraitSky`) in a gold frame ringed in the
  civ's colour, The People (`CivRule.text`, three lines at most) and, under the trait's name, its bonuses a
  line each with an icon (`reignCard`, `traitBonuses`/`bonusLine`: numbers from the `TraitEffect`s, then
  "Starts knowing ..."; classic civs say every people is alike); Begin (Enter, Space, Esc, the close box).
  `Renderer.reign`/`reignHit`; the web app's `reign` screen, the "lead the ... to glory" line after it.
  End screen (`chronicle.ts` in renderer-api and core; asked for 2026-10-29: the screen of a fallen civilization
  showed its ruin, its score sheet empty, "need to show all the achievements of the entire civ history"): core keeps
  each civilization's history as it plays (`Player.chronicle`, `chronicleOf`; save version 44, bookkeeping no rule
  or AI reads, so old logs replay and build it): cities founded (`foundCity`), taken and lost (`captureCity`, a
  diplomat's incited revolt), fights won and lost (`resolveCombat`), units raised and wonders completed (the city's
  turn), the most cities and citizens it held and its best score with its turn (`notePeaks`, as its turn ends), and
  the turns of its first city and its fall (`checkElimination`). `endCard` lays out the end: the title (Victory,
  Civilization Fallen, The End), how it ended, the years of the reign ("The Romans, 3980 BC to 1250 AD"), ten rows
  of that history in two columns (icon, name, number), the wonders, and the verdict: the final score and rank, or
  for a fallen civilization the rank at its height ("At its height, your rule was Great."). `Renderer.end(card)`;
  retro `drawEndScreen` in `screens/title.ts`, modern a plain page.
  No tutorial: the one added 2026-10-27 (nine one-sentence tips in a window as each came due) was removed
  2026-10-31, asked for: "tutorial is bad - remove completly".
  New Technology window (`newtech.ts`; asked for 2026-10-23 with the user's template and a picture for
  each advance): every advance found (end of turn, village, diplomat, treaty, Debug) gets one, in turn
  (`announce` in the web app), before the research panel; a small window over the game since 2026-10-24
  (`modalRect`, 236x147, centred on the screen it opens over, which the web app draws first: the
  screen's `back`; the Building Completed window shares the frame, smaller: `builtRect`). Windows grow into place as
  they open (asked for 2026-10-24, "animate window modals entrance"): `WINDOW_ENTER_MS` (160) from two
  fifths of their size, `enter` 0..1 on `NewTechView`, `BuiltView` and `MenuState` (the web app's
  `enterOf`, timed from the window's first frame; dropdowns never), retro's `drawEntering` drawing the
  whole window on a scratch screen and laying it on grown about its centre; the user's pictures wait for
  the window to stand whole. A navy title strip (bulb,
  NEW TECHNOLOGY, close box), the name large over its era, the user's picture of the advance in a gold
  frame, then parchment panels: Description (`AdvanceRule.text`, a sentence of our own; `era` from `ERAS`,
  ours too) with "Needs ..." under it, Unlocks (`newTechCard`: the research card's gifts, one or two in
  their boxes with names, more as a line of names; "Leads to" the next advances when it brings nothing
  itself); View Tech Tree (the panel on that advance's card) and
  Continue (the next window, else the panel when research is due, else back). Left/Right/Tab, Enter (not
  held), T, Esc; the pointer lights a button. `Renderer.newTech`/`newTechHit`; retro draws it in
  `screens/newtech.ts` (`newTechPicture(screenW)` is where the picture goes), modern as a plain modal.
  The adapters drop the pictures of the screen under a small window (they would cover it), and the
  phone draws it on whichever surface is under it, the wide map's or a 320x200 screen's.
  Borders (`territory.ts`, toggled in Game > Options, which hides only the drawing): core's `claims`
  from the cities the viewer knows, the same land the rules read for trespass; `borderSides` gives the edges and
  where a line must reach past an inner corner. Drawn after all squares, under the fog. The minimap has
  its own switches (asked for 2026-10-28: "place on the minimap itself icon buttons to show or hide minimap
  names or borders"): two small stone buttons along its foot at the right (`minimapButtons`, 10 pixels a
  side, `minimapButtonAt`, `Renderer.minimapButtonAt`; a click flips one, `toggleMinimap` in the web app),
  the `label` icon (a card of writing) for its names, the civilizations' and the continents', and the
  `borders` icon (two lands and the border between them) for its borders; a button whose layer is hidden
  is darkened (`DIMMED`); their tips are panel tips (`PanelPart` `minimapNames`/`minimapBorders`,
  `panelTip`'s `shows`); `MainScreenView.minimapNames`/`minimapBorders`, `epochs.minimapNames`/`minimapBorders`
  per browser, shown when unset; names keep off the buttons. Game > Options rules only the map. The
  minimap's borders: every explored square a civ claims, land and sea, in its colour, solid and
  unshaded (asked for 2026-10-26: "show all the civ territory as filled color", then, of a tint inside a
  line of the colour, "still a counter and not a single color full filled area"; a unit on its own land
  in the darker shade); cities are a black dot there (a cross cut a young city's 3x3 land into a ring),
  and with its borders off a white dot in a cross of the owner's colour.
  The World Map (World > World Map; asked for 2026-10-26: "show borders as filled colors - if possible
  show civ names") is political whatever the toggle: retro `drawWorldMap` draws each square as many fine
  pixels as fit (8 small, 5 medium, 4 large), each civ's claimed land tinted toward its colour and its sea
  a little (`TERRITORY_TINT`, `mixColor` in palette.ts: the nearest palette entry to the mix, as `DIMMED` is
  built), a line of the colour inside the border, cities white in black, and each civ's name in its colour
  ringed in black over the middle of its biggest piece of explored land (`territoryLabels` in renderer-api),
  the biggest first, nudged up or down off other names and, nearby, off cities; only explored squares.
  The map and the minimap name the civilizations too, each with its borders shown (asked for 2026-10-28: "show
  name of the civ on the territory and on the minimap"; on the map Game > Options > Civ Names,
  `MainScreenView.civNames`, `epochs.civNames` per browser; on the minimap its names button): on the map once a civilization on view (retro `drawCivNames`), the World Map's
  spaced capitals in its colour ringed black, at spots fixed by its land as the places' names are
  (`civNameSpots` in renderer-api: in each `ANCHOR_CELL` block its explored land square deepest inside its border,
  never a city's, so a young city's 3x3 has none; the one nearest the view's middle first), else half a square or
  a square up or down, clear of the cities, their names and the place name (`nameRoom`, drawn after the place
  name, under cities and units); on the minimap over each civilization's biggest piece of land (`territoryLabels`,
  at least 3 squares), in its colour ringed black in the font, before the continents' small capitals, which
  take the room left (`minimapNames`).
  The unit awaiting orders blinks on the minimap in a yellow box (modern: a ring), so it can be found
  from anywhere. On the map it blinks as in the original, whole to gone, but smoothly (asked for 2026-11-01,
  after a fade to 55%, a grey silhouette, a gold contour and a beacon of light at its feet were each turned down:
  "revert unit turn indication to the original - opacity on off. just try make transition more smooth from 0% to 100%
  opacity + subtle glow silhouette around the unit"): whole 380 ms, fading out over 220 ms (eased), gone 180 ms, fading
  back in over 220 ms, all of it together: its picture by CSS opacity, its shield, marks and hit points on the canvas
  through the Bayer dither (retro `fade.ts`, `fadeOver`, from the square's pixels as they were, `fineCopy`). While it
  shows, a faint gold glow is traced round its figure (`ACTIVE_GLOW` 0.5, steady: a thin line and a light haze, the web
  app's `goldContour`, CSS drop-shadows on its picture, which follow its shape and fade with it; retro `drawContour`
  round a unit drawn as a sprite). Renderer-api `pulse.ts` (`ACTIVE_BLINK`, `activeOpacity`), `MainScreenView.opacity`
  and `glow`, `ArtSpot.opacity` and `contour`. It starts whole as a unit comes into play or acts, and stays whole while
  the view lingers on a unit that just acted. City names stand under their squares on the map (retro: the owner's colour ringed in
  black, drawn before the units so a name never hides one; asked for 2026-10-21).
  Roads and fields (`works.ts`): roads wander. Each square has a meeting point near its centre, and
  the course to each known road neighbour's bows and snakes, keyed by the pair and laid from the same
  end whichever square asks; every square draws whole courses clipped to itself, and the two squares
  beside a diagonal draw their part of it too (`roadWays`), so roads join without seams. Railroads
  lay rails and sleepers (spaced evenly along each course) on the same courses. Retro draws both at the
  fine grain in the terrain art's manner (asked for 2026-10-23, then "too wide, more subtle": `ROAD`,
  `RAIL` in `overlays.ts`; "drop the outline"): packed earth about three fine pixels across in muted shades (`earth`),
  lighter along its crown, flecked and its sides a shade darker and ragged as the road on the user's sheet of tile
  improvements (below) is, no dark edge (on 2026-11-02 it took that road's look whole, sandy, a fifth of a square wide
  with a dark brown edge, and was "too wide and taking all the focus - minimize and subtle them" the same day);
  a railroad lays dark sleepers across it with a bright steel rail either side shadowed outside. Over a river's water
  (Bridge Building) the road is a timber deck in the woods of the sheet's bridge, its planks across the way and a dark
  railing; elsewhere water under a course stays water. The sheet's four road pieces and its bridge are not drawn: they
  run four ways, the roads eight and wandering.
  Tile improvement pictures (2026-11-02, asked for with the user's sheet: "implement updated tile improvements"):
  `tools/sprites/works/works.png` (kept as supplied, a 4x4 grid: roads, fields of four kinds, mine, quarry, logging camp,
  oil pump, offshore rig, fishing net, pier, bridge; a red fringe of its background's removal at alpha 1 to 3, unseen) is
  cut by `tools/sprites/works/cut.ts` (pieces of alpha over 64 to the cell their middle lies in, every pixel the
  sheet's) into `apps/web/src/works/<id>.png` and renderer-api `work-art.ts` (`WORK_ART`); renderer-api
  `work-pictures.ts` says which stands where, only the picture (the rules know one irrigation and one mine):
  irrigation is fields of a kind for the land (`fieldsPicture`: crops on grassland and hills, wheat on the plains,
  ploughed earth in the desert and tundra, one of a few by a hash; on a river, fields with canals), a mine a timbered
  shaft, on mountains a quarry (`minePicture`), oil on land with a road to it an oil pump in place of its icon
  (`drawSpecial`'s `pics`), `Tile.rig` the offshore rig, `Tile.fishery` the net, and a city with a Harbour its pier on
  the first sea square beside it, sides before corners (`pierSquare`). One scale, the sheet's 350-pixel cell to a square
  (`WORK_SQUARE`), centred (`workArtPlace`, `ArtSpot.work`). Each screen (the map, the square's window, the city
  screen's map) lays them in drawing order (`layWork`, art-holes `layPicture`/`SquarePictures`): each picture
  remembers its square as drawn when laid (`fineCopy`), and once the screen is drawn whatever came over it since shows
  through (`sealPictures`): a resource's badge, borders, the fog's edge, names, yields. Fields are laid over the roads
  and railroads (asked for 2026-11-02: "place irrigation above the road"; a road shows between the plots), and where a
  work's picture (fields, mine, net, village) or a city stands, the square's resource is told by its mark in the top
  right corner, the work or city whole beside it (asked for the same day: "resources like elephents and horses cover
  completly the improvements", then, of the icon at half its size tried first, "i dont like the smaller resource
  solution ... maybe show a small symbolic icon on the tile edge"; the user picked a tiny silhouette on a round dark
  token, top right): retro `marks.ts` (`drawResourceMark`, `MARKS`, `MARK_SIZE` 13 fine pixels), a pictogram
  of our own for each resource, 9x9 fine pixels in cream (`rock` 7) on a slate token ringed near black, each the
  plainest thing that tells it (a horse's head, a bull's for the bison, antlers, a coin, a drop of oil, a whale's
  flukes, a fleece on legs for the sheep, two humps for the camel; the icons' own shapes at that size were blobs); `drawSpecial`'s `corner`, and `drawSpecialMark` for a city's square, drawn once
  the city stands (over its picture, shaded with it out of sight; on the city screen over its yields). A unit at work
  wears the mark of its job on the same token in the same corner (asked for the same day: "also change settler icons
  when working on something. maybe also same style silluette"; `drawJobMark`, `JOB_MARKS`: a receding road, rails on
  sleepers, a drop over furrows, a pickaxe, battlements over a gate, a broom, and for a unit camped to heal a heart;
  its picture cut round the disc, `markHoles`), where a black square held the panel's icon of the job before; the shade out of sight shades the picture whole, as a city's; fields let the square's
  own water show (`waterHoles`: a river through them, a shore). The villages are laid so too. The logging camp is not
  cut (no work for forests in the rules). The code-drawn fields (`drawIrrigation`, `fieldLayout`: plots in rows either
  side of a canal, running on into irrigated neighbours), mine, fishery (`fishery.ts`) and rig (`rig.ts`) stay for
  anything without a picture.
  Unit pictures (2026-10-28, asked for, twice in capitals: "implement new units sprite-sheet. USE AS IS - DO NOT
  regenerate"; a first try converted three of them into the palette with an outline and was rejected): the user's
  sheet of all 29 units (`tools/sprites/units/units.png`, 1774x887, magenta where the owner's colour goes) is cut by
  `tools/sprites/units/cut.ts` into `apps/web/src/units/<id>.png`, each unit by its own outline (the sheet is no even
  grid), every pixel the sheet's, and the cuts' sizes into renderer-api `unit-art.ts`. They are shown as they are,
  laid over the canvas like the buildings' pictures, the magenta left magenta (the shield tells whose a unit is):
  `drawUnitFigure` (retro `overlays.ts`) leaves a unit spot (`ArtSpot.unit`) where a sprite stood, on the map, the
  unit box, the city screen, the stack list, the square's window, the research card, New Technology and the military
  advisor; `unitArtPlace` stands it in its square at one scale (`UNIT_SQUARE`, 240 of the sheet's pixels a square;
  one that would not fit shrinks), centred on the square's foot, fighters and bombers in the middle. The marks drawn
  on the canvas show through it (`ArtSpot.holes`: the shield or two, hit points, rank, fortified frame, sentry line,
  job badge; the web app clips the picture round them, `clipPath`), the map's view clips it (`clip`), a window over
  it cuts a hole (`hideArtUnder`), a blow landing rings it in light (`lit`), and a ship going down tips and sinks
  under its waterline (`turn`, `water`; `sinkPicture`). `preloadUnits` fetches all 29 as a game starts. The sprites
  (`units.art.ts`) stay for anything without a picture. A unit added since comes as a picture of its own
  (`tools/sprites/units/<id>.png`, kept as supplied; `SINGLES` in cut.ts), cut to its bounds a few pixels out, every
  pixel as it is, and stood at a scale of its own (`UNIT_ART`'s third number, its pixels to a square): the archer
  (2026-11-01, asked for: "implement archer image"; 1254 square, drawing his bow, the owner's parts magenta as the
  sheet's) at 1400, his helmet to his feet (973) as much of the square as the sheet's militia (166 of 240); the war
  elephant (the same day, "same for war-elephant"; 1334x1179, its rider small on its back under a magenta caparison)
  at 1250, as wide as a square allows, as the sheet's chariot stands, so it looms over the horses; the explorer (the
  same day, "same for the explorer"; 1254 square, hat, bedroll and staff) at 1600, hat to boots (1113) as tall as the
  militia, as the archer; the fishing boat (the same day, "same for fishing boat"; 1254 square, a fisherman hauling his
  net under a magenta sail) at 1600, as big as the sheet's Sail, its smallest ship (170 of 240). The sheet's
  cut matches its 29 to the units of the first rules (`SHEET_UNITS`: those without `since`), the later ones lying among
  them in `UNIT_TYPES`.
  Unit moves (2026-10-28, asked for with the user's militia sheet, `tools/sprites/units/militia-anim.png` kept as
  supplied: 14 generated frames, attack 6, sentry 4, fortify 4, on a transparent background, no even grid):
  `tools/sprites/units/anim.ts` finds each frame by its own outline, anchors it on its front foot on the ground (the
  foot planted in all three moves) and lays the frames unscaled on canvases of one size (324x320, anchor 174,318) in
  `apps/web/src/units/militia-anim.png`, every pixel the sheet's (tools/sprites test); `unit-atlas.ts` (generated)
  holds each frame's source rectangle, anchor and drawing box. renderer-api `unit-anim.ts` is the one place to tune
  (`UNIT_ANIMS`: frames and ms per sequence, idle = the first sentry frame, fortified = the last fortify frame, the
  strike frame, `square` 340 atlas pixels to a map square, `pixelated`). `UnitAnimator` (a UI side channel run by
  the web app each frame, like `MotionPlayer`; `view.unitFrames` by unit id) picks frames by elapsed time: sentry
  loops, an order to fortify plays the fortify frames once then holds (one first seen fortified, or `fortifying`
  turning `fortified`, just holds), and a fight plays the attack round and round while it is shown (since
  2026-10-30, asked for: "when fight in combat - show militia fight animation as a cycle - not just once"; it had
  played once), on both sides (`BattleFrame.start` keys it, `fightStep`), at its own pace: the fight's first blow waits
  for the attacker's wind-up, its attack's frames before the strike (since 2026-10-31, asked for of the catapult: "too
  fast ... slow prepare to fire - than throw stone"; `strikeMs`, `MotionTiming.strikeMs` from the web app's own moves
  and the other civs' playback, `BattleFrame.strikeMs`; never sooner than `LUNGE_MS`, 150, the attacker standing its
  ground until the last of it, the rounds after at their pace, so the fight is that much longer: the militia's and the
  hoplite's 320 ms, the catapult's 1490 with its stone's flight; until then the wind-up was squeezed into the 150), so the strike lands with the
  first blow; the defender answers from that blow at its own pace; each strike is reported as it lands
  (`UnitPoses.impacts`), and the fight no longer shown, back to its orders. Combat itself is untouched. `unitArtPlace` stands every frame's canvas in the same box (the idle
  drawing centred, its foot a fine pixel up), so feet stay put. The magenta clothes take the owner's colour
  (`recolourOwner`, `OWNER_MAGENTA`: hue 288-336, saturation from 0.5, shading kept against the lit 0.85), made
  per frame and colour by the web app's `unit-frames.ts` and drawn pixelated at whole pixels. The static militia
  picture is no longer shown; the other 28 units stay magenta as drawn. `apps/web/unit-preview.html` (dev server
  only) shows every frame with its rectangle, anchor and bounds, the moves on four terrains in two colours, play,
  step, speed and a strike count. Asset limits: the back foot's distance from the front one varies between frames
  (up to 15 sheet pixels in the attack, 14 in the sentry loop), so the back foot shuffles a little; the art is drawn
  far finer than the map (an art pixel is about 2/3 of a screen pixel), so nearest-neighbour downscaling drops pixels.
  The militia's walk (2026-10-30, asked for with the user's sheet: "implement militia travel animation";
  `tools/sprites/units/militia-travel-anim.png` kept as supplied, 1536x1024, rows of 3 on a 512-pixel grid, six steps
  of a walk): cut as a grid into its own atlas, `militia-travel` (6 canvases of 394x433, anchor 150,431), since it is
  drawn larger than the first sheet (1.74 times as tall upright, the head 1.58 times) and an atlas has one scale. Every
  atlas has a rule in `UNIT_ANIMS` named as it is (its `square`, `ownerColour`, and `idle`: the frame it stands centred
  on), and a unit's rule may take frames from further atlases (`sheets`), numbered on after its own: the militia's
  frames 14-19 are the walk's 0-5 (`animSheet(type, frame)` says which atlas and frame, `animFrameCount`), each placed
  at its own atlas's scale with that atlas's home frame centred in the square (`unitArtPlace`), cut from its own image
  (`unitFrameUrl`, `units/<atlas>-anim.png`) and recoloured as the unit (the militia's clothes take the owner's colour);
  a further sheet's atlas is not prepared on its own. Scale 560, between the two ratios: his head level with the
  standing man's, he looks the same size walking as standing (592 matched heights and looked smaller, side on and
  slimmer). The militia's `travel` plays the walk while it is shown stepping, from the second step, as the settlers'
  does; facing left it is mirrored as the rest. A step of a unit that walks takes a whole cycle of its walk (asked for
  the same day: "cant see the walk - not enough time for a full cycle"; a step had taken 120 ms, the walk 600):
  `MotionTiming.walkMs` (the web app's own moves and the other civs' playback pass `travelMs`), 80 ms a frame, 480 ms a
  square, ending on the frame it stands in; a chain of walked steps is sped up to fit `WALK_CHAIN_MS` (2.4 s: five
  squares at the full pace, a railroad goto quicker).
  The militia winning (2026-10-30, asked for with the user's two sheets: "implement militia lost and won combat", then
  the same day "remove the lost animation - only win. the lost unit would vanish with effect": a losing militia
  flickers out in the burst as any unit; its fall, its sheet and the longer fight it needed are gone).
  `tools/sprites/units/militia-won-anim.png` kept as supplied, 1536x1024, rows of 3 on a 512-pixel grid: the club
  raised, the fists up, the proud stance. It came on a green screen, not clear: the cutter's `green` sheets are keyed
  first (`keyGreen`, tools/sprites `src/chroma.ts`: a pixel as green as its green exceeds its red and blue, nothing in
  the art being green; up to 30 kept as it is, from 160 clear, between part clear with its green brought down to its
  red or blue), every other pixel the sheet's (the tools test keys the sheet the same way). Atlas `militia-won`
  (373x483), its own scale (440: drawn at a size of its own, his head 66 pixels to the first sheet's 60, standing 352 to
  244, between head and height as the walk's), numbered on after the walk: the militia's `won` is frames 20-25. As the
  loser begins to burst (`BattleFighter.dying`), the animator turns the winner from its attack to its `won`, played
  through to its end even once the fight is over (1.24 s, the proud stance held longest), then back to its orders. Preview: `?unit=militia` (its walk among the moves).
  Settlers' moves (2026-10-29, asked for with the user's sheet: "implement settler - states sprite-sheet for actions -
  mine, irrigation, travel and road building"; `tools/sprites/units/settlers-anim.png` kept as supplied, 1536x1024,
  an even grid of 256-pixel cells, rows of 6: travel, road, irrigate, mine; each frame the man, the woman and the child,
  with the dirt and stones, on a transparent background with a faint glow round the figures): `anim.ts` takes a
  sheet's `cell`, so a frame is every piece whose middle lies in its cell and its anchor the cell's middle on its row's
  ground (the lowest foot in the row: the sheet keeps the frames in register, and the walking feet move as drawn); a
  faint pixel edging no figure (the glow) is left out. 24 canvases of 265x254 (anchor 124,252) in
  `apps/web/src/units/settlers-anim.png`. `UnitAnimRule`'s moves are each optional, a unit playing only those it has,
  and two kinds are new: `travel`, looped while the unit is being shown stepping (`UnitAnimator.update`'s `moving`, the
  web app's `shown.moving`: slides and nudges), from the second walking frame so even one step shows it under way, then
  back to its orders; and `work` by `WorkKind`, looped as long as the job lasts (road, railroad and fortress: the
  mallet; irrigate and clean: the spade; mine: the pick). Idle is the first walking frame; sentry and fortify have no
  frames, so they stand. `square` 246 (the walking family as tall as the still picture). `ownerColour` (false for the
  settlers: their magenta is shown as drawn, as the still pictures' is; the militia's colour was asked for) also
  makes `unit-frames.ts` make their frames once, whatever the owners. The preview page takes `?unit=settlers`.
  The settlers' walk (2026-10-31, asked for with the user's sheet: "impl. settlers travel (move from tile to tile)
  animation"; `tools/sprites/units/settlers-travel-anim.png` kept as supplied, 1536x1024, rows of 3 on a 512-pixel grid,
  the same family as the first sheet's travel row drawn larger, on a green screen keyed as the militia's win; a second
  copy on a dark glow was left aside): its own atlas, `settlers-travel` (6 canvases of 485x345), the frames put in
  register by their bodies (the passing steps drawn 22 pixels ahead in their cells), scale 443 (the people 1.8 to 1.84
  times the first sheet's, the whole 1.76 with the spade, twice as wide in their stride: scaled by the people, so they
  walk as tall as they stand). The settlers' `travel` is its frames 24-29 (`sheets`), from the second step, a whole cycle
  a square; they still stand in the first sheet's first travel frame, whose other five are no longer played.
  The founding (2026-10-29: first "add the build new settlement", a hut going up, then the same day "replace with the
  attached sprite-sheet, for new settlement epic effect - add zoom and some effect and delay to let the player see the
  new settlement establishment"): `tools/sprites/units/settlers-found-anim.png`, kept as supplied, 1536x1024, rows of 3
  on a 512-pixel grid: lift, raise, plant (the flag), unfurl, fly, cheer. `anim.ts` cuts it as a grid (`cell` 512); a
  piece lying across a cell's edge with a tenth of itself or more on each side is split at its thinnest column within an
  eighth of a cell of the edge (the hut sheet's posts and logs touched; none do now). Its atlas is a show of its own,
  `settlers-found` (6 canvases of 533x491, anchor 274,489), in `UNIT_ANIMS` as a rule with a `show` (`showFrame`) at
  scale 398 (the sheet draws the family 1.6 times the walking one's size: the woman 257 pixels for 159), so they stand
  as tall as they walked in; the settlers' rule names it (`found`). renderer-api `founding.ts` is the moment's timeline
  and the one place to tune it (`FOUNDING`, `foundingMoment(id, ms)`, `foundingShow(type)`: about 6 s): the view
  glides in over 0.9 s (eased) as dusk falls, the show starts 0.5 s in (lift 500 ms .. cheer 900), the light rises over
  0.6 s from the unfurling and the name from the cheer, and the cheer holds 2 s more; a key or click after 0.6 s cuts
  it short. Founding a city in the web app (`foundWithName`) glides the map to it and plays it (the `founding` screen,
  `MainScreenView.founding`: the moment plus the city's name), then opens the city as before; the turn does not end by
  itself meanwhile. Retro (`founding.ts`, after the map is drawn and zoomed, before the panel): the view blown up about
  the city to 4x the map at 1x (`FOUNDING.zoom`; never less than the player's zoom), the city gliding to the middle a
  little below half way, the pictures moved and grown with it (`moveArt`) and the city and its name left out; dusk
  through the Bayer dither round a pool of light on the founders, twice as deep further out, the pictures out in it
  dimmed; from the unfurling, fourteen rays of gold turning slowly behind the flag with a glow at their heart (worked
  out a screen pixel at a time: the moment costs about 4 ms a frame over the map's 13) and sparks drifting up; from
  the cheer, the name in large gold capitals under them, letter by letter, then "A NEW CITY" spaced under it. All
  under the pictures, so the founders stand in front of the light; hashes and time, never the RNG. Other civilizations'
  cities appear as ever; the phone plays it too (the zoom is the effect's own, not the map's). Preview:
  `?unit=settlers-found`.
  The hoplite (2026-10-30, asked for with the user's sheet: "implement hoplite sprite-sheet"), the first in the layout
  the sheets' prompt asks of every unit: one sheet, 1536x1024, a 256-pixel grid, rows of 6: move, attack (ready,
  anticipation, wind-up, strike, follow-through, recovery), victory, then sentry 3 and fortify 3 (ships and aircraft a
  6-frame idle there). `tools/sprites/units/phalanx-anim.png` kept as supplied (on a green screen, keyed as the
  militia's win); atlas `phalanx` (24 canvases of 385x258); its rule's moves are the rows (`travel`, `attack` striking on
  the strike, `won`, `sentry`, `fortify`, idle sentry-1, fortified the shield wall), shown as drawn (`ownerColour`
  false), scale 296 (between the still picture's shield and its crest-to-feet as that stands in its square; the still's
  spear is drawn longer). Its still picture is no longer shown, as the militia's. A generated sheet sets its figure a
  little differently in each cell (here the strike 38 pixels behind the ready stance to fit the spear, the
  follow-through 35 ahead, the walk drifting back 27 over its steps), so the cutter puts runs of frames in register
  (`align`, with the sheet's `home` frame): by the legs (planted in a thrust, a cheer, the watch) or by the body above
  them (a walk), each frame with the run's first and that with the home frame, by the sideways shift that lays most of
  their pixels in that part on each other's; only the anchors move, every pixel stays the sheet's. The kneel is left as
  drawn, behind the shield that stays put. Preview: `?unit=phalanx`.
  Every sheet in that layout is one entry in the cutter (`oneSheet` in anim.ts: its rows' names and what each run is
  registered by) and one in `UNIT_ANIMS` (`oneSheet(square)` in unit-anim.ts: the rows' moves and timings). The
  catapult (2026-10-31, asked for with the user's sheet: "implement attached catapult states", redrawn the same day with
  its crewman: "implement attached updated catapult sprite-sheet"): he pushes it on its turning wheels; raises the
  loaded arm upright, winches it back and down to cocked, holds it, lets go (the arm slams up, the stone flies off with
  its trail, the cart bucks, he stumbles back), and it rests empty; he steps away and cheers, arms up; he stands watch
  beside it with his staff (the sheet's fortify frames are the watch again). As wide as the first sheet's catapult alone
  (the cart drawn smaller beside him), so scale 252 still, between as wide as the still picture (295) and as much of
  the square (249). He crouches, steps and stumbles about the cart, so the cutter registers every run by the wheels
  (`align` "wheels": the lowest quarter of the picture, where they outweigh his feet; the cart is drawn up to 14 pixels
  off from cell to cell, and kicks back 12 as it shoots). The loosed stone lies across the edge of the next cell: a
  piece astride an edge is split only at a thin column (a third of its thickest or less), else it goes with the piece
  nearest it (the stone with its trail). Its shot (asked for the same day: "too fast. should be with ease in-out. slow
  prepare to fire - than throw stone", then "still very bad": it lunged onto its foe like a soldier, jiggled with each
  blow, and its stone only appeared at its own corner): it stands its ground and shoots once a fight (`UnitShot` on its
  attack: `from`, where the release frame draws the stone, atlas pixels from that frame's foot; `flightMs` 340; `arc`
  0.25 of a square), eased in and out: raised (260 ms), winched down (220, 260), held longest (300), quick as the stone
  leaves on the sheet's frame of it (110), the spent arm settling (480) and held so till he cheers. The map carries the
  stone on from that frame's end (renderer-api `shotOf`, `MotionTiming.shot` from both pacings, `ShotPace`;
  `BattleFrame.shot`: where it is, the ground under it, `landed`): the sheet draws it near the top of its square, over
  its foe's, so it comes down in a short drop to the ground before its foe's feet (`SHOT_LANDS`), mirrored when it shoots
  leftward, the first blow landing with it (`strikeMs` counts the release frame and the flight: 1490 ms), the attacker
  never closing in (no lunge, no jiggle); then the dust settles (`LANDED_MS` 380). Retro `shot.ts`: a light grey ball
  five fine pixels across (the picture's stone at the map's scale) edged in its darkest, its shadow on the ground under
  it, then dust puffs dithered thinner as they spread and rise, clods falling back, a flash at the strike; on the map
  under the pictures. Attacked, a unit that shoots stands as it was. `oneSheet`'s second argument overrides a move's
  frames or timings. On a green-screen sheet a speck (under
  `GRID_SPECK`, 20 pixels) is part of the drawing, kept with its cell's frame (the dots trailing the stone); on a
  clear sheet it is the glow, left out.
  Facing (2026-10-28, asked for: "flip units to face the direction they are moving or attacking towards"): renderer-api
  `UnitFacing` (a UI side channel run by the web app each frame; `view.facingLeft` by unit id) turns a unit the way it
  steps or is nudged across once the step is under way (`UnitMotion.heading`; one waiting its turn keeps its facing),
  or strikes (`BattleFrame.heading`; the defender turns to face its attacker), and it keeps that way; a step straight
  up or down keeps it, and a unit moved with nothing shown turns the short way round the seam. The pictures are drawn
  facing right and mirrored when facing left (`ArtSpot.flip`, CSS `scaleX(-1)`; the clip round the marks mirrored to
  match, so the shield stays top left): an animated unit's about the anchor its feet stand on, its idle drawing still
  centred in the square, any other's about its middle; a ship going down mirrored too. The map, the unit box and the
  fights show it; lists, the city screen and the square's window show units facing right. Sprites are never mirrored.
  City pictures (2026-10-29, asked for with the user's sheet: "implement attached assets for civ cities - USE AS IS!!! DO
  NOT regenerate"): `tools/sprites/cities/cities.png` (kept byte for byte as supplied: three ages in rows, ancient,
  medieval, industrial, by village, town, city, capital, each flying a blue flag, on a clear background) is cut by
  `tools/sprites/cities/cut.ts` into `apps/web/src/cities/<era>-<tier>.png`, each city by its own outline (the ancient
  capital reaches out of its 362-pixel cell), every pixel the sheet's, and the cuts' sizes into renderer-api `city-art.ts`
  (`CITY_ART`). `cityLook` picks one as before; `drawCity` (retro `map-city.ts`), given `picture` (the room it shows in),
  leaves a spot (`ArtSpot.city`) in place of the drawn icon on the map, the city screen's map and the square's window
  (also the conquest window's), and returns it; `cityArtPlace` stands it at one scale for all, the sheet's cell to a square
  (`CITY_SQUARE` 362), so villages stand smaller than capitals, centred on the square's foot, as units stand. The walls'
  back half is drawn under it, their front half and the garrison's shield through it (`spriteHoles`, `shieldHoles`); what
  the screen draws over the square later (a unit in play there and its marks, a fight's burst, a route's dot, the goto
  frame, the city screen's yields) shows through as it would over a drawn icon: retro `art-holes.ts` copies the square's
  fine pixels as the picture is laid (`fineCopy`) and holes it where they changed (`drawnOver`; a pixel only darkened by
  fireworks' dusk is not a change, and the pictures darken with the dusk). Out of sight a city's picture is shaded whole
  (`ArtSpot.unseen`, CSS brightness 62%, as `UNSEEN`); windows cut holes in it as in units (`hideArtUnder`), and
  `dimScreen`'s `keep` leaves a picture inside it lit (the Building Completed and conquest windows' city). The web
  adapters fetch all twelve as a game starts (`preloadCities`). The flags stay the sheet's blue (no owner colour), the
  shield, the label's plate and the borders telling whose a city is. The drawn icons (`cities.art.ts`) stay for anything
  without a picture (tests, the sprite sheets).
  Resource pictures (2026-11-03, asked for with the user's updated sheet: "updates resources sprite-sheet - USE AS IS!! do
  not regenerate assets"; their earlier sheets, and that morning's, had been drawn into the palette, see renderer-retro
  below): `tools/sprites/resources/resources.png` (kept byte for byte as supplied: 26 icons in rows of eight, cells 256
  wide and 192 tall, on a clear background whose soft colours have no alpha; the cell where Ivory stood empty: Ivory is gone, see Specials above) is cut by
  `tools/sprites/resources/cut.ts` (pieces of alpha over 64 to the cell their middle lies in, cut by their bounds two
  pixels out, every pixel the sheet's) into
  `apps/web/src/resources/<id>.png` (the icon's name: horses, offshore_oil) and the cuts' sizes into renderer-api
  `resource-art.ts` (`RESOURCE_ART`). Retro `drawSpecial`, given the screen's pictures (`SquarePictures`: the map, the
  city screen's map, the square's window), leaves a spot (`ArtSpot.resource`) in the room the icon took (`SPECIAL_SHARE`
  of the square, at least the original's 16 pixels) and remembers the square as drawn (`fineCopy` of the whole square),
  so what is drawn over it later shows through (`sealPictures`): borders, the fog's edge, the site pins, names, units'
  marks; `resourceArtPlace` stands the picture centred in that room at one scale, the sheet's cell across to the room's
  width (`RESOURCE_CELL` 256), so the icons keep the sizes the sheet gives them. Out of sight the picture is shaded whole
  (by the square it was laid on). The New Technology window's box and Advisors > Resources lay theirs too
  (`drawResourceIcon`). The corner marks (`drawResourceMark`) stay our pictograms. `preloadCities` fetches the 26. The
  palette sprites (`resources.art.ts`) stay for anything without a picture (tests, `npm run sprites`).
  Village pictures (2026-11-02, asked for with the user's sheet of five huts: "replace huts in game with attached veriety
  of huts"): `tools/sprites/huts/huts.png` (kept as supplied: a straw-thatched round hut, a timber hall, a mud-brick
  house, a hide tent, a stone cottage with a chimney, on a clear background) is cut by `tools/sprites/huts/cut.ts` into
  `apps/web/src/huts/<kind>.png` (thatch, timber, adobe, tent, cottage), every pixel the sheet's, and the cuts' sizes
  into renderer-api `hut-art.ts` (`HUT_ART`). A village's kind suits its land (renderer-api `huts.ts`, `hutKind`: adobe
  or a tent in the desert, tents on the plains, tundra and arctic, timber in forest, swamp and jungle, stone in the
  hills and mountains, thatch on grassland and in the jungle), one of a few for each land by a hash of its square; only
  the picture. `drawHut` (tiles.ts), given the kind and the room, leaves a spot (`ArtSpot.hut`) in place of the drawn
  huts on the map and in the square's window; `hutArtPlace` stands it at one scale (`HUT_SQUARE` 500: a hut 0.7 of its
  square across, a little wider than a city's village; 0.6 was easy to miss), centred on the square's foot. On the map
  the square is copied as drawn under it (`fineCopy`), so everything drawn over it later (borders, the fog's edge,
  names, a route's dot) shows through it (`drawnOver`'s `shaded`: the shade out of sight is not a mark, the picture
  being shaded whole, `ArtSpot.unseen`); windows cut holes in it (`hideArtUnder`). `preloadCities` fetches the five
  with the cities. The drawn huts (`features.art.ts`) stay for anything without a picture.
  Entering one (asked for 2026-11-02: "when enter a village hut - first the unit need to visibly enter the hut and only
  then show the hut result"): the rules open a village as the step is taken, so the web app holds it on the map
  (`MainScreenView.villages`, an `EnteredVillage` from core's `hut` event, which carries the square and the `units` it
  brought; `holdVillages` after our own moves and as our turn begins), and what it brought (mercenaries, an ambush) out
  of sight, while the unit walks in; once the slides have landed the unit sacks it (asked for the same day: "when unit
  enter a village hut - add a sack village animation"; the web app's `sack` screen, `openVillage`, about 2.1 s, a key or
  click after 0.4 s cutting it short; renderer-api `sack.ts`, the timeline: `Sacking`, `SACK`, `sackBlows`, `sackFall`,
  `sackLength`, `sackLoot`, `sackedHut`, `sackAside`; `MainScreenView.sacking`): the unit steps aside from the hut, on the
  side it came from, and strikes at it, a unit with an attack of its own playing it at its own pace (`UnitAnimator`'s
  `sacks`, `SackStrike`), its blows landing with the strikes (else on a beat); each blow jolts the hut a pixel and knocks
  chips of its stuff off it (straw, timber, mud brick, hide, stone by its kind); with the last, what it held bursts out:
  gold coins (4 to 10 by the gold, most flying away from the unit, spinning, then lying glinting about its foot) or a
  scroll rising over it among sparkles (mercenaries, an ambush or nothing bring nothing out); then the hut goes down
  under its foot into a cloud of dust, smoke and embers rise, the unit cheers (its `won`) and steps back. Retro
  `sack.ts`: `sackHut` moves the hut's picture and clips it at its foot, `drawSack` draws the rest on the fine grid
  after the units (loot over the dust and smoke), the hut holed where they cross it. Sounds: a hit each blow, the
  `gift` jingle for coins, a `crash` as it falls. Core's `hut` event names the unit (`unit`). Then the village goes
  and its window opens (`hutModal`).
- `packages/renderer-retro` — indexed 320x200 `Surface`, 256-colour `palette.ts`, bitmap
  `font.ts`, `widgets.ts` (panel/menu/box), one file per screen in `src/screens/*`.
  Fine art (merged from branch terrain-tiles-test, 2026-10-21, asked for): the screen keeps its 320x200
  layout but holds `DETAIL` (2) x 2 fine pixels per screen pixel (`Surface.k`, `fw`/`fh`, `fset`/`fget`/
  `frect`/`fblit`; `Surface.screen()`, `Surface.fine()`), so a 16-pixel square shows a 32x32 picture.
  Terrain (`terrain.art.ts`, from the user's second terrain sheet since 2026-11-02, asked for: "implement updated
  attached terrain tiles - add the forest verity for forests around the map - same for mountens"; the sheet kept as
  supplied in `tools/sprites/draw/terrain.png`, 5x4 tiles of about 32 art pixels on an uneven grid, converted by
  `draw/terrain.ts`: each tile's box between the gutters cut into 32x32 blocks, each the block's commonest colour
  among the five ramps nearest the tile's, hue weighed over lightness, a tile's mottled ground snapped to one colour
  and every tile on grass taking the grassland's ground; no mirroring; two blues: coastal `ocean`, open
  `deep_ocean`; the sheet's river tile is not drawn, the code-drawn rivers taking its blues, `WATER` in tiles.ts).
  Forests and mountains come in kinds, only in the picture (renderer-api `terrain-variant.ts`, `terrainVariant`,
  `forestKind`, `mountainKind`; retro `squareSprite`, `VARIANT_SPRITE`): forest (broadleaf), `forest_pine`,
  `forest_birch`, `forest_autumn`, `forest_mixed`; mountains (grey), `mountains_snow`, `mountains_red`,
  `mountains_ice`. A square's kind is read from the explored squares round it as a climate would have it (pines,
  then mixed woods and birches, by tundra, ice, hills and peaks, never by jungle, swamp or desert; a glacier beside
  arctic, snow beside tundra, red rock beside desert, snow on a range's inner peaks with four mountains round it) and
  where that says nothing from slow noise of its world position (`PATCH`, patches about eight squares across: autumn
  woods, snowy and red ranges); no RNG, no save version; only explored squares count, as the shores, so a square at
  the edge of the explored land may change kind as its neighbour comes to light. A glacier stands on the ice's
  ground (`groundAt`), so the arctic beside it blends with no grass; the drawn square's cache key carries each
  square's sprite and the patch's grounds (`patchGrounds`). On a generated world about a third of the forests are
  broadleaf, a fifth to a quarter pine, the rest birch, autumn and mixed; about half the mountains grey, the rest snow and red,
  a few glaciers. Before 2026-11-02 the terrain was the first reference sheet (2026-10-21), recovered pixel for
  pixel, one picture a terrain), units (`units.art.ts`, the user's 32x32 sheet of the
  original's 28, standing free with the owner's shield in the top-left corner, `drawShield`/`SHIELD_AT`,
  bearing its colour slot's device (`DEVICES` in `overlays.ts`, in the colour's darker partner: white a pale,
  green per pale, blue a cross, yellow plain, cyan a chevron, magenta a base, grey a roundel, orange a fess,
  the barbarians' red a saltire; asked for 2026-10-26: civs "same color ... maybe a color blind issue". No
  nine colours stay apart for the colour blind (green, yellow, orange and red look alike to the red-green
  blind whatever their shades: measured in CIEDE2000 under Machado's simulations, the best palette pick kept
  pairs near 10), so the colours alike get devices least alike, each still its own below a wounded unit's
  hp strip; cyan became the EGA's deep cyan and grey `stone` 3, light cyan and light grey having looked
  white beside the Romans; `tests/colors.test.ts` draws `civ-colors*.png` and `civ-shields*.png` as each
  colour blindness sees them; the lists' swatches (`drawSwatch`) are the shield too),
  a second shield behind for a stack, hp as a strip across its top, its rank's gold chevrons in the top
  right corner (the rank icon, `drawRankMark`); no owner box), cities
  (`cities.art.ts`, the user's 4x3 sheet of 2026-10-22 converted by `tools/sprites/draw/cities.ts` from
  `cities.png`/`cities.json` beside it: ancient, medieval, industrial by village, town, city, capital,
  each flying a flag in its owner's colour; renderer-api `cityLook` picks one: the age of the owner's
  homes as the city view shows them (`homeAge`: medieval from Construction, industrial from
  Industrialization), village below size 4, town below 8, city from 8 (`CITY_TIER_SIZES`), and the
  capital for the city with the Palace whatever its size; `drawCity` in `map-city.ts` adds the wall ring
  and the garrison shield), features (`features.art.ts`: walls/walls_front, hut, mine, drawn by
  `tools/sprites/draw/features.ts` as layers lit from the upper left with one-pixel outlines in the
  darkest of each thing's own colours). Nothing but the corner shield is drawn on a city's square: its
  population sits on a plate of the owner's colour before its name under the square, and its mood
  (the viewer's own cities) as a pennant before the plate, another civ's city its owner's shield there
  (`drawCityLabel`, `drawMoodPennant` in
  `screens/main.ts`; asked for 2026-10-21/22 after overlays on the town hid it) and resources (`resources.art.ts`, since 2026-11-03 only the fallback for the user's pictures laid as they are,
  see Resource pictures above; named after the special: the user's sheet of 22 icons of
  2026-10-27, "replace ... resources on terrain tiles", redrawn 2026-11-01 with 24 ("implement attached updated resources
  sprite-sheet": Elephants and Oil at sea added, `offshore_oil`) and 2026-11-03 with 26 ("updated resources sprite-sheet":
  Sheep and Camels added, rows of eight in cells 256 wide and 192 tall, the cell where Ivory stood left empty, Ivory
  being gone; the bison stands for the Bison herds and
  for grassland's Resources of games before save version 26, `iconName`), converted by `tools/sprites/draw/resources.ts`
  from `resources.png`: each icon its solid pixels (alpha over 128; the glow behind them fainter, left out), each piece going
  to the cell its middle lies in so an icon reaching over its cell's edge comes whole (the stag's hooves; a flood of the
  glow's colours from the cell's edge did it before, and cut them off), a 256-pixel cell the map's square (three of the art's pixels to
  two of ours; two to one was muddy), each icon in the five ramps nearest its colours, the silhouette's edge
  the block's darkest colour so the outline stays one pixel in the icon's own dark shades) are all 32x32 sheets with `k = 2`; icons are 16x16
  fine; citizens 32x32. Land borders blend: renderer-api `groundOwner` warps each fine pixel by world
  noise so the line between different grounds wanders, and each terrain sprite splits at load into
  ground + objects (objects never cut). Text (`font.ts`): our own proportional pixel font drawn on the fine
  grid, a dot one fine pixel: capitals and digits 5x9, small letters six tall under three rows of
  ascender, two descender rows, every stroke one dot with square corners. Drawn 2026-10-24 for a middle
  size ("either you make it huge or too tiny... not too big not too small - AND READABLE"): the 4x6-dot
  letters before it (2026-10-21, "make game font more pixelated") were twelve fine pixels tall with 2x2
  dots ("too big") or six with single dots ("too tiny"), and a 3x5 grid of whole screen pixels was "not
  readable"; nothing crisp lies between those but letters drawn for the fine grid. Glyphs stand in the
  middle of their 8-pixel line (`FINE_TOP`); widths are measured in dots, rounded up to screen pixels
  (`textWidth`), so menus, wrapping and hit tests follow. `drawTextLarge` (headlines) is `scale` fine
  pixels a dot, `drawSpaced` a dot apart, and `drawTextPlate` (the city size, `textPlateWidth`) fits its
  letters; `FONT_HEIGHT` 8 stays. `drawTextPlate` puts text on an edged plate (the city size). The palette
  is FULL: ramps `hide`, `mire`, `canopy`, `rock`, `ice` (in the old ui/fog/swamp/jungle slots),
  `meadow`, `leaf`, `mound`, `wheat`, `dune`, `heath`, `sea`, `steel`, and `jewel` (6 colours, 249-254;
  `shade` clamps to `RAMP_SIZE`); `town` (the city icons' colours, not a dark-to-light ramp) took the
  city view's `copper` slots, copper now drawn from `steel`; `skin` is likewise named colours (the citizens'
  outline, the jester's plum, the scientist's coat; 4 and 7 the browns the city icons and the deepest skin
  share); new art must reuse these ramps or free one. `heath` 0, 1 and 6 and `mound` 5 (bags of the first terrain
  sheet's colours, not ramps from dark to light), which nothing drew once the second sheet came, hold the autumn
  forest's dark red, red-orange, deep orange and orange since 2026-11-02, and the sprite legend's `m` is the
  civilizations' orange (`C.ORANGE`), for its brightest leaves. Panel icons (`icons.art.ts`,
  drawn with `src/icons.ts`) and the small marks (`drawMark`: tick, new, moves) are hand-drawn
  16x16: food is an ear of wheat, `shield` (production) a steel-rimmed blue shield as the original showed
  it (a hammer until 2026-10-24, "not good"), `people` a head, `happy`/`unhappy` a smiling and a frowning
  face (these three from the user's citizens sheet); roads,
  rivers, irrigation, rails, forts and smog stay code-drawn in `tiles.ts`/`overlays.ts`.
  Citizens (city screen) are the user's sheet of people (2026-10-25, after four rounds of our own figures
  were "bad"), recovered on its own grid and fitted to the palette (the sheet had no even pixel grid: each
  figure resampled at one scale, colours clustered, then matched): a man and a woman (`<mood>-m`/`-f`)
  for each mood (happy, arms up, yellow; content in linen; unhappy, arms crossed, red) and trade
  (entertainer a jester in plum, taxman in orange with a hat and purse, scientist in a pale coat with a
  flask), 20x26 fine pixels (`CITIZEN_W` 10 x `CITIZEN_H` 13), standing `CITIZEN_PITCH` (8) apart at most
  so raised arms and props reach over a neighbour. The art text is the source now (no generator);
  `citizens.ts` swaps the sheet's skin (flesh 6/5/4) for each person's tone (six, `citizenLook`); hair,
  trousers and style play no part. The face before the row (the Happy panel's button) is the city's:
  smiling, frowning while the unhappy match or outnumber the happy.
  Who stands where is `citizenLook(city, i)` in renderer-api (a hash, so the same people every frame);
  the modern renderer paints the same people in `renderer-modern/src/citizens.ts`.
  Chrome, as the original's main screen: every panel, window, page and button is the same light
  speckled stone (`panel` ramp, `drawStone`/`drawPanel`, `drawWindow`, `drawPage`; `stipple` by screen
  position) with a blue title strip and selection (`azure` ramp), on black. Text on it uses the inks in
  `widgets.ts` (`INK`, `DIM`, `FADED`, `GOOD`, `BAD`, `NOTE`, `GOLD`): the bright EGA colours are lost
  on light grey. The city screen's goods are rows of icons (`iconRow`, `storeGrid`). The old brown `ui`
  ramp stays in the palette only to keep later indices in place.
- `tools/sprites` — `npm run sprites -- export [dir]` writes the sheets as PNGs (8 sprites wide,
  1:1, magenta = owner colour); `npm run sprites -- import <sheet>.png` writes an edited sheet
  back into `src/art`, rejecting any pixel outside the sprite's palette legend; `npm run sprites -- icons`
  draws the mobile app's icons (a walled city, `icons.ts`) into `apps/mobile/public/icons`. A sprite may
  name up to five ramps (`ramps=a,b,c,d,e`; characters 0-7, a-h, A-H, JKLMOQST, jloqstvx), for pictures
  of many colours. `draw/*.ts` make sheets: `cities.ts`, `features.ts`, `citizens.ts` (the city screen's people from part grids),
  `resources.ts` (the user's resource icons from `resources.png`), `terrain.ts` (the user's terrain tiles from
  `terrain.png`; `npx vite-node --script tools/sprites/draw/terrain.ts [preview.png]`, the preview each tile beside
  its sprite).
- `packages/renderer-modern` — canvas-2D renderer on a 960x600 logical surface (same panel/
  viewport split, 48px tiles): `theme.ts` (all colours and fonts), `draw.ts` (panels, wrapped
  text, bars), `tiles.ts`/`markers.ts` (terrain, overlays, units, cities), `screens/*`. It draws
  through a `Context2D` subset so Node tests use a recording fake.
- `apps/web` — `main.ts` (screen stack + input; draws with the retro renderer only: the modern one is
  set aside for now, still built and tested but not offered), `retro-renderer.ts` (adapter), `display.ts`
  (canvas fitting: crisp integer scale for retro, DPR-aware for modern), `storage.ts` (IndexedDB saves,
  per browser: slot 0 is the autosave, written as every turn begins and when a game starts or loads).
  The title offers "Continue" (the autosave). The game's saves carry its state as well as its log (asked for
  2026-10-28: "should you just save a state and build new game from the state"): `withSnapshot` (autosave,
  Save Game, the phone's save on hide) keeps a deep copy (`copyState`; 586 KB in the browser's store at turn 150
  with seven civs, small world), and `loadSnapshot` takes it back as it is when the save is of this
  `SAVE_VERSION` and its seed and turn agree: Continue in one frame (17 ms, against 2.3 s replaying). The log
  stays the save's truth: `loadSave` always replays it (headless `--verify`), `rewindSave` and `serializeSave`
  (JSON) drop the snapshot, and a snapshot played on matches the game and its replay exactly
  (`packages/ai/tests/ai.test.ts`). A save without a snapshot (older ones, or of another version) replays
  its whole log, every computer player's turn included (about 2.5 s at turn 150 with seven civs, growing with
  the game), then is saved again with one; that replay goes a slice of each
  frame under a Loading window (asked for 2026-10-28: Continue froze the page for seconds): core's
  `replaySave` is `loadSave` as a generator yielding after each command (`ReplayProgress`: the turn reached),
  the web app's `loading` screen runs it `LOAD_SLICE_MS` (70) a frame once the window stands whole
  (`stepLoading`), and `Renderer.loading` draws the window over the screen it opened on (`LoadingView`,
  `loadingView` in renderer-api: the save, a bar of the turns replayed, "Retracing history: 875 BC"; retro
  `screens/loading.ts`). Nothing to press; a failed replay goes back with "Load failed". Going back to an earlier turn is gone from the game
  (the title's 2026-10-22, the Game menu's 2026-10-24, both asked for); core's `turnStarts`/`rewindSave`
  (`save.ts`) stay, tested, for anyone who needs a log cut back. The turn ends by itself only once the player has ordered the last unit awaiting orders that turn
  (`actedThisTurn`, `AUTO_END_MS` after; asked for 2026-10-24: "auto next turn when no actions left, but
  not auto when no actions at all. auto only for 1 turn", after the always-on Auto End Turn was dropped
  that morning for "click enter for next turn - like in the original"): a turn that begins with nothing to
  order waits, the status panel's End of Turn standing with "Press Enter" blinking in and out under it (the lit blue
  block it had was "too loud", 2026-10-24), and Enter or a click on it
  (`statusAt` "endTurn") ends the turn, the phone's way too.
  Sound (`sound.ts`, `GameSound`; asked for 2026-10-27): effects and a looping tune made in the browser with the
  Web Audio API from oscillators and noise on notes of our own (`SFX`, `TUNE`: two eight-bar halves in D dorian,
  a square lead over a triangle bass), nothing downloaded; silent until the first key, click or touch (the
  browser's rule), hushed while the page is hidden. Effects: a menu pick, a refused move, a city founded, a
  building or wonder finished, an advance, a fight (a clash, each blow, the loser's burst, read off
  `view.battle` each frame, `battleSound`), a city taken or lost, war, a meeting, a gift, a leader's demand, the
  turn's end. Game > Options has Sound and Music (`epochs.sound` in localStorage); the phone app shares it.
  Diplomacy: a meeting first holds the map on whom we met (the `beat` screen:
  a callout, 1.6 s or any key), then their leader receives us (`audience`), a talk (redone 2026-10-25,
  asked for: a choice answered by buttons for its opposite, war's "Keep the peace", "Break the treaty"
  right after signing, "Close borders" after opening them, was "very confusing"; "a smooth logical flow
  of talk between civs"). Each button is something we say, the leader's answer becomes their words, and
  the buttons after it follow from it (`talkTopics`, `talkButtons` in renderer-api `audience.ts`, the talk's
  `TalkMemo`): nothing said already; nothing needing a treaty before one (maps, open borders); once the
  talk turns friendly (a treaty, a deal, a gift) no demand or war, once it turns hostile (a demand) no
  proposal or gift, so a refused demand leaves war or farewell; at war only peace and farewell. What we
  may say falls under three subjects: proposals (peace, `proposePeace`: yes, for `peacePrice` or no; a pact; an
  alliance; with Writing open borders, `bordersAnswer`; an exchange), gifts and demands (their units off our
  land, tribute, close borders, declare war or break the treaty). Tribute needs no Writing since 2026-11-02 (asked
  for: "add a demand tribute option for the player"; it waited for Writing before, so early on it was never offered),
  and the civ card has it too, Demand tribute in red out of war beside Talk (the web app's `demandTribute`, shared by
  both: the AI's `tributeOffer`, a leader under half our strength paying a share of its treasury once in 20 turns, the
  rest refusing). Writing and Trade stand for
  the knowledge that brings more to say (asked for 2026-10-24, "when get diplomacy tech add more diplomacy
  options, when get trade tech add trade options"; the tree has no Diplomacy, so Writing, the Diplomat's).
  Gifts (asked for 2026-10-31: "give gold - why? - replace with offer a gift (to improve relationship) with also
  other options") are always one button, Offer a gift (never spread), opening Gold (a tenth, a quarter or half our
  treasury, `giftAmounts`, thanked by its weight to them, `giftWeight` modest, generous from half their `goldScale`,
  lavish from 1.5, `giftThanks`), An advance (any of ours they lack) and with Currency A resource; with only gold to
  give it opens on the sums. Since save version 51 an advance or a resource given sways a leader as gold does
  (`recordGift` at `advanceWorth`: the beakers of their next advance; `resourceWorth`: half their `goldScale`;
  `GIFT_WORTH`), and a gift that leaves them a step warmer says so ("Our peoples draw closer."); saves before 51 load
  with `plainGifts` (only gold counts). An exchange (asked for the same day: "add exchange as a inner new section.
  were you can exchange several things with one another - gold, techs and resources. resources given could provide
  a steady income (+sum each turn) for a civ"; Make an exchange, among the proposals when there is something to
  trade, `exchangeGoods`): a table beside the leader's portrait (the card layout, `dealCard`: We offer, They give),
  the buttons We offer..., We ask for..., Propose, Back; each side's list by kind (Gold: sums and, for resources the
  other side gives, gold a turn, `perTurnAmounts`; Advances with Trade; Resources with Currency, theirs only the
  spares they would part with), picking one on the table taking it back (`dealItems`, `toggleDeal`). The leader
  answers by the AI's `exchangeAnswer` (`DEAL`: gold a turn as 12 turns of it, an advance it gives at half its worth,
  a resource it wants at its worth and one it has no use for at a quarter, a spare one it gives at half; wary asks a
  quarter more; never while hostile, never a resource it needs, never more gold a turn than its cities bring), and a
  deal too thin for it names the gold that would settle it, a button of its own ("Add 20 gold"). Agreed, the core
  `exchange` command hands everything over at once (`whyNoExchange`, `applyExchange` in core `exchange.ts`; our
  advances found as any, `discover`); each resource is a lasting trade, and gold a turn is paid by its receiver to
  its giver as the receiver's turn begins for as long as the trade stands (`ResourceTrade.pay`, `payTrades`, shared
  among the resources it pays for), a turn it cannot pay ending it (`tradeEnded` "unpaid"; `tradeIncome`). The old
  trades of knowledge and of resources are gone from the talk (core's `exchangeAdvances` stays for old logs).
  Up to four buttons, farewell last: a subject's topics stand as buttons where they fit, else the subject
  is one button ("Make a proposal", "Offer a gift", "Make demands") opening its list with the leader's
  question (`SUBJECT_WORDS`, by mood) and Back; the subject just talked of spreads first, so the talk keeps its
  thread. A question that wants our yes (their price, war: `warWarning`) has a button saying it ("Pay 50 gold",
  "Declare war!") and one saying no ("No", "Keep the peace"); the close box or Esc is no too. A declaration of war
  ends the talk on the leader's words and Farewell.
  Greetings name admiration or scorn; after the envoy's treaty the talk starts friendly. The audience screen (redone
  2026-10-22 after the user's mock-up "Caesar Welcomes You to Rome", asked for; a window over the
  darkened map since 2026-10-24, "not 100% of the screen": `audienceRect` 264x186 centred, growing into
  place as a new audience opens, `DiplomacyView.enter` timed by the web app's `audienceKey`; the
  web app draws the map under it): the realm across the
  title strip (`realmName`: "The Roman Empire", Kingdom, Republic... by government) with a close box
  (`Renderer.diplomacyCloseAt`: Esc); the strip, the panel and the picture's frame take the leader's
  mood's colour with its word at the strip's left (asked for 2026-10-24: `DiplomacyView.mood`, the
  AI's `attitude`; `moodColours`: deep green FRIENDLY, amber WARY, dark red HOSTILE, navy with none),
  the user's picture of the
  leader in their palace whole, frame and all, then the leader's name, their words and our choices as
  the game's stone buttons (`DiplomacyView`, `Renderer.diplomacy` and
  `diplomacyChoiceAt`): never more than `AUDIENCE_CHOICES` (4, asked for) at once, so the proposals
  are grouped into screens (the X or Esc goes back), and long lists (their advances) page with More... (`talkMenu`,
  `pagedChoices` in the web app; arrows, Enter or 1-4 pick, Esc steps back, the pointer lights a button;
  a talk with no choices, a war declared on us, closes on any of them).
  The pictures are shown as they are, full size and true colour (asked for, 2026-10-22: squeezed into the
  palette at 224x126 they looked "bad and distorted"): `apps/web/src/scenes/<leader>.webp` (the PNGs as
  supplied, WebP quality 92), laid over the canvas as an <img> by `pictures.ts` (`showPictures`, once a
  frame from each retro adapter's `present`; they let clicks through; one element per picture, made and
  decoded by the preloads and shown only once decoded: a reused element given a new `src` kept painting
  the last leader met for a moment, 2026-10-23) in the room the screen leaves for
  them (`audiencePicture(screenW)` in renderer-retro, 192x108 in the window, `cardPicture` for a card's
  portrait; laid from the window's first frame, growing with it, `diplomacyPicture`, renderer-retro `enteringBox`;
  asked for 2026-10-31: the room showed "a bluish color" while the window grew, the picture laid only once it stood
  whole; beneath the palace the darkest stone, seen only until it loads, a card's portrait standing on a dusk sky;
  the leaders' portraits preloaded with their palaces, `preloadScenes`);
  `Renderer.prepare` preloads a game's leaders as it starts or loads. With the setup's portraits
  and the advances' pictures (`techs/<advance>.webp`, 1254 square, WebP quality 92; `techPicture`: all but
  the 1991 tree's Future Tech., which shows the frame's bed; each adapter's `main` fetches the picture
  of the research under way, `preloadTech`) and the buildings' (`buildings/<id>.webp`, 1254 square, WebP quality
  92; laid at the screen's `Surface.art` spots; `preloadBuildings` fetches what our cities are building), and the
  units' (`units/<id>.png`, see Unit pictures below), the only things the retro look does not draw through the palette. The phone app caches each picture when first shown,
  not at install (`.webp` left out of sw.js's list). An envoy's offer (`peaceOfferAudience`) is signed or refused; signing goes on
  into an audience. The Foreign Minister shows the standing (`standing`), each civ's influence and
  whether they admire or scorn us (`regardWords`); Enter there opens a civilization's card. Stepping onto land that minds us puts a
  note beside the unit ("Babylonian land: leave by next turn", `landNote`); once a demand stands, a step in
  (once a civ a turn, later steps get a callout) and the AI's demands after its turn show our unit, then the
  leader asks us out (`askToLeave`: leave = gotos to the nearest square outside, `stayPrice` gold, or stay); an AI declaring war on us says so in an audience.
  A leader's demand or request comes as an audience after its turn (`proposalAudience`: "Pay 80 gold" while we
  have it, or "Make the trade", and Refuse; the close box refuses), and its gift as one with its words
  (`giftAudience`).
- `apps/mobile` — the web game as a PWA for phones and tablets, asked for without changing the web game:
  `src/main.ts` imports `apps/web/src/main.ts` as it is, and `vite.config.ts` (`webGame`) hands that file
  three stand-ins for its own modules: `display.ts` (the screen as wide as the phone held sideways allows,
  `screenWidth`: 320 to 480 logical by 200, as large as it fits in the safe area, `layout.ts`; no buttons
  beside it, asked for: minimum UI; `toLogical` from the canvas rect at any scale), `renderer.ts` (its own
  retro adapter: the map's screen on a surface that wide, the panel at the left, the menu bar across, the
  viewport taking the rest, `viewAcross` in renderer-retro; every other screen on the original's 320x200 in
  the middle, its hit tests shifted by that inset, `narrowPoint`; menus and prompts over the map centre on
  the whole width; the map drawn and hit-tested through `MapPan`: a finger's drag, let go when the game
  moves its camera, the active unit changes or a key is pressed on the map; zoomed by a pinch,
  `MainScreenView.zoom` 1-3 kept in localStorage; `width`, `viewTilesX`/`viewTilesY` getters that follow
  the phone and the zoom so the game centres and follows in what shows; taps mapped back with
  `unzoomPoint`; keeps the frame's `TextInputState`) and `storage.ts` (same slots; remembers the last
  autosave so `save.ts` can save the turn so far when the page is hidden). Keep those three web modules'
  exports as they are (each stand-in `satisfies` its web counterpart's type). It reads `window.civ`
  (`screen`, `state`, `log`, `menu`) from web main.ts: keep that hook. Sideways only (asked for): the manifest
  asks for landscape, `touch.ts` locks it where the browser lets a page, and held upright index.html shows
  "Turn your phone sideways" over the game (only where the pointer is coarse).
  The deployed site (Netlify) is this app, so a desktop browser plays it too, with a mouse: there (the device's main
  pointer fine, `fingers()` in its renderer, `matchMedia("(pointer: coarse)")` read live) every menu keeps the web
  game's `DESK_MENU` rows, with no large setup buttons and no Choose button on the setup cards (asked for 2026-10-31:
  "on prod web - show huge menus like its mobile"). Everything below about finger-sized menus holds where fingers play.
  Menus are sized for a finger (asked for 2026-10-25: "some menus are too small and hard to click",
  the web game unchanged): its renderer hands `TOUCH_MENU` (widgets.ts `MenuSize`) to `drawMenu`,
  `menuHit`, `menuRows`, `menuScrollAt` and `menuRect`, whose default is the original's `DESK_MENU`
  (pixel for pixel as before). Its words are twice the font's size (asked for the same day: "only on
  mobile - enlarge default font size", for windows and menus only: the map's panel, the city screen,
  the research panel, the advisors and the New Technology, Building Completed and audience windows
  keep the font's size): `MenuSize.text` 2 draws labels and paragraphs with `drawTextLarge`, the icons
  among them doubled (`drawIconLarge`, `drawIconLine`'s `scale`), the title in a taller strip
  (`TITLE_H_LARGE`, `drawWindow`'s `scale`), rows 19, buttons 22 tall and 80 wide, windows up to 92% of
  the screen; a window that would run off the screen so falls back to `TOUCH_MENU_SMALL` (the font's
  size, rows 15, buttons 19, a scroll bar 10 wide either way);
  a drag over a list too long for its window scrolls its rows (`scrollRows` in `menus.ts`, the choice
  staying on view). Where they fit, menus are stone buttons instead (renderer-retro `screens/choices.ts`,
  `drawChoices`/`choiceAt`/`choicesRect`; asked for the same day, "more on the starting game options"):
  every menu over the title screen (the title menu and the setup questions: civilizations, world, size,
  starts, the four customize questions) a column of large buttons with labels twice the font
  (`SETUP_CHOICES`, `drawButton`'s `scale`), and a unit's orders a grid two or three across
  (`ORDER_CHOICES`, large words, falling back to `ORDER_CHOICES_SMALL`), placed above the unit, else
  below, else beside it; ten load slots, or anything with
  text, stay rows. The setup cards (difficulty, tribe) get a Choose button in their panel
  (`drawSetupChoose`, `setupChooseAt`): a tap lights a card, Choose or a second tap picks it. The
  research panel, the city screen and the audience keep their sizes.
  On the city screen a tap on one of its six boxes (renderer-retro `CITY_BOXES`: resources, map, improvements,
  food, units, production) enlarges it (asked for 2026-10-27: "on mobile only - inside the city view - when
  click on an box area - enlarge it to see it bigger"): `drawCityZoom` lays the 320x200 screen on the wide one,
  darkened, and the box over its middle twice its size (`cityZoomPlace`: whole times, so each fine pixel a
  block), its pictures grown with it and the ones it covers hidden, a close box above its corner. The adapter
  maps points on it back to the screen's (`cityZoomPoint`, its city hit tests), so its buttons, lines, units and
  squares answer there; `touch.ts` passes a tap on it to the game only where something answers
  (`cityAnswersAt`: the game leaves the city on a click on nothing), closes it on a tap off it, and scrolls an
  enlarged list that much further a line (`cityZoomScale`). Windows opened over it darken it in turn and leave
  it standing; it goes with the city screen. The title row (close box, View, Happy, citizens) answers at once.
  `touch.ts` turns fingers (`gestures.ts`) into the mouse the game knows: tap = mousedown 0, hold 450 ms
  = mousedown 2, drag = pan or the research list's wheel; mouse pointers are left to the browser. On the map
  (since the game's mouse moves units with the right button, 2026-10-27) a tap with a unit in play on a square
  holding no city or unit of ours is the right button (`moveTap`: a step, or the route and a second tap
  sending it; the dragged view stays), a hold on our city or units with the unit in play elsewhere is the
  right button too (moving it in, joining them), and a hold anywhere else Shift + the right button (the
  square's window). A tap or a
  held finger (asked for 2026-10-25) on our units' square (not a city, where a held finger opens only the
  orders of the unit in play standing there) brings one into play as the game would and opens its orders
  (the game's Esc) just above it (`ordersAbove`: the next menu drawn is anchored over the unit, without its key
  column). What the game takes from keys only is a touch there: a rates bar (`ratesAt` in renderer-retro,
  given the wide width when the window stands over the wide map) sets that rate by arrow keys (`rates.ts`), a tap on a launchable spaceship is Enter, a hold on a city
  screen is N (rename). `text.ts` shows a DOM field while the game asks for text, bound to the game's
  `TextInputState`, OK/Cancel = Enter/Esc. The phone's menu bar (`menu-bar.ts` rewrites renderer-api's
  `MENU_BAR` as it loads, failing the build if that list changes shape) has no Orders, and a production
  build no Debug either (the dev server keeps it); the web game finds its menus by name, though its Alt
  keys count places. The build writes `sw.js` from `service-worker.js` (every file precached under a
  content hash; pages network-first, `ignoreVary`). `base: "./"`, so the build plays from any folder.
- `tools/headless` — tournament harness: `runGame(config)` plays an `allAi` game through `runAiPlayers`, samples
  per-civ stats, fingerprints the final state; `AIS` registry seats a named AI per civ. `cli.ts` prints tables.
- `tools/maps` — premade-world builder: `frames.ts` (lon/lat → grid breakpoints per world, homelands),
  `climate.ts` (Natural Earth regions and hand zones → terrain mixes), `build.ts` (rasterise, rivers, starts),
  `places.ts` (real names: Natural Earth's lakes, deserts, ranges, plateaus, basins, islands and continents,
  hand outlines for the seas and oceans (`WATERS`: the cache has no marine data; the smaller sea first, the
  oceans last) and some forests, ice sheets and marshes (`LANDFORMS`, named `HAND_ZONES`); a square takes
  the most important place covering it (scale rank, then the smaller), leftover water the nearest name
  across the water, a landform's squares the nearest within two steps, land the nearest on its landmass;
  `NAMED` puts names better than the data's). The report counts the places and the squares left unnamed.
  Regional worlds still wrap east-west; their column 0 is forced to sea so the wrap joins no coasts by land.
- `scripts/mirror-test.sh` — for a Linux shell on a Mac checkout; not needed on macOS.

## Invariants (do not break)

- All game mutation goes through `applyCommand(state, cmd)` in `core/src/commands.ts`.
  Human input, AI and replays use the same `Command` union. Add new actions as commands.
- Randomness only via `state.rng` (`nextInt`/`nextFloat`). Never `Math.random` in core/ai.
  Seed + command log must replay to an identical state (`save.ts`, test in `tests/save.test.ts`).
- A save's snapshot (`SaveGame.state`) loads as it is at the same `SAVE_VERSION` only: bump the version
  whenever `GameState`'s shape changes (a field added, renamed or meaning something new), or older
  snapshots load wrong. `GameState` holds only plain objects, arrays and typed arrays (`copyState`): no
  `Map`, `Set`, class instance or shared reference, and nothing that matters to play lives outside it.
- Renderers never touch `state.rng` and never change state, and draw nothing of a square the player
  has not explored: coast, river, road and fog shapes take `player.explored` (tests rewrite the hidden
  squares and expect the same picture). The retro renderer draws into
  `Surface` with palette indices only (no RGB in its code; use `shade(ramp, 0..7)` or `C.*`); the
  modern renderer keeps every colour in `theme.ts`.
- Movement points are stored in thirds (`MOVE_FRAC = 3`). Map wraps east-west only (`wrapX`).
- `endTurn` cycles players: human -> AI civs -> barbarians (skipped when unit-less) -> turn++.
  `lastTurnEvents` is the per-turn event list the UI presents.
- Rules live in data files; prefer adding fields there over special-casing in code.

## Status

Phases 1–7 done: world, cities, tech/wonders/governments, combat/transport/goto, multi-civ
turns, diplomacy, save/load, title/setup, advisors, end conditions, headless harness, planner AI.
Rules-completeness pass done (2026-10-16): data verified against FreeCiv civ1, all wonders bound,
caravans, railroads/fortresses/pollution/global warming, spaceship, diplomats, nukes, in-game text
prompt. Phase 8 done: modern-visuals renderer behind the shared `Renderer` API (set aside
2026-10-19, asked for: the app draws retro only; the package keeps building and passing its tests). Premade worlds done: Earth, Europe, Middle East (title menu "Play on a premade world", optional
historical homelands: only native tribes offered, rivals drawn from natives preferring non-overlapping
homelands, starts nudged 3+ squares apart) and "Customize world" (land/temperature/climate/age). 20 civs
(the original's 14 plus Spanish, Vikings, Hittites, Persians, and, asked for, Hebrews (Exodus: faster
settlers; Jerusalem) and Japanese (Bushido: veteran horsemen; Kyoto, two hill squares on Earth's coarse
grid)). A civ added later carries `since` (the save version that brought it); saves before version 11
load with `roster: 10`, so their rivals come from the 18 they were drawn from. Barbarians done (2026-10-17): uprisings and
sea raids with leaders and ransom, barbarian-held cities, pillage. Civilization traits done (2026-10-17):
one ability and one starting advance per civ, shown at the tribe choice, the opening window (with the
leader's portrait and a sentence on the people since 2026-10-26) and World > Civilizations. Extended tech tree done (2026-10-18, asked for): Weaving (after Pottery; ends arctic wear in
place of Medicine), Animal Husbandry (a root; Horseback Riding needs it; +1 food from Horses, Game and
Seals for its owner, `special.learned`), and five modern advances in place of Future Tech. (The Internet,
Mobile Phones, Renewable Energy, Artificial Intelligence, Quantum Computing), each unlocking an
improvement built from existing effects (Data Center, Cell Tower, Solar Plant, Automated Office,
Quantum Lab). `ADVANCES` is that tree; `CLASSIC_ADVANCES` the 1991 one, kept by saves before version 9
(`classicAdvances`); reach the right one with `advancesFor(state)`, never `ADVANCES` directly in rules
code. `tileYield` takes the working civ (`owner`) for the pasture food. Borders and contact done (2026-10-18,
asked for): civs meet face to face and the map shows whom we met before the audience; the audience
offers open borders, maps, knowledge, gifts, tribute and war; civs at peace without open borders ask
the player's units off their land, warn once more, then go to war (our departure: the original had no
borders). Culture borders done (2026-10-19, asked for): borders start a square round each city and grow
with its culture (save version 12); since 2026-10-20 (asked for, save version 14) culture is what a city's
people, buildings and wonders make it, not gathered every turn. Peace treaties and influence done
(2026-10-20, asked for: "exchange maps and open borders only after peace; total civ influence should
affect how other civs treat the player"): meeting leaves no treaty, maps and borders need peace,
computer leaders weigh the player's influence (save version 15). World sizes done (2026-10-19, asked for: premade maps felt small):
small 80x50, medium 120x75, large 160x100 for premade and customized worlds; no save version (a save
without `size` is small). Islands kept apart on premade worlds at every size (2026-10-19, asked for;
save version 13). Mobile PWA done (2026-10-19, asked for, apps/web untouched): touch, on-screen
pad and keys, map drag, keyboard prompt, save on hide, offline service worker, icons; checked in desktop
Chrome with simulated touches, not yet on a phone. Moods done (2026-10-21, asked for: "analyze happiness
against the original, show unhappiness on the city, units inside the city"): the reckoning stage by stage
with a Happy panel, martial law by government, weariness souring the happy, FreeCiv's empire-size rule,
celebrations with their government bonuses, a Democracy toppled by lasting riots, mood flags on the map
(save version 17, `simpleMoods` for older saves). Production changes reckoned from the turn's box
(2026-10-21, after the user found the build menu's turns baffling; save version 21). Fine art merged (2026-10-21, asked for): branch
terrain-tiles-test, the whole map at 32 fine pixels a square (terrain, units, resources, cities, icons,
text), second special resources with reaches (save version 20; the branch's own 17-19 are mapped in
`loadSave`, a 17 counting as main's). Strategic resources done (2026-10-27, asked for; save version 33, see core above):
units that need Horses, Iron, Saltpeter, Coal or Oil on the civ's land or traded, deposits on new worlds, trades in the
audience and between computer civs. Iron, Saltpeter and Oil hidden from a civ until their advance (2026-10-28, asked
for; save version 40), told on the map as they appear. Seafaring (Harbour, Explorer, Fishing Boat), Archery
(Archers) and War Elephants on the Elephants resource done (2026-11-01, asked for; save version 53), the units' pictures
the user's. Oil at sea and the Fishing Boat's oil rigs done (2026-11-01, asked for; save version 55), drawn in code until
the user's pictures come. Roads, irrigation and mines take twice the original's turns (2026-11-01, asked for; save
version 56). Specials of a kind kept three squares apart (2026-11-01, asked for; save version 57). The sea yields 1 trade, the
Harbour adding the second (2026-11-02, asked for; save version 58). The web game's map squares are 20 pixels, its zoom
16, 20 or 24 drawn at each size (three levels since 2026-11-03), with + and - on the map (2026-11-02, asked for; no save version; the phone keeps 16).
The terrain drawn from the user's second sheet, forests and mountains in kinds by the land round them (2026-11-02,
asked for; no save version). Villages drawn as the user's five huts, the kind by the land (2026-11-02, asked for); a unit
walking into one sacks it before it opens, its loot bursting out (2026-11-02, asked for; no save version).
Tile improvements drawn as the user's sheet: fields, mines and quarries, oil pumps, rigs, nets and piers as its
pictures, bridges in its woods, roads thin and muted (2026-11-02, asked for). War Elephants climb mountains without a road,
as settlers and explorers do (2026-11-02, asked for; save version 59). A fishery on Fish adds a shield as well as its food
(2026-11-02, asked for; save version 60). Herds: Sheep, Camels and Bison as bonus resources that Animal Husbandry tames
and, Sheep's wool, Weaving spins, with the user's updated sheet of resources (2026-11-03, asked for; save version 61);
the same day the resources became the user's pictures as they are, laid over the canvas (asked for: "USE AS IS!!"), and
Ivory left the game (asked for; save version 62).

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
   `attrition` (desert 10% until Trade, arctic 20% until Medicine) takes hp instead of healing from land
   units ending a turn outside their own cities' radius, never the last one; rivers and specials spare
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
   Retired units (`UnitTypeRule.obsolete`, the advance that ends one; asked for 2026-10-27: "when get
   gunpowder - remove militia from the options"): Militia retire with Gunpowder. No city of that civ builds
   them (`unitRetired`, read by `unitChoices`, so the build menu and `setProduction`), and a city building
   them as the advance comes (`discover`, a trade, the Debug grant; else at its turn) turns to its default
   (`defaultProduction`: Militia, or once they are retired the stoutest land defender it can build now, the
   cheaper on a tie; also what a new or taken city starts on and a city turns to after an improvement or
   wonder), a human player's waiting for its pick instead since save version 49 (`City.choosing`); Militia in the
   field stay. Saves before version 39 load with `lastingUnits` (headless
   `--lasting-units`).
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
   gold runs out. Head to head (planner vs v2, 16 x 300, seeds 1-16): selling 10-6, score 208 vs 179, pop 74 vs 73;
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
   `computeCity`). Pollution (per-city chance from shields and industrial population, halved tile output, settler
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

## Conventions

- TypeScript strict; small pure functions; tests next to packages in `tests/`.
- When a render change is made, run the render tests and look at the PNGs in `tests/out/`
  (`sprites.png` previews every sprite on two civilizations' colours; `main-screen.png` the map).
- Art is ours: draw new sprites in the text grids or a paint program and import them. Do not use
  image generators or the original game's files for shipped art. Exception the user made (2026-10-21):
  the terrain, unit and resource sheets were supplied by the user as reference images and copied in
  pixel for pixel. The user's portraits (2026-10-22: the five difficulty rulers, the twenty leaders, the
  twenty audience scenes; 2026-10-23: the 74 advances; 2026-10-24: all 50 improvements, wonders and spaceship
  parts; 2026-10-28: the unit sheet, see Unit pictures) are shown exactly as supplied, never converted, redrawn, cropped or recoloured
  (asked for, twice, emphatically: conversions into the palette looked "bad and distorted", and new
  images must not be generated); see the setup cards and the audience screen above; new art drawn here follows their manner (see `packages/renderer-retro` above) and
  the user's pixel-art rules: even chunky strokes, one-pixel outlines in dark shades of the thing's own
  colours (no heavy black), the blocky 5x7 text, nothing algorithmically thinned or smoothed.
- Commit per phase or per feature; messages in imperative mood.
