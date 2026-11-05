# Unit animation

Unit moves: walk cycles, fights, founding, sprite-sheet layout, facing. Moved word for word from CLAUDE.md, so "above" and "below" may point to another file here: search `docs/` for the name.

  Unit moves (2026-10-28, asked for with the user's militia sheet, `tools/sprites/units/militia-anim.png` kept as
  supplied: 14 generated frames, attack 6, sentry 4, fortify 4, on a transparent background, no even grid):
  `tools/sprites/units/anim.ts` finds each frame by its own outline, anchors it on its front foot on the ground (the
  foot planted in all three moves) and lays the frames unscaled on canvases of one size (324x320, anchor 174,318) in
  `apps/web/src/units/militia-anim.png`, every pixel the sheet's (tools/sprites test); `unit-atlas.ts` (generated)
  holds each frame's source rectangle, anchor and drawing box. renderer-api `unit-anim.ts` is the one place to tune
  (`UNIT_ANIMS`: frames and ms per sequence, idle = the first sentry frame, fortified = the last fortify frame, the
  strike frame, `square` 340 atlas pixels to a map square, `pixelated`). `UnitAnimator` (a UI side channel run by
  the web app each frame, like `MotionPlayer`; `view.unitFrames` by unit id) picks frames by elapsed time: sentry
  loops, an order to fortify plays the fortify frames once then holds (one first seen fortified, or `fortifying`
  turning `fortified`, just holds), and a fight plays the attack round and round while it is shown (since
  2026-10-30, asked for: "when fight in combat - show militia fight animation as a cycle - not just once"; it had
  played once), on both sides (`BattleFrame.start` keys it, `fightStep`), at its own pace: the fight's first blow waits
  for the attacker's wind-up, its attack's frames before the strike (since 2026-10-31, asked for of the catapult: "too
  fast ... slow prepare to fire - than throw stone"; `strikeMs`, `MotionTiming.strikeMs` from the web app's own moves
  and the other civs' playback, `BattleFrame.strikeMs`; never sooner than `LUNGE_MS`, 150, the attacker standing its
  ground until the last of it, the rounds after at their pace, so the fight is that much longer: the militia's and the
  hoplite's 320 ms, the catapult's 1490 with its stone's flight; until then the wind-up was squeezed into the 150), so the strike lands with the
  first blow; the defender answers from that blow at its own pace; each strike is reported as it lands
  (`UnitPoses.impacts`), and the fight no longer shown, back to its orders. Combat itself is untouched. `unitArtPlace` stands every frame's canvas in the same box (the idle
  drawing centred, its foot a fine pixel up), so feet stay put. The magenta clothes take the owner's colour
  (`recolourOwner`, `OWNER_MAGENTA`: hue 288-336, saturation from 0.5, shading kept against the lit 0.85), made
  per frame and colour by the web app's `unit-frames.ts` and drawn pixelated at whole pixels. The static militia
  picture is no longer shown; the other 28 units stay magenta as drawn. `apps/web/unit-preview.html` (dev server
  only) shows every frame with its rectangle, anchor and bounds, the moves on four terrains in two colours, play,
  step, speed and a strike count. Asset limits: the back foot's distance from the front one varies between frames
  (up to 15 sheet pixels in the attack, 14 in the sentry loop), so the back foot shuffles a little; the art is drawn
  far finer than the map (an art pixel is about 2/3 of a screen pixel), so nearest-neighbour downscaling drops pixels.
  The militia's walk (2026-10-30, asked for with the user's sheet: "implement militia travel animation";
  `tools/sprites/units/militia-travel-anim.png` kept as supplied, 1536x1024, rows of 3 on a 512-pixel grid, six steps
  of a walk): cut as a grid into its own atlas, `militia-travel` (6 canvases of 394x433, anchor 150,431), since it is
  drawn larger than the first sheet (1.74 times as tall upright, the head 1.58 times) and an atlas has one scale. Every
  atlas has a rule in `UNIT_ANIMS` named as it is (its `square`, `ownerColour`, and `idle`: the frame it stands centred
  on), and a unit's rule may take frames from further atlases (`sheets`), numbered on after its own: the militia's
  frames 14-19 are the walk's 0-5 (`animSheet(type, frame)` says which atlas and frame, `animFrameCount`), each placed
  at its own atlas's scale with that atlas's home frame centred in the square (`unitArtPlace`), cut from its own image
  (`unitFrameUrl`, `units/<atlas>-anim.png`) and recoloured as the unit (the militia's clothes take the owner's colour);
  a further sheet's atlas is not prepared on its own. Scale 560, between the two ratios: his head level with the
  standing man's, he looks the same size walking as standing (592 matched heights and looked smaller, side on and
  slimmer). The militia's `travel` plays the walk while it is shown stepping, from the second step, as the settlers'
  does; facing left it is mirrored as the rest. A step of a unit that walks takes a whole cycle of its walk (asked for
  the same day: "cant see the walk - not enough time for a full cycle"; a step had taken 120 ms, the walk 600):
  `MotionTiming.walkMs` (the web app's own moves and the other civs' playback pass `travelMs`), 80 ms a frame, 480 ms a
  square, ending on the frame it stands in; a chain of walked steps is sped up to fit `WALK_CHAIN_MS` (2.4 s: five
  squares at the full pace, a railroad goto quicker).
  The militia winning (2026-10-30, asked for with the user's two sheets: "implement militia lost and won combat", then
  the same day "remove the lost animation - only win. the lost unit would vanish with effect": a losing militia
  flickers out in the burst as any unit; its fall, its sheet and the longer fight it needed are gone).
  `tools/sprites/units/militia-won-anim.png` kept as supplied, 1536x1024, rows of 3 on a 512-pixel grid: the club
  raised, the fists up, the proud stance. It came on a green screen, not clear: the cutter's `green` sheets are keyed
  first (`keyGreen`, tools/sprites `src/chroma.ts`: a pixel as green as its green exceeds its red and blue, nothing in
  the art being green; up to 30 kept as it is, from 160 clear, between part clear with its green brought down to its
  red or blue), every other pixel the sheet's (the tools test keys the sheet the same way). Atlas `militia-won`
  (373x483), its own scale (440: drawn at a size of its own, his head 66 pixels to the first sheet's 60, standing 352 to
  244, between head and height as the walk's), numbered on after the walk: the militia's `won` is frames 20-25. As the
  loser begins to burst (`BattleFighter.dying`), the animator turns the winner from its attack to its `won`, played
  through to its end even once the fight is over (1.24 s, the proud stance held longest), then back to its orders. Preview: `?unit=militia` (its walk among the moves).
  Settlers' moves (2026-10-29, asked for with the user's sheet: "implement settler - states sprite-sheet for actions -
  mine, irrigation, travel and road building"; `tools/sprites/units/settlers-anim.png` kept as supplied, 1536x1024,
  an even grid of 256-pixel cells, rows of 6: travel, road, irrigate, mine; each frame the man, the woman and the child,
  with the dirt and stones, on a transparent background with a faint glow round the figures): `anim.ts` takes a
  sheet's `cell`, so a frame is every piece whose middle lies in its cell and its anchor the cell's middle on its row's
  ground (the lowest foot in the row: the sheet keeps the frames in register, and the walking feet move as drawn); a
  faint pixel edging no figure (the glow) is left out. 24 canvases of 265x254 (anchor 124,252) in
  `apps/web/src/units/settlers-anim.png`. `UnitAnimRule`'s moves are each optional, a unit playing only those it has,
  and two kinds are new: `travel`, looped while the unit is being shown stepping (`UnitAnimator.update`'s `moving`, the
  web app's `shown.moving`: slides and nudges), from the second walking frame so even one step shows it under way, then
  back to its orders; and `work` by `WorkKind`, looped as long as the job lasts (road, railroad and fortress: the
  mallet; irrigate and clean: the spade; mine: the pick). Idle is the first walking frame; sentry and fortify have no
  frames, so they stand. `square` 246 (the walking family as tall as the still picture). `ownerColour` (false for the
  settlers: their magenta is shown as drawn, as the still pictures' is; the militia's colour was asked for) also
  makes `unit-frames.ts` make their frames once, whatever the owners. The preview page takes `?unit=settlers`.
  The settlers' walk (2026-10-31, asked for with the user's sheet: "impl. settlers travel (move from tile to tile)
  animation"; `tools/sprites/units/settlers-travel-anim.png` kept as supplied, 1536x1024, rows of 3 on a 512-pixel grid,
  the same family as the first sheet's travel row drawn larger, on a green screen keyed as the militia's win; a second
  copy on a dark glow was left aside): its own atlas, `settlers-travel` (6 canvases of 485x345), the frames put in
  register by their bodies (the passing steps drawn 22 pixels ahead in their cells), scale 443 (the people 1.8 to 1.84
  times the first sheet's, the whole 1.76 with the spade, twice as wide in their stride: scaled by the people, so they
  walk as tall as they stand). The settlers' `travel` is its frames 24-29 (`sheets`), from the second step, a whole cycle
  a square; they still stand in the first sheet's first travel frame, whose other five are no longer played.
  The founding (2026-10-29: first "add the build new settlement", a hut going up, then the same day "replace with the
  attached sprite-sheet, for new settlement epic effect - add zoom and some effect and delay to let the player see the
  new settlement establishment"): `tools/sprites/units/settlers-found-anim.png`, kept as supplied, 1536x1024, rows of 3
  on a 512-pixel grid: lift, raise, plant (the flag), unfurl, fly, cheer. `anim.ts` cuts it as a grid (`cell` 512); a
  piece lying across a cell's edge with a tenth of itself or more on each side is split at its thinnest column within an
  eighth of a cell of the edge (the hut sheet's posts and logs touched; none do now). Its atlas is a show of its own,
  `settlers-found` (6 canvases of 533x491, anchor 274,489), in `UNIT_ANIMS` as a rule with a `show` (`showFrame`) at
  scale 398 (the sheet draws the family 1.6 times the walking one's size: the woman 257 pixels for 159), so they stand
  as tall as they walked in; the settlers' rule names it (`found`). renderer-api `founding.ts` is the moment's timeline
  and the one place to tune it (`FOUNDING`, `foundingMoment(id, ms)`, `foundingShow(type)`: about 6 s): the view
  glides in over 0.9 s (eased) as dusk falls, the show starts 0.5 s in (lift 500 ms .. cheer 900), the light rises over
  0.6 s from the unfurling and the name from the cheer, and the cheer holds 2 s more; a key or click after 0.6 s cuts
  it short. Founding a city in the web app (`foundWithName`) glides the map to it and plays it (the `founding` screen,
  `MainScreenView.founding`: the moment plus the city's name), then opens the city as before; the turn does not end by
  itself meanwhile. Retro (`founding.ts`, after the map is drawn and zoomed, before the panel): the view blown up about
  the city to 4x the map at 1x (`FOUNDING.zoom`; never less than the player's zoom), the city gliding to the middle a
  little below half way, the pictures moved and grown with it (`moveArt`) and the city and its name left out; dusk
  through the Bayer dither round a pool of light on the founders, twice as deep further out, the pictures out in it
  dimmed; from the unfurling, fourteen rays of gold turning slowly behind the flag with a glow at their heart (worked
  out a screen pixel at a time: the moment costs about 4 ms a frame over the map's 13) and sparks drifting up; from
  the cheer, the name in large gold capitals under them, letter by letter, then "A NEW CITY" spaced under it. All
  under the pictures, so the founders stand in front of the light; hashes and time, never the RNG. Other civilizations'
  cities appear as ever; the phone plays it too (the zoom is the effect's own, not the map's). Preview:
  `?unit=settlers-found`.
  The hoplite (2026-10-30, asked for with the user's sheet: "implement hoplite sprite-sheet"), the first in the layout
  the sheets' prompt asks of every unit: one sheet, 1536x1024, a 256-pixel grid, rows of 6: move, attack (ready,
  anticipation, wind-up, strike, follow-through, recovery), victory, then sentry 3 and fortify 3 (ships and aircraft a
  6-frame idle there). `tools/sprites/units/phalanx-anim.png` kept as supplied (on a green screen, keyed as the
  militia's win); atlas `phalanx` (24 canvases of 385x258); its rule's moves are the rows (`travel`, `attack` striking on
  the strike, `won`, `sentry`, `fortify`, idle sentry-1, fortified the shield wall), shown as drawn (`ownerColour`
  false), scale 296 (between the still picture's shield and its crest-to-feet as that stands in its square; the still's
  spear is drawn longer). Its still picture is no longer shown, as the militia's. A generated sheet sets its figure a
  little differently in each cell (here the strike 38 pixels behind the ready stance to fit the spear, the
  follow-through 35 ahead, the walk drifting back 27 over its steps), so the cutter puts runs of frames in register
  (`align`, with the sheet's `home` frame): by the legs (planted in a thrust, a cheer, the watch) or by the body above
  them (a walk), each frame with the run's first and that with the home frame, by the sideways shift that lays most of
  their pixels in that part on each other's; only the anchors move, every pixel stays the sheet's. The kneel is left as
  drawn, behind the shield that stays put. Preview: `?unit=phalanx`.
  Every sheet in that layout is one entry in the cutter (`oneSheet` in anim.ts: its rows' names and what each run is
  registered by) and one in `UNIT_ANIMS` (`oneSheet(square)` in unit-anim.ts: the rows' moves and timings). The
  catapult (2026-10-31, asked for with the user's sheet: "implement attached catapult states", redrawn the same day with
  its crewman: "implement attached updated catapult sprite-sheet"): he pushes it on its turning wheels; raises the
  loaded arm upright, winches it back and down to cocked, holds it, lets go (the arm slams up, the stone flies off with
  its trail, the cart bucks, he stumbles back), and it rests empty; he steps away and cheers, arms up; he stands watch
  beside it with his staff (the sheet's fortify frames are the watch again). As wide as the first sheet's catapult alone
  (the cart drawn smaller beside him), so scale 252 still, between as wide as the still picture (295) and as much of
  the square (249). He crouches, steps and stumbles about the cart, so the cutter registers every run by the wheels
  (`align` "wheels": the lowest quarter of the picture, where they outweigh his feet; the cart is drawn up to 14 pixels
  off from cell to cell, and kicks back 12 as it shoots). The loosed stone lies across the edge of the next cell: a
  piece astride an edge is split only at a thin column (a third of its thickest or less), else it goes with the piece
  nearest it (the stone with its trail). Its shot (asked for the same day: "too fast. should be with ease in-out. slow
  prepare to fire - than throw stone", then "still very bad": it lunged onto its foe like a soldier, jiggled with each
  blow, and its stone only appeared at its own corner): it stands its ground and shoots once a fight (`UnitShot` on its
  attack: `from`, where the release frame draws the stone, atlas pixels from that frame's foot; `flightMs` 340; `arc`
  0.25 of a square), eased in and out: raised (260 ms), winched down (220, 260), held longest (300), quick as the stone
  leaves on the sheet's frame of it (110), the spent arm settling (480) and held so till he cheers. The map carries the
  stone on from that frame's end (renderer-api `shotOf`, `MotionTiming.shot` from both pacings, `ShotPace`;
  `BattleFrame.shot`: where it is, the ground under it, `landed`): the sheet draws it near the top of its square, over
  its foe's, so it comes down in a short drop to the ground before its foe's feet (`SHOT_LANDS`), mirrored when it shoots
  leftward, the first blow landing with it (`strikeMs` counts the release frame and the flight: 1490 ms), the attacker
  never closing in (no lunge, no jiggle); then the dust settles (`LANDED_MS` 380). Retro `shot.ts`: a light grey ball
  five fine pixels across (the picture's stone at the map's scale) edged in its darkest, its shadow on the ground under
  it, then dust puffs dithered thinner as they spread and rise, clods falling back, a flash at the strike; on the map
  under the pictures. Attacked, a unit that shoots stands as it was. `oneSheet`'s second argument overrides a move's
  frames or timings. On a green-screen sheet a speck (under
  `GRID_SPECK`, 20 pixels) is part of the drawing, kept with its cell's frame (the dots trailing the stone); on a
  clear sheet it is the glow, left out.
  Facing (2026-10-28, asked for: "flip units to face the direction they are moving or attacking towards"): renderer-api
  `UnitFacing` (a UI side channel run by the web app each frame; `view.facingLeft` by unit id) turns a unit the way it
  steps or is nudged across once the step is under way (`UnitMotion.heading`; one waiting its turn keeps its facing),
  or strikes (`BattleFrame.heading`; the defender turns to face its attacker), and it keeps that way; a step straight
  up or down keeps it, and a unit moved with nothing shown turns the short way round the seam. The pictures are drawn
  facing right and mirrored when facing left (`ArtSpot.flip`, CSS `scaleX(-1)`; the clip round the marks mirrored to
  match, so the shield stays top left): an animated unit's about the anchor its feet stand on, its idle drawing still
  centred in the square, any other's about its middle; a ship going down mirrored too. The map, the unit box and the
  fights show it; lists, the city screen and the square's window show units facing right. Sprites are never mirrored.
