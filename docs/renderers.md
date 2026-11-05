# Renderers

Retro renderer, palette, font, sprite tools, modern renderer. Moved word for word from CLAUDE.md, so "above" and "below" may point to another file here: search `docs/` for the name.

- `packages/renderer-retro` — indexed 320x200 `Surface`, 256-colour `palette.ts`, bitmap
  `font.ts`, `widgets.ts` (panel/menu/box), one file per screen in `src/screens/*`.
  Fine art (merged from branch terrain-tiles-test, 2026-10-21, asked for): the screen keeps its 320x200
  layout but holds `DETAIL` (2) x 2 fine pixels per screen pixel (`Surface.k`, `fw`/`fh`, `fset`/`fget`/
  `frect`/`fblit`; `Surface.screen()`, `Surface.fine()`), so a 16-pixel square shows a 32x32 picture.
  Terrain (`terrain.art.ts`, from the user's second terrain sheet since 2026-11-02, asked for: "implement updated
  attached terrain tiles - add the forest verity for forests around the map - same for mountens"; the sheet kept as
  supplied in `tools/sprites/draw/terrain.png`, 5x4 tiles of about 32 art pixels on an uneven grid, converted by
  `draw/terrain.ts`: each tile's box between the gutters cut into 32x32 blocks, each the block's commonest colour
  among the five ramps nearest the tile's, hue weighed over lightness, a tile's mottled ground snapped to one colour
  and every tile on grass taking the grassland's ground; no mirroring; two blues: coastal `ocean`, open
  `deep_ocean`; the sheet's river tile is not drawn, the code-drawn rivers taking its blues, `WATER` in tiles.ts).
  Forests and mountains come in kinds, only in the picture (renderer-api `terrain-variant.ts`, `terrainVariant`,
  `forestKind`, `mountainKind`; retro `squareSprite`, `VARIANT_SPRITE`): forest (broadleaf), `forest_pine`,
  `forest_birch`, `forest_autumn`, `forest_mixed`; mountains (grey), `mountains_snow`, `mountains_red`,
  `mountains_ice`. A square's kind is read from the explored squares round it as a climate would have it (pines,
  then mixed woods and birches, by tundra, ice, hills and peaks, never by jungle, swamp or desert; a glacier beside
  arctic, snow beside tundra, red rock beside desert, snow on a range's inner peaks with four mountains round it) and
  where that says nothing from slow noise of its world position (`PATCH`, patches about eight squares across: autumn
  woods, snowy and red ranges); no RNG, no save version; only explored squares count, as the shores, so a square at
  the edge of the explored land may change kind as its neighbour comes to light. A glacier stands on the ice's
  ground (`groundAt`), so the arctic beside it blends with no grass; the drawn square's cache key carries each
  square's sprite and the patch's grounds (`patchGrounds`). On a generated world about a third of the forests are
  broadleaf, a fifth to a quarter pine, the rest birch, autumn and mixed; about half the mountains grey, the rest snow and red,
  a few glaciers. Before 2026-11-02 the terrain was the first reference sheet (2026-10-21), recovered pixel for
  pixel, one picture a terrain), units (`units.art.ts`, the user's 32x32 sheet of the
  original's 28, standing free with the owner's shield in the top-left corner, `drawShield`/`SHIELD_AT`,
  bearing its colour slot's device (`DEVICES` in `overlays.ts`, in the colour's darker partner: white a pale,
  green per pale, blue a cross, yellow plain, cyan a chevron, magenta a base, grey a roundel, orange a fess,
  the barbarians' red a saltire; asked for 2026-10-26: civs "same color ... maybe a color blind issue". No
  nine colours stay apart for the colour blind (green, yellow, orange and red look alike to the red-green
  blind whatever their shades: measured in CIEDE2000 under Machado's simulations, the best palette pick kept
  pairs near 10), so the colours alike get devices least alike, each still its own below a wounded unit's
  hp strip; cyan became the EGA's deep cyan and grey `stone` 3, light cyan and light grey having looked
  white beside the Romans; `tests/colors.test.ts` draws `civ-colors*.png` and `civ-shields*.png` as each
  colour blindness sees them; the lists' swatches (`drawSwatch`) are the shield too),
  a second shield behind for a stack, hp as a strip across its top, its rank's gold chevrons in the top
  right corner (the rank icon, `drawRankMark`); no owner box), cities
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
  (the viewer's own cities) as a pennant before the plate, another civ's city its owner's shield there
  (`drawCityLabel`, `drawMoodPennant` in
  `screens/main.ts`; asked for 2026-10-21/22 after overlays on the town hid it) and resources (`resources.art.ts`, since 2026-11-03 only the fallback for the user's pictures laid as they are,
  see Resource pictures above; named after the special: the user's sheet of 22 icons of
  2026-10-27, "replace ... resources on terrain tiles", redrawn 2026-11-01 with 24 ("implement attached updated resources
  sprite-sheet": Elephants and Oil at sea added, `offshore_oil`) and 2026-11-03 with 26 ("updated resources sprite-sheet":
  Sheep and Camels added, rows of eight in cells 256 wide and 192 tall, the cell where Ivory stood left empty, Ivory
  being gone; the bison stands for the Bison herds and
  for grassland's Resources of games before save version 26, `iconName`), converted by `tools/sprites/draw/resources.ts`
  from `resources.png`: each icon its solid pixels (alpha over 128; the glow behind them fainter, left out), each piece going
  to the cell its middle lies in so an icon reaching over its cell's edge comes whole (the stag's hooves; a flood of the
  glow's colours from the cell's edge did it before, and cut them off), a 256-pixel cell the map's square (three of the art's pixels to
  two of ours; two to one was muddy), each icon in the five ramps nearest its colours, the silhouette's edge
  the block's darkest colour so the outline stays one pixel in the icon's own dark shades) are all 32x32 sheets with `k = 2`; icons are 16x16
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
  city view's `copper` slots, copper now drawn from `steel`; `skin` is likewise named colours (the citizens'
  outline, the jester's plum, the scientist's coat; 4 and 7 the browns the city icons and the deepest skin
  share); new art must reuse these ramps or free one. `heath` 0, 1 and 6 and `mound` 5 (bags of the first terrain
  sheet's colours, not ramps from dark to light), which nothing drew once the second sheet came, hold the autumn
  forest's dark red, red-orange, deep orange and orange since 2026-11-02, and the sprite legend's `m` is the
  civilizations' orange (`C.ORANGE`), for its brightest leaves. Panel icons (`icons.art.ts`,
  drawn with `src/icons.ts`) and the small marks (`drawMark`: tick, new, moves) are hand-drawn
  16x16: food is an ear of wheat, `shield` (production) a steel-rimmed blue shield as the original showed
  it (a hammer until 2026-10-24, "not good"), `people` a head, `happy`/`unhappy` a smiling and a frowning
  face (these three from the user's citizens sheet); roads,
  rivers, irrigation, rails, forts and smog stay code-drawn in `tiles.ts`/`overlays.ts`.
  Citizens (city screen) are the user's sheet of people (2026-10-25, after four rounds of our own figures
  were "bad"), recovered on its own grid and fitted to the palette (the sheet had no even pixel grid: each
  figure resampled at one scale, colours clustered, then matched): a man and a woman (`<mood>-m`/`-f`)
  for each mood (happy, arms up, yellow; content in linen; unhappy, arms crossed, red) and trade
  (entertainer a jester in plum, taxman in orange with a hat and purse, scientist in a pale coat with a
  flask), 20x26 fine pixels (`CITIZEN_W` 10 x `CITIZEN_H` 13), standing `CITIZEN_PITCH` (8) apart at most
  so raised arms and props reach over a neighbour. The art text is the source now (no generator);
  `citizens.ts` swaps the sheet's skin (flesh 6/5/4) for each person's tone (six, `citizenLook`); hair,
  trousers and style play no part. The face before the row (the Happy panel's button) is the city's:
  smiling, frowning while the unhappy match or outnumber the happy.
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
  of many colours. `draw/*.ts` make sheets: `cities.ts`, `features.ts`, `citizens.ts` (the city screen's people from part grids),
  `resources.ts` (the user's resource icons from `resources.png`), `terrain.ts` (the user's terrain tiles from
  `terrain.png`; `npx vite-node --script tools/sprites/draw/terrain.ts [preview.png]`, the preview each tile beside
  its sprite).
- `packages/renderer-modern` — canvas-2D renderer on a 960x600 logical surface (same panel/
  viewport split, 48px tiles): `theme.ts` (all colours and fonts), `draw.ts` (panels, wrapped
  text, bars), `tiles.ts`/`markers.ts` (terrain, overlays, units, cities), `screens/*`. It draws
  through a `Context2D` subset so Node tests use a recording fake.
