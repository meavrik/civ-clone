# Apps and tools

Web app, phone app, headless harness, maps tool. Moved word for word from CLAUDE.md, so "above" and "below" may point to another file here: search `docs/` for the name.

- `apps/web` — `main.ts` (screen stack + input; draws with the retro renderer only: the modern one is
  set aside for now, still built and tested but not offered), `retro-renderer.ts` (adapter), `display.ts`
  (canvas fitting: crisp integer scale for retro, DPR-aware for modern), `storage.ts` (IndexedDB saves,
  per browser: slot 0 is the autosave, written as every turn begins and when a game starts or loads).
  The title offers "Continue" (the autosave). The game's saves carry its state as well as its log (asked for
  2026-10-28: "should you just save a state and build new game from the state"): `withSnapshot` (autosave,
  Save Game, the phone's save on hide) keeps a deep copy (`copyState`; 586 KB in the browser's store at turn 150
  with seven civs, small world), and `loadSnapshot` takes it back as it is when the save is of this
  `SAVE_VERSION` and its seed and turn agree: Continue in one frame (17 ms, against 2.3 s replaying). The log
  stays the save's truth: `loadSave` always replays it (headless `--verify`), `rewindSave` and `serializeSave`
  (JSON) drop the snapshot, and a snapshot played on matches the game and its replay exactly
  (`packages/ai/tests/ai.test.ts`). A save without a snapshot (older ones, or of another version) replays
  its whole log, every computer player's turn included (about 2.5 s at turn 150 with seven civs when measured, growing with
  the game), then is saved again with one; that replay goes a slice of each
  frame under a Loading window (asked for 2026-10-28: Continue froze the page for seconds): core's
  `replaySave` is `loadSave` as a generator yielding after each command (`ReplayProgress`: the turn reached),
  the web app's `loading` screen runs it `LOAD_SLICE_MS` (70) a frame once the window stands whole
  (`stepLoading`), and `Renderer.loading` draws the window over the screen it opened on (`LoadingView`,
  `loadingView` in renderer-api: the save, a bar of the turns replayed, "Retracing history: 875 BC"; retro
  `screens/loading.ts`). Nothing to press; a failed replay goes back with "Load failed". Going back to an earlier turn is gone from the game
  (the title's 2026-10-22, the Game menu's 2026-10-24, both asked for); core's `turnStarts`/`rewindSave`
  (`save.ts`) stay, tested, for anyone who needs a log cut back. The turn ends by itself only once the player has ordered the last unit awaiting orders that turn
  (`actedThisTurn`, `AUTO_END_MS` after; asked for 2026-10-24: "auto next turn when no actions left, but
  not auto when no actions at all. auto only for 1 turn", after the always-on Auto End Turn was dropped
  that morning for "click enter for next turn - like in the original"): a turn that begins with nothing to
  order waits, the status panel's End of Turn standing with "Press Enter" blinking in and out under it (the lit blue
  block it had was "too loud", 2026-10-24), and Enter or a click on it
  (`statusAt` "endTurn") ends the turn, the phone's way too.
  Sound (`sound.ts`, `GameSound`; asked for 2026-10-27): effects and a looping tune made in the browser with the
  Web Audio API from oscillators and noise on notes of our own (`SFX`, `TUNE`: two eight-bar halves in D dorian,
  a square lead over a triangle bass), nothing downloaded; silent until the first key, click or touch (the
  browser's rule), hushed while the page is hidden. Effects: a menu pick, a refused move, a city founded, a
  building or wonder finished, an advance, a fight (a clash, each blow, the loser's burst, read off
  `view.battle` each frame, `battleSound`), a city taken or lost, war, a meeting, a gift, a leader's demand, the
  turn's end. Game > Options has Sound and Music (`epochs.sound` in localStorage); the phone app shares it.
  Diplomacy: a meeting first holds the map on whom we met (the `beat` screen:
  a callout, 1.6 s or any key), then their leader receives us (`audience`), a talk (redone 2026-10-25,
  asked for: a choice answered by buttons for its opposite, war's "Keep the peace", "Break the treaty"
  right after signing, "Close borders" after opening them, was "very confusing"; "a smooth logical flow
  of talk between civs"). Each button is something we say, the leader's answer becomes their words, and
  the buttons after it follow from it (`talkTopics`, `talkButtons` in renderer-api `audience.ts`, the talk's
  `TalkMemo`): nothing said already; nothing needing a treaty before one (maps, open borders); once the
  talk turns friendly (a treaty, a deal, a gift) no demand or war, once it turns hostile (a demand) no
  proposal or gift, so a refused demand leaves war or farewell; at war only peace and farewell. What we
  may say falls under three subjects: proposals (peace, `proposePeace`: yes, for `peacePrice` or no; a pact; an
  alliance; with Writing open borders, `bordersAnswer`; an exchange), gifts and demands (their units off our
  land, tribute, close borders, declare war or break the treaty). Tribute needs no Writing since 2026-11-02 (asked
  for: "add a demand tribute option for the player"; it waited for Writing before, so early on it was never offered),
  and the civ card has it too, Demand tribute in red out of war beside Talk (the web app's `demandTribute`, shared by
  both: the AI's `tributeOffer`, a leader under half our strength paying a share of its treasury once in 20 turns, the
  rest refusing). Writing and Trade stand for
  the knowledge that brings more to say (asked for 2026-10-24, "when get diplomacy tech add more diplomacy
  options, when get trade tech add trade options"; the tree has no Diplomacy, so Writing, the Diplomat's).
  Gifts (asked for 2026-10-31: "give gold - why? - replace with offer a gift (to improve relationship) with also
  other options") are always one button, Offer a gift (never spread), opening Gold (a tenth, a quarter or half our
  treasury, `giftAmounts`, thanked by its weight to them, `giftWeight` modest, generous from half their `goldScale`,
  lavish from 1.5, `giftThanks`), An advance (any of ours they lack) and with Currency A resource; with only gold to
  give it opens on the sums. Since save version 51 an advance or a resource given sways a leader as gold does
  (`recordGift` at `advanceWorth`: the beakers of their next advance; `resourceWorth`: half their `goldScale`;
  `GIFT_WORTH`), and a gift that leaves them a step warmer says so ("Our peoples draw closer."); saves before 51 load
  with `plainGifts` (only gold counts). An exchange (asked for the same day: "add exchange as a inner new section.
  were you can exchange several things with one another - gold, techs and resources. resources given could provide
  a steady income (+sum each turn) for a civ"; Make an exchange, among the proposals when there is something to
  trade, `exchangeGoods`): a table beside the leader's portrait (the card layout, `dealCard`: We offer, They give),
  the buttons We offer..., We ask for..., Propose, Back; each side's list by kind (Gold: sums and, for resources the
  other side gives, gold a turn, `perTurnAmounts`; Advances with Trade; Resources with Currency, theirs only the
  spares they would part with), picking one on the table taking it back (`dealItems`, `toggleDeal`). The leader
  answers by the AI's `exchangeAnswer` (`DEAL`: gold a turn as 12 turns of it, an advance it gives at half its worth,
  a resource it wants at its worth and one it has no use for at a quarter, a spare one it gives at half; wary asks a
  quarter more; never while hostile, never a resource it needs, never more gold a turn than its cities bring), and a
  deal too thin for it names the gold that would settle it, a button of its own ("Add 20 gold"). Agreed, the core
  `exchange` command hands everything over at once (`whyNoExchange`, `applyExchange` in core `exchange.ts`; our
  advances found as any, `discover`); each resource is a lasting trade, and gold a turn is paid by its receiver to
  its giver as the receiver's turn begins for as long as the trade stands (`ResourceTrade.pay`, `payTrades`, shared
  among the resources it pays for), a turn it cannot pay ending it (`tradeEnded` "unpaid"; `tradeIncome`). The old
  trades of knowledge and of resources are gone from the talk (core's `exchangeAdvances` stays for old logs).
  Up to four buttons, farewell last: a subject's topics stand as buttons where they fit, else the subject
  is one button ("Make a proposal", "Offer a gift", "Make demands") opening its list with the leader's
  question (`SUBJECT_WORDS`, by mood) and Back; the subject just talked of spreads first, so the talk keeps its
  thread. A question that wants our yes (their price, war: `warWarning`) has a button saying it ("Pay 50 gold",
  "Declare war!") and one saying no ("No", "Keep the peace"); the close box or Esc is no too. A declaration of war
  ends the talk on the leader's words and Farewell.
  A leader's answer stands in a window of its own over the audience (asked for 2026-11-05: "when leader answer - show it
  on a new modal on top of the original, with option to close all"; the web app's `leaderAnswer`): every reply to
  something we said, in a talk, on a civilization's card, at an exchange's table or to a leader's own demand, as the
  game's modal (a `menu` screen over the `diplomacy` one), titled with the leader (`leaderTitle`): their portrait and words,
  Continue and Close all. The portrait (asked for the same day: "show it with the leader image"; `MenuState.portrait`, by the
  name `LEADER_PORTRAITS` gives) is the user's picture as it is, whole, 64 pixels square (`PORTRAIT_PIC`) in the frame the
  square's window uses, sized now by what it holds (`frameOf`), on the setup cards' sky (`drawPortraitSky`, moved to widgets.ts
  for it); the apps lay it where `menuPortrait` says, growing with the window as it opens. The words stand beside it, in the
  middle of its height, in a window at least `PORTRAIT_WINDOW_W` (240) wide. Continue (Enter, Esc, the close box, a click off it) goes back to the talk, the answer now the audience's
  line and the next buttons under it; Close all leaves the talk at once, as Farewell does (the audience's `done`), so the
  turn's news goes on. An answer that asks something has its buttons in place of Continue ("Pay 50 gold" and "No", war's
  red "Declare war!" and "Keep the peace", the table's "Add 70 gold" and "Continue"), Close all still last, and one that
  ends the talk (war declared, our answer to a leader's demand) only Farewell. What a leader says opening a list ("Against
  whom...?", "How much?", the table's "What do you offer?") is no answer and stays in the audience window, which holds
  its choices. Under the window the audience stands as it was, the buttons just used drawn and dead (`spent` on the
  screen, `spendTalk`), darkened again (`MenuState.overWindow`: `dimScreen` runs once a frame, stacked windows sharing a
  backdrop, but here the window under must step back, the game behind it going darker still), and the leader's picture,
  which lies over the canvas and would cover the window, darkened with a hole where the window stands (`underWindow` in
  pictures.ts, `menuBox`, which grows with the window as it opens). An audience is new when the last frame drew none
  (`audienceFrame`): the top screen's kind told it before (`lastTop`), which restarted its opening every frame under
  any window, as it did under a New Technology window from an exchange. No save version: the rules are untouched.
  Greetings name admiration or scorn; after the envoy's treaty the talk starts friendly. The audience screen (redone
  2026-10-22 after the user's mock-up "Caesar Welcomes You to Rome", asked for; a window over the
  darkened map since 2026-10-24, "not 100% of the screen": `audienceRect` 264x186 centred, growing into
  place as a new audience opens, `DiplomacyView.enter` timed by the web app's `audienceKey`; the
  web app draws the map under it): the realm across the
  title strip (`realmName`: "The Roman Empire", Kingdom, Republic... by government) with a close box
  (`Renderer.diplomacyCloseAt`: Esc); the strip, the panel and the picture's frame take the leader's
  mood's colour with its word at the strip's left (asked for 2026-10-24: `DiplomacyView.mood`, the
  AI's `attitude`; `moodColours`: deep green FRIENDLY, amber WARY, dark red HOSTILE, navy with none),
  the user's picture of the
  leader in their palace whole, frame and all, then the leader's name, their words and our choices as
  the game's stone buttons (`DiplomacyView`, `Renderer.diplomacy` and
  `diplomacyChoiceAt`): never more than `AUDIENCE_CHOICES` (4, asked for) at once, so the proposals
  are grouped into screens (the X or Esc goes back), and long lists (their advances) page with More... (`talkMenu`,
  `pagedChoices` in the web app; arrows, Enter or 1-4 pick, Esc steps back, the pointer lights a button;
  a talk with no choices, a war declared on us, closes on any of them).
  The pictures are shown as they are, full size and true colour (asked for, 2026-10-22: squeezed into the
  palette at 224x126 they looked "bad and distorted"): `apps/web/src/scenes/<leader>.webp` (the PNGs as
  supplied, WebP quality 92), laid over the canvas as an <img> by `pictures.ts` (`showPictures`, once a
  frame from each retro adapter's `present`; they let clicks through; one element per picture, made and
  decoded by the preloads and shown only once decoded: a reused element given a new `src` kept painting
  the last leader met for a moment, 2026-10-23) in the room the screen leaves for
  them (`audiencePicture(screenW)` in renderer-retro, 192x108 in the window, `cardPicture` for a card's
  portrait; laid from the window's first frame, growing with it, `diplomacyPicture`, renderer-retro `enteringBox`;
  asked for 2026-10-31: the room showed "a bluish color" while the window grew, the picture laid only once it stood
  whole; beneath the palace the darkest stone, seen only until it loads, a card's portrait standing on a dusk sky;
  the leaders' portraits preloaded with their palaces, `preloadScenes`);
  `Renderer.prepare` preloads a game's leaders as it starts or loads. With the setup's portraits
  and the advances' pictures (`techs/<advance>.webp`, 1254 square, WebP quality 92; `techPicture`: all but
  the 1991 tree's Future Tech., which shows the frame's bed; each adapter's `main` fetches the picture
  of the research under way, `preloadTech`) and the spaceship parts' (`buildings/<id>.webp`, 1254 square, WebP quality
  92; laid at the screen's `Surface.art` spots with the sheets' PNGs; `preloadBuildings` fetches what our cities are building), and the
  units' (`units/<id>.png`, see Unit pictures below), the only things the retro look does not draw through the palette. The phone app caches each picture when first shown,
  not at install (`.webp` left out of sw.js's list). An envoy's offer (`peaceOfferAudience`) is signed or refused; signing goes on
  into an audience. Past six rivals (up to nine, since 2026-11-05) the Foreign Minister gives each a line, leader and regard left to their
  cards, and the race for space on the Spaceship page takes two columns. The Foreign Minister shows the standing (`standing`), each civ's influence and
  whether they admire or scorn us (`regardWords`); Enter there opens a civilization's card. Stepping onto land that minds us puts a
  note beside the unit ("Babylonian land: leave by next turn", `landNote`); once a demand stands, a step in
  (once a civ a turn, later steps get a callout) and the AI's demands after its turn show our unit, then the
  leader asks us out (`askToLeave`: leave = gotos to the nearest square outside, `stayPrice` gold, or stay); an AI declaring war on us says so in an audience.
  A leader's demand or request comes as an audience after its turn (`proposalAudience`: "Pay 80 gold" while we
  have it, or "Make the trade", and Refuse; the close box refuses), and its gift as one with its words
  (`giftAudience`).
- `apps/mobile` — the web game as a PWA for phones and tablets, asked for without changing the web game:
  `src/main.ts` imports `apps/web/src/main.ts` as it is, and `vite.config.ts` (`webGame`) hands that file
  three stand-ins for its own modules: `display.ts` (the screen as wide as the phone held sideways allows,
  `screenWidth`: 320 to 480 logical by 200, as large as it fits in the safe area, `layout.ts`; no buttons
  beside it, asked for: minimum UI; `toLogical` from the canvas rect at any scale), `renderer.ts` (its own
  retro adapter: the map's screen on a surface that wide, the panel at the left, the menu bar across, the
  viewport taking the rest, `viewAcross` in renderer-retro; every other screen on the original's 320x200 in
  the middle, its hit tests shifted by that inset, `narrowPoint`; menus and prompts over the map centre on
  the whole width; the map drawn and hit-tested through `MapPan`: a finger's drag, let go when the game
  moves its camera, the active unit changes or a key is pressed on the map; zoomed by a pinch,
  `MainScreenView.zoom` 1-3 kept in localStorage; `width`, `viewTilesX`/`viewTilesY` getters that follow
  the phone and the zoom so the game centres and follows in what shows; taps mapped back with
  `unzoomPoint`; keeps the frame's `TextInputState`) and `storage.ts` (same slots; remembers the last
  autosave so `save.ts` can save the turn so far when the page is hidden). Keep those three web modules'
  exports as they are (each stand-in `satisfies` its web counterpart's type). It reads `window.civ`
  (`screen`, `state`, `log`, `menu`) from web main.ts: keep that hook. Sideways only (asked for): the manifest
  asks for landscape, `touch.ts` locks it where the browser lets a page, and held upright index.html shows
  "Turn your phone sideways" over the game (only where the pointer is coarse).
  The deployed site (Netlify) is this app, so a desktop browser plays it too, with a mouse: there (the device's main
  pointer fine, `fingers()` in its renderer, `matchMedia("(pointer: coarse)")` read live) every menu keeps the web
  game's `DESK_MENU` rows, with no large setup buttons and no Choose button on the setup cards (asked for 2026-10-31:
  "on prod web - show huge menus like its mobile"). Everything below about finger-sized menus holds where fingers play.
  Menus are sized for a finger (asked for 2026-10-25: "some menus are too small and hard to click",
  the web game unchanged): its renderer hands `TOUCH_MENU` (widgets.ts `MenuSize`) to `drawMenu`,
  `menuHit`, `menuRows`, `menuScrollAt` and `menuRect`, whose default is the original's `DESK_MENU`
  (pixel for pixel as before). Its words are twice the font's size (asked for the same day: "only on
  mobile - enlarge default font size", for windows and menus only: the map's panel, the city screen,
  the research panel, the advisors and the New Technology, Building Completed and audience windows
  keep the font's size): `MenuSize.text` 2 draws labels and paragraphs with `drawTextLarge`, the icons
  among them doubled (`drawIconLarge`, `drawIconLine`'s `scale`), the title in a taller strip
  (`TITLE_H_LARGE`, `drawWindow`'s `scale`), rows 19, buttons 22 tall and 80 wide, windows up to 92% of
  the screen; a window that would run off the screen so falls back to `TOUCH_MENU_SMALL` (the font's
  size, rows 15, buttons 19, a scroll bar 10 wide either way);
  a drag over a list too long for its window scrolls its rows (`scrollRows` in renderer-api, the choice
  staying on view). Where they fit, menus are stone buttons instead (renderer-retro `screens/choices.ts`,
  `drawChoices`/`choiceAt`/`choicesRect`; asked for the same day, "more on the starting game options"):
  every menu over the title screen (the title menu and the setup questions: civilizations, world, size,
  starts, the four customize questions) a column of large buttons with labels twice the font
  (`SETUP_CHOICES`, `drawButton`'s `scale`), and a unit's orders a grid two or three across
  (`ORDER_CHOICES`, large words, falling back to `ORDER_CHOICES_SMALL`), placed above the unit, else
  below, else beside it; ten load slots, or anything with
  text, stay rows. The setup cards (difficulty, tribe) get a Choose button in their panel
  (`drawSetupChoose`, `setupChooseAt`): a tap lights a card, Choose or a second tap picks it. The
  research panel, the city screen and the audience keep their sizes.
  On the city screen a tap on one of its six boxes (renderer-retro `CITY_BOXES`: resources, map, improvements,
  food, units, production) enlarges it (asked for 2026-10-27: "on mobile only - inside the city view - when
  click on an box area - enlarge it to see it bigger"): `drawCityZoom` lays the 320x200 screen on the wide one,
  darkened, and the box over its middle twice its size (`cityZoomPlace`: whole times, so each fine pixel a
  block), its pictures grown with it and the ones it covers hidden, a close box above its corner. The adapter
  maps points on it back to the screen's (`cityZoomPoint`, its city hit tests), so its buttons, lines, units and
  squares answer there; `touch.ts` passes a tap on it to the game only where something answers
  (`cityAnswersAt`: the game leaves the city on a click on nothing), closes it on a tap off it, and scrolls an
  enlarged list that much further a line (`cityZoomScale`). Windows opened over it darken it in turn and leave
  it standing; it goes with the city screen. The title row (close box, View, Happy, citizens) answers at once.
  `touch.ts` turns fingers (`gestures.ts`) into the mouse the game knows: tap = mousedown 0, hold 450 ms
  = mousedown 2, drag = pan or the research list's wheel; mouse pointers are left to the browser. On the map
  (since the game's mouse moves units with the right button, 2026-10-27) a tap with a unit in play on a square
  holding no city or unit of ours is the right button (`moveTap`: a step, or the route and a second tap
  sending it; the dragged view stays), a hold on our city or units with the unit in play elsewhere is the
  right button too (moving it in, joining them), and a hold anywhere else Shift + the right button (the
  square's window). A tap or a
  held finger (asked for 2026-10-25) on our units' square (not a city, where a held finger opens only the
  orders of the unit in play standing there) brings one into play as the game would and opens its orders
  (the game's Esc) just above it (`ordersAbove`: the next menu drawn is anchored over the unit, without its key
  column). What the game takes from keys only is a touch there: a rates bar (`ratesAt` in renderer-retro,
  given the wide width when the window stands over the wide map) sets that rate by arrow keys (`rates.ts`), a tap on a launchable spaceship is Enter, a hold on a city
  screen is N (rename). `text.ts` shows a DOM field while the game asks for text, bound to the game's
  `TextInputState`, OK/Cancel = Enter/Esc. The phone's menu bar (`menu-bar.ts` rewrites renderer-api's
  `MENU_BAR` as it loads, failing the build if that list changes shape) has no Orders, and a production
  build no Debug either (the dev server keeps it); the web game finds its menus by name, though its Alt
  keys count places. The build writes `sw.js` from `service-worker.js` (every file precached under a
  content hash; pages network-first, `ignoreVary`). `base: "./"`, so the build plays from any folder.
- `tools/headless` — tournament harness: `runGame(config)` plays an `allAi` game through `runAiPlayers`, samples
  per-civ stats, fingerprints the final state; `AIS` registry seats a named AI per civ. `cli.ts` prints tables.
- `tools/maps` — premade-world builder: `frames.ts` (lon/lat → grid breakpoints per world, homelands, lines of sea and land,
  islands enlarged), `climate.ts` (Natural Earth regions and hand zones → terrain mixes), `build.ts` (rasterise, rivers,
  homelands: the site, then its ground cleared up to `HOMELAND`), `legacy/` (grids old saves played on, frozen, never rebuilt),
  `places.ts` (real names: Natural Earth's lakes, deserts, ranges, plateaus, basins, islands and continents,
  hand outlines for the seas and oceans (`WATERS`: the cache has no marine data; the smaller sea first, the
  oceans last) and some forests, ice sheets and marshes (`LANDFORMS`, named `HAND_ZONES`); a square takes
  the most important place covering it (scale rank, then the smaller), leftover water the nearest name
  across the water, a landform's squares the nearest within two steps, land the nearest on its landmass;
  `NAMED` puts names better than the data's). The report counts the places and the squares left unnamed.
  Regional worlds still wrap east-west; their column 0 is forced to sea so the wrap joins no coasts by land.
- `scripts/mirror-test.sh` — for a Linux shell on a Mac checkout; not needed on macOS.

