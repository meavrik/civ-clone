# Pictures

How the user's sheets are cut and laid: tile improvements, units, cities, resources, improvements, villages. Moved word for word from CLAUDE.md, so "above" and "below" may point to another file here: search `docs/` for the name.

  Tile improvement pictures (2026-11-02, asked for with the user's sheet: "implement updated tile improvements"):
  `tools/sprites/works/works.png` (kept as supplied, a 4x4 grid: roads, fields of four kinds, mine, quarry, logging camp,
  oil pump, offshore rig, fishing net, pier, bridge; a red fringe of its background's removal at alpha 1 to 3, unseen) is
  cut by `tools/sprites/works/cut.ts` (pieces of alpha over 64 to the cell their middle lies in, every pixel the
  sheet's) into `apps/web/src/works/<id>.png` and renderer-api `work-art.ts` (`WORK_ART`); renderer-api
  `work-pictures.ts` says which stands where, only the picture (the rules know one irrigation and one mine):
  irrigation is fields of a kind for the land (`fieldsPicture`: crops on grassland and hills, wheat on the plains,
  ploughed earth in the desert and tundra, one of a few by a hash; on a river, fields with canals), a mine a timbered
  shaft, on mountains a quarry (`minePicture`), oil on land with a road to it an oil pump in place of its icon
  (`drawSpecial`'s `pics`), `Tile.rig` the offshore rig, `Tile.fishery` the net, and a city with a Harbour its pier on
  the first sea square beside it, sides before corners (`pierSquare`). One scale, the sheet's 350-pixel cell to a square
  (`WORK_SQUARE`), centred (`workArtPlace`, `ArtSpot.work`). Each screen (the map, the square's window, the city
  screen's map) lays them in drawing order (`layWork`, art-holes `layPicture`/`SquarePictures`): each picture
  remembers its square as drawn when laid (`fineCopy`), and once the screen is drawn whatever came over it since shows
  through (`sealPictures`): a resource's badge, borders, the fog's edge, names, yields. Fields are laid over the roads
  and railroads (asked for 2026-11-02: "place irrigation above the road"; a road shows between the plots), and where a
  work's picture (fields, mine, net, village) or a city stands, the square's resource is told by its mark in the top
  right corner, the work or city whole beside it (asked for the same day: "resources like elephents and horses cover
  completly the improvements", then, of the icon at half its size tried first, "i dont like the smaller resource
  solution ... maybe show a small symbolic icon on the tile edge"; the user picked a tiny silhouette on a round dark
  token, top right): retro `marks.ts` (`drawResourceMark`, `MARKS`, `MARK_SIZE` 13 fine pixels), a pictogram
  of our own for each resource, 9x9 fine pixels in cream (`rock` 7) on a slate token ringed near black, each the
  plainest thing that tells it (a horse's head, a bull's for the bison, antlers, a coin, a drop of oil, a whale's
  flukes, a fleece on legs for the sheep, two humps for the camel; the icons' own shapes at that size were blobs); `drawSpecial`'s `corner`, and `drawSpecialMark` for a city's square, drawn once
  the city stands (over its picture, shaded with it out of sight; on the city screen over its yields). A unit at work
  wears the mark of its job on the same token in the same corner (asked for the same day: "also change settler icons
  when working on something. maybe also same style silluette"; `drawJobMark`, `JOB_MARKS`: a receding road, rails on
  sleepers, a drop over furrows, a pickaxe, battlements over a gate, a broom, and for a unit camped to heal a heart;
  its picture cut round the disc, `markHoles`), where a black square held the panel's icon of the job before; the same
  tokens are the icons of what is built on a square (`road`, `railroad`, `irrigate`, `mine`, `fortress`, `clean`, and `fishery`,
  `rig`, `harbour`, an anchor, which borrowed wheat, a shield and a house before; `icons.art.ts`, line for line as `marks.ts` draws
  them, `square-card.test.ts` holds them to it; asked for 2026-11-05 of the square's window: "improvements icons - change to the
  tiles silluete icon - better"), so the panels, orders and tooltips show them too; the shade out of sight shades the picture whole, as a city's; fields let the square's
  own water show (`waterHoles`: a river through them, a shore). The villages are laid so too. The logging camp is not
  cut (no work for forests in the rules). The code-drawn fields (`drawIrrigation`, `fieldLayout`: plots in rows either
  side of a canal, running on into irrigated neighbours), mine, fishery (`fishery.ts`) and rig (`rig.ts`) stay for
  anything without a picture.
  Unit pictures (2026-10-28, asked for, twice in capitals: "implement new units sprite-sheet. USE AS IS - DO NOT
  regenerate"; a first try converted three of them into the palette with an outline and was rejected): the user's
  sheet of all 29 units (`tools/sprites/units/units.png`, 1774x887, magenta where the owner's colour goes) is cut by
  `tools/sprites/units/cut.ts` into `apps/web/src/units/<id>.png`, each unit by its own outline (the sheet is no even
  grid), every pixel the sheet's, and the cuts' sizes into renderer-api `unit-art.ts`. They are shown as they are,
  laid over the canvas like the buildings' pictures, the magenta left magenta (the shield tells whose a unit is):
  `drawUnitFigure` (retro `overlays.ts`) leaves a unit spot (`ArtSpot.unit`) where a sprite stood, on the map, the
  unit box, the city screen, the stack list, the square's window, the research card, New Technology and the military
  advisor; `unitArtPlace` stands it in its square at one scale (`UNIT_SQUARE`, 240 of the sheet's pixels a square;
  one that would not fit shrinks), centred on the square's foot, fighters and bombers in the middle. The marks drawn
  on the canvas show through it (`ArtSpot.holes`: the shield or two, hit points, rank, fortified frame, sentry line,
  job badge; the web app clips the picture round them, `clipPath`), the map's view clips it (`clip`), a window over
  it cuts a hole (`hideArtUnder`), a blow landing rings it in light (`lit`), and a ship going down tips and sinks
  under its waterline (`turn`, `water`; `sinkPicture`). `preloadUnits` fetches all 29 as a game starts. The sprites
  (`units.art.ts`) stay for anything without a picture. A unit added since comes as a picture of its own
  (`tools/sprites/units/<id>.png`, kept as supplied; `SINGLES` in cut.ts), cut to its bounds a few pixels out, every
  pixel as it is, and stood at a scale of its own (`UNIT_ART`'s third number, its pixels to a square): the archer
  (2026-11-01, asked for: "implement archer image"; 1254 square, drawing his bow, the owner's parts magenta as the
  sheet's) at 1400, his helmet to his feet (973) as much of the square as the sheet's militia (166 of 240); the war
  elephant (the same day, "same for war-elephant"; 1334x1179, its rider small on its back under a magenta caparison)
  at 1250, as wide as a square allows, as the sheet's chariot stands, so it looms over the horses; the explorer (the
  same day, "same for the explorer"; 1254 square, hat, bedroll and staff) at 1600, hat to boots (1113) as tall as the
  militia, as the archer; the fishing boat (the same day, "same for fishing boat"; 1254 square, a fisherman hauling his
  net under a magenta sail) at 1600, as big as the sheet's Sail, its smallest ship (170 of 240). The sheet's
  cut matches its 29 to the units of the first rules (`SHEET_UNITS`: those without `since`), the later ones lying among
  them in `UNIT_TYPES`.
  City pictures (2026-10-29, asked for with the user's sheet: "implement attached assets for civ cities - USE AS IS!!! DO
  NOT regenerate"): `tools/sprites/cities/cities.png` (kept byte for byte as supplied: three ages in rows, ancient,
  medieval, industrial, by village, town, city, capital, each flying a blue flag, on a clear background) is cut by
  `tools/sprites/cities/cut.ts` into `apps/web/src/cities/<era>-<tier>.png`, each city by its own outline (the ancient
  capital reaches out of its 362-pixel cell), every pixel the sheet's, and the cuts' sizes into renderer-api `city-art.ts`
  (`CITY_ART`). `cityLook` picks one as before; `drawCity` (retro `map-city.ts`), given `picture` (the room it shows in),
  leaves a spot (`ArtSpot.city`) in place of the drawn icon on the map, the city screen's map and the square's window
  (also the conquest window's), and returns it; `cityArtPlace` stands it at one scale for all, the sheet's cell to a square
  (`CITY_SQUARE` 362), so villages stand smaller than capitals, centred on the square's foot, as units stand. The walls'
  back half is drawn under it, their front half and the garrison's shield through it (`spriteHoles`, `shieldHoles`); what
  the screen draws over the square later (a unit in play there and its marks, a fight's burst, a route's dot, the goto
  frame, the city screen's yields) shows through as it would over a drawn icon: retro `art-holes.ts` copies the square's
  fine pixels as the picture is laid (`fineCopy`) and holes it where they changed (`drawnOver`; a pixel only darkened by
  fireworks' dusk is not a change, and the pictures darken with the dusk). Out of sight a city's picture is shaded whole
  (`ArtSpot.unseen`, CSS brightness 62%, as `UNSEEN`); windows cut holes in it as in units (`hideArtUnder`), and
  `dimScreen`'s `keep` leaves a picture inside it lit (the Building Completed and conquest windows' city). The web
  adapters fetch all twelve as a game starts (`preloadCities`). The flags stay the sheet's blue (no owner colour), the
  shield, the label's plate and the borders telling whose a city is. The drawn icons (`cities.art.ts`) stay for anything
  without a picture (tests, the sprite sheets).
  Resource pictures (2026-11-03, asked for with the user's updated sheet: "updates resources sprite-sheet - USE AS IS!! do
  not regenerate assets"; their earlier sheets, and that morning's, had been drawn into the palette, see renderer-retro
  below): `tools/sprites/resources/resources.png` (kept byte for byte as supplied: 26 icons in rows of eight, cells 256
  wide and 192 tall, on a clear background whose soft colours have no alpha; the cell where Ivory stood empty: Ivory is gone, see Specials above) is cut by
  `tools/sprites/resources/cut.ts` (pieces of alpha over 64 to the cell their middle lies in, cut by their bounds two
  pixels out, every pixel the sheet's) into
  `apps/web/src/resources/<id>.png` (the icon's name: horses, offshore_oil) and the cuts' sizes into renderer-api
  `resource-art.ts` (`RESOURCE_ART`). Retro `drawSpecial`, given the screen's pictures (`SquarePictures`: the map, the
  city screen's map, the square's window), leaves a spot (`ArtSpot.resource`) in the room the icon took (`SPECIAL_SHARE`
  of the square, at least the original's 16 pixels) and remembers the square as drawn (`fineCopy` of the whole square),
  so what is drawn over it later shows through (`sealPictures`): borders, the fog's edge, the site pins, names, units'
  marks; `resourceArtPlace` stands the picture centred in that room at one scale, the sheet's cell across to the room's
  width (`RESOURCE_CELL` 256), so the icons keep the sizes the sheet gives them. Out of sight the picture is shaded whole
  (by the square it was laid on). The New Technology window's box and Advisors > Resources lay theirs too
  (`drawResourceIcon`). The corner marks (`drawResourceMark`) stay our pictograms. `preloadCities` fetches the 26. Reindeer
  are on no sheet yet and borrow the Game's deer (`BORROWED_ICONS` in retro `tiles.ts`). The
  palette sprites (`resources.art.ts`) stay for anything without a picture (tests, `npm run sprites`).
  Improvement pictures (2026-11-04, asked for with the user's sheet: "replace all building images with attached
  sprite-sheet"): `tools/sprites/buildings/buildings.png` (kept byte for byte as supplied, 1659x948: the 27 improvements,
  the Harbour's first picture among them, in the rules' order in rows of seven, no even grid, a clear background; nearly
  every pixel soft, 346 of them whole, a red and olive fringe of its background's removal at alpha 1 to 8, unseen) is cut by
  `tools/sprites/buildings/cut.ts` (each a piece of alpha over 64, by its bounds two pixels out, every pixel the sheet's)
  into `apps/web/src/buildings/<id>.png` and renderer-api `building-art.ts` (`BUILDING_CUTS`, the cuts' sizes), in place of
  their WebPs; a cut is its own drawing's box (`buildingArt`, x and y 0), and `artPlace` lays it at its own size where a
  wonder's lays the 1254 square. PNGs, as every other sheet's, so a test can hold each to the sheet (no WebP reader here)
  and the phone precaches them (the improvements' and wonders' 13.7 MB of its 36.8 MB, 6.5 of them the stages; the WebPs
  still come as first shown). The wonders came on sheets of their own (see Wonder stages); the three spaceship parts are
  on none, their WebPs staying, smoother than the sheets' pictures.
  Village pictures (2026-11-02, asked for with the user's sheet of five huts: "replace huts in game with attached veriety
  of huts"): `tools/sprites/huts/huts.png` (kept as supplied: a straw-thatched round hut, a timber hall, a mud-brick
  house, a hide tent, a stone cottage with a chimney, on a clear background) is cut by `tools/sprites/huts/cut.ts` into
  `apps/web/src/huts/<kind>.png` (thatch, timber, adobe, tent, cottage), every pixel the sheet's, and the cuts' sizes
  into renderer-api `hut-art.ts` (`HUT_ART`). A village's kind suits its land (renderer-api `huts.ts`, `hutKind`: adobe
  or a tent in the desert, tents on the plains, tundra and arctic, timber in forest, swamp and jungle, stone in the
  hills and mountains, thatch on grassland and in the jungle), one of a few for each land by a hash of its square; only
  the picture. `drawHut` (tiles.ts), given the kind and the room, leaves a spot (`ArtSpot.hut`) in place of the drawn
  huts on the map and in the square's window; `hutArtPlace` stands it at one scale (`HUT_SQUARE` 500: a hut 0.7 of its
  square across, a little wider than a city's village; 0.6 was easy to miss), centred on the square's foot. On the map
  the square is copied as drawn under it (`fineCopy`), so everything drawn over it later (borders, the fog's edge,
  names, a route's dot) shows through it (`drawnOver`'s `shaded`: the shade out of sight is not a mark, the picture
  being shaded whole, `ArtSpot.unseen`); windows cut holes in it (`hideArtUnder`). `preloadCities` fetches the five
  with the cities. The drawn huts (`features.art.ts`) stay for anything without a picture.
  Entering one (asked for 2026-11-02: "when enter a village hut - first the unit need to visibly enter the hut and only
  then show the hut result"): the rules open a village as the step is taken, so the web app holds it on the map
  (`MainScreenView.villages`, an `EnteredVillage` from core's `hut` event, which carries the square and the `units` it
  brought; `holdVillages` after our own moves and as our turn begins), and what it brought (mercenaries, an ambush) out
  of sight, while the unit walks in; once the slides have landed the unit sacks it (asked for the same day: "when unit
  enter a village hut - add a sack village animation"; the web app's `sack` screen, `openVillage`, about 2.1 s, a key or
  click after 0.4 s cutting it short; renderer-api `sack.ts`, the timeline: `Sacking`, `SACK`, `sackBlows`, `sackFall`,
  `sackLength`, `sackLoot`, `sackedHut`, `sackAside`; `MainScreenView.sacking`): the unit steps aside from the hut, on the
  side it came from, and strikes at it, a unit with an attack of its own playing it at its own pace (`UnitAnimator`'s
  `sacks`, `SackStrike`), its blows landing with the strikes (else on a beat); each blow jolts the hut a pixel and knocks
  chips of its stuff off it (straw, timber, mud brick, hide, stone by its kind); with the last, what it held bursts out:
  gold coins (4 to 10 by the gold, most flying away from the unit, spinning, then lying glinting about its foot) or a
  scroll rising over it among sparkles (mercenaries, an ambush or nothing bring nothing out); then the hut goes down
  under its foot into a cloud of dust, smoke and embers rise, the unit cheers (its `won`) and steps back. Retro
  `sack.ts`: `sackHut` moves the hut's picture and clips it at its foot, `drawSack` draws the rest on the fine grid
  after the units (loot over the dust and smoke), the hut holed where they cross it. Sounds: a hit each blow, the
  `gift` jingle for coins, a `crash` as it falls. Core's `hut` event names the unit (`unit`). Then the village goes
  and its window opens (`hutModal`). A tribe's city (see Tribal villages above) stays off the map through the walk, the sack
  and the window (`tribeCities`, read by `mapState`), then goes up as a city our settlers found (`raiseTribeCity`: the
  founding show, then the city with "Rome: build what first?").
