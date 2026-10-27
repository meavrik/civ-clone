import { describe, expect, it } from "vitest";
import { applyCommand, clearTrespass, createRng, createUnit, esteem, foundCity, getTile, goldScale, labelContinents, lastTurnEvents, newGame, peaceOffered, relation, setBordersOpen, setRelation, Terrain, trespassRecord, type GameState, type NewGameOptions } from "@civ/core";
import { attitude, bordersAnswer, bordersPrice, courtPlayers, describePlan, ENVOYS, peaceAnswer, peacePrice, plannerTurn, resourcePrice, stayPrice, tributeOffer, withdrawAnswer } from "../src/index.js";

/** Player 0 plays (AI); everyone else just ends the turn. */
function round(state: GameState): void {
  plannerTurn(state);
  applyCommand(state, { type: "endTurn" });
  let guard = 0;
  while (state.currentPlayer !== 0 && guard++ < 10) applyCommand(state, { type: "endTurn" });
}

/** An empty sea with a small home island (one city, no room) and a bigger island three squares away. */
function islands(): GameState {
  const s = newGame(5, { opponents: 1, allAi: true });
  for (const t of s.map.tiles) Object.assign(t, { terrain: Terrain.Ocean, river: false, special: false, hut: false, road: false, irrigation: false, mine: false });
  const land = (x0: number, x1: number, y0: number, y1: number) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) getTile(s.map, x, y)!.terrain = Terrain.Grassland;
  };
  land(12, 15, 19, 24);
  land(19, 27, 16, 27);
  labelContinents(s.map);
  s.units = [];
  s.cities = [];
  const p = s.players[0]!;
  p.advances.push("bronze_working", "map_making");
  p.explored.fill(1);
  foundCity(s, 0, 15, 21);
  createUnit(s, "settlers", 0, 15, 21);
  createUnit(s, "trireme", 0, 15, 21);
  s.currentPlayer = 0;
  return s;
}

describe("planner AI v3", () => {
  it("ferries a settler from a full island to free land across the strait and founds a colony", () => {
    const s = islands();
    const plan = describePlan(s, 0);
    expect(plan.sites).toBe(0);
    expect(plan.overseasSites).toBeGreaterThan(0);
    expect(plan.wantOverseas).toBe(true);
    const across = getTile(s.map, 20, 20)!.continent;
    for (let r = 0; r < 30 && !s.cities.some((c) => c.owner === 0 && getTile(s.map, c.x, c.y)!.continent === across); r++) round(s);
    const colony = s.cities.find((c) => c.owner === 0 && getTile(s.map, c.x, c.y)!.continent === across);
    expect(colony, "a city on the far island").toBeDefined();
  });

  it("swaps advances with another computer civilization it is at peace with", () => {
    const s = newGame(7, { opponents: 2, allAi: true });
    const [a, b] = [s.players[0]!, s.players[1]!];
    a.advances = ["alphabet"];
    b.advances = ["bronze_working"];
    setRelation(s, 0, 1, "peace");
    setRelation(s, 0, 2, "war");
    s.turn = 2; // the pair (0, 1) deals on turns where turn + 0 + 1 is a multiple of three
    s.currentPlayer = 0;
    plannerTurn(s);
    expect(a.advances).toContain("bronze_working");
    expect(b.advances).toContain("alphabet");
  });

  it("storms a lightly held enemy city its soldiers stand next to, and walks in", () => {
    const s = newGame(9, { opponents: 1, allAi: true });
    for (let y = 15; y <= 25; y++) for (let x = 15; x <= 25; x++) Object.assign(getTile(s.map, x, y)!, { terrain: Terrain.Grassland, river: false, hut: false });
    labelContinents(s.map);
    s.units = s.units.filter((u) => Math.abs(u.x - 20) > 6 || Math.abs(u.y - 20) > 6);
    s.cities = [];
    const target = foundCity(s, 1, 20, 20);
    target.size = 3;
    createUnit(s, "militia", 1, 20, 20);
    foundCity(s, 0, 15, 20);
    createUnit(s, "phalanx", 0, 15, 20);
    for (const [x, y] of [[19, 20], [19, 21], [21, 20]] as const) createUnit(s, "legion", 0, x, y);
    setRelation(s, 0, 1, "war");
    s.currentPlayer = 0;
    plannerTurn(s);
    expect(target.owner).toBe(0);
  });
});

