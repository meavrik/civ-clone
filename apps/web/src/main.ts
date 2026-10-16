import { aiTurn } from "@civ/ai";
import {
  advance,
  applyCommand,
  atWar,
  availableAdvances,
  buildOptions,
  canFoundCity,
  canHelpWonder,
  canTradeRoute,
  checkGameEnd,
  cityAt,
  CIVS,
  civ,
  computeScore,
  defaultCityName,
  FINAL_TURN,
  formatYear,
  government,
  governmentsAvailable,
  hasContact,
  inciteCost,
  lastCombat,
  lastTurnEvents,
  loadSave,
  makeSave,
  newGame,
  productionCost,
  productionName,
  rankTitle,
  relation,
  routeBonus,
  runAiPlayers,
  shipStats,
  turnToYear,
  unitAt,
  unitById,
  unitType,
  workOptions,
  type Command,
  type DiplomatAction,
  type GameState,
  type NewGameOptions,
  type Production,
  type SaveGame,
  type TurnEvent,
} from "@civ/core";
import {
  citySlotAt,
  DIFFICULTIES,
  drawCityScreen,
  drawDiplomacyScreen,
  drawDiscoveryScreen,
  drawDomesticAdvisor,
  drawEndScreen,
  drawForeignAdvisor,
  drawMainScreen,
  drawMenu,
  drawMilitaryAdvisor,
  drawRatesScreen,
  drawScienceScreen,
  drawScoreScreen,
  drawSpaceshipScreen,
  drawStatusLine,
  drawTextInput,
  TEXT_INPUT_MAX,
  drawTitleScreen,
  leaderLine,
  menuHit,
  SCREEN_H,
  setupMenu,
  TILE,
  VIEW_TILES_X,
  VIEW_TILES_Y,
  VIEW_X,
  type CityScreenView,
  type MainScreenView,
  type MenuState,
  textWidth,
  type SetupState,
  type TextInputState,
} from "@civ/renderer-retro";
import { canvas, fitCanvas, present, screen, toScreen } from "./display.js";
import { listSlots, readSlot, SLOTS, writeSlot } from "./storage.js";

addEventListener("resize", fitCanvas);
fitCanvas();

// ---- session ----------------------------------------------------------------
let state: GameState;
let options: NewGameOptions;
let log: Command[] = [];
let status: string | undefined;
let statusUntil = 0;
let blinkOn = true;
let lastBlink = 0;

function say(text: string, ms = 2500): void {
  status = text;
  statusUntil = performance.now() + ms;
}

const REASONS: Record<string, string> = {
  terrain: "Can't go there",
  zoc: "Zone of control",
  "no-moves": "No moves left",
  full: "Ship is full",
  treaty: "We have a treaty",
  "no route": "No route there",
};

type Screen =
  | { kind: "title" }
  | { kind: "setup"; setup: SetupState }
  | { kind: "map" }
  | { kind: "city"; view: CityScreenView }
  | { kind: "discovery"; advance: string; then: () => void }
  | { kind: "science" }
  | { kind: "rates" }
  | { kind: "advisor"; which: "domestic" | "military" | "foreign" | "score" }
  | { kind: "diplomacy"; player: number; line: string }
  | { kind: "end"; lines: string[]; rank: string }
  | { kind: "spaceship" }
  | { kind: "input"; input: TextInputState; onSubmit: (text: string) => void; under: Screen }
  | { kind: "menu"; menu: MenuState; onPick: (i: number) => void; under: Screen; onCancel?: () => void };

let screenState: Screen = { kind: "title" };
const view: MainScreenView = { originX: 0, originY: 0, blink: true };

function dispatch(cmd: Command): boolean {
  const r = applyCommand(state, cmd);
  if (r.ok) {
    log.push(cmd);
    if (cmd.type === "move" && lastCombat) reportCombat();
  } else say(REASONS[r.reason] ?? r.reason);
  blinkOn = true;
  lastBlink = performance.now();
  return r.ok;
}

function reportCombat(): void {
  const c = lastCombat!;
  const them = state.players[c.defenderOwner]!.name;
  const a = unitType(c.attackerType).name;
  const d = unitType(c.defenderType).name;
  say(c.attackerWon ? `${a} defeats ${them} ${d}` : `${a} lost to ${them} ${d}`, 3500);
}

