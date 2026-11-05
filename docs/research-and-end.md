# Research and end

Research list and panel, opening window, end screen, New Technology window. Moved word for word from CLAUDE.md, so "above" and "below" may point to another file here: search `docs/` for the name.

  Research list (asked for 2026-11-03, after two redesigns of the research panel were turned down and reverted, "very
  BAD. revert all ... start from the start - a basic simple tech list - like the original civ1 game"): research is
  picked from a plain game menu, the web app's `openResearchList`: the advances that can be researched now in the
  tree's order, "Wise men ask: what shall we research?" (or "Researching Writing: 5 turns left", its row "under way"),
  after each name small pictures of what it unlocks (asked for: "just icons small"; `MenuState.trail`, renderer-api
  `techPictures`: the government's crown, wonders, buildings and spaceship parts, units; retro draws them 14x12 in a
  column past the longest name, rows 14 high, `drawSmallPicture` in widgets.ts) and an info mark at the row's end
  (`MenuState.info`, the build menu's mark) that opens the window of more about the advance (the menu `Screen`'s
  `onInfo`, no tip; I too). A click or Enter researches the row; while research is due the list cannot be left
  without a pick (Esc or a click off it leave it standing). A list with pictures after its words or info marks is
  never buttons (`menuButtons`). It opens wherever research is picked: after the New Technology windows when research
  is due, science advisor A, Advisors > Research, the status panel's research row. The advance window (renderer-api
  `advance-info.ts`, `advanceInfo`; retro `screens/advance-info.ts`, `drawAdvanceInfo`/`advanceInfoHit`,
  `Renderer.advanceInfo`; the web app's `advanceInfo` screen over the list, which it goes back to): the New
  Technology window's parchment and gold, 288x184, the advance's name in the title strip, the user's picture of it in
  a gold frame (`advanceInfoPicture`), Description (`AdvanceRule.text`, its era and what it needs, where it stands for
  us), History (`AdvanceRule.history`, a few sentences of our own each, plain ASCII, three lines at most:
  core `rules/advance-history.ts`), Unlocks (every gift with its small picture, units with their attack, defence and
  moves, then the other gains a line each with their icons; two columns past three) and Leads to (each advance with
  what else it waits for; past four, their names as one list). The close box, Esc, Enter or a click off it go back.
  Modern draws it as a plain modal.
  Research panel (`research.ts`; redesigned 2026-10-20, asked for: the old tier graph was confusing and
  disliked, so it is gone; a window over the screen it opened on since 2026-10-24, "should not take 100%
  of the screen": `researchRect` 300x188 centred, the game darkened behind, 15 list rows, its parts laid
  from `layout(screenW)`, `researchHit` taking the screen's width for the phone's wide map; the web app
  draws the screen's `back` under it): built round the choice. Under the title a band with the research under way
  (bulb, beaker bar, turns) or what the advance just found brings (`researchBand`); on the left a list
  (`researchRows`) of three groups: Research next (the research under way first, then what the latest
  find brought within reach, marked with a yellow diamond, then the rest; each row with icons of what it
  brings, `techIcons`), Coming later (`comesLater`: everything it needs is known or can be researched now;
  the hint of what lies ahead, faint) and Discovered (ticked, newest first); it scrolls (`ResearchView.top`,
  `keepResearchInView`, `Renderer.researchListRows`). On the right a card for the selected advance
  (`techDetails`): its standing ("Discovered", "Researching", "Can research now", "Later: needs ...
  first"), what it brings, what it needs and what it opens the way to (each with what else it waits for,
  "with Mysticism" or "then ready"), all links to their own cards, and along its bottom the city view's
  pictures of its wonders and buildings and its units' sprites where there is room. The Research button
  studies `researchTarget`: the advance, or for one further on the first step toward it. Keys: Up/Down,
  PgUp/PgDn, Home/End, Tab (the next choice), Enter, Esc. `Renderer.research`/`researchHit`. Since 2026-11-03 the
  web app opens it (`openTree`) only from the New Technology window's View Tech Tree; research is picked from the
  research list above everywhere else. When research is due it closes only on a pick.
  Opening window (`reign.ts` in renderer-api and renderer-retro; asked for 2026-10-26: "improve the
  starting game first message ... add civ image + short description and civ bonuses", in place of a plain
  message with the trait's line): a new game opens on the map with "A New Civilization", the New
  Technology window's parchment and gold a little larger (248x151, `reignRect`), centred over the darkened
  map: the people's name large over their leader and the year, the leader's setup portrait (the user's
  picture, laid at `reignPicture` on the setup cards' sky, `drawPortraitSky`) in a gold frame ringed in the
  civ's colour, The People (`CivRule.text`, three lines at most) and, under the trait's name, its bonuses a
  line each with an icon (`reignCard`, `traitBonuses`/`bonusLine`: numbers from the `TraitEffect`s, then
  "Starts knowing ..."; classic civs say every people is alike); Begin (Enter, Space, Esc, the close box).
  `Renderer.reign`/`reignHit`; the web app's `reign` screen, the "lead the ... to glory" line after it.
  End screen (`chronicle.ts` in renderer-api and core; asked for 2026-10-29: the screen of a fallen civilization
  showed its ruin, its score sheet empty, "need to show all the achievements of the entire civ history"): core keeps
  each civilization's history as it plays (`Player.chronicle`, `chronicleOf`; save version 44, bookkeeping no rule
  or AI reads, so old logs replay and build it): cities founded (`foundCity`), taken and lost (`captureCity`, a
  diplomat's incited revolt), fights won and lost (`resolveCombat`), units raised and wonders completed (the city's
  turn), the most cities and citizens it held and its best score with its turn (`notePeaks`, as its turn ends), and
  the turns of its first city and its fall (`checkElimination`). `endCard` lays out the end: the title (Victory,
  Civilization Fallen, The End), how it ended, the years of the reign ("The Romans, 3980 BC to 1250 AD"), ten rows
  of that history in two columns (icon, name, number), the wonders, and the verdict: the final score and rank, or
  for a fallen civilization the rank at its height ("At its height, your rule was Great."). `Renderer.end(card)`;
  retro `drawEndScreen` in `screens/title.ts`, modern a plain page.
  No tutorial: the one added 2026-10-27 (nine one-sentence tips in a window as each came due) was removed
  2026-10-31, asked for: "tutorial is bad - remove completly".
  New Technology window (`newtech.ts`; asked for 2026-10-23 with the user's template and a picture for
  each advance): every advance found (end of turn, village, diplomat, treaty, Debug) gets one, in turn
  (`announce` in the web app), before the research panel; a small window over the game since 2026-10-24
  (`modalRect`, 236x147, centred on the screen it opens over, which the web app draws first: the
  screen's `back`; the Building Completed window shares the frame, smaller: `builtRect`). Windows grow into place as
  they open (asked for 2026-10-24, "animate window modals entrance"): `WINDOW_ENTER_MS` (160) from two
  fifths of their size, `enter` 0..1 on `NewTechView`, `BuiltView` and `MenuState` (the web app's
  `enterOf`, timed from the window's first frame; dropdowns never), retro's `drawEntering` drawing the
  whole window on a scratch screen and laying it on grown about its centre; the user's pictures wait for
  the window to stand whole. A navy title strip (bulb,
  NEW TECHNOLOGY, close box), the name large over its era, the user's picture of the advance in a gold
  frame, then parchment panels: Description (`AdvanceRule.text`, a sentence of our own; `era` from `ERAS`,
  ours too) with "Needs ..." under it, Unlocks (`newTechCard`: the research card's gifts, one or two in
  their boxes with names, more as a line of names; "Leads to" the next advances when it brings nothing
  itself); View Tech Tree (the panel on that advance's card) and
  Continue (the next window, else the panel when research is due, else back). Left/Right/Tab, Enter (not
  held), T, Esc; the pointer lights a button. `Renderer.newTech`/`newTechHit`; retro draws it in
  `screens/newtech.ts` (`newTechPicture(screenW)` is where the picture goes), modern as a plain modal.
  The adapters drop the pictures of the screen under a small window (they would cover it), and the
  phone draws it on whichever surface is under it, the wide map's or a 320x200 screen's.