describe("planner AI v3 borders", () => {
  /** Computer civ 1 has a city at (30, 10) and two phalanxes; our militia stands on its land, at peace. */
  function trespassed(opts: NewGameOptions = {}): { s: GameState; unit: number } {
    const s = newGame(6, { opponents: 1, ...opts });
    for (const t of s.map.tiles) Object.assign(t, { terrain: Terrain.Grassland, river: false, special: false, hut: false, road: false, irrigation: false, mine: false });
    labelContinents(s.map);
    s.units = [];
    s.cities = [];
    foundCity(s, 0, 10, 10);
    foundCity(s, 1, 30, 10);
    createUnit(s, "phalanx", 1, 30, 10);
    createUnit(s, "phalanx", 1, 30, 10);
    const u = createUnit(s, "militia", 0, 29, 11);
    u.order = { kind: "fortified" };
    setRelation(s, 0, 1, "peace");
    s.currentPlayer = 1;
    return { s, unit: u.id };
  }

  it("gives a human civilization a turn to leave, then asks it off its land, warns once more, and goes to war", () => {
    const { s } = trespassed();
    // Its turn begins with our militia on its land: noted, nothing said.
    clearTrespass(s, 1);
    plannerTurn(s);
    expect(trespassRecord(s, 1, 0)?.warnings).toBe(0);
    expect(lastTurnEvents.some((e) => e.kind === "leaveDemand")).toBe(false);
    expect(attitude(s, 1, 0)).toBe("wary"); // proud only: being on its land is no grievance yet
    s.turn++;
    plannerTurn(s);
    expect(trespassRecord(s, 1, 0)?.warnings).toBe(1);
    expect(lastTurnEvents).toContainEqual({ kind: "leaveDemand", player: 1, to: 0, warnings: 1 });
    plannerTurn(s); // the same turn: no second word
    expect(trespassRecord(s, 1, 0)?.warnings).toBe(1);
    s.turn++;
    plannerTurn(s);
    expect(trespassRecord(s, 1, 0)?.warnings).toBe(2);
    expect(relation(s, 0, 1)).toBe("peace");
    s.turn++;
    plannerTurn(s);
    expect(relation(s, 0, 1)).toBe("war");
    expect(lastTurnEvents).toContainEqual({ kind: "warDeclared", player: 1, on: 0, reason: "trespass" });
  });

  it("only complains when far the weaker, and says nothing once borders are open", () => {
    const { s } = trespassed();
    s.units = s.units.filter((u) => u.owner !== 1);
    for (let i = 0; i < 4; i++) createUnit(s, "legion", 0, 10, 10);
    for (let t = 0; t < 4; t++, s.turn++) plannerTurn(s);
    expect(relation(s, 0, 1)).toBe("peace");
    setBordersOpen(s, 0, 1, true);
    lastTurnEvents.length = 0;
    s.turn += 10;
    plannerTurn(s);
    expect(lastTurnEvents.some((e) => e.kind === "leaveDemand")).toBe(false);
  });

  it("answers the player's proposals by how it regards them", () => {
    const { s } = trespassed();
    expect(attitude(s, 1, 0)).toBe("wary"); // four phalanx points against our militia's two: proud
    expect(bordersAnswer(s, 1, 0)).toBe("for gold");
    expect(tributeOffer(s, 1, 0)).toBe(0); // the stronger never pays
    s.units = s.units.filter((u) => u.owner !== 1);
    for (let i = 0; i < 3; i++) createUnit(s, "legion", 0, 10, 10);
    s.players[1]!.gold = 120;
    expect(attitude(s, 1, 0)).toBe("friendly");
    // A share of its treasury that grows with how far the weaker it is: half, with nothing to fight with.
    expect(tributeOffer(s, 1, 0)).toBe(60);
    createUnit(s, "phalanx", 1, 30, 10); // 14 strength against 3: under half
    expect(tributeOffer(s, 1, 0)).toBe(50);
    s.units = s.units.filter((u) => u.owner !== 1);
    // A friendly leader takes its units off our land when asked; a hostile one never; a wary one yields to strength.
    expect(withdrawAnswer(s, 1, 0)).toBe(true);
    s.units = s.units.filter((u) => u.owner !== 0);
    for (let i = 0; i < 4; i++) createUnit(s, "phalanx", 1, 20, 10);
    expect(attitude(s, 1, 0)).toBe("wary");
    expect(withdrawAnswer(s, 1, 0)).toBe(false); // the stronger stays
    s.tributePaid = { "1>0": s.turn };
    expect(tributeOffer(s, 1, 0)).toBe(0);
    s.trespass = { "1>0": { turn: s.turn, warnings: 2 } };
    expect(attitude(s, 1, 0)).toBe("hostile");
    expect(bordersAnswer(s, 1, 0)).toBe("no");
  });
});

