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


## Conventions

- TypeScript strict; small pure functions; tests next to packages in `tests/`.
- When a render change is made, run the render tests and look at the PNGs in `tests/out/`
  (`sprites.png` previews every sprite on two civilizations' colours; `main-screen.png` the map).
- Art is ours: draw new sprites in the text grids or a paint program and import them. Do not use
  image generators or the original game's files for shipped art. Exception the user made (2026-10-21):
  the terrain, unit and resource sheets were supplied by the user as reference images and copied in
  pixel for pixel. The user's portraits (2026-10-22: the five difficulty rulers, the twenty leaders, the
  twenty audience scenes; 2026-10-23: the 74 advances; 2026-10-24: the spaceship
  parts; 2026-10-28: the unit sheet, see Unit pictures; 2026-11-04: the improvements' and wonders' sheets, see Improvement pictures; 2026-11-05: the houses' sheet, see Houses) are shown exactly as supplied, never converted, redrawn, cropped or recoloured
  (asked for, twice, emphatically: conversions into the palette looked "bad and distorted", and new
  images must not be generated); see docs/windows.md and docs/apps-and-tools.md; new art drawn here follows their manner (see docs/renderers.md) and
  the user's pixel-art rules: even chunky strokes, one-pixel outlines in dark shades of the thing's own
  colours (no heavy black), the blocky 5x7 text, nothing algorithmically thinned or smoothed.
- Commit per phase or per feature; messages in imperative mood.

## Where things are

- `packages/core`: deterministic engine, zero DOM. Rules as data in `src/rules/*`; entry `src/index.ts`.
- `packages/ai`: opponents, speaking only `Command`s. `planner.ts` ships; `planner-v2.ts` is the frozen yardstick, do not tune it.
- `packages/renderer-api`: the `Renderer` interface, shared view types, DOM-free screen logic.
- `packages/renderer-retro`: the 320x200 palette renderer the game draws with. `packages/renderer-modern` is set aside, but must still build and pass.
- `apps/web`: the game. `apps/mobile`: the same game as a PWA, and what Netlify deploys.
- `tools/headless`, `tools/maps`, `tools/sprites`: tournaments, premade worlds, sprite sheets.

Never read `MAP_WIDTH`/`MAP_HEIGHT` for a game's map, or `TERRAIN_RULES[t].special` for a square, or `ADVANCES` directly in rules
code: use `map.width`/`map.height`, `specialOf(tile)`, `advancesFor(state)`. Use `costFor`, not `productionCost`, for what a city pays.

## Notes by topic

Detail lives in `docs/`, one file a topic. Read the file for what you are changing before you change it; search `docs/` for a name.
When you finish a feature, add its notes to the matching file, not here, and keep this file short.

| Working on | Read |
| --- | --- |
| Map, world sizes, starts, sight, place names | [docs/world.md](docs/world.md) |
| Specials, strategic resources, sea, herds | [docs/resources.md](docs/resources.md) |
| Barbarians, city-states, villages | [docs/rivals.md](docs/rivals.md) |
| Traits, diplomacy, land and culture, pacts | [docs/diplomacy.md](docs/diplomacy.md) |
| Moods, difficulty | [docs/cities-and-difficulty.md](docs/cities-and-difficulty.md) |
| The AI | [docs/ai.md](docs/ai.md) |
| City screen, build menu, completion windows | [docs/city-screen.md](docs/city-screen.md) |
| Windows, buttons, title, setup | [docs/windows.md](docs/windows.md) |
| Main map, clicks, zoom, fog, borders, other civs' turns | [docs/map-screen.md](docs/map-screen.md) |
| Research, New Technology, end screen | [docs/research-and-end.md](docs/research-and-end.md) |
| Adding or laying the user's pictures | [docs/pictures.md](docs/pictures.md) |
| Unit animation sheets | [docs/unit-animation.md](docs/unit-animation.md) |
| City view, wonder stages, houses | [docs/town.md](docs/town.md) |
| Palette, font, sprites, modern renderer | [docs/renderers.md](docs/renderers.md) |
| Web app, phone app, headless, maps tool | [docs/apps-and-tools.md](docs/apps-and-tools.md) |
| What is done, by date | [docs/status.md](docs/status.md) |
| Departures from the original, open work | [docs/known-gaps.md](docs/known-gaps.md) |
