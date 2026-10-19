# Epochs (repo: civ-clone)

Browser reimplementation of a 1991-style 4X empire game: same rules and
320x200/256-colour presentation, all artwork and text original. Working title
"Epochs". Never ship the original's name, sprites, palette art, fonts or text.

## Commands

- `npm run dev` — Vite dev server for apps/web (http://localhost:5173)
- `npm test` — vitest, all packages (50+ tests; render tests dump PNGs to `packages/renderer-retro/tests/out/`)
- `npm run typecheck` — `tsc -b` across the workspace (strict, exactOptionalPropertyTypes, noUncheckedIndexedAccess)
- `npm run build` — typecheck + Vite build
- `npm run headless -- --games 4 --turns 200 --civs 4 [--every 25] [--ai baseline,planner] [--world earth [--historical]] [--classic-terrain] [--open-mountains] [--verify] [--json out.json]` —
  seeded all-AI tournaments (`tools/headless`); `--verify` replays each game from its save and checks the state digest
- `npm run maps [-- europe]` — rebuild the premade worlds from Natural Earth data (`tools/maps`, cached in `tools/maps/.cache`,
  previews in `tools/maps/out/*.png`; look at them after any change)
- npm and pnpm both work (`workspaces` + `*` deps, `.npmrc` links workspace packages for pnpm)

## Layout

- `packages/core` — deterministic game engine, zero DOM. Rules as data in `src/rules/*`
  (terrain, units, buildings, wonders, advances, governments, civs). Map gen (`map/generate.ts`), premade
  worlds (`map/premade.ts` + generated `map/worlds/*.ts`: 50 rows of 80 terrain chars, upper case = river,
  and each native civ's homeland square), cities,
  combat, pathfinding, diplomacy, barbarians, save/score. Entry: `src/index.ts`.
  Generated worlds: land from random-walk chunks, terrain from the climate (`climateWorld`): smooth
  heat and rain fields that wrap east-west, rain in latitude belts and on prevailing winds that dry out
  over land and mountains (rain shadows), ranked so biome shares stay steady; mountains on noise ridges
  with hills as foothills; lone squares join their neighbours; rivers rise in wet highlands and run
  to the sea. `scatteredTerrain` keeps the first per-square generator for saves before version 6.
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
  sees whom it met; cities see the squares next to them. Land (`territory.ts`: `claims`, `landOwner`):
  each city its `CITY_RADIUS`, the nearer then older city winning. At peace without open borders
  (`openBorders`/`closeBorders` commands, `state.openBorders`) a civilization minds land units on its
  land (`trespassOn`: not diplomats, caravans or units aboard): stepping in records its first demand
  to leave (`state.trespass`, a `trespass` event), `demandLeave` adds one, a gift (`giveGold`) forgives,
  and the record drops at the owner's turn once the units are gone. Other deals: `shareMaps`,
  `tribute` (`tributePaid`). `warDeclared` says who declared on whom (`on`) and why (`reason`).
  Saves before version 10 load with `farContact` and `noTrespass` (meeting at two squares, no stop).
- `packages/ai` — opponents, speaking only `Command`s: `planner.ts` (AI v3, shipped as `aiTurn`),
  `planner-v2.ts` (frozen copy of v2, the head-to-head yardstick: do not tune it), `baseline.ts`
  (v1) and `barbarian.ts` (the barbarians, reached through `baselineTurn` so every AI seat shares it:
  boats land raiders beside the nearest city, soldiers storm cities at long odds, loot farms and mines
  on the way and keep their best defender home, the leader keeps to its band and slips away alone).
  The planner treats a barbarian-held city on its continent as a war to win back. Borders
  (`guardBorders`): a human civ's units on its land are asked off (stepping in was the first request),
  warned once more a turn later, then war (`reason: "trespass"`) unless the planner is under 0.6x the
  intruder's strength (then it complains every 5 turns); computer civs do not mind each other. The
  player's audience asks pure functions of the state: `attitude` (friendly, wary when proud or
  aggrieved, hostile at war or after a last warning), `bordersAnswer` (wary: for `BORDERS_PRICE`
  gold), `acceptsMapSwap`, `tributeOffer` (only far weaker civs, once in 20 turns), `tradeAsk`. The planner is
  stateless between turns: it re-derives the empire picture (`analyse`) from `GameState` every turn
  (units' goto orders are its only memory, and they are game state), so replays stay exact.
  `describePlan` exposes its view (sites, colony plan, campaign) for tests.
- `packages/renderer-api` — the `Renderer` interface every renderer implements (draw each screen
  in its own logical size, hit-test menus/city map/city buttons/tiles/minimap/menu bar), the shared view types and the
  DOM-free screen logic (`setupMenu`, `leaderLine`, `wondersReport`, `topCitiesReport`, `builtNotice`).
  City screen: Change and Buy buttons in the production box (`cityButtonAt`); Esc, Enter (not held) or a click
  on nothing that answers (not a button, unit or city square) leaves it; Buy (button or B) shows the
  price against the treasury first. Its units (`cityUnits`: those in the city from any home, then those it
  supports elsewhere, faded, each with its cost) are picked with `cityUnitAt`: the unit wakes (fortify or
  sentry dropped, the `activate` command) and the map takes it up; one with no moves left keeps its orders. A city that finishes an improvement, wonder or spaceship part opens
  over its city screen with a window saying what it does (`text` on each rule in `rules/buildings.ts`,
  `wonders.ts`, `spaceship.ts`), then asks what to build next; leaving the city goes on with the turn's news
  (the city `Screen`'s `then`). Finished units say nothing: the city goes on building them. That window
  is headed by the building's picture (`MenuState.picture`). City view (`cityview.ts`, the original's View:
  the city screen's View button or V; the modern city screen shows it small as the button): every improvement
  and wonder has a `PICTURES` entry made of shapes (`Part`: rect, poly, oval, line, each of a `Material`) on a
  grid of retro pixels; `cityScene` lays a city out (wonders on the back row, the palace in the middle, then
  improvements and homes of the owner's age filling the middle rows outward, trees beyond, walls before the
  front row, the land to the north on the horizon, a river if the city has one), hashed, never the RNG. Retro
  fills the shapes pixel by pixel (`pictures.ts`: lit left, shaded right, outlined in black); modern paints
  them as paths three times larger. A click names a building (`cityViewAt`), anything else goes back. The web app
  only talks to a `Renderer`. Info panels prefer icons to words: `ICONS` (`renderer-api/src/icons.ts`)
  names them, every renderer draws all of them, and text may carry `{icon}` tokens (modal bodies and
  panel lines; groups separated by two spaces wrap apart). The main screen has a menu bar (`MENU_BAR`: Game, Orders, Advisors,
  World, Debug) above map and panel; a `MenuState` with an `anchor` and an empty title is a bar dropdown.
  A titled menu of up to four choices is a modal (`menuButtons`): its choices are buttons sized to the
  longest label and centred, and its text wraps rather than widen it past `MODAL_MAX_SHARE` of the
  screen; keep modal text to a line or two.
  Debug's entries (reveal map, gold, research, production, moves, contact) are the core `cheat` command, logged and replayed like any order.
  A refused move (`tryMove` in the web app) nudges the unit toward the square (`MotionPlayer.nudge`,
  a UI-only beat) and puts a note beside it (`view.callout`, words from `moveRefusal` in `refusal.ts`),
  gone after 4 s or at the next key or click. Both status panels show the research under way
  (`researchOutlook`: advance, beakers, turns to go), and nothing while none is picked. Disbanding
  (Shift+D, Orders > Disband) asks "Are you sure?" first, No by default (`confirmDisband`).
  Unit animation: core appends every step (`applyMove`) and fight (`resolveCombat`, round by round) to
  `lastActions` (a UI side channel like `lastTurnEvents`, emptied by `endTurn`, never read by replays or
  AI); `MotionPlayer` (`renderer-api/src/motion.ts`) times them into `view.moving` (slides) and
  `view.battle` (lunge, blows, hp draining, the loser's burst), and renderers draw from those.
  Coasts: `coast.ts` gives both renderers one shoreline field (square depth 0 land / 1 water touching
  land / 2 open sea, interpolated between square centres plus noise that wraps with the map), so shores
  and the edge of deep water wander across square borders while every square's centre keeps its kind.
  Rivers (`river.ts`): curves from a meeting point near each square's centre to a crossing point
  picked per border (both squares agree, the curve leaves square to the border), meandering between,
  widening toward the sea; the sea square carries the mouth on through spilled shore. Strokes show on
  land only. Retro blends coast and river per pixel (`terrainSquare` in `tiles.ts`, cached by
  neighbourhood); modern fills marching-squares paths (`renderer-modern/src/coast.ts`) and strokes rivers.
  Fog of war (`fog.ts`): unexplored squares are dark clouds, and fog drifts into explored squares beside
  them (solid at the border, clear before the centre). `FogLifter` (a UI side channel run by
  `apps/web` each frame, like `MotionPlayer`) fades fog off newly explored squares over 700 ms, held
  until a sliding unit of the viewer comes within reach, into `view.lifting`; foreign units and cities
  wait for it to half clear. Retro: `fogSquare`, two shades of the `fog` ramp, lifting dissolves
  through the Bayer dither; modern: `Clouds` gathers the view's fog and fills each layer as one path
  (per-square fills leave seams, and thousands of tiny polygons cost ~600 ms a frame), lifting squares
  as alpha layers grouped by fog left, bodies before billows (else edges show).
  Tech tree (`techtree.ts`): `techLayout(state)` lays out only what the player knows and what is
  within reach (the next phase, `techShown`); further advances stay hidden until they come within
  reach (the details still name what an advance leads to). Each shown advance gets a tier (its
  longest chain of shown prerequisites) and a row (barycentre sweeps), nine rows at most, and edges
  that skip tiers run along the lanes between rows (`techLane`) so they never pass behind an advance. `Renderer.techTree` draws a `TechTreeView` a few
  tiers at a time (`techColumns`), `techTreeHit` hit-tests it. The web app opens it (`openTree`) on
  every advance found (end of turn, village, diplomat, treaty) and wherever research is picked
  (science advisor A, Advisors > Tech Tree); when research is due it closes only on a pick.
  Borders (`territory.ts`, toggled in the Game menu, which hides only the drawing): core's `claims`
  from the cities the viewer knows, the same land the rules read for trespass; `borderSides` gives the edges and
  where a line must reach past an inner corner. Drawn after all squares, under the fog. The minimaps
  follow the same toggle: a line of the owner's colour round each civ's explored land; cities are
  marked in their owner's colour either way (retro: a white dot in a cross, darker inside a border).
  Roads and fields (`works.ts`): roads wander. Each square has a meeting point near its centre, and
  the course to each known road neighbour's bows and snakes, keyed by the pair and laid from the same
  end whichever square asks; every square draws whole courses clipped to itself, and the two squares
  beside a diagonal draw their part of it too (`roadWays`), so roads join without seams. Railroads
  lay rails and sleepers (spaced evenly along each course) on the same courses. Irrigation is fields:
  plots of crops in rows either side of an east-west canal (`fieldLayout`), running on into
  irrigated neighbours (`fieldSides`) with a strip of terrain elsewhere; water and the knolls of
  hills stay above them. Mines are a rock mound with a timber-framed shaft, drawn over the roads.
- `packages/renderer-retro` — indexed 320x200 `Surface`, 256-colour `palette.ts`, bitmap
  `font.ts`, `widgets.ts` (panel/menu/box), one file per screen in `src/screens/*`. Units,
  terrain, cities, villages, specials and mines are pixel art in `src/art/*.art.ts` (text grids; legend
  and parser in `src/sprites/sheet.ts`, compiled surfaces in `src/sprites/index.ts`; 8x8 panel icons
  in `icons.art.ts`, drawn with `src/icons.ts`, outlined in black so they read on every background: food
  is an ear of wheat, `shield` (production) a hammer, `people` a man and a woman); roads,
  rivers, irrigation, rails, forts and smog stay code-drawn in `tiles.ts`/`overlays.ts`.
  Citizens (city screen) are whole figures, 7x13: `citizens.art.ts` holds a man and a woman to a 16x16
  sprite, one per mood or trade, plus a "-2" look (beard, headscarf); `citizens.ts` swaps the sheet's
  stand-in skin, hair, trouser and clothes colours for each person's (`skin` ramp for deep skin tones).
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
  back into `src/art`, rejecting any pixel outside the sprite's palette legend.
- `packages/renderer-modern` — canvas-2D renderer on a 960x600 logical surface (same panel/
  viewport split, 48px tiles): `theme.ts` (all colours and fonts), `draw.ts` (panels, wrapped
  text, bars), `tiles.ts`/`markers.ts` (terrain, overlays, units, cities), `screens/*`. It draws
  through a `Context2D` subset so Node tests use a recording fake.
- `apps/web` — `main.ts` (screen stack + input, picks the renderer: `?renderer=modern|retro`, the
  "Visuals" menu entry, remembered in localStorage), `retro-renderer.ts` (adapter), `display.ts`
  (canvas fitting: crisp integer scale for retro, DPR-aware for modern), `storage.ts` (IndexedDB saves).
  Diplomacy: a meeting first holds the map on whom we met (the `beat` screen:
  a callout, 1.6 s or any key), then their leader receives us (`audience`: open or close borders,
  exchange maps, trade knowledge (pick theirs, they name ours), give gold, demand tribute, declare war;
  each once a talk, the answer becomes the leader's words). Stepping onto land that minds us (once a
  civ a turn, later steps get a callout) and the AI's demands after its turn show our unit, then the
  leader asks us out (`askToLeave`: leave = gotos to the nearest square outside, open borders, a gift,
  or stay); an AI declaring war on us says so in an audience.
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
prompt. Phase 8 done: modern-visuals renderer behind the shared `Renderer` API, switchable at
runtime. Premade worlds done: Earth, Europe, Middle East (title menu "Play on a premade world", optional
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
borders). Next: mobile/PWA + touch adapter.

## Known gaps / next steps

1. Rules data verified against FreeCiv's civ1 ruleset (2026-10-16): tech edges, unit/building/
   wonder/terrain numbers. Deliberate departures: rivers give +1 trade, Michelangelo's acts as a
   cathedral everywhere, Colossus boosts ocean tiles. Units have hit points and firepower (`hp`,
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
   Democracy). A city that cannot pay disbands units at once, newest first and settlers last (cargo of a
   ship at sea sinks with it), without touching its shield box; the `home` command (H) moves a unit's
   support to the city it stands in. Both city screens mark each supported unit's cost. `looseUpkeep`
   (saves before version 8, headless `--loose-upkeep`) keeps our first upkeep: 3 free units a city
   under Monarchy and Communism too, debts paid from the shield box.
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
   cities 20.9 vs 10.3, techs 30.0 vs 29.4. Open AI gaps: no amphibious invasions, no tribute demands or treaty offers to the player (it only asks the player off its land), its units ignore the player's borders,
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
5. Modern renderer polish: real sprites/icons for units and specials, animation, hover states.
6. Mobile: PWA + touch adapter in apps/web (input is already centralised in main.ts).

## Conventions

- TypeScript strict; small pure functions; tests next to packages in `tests/`.
- When a render change is made, run the render tests and look at the PNGs in `tests/out/`
  (`sprites.png` previews every sprite on two civilizations' colours; `main-screen.png` the map).
- Art is ours: draw new sprites in the text grids or a paint program and import them. Do not use
  image generators or the original game's files for shipped art.
- Commit per phase or per feature; messages in imperative mood.
