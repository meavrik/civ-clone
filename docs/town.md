# Town

Wonder stages, the isometric city view, its land, houses. Moved word for word from CLAUDE.md, so "above" and "below" may point to another file here: search `docs/` for the name.

  Wonder stages (2026-11-04, asked for with the user's sheet: "implement thoose 3 wonders images - each wonder contain 3
  stages of construction to show in the city view while constructed - start, in-construction and finished wonder", "all
  other woders would be provideded later on the same logic", then the same day "implement all attached rest of wonders"):
  `tools/sprites/buildings/wonders-1.png` to `wonders-7.png` (kept byte for byte as supplied, each 1254 square, cells of
  418, three wonders a row each, their stages left to right, feet within 2 pixels; `WONDER_SHEETS` in `sheets.ts` says
  which) are cut by the same `cut.ts` into `<id>-start.png`, `<id>-construction.png` and the finished `<id>.png`, all in
  `BUILDING_CUTS`. A stage is the pieces whose middle lies in its cell, as a picture may run past its cell (Women's
  Suffrage, 16 pixels past the sheet's first column, off the sheet if its neighbours' box were used), and is cut by its
  own bounds; the three of a wonder share a canvas as big as they need, each where the sheet puts it in its cell
  (`wonderCuts`), clear past its own box, so they lie in register and no stage holds a slice of the one beside it. The
  finished picture stands wherever the wonder's WebP did (the build menu, the Improvements list, the Building Completed
  window). A wonder has stages when the cuts do (renderer-api `wonder-stages.ts`, `wonderStages`), so a wonder added
  later comes as a line in `WONDER_SHEETS`; until then it rises whole (built.test fails while a cut and a square both stand). In the
  city view the wonder a city is building stands on the lot it will take finished, the next of its wonders
  (`wonderSite`, `SceneItem.site`): the start from its first shield, the construction from half its cost (`costFor`); not
  a wonder standing already (its own, kept as production while it waits for a choice, or another city's), nor one without
  stages; a click on it says "Pyramids: under construction". Completed, the show (`CityViewState.rising`) plays them in
  fast forward: each picture rises from the ground in the place of the one before over the 1.8 s (`wonderRise`,
  `drawBuilding`'s `cleared`: the stage going under clipped to what lies above the line the next has reached), where a
  wonder without stages rises whole. `artLot` stands them at one scale for all, the tallest (`WONDER_TALLEST`, the
  Lighthouse) `LOT_MAX_H` high, so they keep the sizes the sheets give them (Pyramids 42x34, Gardens 43x39, Colossus
  39x44, Lighthouse 41x46): a drawn picture's area, the rule for the rest, brought the Colossus down from 44 high to 33, a
  temple's size. `preloadBuildings` fetches the stages of what our cities are building. Only the picture: no save
  version. Modern leaves a site out.
  The town (2026-11-05, asked for with the user's sheet of houses: "redo the city view ... all together to be more
  isometric and as a real town look"; every picture of the user's is drawn from a corner, so they stand on one ground):
  renderer-api `town.ts`, retro `screens/town.ts`. The sky and the rows of the old view are gone. The scene (`SCENE_W` x
  `SCENE_H`, as before) is the map round the city in `u` (down and right, the map's east) and `v` (down and left, its
  south), counted in lots, a lot's diamond `LOT_W` 18 x `LOT_H` 9 retro pixels (`isoX`, `isoY`, `isoU`, `isoV`),
  `LOTS_A_SQUARE` 9 to a square of the map, so the view shows the city's square and all eight round it (`CityScene.land`,
  5 x 5, the corners reaching two out; `townTerrain`, the borders wandering by noise). Only what its owner has explored:
  an unknown square is drawn as the city's own ground. So the sea, hills and forest beyond the houses are the city's
  own, irrigated squares show their fields (`CityScene.fields`, `FieldPlot`, see The town's land below), mined ones
  their mine or quarry (the user's pictures), and rivers their real course (`riverCourses`, bent off the crossroads);
  a road on a square at the side runs on to it from the town (a walled town's leave only by the gate). Streets cross every
  `PITCH` (2.8) lots, each block between them four lots, one always left a garden (`Lot.garden`): a street runs along a side only where a lot is built on it, every
  street joined to the crossroads, so the net grows with the town; it wanders in a young town and runs straight in a
  modern one, dirt, then cobbles from Construction, asphalt from the Automobile, a bridge where it crosses a river, stopping at
  the sea. The palace stands behind the crossroads and the town square before it (from size 3, or with any building: a well,
  a fountain from Construction, or the Marketplace), and nothing is built on the sea or on mountains, so a coastal town
  follows its shore. Every improvement has its place in every town, built or not (`planned`: works that smoke or sprawl,
  `OUTSKIRTS`, on one side beyond the second ring; those over `WHOLE_BLOCK` (22) wide, wider than a lot, a block each, every other block of rings 1
  and 2, then the blocks between, then further out; the rest a lot each, in the rules' order, so the first stand nearest the crossroads), and homes stand there
  until it comes: so nothing moves when one is built or stops being supported, whatever order `City.buildings` and
  `City.idle` hold them in (placing by walking those lists rearranged the town each time one went idle). Wonders take a
  block each in the order they rise, the second ring's back first; the block nearest the sea is the harbour's, built or
  not, its picture pushed out onto the shore so its water meets the sea, and `SEAFRONT` wonders take the next nearest. Walls
  (`SceneItem.wall`, a stretch or a tower, each a box of drawn stone, battlements on its outer edge) run round the rings the town
  fills on the streets' lines, one ring out for a small town, two with wonders or more than 40 lots' worth; lots beyond are
  suburbs, none of the wall standing in the sea; the gatehouse stands at the corner nearest the viewer, whose picture
  faces us, or where the sea takes it at the nearest land along the walls. Trees, peaks and hills are items too, drawn back to
  front among the pictures, and none stands inside the walls or before anything built (a peak's body rises well above its foot): what is drawn in front of a picture shows through it (`fineCopy`, `sealPictures`, as on the map).
  The ground is worked out a fine pixel at a time in the world's coordinates, so rows and paving run along the town's axes
  (`drawTownGround`, with a shadow beside each lot). That takes about 0.1 s once warm, the land sounded on a coarse grid and
  only the cells along a border worked out (`COARSE`; every pixel took half as long again), so it is done once for a scene
  (`drawnTowns`, by the scene; `cityScene` keeps the last by a key of what it reads, `sceneKey`) and a frame after is about a
  millisecond; 60 frames a second in Chrome with 32 to 44 pictures. A click names a house as it names a building (`SceneItem.id` "bakery@12",
  `house` its kind; `about`), the bottom corners of a picture's box not counting (`sceneItemAt`). Windows now cut a hole in
  every picture they partly cover (`hideArtUnder`; they used to drop a building's whole picture, which the dense town would have
  shown). Modern paints blocks of the same ground, strokes the streets and leaves the fields out. Only the picture: no save version.
  The town's land and room (the same day, asked for: "houses are too cramed together", "fields and mountens dosnt look good -
  improve. try to make same style as the 90's buildings look"; a first ground of dithered blotches, smooth grey triangles and
  the user's field pictures stretched to a square, whose wheat stood taller than the houses, looked like nothing else in the
  game). Room: houses 15 across on lots 18 wide, stood `LOT_OUT` apart (at 18 across each hid half the one behind it), improvements
  at `BUILDING_SCALE` of their room, `HOMES_A_SIZE` 1.5 homes to a citizen, and `GARDENS` of the lots left open besides the one each
  block keeps. Land: the user's terrain sheet (retro `screens/town.ts`, `GROUND_SPRITE`; tiles.ts `terrainPieces` lifts a sprite's
  colour and each thing on it): each land its sprite's flat colour with the sprite's own tufts, stones and waves scattered on it
  (`MARKS`), the jungle its texture, the woods' trees the sheet's, by the square's `forestKind`, single ones outside the forests
  (a birch sprite's trees join into one clump). Fields are plots on the town's axes (`drawTownGround`'s `fieldInk`), three a
  side with a track between (`PLOT`, `FARM_TRACK`), a crop to each by what suits the land (`fieldKinds`), rows along either axis, a bank
  light on its far sides and dark on its near ones, some fallow; on a river a canal down the plot; running past the square's
  wandering edge onto any `FARMLAND`. Our drawing, in the sheet's manner: the user's field pictures stay on the map, too coarse to
  stand beside the houses here. Mountains (`drawPeak`, `SceneItem.rock`, the square's `mountainKind`, its four kinds as the sheet's) are
  drawn on the fine grid as the sheet draws them: a lit face and a shaded one, each near one colour, parted by a crooked spine catching
  the light, tapering gullies down the shaded face and cracks down the lit one, jagged snow, boulders at the foot, a dark
  edge in the rock's own hue; flaked clusters of light and dark looked like camouflage. Hills (`drawMound`) a long pale slope breaking
  into the grass, a short dark one, a dark crest. The sea is one blue, the sheet's coastal, with its waves: a deep band in the
  sheet's navy cut dark wedges in along the chamfered distance.
  Houses (2026-11-05, asked for with the user's sheet: "for the city view add random houses to be scattered around by the
  civ time-frame, size and advances"): `tools/sprites/houses/houses.png` (kept byte for byte as supplied, 1536x1024, 24 houses
  in rows of six on a 256-pixel grid, a row an age, feet level, a clear background, every house one piece; nearly every
  pixel soft, a brown haze of the background's removal at alpha 1 to 8, unseen) is cut by `tools/sprites/houses/cut.ts` (each
  by its bounds two pixels out, every pixel the sheet's) into `apps/web/src/houses/<id>.png` (2.3 MB, precached by the phone)
  and renderer-api `house-art.ts` (`HOUSE_ART`). `HOUSES` (renderer-api `houses.ts`) says when each stands: `age` its row, each age
  back from the civilization's (`homeAge`) a smaller share (`OLDER`: 1, 0.45, 0.12, none), `needs` the advance that brings it
  (Pottery a whitewashed cottage and a potter's yard, Currency a courtyard house, Construction a timber house, the
  Automobile a bungalow and a garage, Renewable Energy a solar house), `size` the smallest city that builds it (a bakery 4, an
  inn 5, a tenement 8, flats 10), `lands` it suits (adobe on dry ground, a mossy cottage on wet), `water` (a fisher's hut, near
  the sea or a river), `heart` (tall ones thin out toward the town's edge), `share` (a workshop less common than a home).
  `pickHouse` lets each candidate draw by a hash of the lot and itself, its weight in its favour, the lowest standing, so a
  lot keeps its house when a new kind comes unless the new kind draws lower: a town changes house by house, never all at once.
  A town has `2 + 1.5 * size` homes on the lots left, nearest the crossroads first by a hashed rank, and the old drawn homes (`HOMES`) stand in for them in the modern renderer. `HOUSE_SCALE` stands them at one scale for
  all, the sheet's sizes kept. Only the picture: the rules know a city's size.
