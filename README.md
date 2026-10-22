# civ-clone

A browser reimplementation of a 1991-style 4X strategy game: same rules,
same 320x200 / 256-colour presentation, 16x16 square tiles, 80x50 world —
with original artwork and text. Later phases add a stronger AI and a
modern-visuals renderer behind the same core.

## Layout

```
packages/core             deterministic game core: rules, map gen, units, cities, combat, research (no DOM)
packages/ai               AI opponents (planner v3 shipped as aiTurn; v2 and baseline v1 kept as yardsticks), same commands as a human
packages/renderer-api     the Renderer interface and shared screen logic both renderers implement
packages/renderer-retro   indexed 320x200 framebuffer, palette, bitmap font, tiles, screen layouts
packages/renderer-modern  canvas-2D renderer: 960x600, soft colour, real fonts, same layout and controls
apps/web                  Vite app: canvas with integer scaling, keyboard input, frame loop
apps/mobile               the same game as an installable app for phones and tablets (PWA): touch controls, offline
tools/headless            tournament harness: seeded all-AI games, per-civ stats, replay verification
tools/sprites             export the pixel-art sheets to PNG for a paint program, import them back
tools/maps                rebuild the premade worlds (Earth, Europe, Middle East) from Natural Earth data
```

The core never touches the DOM and the renderer never touches the core's
RNG, so the renderer is testable in Node (see `packages/renderer-retro/tests`,
which dumps a frame to `tests/out/main-screen.png`).

## Run

```
pnpm install
pnpm dev          # http://localhost:5173  (?seed=1234 for a different world, ?renderer=modern for the modern look)
pnpm test
pnpm typecheck
pnpm headless -- --games 4 --turns 200 --civs 4 --every 50   # AI-vs-AI tournament, see --help
```