// ---- game start -------------------------------------------------------------
function startGame(opts: NewGameOptions, seed = (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0): void {
  options = opts;
  state = newGame(seed, opts);
  log = [];
  screenState = { kind: "map" };
  followActive(true);
  say(`${civ(state.players[0]!.civ).leader}, lead the ${state.players[0]!.name} to glory.`, 4000);
}

function resumeGame(save: SaveGame): void {
  try {
    const loaded = loadSave(save, aiTurn);
    state = loaded.state;
    log = loaded.log;
    options = save.options;
    screenState = { kind: "map" };
    followActive(true);
    say(`Loaded: ${formatYear(turnToYear(state.turn))}`);
  } catch (err) {
    say(`Load failed: ${(err as Error).message}`, 4000);
  }
}

const params = new URLSearchParams(location.search);
if (params.has("seed")) {
  startGame(
    {
      difficulty: Number(params.get("difficulty") ?? 2),
      opponents: Number(params.get("opponents") ?? 2),
      ...(params.get("civ") ? { civ: params.get("civ")! } : {}),
    },
    Number(params.get("seed")) || 2026,
  );
}

// ---- view helpers -----------------------------------------------------------
function centerOn(x: number, y: number): void {
  view.originX = x - (VIEW_TILES_X >> 1);
  view.originY = Math.max(0, Math.min(state.map.height - VIEW_TILES_Y, y - (VIEW_TILES_Y >> 1)));
}

function followActive(force = false): void {
  if (state.activeUnit === null) return;
  const u = unitById(state, state.activeUnit);
  if (!u) return;
  const w = state.map.width;
  const rx = (((u.x - view.originX) % w) + w) % w;
  const ry = u.y - view.originY;
  if (force || rx < 2 || rx > VIEW_TILES_X - 3 || ry < 2 || ry > VIEW_TILES_Y - 3) centerOn(u.x, u.y);
}

function isAdjacent(u: { x: number; y: number }, tx: number, ty: number): boolean {
  const w = state.map.width;
  return Math.abs(ty - u.y) <= 1 && Math.min(Math.abs(tx - u.x), w - Math.abs(tx - u.x)) <= 1;
}

// ---- menus ------------------------------------------------------------------
function menu(title: string, items: string[], onPick: (i: number) => void, extra: Partial<Extract<Screen, { kind: "menu" }>> = {}): void {
  screenState = { kind: "menu", under: screenState, menu: { title, items, selected: 0 }, onPick, ...extra };
}

function openCity(id: number): void {
  screenState = { kind: "city", view: { city: id } };
}

/** Ask for a line of text in-game (no browser prompt): Enter submits, Esc cancels. */
function askText(title: string, initial: string, onSubmit: (text: string) => void): void {
  screenState = { kind: "input", input: { title, text: initial, maxLength: TEXT_INPUT_MAX }, onSubmit, under: screenState };
}

/** Found a city with the active settlers after asking for its name, then open it. */
function foundWithName(unit: number): void {
  const u = unitById(state, unit);
  if (!u) return;
  const why = canFoundCity(state, u.x, u.y);
  if (why) { say(why); return; }
  askText("Name the new city", defaultCityName(state, 0), (name) => {
    if (dispatch({ type: "found", unit, name })) { const c = cityAt(state, u.x, u.y); if (c) openCity(c.id); }
    followActive(true);
  });
}

function inputKey(e: KeyboardEvent, sc: Extract<Screen, { kind: "input" }>): void {
  const inp = sc.input;
  if (e.code === "Escape") { screenState = sc.under; return; }
  if (e.code === "Enter" || e.code === "NumpadEnter") { screenState = sc.under; if (inp.text.trim()) sc.onSubmit(inp.text.trim()); return; }
  if (e.code === "Backspace") { inp.text = inp.text.slice(0, -1); return; }
  if (e.key.length === 1 && inp.text.length < inp.maxLength && textWidth(inp.text + e.key) < 170) inp.text += e.key;
}

function openProductionMenu(cityId: number): void {
  const city = state.cities.find((c) => c.id === cityId)!;
  const opts = buildOptions(state, city);
  screenState = {
    kind: "menu",
    under: screenState,
    menu: {
      title: `${city.name}: build what?`,
      items: opts.map((p) => productionName(p)),
      right: opts.map((p) => {
        const t = p.kind === "unit" ? unitType(p.id) : null;
        return t ? `${t.attack}/${t.defense}/${t.moves} ${productionCost(p)}` : `${productionCost(p)}`;
      }),
      selected: Math.max(0, opts.findIndex((p) => p.kind === city.production.kind && p.id === city.production.id)),
    },
    onPick: (i) => {
      const p: Production | undefined = opts[i];
      if (p) dispatch({ type: "setProduction", city: cityId, production: p });
    },
  };
}

function openResearchMenu(under: Screen, then?: () => void): void {
  const opts = availableAdvances(state.players[0]!.advances);
  if (opts.length === 0) { then?.(); return; }
  screenState = {
    kind: "menu",
    under,
    menu: { title: "Wise men ask: what shall we research?", items: opts.map((a) => a.name), selected: 0 },
    onPick: (i) => { const a = opts[i]; if (a) dispatch({ type: "research", advance: a.id }); then?.(); },
  };
}

function openGovernmentMenu(under: Screen, then?: () => void): void {
  const ids = governmentsAvailable(state, 0);
  screenState = {
    kind: "menu",
    under,
    menu: { title: "Choose a new government", items: ids.map((g) => government(g).name), selected: 0 },
    onPick: (i) => { const g = ids[i]; if (g) dispatch({ type: "setGovernment", government: g }); then?.(); },
  };
}

function openWarMenu(player: number, then?: () => void): void {
  const name = state.players[player]!.name;
  menu(`Declare war on the ${name}?`, ["No, keep the peace", "Yes, declare war!"], (i) => {
    if (i === 1) {
      dispatch({ type: "declareWar", player });
      say(`War with the ${name}!`, 3000);
      then?.();
    }
  });
}

/** A diplomat at a foreign gate: steal, sabotage or buy the city. */
function openDiplomatMenu(unit: number, cityId: number): void {
  const city = state.cities.find((c) => c.id === cityId);
  if (!city) return;
  const cost = inciteCost(state, city);
  const run = (action: DiplomatAction) => () => {
    if (dispatch({ type: "diplomat", unit, action, x: city.x, y: city.y })) {
      const ev = lastTurnEvents.find((e) => e.kind === "spy");
      const m = ev && eventMessage(ev);
      if (m) say(m, 4000);
      lastTurnEvents.length = 0;
    }
  };
  const items: [string, () => void][] = [
    ["Steal technology", run("steal")],
    ["Sabotage", run("sabotage")],
    [Number.isFinite(cost) ? `Incite revolt (${cost} gold)` : "Incite revolt (capital: impossible)", run("incite")],
    ["Never mind", () => {}],
  ];
  menu(`${city.name} (${state.players[city.owner]!.name}): our diplomat...`, items.map((i) => i[0]), (i) => items[i]?.[1]());
}

function openActionMenu(unit: number): void {
  const u = unitById(state, unit);
  if (!u) return;
  const w = workOptions(state, u);
  const type = unitType(u.type);
  const items: [string, () => void][] = [];
  if (type.flags?.includes("settler") && canFoundCity(state, u.x, u.y) === null)
    items.push(["Found city (B)", () => foundWithName(unit)]);
  if (w.irrigate !== undefined) items.push([`Irrigate (I) ${w.irrigate}t`, () => dispatch({ type: "work", unit, work: "irrigate" })]);
  if (w.mine !== undefined) items.push([`Mine (M) ${w.mine}t`, () => dispatch({ type: "work", unit, work: "mine" })]);
  if (w.road !== undefined) items.push([`Road (R) ${w.road}t`, () => dispatch({ type: "work", unit, work: "road" })]);
  if (w.railroad !== undefined) items.push([`Railroad (R) ${w.railroad}t`, () => dispatch({ type: "work", unit, work: "railroad" })]);
  if (w.fortress !== undefined) items.push([`Fortress (F) ${w.fortress}t`, () => dispatch({ type: "work", unit, work: "fortress" })]);
  if (w.clean !== undefined) items.push([`Clean pollution (P) ${w.clean}t`, () => dispatch({ type: "work", unit, work: "clean" })]);
  if (type.flags?.includes("caravan")) {
    const c = cityAt(state, u.x, u.y);
    if (c && canHelpWonder(state, u, c) === null) items.push(["Help build wonder", () => dispatch({ type: "helpWonder", unit })]);
    if (c && canTradeRoute(state, u, c) === null && u.homeCity !== null)
      items.push([`Establish trade route (+${routeBonus(state, state.cities.find((h) => h.id === u.homeCity)!, c)})`, () => dispatch({ type: "tradeRoute", unit })]);
  }
  if (type.flags?.includes("diplomat")) {
    for (const c of state.cities) {
      if (c.owner === 0 || c.owner === state.barbarians || !isAdjacent(u, c.x, c.y)) continue;
      items.push([`Diplomat: ${c.name}`, () => openDiplomatMenu(unit, c.id)]);
    }
  }
  if (type.domain === "land") items.push(["Fortify (F)", () => dispatch({ type: "fortify", unit })]);
  items.push(["Sentry (S)", () => dispatch({ type: "sentry", unit })]);
  items.push(["Wait (W)", () => dispatch({ type: "wait", unit })]);
  items.push(["Skip turn (Space)", () => dispatch({ type: "skip", unit })]);
  items.push(["Disband (Shift+D)", () => dispatch({ type: "disband", unit })]);
  screenState = {
    kind: "menu",
    under: screenState,
    menu: { title: `${type.name}: orders`, items: items.map((i) => i[0]), selected: 0 },
    onPick: (i) => { items[i]?.[1](); followActive(true); },
  };
}

/** The game menu (F10 / Esc with no unit). */
function openGameMenu(): void {
  const items: [string, () => void][] = [
    ["Save game", () => openSaveMenu()],
    ["Load game", () => openLoadMenu()],
    ["Spaceship (F6)", () => { screenState = { kind: "spaceship" }; }],
    ["Retire (end game)", () => endGame({ kind: "time" })],
    ["New game", () => { screenState = { kind: "title" }; }],
  ];
  menu("Game", items.map((i) => i[0]), (i) => items[i]?.[1]());
}

async function openSaveMenu(): Promise<void> {
  const slots = await listSlots();
  const items = slots.map((s, i) => (i === 0 ? "(autosave)" : s ? `${i}. ${s.civ}, ${formatYear(turnToYear(s.turn))}` : `${i}. empty`));
  menu("Save to slot", items, (i) => {
    if (i === 0) return;
    void writeSlot(i, makeSave(state, options, log)).then(() => say(`Saved to slot ${i}`));
  });
}

async function openLoadMenu(): Promise<void> {
  const slots = await listSlots();
  const items = slots.map((s, i) => (s ? `${i === 0 ? "auto" : i}. ${s.civ}, ${formatYear(turnToYear(s.turn))}` : `${i === 0 ? "auto" : i}. empty`));
  menu("Load which game?", items, (i) => {
    void readSlot(i).then((s) => { if (s) resumeGame(s); else say("Empty slot"); });
  });
}

function openDiplomacy(player: number): void {
  screenState = { kind: "diplomacy", player, line: leaderLine(state, player) };
  const me = state.players[0]!;
  const them = state.players[player]!;
  const r = relation(state, 0, player);
  const items: [string, () => void][] = [];
  if (r === "war") items.push(["Propose peace", () => { dispatch({ type: "makePeace", player }); say("Peace is agreed."); }]);
  else items.push(["Declare war", () => openWarMenu(player)]);
  const theirsOnly = them.advances.filter((a) => !me.advances.includes(a));
  const mineOnly = me.advances.filter((a) => !them.advances.includes(a));
  if (r !== "war" && theirsOnly.length && mineOnly.length)
    items.push(["Exchange knowledge", () => {
      // Offer our first unique advance for their first; good enough until a bargaining screen.
      const give = mineOnly[0]!;
      const receive = theirsOnly[0]!;
      menu(`Trade ${advance(give).name} for ${advance(receive).name}?`, ["Yes", "No"], (i) => {
        if (i === 0 && dispatch({ type: "exchangeAdvances", player, give, receive })) say(`We learn ${advance(receive).name}.`, 3000);
      });
    }]);
  if (me.gold >= 50) items.push(["Give 50 gold as tribute", () => { dispatch({ type: "giveGold", player, amount: 50 }); say("The gift is accepted."); }]);
  items.push(["Farewell", () => {}]);
  screenState = {
    kind: "menu",
    under: screenState,
    menu: { title: "Your proposal?", items: items.map((i) => i[0]), selected: 0 },
    onPick: (i) => { items[i]?.[1](); if (screenState.kind === "diplomacy") screenState = { kind: "map" }; },
    onCancel: () => { screenState = { kind: "map" }; },
  };
}

function openForeignTalkMenu(): void {
  const known = state.players.filter((p) => p.id !== 0 && p.alive && p.id !== state.barbarians && hasContact(state, 0, p.id));
  if (!known.length) { say("We have met no one."); return; }
  menu("Send an emissary to...", known.map((p) => p.name), (i) => { const p = known[i]; if (p) openDiplomacy(p.id); });
}

// ---- turn flow --------------------------------------------------------------
function eventMessage(ev: TurnEvent): string | null {
  if (!("city" in ev)) {
    switch (ev.kind) {
      case "warDeclared": return `The ${state.players[ev.player]?.name} declare war!`;
      case "cityLost": return `${ev.name} has been destroyed!`;
      case "cityCaptured": return `${ev.name} captured!`;
      case "unitLost": return `${ev.unit} lost to the ${state.players[ev.by]?.name}`;
      case "barbarians": return "Barbarians have landed!";
      case "eliminated": return `The ${state.players[ev.player]?.name} civilization has been destroyed.`;
      case "tradeRoute": return `Trade route ${ev.from}-${ev.to}: +${ev.bonus} gold and science`;
      case "globalWarming": return "Global warming! Fields wither and forests turn to jungle.";
      case "spaceLaunched": return ev.player === 0 ? "Our spaceship is on its way." : `The ${state.players[ev.player]?.name} have launched a spaceship!`;
      case "spaceArrived": return ev.player === 0 ? "Our colonists have landed!" : `The ${state.players[ev.player]?.name} have reached their new world.`;
      case "spaceLost": return ev.player === 0 ? "Our spaceship is lost!" : `The ${state.players[ev.player]?.name} spaceship is lost.`;
      case "spy": return ev.action === "steal" ? `Our diplomat steals ${ev.detail} from ${ev.target}!`
        : ev.action === "sabotage" ? `Our diplomat wrecks ${ev.target}: ${ev.detail} destroyed.`
        : `${ev.target} revolts and joins us!`;
      case "hut": {
        const r = ev.result;
        return r.kind === "gold" ? `The tribe gives you ${r.amount} gold.`
          : r.kind === "advance" ? `Scrolls of ancient wisdom: ${advance(r.advance).name}!`
          : r.kind === "unit" ? `A band of ${unitType(r.unit).name} joins you.`
          : r.kind === "barbarians" ? "You have unleashed a horde of barbarians!"
          : "The village is deserted.";
      }
      default: return null;
    }
  }
  const name = state.cities.find((c) => c.id === ev.city)?.name ?? "City";
  switch (ev.kind) {
    case "grew": return `${name} grows`;
    case "shrank": return `${name} shrinks`;
    case "built": return `${name} builds ${ev.detail}`;
    case "wonder": return `${name} completes ${ev.detail}!`;
    case "disorder": return `Civil disorder in ${name}!`;
    case "starving": return `${name} is starving`;
    case "famine": return `Famine in ${name}: ${ev.detail} lost`;
    case "sold": return `${name} sells its ${ev.detail} to pay the bills`;
    case "pollution": return `Pollution near ${name}!`;
  }
}

/** Play the turn's events as a chain of screens, then land on the map. */
function presentEvents(events: TurnEvent[], done?: () => void): void {
  const next = (): void => {
    const ev = events.shift();
    if (!ev) {
      screenState = { kind: "map" };
      followActive(true);
      done?.();
      return;
    }
    if (ev.kind === "discovered") screenState = { kind: "discovery", advance: ev.advance, then: next };
    else if (ev.kind === "contact") {
      const c = civ(state.players[ev.player]!.civ);
      screenState = { kind: "diplomacy", player: ev.player, line: `${c.leader} of the ${c.name} greets you.` };
      menu("Your reply?", ["Exchange peace treaty", "Declare war"], (i) => {
        if (i === 1) dispatch({ type: "declareWar", player: ev.player });
        else dispatch({ type: "makePeace", player: ev.player });
        next();
      }, { onCancel: next });
    } else if (ev.kind === "chooseResearch") openResearchMenu({ kind: "map" }, next);
    else if (ev.kind === "chooseGovernment") openGovernmentMenu({ kind: "map" }, next);
    else {
      const msg = eventMessage(ev);
      if (msg) say(msg, 4000);
      next();
    }
  };
  next();
}

function endGame(end: NonNullable<ReturnType<typeof checkGameEnd>>): void {
  const me = computeScore(state, 0);
  const lines = [
    end.kind === "conquest" ? (end.winner === 0 ? "You have conquered the world!" : `The ${state.players[end.winner]!.name} rule the world.`)
      : end.kind === "space" ? (end.winner === 0 ? "Your colonists have reached a new world!" : `The ${state.players[end.winner]!.name} have colonized the stars.`)
      : end.kind === "defeat" ? "Your civilization has been destroyed." : `The year is ${formatYear(turnToYear(state.turn))}. Your reign ends.`,
    "",
    `Citizens: ${me.citizens}`,
    `Wonders: ${me.wonders}`,
    `Advances: ${me.techs}`,
    `Peace: ${me.peace}`,
    `Total score: ${me.total}`,
  ];
  screenState = { kind: "end", lines, rank: rankTitle(me.total) };
}

function endTurn(): void {
  dispatch({ type: "endTurn" });
  const events: TurnEvent[] = [...lastTurnEvents];
  // Other civilizations move now; keep what concerns us.
  let guard = 0;
  while (state.players[state.currentPlayer]!.isAi && guard++ < 16) {
    const ai = state.currentPlayer;
    aiTurn(state);
    applyCommand(state, { type: "endTurn" });
    for (const ev of lastTurnEvents) {
      if (ev.kind === "contact" && ev.player === 0) events.push({ kind: "contact", player: ai });
      else if ((ev.kind === "cityLost" || ev.kind === "cityCaptured") && ev.player === 0) events.push(ev);
      else if (ev.kind === "eliminated" || ev.kind === "barbarians" || ev.kind === "globalWarming") events.push(ev);
      else if (ev.kind === "spaceLaunched" || ev.kind === "spaceArrived" || ev.kind === "spaceLost") events.push(ev);
    }
  }
  for (const ev of lastTurnEvents) if (ev.kind === "contact" || ev.kind === "eliminated") events.push(ev);
  void runAiPlayers; // replay helper lives in core; here the loop above also harvests events
  // Autosave every 5 turns.
  if (state.turn % 5 === 0) void writeSlot(0, makeSave(state, options, log)).catch(() => {});
  presentEvents(events, () => {
    const end = checkGameEnd(state, FINAL_TURN);
    if (end) endGame(end);
  });
}

// ---- input: keyboard --------------------------------------------------------
const MOVES: Record<string, [number, number]> = {
  Numpad8: [0, -1], ArrowUp: [0, -1],
  Numpad2: [0, 1], ArrowDown: [0, 1],
  Numpad4: [-1, 0], ArrowLeft: [-1, 0],
  Numpad6: [1, 0], ArrowRight: [1, 0],
  Numpad7: [-1, -1], Numpad9: [1, -1], Numpad1: [-1, 1], Numpad3: [1, 1],
};

function tryMove(unit: number, dx: number, dy: number): void {
  const before = state.activeUnit;
  const r = applyCommand(state, { type: "move", unit, dx, dy });
  if (r.ok) {
    log.push({ type: "move", unit, dx, dy });
    if (lastCombat) reportCombat();
    const ev = lastTurnEvents.find((e) => e.kind === "hut" || e.kind === "cityCaptured" || e.kind === "cityLost" || e.kind === "tradeRoute");
    if (ev) { const m = eventMessage(ev); if (m) say(m, 4000); lastTurnEvents.length = 0; }
  } else if (r.reason === "treaty") {
    const u = unitById(state, unit)!;
    const target = unitAt(state, u.x + dx, u.y + dy)[0] ?? cityAt(state, u.x + dx, u.y + dy);
    if (target) openWarMenu(target.owner, () => tryMove(unit, dx, dy));
    return;
  } else if (r.reason === "diplomat") {
    const u = unitById(state, unit)!;
    const city = cityAt(state, u.x + dx, u.y + dy);
    if (city) openDiplomatMenu(unit, city.id);
    return;
  } else say(REASONS[r.reason] ?? r.reason);
  blinkOn = true;
  lastBlink = performance.now();
  followActive(state.activeUnit !== before);
}

function mapKey(e: KeyboardEvent): void {
  const active = state.activeUnit;
  const mv = MOVES[e.code];
  if (mv) {
    e.preventDefault();
    if (active !== null) tryMove(active, mv[0], mv[1]);
    return;
  }
  const order = (cmd: Command) => { if (active !== null) dispatch(cmd); followActive(true); };
  switch (e.code) {
    case "Enter": case "NumpadEnter": if (active === null) endTurn(); break;
    case "Space": order({ type: "skip", unit: active! }); break;
    case "KeyW": order({ type: "wait", unit: active! }); break;
    case "KeyF": {
      const u = active !== null ? unitById(state, active) : undefined;
      order(u && workOptions(state, u).fortress !== undefined ? { type: "work", unit: active!, work: "fortress" } : { type: "fortify", unit: active! });
      break;
    }
    case "KeyS": order({ type: "sentry", unit: active! }); break;
    case "KeyI": order({ type: "work", unit: active!, work: "irrigate" }); break;
    case "KeyM": order({ type: "work", unit: active!, work: "mine" }); break;
    case "KeyR": {
      const u = active !== null ? unitById(state, active) : undefined;
      order({ type: "work", unit: active!, work: u && workOptions(state, u).road === undefined ? "railroad" : "road" });
      break;
    }
    case "KeyP": order({ type: "work", unit: active!, work: "clean" }); break;
    case "KeyB": if (active !== null) foundWithName(active); break;
    case "KeyD": if (e.shiftKey) order({ type: "disband", unit: active! }); break;
    case "KeyC": followActive(true); break;
    case "KeyT": screenState = { kind: "rates" }; break;
    case "KeyA": screenState = { kind: "science" }; break;
    case "F1": e.preventDefault(); screenState = { kind: "advisor", which: "domestic" }; break;
    case "F2": e.preventDefault(); screenState = { kind: "advisor", which: "military" }; break;
    case "F3": e.preventDefault(); screenState = { kind: "advisor", which: "foreign" }; break;
    case "F4": e.preventDefault(); screenState = { kind: "science" }; break;
    case "F5": e.preventDefault(); screenState = { kind: "advisor", which: "score" }; break;
    case "F6": e.preventDefault(); screenState = { kind: "spaceship" }; break;
    case "F10": e.preventDefault(); openGameMenu(); break;
    case "Escape": if (active !== null) openActionMenu(active); else openGameMenu(); break;
    case "KeyG": {
      const p = state.players[0]!;
      if (p.government === "anarchy") {
        if (p.anarchyTurns === 0) openGovernmentMenu({ kind: "map" }); else say("Still in anarchy");
      } else menu("Start a revolution?", ["No", "Yes, overthrow the government"], (i) => {
        if (i === 1) { dispatch({ type: "revolution" }); say("Revolution! Anarchy reigns.", 3000); }
      });
      break;
    }
  }
}

function ratesKey(e: KeyboardEvent): void {
  const p = state.players[0]!;
  const set = (tax: number, lux: number) => {
    const sci = 10 - tax - lux;
    if (sci < 0 || tax < 0 || lux < 0) return;
    dispatch({ type: "setRates", tax, lux, sci });
  };
  switch (e.code) {
    case "ArrowRight": set(p.taxRate + 1, p.luxRate); break;
    case "ArrowLeft": set(p.taxRate - 1, p.luxRate); break;
    case "ArrowUp": set(p.taxRate, p.luxRate + 1); break;
    case "ArrowDown": set(p.taxRate, p.luxRate - 1); break;
    case "Escape": case "Enter": case "NumpadEnter": screenState = { kind: "map" }; break;
  }
}

function cityKey(e: KeyboardEvent, cv: CityScreenView): void {
  switch (e.code) {
    case "Escape": screenState = { kind: "map" }; break;
    case "KeyC": openProductionMenu(cv.city); break;
    case "KeyB": dispatch({ type: "buy", city: cv.city }); break;
    case "KeyN": {
      const city = state.cities.find((c) => c.id === cv.city);
      if (city) askText("Rename the city", city.name, (name) => dispatch({ type: "renameCity", city: cv.city, name }));
      break;
    }
  }
}

function menuKey(e: KeyboardEvent, sc: Extract<Screen, { kind: "menu" }>): void {
  const m = sc.menu;
  switch (e.code) {
    case "ArrowUp": case "Numpad8": m.selected = (m.selected + m.items.length - 1) % m.items.length; break;
    case "ArrowDown": case "Numpad2": m.selected = (m.selected + 1) % m.items.length; break;
    case "Enter": case "NumpadEnter": case "Space": screenState = sc.under; sc.onPick(m.selected); break;
    case "Escape": screenState = sc.under; sc.onCancel?.(); break;
  }
}

function setupKey(e: KeyboardEvent, sc: Extract<Screen, { kind: "setup" }>): void {
  const m = setupMenu(sc.setup);
  const civs = CIVS.filter((c) => c.id !== "barbarians");
  const apply = (i: number) => {
    if (sc.setup.step === "difficulty") { sc.setup.difficulty = i; sc.setup.step = "opponents"; }
    else if (sc.setup.step === "opponents") { sc.setup.opponents = i + 1; sc.setup.step = "civ"; }
    else { sc.setup.civ = civs[i]!.id; startGame({ difficulty: sc.setup.difficulty, opponents: sc.setup.opponents, civ: sc.setup.civ }); }
  };
  setupSelection = Math.min(setupSelection, m.items.length - 1);
  switch (e.code) {
    case "ArrowUp": case "Numpad8": setupSelection = (setupSelection + m.items.length - 1) % m.items.length; break;
    case "ArrowDown": case "Numpad2": setupSelection = (setupSelection + 1) % m.items.length; break;
    case "Enter": case "NumpadEnter": case "Space": apply(setupSelection); setupSelection = 0; break;
    case "Escape": screenState = { kind: "title" }; break;
  }
}
let setupSelection = 0;

function openTitleMenu(): void {
  const items: [string, () => void][] = [
    ["Start a new game", () => { screenState = { kind: "setup", setup: { step: "difficulty", difficulty: 2, opponents: 2, civ: "romans" } }; setupSelection = 2; }],
    ["Load a saved game", () => void openLoadMenu()],
  ];
  screenState = {
    kind: "menu",
    under: { kind: "title" },
    menu: { title: "Epochs", items: items.map((i) => i[0]), selected: 0 },
    onPick: (i) => items[i]?.[1](),
  };
}

addEventListener("keydown", (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const sc = screenState;
  switch (sc.kind) {
    case "title": openTitleMenu(); break;
    case "setup": setupKey(e, sc); break;
    case "map": mapKey(e); break;
    case "city": cityKey(e, sc.view); break;
    case "rates": ratesKey(e); break;
    case "science":
      if (e.code === "KeyA") openResearchMenu(sc);
      else if (e.code === "Escape" || e.code === "F4") screenState = { kind: "map" };
      else advisorHotkey(e);
      break;
    case "advisor":
      if (e.code === "Escape") screenState = { kind: "map" };
      else if (sc.which === "foreign" && (e.code === "Enter" || e.code === "NumpadEnter")) openForeignTalkMenu();
      else advisorHotkey(e);
      break;
    case "discovery": sc.then(); break;
    case "diplomacy": screenState = { kind: "map" }; break;
    case "end": screenState = { kind: "title" }; break;
    case "spaceship":
      if (e.code === "Escape" || e.code === "F6") screenState = { kind: "map" };
      else if ((e.code === "Enter" || e.code === "NumpadEnter") && shipStats(state.players[0]!.spaceship).launchable) openLaunchMenu();
      else advisorHotkey(e);
      break;
    case "menu": menuKey(e, sc); break;
    case "input": e.preventDefault(); inputKey(e, sc); break;
  }
});

function openLaunchMenu(): void {
  const st = shipStats(state.players[0]!.spaceship);
  menu(`Launch now? ${st.successPct}% success, ${st.flightTurns} turns`, ["Not yet", "Launch!"], (i) => {
    if (i === 1 && dispatch({ type: "launch" })) say("The spaceship lifts off!", 4000);
  });
}

function advisorHotkey(e: KeyboardEvent): void {
  const map: Record<string, Screen> = {
    F1: { kind: "advisor", which: "domestic" },
    F2: { kind: "advisor", which: "military" },
    F3: { kind: "advisor", which: "foreign" },
    F4: { kind: "science" },
    F5: { kind: "advisor", which: "score" },
    F6: { kind: "spaceship" },
  };
  const next = map[e.code];
  if (next) { e.preventDefault(); screenState = next; }
}

// ---- input: mouse -----------------------------------------------------------
canvas.addEventListener("contextmenu", (e) => e.preventDefault());
canvas.addEventListener("mousedown", (e) => {
  const [px, py] = toScreen(e);
  const sc = screenState;
  switch (sc.kind) {
    case "title": openTitleMenu(); return;
    case "setup": {
      const m = setupMenu(sc.setup);
      const i = menuHit({ ...m }, px, py);
      if (i >= 0) { setupSelection = i; setupKey({ code: "Enter" } as KeyboardEvent, sc); }
      return;
    }
    case "menu": {
      const i = menuHit(sc.menu, px, py);
      screenState = sc.under;
      if (i >= 0) sc.onPick(i); else sc.onCancel?.();
      return;
    }
    case "discovery": sc.then(); return;
    case "end": screenState = { kind: "title" }; return;
    case "diplomacy": screenState = { kind: "map" }; return;
    case "rates": case "science": case "spaceship": screenState = { kind: "map" }; return;
    case "input": return;
    case "advisor":
      if (sc.which === "foreign") openForeignTalkMenu(); else screenState = { kind: "map" };
      return;
    case "city": {
      const slot = citySlotAt(px, py);
      if (slot !== null && slot !== 0) dispatch({ type: "toggleTile", city: sc.view.city, slot });
      else if (py > SCREEN_H - 12) screenState = { kind: "map" };
      return;
    }
    case "map": break;
  }

  if (px < VIEW_X) {
    if (py >= 2 && py < 52) centerOn(px, py - 2);
    return;
  }
  const tx = ((view.originX + Math.floor((px - VIEW_X) / TILE)) % state.map.width + state.map.width) % state.map.width;
  const ty = view.originY + Math.floor(py / TILE);
  if (ty < 0 || ty >= state.map.height) return;
  const active = state.activeUnit !== null ? unitById(state, state.activeUnit) : undefined;

  if (e.button === 2) {
    if (active) openActionMenu(active.id); else openGameMenu();
    return;
  }
  const city = cityAt(state, tx, ty);
  if (city && city.owner === 0 && !(active && isAdjacent(active, tx, ty) && !(active.x === tx && active.y === ty))) {
    openCity(city.id);
    return;
  }
  if (active) {
    if (active.x === tx && active.y === ty) {
      const stack = unitAt(state, tx, ty).filter((u) => u.owner === 0 && u.movesLeft > 0);
      const i = stack.findIndex((u) => u.id === active.id);
      const nextUnit = stack[(i + 1) % stack.length];
      if (nextUnit && nextUnit.id !== active.id) dispatch({ type: "activate", unit: nextUnit.id });
      return;
    }
    if (isAdjacent(active, tx, ty)) {
      let dx = tx - active.x;
      if (dx > 1) dx -= state.map.width;
      if (dx < -1) dx += state.map.width;
      tryMove(active.id, dx, ty - active.y);
      return;
    }
    const own = unitAt(state, tx, ty).find((u) => u.owner === 0 && u.movesLeft > 0);
    if (own) { dispatch({ type: "activate", unit: own.id }); return; }
    const before = state.activeUnit;
    if (dispatch({ type: "goto", unit: active.id, x: tx, y: ty })) say("Going to...", 1500);
    followActive(state.activeUnit !== before);
    return;
  }
  const own = unitAt(state, tx, ty).find((u) => u.owner === 0);
  if (own) {
    dispatch({ type: "activate", unit: own.id });
    if (state.activeUnit !== own.id) say("No moves left this turn");
    return;
  }
  centerOn(tx, ty);
});

// ---- frame loop ---------------------------------------------------------------
function draw(sc: Screen): void {
  switch (sc.kind) {
    case "title": drawTitleScreen(screen, blinkOn); break;
    case "setup": {
      drawTitleScreen(screen, false);
      const m = setupMenu(sc.setup);
      drawMenu(screen, { ...m, selected: setupSelection });
      break;
    }
    case "map": view.message = status; drawMainScreen(screen, state, view); break;
    case "city": sc.view.message = status; drawCityScreen(screen, state, sc.view); break;
    case "discovery": drawDiscoveryScreen(screen, state, sc.advance); break;
    case "science": drawScienceScreen(screen, state); break;
    case "rates": drawRatesScreen(screen, state); break;
    case "advisor":
      if (sc.which === "domestic") drawDomesticAdvisor(screen, state);
      else if (sc.which === "military") drawMilitaryAdvisor(screen, state);
      else if (sc.which === "foreign") drawForeignAdvisor(screen, state);
      else drawScoreScreen(screen, state);
      break;
    case "diplomacy": drawDiplomacyScreen(screen, state, sc.player, sc.line); break;
    case "end": drawEndScreen(screen, sc.lines, sc.rank); break;
    case "spaceship": drawSpaceshipScreen(screen, state); break;
    case "input":
      draw(sc.under);
      drawTextInput(screen, sc.input, blinkOn);
      break;
    case "menu":
      draw(sc.under);
      drawMenu(screen, sc.menu);
      if (status && sc.under.kind !== "map") drawStatusLine(screen, status);
      break;
  }
}

function frame(t: number): void {
  if (t - lastBlink > 400) { blinkOn = !blinkOn; lastBlink = t; }
  view.blink = blinkOn;
  if (status && t > statusUntil) status = undefined;
  draw(screenState);
  present();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

(window as unknown as { civ: unknown }).civ = { get state() { return state; }, get log() { return log; }, dispatch, atWar, DIFFICULTIES };