describe("planner AI v3 treaties and influence", () => {
  /** Computer civ 1 (a city at (30, 10), two phalanxes) and our city at (`ourX`, 10) with a militia at home, met without a treaty. */
  function met(opts: NewGameOptions = {}, ourX = 10): GameState {
    const s = newGame(6, { opponents: 1, ...opts });
    for (const t of s.map.tiles) Object.assign(t, { terrain: Terrain.Grassland, river: false, special: false, hut: false, road: false, irrigation: false, mine: false });
    labelContinents(s.map);
    s.units = [];
    s.cities = [];
    foundCity(s, 0, ourX, 10);
    foundCity(s, 1, 30, 10);
    createUnit(s, "phalanx", 1, 30, 10);
    createUnit(s, "phalanx", 1, 30, 10);
    createUnit(s, "militia", 0, ourX, 10).order = { kind: "fortified" };
    setRelation(s, 0, 1, "contact");
    s.currentPlayer = 1;
    return s;
  }

  /** Temples, libraries and wonders in the city of `owner`: far more influence than a lone city's. */
  function renowned(s: GameState, owner: number): void {
    const c = s.cities.find((x) => x.owner === owner)!;
    c.buildings.push("temple", "library", "courthouse");
    c.wonders.push("pyramids", "colossus");
  }

  it("weighs our influence: admiration outweighs its pride, scorn adds to it", () => {
    const s = met();
    expect(attitude(s, 1, 0)).toBe("wary"); // proud: four phalanx points against our militia's two
    expect(peaceAnswer(s, 1, 0)).toBe("for gold");
    renowned(s, 0);
    expect(esteem(s, 1, 0)).toBe("admired");
    expect(attitude(s, 1, 0)).toBe("friendly");
    expect(peaceAnswer(s, 1, 0)).toBe("yes");
    expect(bordersAnswer(s, 1, 0)).toBe("yes");
    s.cities.find((c) => c.owner === 0)!.buildings = [];
    s.cities.find((c) => c.owner === 0)!.wonders = [];
    renowned(s, 1);
    expect(esteem(s, 1, 0)).toBe("scorned");
    expect(attitude(s, 1, 0)).toBe("hostile"); // proud and scornful
    expect(peaceAnswer(s, 1, 0)).toBe("no");
  });

  it("asks prices in gold by what gold is worth to it, its strength against ours and our influence", () => {
    const s = met();
    s.players[1]!.gold = 100;
    const scale = goldScale(s, 1);
    expect(scale).toBe(20 + 50 + 5); // a city of one: gold means much to a young realm
    // Far the stronger (two phalanxes, 6, to our militia's 2): peace costs the most, open borders the least.
    const peace = peacePrice(s, 1, 0);
    const borders = bordersPrice(s, 1, 0);
    expect(peace).toBe(Math.round((scale * 0.6 * 2) / 10) * 10);
    expect(borders).toBe(Math.round((scale * 0.4 * 0.75) / 10) * 10);
    // A greater realm asks more, as does one that scorns us; one that admires us, less.
    s.cities.find((c) => c.owner === 1)!.size = 12;
    s.players[1]!.gold = 600;
    expect(peacePrice(s, 1, 0)).toBeGreaterThan(peace * 3);
    renowned(s, 1);
    expect(esteem(s, 1, 0)).toBe("scorned");
    const scorned = peacePrice(s, 1, 0);
    s.cities.find((c) => c.owner === 1)!.buildings = [];
    s.cities.find((c) => c.owner === 1)!.wonders = [];
    expect(peacePrice(s, 1, 0)).toBeLessThan(scorned);
    // Selling a resource; looking away from our units on its land, more for more of them.
    expect(resourcePrice(s, 1)).toBe(Math.round((goldScale(s, 1) * 0.5) / 10) * 10);
    setRelation(s, 0, 1, "peace");
    createUnit(s, "militia", 0, 29, 10);
    const one = stayPrice(s, 1, 0);
    createUnit(s, "militia", 0, 29, 11);
    expect(stayPrice(s, 1, 0)).toBeGreaterThan(one);
    for (const p of [peacePrice(s, 1, 0), bordersPrice(s, 1, 0), resourcePrice(s, 1), stayPrice(s, 1, 0)]) expect(p % 10).toBe(0);
  });

  it("warms to a player whose gifts weigh with it, for a while", () => {
    const s = met();
    expect(attitude(s, 1, 0)).toBe("wary");
    s.currentPlayer = 0;
    s.players[0]!.gold = 500;
    applyCommand(s, { type: "giveGold", player: 1, amount: 10 }); // a token: nothing changes
    expect(attitude(s, 1, 0)).toBe("wary");
    applyCommand(s, { type: "giveGold", player: 1, amount: Math.ceil(goldScale(s, 1) / 2) });
    expect(attitude(s, 1, 0)).toBe("friendly");
    expect(peaceAnswer(s, 1, 0)).toBe("yes");
    s.turn += 20;
    expect(attitude(s, 1, 0)).toBe("wary");
    const old = met({ noGoodwill: true });
    old.currentPlayer = 0;
    old.players[0]!.gold = 500;
    applyCommand(old, { type: "giveGold", player: 1, amount: 400 });
    expect(attitude(old, 1, 0)).toBe("wary");
  });

  it("sends a player it thinks well of an offer of peace now and then, and leaves the answer to them", () => {
    const s = met();
    renowned(s, 0);
    let offered: number | undefined;
    for (let t = 0; t < 80 && offered === undefined; t++, s.turn++) {
      plannerTurn(s);
      offered = peaceOffered(s, 1, 0);
    }
    expect(offered).toBeDefined();
    expect(lastTurnEvents).toContainEqual({ kind: "peaceOffer", player: 1, to: 0 });
    expect(relation(s, 0, 1)).toBe("contact");
    for (let t = 0; t < 15; t++, s.turn++) plannerTurn(s);
    expect(peaceOffered(s, 1, 0)).toBe(offered); // not again so soon
  });

  it("sends one envoy a turn to a player, whoever sends it", () => {
    const s = met();
    renowned(s, 0);
    s.peaceOffers = { [`2>0`]: s.turn }; // another civilization's envoy came this turn
    for (let t = 0; t < 40; t++) plannerTurn(s);
    expect(peaceOffered(s, 1, 0)).toBeUndefined();
  });

  it("does not court a player it is wary of", () => {
    const s = met();
    for (let t = 0; t < 30; t++, s.turn++) plannerTurn(s);
    expect(peaceOffered(s, 1, 0)).toBeUndefined();
  });

  it("offers peace to end a war it is losing, where saves before version 15 made it at once", () => {
    for (const old of [false, true]) {
      const s = met(old ? { peaceOnContact: true } : {});
      setRelation(s, 0, 1, "war");
      s.units = s.units.filter((u) => u.owner !== 1);
      for (let i = 0; i < 4; i++) createUnit(s, "legion", 0, 10, 10);
      for (let t = 0; t < 40 && relation(s, 0, 1) === "war" && peaceOffered(s, 1, 0) === undefined; t++, s.turn++) plannerTurn(s);
      if (old) expect(relation(s, 0, 1)).toBe("peace");
      else {
        expect(peaceOffered(s, 1, 0)).toBeDefined();
        expect(relation(s, 0, 1)).toBe("war");
      }
    }
  });

  it("spares a far weaker player whose influence it admires from a war of choice", () => {
    const declared = (admired: boolean): boolean => {
      const s = met({}, 22); // within reach of their legions
      s.turn = 100;
      foundCity(s, 1, 30, 20);
      foundCity(s, 1, 40, 10);
      for (let i = 0; i < 8; i++) createUnit(s, "legion", 1, 30, 10);
      if (admired) renowned(s, 0);
      for (let t = 0; t < 60 && relation(s, 0, 1) !== "war"; t++, s.turn++) plannerTurn(s);
      return relation(s, 0, 1) === "war";
    };
    expect(declared(false)).toBe(true);
    expect(declared(true)).toBe(false);
  });

  it("demands tribute of a player far the weaker, takes a refusal ill, and may go to war over it", () => {
    const s = met(); // two phalanxes (6) against our militia (2): three times as strong, and proud
    s.players[0]!.gold = 200;
    // Too small an army to threaten anyone: nothing asked.
    for (let t = 0; t < 100; t++, s.turn++) courtPlayers(s, 1);
    expect(s.proposals?.["1>0"]).toBeUndefined();
    createUnit(s, "phalanx", 1, 30, 10); // 9 against 2
    let asked = -1;
    for (let t = 0; t < 200 && asked < 0; t++, s.turn++) {
      courtPlayers(s, 1);
      if (s.proposals?.["1>0"]) asked = s.turn;
    }
    // At four and a half times the strength, three eighths of 200, in tens.
    expect(s.proposals?.["1>0"]).toEqual({ kind: "tribute", turn: asked, gold: 70 });
    expect(lastTurnEvents).toContainEqual({ kind: "proposal", player: 1, to: 0, proposal: { kind: "tribute", turn: asked, gold: 70 } });
    s.currentPlayer = 0;
    applyCommand(s, { type: "answer", player: 1, accept: false });
    expect(attitude(s, 1, 0)).toBe("hostile"); // proud, and refused
    // Its turn this round: war, half the time; never again for that refusal.
    s.currentPlayer = 1;
    const wars = [0, 1, 2, 3, 4, 5, 6, 7].map((seed) => {
      const c = structuredClone(s);
      c.rng = createRng(seed);
      courtPlayers(c, 1);
      return relation(c, 0, 1) === "war";
    });
    expect(wars.some(Boolean)).toBe(true);
    expect(wars.every(Boolean)).toBe(false);
    s.turn += ENVOYS.grudgeTurns;
    expect(attitude(s, 1, 0)).toBe("wary");
  });

  it("sends a player it likes a gift now and then, and asks for a resource it lacks", () => {
    const s = met();
    renowned(s, 0);
    expect(attitude(s, 1, 0)).toBe("friendly");
    s.players[1]!.gold = 400;
    let gift: number | undefined;
    for (let t = 0; t < 300 && gift === undefined; t++, s.turn++) {
      courtPlayers(s, 1);
      gift = s.gifts?.["1>0"]?.[0]?.gold;
    }
    expect(gift).toBe(40);
    expect(lastTurnEvents).toContainEqual(expect.objectContaining({ kind: "gift", player: 1, to: 0, gold: 40 }));
    // It learns Iron Working, lacks Iron, and we hold some.
    for (const t of s.map.tiles) delete t.deposit;
    Object.assign(getTile(s.map, 11, 10)!, { special: true, deposit: "Iron" });
    s.players[1]!.advances.push("bronze_working", "iron_working");
    s.gifts = {};
    let ask: unknown;
    for (let t = 0; t < 200 && !ask; t++, s.turn++) {
      courtPlayers(s, 1);
      ask = s.proposals?.["1>0"];
      if (s.gifts?.["1>0"]) s.gifts = {};
    }
    expect(ask).toMatchObject({ kind: "resource", want: "Iron", gold: resourcePrice(s, 0) });
  });

  it("asks nothing of the player in saves before version 38, nor of another computer civilization", () => {
    const s = met({ quietLeaders: true });
    s.players[0]!.gold = 200;
    for (let t = 0; t < 200; t++, s.turn++) courtPlayers(s, 1);
    expect(s.proposals ?? {}).toEqual({});
    const ai = met();
    ai.players[0]!.isAi = true;
    ai.players[0]!.gold = 200;
    for (let t = 0; t < 200; t++, ai.turn++) courtPlayers(ai, 1);
    expect(ai.proposals ?? {}).toEqual({});
  });
});