Controls (map): numpad/arrows move · `Space` skip · `W` wait · `F` fortify · `S` sentry ·
`I`/`M`/`R` irrigate/mine/road (R again: railroad) · `F` fortress (settlers) · `P` clean pollution · `B` found city · `Shift+D` disband · `C` centre ·
`Enter` end turn · `T` rates · `G` revolution · `Esc` orders menu (or the Game menu) ·
`F1` cities · `F2` military · `F3` foreign (Enter to talk) · `F4` science · `F5` score · `F6` spaceship (Enter to launch) · `F10` Game menu.
Menu bar above the map, as in the original: **Game** (tax rate, find city, revolution, auto end turn,
borders, visuals, save/load, retire, new game) · **Orders** (the active unit's orders with their keys, or End Turn) ·
**Advisors** (city status, military, foreign, science) · **World** (wonders of the world, top 5 cities,
score, world map, spaceships). Click a title or press `Alt+G`/`Alt+O`/`Alt+A`/`Alt+W`; `Left`/`Right` move between menus.
With auto end turn on (the default) the turn ends by itself a moment after the last unit has its orders.
Borders (on by default; the original has none) outline each civilization's land: the squares its known cities can work, the nearer city taking a square both reach.
The side panel and the terrain window speak in icons: population, year, treasury and tax/luxury/science,
government and research; the unit's moves as pips; a square's food, shields, trade, movement, defence and
improvements; each order as its key and a picture of the job. A settler at work wears a badge of its job
on the map (with the turns left in the modern visuals).
Units slide from square to square (a goto walks its path); after the other civilizations' turns, the moves and
fights you could see on screen play back before the turn's news. `Enter` skips a playback.
When a unit has moved or fought and the next unit takes over, the view stays with the first one until its
animation ends and a moment more, then glides on; a key or a click on the map in that moment only ends the wait.
Units have hit points (10 for ancient units, 20 from gunpowder, 30-40 for armour and steel ships). A fight goes
in rounds: the attacker lunges, each blow flashes on the side it lands on and drains its bar, and the loser
bursts. Survivors keep their wounds (a bar on the unit) and heal by resting a turn: a tenth in the field, a
quarter in a fortress, a third in a city, all of it in a city with Barracks. `&combat=classic` on the URL
plays with the original one-roll fights; games saved before hit points load that way.
Mouse: left-click a square next to the active unit to step there; a square further off, a fight or a city to take shows
the route (turns, odds) first, and a second click on it goes · double-click a square to centre the map on it ·
right-click a square for its window (terrain, yields, specials, city, units, with "Go here"; its X closes it) ·
the camera glides to each newly active unit ·
click your own unit to activate it · click the active unit to cycle the stack ·
click your city to open it · click the minimap to scroll.
City screen: click a worked tile to make its citizen an entertainer · click an unworked tile to work it (a free citizen, or the worker on the weakest tile moves there) · click the city square to put every citizen on the best tiles (keeping just enough entertainers for order) · the Focus button (or `F`) picks what the city works its squares for: Growth (food first, the default), Production (shields first), Science or Trade (trade first, spare citizens become scientists or taxmen); every focus but Growth keeps the city fed · `C` change production · `B` buy · `N` rename (in-game prompt) · `Esc`.
Founding a city asks for its name (Enter accepts the suggested one).

URL options skip the setup screens: `?seed=1234&difficulty=2&opponents=6&civ=greeks` (6 rivals = 7 civilizations, the default);
add `&world=earth` (or `europe`, `middle-east`) for a premade world, with `&historical=0` to scatter the civilizations.

The title menu offers three kinds of world: **Start a new game** (a random world), **Play on a premade
world** (Earth, Europe or the Middle East; then choose whether the civilizations start in their historical
homelands, in which case only the tribes native to that map are offered) and **Customize world**
(land mass, temperature, climate and age, as in the original).
Entering a tribal village shows what it held in a window; meeting a civilization opens an audience with its leader.
Saves: slots 1–5 in the game menu, autosave to slot 0 every 5 turns. A save is the seed plus the
command log and is replayed on load, so it also serves as a replay for the AI harness.

## Phones and tablets

`apps/mobile` is the web game as an installable app (a PWA). It runs `apps/web/src/main.ts` as it
is: its build hands that file a display that fills the phone, a renderer that lets a finger drag
the map, and save slots that also save when the phone puts the game away. Nothing in `apps/web`
changes for it.

```
npm run dev:mobile       # http://localhost:5180, and on the local network for a phone (no offline mode in dev)
npm run build:mobile     # apps/mobile/dist: a static site, playable from any folder of any host
npm run preview:mobile   # serve that build (localhost counts as secure, so the service worker runs)
```

Netlify deploys it from `main` (https://civ-clone.netlify.app, settings in `apps/mobile/netlify.toml`).

Installing it (Add to Home Screen) and playing offline need the build served over HTTPS (or from
localhost). It plays with the phone held sideways (upright, it asks to be turned), the map as wide as the
phone: the panel at its left edge, the map filling the rest. There are no buttons beside the screen:
everything is a touch. Tap = click (move a unit, open a city, the menu bar's Game, Advisors and World) ·
tap our unit to open its orders just above it (the phone's menu bar has no Orders) · hold still =
right-click (the square's window) · drag the map to look around (it glides back when the game moves its
view, another unit takes over, or a key is pressed) · pinch the map with two fingers to zoom it 2x or 3x
(and back; the phone remembers the zoom) · swipe the research list · touch or slide a bar on
the rates screen to set it · tap the spaceship screen to launch once the ship is ready · hold on a city
screen to rename the city. Naming a city brings up the phone's keyboard in a field at the top. The
deployed build has no Debug menu (the dev server keeps it).

## Working from a Linux shell on this machine

`scripts/mirror-test.sh` rsyncs the source (minus `node_modules`) to
`~/work/mirror`, installs Linux deps there once, and runs vitest + tsc.
The repo's own `node_modules` stays macOS-native for `pnpm dev`.

## Pixel art

Units, terrain, cities, villages and special resources for the retro look are drawn as text grids
in `packages/renderer-retro/src/art/*.art.ts`: one character per pixel, each naming a palette
colour (the legend is at the top of each file). Edit them directly, or use a paint program:

```
npm run sprites -- export            # art-export/units.png, terrain.png, features.png
# edit in Aseprite / Piskel / GIMP at 1:1 (magenta stands for the civilization's colour)
npm run sprites -- import art-export/units.png
npm run sprites -- icons             # the mobile app's icons, from these sprites, into apps/mobile/public/icons
```

The import rejects any colour that the sprite's legend cannot name and lists the pixels.
`npm test` dumps `packages/renderer-retro/tests/out/sprites.png` to review the whole set.

## Premade worlds

`packages/core/src/map/worlds/*.ts` hold the three premade worlds as 50 rows of 80 characters
(one per square, upper case marks a river) plus each native civilization's homeland square. They are
generated, not drawn: `npm run maps` downloads Natural Earth's public-domain 1:50m coastlines, lakes,
rivers and named regions once into `tools/maps/.cache`, projects them onto the grid, picks terrain from
climate zones (`tools/maps/src/climate.ts`) and writes the modules plus preview PNGs to `tools/maps/out/`.
Change a frame, homeland or zone in `tools/maps/src` and rerun; hand edits to the modules are lost.

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
7b. Rules completeness: data verified against FreeCiv civ1, every wonder bound, caravans and trade
   routes, railroads, fortresses, pollution and global warming, spaceship, diplomats, nuclear
   strikes, in-game text prompt  ← done
8. Modern-visuals renderer behind the same screen API, switchable from the title/game menu  ← done
9. AI v3: settlers ferried to free land overseas (or beyond rivals by sea), advances traded between
   computer civilizations, war campaigns (sticky targets, staging city, siege camp with an escort,
   storming in order of the odds), wars of choice only against clearly weaker neighbours, peace by
   agreement (a winning AI refuses it, from the player too)  ← done
