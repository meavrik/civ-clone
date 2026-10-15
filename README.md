# civ-clone

A browser reimplementation of a 1991-style 4X strategy game: same rules,
same 320x200 / 256-colour presentation, 16x16 square tiles, 80x50 world —
with original artwork and text. Later phases add a stronger AI and a
modern-visuals renderer behind the same core.

## Layout

```
packages/core             deterministic game core: seeded RNG, types, map gen, calendar (no DOM)
packages/renderer-retro   indexed 320x200 framebuffer, palette, bitmap font, tiles, screen layouts
apps/web                  Vite app: canvas with integer scaling, keyboard input, frame loop
```

The core never touches the DOM and the renderer never touches the core's
RNG, so the renderer is testable in Node (see `packages/renderer-retro/tests`,
which dumps a frame to `tests/out/main-screen.png`).

## Run

```
pnpm install
pnpm dev          # http://localhost:5173  (?seed=1234 for a different world)
pnpm test
pnpm typecheck
```

Controls: numpad / arrows move the Settlers, `C` centres on the unit.

## Design rules

- Everything drawn goes through `Surface` (one byte per pixel) and the
  palette in `palette.ts`. There is no RGB anywhere in game code.
- Game logic is pure functions over `GameState`; randomness only via the
  state's `RngState`. A seed plus a command log must replay identically.
- Screen layouts live in `renderer-retro/src/screens/*`; one file per
  original screen.

## Phases

1. Scaffold + presentation pipeline  ← done
2. World: faithful map generator, terrain yields, movement costs, ZOC, fog
3. Cities: founding, growth, tiles worked, production, buildings, happiness
4. Tech tree, governments, wonders
5. Combat, barbarians, diplomacy
6. Full game loop + baseline AI
7. AI v2 with headless tournament harness
8. Modern-visuals renderer
