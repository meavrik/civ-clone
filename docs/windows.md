# Windows

Tax rates, windows and buttons, title and opening, setup cards. Moved word for word from CLAUDE.md, so "above" and "below" may point to another file here: search `docs/` for the name.

  Tax Rates (Game > Tax Rate, T; redone 2026-10-24, "not good") is a stone window over the map
  (`screens/rates.ts`, `ratesRect`): a row each for tax, luxuries and science with its icon, - and +
  buttons and ten blocks (filled to the rate, dark past the government's limit), what the cities bring
  a turn at the foot (`empireIncome`), the close box (no Done since 2026-10-24); `ratesHit` (set a
  block, step, done) through `Renderer.ratesHit`, `ratesAt` for the phone's sliding finger; science
  takes what the others leave, and moving it takes from tax (`setRateTo`).
  Windows (asked for 2026-10-24: "all screen windows should be a modal style", "replace all close
  buttons with generic modal X", "darken backdrop", buttons "stone like texture"): every titled window
  (modals, the rates, text input, New Technology, Building Completed, the audience) darkens the game it
  opens over first (`dimScreen` in widgets.ts, once a frame by `Surface.dimmed`, through `DIMMED` in
  palette.ts: each colour's nearest twin at 45% light, built from the palette so the renderer still draws
  indices); dropdowns and the title screen's untitled list do not. A message with nothing to choose but
  to close it (the web app's `modal` with "OK") has no button: an X in its title strip (`MenuState.close`,
  zero items), Enter, Esc or a click off it go on. The research panel's Close button is a close box in
  its title strip (`researchHit` "close"); the audience's X (or Esc) steps back or takes leave, and since
  2026-10-31 every screen of a talk also says so in a button (asked for: "sometimes there is one option, with no back
  or cancel option"): a list's Back (Done in an exchange's lists), a price's No, war's Keep the peace, Farewell after
  the last words (the web app's `talkMenu` `exit`). `drawButton` is the speckled stone with a light top-left and dark
  bottom-right bevel. Every button takes one of four looks (`ButtonLook`, `buttonFace` in widgets.ts; since
  2026-11-01, asked for: "button hover/selected change style", "add new button style (maybe red) for aggresive
  actions"): plain stone with black words; lit (under the pointer, the modals' default choice, Research, the tab
  shown) the same grain and bevel in the blue of the title strips and menus' lit rows, white words (parchment gold
  from 2026-10-25 till then); danger, red stone with white words, for what makes an enemy or undoes something for
  good; lit danger the same red ringed white inside its bevel. A faded button is plain stone. The audience's choices
  (`DiplomacyView.danger`, renderer-api `talkDanger`: war, each demand and Make demands; the civ card's demand) and
  the parchment windows' buttons (`drawWindowButton`) take them too. Red elsewhere (`MenuState.danger`, the web
  app's `menu`/`modal`/`talkMenu` `danger`): Declare war! (the map's and the talk's), Disband and its Yes, disband,
  Pillage, the diplomat's steal, sabotage and incite. A menu's row or button under the mouse is lit (its `selected`, as the
  windows' buttons were already; never a faded one). A window answers
  no Enter, Space or click until it stands whole (`WINDOW_ENTER_MS`; the web app's `settled`), and never
  a key held down: a key mashed through the playback cannot dismiss the window that follows it (asked for
  2026-10-24, "building is built, and skip building screen"). The Building Completed window first glides
  the map to its city (`centerOn` in `builtWindow`).
  A titled menu of up to four choices is a modal (`menuButtons`): its choices are buttons sized to the
  longest label and centred, and its text wraps rather than widen it past `MODAL_MAX_SHARE` of the
  screen; keep modal text to a line or two. A list longer than the screen (what to build late in the game) scrolls:
  `MenuState.top` kept by `keepInView`, `Renderer.menuRows` and `menuScrollAt` (retro draws a bar with
  arrows); arrows, PgUp/PgDn, Home/End, the wheel and clicks on the bar move through it. While rows lie below those on view
  a small dark chevron pointing down stands in the middle of the window's foot, bobbing down and back up (asked for 2026-11-05:
  "show arrow indication in the bottom when have more options in the list - not clear engouh now that can scroll down", then
  of the lit button with a white arrow it was at first, "too bulcky - subtle and add small cycle down-up animation"; retro
  `drawMoreArrow`, `listFoot`, `MORE_ROOM`; renderer-api `MORE_BOB`, `moreArrowDrop`, 3 fine pixels over 1.2 s, read off
  `MenuState.clock`, which the web app sets each frame): the same size on the phone. A list that scrolls keeps its foot 4 pixels deeper for it, the build menu from
  the room its rows leave so it loses none (`keep`; the phone's picture rows close up from 19 to 18 for that), any other
  list giving up a row. All of the foot answers a click (`menuScrollAt`), and a click on the bar or the arrow pages the rows
  themselves (`scrollRows` in renderer-api, the phone's drag too; it had moved the choice, which on a first click stayed on
  view, so nothing scrolled). At the list's end the arrow goes and a click on the foot does nothing, so a click too many
  does not close the window.
  Debug's entries (reveal map, gold, research, production, moves, contact) are the core `cheat` command, logged and replayed like any order.
  Opening and title (`intro.ts`; asked for 2026-10-22, after the original's intro, in place of the old
  sunrise and its "an empire game" line): one timeline, `introAt(ms)`, `INTRO_MS` (27.5 s) long: stars,
  a planet turning in space as it forms (molten, cooling, seas, clouds, green land, towns' lights on its
  night side) under five lines of story in our own words (`INTRO_CAPTIONS`), then the name CIVILIZATION
  over it. `Renderer.title(at)` draws it `at` ms in; from `INTRO_MS` the title stands complete, the
  planet still turning. The web app starts it on the first frame; a key or click skips to the end, and
  the title menu (no header) opens by itself once it is over and whenever the title shows again. Retro
  draws it in `screens/title.ts`: the planet lit per fine pixel from hashed noise maps (made a few rows a
  frame while only the stars show), the name in `screens/title-name.ts` (since 2026-11-01, asked for with the original's title as the model: "more like
  the original one ... instead of "sid meier's" - "Avrik's""; before, our slab capitals in flat gold, 2026-10-30): tall,
  narrow Roman capitals of our own, built from shapes (stems, wedges, rings, bracketed serifs, brush strokes) and filled
  per fine pixel, 80 fine pixels tall, thick downstrokes and hairline bars, shaded through the Bayer dither from brown at
  the word's ends to cream in its middle (`FACE_RAMP`: earth then rock), lit pale lavender along each left edge, navy
  along each right, ringed in navy; over it the byline "Avrik's" in small serif letters, cream, between two ruled lines
  (a hairline over a band) running out to the name's ends. It comes up out of the dark from the middle of the word
  outward, a glint sweeping across. Its letters are drawn ahead, one a frame, once the planet glows into view
  (`prepareTitleName`), so the name costs nothing when it comes. `TITLE_NAME_BOTTOM` is the first row clear of it: the
  phone's title buttons keep below it (`SETUP_CHOICES.top`, shortened to 22 when five would not fit), the web's menu
  stands lower already; modern keeps a
  still title with the name.
  Setup cards (`setup.ts`; asked for 2026-10-22, then redone the same day: the first pictures, seats of
  power, town patches and landmarks, were not liked): `setupCards(setup)` gives difficulty and the tribe as
  cards with portraits, in `setupMenu`'s order (null for the rest, the number of civilizations included:
  plain menus). Difficulty: a row of its rulers (chieftain, warlord, prince, king, emperor, as the original
  showed them), the panel under
  them saying what the level changes (`DIFFICULTY_RULES`). Tribes: a grid of
  their leaders (`LEADER_PORTRAITS`, `TRIBE_COLUMNS` across), framed in the tribe's colour, beside a panel
  with the leader large, the trait, the first advance and the capital. All of them are the user's
  portraits shown as supplied (asked for 2026-10-22, "don't change or distort": converted into the palette
  they had lost detail and colour): `apps/web/src/portraits/<name>.webp` (the PNGs at their own sizes,
  WebP quality 92 with exact alpha), laid over the canvas whole, shape kept, standing on the foot of the
  places `setupPictureSpots` gives (every card's, and the panel's), the screen drawing only a sky
  behind them; `pictures.ts` in the web app as for the audience. `Renderer.setup`/`setupHit`; the web app lights
  the card under the pointer and picks it on a click (a first tap on the phone lights it); arrows move in
  two dimensions, Enter picks. Modern shows the cards' labels as its old menu.
