# World

The world: engine overview, map sizes, premade and generated worlds, starts, what a civ can see, named places. Moved word for word from CLAUDE.md, so "above" and "below" may point to another file here: search `docs/` for the name.

- `packages/core` — deterministic game engine, zero DOM. Rules as data in `src/rules/*`
  (terrain, units, buildings, wonders, advances, governments, civs). Map gen (`map/generate.ts`), premade
  worlds (`map/premade.ts` + generated `map/worlds/*.ts`: per world size, rows of terrain chars, upper case = river,
  and each native civ's homeland square), cities,
  combat, pathfinding, diplomacy, barbarians, save/score. Entry: `src/index.ts`.
  World sizes (`WORLD_SIZES` in `types.ts`, `NewGameOptions.size`; our departure, asked for): small is the
  original's 80x50 (and every game without a size), medium 120x75, large 160x100, all 8:5 so the retro
  minimap stays 80x50 pixels (`minimapScale`: a pixel per block of squares, land shown over sea). Never
  read `MAP_WIDTH`/`MAP_HEIGHT` for a game's map: use `map.width`/`map.height`. Bigger generated worlds
  are the same world drawn finer (walks, noise, rivers and start spacing scale with width / 80, small
  unchanged); premade ones are rasterised at each size by `tools/maps` (`scaleFrame` stretches a frame's
  breakpoints, given in the original's squares).
  Premade landmasses stay apart (asked for: Britain had touched France): each Natural Earth land polygon
  is a landmass (`landmasses`, pieces cut at 180 degrees joined), each square goes to the one covering
  most of it, and where two touch, side or corner, `separateLandmasses` sinks one (never an ice row or
  a homeland's square, never one that would cut its landmass in two; an island of half a square or more
  keeps its last square if that costs its neighbours less land; else the smaller landmass yields). The
  polar ice rows are a landmass of their own (Antarctica's in the south). `npm run maps` throws if any
  land joins two landmasses (`mixedLandmasses`). Saves before version 13 on premade worlds load with
  `joinedIslands`: the old grids, kept as per-size diffs (`PremadeGrid.joinedIslands`) that the tool
  derives from the frozen `tools/maps/legacy/joined-islands.json` (never rebuild that file). Setup asks the size after a premade world and first in
  "Customize world"; "Start a new game" plays the original's size; `?size=large` in the web app.
  Generated worlds: land from random-walk chunks, terrain from the climate (`climateWorld`): smooth
  heat and rain fields that wrap east-west, rain in latitude belts and on prevailing winds that dry out
  over land and mountains (rain shadows), ranked so biome shares stay steady; mountains on noise ridges
  with hills as foothills; lone squares join their neighbours; rivers rise in wet highlands and run
  to the sea. `scatteredTerrain` keeps the first per-square generator for saves before version 6.
  Starts (`newGame`): drawn at random on grassland or plains of a big landmass, spread apart, then each
  moved onto the best city site (`siteScore`, `sites.ts`, the planner's score moved to core) within
  `START_NUDGE` (2) squares on the same land (asked for 2026-10-23; no randomness, so a seed keeps its
  world and its draws; historical homelands stay). Starts score 126 on average over 50 seeds (109 as drawn),
  none unfit for a city (3 of 350). Saves before version 25 load with `randomStarts` (the squares drawn).
  Sight (`visibility.ts`; asked for 2026-10-24: "an area of observability: one tile beyond the empire's
  influence and borders + surrounding each unit outside the borders; some units can have a bigger
  observability; in this area the player should see every other civ's activity and units"): `Player.visible`
  is a civilization's land (`claims`) and one square beyond it all round (`landSight`, cached until a city
  is founded, lost or changes culture), and the squares round each unit as far as its sight (`unitSight`:
  one; two for warships and aircraft, as in the original, and for horsemen (`cavalry`) and diplomats, our
  departure, `sightSince` 30). What it sees it has explored, so a growing border uncovers land. Foreign
  units show only there (map, minimap, the square's window, the other civs' playback); a city taken or
  bought away leaves its old owner's sight at once. Saves before version 30 load with `narrowSight`
  (headless `--narrow-sight`): round units, scouts one square out, and the squares next to cities.
  Head to head (planner vs v2, 16 x 300, version 29 upkeep): narrow sight 0-16, score 133 vs 237; this
  sight 1-15, 127 vs 229, both replaying exactly, ~5% slower.
  Places (`map/geography.ts`, `rules/places.ts`; asked for 2026-10-25: "names for great masses of land or
  water, like the great desert of..., lake x, the sea of..., x mountains; the name could be driven from the
  civ or leader who discovers them first; on the premade maps give the real names"): `WorldMap.geography`
  puts each square in up to two places (`Region`: kind, size, name, `by`, `turn`): a water body or landform
  (`place`: ocean, sea, bay, lake; desert, mountains, hills, forest, jungle, swamp, tundra, ice) and, on
  land, a continent or island (`land`). A generated world finds them from its terrain as dealt
  (`findGeography`, in `generateMap`): water bodies up to `PLACES.lakeMax` are lakes, to `inlandSeaMax`
  seas, the open water cut into basins round centres picked from the water furthest from land,
  `basinSpacing` apart through the water (small ones merged; ocean, sea or gulf by how much is open
  water and size), landforms are pieces of one terrain (mountains with hills a range) of at least a size,
  the polar rows an ice field, land pieces continents from `continentMin`. The first civilization to
  explore a square of a place (`discoverSquare`, from `revealAround` and the land sight; `discoverExplored`
  after the map is revealed at once) discovers it, and a place without a name takes one of the discoverer's own
  (`placeNames`): since 2026-10-26 (asked for: "more creative - a list of real earth and fantasy known worlds
  names - each civ would own its own land masses names") each civ's lists in `rules/civ-places.ts`
  (`CIV_PLACES`, `CivRule.places`): lands (its homeland first, then the lands of its legends and its world:
  Hellas, Hyperborea, Atlantis; Midgard, Vinland, Asgard), waters (the Sea of Ran, the Gulf of Ginnungagap,
  Lake Moeris) and wilds by the landform they suit (the Pomptine Marshes, the Great Gobi Desert), written by
  each kind's `PLACE_RULES.own`; old myths and real places only, no modern books' worlds (theirs to name).
  Each own name goes to one place before any goes to a second (a landform borrowing its civ's other kinds'
  names first), then again written for the new kind, then after its leader, adjective or cities ("Lake
  Caesar", "the Great Desert of Hammurabi", "Shaka's Land"); never the barbarians. The starting lands are
  named as the game begins, the player's first, so a homeland two peoples share bears the first's name. A premade world carries its real places (`PremadeGrid.places`, a `PlaceTable`: names
  per layer and rows of one `PLACE_CHARS` character a square; `premadeGeography`), drawn by `tools/maps`
  (`places.ts`). A landform shows on a square only while its terrain still fits (`placeAt`, `landAt`).
  Nothing in the rules or the AI reads places: no RNG, no save version (old saves replay and name them).
  The map writes one name at a time (`placeLabel` in renderer-api; asked for 2026-10-25: every place on
  view was "too crowded", then the places near every unit still were: "show only 1 at a time - the closest
  to the unit"): the place nearest the unit in play (none while no unit of ours is in play), from the
  explored squares on view within `NAME_REACH` (2) of it, its own square's sea or landform before the land
  under it (the Alps before Europe), a tie to the bigger place; written where the place's own anchors stand,
  not beside the unit (asked for 2026-10-26: the continent's name "follow the unit - fix that - show static"):
  in each block of `ANCHOR_CELL` (8x6) squares it covers, its square furthest inside it, none on its edge where
  it has an inside, fixed by the world alone; the anchor nearest the unit first, an anchor off the view or
  unexplored giving way to the place's explored square on view nearest it, a square in from the view's sides
  (`PlaceLabel.at`, the first where the name fits); retro `drawPlaceNames`: waters pale blue, landforms
  parchment, lands in spaced gold capitals, ringed dark, over the fog and the shade, under cities and units,
  never across a city's name or out over the dark, kept inside the view. A land's name has what it is
  written small under it in parchment, "continent" or "island" (`landWord`: none when the name says it, "the
  Isle of Capua"; asked for 2026-10-27: "not clear that is a continent name - maybe add continent to it"). The
  minimap names the continents the viewer has found (asked for the same day; `continentLabels`: each continent
  with a square explored, over its explored square nearest the middle of what was explored of it, the most
  explored first; islands left out), retro `drawMinimapNames`: since 2026-10-28 (asked for: "make continents
  name smaller and less noticeable - to distinct from the civ names") in small capitals, letter-spaced, pale
  parchment (`rock` 5) over a dark shadow (`drawSmallCaps` in font.ts: our own letters, five dots tall, three
  wide, accents dropped; the map's gold ringed dark before), over the view's white frame and under the unit's
  blinking box, nudged four pixels off a name before it (else left out) and off the unit's box where it can. Game > Options > Place Names (asked for the
  same day: "add option to disable mass names visibility"; `MainScreenView.placeNames`, kept per browser)
  turns off the map's names and the notes of places found (the minimap's names have their own button since
  2026-10-28, see Borders below). The square's window says where it lies in its title
  (`squareTitle`; see Map clicks), and a unit of ours that finds places says so beside it (`discoveryNote`:
  "Discovered: Lake Caesar, the Roman Hills"; the web app's `announcePlaces`; found at the turn's start, in
  the status line).
