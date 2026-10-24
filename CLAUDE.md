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
- `npm run headless -- --games 4 --turns 200 --civs 4 [--every 25] [--ai baseline,planner] [--world earth [--historical]] [--size medium] [--classic-terrain] [--open-mountains] [--work-beyond-borders] [--verify] [--json out.json]` —
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
  Whales, Cotton, Wheat, Silk, Wine, Iron, Oil, Furs, Ivory, Spices, Fruit; tundra's Game is forest's),
  on about half their lattice squares (`Tile.secondSpecial`, a hash of the square, no RNG, so seeds keep
  their worlds); `learned` may add food, shields or trade with an advance (Navigation, Weaving, Pottery,
  Iron Working, Refining). Each carries `since` (the save version that brought it); old saves load with
  `resources` (their version), so their worlds have only the kinds they knew (`secondKind`). A kind may
  have a reach (`within`/`beyond` squares from land): Fish within 2, Whales beyond 2 (deep water), from
  version 19 (`SPECIAL_REACH_SINCE`).
  Barbarians (`barbarians.ts`, numbers in `rules/barbarians.ts`, roles per unit in `rules/units.ts`) follow
  FreeCiv's summons: from turn 150 a few random squares a round; one 5-8 squares from the nearest city
  starts an uprising (explored land on that city's continent, never tundra or arctic) or a raid (a Sail
  of raiders near land), more often and bigger against big empires. Units come by role (`barbarian.as`),
  the advanced ones once any civ knows their advance. Each band has a Barbarian Leader (`leader` flag:
  never built, 100 gold ransom to a land unit that catches it alone). They hold cities they take
  (razing size 1) and build soldiers there; the `pillage` command wrecks one improvement a turn.
  Stepping off a ship ignores zones of control. Saves before version 4 load with `simpleBarbarians`
  (the old coastal parties that razed everything) and `zocAtSea`.
  Civilization traits (our departure, asked for: the original's civs were alike): each `CivRule.trait`
  in `rules/civs.ts` has a name, a few words for the tribe choice (`short`), a line of text, an
  advance it starts with (a root advance) and `TraitEffect`s (cheaper builds, faster settler jobs,
  science/tax/corruption, content, growth (food kept, smaller food box), veterans, moves, short
  anarchy, friendly villages). `traits.ts` answers each kind; `costFor` is a production's cost for its owner (use it, not
  `productionCost`, for anything a city pays). `classicCivs` (old saves before version 5,
  `?civs=classic`, `--classic-civs`) turns them all off. Tests of base rules play classic civs.
  Diplomacy (`diplomacy.ts`): civilizations meet face to face (`contactRange` 1, as the original), and
  the unit that walked into the meeting stops for the turn, on a goto too (`meetAround`), so each side
  sees whom it met; cities see the squares next to them. Meeting leaves them in contact, no treaty
  (`Relation` "contact", `metRelation`; asked for 2026-10-20): neither may attack before `declareWar`,
  and `openBorders`/`shareMaps` wait for a peace treaty (`makePeace`, `atPeace`); a computer leader's
  envoy offers one with `offerPeace` (`state.peaceOffers`, a `peaceOffer` event the player answers with
  `makePeace` or not at all). Influence (asked for): `civInfluence` is the culture of all a civ's cities;
  `esteem(judge, of)` weighs it against the judge's own (`INFLUENCE` in `rules/culture.ts`: admired at 1.5x,
  scorned at half, both sides counting 10 more), and the AI's `attitude` reads it. Saves before version 15
  load with `peaceOnContact` (meeting made peace at once). Land (`territory.ts`: `claims`, `landOwner`):
  each city the squares within its border, which grows with its culture (`borderRadius`: 1 square out
  when founded, one more at each of `CULTURE.levels` in `rules/culture.ts`, radius 2 being the 21 squares
  it works); a shared square goes to the nearer city, then the one with more culture, then the older.
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
  land (`trespassOn`: not diplomats, caravans or units aboard): stepping in records its first demand
  to leave (`state.trespass`, a `trespass` event), `demandLeave` adds one, a gift (`giveGold`) forgives,
  and the record drops at the owner's turn once the units are gone. Other deals: `shareMaps`,
  `tribute` (`tributePaid`). `warDeclared` says who declared on whom (`on`) and why (`reason`).
  Saves before version 10 load with `farContact` and `noTrespass` (meeting at two squares, no stop),
  saves before version 12 with `fixedBorders` (each city its 21 squares, the nearer then older winning).
  Moods (`computeCity`; asked for 2026-10-21, checked against FreeCiv's civ1 ruleset): citizens are born
  content up to the difficulty's base (6 Chieftain .. 2 Emperor, `DIFFICULTY_RULES` in `rules/difficulty.ts`
  with each level's starting gold, settlers and research cost; our departure, FreeCiv plays 4) and unhappy
  beyond; an empire holding more cities than its government's `empireSize` (Anarchy 9 .. Democracy 14) loses one
  content citizen a city, one more per `EMPIRE_SIZE_STEP` (10) cities. Then stage by stage (`CityReport.moods`,
  shown by the city screen's Happy panel, H or its smiling face, as the original's Happy analysis did): luxuries (two
  a step, content to happy first), buildings (`BuildingRule.content`, the Oracle doubling temples,
  Michelangelo's a cathedral everywhere), soldiers (martial law: each military unit in the city calms one
  unhappy citizen, up to `GovernmentRule.martialLaw`, Monarchy 3, Despotism, Anarchy and Communism unlimited;
  war weariness: each unit away from any city under the Republic (1) or Democracy (2) sours a content citizen,
  then a happy one for two steps; Women's Suffrage excuses one a city), wonders (Hanging Gardens, Cure for
  Cancer, Bach's, then Shakespeare's). Disorder when the unhappy outnumber the happy: no shields (the units'
  upkeep still owed), tax or science; food and luxuries go on. `City.unrest` counts the turns in a row, and a
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
- `packages/ai` — opponents, speaking only `Command`s: `planner.ts` (AI v3, shipped as `aiTurn`),
  `planner-v2.ts` (frozen copy of v2, the head-to-head yardstick: do not tune it), `baseline.ts`
  (v1) and `barbarian.ts` (the barbarians, reached through `baselineTurn` so every AI seat shares it:
  boats land raiders beside the nearest city, soldiers storm cities at long odds, loot farms and mines
  on the way and keep their best defender home, the leader keeps to its band and slips away alone).
  The planner treats a barbarian-held city on its continent as a war to win back. Borders
  (`guardBorders`): a human civ's units on its land are asked off (stepping in was the first request),
  warned once more a turn later, then war (`reason: "trespass"`) unless the planner is under 0.6x the
  intruder's strength (then it complains every 5 turns); computer civs do not mind each other. The
  player's audience asks pure functions of the state: `attitude` (hostile at war or after a last
  warning; else a grievance, pride (1.5x the strength) and scorn for the player's influence each count
  one against, admiration one for: none on balance friendly, one wary, two hostile), `peaceAnswer` (a
  treaty after meeting) and `bordersAnswer` (wary: for `PEACE_PRICE`/`BORDERS_PRICE` gold), `acceptsMapSwap`,
  `acceptsPeace` (at war: the fighting decides), `tributeOffer` (only far weaker civs, once in 20 turns),
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
  never aim within 4 of each other. The rules still allow two squares (the player may). Saves before version
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
  Tax, Lux and Sci a row each; the buildings' upkeep heads the Improvements box). Tidied 2026-10-24
  (asked for: "a bit chaotic", a granary indication, citizens to click "like in the original civ"):
  the row of citizens (`citizenRow` in renderer-api: workers by mood, then specialists) is clickable
  (`cityCitizenAt`; the web app's `changeCitizen`): a worker leaves the square worth least to entertain
  (`toggleTile` on `weakestWorked`), a specialist turns entertainer, taxman, scientist, round again
  (`setSpecialist`, `nextSpecialist`); the person under the pointer is lit (`CityScreenView.hover`) and
  told of beside the row (`citizenNote`), else a faint hint. The food and shield stores (`drawStore`,
  `storeLayout`) are grids of empty slots waiting to be filled (asked for 2026-10-24), ten to a row,
  the grid in the middle of its box's room with the same padding on every side (`storeRegion`), a slot
  standing for more than one good only when the box has more goods than the room has slots (then
  "{food}=2" at the foot); the slots of what a growing city keeps (core `foodKept`: a Granary's half, or
  a trait's share) are edged in gold and named Granary (or Kept) at the foot, room allowing. Taxmen and scientists need no size of city (the 1991 game is said to want size 5: not checked, not asked for).
  Esc, Enter (not held), the close box or a click
  on nothing that answers (not a button, unit or city square) leaves it; Buy (button or B) shows the
  price against the treasury first. The build menu (`openProductionMenu` in the web app) shows beside
  each choice only the turns it takes from here, counting the shields a change would keep ("never"
  without a surplus); no costs or shield counts (asked for). A change of production keeps the box for the kind it was
  gathered for and half of it for another kind (`shieldsAfterChange`: reckoned from the box as the turn
  began, `City.turnShields`/`turnKind`, or as bought, so changing and changing back in a turn costs
  nothing; FreeCiv's model). Saves before version 21 load with `compoundingPenalty`: every change of
  kind halved the box again. Its units (`cityUnits`: those in the city from any home, then those it
  supports elsewhere, faded, each with its cost) are picked with `cityUnitAt`: the unit wakes (fortify or
  sentry dropped, the `activate` command) and the map takes it up; one with no moves left keeps its orders. A city that finishes an improvement, wonder or spaceship part opens
  the Building Completed window (`built.ts`, `builtCard`; asked for 2026-10-24 with the user's template; retro
  `screens/built.ts`, modern a plain modal), a small window over the game since 2026-10-24 ("should be a
  modal opened on top of the game and not a full screen window"; the web app draws the screen under it,
  `under`): a navy title strip (hammer, BUILDING/WONDER/SPACESHIP PART COMPLETED, close box), the name
  large over "Completed in Rome", the user's picture on a slate bed, a parchment panel with Description
  (`text` on each rule in `rules/buildings.ts`, `wonders.ts`, `spaceship.ts`) and City Effects (icon and
  numbers from the rule's fields: "+50% science", "+2 culture") over the upkeep, then
  View City (the city screen, its build menu up) and Continue (the build menu over the map); either way the
  turn's news goes on after (`then`). Left/Right/Tab, Enter (not held), V, Esc; the pointer lights a button.
  `Renderer.built`/`builtHit`. Finished units say nothing (the city goes on building them), except Settlers: they cost a
  citizen, so their window asks what to build next, short and in numbers (asked for 2026-10-24): "Rome generates
  a group of Settlers", then Population 3 → 2 and each of food, shields and trade a turn that changed (core
  records them on the `built` event, `CityTurnEvent.change`; the font has a → for it), over its city screen;
  leaving the city goes on with the turn's news (the city `Screen`'s `then`). City view (`cityview.ts`, the original's View:
  the city screen's View icon or V; the modern city screen shows it small as the button): every improvement
  and wonder has a `PICTURES` entry made of shapes (`Part`: rect, poly, oval, line, each of a `Material`) on a
  grid of retro pixels; `cityScene` lays a city out (wonders on the back row, the palace in the middle, then
  improvements and homes of the owner's age filling the middle rows outward, trees beyond, walls before the
  front row, the land to the north on the horizon, a river if the city has one), hashed, never the RNG. Retro
  fills the shapes pixel by pixel (`pictures.ts`: lit left, shaded right, outlined in black); modern paints
  them as paths three times larger. The user's pictures of buildings (2026-10-24, asked for: "use the attached
  images for game buildings ... replace buildings also in the city view"; 47 of the 50, none yet for Barracks,
  Granary and the Great Library, which keep their drawn ones) stand in their place: `BUILDING_ART` (`art.ts`)
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
  2026-10-24). Diplomacy (added 2026-10-24, asked for) lists every civilization met with how we stand,
  and opens its card: the audience screen with the leader's portrait at the left (`CARD_PICTURE`) and
  `civCard`'s lines beside it (`DiplomacyView.card`: leader and realm, trait, government, capital, size,
  what they make of our influence, their mood toward us (the AI's `attitude`), their units on our land),
  the standing as the line, and Talk (an audience, back to the card after), Demand they leave our land
  (when their units stand on it: the AI's `withdrawAnswer`, friendly yes, wary only to a neighbour at least
  as strong, hostile never; yes is the core `withdraw` command: each of their trespassers gets a goto to
  `exitSquare`, the nearest way off our land, walked at their turn's start, and their trespass is
  forgiven) and Back. The planner may march them elsewhere after; it still ignores borders itself.
  Tax Rates (Game > Tax Rate, T; redone 2026-10-24, "not good") is a stone window over the map
  (`screens/rates.ts`, `ratesRect`): a row each for tax, luxuries and science with its icon, - and +
  buttons and ten blocks (filled to the rate, dark past the government's limit), what the cities bring
  a turn at the foot (`empireIncome`), Done; `ratesHit` (set a block, step, done) through
  `Renderer.ratesHit`, `ratesAt` for the phone's sliding finger; science takes what the others leave, and
  moving it takes from tax (`setRateTo`).
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
  frame while only the stars show), the name in our own slab capitals in chiselled gold; modern keeps a
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
  Map clicks (asked for 2026-10-22): left-click opens our city or picks our unit as ever; otherwise,
  with a unit in play, `planMove` (renderer-api `plan.ts`) decides: a step next door goes at once (a
  refused one says why); a fight ("Attack: 62%", `attackOdds`), an empty enemy city ("Take Rome") or a
  square further off (the `findPath` route, "This turn"/"3 turns" by `routeTurns`) becomes `view.plan`,
  drawn as dots on the way, corners round the end and the note, and goes only on a second click on the
  same square; any other click or key drops it. With nothing to do for the unit the map centres.
  A double click (two left clicks within `DOUBLE_CLICK_MS`, 300 ms, on the same screen point: the first
  may set the map gliding) centres the map on the first click's square and drops its plan, unmade.
  Right-click opens the square's window (`terrainInfo`: title "Jungle (Cotton)", the resource and river
  beside the terrain; headed by the square itself as the map draws it, twice the size in a sunken frame
  (`MenuState.square`, retro's `drawSquarePicture`/`squarePainter`, `Renderer.menu(menu, state)`; asked for
  2026-10-23: "more stylish, add the terrain image, more details"), beside it the yields, movement and
  defence, a few words on the terrain (`TERRAIN_TEXT`, our own) and what the resource, river and shield
  grassland add; then improvements, whose land it is and which of our cities works it, the city, units
  and jobs, and the site note for settlers; an Improvements line; the only button Open city, on our city (Go
  here removed 2026-10-23, asked for); it opens clear of the square clicked, `MenuState.avoid`, so a second
  click there closes it), closed by the X in its title
  strip (`MenuState.close`; retro draws it, modern ignores it; any click off a window's choices closes
  it). On the phone a tap is a left-click and a hold a right-click.
  Edge scrolling (asked for 2026-10-23): a mouse resting in the band along an edge of the map
  (`Renderer.mapView`, the band 6% of its shorter side) pans the camera that way after 220 ms, gathering
  speed to 8 squares a second (`stepEdgePan` in the web app); not over the panel or the menu bar, not
  while the other civs' turns play back, and only for a mouse (the phone drags its map: no `mapView`).
  A unit's own move still brings the camera back when it steps out of view (`followActive`).
  City sites (asked for 2026-10-23): while our settlers are in play the map pins the best few squares near
  them to found a city on (`settlerSites` in renderer-api: within 6 squares on their own landmass, scored by
  core `siteScore` from what the player has seen, unseen squares counting a plain grassland's worth, clear of
  known cities by `CITY_SPACING`, apart from each other, nearer preferred), marked quietly (the first pins
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
  roads on rivers and an old log holds no refused order). Both status panels show the research under way
  (`researchOutlook`: advance, beakers, turns to go), and nothing while none is picked. Disbanding
  (Shift+D, Orders > Disband) asks "Are you sure?" first, No by default (`confirmDisband`).
  Width: the retro main screen draws as wide as its surface (`viewAcross`: the panel and bar as ever, the
  map's viewport taking the rest), menus, prompts and the status line centre on the surface they are
  drawn on, and the menu hit tests take the width (default 320); the web game draws 320 wide, the mobile
  app as wide as the phone.
  Zoom (`MainScreenView.zoom`, set by the mobile app's pinch, never by the web game): retro draws the
  map as usual, then `magnifyViewport` blows the viewport's top-left 1/zoom up to fill it (fine pixels,
  in place) before the panel and bar; `zoomedTiles` sizes the minimap's box, `unzoomPoint` maps a tap
  back. The modern renderer ignores it.
  Unit animation: core appends every step (`applyMove`) and fight (`resolveCombat`, round by round) to
  `lastActions` (a UI side channel like `lastTurnEvents`, emptied by `endTurn`, never read by replays or
  AI); `MotionPlayer` (`renderer-api/src/motion.ts`) times them into `view.moving` (slides) and
  `view.battle` (lunge, blows, hp draining, the loser's burst), and renderers draw from those.
  The other civilizations' turns (asked for 2026-10-22: enemies "come as a surprise, too swift"):
  `watchTurn` (`renderer-api/src/watch.ts`) plans the playback from their actions and the squares we
  saw before or after: every move of a civ at war with us (or barbarians) on seen squares, one unit at a
  time at a slow pace, a `MotionPlayer.hold` first gliding the camera there when it is not well on screen;
  each fight with our units is announced beside the attacker ("Babylonian Legion attacks!"), played
  slower, and its outcome said beside our square ("Phalanx destroyed"); other civs' moves play only
  where the map already looks. A long turn is sped up to `WATCH_BUDGET_MS` (at most ~3x). Any key or
  click skips the rest. Then an "Under attack!" window lists the turn's fights with our units
  (`fightReport`), then the news; a war declared on us by a civ we already knew is told before the playback.
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
  Research panel (`research.ts`; redesigned 2026-10-20, asked for: the old tier graph was confusing and
  disliked, so it is gone): built round the choice. Under the title a band with the research under way
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
  PgUp/PgDn, Home/End, Tab (the next choice), Enter, Esc. `Renderer.research`/`researchHit`. The web app
  opens it (`openTree`) after the New Technology windows when research is due, from their View Tech Tree,
  and wherever research is picked (science advisor A, Advisors > Research, and a click on the status
  panel's research row: `Renderer.statusAt`); when research is due it closes only on a pick.
  New Technology window (`newtech.ts`; asked for 2026-10-23 with the user's template and a picture for
  each advance): every advance found (end of turn, village, diplomat, treaty, Debug) gets one, in turn
  (`announce` in the web app), before the research panel; a small window over the game since 2026-10-24
  (`modalRect`, 236x147, centred on the screen it opens over, which the web app draws first: the
  screen's `back`; the Building Completed window shares the size and frame). Windows grow into place as
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
  Borders (`territory.ts`, toggled in the Game menu, which hides only the drawing): core's `claims`
  from the cities the viewer knows, the same land the rules read for trespass; `borderSides` gives the edges and
  where a line must reach past an inner corner. Drawn after all squares, under the fog. The minimaps
  follow the same toggle: a line of the owner's colour round each civ's explored land; cities are
  marked in their owner's colour either way (retro: a white dot in a cross, darker inside a border).
  The unit awaiting orders blinks on the minimap in a yellow box (modern: a ring), so it can be found
  from anywhere. City names stand under their squares on the map (retro: the owner's colour ringed in
  black, drawn before the units so a name never hides one; asked for 2026-10-21).
  Roads and fields (`works.ts`): roads wander. Each square has a meeting point near its centre, and
  the course to each known road neighbour's bows and snakes, keyed by the pair and laid from the same
  end whichever square asks; every square draws whole courses clipped to itself, and the two squares
  beside a diagonal draw their part of it too (`roadWays`), so roads join without seams. Railroads
  lay rails and sleepers (spaced evenly along each course) on the same courses. Retro draws both at the
  fine grain in the terrain art's manner (asked for 2026-10-23, then "too wide, more subtle": `ROAD`,
  `RAIL` in `overlays.ts`; "drop the outline"): a road is packed earth about 3 fine pixels wide, lighter
  along its crown, a few pebbles, no outline; a railroad lays dark sleepers across it with a bright steel rail either
  side shadowed outside. Over a river's water (Bridge Building) the road is a timber deck with its
  planks across the way and a dark railing; elsewhere water under a course stays water. Irrigation is fields:
  plots of crops in rows either side of an east-west canal (`fieldLayout`), running on into
  irrigated neighbours (`fieldSides`) with a strip of terrain elsewhere; water and the knolls of
  hills stay above them. Mines are a rock mound with a timber-framed shaft, drawn over the roads.
- `packages/renderer-retro` — indexed 320x200 `Surface`, 256-colour `palette.ts`, bitmap
  `font.ts`, `widgets.ts` (panel/menu/box), one file per screen in `src/screens/*`.
  Fine art (merged from branch terrain-tiles-test, 2026-10-21, asked for): the screen keeps its 320x200
  layout but holds `DETAIL` (2) x 2 fine pixels per screen pixel (`Surface.k`, `fw`/`fh`, `fset`/`fget`/
  `frect`/`fblit`; `Surface.screen()`, `Surface.fine()`), so a 16-pixel square shows a 32x32 picture.
  Terrain (`terrain.art.ts`, recovered pixel for pixel from the user's reference sheet, no mirroring;
  two blues: coastal `ocean`, open `deep_ocean`), units (`units.art.ts`, the user's 32x32 sheet of the
  original's 28, standing free with the owner's shield in the top-left corner, `drawShield`/`SHIELD_AT`,
  a second shield behind for a stack, hp as a strip across its top; no owner box), cities
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
  (the viewer's own cities) as a pennant before the plate (`drawCityLabel`, `drawMoodPennant` in
  `screens/main.ts`; asked for 2026-10-21/22 after overlays on the town hid it) and resources (`resources.art.ts`, named after the special; one-pixel outlines in dark
  shades of their own colours, never thick black) are all 32x32 sheets with `k = 2`; icons are 16x16
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
  city view's `copper` slots, copper now drawn from `steel`; new art must reuse these ramps or free one. Panel icons (`icons.art.ts`,
  drawn with `src/icons.ts`) and the small marks (`drawMark`: tick, new, moves) are hand-drawn
  16x16: food is an ear of wheat, `shield` (production) a steel-rimmed blue shield as the original showed
  it (a hammer until 2026-10-24, "not good"), `people` a man and a woman; roads,
  rivers, irrigation, rails, forts and smog stay code-drawn in `tiles.ts`/`overlays.ts`.
  Citizens (city screen) are one plain figure, 16x26 fine pixels (`CITIZEN_W` 8 x `CITIZEN_H` 13): a
  round head over a body and two legs, nothing more (asked for 2026-10-24 after three rounds of detailed
  people, each "bad": "do the most simple basic human presentation possible - dont over complicate").
  `citizens.art.ts` holds that `person`; `citizens.ts` colours its head with each person's skin (six
  tones, `citizenLook`) and its body with the mood or trade: yellow happy, white content, red unhappy,
  magenta entertainer, orange taxman, cyan scientist. Hair, trousers and the man/woman looks play no
  part now. The sheet is composed from hand-drawn part grids
  (heads, upper bodies, legs or dress, hats); `citizens.ts` swaps its stand-ins, three tones each (lit,
  shade, outline: skin 6/4/2, hair e/c/a, clothes P/p/r, trousers C/B/A), for each person's.
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
  of many colours. `draw/*.ts` make sheets: `cities.ts`, `features.ts`, `citizens.ts` (the city screen's people from part grids).
- `packages/renderer-modern` — canvas-2D renderer on a 960x600 logical surface (same panel/
  viewport split, 48px tiles): `theme.ts` (all colours and fonts), `draw.ts` (panels, wrapped
  text, bars), `tiles.ts`/`markers.ts` (terrain, overlays, units, cities), `screens/*`. It draws
  through a `Context2D` subset so Node tests use a recording fake.
- `apps/web` — `main.ts` (screen stack + input; draws with the retro renderer only: the modern one is
  set aside for now, still built and tested but not offered), `retro-renderer.ts` (adapter), `display.ts`
  (canvas fitting: crisp integer scale for retro, DPR-aware for modern), `storage.ts` (IndexedDB saves,
  per browser: slot 0 is the autosave, written as every turn begins and when a game starts or loads).
  The title offers "Continue" (the autosave). Going back to an earlier turn is gone from the game
  (the title's 2026-10-22, the Game menu's 2026-10-24, both asked for); core's `turnStarts`/`rewindSave`
  (`save.ts`) stay, tested, for anyone who needs a log cut back. The turn ends by itself only once the player has ordered the last unit awaiting orders that turn
  (`actedThisTurn`, `AUTO_END_MS` after; asked for 2026-10-24: "auto next turn when no actions left, but
  not auto when no actions at all. auto only for 1 turn", after the always-on Auto End Turn was dropped
  that morning for "click enter for next turn - like in the original"): a turn that begins with nothing to
  order waits, the status panel's End of Turn standing with "Press Enter" blinking in and out under it (the lit blue
  block it had was "too loud", 2026-10-24), and Enter or a click on it
  (`statusAt` "endTurn") ends the turn, the phone's way too.
  Diplomacy: a meeting first holds the map on whom we met (the `beat` screen:
  a callout, 1.6 s or any key), then their leader receives us (`audience`: without a treaty propose
  peace (`proposePeace`: yes, a gift first, or no); then what our knowledge allows (asked for 2026-10-24,
  "when get diplomacy tech add more diplomacy options, when get trade tech add trade options"; the tree
  has no Diplomacy advance, so Writing, the Diplomat's, stands for it): with Writing a "Diplomacy" screen
  (demand they leave our land, exchange maps and open or close borders (both need peace; `acceptsMapSwap`,
  `bordersAnswer` for `BORDERS_PRICE`), demand tribute, declare war or break the treaty (confirmed)), with
  Trade a "Trade" screen (trade knowledge: pick theirs, they name ours; give an advance; give 50 gold);
  before them only the demand to leave and the gift stand on the first screen, war beside them; farewell;
  each once a talk, the answer becomes the leader's words; greetings name admiration or scorn). The audience screen (redone
  2026-10-22 after the user's mock-up "Caesar Welcomes You to Rome", asked for): the realm across the
  top (`realmName`: "The Roman Empire", Kingdom, Republic... by government), the user's picture of the
  leader in their palace whole, frame and all, then the leader's name, their words and our choices as
  the game's stone buttons (`DiplomacyView`, `Renderer.diplomacy` and
  `diplomacyChoiceAt`): never more than `AUDIENCE_CHOICES` (4, asked for) at once, so the proposals
  are grouped into screens with Back, and long lists (their advances) page with More... (`talkMenu`,
  `pagedChoices` in the web app; arrows, Enter or 1-4 pick, Esc steps back, the pointer lights a button).
  The pictures are shown as they are, full size and true colour (asked for, 2026-10-22: squeezed into the
  palette at 224x126 they looked "bad and distorted"): `apps/web/src/scenes/<leader>.webp` (the PNGs as
  supplied, WebP quality 92), laid over the canvas as an <img> by `pictures.ts` (`showPictures`, once a
  frame from each retro adapter's `present`; they let clicks through; one element per picture, made and
  decoded by the preloads and shown only once decoded: a reused element given a new `src` kept painting
  the last leader met for a moment, 2026-10-23) in the room the screen leaves for
  them (`AUDIENCE_PICTURE` in renderer-retro, which draws a dusk sky there beneath, seen until the picture
  loads); `Renderer.prepare` preloads a game's leaders as it starts or loads. With the setup's portraits
  and the advances' pictures (`techs/<advance>.webp`, 1254 square, WebP quality 92; `techPicture`: all but
  the 1991 tree's Future Tech., which shows the frame's bed; each adapter's `main` fetches the picture
  of the research under way, `preloadTech`) and the buildings' (`buildings/<id>.webp`, 1254 square, WebP quality
  92; laid at the screen's `Surface.art` spots; `preloadBuildings` fetches what our cities are building), the only
  things the retro look does not draw through the palette. The phone app caches each picture when first shown,
  not at install (`.webp` left out of sw.js's list). An envoy's offer (`peaceOfferAudience`) is signed or refused; signing goes on
  into an audience. The Foreign Minister shows the standing (`standing`), each civ's influence and
  whether they admire or scorn us (`regardWords`); Enter there opens a civilization's card. Stepping onto land that minds us (once a
  civ a turn, later steps get a callout) and the AI's demands after its turn show our unit, then the
  leader asks us out (`askToLeave`: leave = gotos to the nearest square outside, a gift, or stay); an AI declaring war on us says so in an audience.
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
  (`screen`, `state`, `log`) from web main.ts: keep that hook. Sideways only (asked for): the manifest
  asks for landscape, `touch.ts` locks it where the browser lets a page, and held upright index.html shows
  "Turn your phone sideways" over the game.
  `touch.ts` turns fingers (`gestures.ts`) into the mouse the game knows: tap = mousedown 0, hold 450 ms
  = mousedown 2, drag = pan or the research list's wheel; mouse pointers are left to the browser. A tap on
  our units' square (not a city) brings one into play as the game would and opens its orders (the game's
  Esc) just above it (`ordersAbove`: the next menu drawn is anchored over the unit, without its key
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
  `climate.ts` (Natural Earth regions and hand zones → terrain mixes), `build.ts` (rasterise, rivers, starts).
  Regional worlds still wrap east-west; their column 0 is forced to sea so the wrap joins no coasts by land.
- `scripts/mirror-test.sh` — for a Linux shell on a Mac checkout; not needed on macOS.

## Invariants (do not break)

- All game mutation goes through `applyCommand(state, cmd)` in `core/src/commands.ts`.
  Human input, AI and replays use the same `Command` union. Add new actions as commands.
- Randomness only via `state.rng` (`nextInt`/`nextFloat`). Never `Math.random` in core/ai.
  Seed + command log must replay to an identical state (`save.ts`, test in `tests/save.test.ts`).
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
one ability and one starting advance per civ, shown at the tribe choice, the opening and World >
Civilizations. Extended tech tree done (2026-10-18, asked for): Weaving (after Pottery; ends arctic wear in
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
`loadSave`, a 17 counting as main's).

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
   Other deliberate departures: rivers give +1 trade (on grassland that is the original's River), Michelangelo's acts as a
   cathedral everywhere. The Colossus is the original's since save version 27 (asked for 2026-10-24: "built a
   Colossus, 0 effect": ours helped only the ocean squares its city worked, which Growth rarely picks): +1 trade on
   every square its city works that yields trade, its own square too, until Electricity; a square's yield for a
   city is core `cityTileYield` (government, celebration, Colossus), which the city's totals, the choice of
   squares (`slotYield`, the planner's `governCity`) and both city screens' square marks read. Saves before 27
   load with `oceanColossus` (headless `--ocean-colossus`). Units have hit points and firepower (`hp`,
   `firepower` in `rules/units.ts`: 10 ancient, 20 gunpowder, 30-40 mechanised/steel; heavy guns hit
   for 2): fights go in rounds won with A/(A+D), survivors keep wounds and heal by resting (`HEALING`).
   `attackOdds` gives the exact chance. `classicCombat` (version 1 saves, `?combat=classic`) restores
   the original one-roll fights with the same RNG use, so old saves replay unchanged.
   Ground: off the road only settlers climb `roadOnly` terrain (mountains), so a range is a wall until
   settlers build a road over it; `wheeled` units (chariot, catapult, cannon, artillery, armor, mech inf)
   also keep off `rough` terrain (jungle, swamp, arctic) without one. City squares have a road, and
   attacking onto such ground is fine. One rule, `canEnter`, serves `checkMove`, `findPath`, barbarians
   and the planner (camp squares, scouting to the edge of ground it cannot enter). `openMountains`
   (saves before version 7, `?mountains=open`, headless `--open-mountains`) lets every unit climb. Terrain
   `attrition` (desert 10% until Trade, arctic 20% until Medicine) takes hp instead of healing from land
   units ending a turn outside their own cities' radius, never the last one; rivers and specials spare
   them. `classicTerrain` (saves before version 3, `?terrain=classic`) turns both off.
   Legion 3/1, Musketeers 2/3, Riflemen 3/5 follow the ruleset even though the 1991 manual is often
   quoted as 4/2, 3/3, 5/4.
   Unit upkeep follows the original (`unitSupport`, `freeUnits` in `cities.ts`, `freeUnits` per
   government in `rules/governments.ts`): Despotism and Anarchy support as many units free as a city's
   size, every other government pays a shield for each unit; settlers eat 1 food (2 under Republic and
   Democracy). A city that cannot pay disbands units at once, newest first and settlers last (old saves; they pay none now) (cargo of a
   ship at sea sinks with it), without touching its shield box; the `home` command (H) moves a unit's
   support to the city it stands in. Both city screens mark each supported unit's cost. `looseUpkeep`
   (saves before version 8, headless `--loose-upkeep`) keeps our first upkeep: 3 free units a city
   under Monarchy and Communism too, debts paid from the shield box.
   Growth (asked for 2026-10-23: young cities grew too slowly and could not support settlers; two of four
   measured proposals picked; our departures): the city's own square is spared Despotism's and Anarchy's
   -1 (`tileYield`, an irrigated grassland centre gives 3 food), and settlers cost only their food, never
   shields: they take no free unit and are never disbanded for upkeep (`paysShields`; the planner's
   `affordsSettlers` knows it). A player city on 40 starts (Growth focus): size 4 by turn 32 (was 45),
   size 5 by 49 (was 71); one keeping two settlers home no longer goes without spare shields (12% of
   turns before). Saves before version 24 load with `centrePenalty` and `settlerShields` (headless
   `--old-support`). Head to head (planner vs v2, 16 x 300): old rules 12-4, score 124 vs 99, pop 40 vs 39;
   new 13-3, score 149 vs 108, pop 50 vs 45. Still open: AI cities stay small (the planner's balanced weights prefer forest to
   grassland and it keeps building settlers), and the border rule keeps young cities to their 8 squares.
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
   cities 20.9 vs 10.3, techs 30.0 vs 29.4. Open AI gaps: no amphibious invasions, no tribute demands to the player (it asks the player off its land and offers treaties), its units ignore the player's borders,
   colonists sometimes wait long in port. A 7-civ round costs ~1.3-1.6x v2 (~55 ms late game);
   core's `findPath` (typed-array heap, results identical to the old search, see
   `tests/pathfind.test.ts`) is still the hot spot. Measure AI changes with
   `npm run headless -- --ai planner,v2 --games 16 --turns 300 --verify` (8-game runs are too noisy to trust;
   at the default 200 turns the two are close, 124 vs 120: v3 pulls ahead later, with colonies and campaigns).
3. Every wonder is bound (Great Library, sea-move wonders, SETI, Hoover, Women's Suffrage, UN).
   Caravans done (help wonder, trade routes: mutual `City.routes`, bonus on opening, route trade in
   `computeCity`). Pollution (per-city chance from shields and industrial population, halved tile output, settler
   clean-up, global warming when it spreads), railroads (free moves, +50% shields) and fortresses
   (x2 defence, no stack loss) done. Spaceship done (`rules/spaceship.ts`: parts after Apollo, launch,
   flight, landing wins; lost with the capital; F6 screen; the planner races once it knows Space
   Flight and lands around turn 600-700 in all-AI games). Diplomats done (`diplomat` command next to a
   foreign city: steal an advance, sabotage, incite revolt via `inciteCost`; a victim at peace declares
   war; a diplomat never walks into a foreign city, guarded or not: the move is refused with reason
   `diplomat` and the web app offers the missions, also when a goto brings it to the gate). Nuclear units detonate: everything within a tile dies, the city is halved, fallout is
   left; SDI Defense within three tiles stops them. No embassies, city investigation, air fuel or
   trireme loss at sea yet.
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
  twenty audience scenes; 2026-10-23: the 74 advances; 2026-10-24: 47 improvements, wonders and spaceship
  parts) are shown exactly as supplied, never converted, redrawn, cropped or recoloured
  (asked for, twice, emphatically: conversions into the palette looked "bad and distorted", and new
  images must not be generated); see the setup cards and the audience screen above; new art drawn here follows their manner (see `packages/renderer-retro` above) and
  the user's pixel-art rules: even chunky strokes, one-pixel outlines in dark shades of the thing's own
  colours (no heavy black), the blocky 5x7 text, nothing algorithmically thinned or smoothed.
- Commit per phase or per feature; messages in imperative mood.
