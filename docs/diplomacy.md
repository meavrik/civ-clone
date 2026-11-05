# Diplomacy

Civilization traits, diplomacy, land and culture, trespass, gold between civs, pacts and alliances. Moved word for word from CLAUDE.md, so "above" and "below" may point to another file here: search `docs/` for the name.

  Civilization traits (our departure, asked for: the original's civs were alike): each `CivRule.trait`
  in `rules/civs.ts` has a name, a few words for the tribe choice (`short`), a line of text, an
  advance it starts with (a root advance) and `TraitEffect`s (cheaper builds, faster settler jobs,
  science/tax/corruption, content, growth (food kept, smaller food box), veterans, moves, short
  anarchy, friendly villages). `traits.ts` answers each kind; `costFor` is a production's cost for its owner (use it, not
  `productionCost`, for anything a city pays). `classicCivs` (old saves before version 5,
  `?civs=classic`, `--classic-civs`) turns them all off. Tests of base rules play classic civs.
  Each civ also has `CivRule.text`, the people in a sentence of our own, and a `veteran`/`moves` effect
  naming unit types carries `who` ("Foot soldiers") for the words.
  Diplomacy (`diplomacy.ts`): civilizations meet face to face (`contactRange` 1, as the original), and
  the unit that walked into the meeting stops for the turn, on a goto too (`meetAround`), so each side
  sees whom it met; a civilization sees its land and a square beyond it (Sight below). Meeting leaves them in contact, no treaty
  (`Relation` "contact", `metRelation`; asked for 2026-10-20): neither may attack before `declareWar`,
  and `openBorders`/`shareMaps` wait for a peace treaty (`makePeace`, `atPeace`); a computer leader's
  envoy offers one with `offerPeace` (`state.peaceOffers`, a `peaceOffer` event the player answers with
  `makePeace` or not at all). Influence (asked for): `civInfluence` is the culture of all a civ's cities;
  `esteem(judge, of)` weighs it against the judge's own (`INFLUENCE` in `rules/culture.ts`: admired at 1.5x,
  scorned at half, both sides counting 10 more), and the AI's `attitude` reads it. Saves before version 15
  load with `peaceOnContact` (meeting made peace at once). Land (`territory.ts`: `claims`, `landOwner`):
  each city the squares within its border, which grows with its culture (`borderRadius`: 1 square out
  when founded, one more at each of `CULTURE.levels` in `rules/culture.ts`, radius 2 being the 21 squares
  it works); a shared square goes to the nearer city, then the one with more culture, then the older
  (`claimant` names the city, `landOwner` its owner). The levels are 4, 12, 24, 40 since save version
  28 (asked for 2026-10-24, "unbalanced city and culture growth": the first levels, 8/16/28/45, kept a
  young city to its 8 squares until size six with a temple, which starved it; now the capital has its 21
  squares at size three (its palace's 1 culture), another city at size four, or two with a temple; saves before 28 load
  with `slowCulture`, headless `--slow-culture`; 6 planner games x 250 turns: pop 47 vs 40 a seat,
  techs 25.7 vs 22.5, score 142 vs 112). Until save version 36 the palace gave 3, so the capital had its 21
  squares the day it was founded (asked for 2026-10-27: "influence growth at first city is instant - shouldnt
  be"; saves before 36 load with `wideCapital`, `CULTURE.widePalace`, headless `--wide-capital`; read a
  building's culture with `buildingCulture`). Influence yields (same version; asked for: "whales or other
  resources can't be reached by a city, so think of other value they can provide when in the city
  influence"): a special inside a city's border but beyond the 21 squares it can work (whales in deep
  water, anything in its outer rings), claimed by that city and worked by no one, brings it half the
  resource's trade a turn, at least one (`influenceSpecials`, `INFLUENCE_YIELD`, `CityReport.influence`;
  the city screen's "Influence +N" line, the square's window "In Rome's influence: +1 trade"); nothing
  before the border reaches 3 squares out; saves before 28 load with `noInfluenceYields` (headless
  `--no-influence-yields`).
  A city's culture is what it holds now (`cityCulture`: one per citizen, `BuildingRule.culture` from palace,
  temple, library, courthouse, colosseum, cathedral and university, and each wonder), never more turn after
  turn (asked for), so it falls when the city shrinks or loses a building; a `borders` city event says when
  the border grows; the city screen shows culture against the next level. A city works only squares of
  its own land (asked for 2026-10-21; `slotInLand`: within its border, on land its civilization holds, so a
  new city has the 8 round it until its culture reaches the first level); `slotAvailable` and both AI
  planners' `slotFree` read it, `dropLostSquares` moves workers off squares lost since as the owner's turn
  begins, and the city screen shades the squares beyond and rings the city's land in its owner's colour
  (a click there says "Beyond Rome's border"). Saves before version 16 load with `workBeyondBorders`
  (headless `--work-beyond-borders`). Head to head (planner vs v2, 16 x 300 turns): old rule 9-7, score 144 vs
  131, pop 59 vs 51; new rule 12-4, score 129 vs 94, pop 49 vs 36 (cities grow slower; v2 suffers more).
  Saves before version 14 load with
  `accruedCulture`: `City.culture` gathered every turn (`cultureRate`, frozen numbers in `ACCRUED_CULTURE`). Met and not at war, without open borders
  (`openBorders`/`closeBorders` commands, `state.openBorders`) a civilization minds land units on its
  land (`trespassOn`: not diplomats, caravans or units aboard): stepping in, or being found there as the
  owner's turn begins, notes the units (`noteTrespass`: `state.trespass` with `warnings` 0, a `trespass`
  event), and they have a turn to leave before the first demand (asked for 2026-10-27: "wait for another turn
  before asking to go away"; saves before version 37 load with `askOnEntry`: stepping in was the first
  demand); `demandLeave` adds one, a gift (`giveGold`) forgives, and the record drops at the owner's turn once
  the units are gone. Other deals: `tribute` (`tributePaid`); `shareMaps` stays for the logs that hold it (the
  audience no longer offers maps, asked for the same day). Gold between civilizations (same day: every gift
  and price was 50 gold, "make the money tribute more sophisticated"; `rules/diplomacy.ts`): what gold is worth
  to a realm (`goldScale`: 20, half its treasury, 5 a citizen) prices the leaders' deals and weighs gifts;
  `giveGold` keeps each gift (`state.gifts`, `recordGift`: gold and its share of the receiver's worth), and gifts
  within `GOODWILL.turns` (20) worth half its worth all told leave its leader a step warmer (`goodwill`, read by
  the AI's `attitude`; saves before 37 load with `noGoodwill`). The AI never gives gold, so neither changes
  all-AI games (planner vs v2, 16 x 300: identical, 3-13, score 140 vs 199). A computer leader's demands and
  requests (asked for 2026-10-27: "let computer leaders use the new diplomacy on you"): its `demandTribute` and
  `askResource` commands leave a `Proposal` standing (`state.proposals`, "asker>asked"; a `proposal` event;
  `state.asked` spaces them), which the player answers with `answer` (yes: the tribute paid, `tributePaid`, or the
  resource traded and their gold taken; no: a refused tribute is kept, `state.refusals`); an unanswered one lapses
  as the asker's next turn begins. `giveGold` says so (`gift` event). Saves before version 38 load with
  `quietLeaders`. `warDeclared` says who declared on whom (`on`) and why (`reason`: trespass, tribute, alliance).
  Pacts and alliances (asked for 2026-10-29: "add alliance against other civ option", "add a non-aggression pact
  option"; save version 41, `PACTS` in `rules/diplomacy.ts`): a non-aggression pact (`makePact`, `state.pacts`:
  the turn it runs out, `pactUntil`/`hasPact`) bars war on either side for `PACTS.pactTurns` (20), then ends with
  a `pactEnded` event as a turn begins (`endPacts`); an alliance (`ally`, `state.alliances`: `Alliance.against`)
  makes a treaty between the two if they had none and takes whichever of them is not yet at war with the enemy
  to war (`warDeclared` reason alliance); allies may not declare war on each other and do not mind each other's
  units (`mindsTrespass`), and a separate peace with the enemy ends the alliance (`leaveAlliances`, the
  `allianceEnded` event; the web app's `makePeaceWith` says so), as does the enemy's fall. `declareWar` is
  refused while either binds (`warBarred`: "pact", "allied"). Only the player proposes them, in an audience's
  proposals ("Non-aggression pact", "Alliance against..." then the enemy, from those both know and the player
  may make war on: `allianceTargets`); the AI answers (`pactAnswer`: yes unless hostile or at war, for
  nothing; `allianceAnswer`/`allianceRefusal`: no when hostile, bound to the enemy, at peace with it by treaty
  and not friendly, or not yet at war with it while the two together are weaker; else yes if already at war
  with it, friendly yes, wary for `alliancePrice` gold), keeps an alliance (no separate peace: `acceptsPeace`
  and its own peace-making pass the enemy by), counts an ally a step warmer (`attitude`), and passes bound
  civs by for wars of choice. Computer pairs never make either, so all-AI games are unchanged.
  Saves before version 10 load with `farContact` and `noTrespass` (meeting at two squares, no stop),
  saves before version 12 with `fixedBorders` (each city its 21 squares, the nearer then older winning).
