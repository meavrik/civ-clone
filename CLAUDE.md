# Epochs (repo: civ-clone)

Browser reimplementation of a 1991-style 4X empire game: same rules and
320x200/256-colour presentation, all artwork and text original. Working title
"Epochs". Never ship the original's name, sprites, palette art, fonts or text.

## Commands

- `npm run dev` — Vite dev server for apps/web (http://localhost:5173)
- `npm test` — vitest, all packages (50+ tests; render tests dump PNGs to `packages/renderer-retro/tests/out/`)
- `npm run typecheck` — `tsc -b` across the workspace (strict, exactOptionalPropertyTypes, noUncheckedIndexedAccess)
- `npm run build` — typecheck + Vite build
- `npm run headless -- --games 4 --turns 200 --civs 4 [--every 25] [--ai baseline,planner] [--verify] [--json out.json]` —
  seeded all-AI tournaments (`tools/headless`); `--verify` replays each game from its save and checks the state digest
- npm and pnpm both work (`workspaces` + `*` deps, `.npmrc` links workspace packages for pnpm)

## Layout

- `packages/core` — deterministic game engine, zero DOM. Rules as data in `src/rules/*`
  (terrain, units, buildings, wonders, advances, governments, civs). Map gen, cities,
  combat, pathfinding, diplomacy, barbarians, save/score. Entry: `src/index.ts`.
- `packages/ai` — opponents, speaking only `Command`s: `planner.ts` (AI v2, shipped as `aiTurn`) and
  `baseline.ts` (v1, kept as the tournament yardstick). The planner is stateless between turns: it
  re-derives the empire picture (`analyse`) from `GameState` every turn, so replays stay exact.
- `packages/renderer-api` — the `Renderer` interface every renderer implements (draw each screen
  in its own logical size, hit-test menus/city map/tiles/minimap), the shared view types and the
  DOM-free screen logic (`setupMenu`, `leaderLine`). The web app only talks to a `Renderer`.
- `packages/renderer-retro` — indexed 320x200 `Surface`, 256-colour `palette.ts`, bitmap
  `font.ts`, code-drawn `tiles.ts`/`overlays.ts`, `widgets.ts` (panel/menu/box), one file
  per screen in `src/screens/*`.
- `packages/renderer-modern` — canvas-2D renderer on a 960x600 logical surface (same panel/
  viewport split, 48px tiles): `theme.ts` (all colours and fonts), `draw.ts` (panels, wrapped
  text, bars), `tiles.ts`/`markers.ts` (terrain, overlays, units, cities), `screens/*`. It draws
  through a `Context2D` subset so Node tests use a recording fake.
- `apps/web` — `main.ts` (screen stack + input, picks the renderer: `?renderer=modern|retro`, the
  "Visuals" menu entry, remembered in localStorage), `retro-renderer.ts` (adapter), `display.ts`
  (canvas fitting: crisp integer scale for retro, DPR-aware for modern), `storage.ts` (IndexedDB saves).
- `tools/headless` — tournament harness: `runGame(config)` plays an `allAi` game through `runAiPlayers`, samples
  per-civ stats, fingerprints the final state; `AIS` registry seats a named AI per civ. `cli.ts` prints tables.
- `scripts/mirror-test.sh` — for a Linux shell on a Mac checkout; not needed on macOS.

## Invariants (do not break)

- All game mutation goes through `applyCommand(state, cmd)` in `core/src/commands.ts`.
  Human input, AI and replays use the same `Command` union. Add new actions as commands.
- Randomness only via `state.rng` (`nextInt`/`nextFloat`). Never `Math.random` in core/ai.
  Seed + command log must replay to an identical state (`save.ts`, test in `tests/save.test.ts`).
- Renderers never touch `state.rng` and never change state. The retro renderer draws into
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
runtime. Next: mobile/PWA + touch adapter.

## Known gaps / next steps

1. Rules data verified against FreeCiv's civ1 ruleset (2026-10-16): tech edges, unit/building/
   wonder/terrain numbers. Deliberate departures: rivers give +1 trade, Michelangelo's acts as a
   cathedral everywhere, Colossus boosts ocean tiles. Legion 3/1, Musketeers 2/3, Riflemen 3/5
   follow the ruleset even though the 1991 manual is often quoted as 4/2, 3/3, 5/4.
2. Phase 7 — AI v2 done: harness (`tools/headless`) + planner. At 300 turns / 4 civs the planner
   averages ~22 cities, ~43 techs, score ~200 vs the baseline's ~4 / ~8 / ~27. Open AI gaps: no naval
   expansion or transport (settlers never leave the home continent), no tech trading, wars rarely end
   in conquest. A 300-turn 5-civ game runs in ~5-8s; `findPath` is still the hot spot if it regresses.
   Measure any AI change with `npm run headless -- --ai planner,baseline --games 8 --verify`.
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
- When a render change is made, run the render tests and look at the PNGs in `tests/out/`.
- Commit per phase or per feature; messages in imperative mood.
