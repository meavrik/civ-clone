# City screen

Renderer API, city screen, build menu, completion windows, conquest, city view pictures. Moved word for word from CLAUDE.md, so "above" and "below" may point to another file here: search `docs/` for the name.

- `packages/renderer-api` — the `Renderer` interface every renderer implements (draw each screen
  in its own logical size, hit-test menus/city map/city buttons/tiles/minimap/menu bar), the shared view types and the
  DOM-free screen logic (`setupMenu`, `leaderLine`, `wondersReport`, `topCitiesReport`, `builtNotice`).
  City screen: Change and Buy buttons in the production box (`cityButtonAt`); no bottom bar (asked for
  2026-10-24: "remove all buttons", after a bulky one and two redos): a close box at the title strip's
  end leaves (`cityExitHit`), a city icon beside it is View, a smiling face (the `happy` icon) before
  the citizens is Happy (lit blue while its panel is up), and the four focus toggles fill the map's
  empty corners (`FOCUS_CORNERS`, `cityFocusAt`: Growth food top left, Production shield top right,
  Trade coin bottom right, Science bulb bottom left; lit for each the city works for, any of them
  together, `setFoci`). Whatever the pointer rests on is told of beside the citizens (`cityControlNote`,
  `CityScreenView.hoverControl`), and the latest word (`view.message`) shows there too; the worked squares of its
  map carry their yield in the City Resources box's own icons (wheat ear food, hammer shields, arrows
  trade), straight on the ground with no shade: food along the top half, shields then trade along the
  bottom, overlapping when a row is long (asked for 2026-10-22: the shade looked bad and the old 3x3
  marks could not be told apart); the box gives each a named row of icons (Food, Shields, Trade, then
  Tax, Lux and Sci a row each; the buildings' upkeep heads the Improvements box). The Improvements box
  (asked for 2026-10-25: a small picture of each building, a scroll to see them all, and the option to sell
  each) lists the city's wonders (gold) then its buildings (`cityImprovements` in renderer-api), a line each:
  the user's picture of it in a 14x10 spot (`Surface.art`), its name, its upkeep and, for a building but the
  Palace, a Stop button; more lines than fit (5, 6 in saves without culture) scroll (`CityScreenView.top`,
  `scrollImprovements`; the wheel anywhere on the city screen, the bar's arrows a line and its track a page,
  a drag on the phone). Selling gave way to stopping a building's support (asked for 2026-10-27: "remove
  building sell option - replace with stop supporting the building - reduce the upkeep and disable building
  effect"): a click on a line or its Stop button asks first ("Stop supporting the Temple?", the gold a turn it
  saves and the rule's `text` of what stops working, Keep it by default; `askSupport` in the web app), then
  the core `support` command (`on: false`; `whyNoSupportChange`: never the Palace, which costs nothing, or a
  wonder) moves it from `City.buildings` to `City.idle`, so every rule reading the buildings passes it by: no
  upkeep, no effect, no culture (the city's workers leaving squares a shrunken border gives up,
  `dropLostSquares`), never built twice (`buildOptions`); it stands on in the city view. Idle buildings come
  last in the list, faded, their pictures darkened (`ArtSpot.dim`), with a Use button (`on: true`, at once).
  A conqueror finds them standing and supports them (`captureCity`). The line pointed at is lit and told of
  beside the citizens (`improvementNote`, `CityScreenView.hoverImprovement`). No save version: old logs hold
  no `support`; the core `sell` command (`sellPrice`, `whyNoSale`, `City.soldOn`) stays for the logs that
  hold it. A bankrupt treasury stops supporting buildings itself since save version 42 (see Treasury under
  Known gaps 1); it sold the costliest building before. Tidied 2026-10-24
  (asked for: "a bit chaotic", a granary indication, citizens to click "like in the original civ"):
  the row of citizens (`citizenRow` in renderer-api: workers by mood, then specialists) is clickable
  (`cityCitizenAt`; the web app's `changeCitizen`): a worker leaves the square worth least to entertain
  (`toggleTile` on `weakestWorked`), a specialist turns entertainer, taxman, scientist (`setSpecialist`,
  `nextSpecialist`), then goes back to work on the best free square (core `bestFreeSlot`; `workTile` with
  `specialist`, the one clicked; asked for 2026-10-25: a changed citizen could not go back), round again
  to entertainer only when no square is free; the person under the pointer (`CityScreenView.hover`) is
  ringed in gold, traced round the figure (`Surface.halo`; asked for 2026-10-25 in place of a light
  patch behind them, as Happy's face is), drawn in front of the row and told of beside it (`citizenNote`),
  else a faint hint. The food and shield stores (`drawStore`,
  `storeLayout`) are grids of empty slots waiting to be filled (asked for 2026-10-24), ten to a row,
  the grid in the middle of its box's room with the same padding on every side (`storeRegion`), a slot
  standing for more than one good only when the box has more goods than the room has slots (then each
  slot shows the goods it holds so far as a stack, one copy a good climbing up and right by up to three
  fine pixels, so the slot being filled grows good by good until it is full, `drawStack`; asked for
  2026-10-24 in place of a "{food}=2" key, and 2026-10-25 "each and every shield stacked until the
  placeholder is full"); the slots of what a growing city keeps (core `foodKept`: a Granary's half, or
  a trait's share) are edged in gold and named Granary (or Kept) at the foot, room allowing. Taxmen and scientists need no size of city (the 1991 game is said to want size 5: not checked, not asked for).
  Esc, Enter (not held), the close box or a click
  on nothing that answers (not a button, unit or city square) leaves it; Buy (button or B) shows the
  price against the treasury first. The build menu (`openProductionMenu` in the web app) shows beside
  each choice only the turns it takes from here, counting the shields a change would keep ("never"
  without a surplus); no costs or shield counts (asked for). Its choices stand under three tabs, in this order, Units,
  Buildings (spaceship parts with them) and Wonders (asked for 2026-10-31: "split into 2 tabs - buildings and units",
  then "add wonders tab - if no wonder to build disabled", and the order; `MenuState.tabs`/`tab`, a `MenuTab` each,
  shown by renderer-api `showTab`, which keeps each tab's pick for when it comes back): it opens on the tab of what the
  city builds (or last built, waiting for a choice), a tab with nothing to build stands faded and never shows
  (`MenuTab.off`), a click on a tab (`Renderer.menuTabAt`, retro `menuTabAt`, none on a faded one), Left/Right or Tab
  switch (passing a faded one), and the window is sized for every tab's rows so it keeps its size; retro draws the
  tabs as stone buttons sharing the window's width under the title, the one shown lit. Each choice has its picture before it (asked for
  2026-10-30: "show unit/building image next to each item"; `MenuState.pictures`, a `MenuPicture`: the unit's, the
  user's picture of the building, wonder or spaceship part in a 16-pixel square, retro `drawRowPicture`; darkened on
  a row that cannot be picked), and over the city screen the window stands above the units box, which stays lit
  (asked for the same day: "place the menu above the units panel - so player could see all existing units";
  `MenuState.keepClear` "cityUnits", the box from renderer-retro `screens/city-layout.ts`, which holds the city
  screen's boxes so widgets.ts can read them), its rows scrolling in the room there (4 on the desktop, 3 on the
  phone, with the tabs); where that leaves fewer than 3 rows (a note above the list, on the phone) the phone takes
  its smaller menu, else the window stands in the middle as before (`CLEAR_ROWS`). Each row ends in an info mark, a
  small blue disc with a white i (asked for 2026-11-02: "on the build menu - add for each building/unit a info icon -
  when clicked or hover show building/unit info"; `MenuState.info`/`MenuTab.info`, renderer-api `production-info.ts`,
  `productionInfo`: a `MenuInfo`, its name and lines with icons; retro `menu-info.ts`, `drawInfoMark`, `drawMenuTip`):
  the mouse on it shows a tip beside it (`MenuState.infoShown`; right of the mark, else left of it over the window,
  pointing at it, the font's size on the phone too), a click or tap keeps it up (the menu screen's `infoPinned`), a
  second click on the mark or one on the tip lets it go (`Renderer.menuInfoAt`, `menuTipAt`), and I shows the selected
  row's, following the selection, Esc hiding it before it closes the window. A unit's tells its attack, defence and
  moves, hit points, firepower and sight, what it can do (`unitAbilities`, shared with the panel's unit tip), wheels,
  deep water, zones of control, fuel, a veteran trained here (Barracks, traits), its upkeep in this city (its free
  units, a settler's food), the resources it needs and whether we hold them, and the advance that retires it; a
  building's its sentence, its effects in numbers (the Building Completed window's, `productionEffects`) and its upkeep;
  a wonder's its sentence, effect and culture, and the advance that ends its effect. No shield costs (the menu gives
  the turns). A change of production keeps the box for the kind it was
  gathered for and half of it for another kind (`shieldsAfterChange`: reckoned from the box as the turn
  began, `City.turnShields`/`turnKind`, or as bought, so changing and changing back in a turn costs
  nothing; FreeCiv's model). Units are one kind and improvements, wonders and spaceship parts another,
  as the original had it, and a finished improvement's leftover keeps its kind whatever the city turned
  to meanwhile (Militia; since save version 28, asked for 2026-10-24: "building starting already with
  production already processed": the Militia made the leftover a unit's box, halved for the next
  improvement; saves before 28 load with `halvedCarryOver`, headless `--halved-carry-over`). Since save version 49
  nothing is left over (asked for 2026-10-31: "when a unit/building production is complete - next production start
  from 0"): whatever is finished, for every player, takes the whole box (saves before load with `leftoverShields`,
  headless `--leftover-shields`). And a human player's city never turns to a default by itself (asked for the same day:
  "do not select automatically the militia or any other default unit - always let the player select the next
  production"; core `choosesNext`, `City.choosing`, saves before load with `defaultBuilds`, headless
  `--default-builds`): founded, taken, having finished anything but a fighting unit (see below), or its wonder built elsewhere or its unit
  retired, it waits for its owner's pick, its shields gathering whole for it, nothing finished or bought meanwhile
  (`buy` refused, "nothing chosen"); `production` stays a placeholder. Computer players' cities turn to their default
  and go on with a finished unit as ever (the planner, seated for a human by headless `--human`, picks at once). The
  production box says "Build what?", Choose lit, "Nothing chosen yet" (the domestic advisor "Nothing chosen"); founding
  opens the city with "Rome: build what first?", and after the turn's news each city still waiting and not asked that
  turn opens with its build menu, "Militia completed: build what next?" (the web app's `askChoices`); left without a
  pick, it is asked again next turn. Head to head (planner vs v2, 16 x 300, Prince, city-states): 12-4, score 172 vs
  106, cities 10.0 vs 6.4, pop 56 vs 34; with the leftovers as before 8-8, 160 vs 122; all replaying exactly. Saves
  before version 21 load with `compoundingPenalty`: every change of kind halved the box again. Its units (`cityUnits`: those in the city from any home, then those it
  supports elsewhere, darkened, each with its cost) are picked with `cityUnitAt`: the unit wakes (fortify or
  sentry dropped, the `activate` command) and comes into play; one with no moves left keeps its orders. Since
  2026-11-02 (asked for: "distinct on the units view when unit is fortified or sentry - also when player activate a
  unit - show it activated and dont automaticlly close window, so player could activate several units") the city stays
  open (the web app's `activateFromCity`, `woke` on the city `Screen`) and the map takes up the last one woken once it
  is left (`leaveCity`); what each unit is doing shows in its slot (renderer-api `unit-standing.ts`,
  `cityUnitStanding`): a sleeper wears a slate token with a cream glyph of our own in its top left corner, where the
  map puts the shield (retro `SLEEP_MARKS` in `screens/city.ts`: a tower fortified or fortifying, zZ on sentry, a heart
  camped), its picture holed round it; a unit awaiting orders glows gold as the unit in play does on the map
  (`READY_GLOW`, twice `ACTIVE_GLOW` on the stone), so one just woken lights up; the pointer on a unit tells of it
  beside the citizens (`CityScreenView.hoverUnit`, `cityUnitNote`: "Legion: on sentry, click to wake"). A second click
  on a unit woken there gives it back the order it gave up (asked for the same day: "a second click would return the
  unit to the previous state"; `CityScreenView.woken`, the `SleepOrder` by unit, `SLEEP_AGAIN` for the note): the
  `fortify`, `sentry` or `camp` command, a fortifying unit standing fortified as our turn ends, before anyone strikes, so
  no save version. A unit the city supports away from it is only darkened (asked for the same day, after a fade and a
  glow: "remove filters and opacity - just make darker"; `ArtSpot.dark`, `AWAY_LIGHT` 0.35, no glow), its token whole
  over it, and a click on it closes the city and centres the map on it (`findUnit`), bringing it into play when it
  awaits orders, its orders otherwise untouched ("click to find it on the map"). A city that finishes an improvement, wonder or spaceship part opens
  the Building Completed window (`built.ts`, `builtCard`; asked for 2026-10-24 with the user's template; retro
  `screens/built.ts`, modern a plain modal), a small window over the game since 2026-10-24 ("should be a
  modal opened on top of the game and not a full screen window"; smaller again since 2026-10-25 and standing
  by its city, "smaller - and placed above the relevant built city with an arrow": `builtPlace`;
  over the map the map glides to put the city a square below the middle and rests there `BUILT_SETTLE_MS` (250 ms) before
  the window opens (asked for 2026-11-02: "first let the camera set on the city, and only than show building complete
  popup"; the `beat` screen, a key or click opening it at once; its sound with it), the web app hands each frame the
  city's square on screen (`BuiltView.square`, `Renderer.squareRect`, the phone's through its pan and zoom)
  and the window stands above it, else below, else beside it, a point of its stone reaching to a gold ring
  round the square, which `dimScreen`'s `keep` leaves lit; it grows out of that point (`drawEntering`'s
  `from`) and a click on the city is View City; elsewhere it is centred; a wonder first rises in its city's picture (the web app's
  `wonderShow` screen: the city view with `CityViewState.rising`, its stages in turn (see Wonder stages), or the user's picture clipped from the
  top (`ArtSpot.reveal`, `PicturePlace.reveal`) or the drawn one copied from its ground line up, over
  1.8 s, then sparkles round it for 1.6 s (`drawSparkles`) with the news along the bar (`banner`), a key or
  click after 0.4 s ending it; "a new wonder build WOW effect, the construction in fast forward") and
  its window opens over that picture, darkened with it (`ArtSpot.dim`: the pictures under a window take
  `brightness(45%)`); the web app draws the screen under it,
  `under`): since 2026-10-27 (asked for: "make more simplified. place all the text in the title - <building>
  is completed in <city name> - smaller image and modal", then "keep the building benefits"; the name large
  and the city line are gone) a navy title strip saying what and where in gold, "Temple is completed in Rome"
  (`BuiltCard.title`; shield, close box), the window as wide as that and its lines need (140x74 at least, was
  168x88; `builtSize`, so `builtHit` takes the state), under it the user's picture in a 28-square spot on a
  slate bed at the left (was 36), beside it a parchment panel of its effects (icon and numbers from the rule's
  fields: "+50% science", "+2 culture"), three lines with the upkeep last, and one button along the foot, View
  City (asked for the same day: "enter the city view to select the next building"; the map's Continue is gone):
  it, Enter, V, Esc, the close box and a click on the city all open the city screen with its build menu up
  (`leaveBuilt`); the rule's `text` is the modern renderer's body only. Leaving the city, the
  turn's news goes on (`then`).
  `Renderer.built`/`builtHit`. Since save version 64 (asked for 2026-11-04: "when generating regular combat units (not settlers) - no need to
  enter city view or choose another city improvement/unit") a city that finishes a fighting unit (`attack` above 0: core
  `goesOn`, Triremes and Nuclear too) goes on with it, as the original's did, its box empty, nothing asked, the status
  line saying "Rome builds Phalanx"; a unit retired or wanting a resource still stops it and asks; units with no attack
  (Settlers, Caravan, Diplomat, Explorer, Fishing Boat, Transport) ask as before. Computer players are unchanged, so
  all-AI games are too. Saves before 64 load with `pickAfterUnits` (headless `--pick-after-units`): their logs hold cities
  waiting after every unit, so a game in progress keeps asking.
  Finished units have no window of their own (the city then waits for a choice if it must, asked after
  the news, see above), except Settlers: they cost a citizen, so their window asks what to build next (Build next...) over its city screen: "New Settlers in Rome",
  the user's picture of them on a slate in the square's window's frame (`MenuState.unit`, twice the map's size)
  beside one sentence on them and what they can do (asked for 2026-10-29: "add settler image. less technical";
  from 2026-10-24 it gave the city's size and yields before and after in numbers, which core still records on
  the `built` event, `CityTurnEvent.change`); leaving the city goes on with the turn's news (the city `Screen`'s `then`).
  A wonder finished first in another city (asked for 2026-10-29: the city "just halt and move to another without
  a notice"): after the turn's news each city of ours still building one that stands elsewhere (`wondersLost` in
  renderer-api `outbuilt.ts`) gets its build menu with the news above the list, "Wonder Built Elsewhere":
  where, by whom, and the shields it keeps (`wonderLostNotice`, the build menu's `body`; the web app's
  `askWondersLost`; a city's own finished wonder, its placeholder while it waits, is never one); Esc leaves it be, to be
  asked again next turn. A city whose box fills on such a wonder keeps its shields and says so (core's `outbuilt`
  city event, which opens the same menu): a computer's turns to its default, a human's waits (since save version 49).
  A city taken (`conquest.ts` in renderer-api and renderer-retro; asked for 2026-10-27: "a sad message (if lost) and
  celebration message + animation if player won"; core's `cityCaptured`/`cityLost` events carry the square, `plunder`,
  `capital` and the held city's `cityId`): one we take, once the unit has marched in (`tryMove`), glides the map to it
  (two squares below the middle, so the window fits above) and plays fireworks there (the web app's `triumph` screen,
  `FIREWORKS_MS` 2.6 s, a key or click after 0.4 s cuts it short; `MainScreenView.fireworks`, retro `fireworks.ts`:
  dusk falls over the view through the Bayer dither to `DIMMED`, the city's square kept lit, nine rockets climb and
  burst in rings of gold, our colour and the bright EGA colours, placed by hashes, and the cheer, "Rome is ours!",
  `drawTextLargeRinged` under the city's name); then the window by the city (`conquestCard`, `drawConquest`, placed and
  pointed as the Building Completed window, `builtPlace` with its size): the square as the map draws it
  (`drawSquarePicture`), the name large over "Taken from the Babylonians", a cheering line, then on parchment up to
  three facts (capital fallen, wonders won, gold plundered, citizens, buildings kept), View City and Continue. One of
  ours taken or razed (the turn's news, `presentEvents`): the map glides to it and the window mourns, a black strip with
  the frowning face, name, words and ring in dark red ("Its streets fall silent under foreign soldiers.", a line hashed
  from the city), what was lost, no buttons (the close box, Enter, Esc or any click go on). Razed by us: City Razed,
  fireworks too; freed from the barbarians: "Freed from the Barbarians". `Renderer.conquest`/`conquestHit`; modern
  draws a plain modal. No save version (events are a UI side channel). City view (`cityview.ts`, the original's View:
  the city screen's View icon or V; the modern city screen shows it small as the button): every improvement
  and wonder has a `PICTURES` entry made of shapes (`Part`: rect, poly, oval, line, each of a `Material`) on a
  grid of retro pixels; `cityScene` (`town.ts`) lays the city out as a town seen from above (see The town below),
  hashed, never the RNG. Retro fills the shapes pixel by pixel (`pictures.ts`: lit left, shaded right, outlined in
  black); modern paints them as paths three times larger. The user's pictures of buildings (2026-10-24, asked for: "use the attached
  images for game buildings ... replace buildings also in the city view"; all 50 since Barracks, Granary and
  the Great Library came later that day; the 27 improvements and 21 wonders cuts of the user's sheets since 2026-11-04, see Improvement
  pictures and Wonder stages; the drawn ones stay as the fallback for an id without a picture)
  stand in their place: `BUILDING_ART` (`art.ts`)
  gives the box each spaceship part's drawing fills in its 1254 square, `buildingArt` the box whichever a
  picture is, `artLot` the room it takes in the city view
  (the drawn picture's area in the picture's own shape, at most 46 high; `SceneItem.w`/`h`), and the walls'
  picture stands as their gatehouse (`kind: "gate"`), the walls themselves drawn. Retro draws buildings through
  `drawBuilding`, which leaves an `ArtSpot` in `Surface.art` (back to front) where a picture exists; the
  apps lay the pictures there (`artPlace`, `buildingPlaces`), stacked by `z`, the one clicked ringed in light
  (no stone tag, which a picture would hide). The research card's strip of buildings does the same. A click
  names a building (`cityViewAt`), anything else goes back. The web app
  only talks to a `Renderer`. Info panels prefer icons to words: `ICONS` (`renderer-api/src/icons.ts`)
  names them, every renderer draws all of them, and text may carry `{icon}` tokens (modal bodies and
  panel lines; groups separated by two spaces wrap apart). The main screen has a menu bar (`MENU_BAR`: Game, Orders, Advisors,
  Diplomacy, World, Debug) above map and panel; a `MenuState` with an `anchor` and an empty title is a bar
  dropdown; rows in its `disabled` list are drawn faded and never hit (the web app's `MenuEntry` fourth
  element; Game > Revolution! while `governmentsAvailable` offers one government only, asked for
  2026-10-24). The game's switches (Sound, Music, Borders, Civ Names, Place Names, each On or Off) are a submenu, Game >
  Options ▸ (asked for 2026-10-27: "move all Game menu switch options to be sub menu under options"; the web
  app's `openOptions`, a menu `Screen` with `sub`): a dropdown opened beside the Options row
  (`Renderer.menuRowRect`), over the Game dropdown, which stays drawn under it; a pick flips the switch and
  leaves it open, Esc or Left goes back to the Game menu, and a click off it goes on to the Game menu (its
  rows, the bar, or off both to close). Diplomacy (added 2026-10-24, asked for) lists every civilization met with how we stand,
  and opens its card: the audience screen with the leader's portrait at the left (`CARD_PICTURE`) and
  `civCard`'s sections beside it (since 2026-10-29, asked for: "split to sections of civ stats etc. improve
  content design"; `DiplomacyView.card`, `CardSection`: Realm (government and capital in icon rows; their cities,
  citizens, advances and gold were taken off 2026-10-31, asked for: "remove stats that you should not know in this
  stage"), Toward us (their mood, the AI's `attitude`, with our treaty, pact or alliance, `treaty`;
  what they make of our influence; their units on our land), their trait, Resources; retro draws each a dim
  heading ruled across over its rows, a line opening with an icon wrapping clear of it, the line and the one
  row of buttons lower down), our envoy's word as the line (`envoyLine`), and Talk (an audience; since
  2026-10-29 the talk over goes back to the map, asked for: "dont return again to the talk to x screen"), Demand they leave our land
  (when their units stand on it: the AI's `withdrawAnswer`, friendly yes, wary only to a neighbour at least
  as strong, hostile never; yes is the core `withdraw` command: each of their trespassers gets a goto to
  `exitSquare`, the nearest way off our land, walked at their turn's start, and their trespass is
  forgiven) and Back. The planner may march them elsewhere after; it still ignores borders itself.
