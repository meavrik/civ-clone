# civ-clone

A browser reimplementation of a 1991-style 4X strategy game: same rules,
same 320x200 / 256-colour presentation, 16x16 square tiles, 80x50 world —
with original artwork and text. Later phases add a stronger AI and a
modern-visuals renderer behind the same core.

## Layout

```
packages/core             deterministic game core: rules, map gen, units, cities, combat, research (no DOM)
packages/ai               AI opponents (planner v2 shipped as aiTurn, baseline v1 as yardstick), same commands as a human
packages/renderer-retro   indexed 320x200 framebuffer, palette, bitmap font, tiles, screen layouts
apps/web                  Vite app: canvas with integer scaling, keyboard input, frame loop
tools/headless            tournament harness: seeded all-AI games, per-civ stats, replay verification
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
pnpm headless -- --games 4 --turns 200 --civs 4 --every 50   # AI-vs-AI tournament, see --help
```

Controls (map): numpad/arrows move · `Space` skip · `W` wait · `F` fortify · `S` sentry ·
`I`/`M`/`R` irrigate/mine/road (R again: railroad) · `F` fortress (settlers) · `P` clean pollution · `B` found city · `Shift+D` disband · `C` centre ·
`Enter` end turn · `T` rates · `G` revolution · `Esc` orders menu (or game menu) ·
`F1` cities · `F2` military · `F3` foreign (Enter to talk) · `F4` science · `F5` score · `F6` spaceship (Enter to launch) · `F10` game menu.
Mouse: click an adjacent tile to move/attack · click farther away to go there ·
click your own unit to activate it · click the active unit to cycle the stack ·
click a city to open it · right-click for the orders menu (caravans: help wonder / trade route; diplomats at a foreign city: steal / sabotage / incite) · click the minimap to scroll.
City screen: click tiles to work them · `C` change production · `B` buy · `N` rename · `Esc`.

URL options skip the setup screens: `?seed=1234&difficulty=2&opponents=2&civ=greeks`.
Saves: slots 1–5 in the game menu, autosave to slot 0 every 5 turns. A save is the seed plus the
command log and is replayed on load, so it also serves as a replay for the AI harness.

## Working from a Linux shell on this machine

`scripts/mirror-test.sh` rsyncs the source (minus `node_modules`) to
`~/work/mirror`, installs Linux deps there once, and runs vitest + tsc.
The repo's own `node_modules` stays macOS-native for `pnpm dev`.

## Design rules

- Everything drawn goes through `Surface` (one byte per pixel) and the
  palette in `palette.ts`. There is no RGB anywhere in game code.
- Game logic is pure functions over `GameState`; randomness only via the
  state's `RngState`. A seed plus a command log must replay identically.
- Screen layouts live in `renderer-retro/src/screens/*`; one file per
  original screen.

## Phases

1. Scaffold + presentation pipeline  ← done
2. World: map generator, terrain yields, movement costs, ZOC, fog  ← done
3. Cities: founding, growth, tiles worked, production, buildings, happiness  ← done
4. Tech tree, governments, wonders, rates  ← done (tree data to verify against FreeCiv civ1)
5. Combat, barbarians, transport, goto, multi-civ turn loop, baseline AI, mouse control  ← done
6. Title/setup, save/load (seed + command log, IndexedDB), huts, score, end conditions,
   diplomacy screen with tribute/tech exchange, advisors (F1–F5)  ← done
7. AI v2 (planner: continent-aware expansion, tech beelines, threat-aware garrisons, tile governor)
   with headless tournament harness  ← done
8. Modern-visuals renderer
