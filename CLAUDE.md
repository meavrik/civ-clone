# Epochs (repo: civ-clone)

Browser reimplementation of a 1991-style 4X empire game: same rules and
320x200/256-colour presentation, all artwork and text original. Working title
"Epochs". Never ship the original's name, sprites, palette art, fonts or text.

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
- npm and pnpm both work (`workspaces` + `*` deps, `.npmrc` links workspace packages for pnpm)

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
  content up to the difficulty's base (6 Chieftain .. 2 Emperor; our departure, FreeCiv plays 4) and unhappy
  beyond; an empire holding more cities than its government's `empireSize` (Anarchy 9 .. Democracy 14) loses one
  content citizen a city, one more per `EMPIRE_SIZE_STEP` (10) cities. Then stage by stage (`CityReport.moods`,
  shown by the city screen's Happy panel, H or its button, as the original's Happy analysis did): luxuries (two
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
- `packages/renderer-api` — the `Renderer` interface every renderer implements (draw each screen
  in its own logical size, hit-test menus/city map/city buttons/tiles/minimap/menu bar), the shared view types and the
  DOM-free screen logic (`setupMenu`, `leaderLine`, `wondersReport`, `topCitiesReport`, `builtNotice`).
  City screen: Change and Buy buttons in the production box (`cityButtonAt`); the worked squares of its
  map carry their yield marks on a half-tone shade of the square's lower half (asked for 2026-10-21: no
  black box); Esc, Enter (not held) or a click
  on nothing that answers (not a button, unit or city square) leaves it; Buy (button or B) shows the
  price against the treasury first. The build menu (`openProductionMenu` in the web app) shows for each
  choice only what is left: the shields still needed beyond those a change would keep and the turns
  that takes ("never" without a surplus), the title saying how many shields are stored. A change of production keeps the box for the kind it was
  gathered for and half of it for another kind (`shieldsAfterChange`: reckoned from the box as the turn
  began, `City.turnShields`/`turnKind`, or as bought, so changing and changing back in a turn costs
  nothing; FreeCiv's model). Saves before version 21 load with `compoundingPenalty`: every change of
  kind halved the box again. Its units (`cityUnits`: those in the city from any home, then those it
  supports elsewhere, faded, each with its cost) are picked with `cityUnitAt`: the unit wakes (fortify or
  sentry dropped, the `activate` command) and the map takes it up; one with no moves left keeps its orders. A city that finishes an improvement, wonder or spaceship part opens
  over its city screen with a window saying what it does (`text` on each rule in `rules/buildings.ts`,
  `wonders.ts`, `spaceship.ts`), then asks what to build next; leaving the city goes on with the turn's news
  (the city `Screen`'s `then`). Finished units say nothing (the city goes on building them), except Settlers: they cost a
  citizen, so their window asks what to build next. That window
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
  screen; keep modal text to a line or two. A list longer than the screen (what to build late in the game) scrolls:
  `MenuState.top` kept by `keepInView`, `Renderer.menuRows` and `menuScrollAt` (retro draws a bar with
  arrows); arrows, PgUp/PgDn, Home/End, the wheel and clicks on the bar move through it.
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
  opens it (`openTree`) on every advance found (end of turn, village, diplomat, treaty) and wherever
  research is picked (science advisor A, Advisors > Research, and a click on the status panel's research
  row: `Renderer.statusAt`); when research is due it closes only on a pick.
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
  lay rails and sleepers (spaced evenly along each course) on the same courses. Irrigation is fields:
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
  a second shield behind for a stack, hp as a strip across its top; no owner box), features
  (`features.art.ts`: city, walls/walls_front, hut, mine, drawn by `tools/sprites/draw/features.ts` as
  layers lit from the upper left with one-pixel outlines in the darkest of each thing's own colours,
  ground showing between the houses about a well; the garrison shield and mood flag are code in
  `map-city.ts`, and the population sits on a plate of the owner's colour before the city's name under
  the square, `drawCityLabel` in `screens/main.ts`: asked for 2026-10-21 after a plate on the town hid it) and resources (`resources.art.ts`, named after the special; one-pixel outlines in dark
  shades of their own colours, never thick black) are all 32x32 sheets with `k = 2`; icons are 16x16
  fine; citizens 32x32. Land borders blend: renderer-api `groundOwner` warps each fine pixel by world
  noise so the line between different grounds wanders, and each terrain sprite splits at load into
  ground + objects (objects never cut). Text (`font.ts`): our own 4x6-dot proportional pixel font (three
  to five dots wide, a seventh row for the descenders of g, j, p, q, y), a dot a whole screen pixel
  (a 2x2 block on the fine screen), so strokes and gaps are whole dots: asked for 2026-10-21 ("make
  game font more pixelated") in place of the 5x7 glyphs drawn at three quarters with overlapping
  dots; `FONT_HEIGHT` 8 stays. `drawTextPlate` puts text on an edged plate (the city size). The palette
  is FULL: ramps `hide`, `mire`, `canopy`, `rock`, `ice` (in the old ui/fog/swamp/jungle slots),
  `meadow`, `leaf`, `mound`, `wheat`, `dune`, `heath`, `sea`, `steel`, and `jewel` (6 colours, 249-254;
  `shade` clamps to `RAMP_SIZE`); new art must reuse these ramps or free one. Panel icons (`icons.art.ts`,
  drawn with `src/icons.ts`) and the small marks (`drawMark`: tick, new, yield, moves) are hand-drawn
  16x16: food is an ear of wheat, `shield` (production) a hammer, `people` a man and a woman; roads,
  rivers, irrigation, rails, forts and smog stay code-drawn in `tiles.ts`/`overlays.ts`.
  Citizens (city screen) are whole figures: `citizens.art.ts` holds a man and a woman to each sprite,
  one per mood or trade, plus a "-2" look (beard, headscarf); `citizens.ts` swaps the sheet's
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
  back into `src/art`, rejecting any pixel outside the sprite's palette legend; `npm run sprites -- icons`
  draws the mobile app's icons (a walled city, `icons.ts`) into `apps/mobile/public/icons`.
- `packages/renderer-modern` — canvas-2D renderer on a 960x600 logical surface (same panel/
  viewport split, 48px tiles): `theme.ts` (all colours and fonts), `draw.ts` (panels, wrapped
  text, bars), `tiles.ts`/`markers.ts` (terrain, overlays, units, cities), `screens/*`. It draws
  through a `Context2D` subset so Node tests use a recording fake.
- `apps/web` — `main.ts` (screen stack + input; draws with the retro renderer only: the modern one is
  set aside for now, still built and tested but not offered), `retro-renderer.ts` (adapter), `display.ts`
  (canvas fitting: crisp integer scale for retro, DPR-aware for modern), `storage.ts` (IndexedDB saves,
  per browser: slot 0 is the autosave, written as every turn begins and when a game starts or loads).
  The title offers "Continue" (the autosave) and, like the Game menu, "Back to an earlier turn": a save
  is a seed and the player's commands, so `turnStarts`/`rewindSave` (core `save.ts`) cut its log back
  to the start of any turn it saw. A loaded game holds Auto End Turn until the next key or click.
  Diplomacy: a meeting first holds the map on whom we met (the `beat` screen:
  a callout, 1.6 s or any key), then their leader receives us (`audience`: without a treaty propose
  peace (`proposePeace`: yes, a gift first, or no); at peace open or close borders and exchange maps;
  always trade knowledge (pick theirs, they name ours), give gold, demand tribute, declare war ("break
  the treaty" at peace); each once a talk, the answer becomes the leader's words; greetings name
  admiration or scorn). An envoy's offer (`peaceOfferAudience`) is signed or refused; signing goes on
  into an audience. The Foreign Minister shows the standing (`standing`), each civ's influence and
  whether they admire or scorn us (`regardWords`). Stepping onto land that minds us (once a
  civ a turn, later steps get a callout) and the AI's demands after its turn show our unit, then the
  leader asks us out (`askToLeave`: leave = gotos to the nearest square outside, open borders (at
  peace only), a gift, or stay); an AI declaring war on us says so in an audience.
- `apps/mobile` — the web game as a PWA for phones and tablets, asked for without changing the web game:
  `src/main.ts` imports `apps/web/src/main.ts` as it is, and `vite.config.ts` (`webGame`) hands that file
  three stand-ins for its own modules: `display.ts` (screen and controls laid out by `layout.ts`: a pad
  column left and a keys column right, or a band below when upright, whichever leaves the bigger screen;
  safe-area insets; `toLogical` from the canvas rect at any scale), `renderer.ts` (the web retro renderer
  with the map drawn and hit-tested through `MapPan`: a finger's drag, let go when the game moves its
  camera, the active unit changes or a key is pressed on the map; keeps the frame's `TextInputState`) and
  `storage.ts` (same slots; remembers the last autosave so `save.ts` can save the turn so far when the page
  is hidden). Keep those three web modules' exports as they are (each stand-in `satisfies` its web
  counterpart's type). It reads `window.civ` (`screen`, `state`, `log`) from web main.ts: keep that hook.
  `touch.ts` turns fingers (`gestures.ts`) into the mouse the game knows: tap = mousedown 0, hold 450 ms
  = mousedown 2, drag = pan or the research list's wheel; mouse pointers are left to the browser. `controls.ts`
  presses the keys `keys.ts` lists per screen kind (the pad: Numpad diagonals and C on the map, arrows in
  menus). `text.ts` shows a DOM field while the game asks for text, bound to the game's `TextInputState`,
  OK/Cancel = Enter/Esc. The build writes `sw.js` from `service-worker.js` (every file precached under a
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
  pixel for pixel; new art drawn here follows their manner (see `packages/renderer-retro` above) and
  the user's pixel-art rules: even chunky strokes, one-pixel outlines in dark shades of the thing's own
  colours (no heavy black), the blocky 5x7 text, nothing algorithmically thinned or smoothed.
- Commit per phase or per feature; messages in imperative mood.
