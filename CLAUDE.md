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
- `packages/renderer-retro` — indexed 320x200 `Surface`, 256-colour `palette.ts`, bitmap
  `font.ts`, code-drawn `tiles.ts`/`overlays.ts`, `widgets.ts` (panel/menu/box), one file
  per screen in `src/screens/*`.
- `apps/web` — `main.ts` (screen stack + input), `display.ts` (canvas scaling), `storage.ts` (IndexedDB saves).
- `tools/headless` — tournament harness: `runGame(config)` plays an `allAi` game through `runAiPlayers`, samples
  per-civ stats, fingerprints the final state; `AIS` registry seats a named AI per civ. `cli.ts` prints tables.
- `scripts/mirror-test.sh` — for a Linux shell on a Mac checkout; not needed on macOS.

## Invariants (do not break)

- All game mutation goes through `applyCommand(state, cmd)` in `core/src/commands.ts`.
  Human input, AI and replays use the same `Command` union. Add new actions as commands.
- Randomness only via `state.rng` (`nextInt`/`nextFloat`). Never `Math.random` in core/ai.
  Seed + command log must replay to an identical state (`save.ts`, test in `tests/save.test.ts`).
- Renderer never touches `state.rng`; it draws into `Surface` with palette indices only.
  No RGB in game code. Use `shade(ramp, 0..7)` or `C.*`.
- Movement points are stored in thirds (`MOVE_FRAC = 3`). Map wraps east-west only (`wrapX`).
- `endTurn` cycles players: human -> AI civs -> barbarians (skipped when unit-less) -> turn++.
  `lastTurnEvents` is the per-turn event list the UI presents.
- Rules live in data files; prefer adding fields there over special-casing in code.

## Status

Phases 1–6 done: world, cities, tech/wonders/governments, combat/transport/goto, multi-civ
turns + baseline AI, diplomacy, save/load, title/setup, advisors, end conditions.

## Known gaps / next steps

1. Verify the tech-tree edges (`rules/advances.ts`) and numeric tables against FreeCiv's
   civ1 ruleset (read it, don't paste it; it's GPL). Data-only change.
2. Phase 7 — AI v2 done: harness (`tools/headless`) + planner. At 300 turns / 4 civs the planner
   averages ~22 cities, ~43 techs, score ~200 vs the baseline's ~4 / ~8 / ~27. Open AI gaps: no naval
   expansion or transport (settlers never leave the home continent), no tech trading, wars rarely end
   in conquest. A 300-turn 5-civ game runs in ~5-8s; `findPath` is still the hot spot if it regresses.
   Measure any AI change with `npm run headless -- --ai planner,baseline --games 8 --verify`.
3. Unbound wonders: Great Library, Great Wall (partially), Lighthouse, Magellan's,
   Women's Suffrage, UN. Caravans/trade routes, diplomats, pollution, spaceship not implemented.
4. Rename uses `prompt()`; diplomacy exchange offers first-for-first only.
5. Phase 8 — modern-visuals renderer behind the same screen API; swap `renderer-retro`.
6. Mobile: PWA + touch adapter in apps/web (input is already centralised in main.ts).

## Conventions

- TypeScript strict; small pure functions; tests next to packages in `tests/`.
- When a render change is made, run the render tests and look at the PNGs in `tests/out/`.
- Commit per phase or per feature; messages in imperative mood.
