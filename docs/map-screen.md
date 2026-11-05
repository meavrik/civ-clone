# Map screen

Map clicks, scrolling, panel, zoom, square size, other civs' turns, coast, fog, borders, world map, roads. Moved word for word from CLAUDE.md, so "above" and "below" may point to another file here: search `docs/` for the name.

  Map clicks (since 2026-10-27, asked for: "make same as civ1 movement: units move with right click. left
  click will center map or enter city view. when a stack of units is clicked open a units menu"; until then
  the left button did both, 2026-10-22): left-click opens our city, picks our unit (centred), and on a square
  holding several of ours lists them in a window (`openStack` in the web app; `MenuState.pictures` puts
  each unit's sprite before its row, the row grown to hold it, with its standing at the right: Fortified,
  Sentry, Going, Mining 3, Ready, No moves; asked for 2026-10-24), the one picked waking and coming
  into play (one with no moves left keeps its orders); anywhere else it centres the map on the square
  (`view.inspect` shows it in the panel), and a second left-click on that square opens the square's window
  (asked for the same day: with the right button moving units, "cant see tile terrain info"). Right-click with a unit in play moves it (`moveClick`):
  `planMove` (renderer-api `plan.ts`) decides: a step next door goes at once (a refused one says why),
  into our city or onto our units' square too; a fight ("Attack: 62%", `attackOdds`), an empty enemy city
  ("Take Rome"), a caravan's route ("Trade route +34") or a square further off (the `findPath` route, "This turn"/"3 turns" by `routeTurns`)
  becomes `view.plan`, drawn as dots on the way, corners round the end and the note, and goes only on a
  second right-click on the same square; any other click or key drops it. A right-click on the unit's own
  square opens its orders; where it has no way, a note says "No way there.".
  Shift with either button, a right-click with no unit in play, or a second left-click, opens the square's window (`terrainInfo`: titled with the terrain and where it lies,
  `squareTitle` in renderer-api's `places.ts`: "Grassland, Ausonia", "Hills, the Alps, Europe"; since 2026-10-26,
  asked for: "show land/water mass name in the title - remove duplicates": the terrain's word left out where
  the place's name says it, "The Apennine Mountains, Ausonia", and a water's name standing for its square,
  "The Sea of Neptune"; the resource and river, in the title from 2026-10-23, and the body's line naming the
  place are gone; since 2026-11-02 the resource it shows us (`specialFor`) is named in brackets after the first name,
  asked for: "if have a tile resource - show in "()" in the title": "Plains (Horses), Ausonia", "The Sea of Neptune
  (Fish)", `squareTitle`'s `resource`); headed by the square itself as the map draws it, twice the size in a sunken frame
  (`MenuState.square`, retro's `drawSquarePicture`/`squarePainter`, `Renderer.menu(menu, state)`; asked for
  2026-10-23: "more stylish, add the terrain image, more details"). Since 2026-11-02 a card (asked for: "too messy.
  arrange with clear sections. clean design", then of a table of labels and lines, "still not good. rethink this modal
  window layout"; renderer-api `square-info.ts`: `SquareInfo.card`, a `SquareCard`, `MenuState.card`; retro
  `square-card.ts`, `drawSquareCard`, laid by widgets.ts in place of a body): beside the picture the yields in large
  figures, a nought faded, the moves and defence ("{boot} 1 move  {tower} +50% defence"), whose it is (`owner`: "Rome,
  ours, size 4", "Our land, worked by Rome", "Land of Tyre") and a few words on the terrain (`TERRAIN_TEXT`, our own)
  in dim ink; under them one parchment panel, as the Building Completed window's, of facts (`SquareFact`: an icon or
  a unit's owner's shield, a name in black, a short note in a column of its own, grey, green for good news, red for a
  warning) in groups, each under a small brown heading in small capitals with a rule running on, each only when it has
  something to say: Here (the resource, what it adds or the units that need it, the road or rig it waits for; river,
  road, railroad, irrigation, mine, fortress, fishery, rig, village, pollution, each with what it adds; where only
  settlers or no wheels go and the wear on units; a city's influence yield; the settlers' site note), Units (ours with
  their jobs, orders, wounds and ranks, another civ's with whose, alike ones counted, `UNITS_LISTED`) and Improve
  (what settlers could still add or turn it into, at sea a Fishing Boat's fishery and the Harbour). The card keeps the
  font's size on the phone (its window laid at `TOUCH_MENU_SMALL`); modern writes it as lines (`squareLines`, also
  `SquareInfo.lines`). The only button
  Open city, on our city (Go
  here removed 2026-10-23, asked for); it stands by its square and points at it (asked for 2026-11-01: "the tile
  should be highlited and info window points with an arrow towards the tile"; `MenuState.point`, the square's rect
  from `Renderer.squareRect` each frame): above it, else below or beside it, a point of its stone reaching to a gold
  ring round the square, which stays lit while the map darkens, as the Building Completed window stands by its city
  (renderer-retro `pointing.ts`: `pointedPlace`, `drawSquareRing`, `drawWindowPoint`, shared by the three); with no
  room above or below, the card narrows to stand beside it (`pointedLayout`, `sideRoom`, at least
  `CARD_NARROW_W` 160 and its title's width), its notes wrapping; with no room so it opens clear of the square clicked (`MenuState.avoid`); either way a second click there closes it), closed by the X in its title
  strip (`MenuState.close`; retro draws it, modern ignores it; any click off a window's choices closes
  it). On the phone a tap moves the unit in play onto a square not ours, else is a left-click; a hold on
  our city or units moves it in, elsewhere shows the square's window (see apps/mobile).
  Edge scrolling (asked for 2026-10-23): a mouse resting in the band along an edge of the map
  (`Renderer.mapView`, the band 6% of its shorter side) pans the camera that way after 220 ms, gathering
  speed to 8 squares a second (`stepEdgePan` in the web app); not over the panel or the menu bar, not
  while the other civs' turns play back, and only for a mouse (the phone drags its map: no `mapView`).
  A unit's own move still brings the camera back when it steps out of view (`followActive`).
  City sites (asked for 2026-10-23): while our settlers are in play the map pins the best few squares near
  them to found a city on (`settlerSites` in renderer-api: within 6 squares on their own landmass, scored by
  core `siteScore` from what the player has seen, unseen squares counting a plain grassland's worth, clear of
  known cities by `CITY_SPACING`, apart from each other, nearer preferred; only squares in sight now, the
  area observed (`Player.visible`, asked for 2026-10-25: never land merely explored), so a lone first settler
  sees one pin at most, its own 3x3), marked quietly (the first pins
  were "bad": "more abstract, subtle"): a dotted edge round the square (`drawSiteMark`), gold for the best,
  pale for the rest. The mouse resting on one shows why beside it (`siteNote`: "Best place for a city: by a
  river, on the coast, 2 resources nearby.", `MainScreenView.hint`, set each frame by the web app's
  `siteHint`), and the square's window (right-click, or a hold on the phone) carries the same line.
  A refused move (`tryMove` in the web app) nudges the unit toward the square (`MotionPlayer.nudge`,
  a UI-only beat) and puts a note beside it (`view.callout`, words from `moveRefusal` in `refusal.ts`),
  gone after 4 s or at the next key or click. A refused settler job does the same without the nudge
  (core `whyNoWork` gives the code, "needs:<advance>" for a missing advance; `workRefusal` the words);
  R asks for a road where the square has none, rails only on a road. A river takes a road once its civ
  knows Bridge Building, as in the original (before, never; no save version: the planner builds no
  roads on rivers and an old log holds no refused order). As a turn passes the status panel's year counts on to
  the new one (asked for 2026-11-01: "when years pass - show numbers animation passing quickly to new updated year"):
  through the years between, fast then slowing, over `YEAR_COUNT_MS` (900), in blue while it counts (renderer-api
  `year.ts`, `countedYear`, never year 0; `MainScreenView.year`, the web app's `stepYear`; a game started or loaded
  shows its year at once). Both status panels show the research under way
  (`researchOutlook`: advance, beakers, turns to go), and nothing while none is picked. Panel tips
  (asked for 2026-10-26: "add tooltips for each relevant element - not clear now. money, taxes, science,
  governance type etc"): every part of the status panel but the minimap (`PanelPart`: population, year, treasury,
  government, research, the unit's name, moves, home, rank, terrain,
  yields and orders, End of Turn, the wars) is told of in words (`panelTip` in renderer-api `panel.ts`,
  numbers from the rules: the treasury's taxes, upkeep and rates, the
  government's rules read from its `GovernmentRule` and the save's older rules, the unit's stats and upkeep)
  in a stone box right of the panel pointing at the part (retro `drawPanelTip`, `MainScreenView.tip`),
  shown when the mouse rests on it 350 ms (the next part at once while one shows) or a click or tap on a
  part with no action (4 s); retro's `panelLayout` places the panel's rows for drawing and hit tests alike
  (`statusPartAt`, `Renderer.statusPartAt`). A click on the treasury opens the rates. Disbanding
  (Shift+D, Orders > Disband) asks "Are you sure?" first, No by default (`confirmDisband`).
  A unit of ours stepping aboard a ship wakes the ship (asked for 2026-10-31: "when unit go into the transport unit -
  activate it from sleep, ready to move"; the web app's `wakeShip` after `tryMove`): sentry or camp dropped by the
  `activate` order, logged as any, and with moves left the ship comes into play to sail; a ship on a goto keeps it.
  The rules are untouched (the unit aboard still sentries), so the AI and old logs are unchanged.
  A unit's orders (`unitOrders` in the web app; asked for 2026-10-27) end with Disband, in red (`MenuState.danger`:
  a red row, lit in the red buttons' red, or a red button on the phone), then Pillage last, red too; settlers have no Fortify,
  and Found city stands faded ("Found city: too close", `MenuState.disabled`) within `CITY_MIN_DISTANCE` of a
  city (B says which city, beside the settlers); a job that changes the land says so ("Plant forest", "Clear to
  plains": mining grassland, plains, swamp or jungle grows forest, as in the original; nothing mines forest,
  tundra or arctic, so no Mine there).
  A unit away from its home city can go back (asked for 2026-11-05: "add go back to home town option to unit actions"):
  "Go home to Rome (3 turns)" after Home city in its orders, or Shift+H (renderer-api `homeTrip`, the web app's `goHome`), a
  `goto` as any, walked on turn by turn, so no save version. With no route it stands faded, "Go home to Rome: no way there"
  (Shift+H says "No way there." beside the unit); a unit with no home city, or standing in it, has no such order.
  Width: the retro main screen draws as wide as its surface (`viewAcross`: the panel and bar as ever, the
  map's viewport taking the rest), menus, prompts and the status line centre on the surface they are
  drawn on, and the menu hit tests take the width (default 320); the web game draws 320 wide, the mobile
  app as wide as the phone.
  Zoom (`MainScreenView.zoom`, set by the mobile app's pinch, and since 2026-10-28 by the web game, asked
  for: "add also in the web browser game version a main map zoom option"): retro draws the
  map as usual, then `magnifyViewport` blows the viewport's top-left 1/zoom up to fill it (fine pixels,
  in place) before the panel and bar; `zoomedTiles` sizes the minimap's box, `unzoomPoint` maps a tap
  back. The modern renderer ignores it. The web game (only with a mouse: `renderer.mapView`; the phone
  zooms in its own renderer) keeps its zoom in `view.zoom` (`epochs.zoom` per browser) but draws it as the square's
  size, never magnified (see Map square size below; 1x, 2x or 3x until 2026-11-02): the wheel over
  the map (a notch a level, the square under the pointer staying put, `setZoom`), the + and - buttons in the map's
  corner, the keys + and - (about the middle, the unit in play kept on view) and World > Zoom In / Zoom Out (faded at
  the ends), with "Map zoom 120%" in the panel. `Renderer.viewTilesX`/`viewTilesY` stay the unzoomed count: the web app's camera
  (centring, following, edge scrolling at the same speed on screen, the other civs' playback) reads
  `viewTiles()`, the whole squares shown at the zoom, and the web adapter's `tileAt` and `squareRect` go
  through the zoom (a square off the zoomed view has no rect). A fight on the map zooms it closer
  (asked for 2026-10-29: "when there is a battle zoom in to the battle - when finish zoom out to the previous
  zoom"; the web app's `battleZoom`, `stepBattleZoom`): at once as the fight begins, centred on it (a later
  fight glided to), held through the playback's notes beside it so a run of attacks stays close, and
  `BATTLE_LINGER_MS` (700) after the last, then the player's zoom again about the view's middle; the turn's
  news and the turn's end wait for that. Never kept per browser (`setZoom`'s `keep`); a zoom of the player's own
  meanwhile stands; at the closest zoom it only centres. Not on the phone, whose renderer keeps its own pinch zoom.
  Map square size (asked for 2026-11-02: "enlarge the base tile size and all that related (units, cities etc) - see
  how it looks", tried on branch big-tiles at 24, then "try something in between - 20px", then merged): renderer-retro
  `MAP_TILE` (`setMapTile`; 16, the original's, by default) is the main map's square in screen pixels; the web adapter
  sets 20 unless the page asks `?tile=16` (or 24, 32). The map then shows fewer squares (12x10 at 20, the last
  row cut, 10x8 at 24; `viewAcross`, `viewDown`), works out terrain, shores, rivers, roads, fog, the shade
  out of sight and borders at that size (`terrainSquare`, `fogSquare`, `unseenSquare`, `wayPixels`'s `t`; widths in the
  original's fine pixels, so a river or road is as much of a square as before), draws works, resources, villages and
  forts at 16 and lays them on stretched (`onSquare`, `stretchSquare`, `Surface.blitScaled`: nearest, so the terrain art's
  pixels come 1 and 2 fine pixels wide at 20 (one in four doubled) and 24 (every other), even at 32), and lays the units' and cities' pictures over squares that size;
  but a resource is drawn at the square's size, `SPECIAL_SHARE` (0.8) of it across, centred, never below its icon's own
  32 fine pixels (`drawSpecial`'s `t`; asked for 2026-11-02: "on tile resources are bit too big now - reduce size":
  stretched, they had filled the 20-pixel squares), so at 20 an icon is its own pixels, unstretched, and at 16 as before;
  shields, hit points, ranks, names and labels keep their size. The city screen's map, the square's window and the
  phone app (its own renderer) keep 16. The web game's zoom is the square's size there (asked for the same day: "zoom
  now is too big - reduce and place +/- toggle button on main map for zoom"): `view.zoom` 0.8, 1 or 1.2 times
  the base (16, 20 or 24 pixels on 20; five levels to 1.6, 32 pixels, until 2026-11-03, asked for: "reduce to 3 levels
  only"), which the adapter draws as `MAP_TILE` (`sized`), never magnified, its `viewTilesX`/`viewTilesY` counted at
  the base; "Map zoom 120%"; a fight two levels closer, at most the closest (`BATTLE_ZOOM_STEPS`). Two
  buttons, + over -, stand in the map's bottom right corner (`MainScreenView.zoomButtons`, retro `zoomButtonAt`,
  `Renderer.zoomButtonAt`, the web app's `stepZoomButtons`; since the same day, asked for: "button too big - more
  subtle", one plate 9x18 of the map darkened, `DIMMED`, edged and parted by a fine black line, the signs thin, pale,
  `ZOOM_SIGN`; at first two 12-pixel stone buttons): the sign white under the mouse, dim at the zoom's end, the map's
  names kept off them, pictures cut round them, no edge scrolling while the mouse rests on them. The phone's pinch still magnifies whole times.
  Unit animation: core appends every step (`applyMove`) and fight (`resolveCombat`, round by round) to
  `lastActions` (a UI side channel like `lastTurnEvents`, emptied by `endTurn`, never read by replays or
  AI); `MotionPlayer` (`renderer-api/src/motion.ts`) times them into `view.moving` (slides) and
  `view.battle` (lunge, blows, hp draining, the loser's burst), and renderers draw from those.
  Barbarians and city-states are bands, not armies (asked for 2026-11-05: "make them move at batches"): their steps in one
  view go together under one glide of the camera (`watchTurn`'s `moveBand`, `MotionTiming.together`: each unit's first step
  in the first beat, its second in the second), and a band's fights after the first there go quicker (`WATCH_PACE.raid`,
  `RAID_ANNOUNCE_MS`, `RAID_OUTCOME_MS`; the outcome before them shortened too). A civilization's army at war with us still
  moves one unit at a time, as asked for below.
  The other civilizations' turns (asked for 2026-10-22: enemies "come as a surprise, too swift"):
  `watchTurn` (`renderer-api/src/watch.ts`) plans the playback from their actions and the squares we
  see (`seen`, the web app's `watchOthers`: squares we see now, so a unit shown stays in sight or is seen
  walking out of it, and since 2026-11-03 every square we saw as our turn ended, held in sight meanwhile (below;
  before, only the squares a unit of ours lost in a fight saw, for the steps that led to it); until 2026-10-24 any square seen before or after counted, and a unit shown on one we no longer
  saw vanished the moment its slide ended, "shown for a glimpse and disappear"): every move of a civ at
  war with us (or barbarians) on seen squares, one unit at a
  time at a slow pace, a `MotionPlayer.hold` first gliding the camera there when it is not well on screen;
  each fight with our units is announced beside the attacker ("Babylonian Legion attacks!"), played
  slower, and its outcome said beside our square ("Phalanx destroyed"); other civs' moves play only
  where the map already looks. A long turn is sped up to `WATCH_BUDGET_MS` (at most ~3x). Any key or
  click skips the rest. Then an "Under attack!" window lists the turn's fights with our units
  (`fightReport`), then the news; a war declared on us by a civ we already knew is told before the playback.
  Until the playback is over the map draws the cities as they stood when our turn ended (asked for 2026-10-29:
  a city taken, and its new borders, showed while the fight for it still played): renderer-api `staging.ts`,
  the web app's `staging` and `mapState` (a copy of the state with `stagedCities`), so borders, flags and sizes
  wait; a city taken, razed or founded by a step the playback shows changes as that step lands (`cityChanges`:
  the conqueror's, raider's or settlers' last step onto its square; `MotionPlayer.playing`). Sight lost in the
  fighting stays until it is all over (asked for 2026-11-03: "when city is conquered or unit is lost - visibilty
  around should stay until the battle is COMPLETLY over and all fight animations and all enemy and player units done
  fighting"; renderer-api `SightHold`, the web app's `sightHold`, `holdIfLost`, `releaseSight`): what we saw as our
  turn ended, and what we saw before a fight of ours that cost a unit's sight (`sightLost`), stays seen on the map
  (`mapState`'s sight: what we see now and what is held), whatever stands there drawn, until no slide or fight plays,
  the fight's zoom and the view's linger are over and the news after them is closed, the map shown; then the shade
  falls. A UI side channel: `Player.visible` is the rules' as ever. Before, a city of ours kept its land in sight only
  until it fell (`stagedSight`, gone) and a unit lost took its sight with it at once.
  Coasts: `coast.ts` gives both renderers one shoreline field (square depth 0 land / 1 water touching
  land / 2 open sea, interpolated between square centres plus noise that wraps with the map), so shores
  and the edge of deep water wander across square borders while every square's centre keeps its kind.
  Rivers (`river.ts`): curves from a meeting point near each square's centre to a crossing point
  picked per border (both squares agree, the curve leaves square to the border), meandering between,
  widening toward the sea; the sea square carries the mouth on through spilled shore. Strokes show on
  land only. In retro a river runs under the trees of its square (`treesOf`, `WOODS` in `tiles.ts`; asked for 2026-11-05,
  no save version): a forest's whole trees (the sprite's `objects`) and a jungle's trunks and lit fronds (`FROND_LIGHT`; the
  jungle is all texture, and with every leaf over the water the river broke into specks), the rest of the line drawn as
  ever, so a river stays readable through thick woods; a tree cut off by a neighbour's ground reaching in gives way to it. Retro blends coast and river per pixel (`terrainSquare` in `tiles.ts`, cached by
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
  Explored squares out of sight (core's `visible`, see Sight above) are shaded, so the area observed
  shows on the map (2026-10-24): retro `unseenSquare`/`shadeUnseen` map what is drawn through `UNSEEN`
  (palette.ts: each colour's twin at 62% light, as `DIMMED` is at 45%), over the borders and under the
  fog; a square in sight is never shaded (asked for 2026-10-24: "inside the borders 100% visible"; the
  shade drifted into them at first), the shade on a square out of sight giving way where a seen
  neighbour's clearing reaches with the fog's ragged dithered edge (`clearingPatch`; `sightPatch` is the
  patch the other way round); a city there is shaded with its square, its name not; the minimap shades a block with
  no square in sight; the square's window says "Out of sight". Modern (set aside) does not shade.
  Borders (`territory.ts`, toggled in Game > Options, which hides only the drawing): core's `claims`
  from the cities the viewer knows, the same land the rules read for trespass; `borderSides` gives the edges and
  where a line must reach past an inner corner. Drawn after all squares, under the fog. The minimap has
  its own switches (asked for 2026-10-28: "place on the minimap itself icon buttons to show or hide minimap
  names or borders"): two small stone buttons along its foot at the right (`minimapButtons`, 10 pixels a
  side, `minimapButtonAt`, `Renderer.minimapButtonAt`; a click flips one, `toggleMinimap` in the web app),
  the `label` icon (a card of writing) for its names, the civilizations' and the continents', and the
  `borders` icon (two lands and the border between them) for its borders; a button whose layer is hidden
  is darkened (`DIMMED`); their tips are panel tips (`PanelPart` `minimapNames`/`minimapBorders`,
  `panelTip`'s `shows`); `MainScreenView.minimapNames`/`minimapBorders`, `epochs.minimapNames`/`minimapBorders`
  per browser, shown when unset; names keep off the buttons. Game > Options rules only the map. The
  minimap's borders: every explored square a civ claims, land and sea, in its colour, solid and
  unshaded (asked for 2026-10-26: "show all the civ territory as filled color", then, of a tint inside a
  line of the colour, "still a counter and not a single color full filled area"; a unit on its own land
  in the darker shade); cities are a black dot there (a cross cut a young city's 3x3 land into a ring),
  and with its borders off a white dot in a cross of the owner's colour.
  The World Map (World > World Map; asked for 2026-10-26: "show borders as filled colors - if possible
  show civ names") is political whatever the toggle: retro `drawWorldMap` draws each square as many fine
  pixels as fit (8 small, 5 medium, 4 large), each civ's claimed land tinted toward its colour and its sea
  a little (`TERRITORY_TINT`, `mixColor` in palette.ts: the nearest palette entry to the mix, as `DIMMED` is
  built), a line of the colour inside the border, cities white in black, and each civ's name in its colour
  ringed in black over the middle of its biggest piece of explored land (`territoryLabels` in renderer-api),
  the biggest first, nudged up or down off other names and, nearby, off cities; only explored squares.
  The map and the minimap name the civilizations too, each with its borders shown (asked for 2026-10-28: "show
  name of the civ on the territory and on the minimap"; on the map Game > Options > Civ Names,
  `MainScreenView.civNames`, `epochs.civNames` per browser; on the minimap its names button): on the map once a civilization on view (retro `drawCivNames`), the World Map's
  spaced capitals in its colour ringed black, at spots fixed by its land as the places' names are
  (`civNameSpots` in renderer-api: in each `ANCHOR_CELL` block its explored land square deepest inside its border,
  never a city's, so a young city's 3x3 has none; the one nearest the view's middle first), else half a square or
  a square up or down, clear of the cities, their names and the place name (`nameRoom`, drawn after the place
  name, under cities and units); on the minimap over each civilization's biggest piece of land (`territoryLabels`,
  at least 3 squares), in its colour ringed black in the font, before the continents' small capitals, which
  take the room left (`minimapNames`).
  The unit awaiting orders blinks on the minimap in a yellow box (modern: a ring), so it can be found
  from anywhere. On the map it blinks as in the original, whole to gone, but smoothly (asked for 2026-11-01,
  after a fade to 55%, a grey silhouette, a gold contour and a beacon of light at its feet were each turned down:
  "revert unit turn indication to the original - opacity on off. just try make transition more smooth from 0% to 100%
  opacity + subtle glow silhouette around the unit"): whole 380 ms, fading out over 220 ms (eased), gone 180 ms, fading
  back in over 220 ms, all of it together: its picture by CSS opacity, its shield, marks and hit points on the canvas
  through the Bayer dither (retro `fade.ts`, `fadeOver`, from the square's pixels as they were, `fineCopy`). While it
  shows, a faint gold glow is traced round its figure (`ACTIVE_GLOW` 0.5, steady: a thin line and a light haze, the web
  app's `goldContour`, CSS drop-shadows on its picture, which follow its shape and fade with it; retro `drawContour`
  round a unit drawn as a sprite). Renderer-api `pulse.ts` (`ACTIVE_BLINK`, `activeOpacity`), `MainScreenView.opacity`
  and `glow`, `ArtSpot.opacity` and `contour`. It starts whole as a unit comes into play or acts, and stays whole while
  the view lingers on a unit that just acted. City names stand under their squares on the map (retro: the owner's colour ringed in
  black, drawn before the units so a name never hides one; asked for 2026-10-21).
  Roads and fields (`works.ts`): roads wander. Each square has a meeting point near its centre, and
  the course to each known road neighbour's bows and snakes, keyed by the pair and laid from the same
  end whichever square asks; every square draws whole courses clipped to itself, and the two squares
  beside a diagonal draw their part of it too (`roadWays`), so roads join without seams. Railroads
  lay rails and sleepers (spaced evenly along each course) on the same courses. Retro draws both at the
  fine grain in the terrain art's manner (asked for 2026-10-23, then "too wide, more subtle": `ROAD`,
  `RAIL` in `overlays.ts`; "drop the outline"): packed earth about three fine pixels across in muted shades (`earth`),
  lighter along its crown, flecked and its sides a shade darker and ragged as the road on the user's sheet of tile
  improvements (below) is, no dark edge (on 2026-11-02 it took that road's look whole, sandy, a fifth of a square wide
  with a dark brown edge, and was "too wide and taking all the focus - minimize and subtle them" the same day);
  a railroad lays dark sleepers across it with a bright steel rail either side shadowed outside. Over a river's water
  (Bridge Building) the road is a timber deck in the woods of the sheet's bridge, its planks across the way and a dark
  railing; elsewhere water under a course stays water. The sheet's four road pieces and its bridge are not drawn: they
  run four ways, the roads eight and wandering.
