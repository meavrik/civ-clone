# Epochs (repo: civ-clone)

Browser reimplementation of a 1991-style 4X empire game: same rules and
320x200/256-colour presentation, all artwork and text original. Working title
"Epochs". Never ship the original's name, sprites, palette art, fonts or text.

## Commands

- `npm run dev` — Vite dev server for apps/web (http://localhost:5173)
- `npm test` — vitest, all packages (50+ tests; render tests dump PNGs to `packages/renderer-retro/tests/out/`)
- `npm run typecheck` — `tsc -b` across the workspace (strict, exactOptionalPropertyTypes, noUncheckedIndexedAccess)
- `npm run build` — typecheck + Vite build
- `npm run headless -- --games 4 --turns 200 --civs 4 [--every 25] [--ai baseline,planner] [--world earth [--historical]] [--verify] [--json out.json]` —
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
- `packages/ai` — opponents, speaking only `Command`s: `planner.ts` (AI v3, shipped as `aiTurn`),
  `planner-v2.ts` (frozen copy of v2, the head-to-head yardstick: do not tune it) and `baseline.ts`
  (v1). The planner is stateless between turns: it re-derives the empire picture (`analyse`) from
  `GameState` every turn (units' goto orders are its only memory, and they are game state), so
  replays stay exact. `describePlan` exposes its view (sites, colony plan, campaign) for tests.
- `packages/renderer-api` — the `Renderer` interface every renderer implements (draw each screen
  in its own logical size, hit-test menus/city map/tiles/minimap/menu bar), the shared view types and the
  DOM-free screen logic (`setupMenu`, `leaderLine`, `wondersReport`, `topCitiesReport`). The web app
  only talks to a `Renderer`. Info panels prefer icons to words: `ICONS` (`renderer-api/src/icons.ts`)
  names them, every renderer draws all of them, and text may carry `{icon}` tokens (modal bodies and
  panel lines; groups separated by two spaces wrap apart). The main screen has a menu bar (`MENU_BAR`: Game, Orders, Advisors,
  World, Debug) above map and panel; a `MenuState` with an `anchor` and an empty title is a bar dropdown.
  Debug's entries (reveal map, gold, research, production, moves, contact) are the core `cheat` command, logged and replayed like any order.
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
  Borders (`territory.ts`, drawing only, toggled in the Game menu): each known city claims its
  `CITY_RADIUS`, the nearer then older city winning a shared square; `borderSides` gives the edges and
  where a line must reach past an inner corner. Drawn after all squares, under the fog.
- `packages/renderer-retro` — indexed 320x200 `Surface`, 256-colour `palette.ts`, bitmap
  `font.ts`, `widgets.ts` (panel/menu/box), one file per screen in `src/screens/*`. Units,
  terrain, cities, villages and specials are pixel art in `src/art/*.art.ts` (text grids; legend
  and parser in `src/sprites/sheet.ts`, compiled surfaces in `src/sprites/index.ts`; 8x8 panel icons
  in `icons.art.ts`, drawn with `src/icons.ts`); roads,
  rivers, irrigation, rails, forts and smog stay code-drawn in `tiles.ts`/`overlays.ts`.
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
homelands, starts nudged 3+ squares apart) and "Customize world" (land/temperature/climate/age). 18 civs
(the original's 14 plus Spanish, Vikings, Hittites, Persians). Next: mobile/PWA + touch adapter.

## Known gaps / next steps

1. Rules data verified against FreeCiv's civ1 ruleset (2026-10-16): tech edges, unit/building/
   wonder/terrain numbers. Deliberate departures: rivers give +1 trade, Michelangelo's acts as a
   cathedral everywhere, Colossus boosts ocean tiles. Units have hit points and firepower (`hp`,
   `firepower` in `rules/units.ts`: 10 ancient, 20 gunpowder, 30-40 mechanised/steel; heavy guns hit
   for 2): fights go in rounds won with A/(A+D), survivors keep wounds and heal by resting (`HEALING`).
   `attackOdds` gives the exact chance. `classicCombat` (version 1 saves, `?combat=classic`) restores
   the original one-roll fights with the same RNG use, so old saves replay unchanged. Legion 3/1, Musketeers 2/3, Riflemen 3/5
   follow the ruleset even though the 1991 manual is often quoted as 4/2, 3/3, 5/4.
2. AI v3 done (2026-10-17) on top of the Phase 7 harness and planner. New in v3: colonies (sites
   settlers cannot walk to, `landReach` 18 steps and never through a rival city, are "overseas":
   ferries berth beside a port, take settlers and an escort, land them on the site; Map Making then
   Navigation when boxed in), AI-to-AI technology swaps (`manageTrade`, one for one, every third
   turn per pair), campaigns (target judged by `attackersNeeded` from expected damage and a land path
   from the staging city; the army's own gotos keep the target; gather at the staging city with an
   escort, camp on the best square beside the walls, `assault` storms in order of the odds and goes
   all in when the group can clear the city this turn), wars of choice only at twice a rival's
   strength with a city already within reach, and peace by agreement (`acceptsPeace`: a winning AI
   refuses, the player's offers too). Head-to-head against frozen v2 (`--ai planner,v2`, 300 turns):
   4 civs x16 games 10-6 wins, score 219 vs 199, techs 41 vs 38; 7 civs parity in score with more
   techs. Every civ on v3 vs every civ on v2: Earth historical 7 civs score 160 vs 129, cities 17 vs
   14. Open AI gaps: no amphibious invasions, no tribute or AI-initiated diplomacy with the player,
   colonists sometimes wait long in port. A 7-civ round costs ~1.3-1.6x v2 (~55 ms late game);
   core's `findPath` (typed-array heap, results identical to the old search, see
   `tests/pathfind.test.ts`) is still the hot spot. Measure AI changes with
   `npm run headless -- --ai planner,v2 --games 16 --verify` (8-game runs are too noisy to trust).
3. Every wonder is bound (Great Library, sea-move wonders, SETI, Hoover, Women's Suffrage, UN).
   Caravans done (help wonder, trade routes: mutual `City.routes`, bonus on opening, route trade in
   `computeCity`). Pollution (per-city chance from shields and industrial population, halved tile output, settler
   clean-up, global warming when it spreads), railroads (free moves, +50% shields) and fortresses
   (x2 defence, no stack loss) done. Spaceship done (`rules/spaceship.ts`: parts after Apollo, launch,
   flight, landing wins; lost with the capital; F6 screen; the planner races once it knows Space
   Flight and lands around turn 600-700 in all-AI games). Diplomats done (`diplomat` command next to a
   foreign city: steal an advance, sabotage, incite revolt via `inciteCost`; a victim at peace declares
   war). Nuclear units detonate: everything within a tile dies, the city is halved, fallout is
   left; SDI Defense within three tiles stops them. No embassies, city investigation, air fuel or
   trireme loss at sea yet.
4. Diplomacy exchange offers first-for-first only; no embassies or AI-to-AI tech trading.
5. Modern renderer polish: real sprites/icons for units and specials, animation, hover states.
6. Mobile: PWA + touch adapter in apps/web (input is already centralised in main.ts).

## Conventions

- TypeScript strict; small pure functions; tests next to packages in `tests/`.
- When a render change is made, run the render tests and look at the PNGs in `tests/out/`
  (`sprites.png` previews every sprite on two civilizations' colours; `main-screen.png` the map).
- Art is ours: draw new sprites in the text grids or a paint program and import them. Do not use
  image generators or the original game's files for shipped art.
- Commit per phase or per feature; messages in imperative mood.
