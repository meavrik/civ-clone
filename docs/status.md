# Status

What has been done, by date. Moved word for word from CLAUDE.md, so "above" and "below" may point to another file here: search `docs/` for the name.

## Status

Phases 1–7 done: world, cities, tech/wonders/governments, combat/transport/goto, multi-civ
turns, diplomacy, save/load, title/setup, advisors, end conditions, headless harness, planner AI.
Rules-completeness pass done (2026-10-16): data verified against FreeCiv civ1, all wonders bound,
caravans, railroads/fortresses/pollution/global warming, spaceship, diplomats, nukes, in-game text
prompt. Phase 8 done: modern-visuals renderer behind the shared `Renderer` API (set aside
2026-10-19, asked for: the app draws retro only; the package keeps building and passing its tests). Premade worlds done: Earth, Europe, Middle East (title menu "Play on a premade world", optional
historical homelands: only native tribes offered, rivals drawn from natives preferring non-overlapping
homelands, starts nudged 3+ squares apart) and "Customize world" (land/temperature/climate/age). 20 civs
(the original's 14 plus Spanish, Vikings, Hittites, Persians, and, asked for, Hebrews (Exodus: faster
settlers; Jerusalem) and Japanese (Bushido: veteran horsemen; Kyoto, two hill squares on Earth's coarse
grid)). A civ added later carries `since` (the save version that brought it); saves before version 11
load with `roster: 10`, so their rivals come from the 18 they were drawn from. Barbarians done (2026-10-17): uprisings and
sea raids with leaders and ransom, barbarian-held cities, pillage. Civilization traits done (2026-10-17):
one ability and one starting advance per civ, shown at the tribe choice, the opening window (with the
leader's portrait and a sentence on the people since 2026-10-26) and World > Civilizations. Extended tech tree done (2026-10-18, asked for): Weaving (after Pottery; ends arctic wear, and tundra's since save version 68, in place of Medicine), Animal Husbandry (a root; Horseback Riding needs it; +1 food from Horses, Game and
Seals for its owner, `special.learned`), and five modern advances in place of Future Tech. (The Internet,
Mobile Phones, Renewable Energy, Artificial Intelligence, Quantum Computing), each unlocking an
improvement built from existing effects (Data Center, Cell Tower, Solar Plant, Automated Office,
Quantum Lab). `ADVANCES` is that tree; `CLASSIC_ADVANCES` the 1991 one, kept by saves before version 9
(`classicAdvances`); reach the right one with `advancesFor(state)`, never `ADVANCES` directly in rules
code. `tileYield` takes the working civ (`owner`) for the pasture food. Borders and contact done (2026-10-18,
asked for): civs meet face to face and the map shows whom we met before the audience; the audience
offers open borders, maps, knowledge, gifts, tribute and war; civs at peace without open borders ask
the player's units off their land, warn once more, then go to war (our departure: the original had no
borders). Culture borders done (2026-10-19, asked for): borders start a square round each city and grow
with its culture (save version 12); since 2026-10-20 (asked for, save version 14) culture is what a city's
people, buildings and wonders make it, not gathered every turn. Peace treaties and influence done
(2026-10-20, asked for: "exchange maps and open borders only after peace; total civ influence should
affect how other civs treat the player"): meeting leaves no treaty, maps and borders need peace,
computer leaders weigh the player's influence (save version 15). World sizes done (2026-10-19, asked for: premade maps felt small):
small 80x50, medium 120x75, large 160x100 for premade and customized worlds; no save version (a save
without `size` is small). Islands kept apart on premade worlds at every size (2026-10-19, asked for;
save version 13). Mobile PWA done (2026-10-19, asked for, apps/web untouched): touch, on-screen
pad and keys, map drag, keyboard prompt, save on hide, offline service worker, icons; checked in desktop
Chrome with simulated touches, not yet on a phone. Moods done (2026-10-21, asked for: "analyze happiness
against the original, show unhappiness on the city, units inside the city"): the reckoning stage by stage
with a Happy panel, martial law by government, weariness souring the happy, FreeCiv's empire-size rule,
celebrations with their government bonuses, a Democracy toppled by lasting riots, mood flags on the map
(save version 17, `simpleMoods` for older saves). Production changes reckoned from the turn's box
(2026-10-21, after the user found the build menu's turns baffling; save version 21). Fine art merged (2026-10-21, asked for): branch
terrain-tiles-test, the whole map at 32 fine pixels a square (terrain, units, resources, cities, icons,
text), second special resources with reaches (save version 20; the branch's own 17-19 are mapped in
`loadSave`, a 17 counting as main's). Strategic resources done (2026-10-27, asked for; save version 33, see core above):
units that need Horses, Iron, Saltpeter, Coal or Oil on the civ's land or traded, deposits on new worlds, trades in the
audience and between computer civs. Iron, Saltpeter and Oil hidden from a civ until their advance (2026-10-28, asked
for; save version 40), told on the map as they appear. Seafaring (Harbour, Explorer, Fishing Boat), Archery
(Archers) and War Elephants on the Elephants resource done (2026-11-01, asked for; save version 53), the units' pictures
the user's. Oil at sea and the Fishing Boat's oil rigs done (2026-11-01, asked for; save version 55), drawn in code until
the user's pictures come. Roads, irrigation and mines take twice the original's turns (2026-11-01, asked for; save
version 56). Specials of a kind kept three squares apart (2026-11-01, asked for; save version 57). The sea yields 1 trade, the
Harbour adding the second (2026-11-02, asked for; save version 58). The web game's map squares are 20 pixels, its zoom
16, 20 or 24 drawn at each size (three levels since 2026-11-03), with + and - on the map (2026-11-02, asked for; no save version; the phone keeps 16).
The terrain drawn from the user's second sheet, forests and mountains in kinds by the land round them (2026-11-02,
asked for; no save version). Villages drawn as the user's five huts, the kind by the land (2026-11-02, asked for); a unit
walking into one sacks it before it opens, its loot bursting out (2026-11-02, asked for; no save version).
Tile improvements drawn as the user's sheet: fields, mines and quarries, oil pumps, rigs, nets and piers as its
pictures, bridges in its woods, roads thin and muted (2026-11-02, asked for). War Elephants climb mountains without a road,
as settlers and explorers do (2026-11-02, asked for; save version 59). A fishery on Fish adds a shield as well as its food
(2026-11-02, asked for; save version 60). Herds: Sheep, Camels and Bison as bonus resources that Animal Husbandry tames
and, Sheep's wool, Weaving spins, with the user's updated sheet of resources (2026-11-03, asked for; save version 61);
the same day the resources became the user's pictures as they are, laid over the canvas (asked for: "USE AS IS!!"), and
Ivory left the game (asked for; save version 62). City-states' raiders pillage, hunt units in the open and lay waste a
city they cannot storm, never fortifying in the field, and what a city-state is is told once a game (2026-11-03, asked
for; save version 63). The status panel shows only the treasury, not the rates, its money a shell, a coin with Currency,
paper with The Corporation (2026-11-04, asked for; no save version). A city goes on with a finished fighting unit without
asking (2026-11-04, asked for; save version 64). Old units give way to their successors once those can be built, resources
and all, and caravans trade at garrisoned foreign cities (2026-11-04, asked for; save version 65). Citizens placed
automatically keep a city growing and making something where its land allows (2026-11-04, asked for; save version 66).
A tribe in a fifth of the villages joins its finder as a city on good land, else Settlers, as the original had it and
Civilization II after it (2026-11-04, asked for; save version 67). Tundra wears units down until Weaving, at the desert's
10%, and Reindeer roam it, its only shields, drawn as the Game's deer until their own picture comes; a resource still hidden
from a civilization no longer spares its units wear (2026-11-04, asked for; save version 68). Any two specials lie three
squares apart, whatever their kind, the land's kinds taking turns for the room (2026-11-04, asked for; save version 69). The 27 improvements drawn as the user's sheet, the Harbour's picture with them (2026-11-04, asked for; no save version).
The 21 wonders drawn as the user's sheets, each with its stages of construction in the city view and going up through them
in fast forward as it is completed (2026-11-04, asked for; no save version).
The city view is an isometric town on the real land round the city, in the manner of the user's terrain sheet: streets, a town
square, walls and a gatehouse, patchwork fields, faceted mountains, shores and rivers, and the user's 24 houses standing apart by the
people's age, size and advances (2026-11-05, asked for; no save version).
A leader's answer stands in a window of its own over the audience, with their portrait, Continue and Close all (2026-11-05, asked
for; no save version). Coal stays off the map until Steam Engine, the Ironclad's advance (2026-11-05, asked for; save version 70).
City-states keep a garrison and one band of three, which sets out whole, marches on the nearest city and attacks at any odds, no
longer roaming round the player's cities, and a band's moves play together (2026-11-05, asked for; save version 71).
A river runs behind the trees of forests, the palms of jungles, hills and mountains (2026-11-05, asked for; no save version).
The square's window: the yields in the words' size, and what is built on a square shown by its map token in every panel, moves, defence and land on the same
token, an arrow, a rook and a pennant (2026-11-05, asked for; no save version).
Up to ten civilizations (2026-11-05, asked for; save version 72): each premade world seats what it can hold, custom maps by size, two new colours with
their shields, homelands kept apart, the Foreign Minister and the race for space fit nine rivals, and the other civilizations move a slice of each frame so the page never freezes.
The premade worlds' coasts and homelands redrawn (2026-11-06, asked for; save version 73): the Red Sea, the Gulf and Gibraltar open, the Americas joined at Panama, Japan one island near Asia
of two to three times the land, Italy a boot with Sicily off its toe, the Thames in England, the Levant, the Fertile Crescent, the Nile, Fars and the Valley of Mexico green, every homeland a fit city site with food and grass, and drawn starts on premade worlds only on land worth settling.
