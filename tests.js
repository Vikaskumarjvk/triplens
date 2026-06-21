/* Node self-test for the engine. Run: node tests.js */
const path = require("path");

// shim window so the data files (which assign window.LL_*) work under node
global.window = global;
require(path.join(__dirname, "data", "cards.js"));
require(path.join(__dirname, "data", "lounges.js"));
const E = require(path.join(__dirname, "engine.js"));

const CARDS = global.LL_CARDS;
const LOUNGES = global.LL_LOUNGES;

let pass = 0, fail = 0;
function ok(name, cond) {
  if (cond) { pass++; console.log("  PASS:", name); }
  else { fail++; console.log("  FAIL:", name); }
}

const NOW = new Date("2026-06-21T10:00:00");

console.log("\n[1] period bucketing");
ok("June 2026 is Q2", E.periodKey("quarter", NOW) === "2026-Q2");
ok("year bucket", E.periodKey("year", NOW) === "2026");

console.log("\n[2] remainingVisits decrements within a quarter");
{
  const card = CARDS.find((c) => c.id === "axis-myzone"); // 1/quarter
  const log = [{ cardId: "axis-myzone", loungeId: "del-t3-encalm", ts: "2026-06-01" }];
  const r = E.remainingVisits(card, log, NOW);
  ok("1 allowance, 1 used => 0 left", r.allowance === 1 && r.used === 1 && r.left === 0);
  const r2 = E.remainingVisits(card, [], NOW);
  ok("empty log => 1 left", r2.left === 1);
  // a visit from a PRIOR quarter must not count
  const r3 = E.remainingVisits(card, [{ cardId: "axis-myzone", ts: "2026-01-15" }], NOW);
  ok("prior-quarter visit ignored", r3.left === 1);
}

console.log("\n[3] unlimited cards");
{
  const inf = CARDS.find((c) => c.id === "hdfc-infinia");
  const r = E.remainingVisits(inf, [{ cardId: "hdfc-infinia", ts: "2026-06-01" }], NOW);
  ok("unlimited stays unlimited", r.unlimited === true && r.left === Infinity);
}

console.log("\n[4] spend-gate trap");
{
  const mil = CARDS.find((c) => c.id === "hdfc-millennia"); // gate 100000/quarter
  const blocked = E.spendStatus(mil, { "hdfc-millennia": 50000 });
  ok("under spend => gated & not met", blocked.gated && !blocked.met && blocked.shortfall === 50000);
  const met = E.spendStatus(mil, { "hdfc-millennia": 120000 });
  ok("over spend => met", met.met === true);
  const noGate = E.spendStatus(CARDS.find((c) => c.id === "axis-myzone"), {});
  ok("no-gate card always met", noGate.met === true && noGate.gated === false);
}

console.log("\n[5] cardsForLounge picks the usable card and shows the rail");
{
  const lounge = LOUNGES.find((l) => l.id === "del-t3-encalm");
  const wallet = ["amazon-icici", "axis-myzone", "hdfc-infinia"]; // icici has no rails
  const matches = E.cardsForLounge(lounge, wallet, CARDS, [], {}, NOW);
  ok("icici (no rails) excluded", !matches.some((m) => m.card.id === "amazon-icici"));
  ok("infinia + myzone match", matches.length === 2);
  ok("best match is usable", matches[0].usable === true);
  ok("shows shared rail", matches[0].sharedRails.length > 0);
}

console.log("\n[6] cardsForLounge marks gated card unusable");
{
  const lounge = LOUNGES.find((l) => l.id === "del-t3-encalm");
  const wallet = ["hdfc-millennia"]; // gated, mastercard rail matches
  const blocked = E.cardsForLounge(lounge, wallet, CARDS, [], { "hdfc-millennia": 0 }, NOW);
  ok("millennia matches lounge by rail", blocked.length === 1);
  ok("but unusable due to unmet spend gate", blocked[0].usable === false);
  const unblocked = E.cardsForLounge(lounge, wallet, CARDS, [], { "hdfc-millennia": 100000 }, NOW);
  ok("usable once spend met", unblocked[0].usable === true);
}

console.log("\n[7] walletSummary rolls up visits + flags at-risk gates");
{
  const wallet = ["axis-myzone", "axis-ace", "hdfc-millennia", "hdfc-infinia"];
  const s = E.walletSummary(wallet, CARDS, [], { "hdfc-millennia": 0 }, NOW);
  ok("has unlimited (infinia)", s.hasUnlimited === true);
  // myzone 1/q + ace 4/yr = 5 finite left (millennia gated out, infinia unlimited not counted)
  ok("finite total left = 5", s.totalLeft === 5);
  ok("one gate at risk (millennia)", s.gatedBlocked === 1);
}

console.log("\n[8] coverage counts open lounges");
{
  const wallet = ["axis-myzone"]; // dreamfolks + mastercard
  const cov = E.coverage(wallet, CARDS, LOUNGES, [], {}, NOW, { type: "airport" });
  ok("opens at least some airport lounges", cov.openCount > 0);
  ok("does not exceed total", cov.openCount <= cov.total);
}

console.log("\n[9] recommender ranks easy + high-marginal-coverage cards");
{
  const wallet = []; // nothing yet
  const recs = E.recommend(wallet, CARDS, LOUNGES, {});
  ok("returns recommendations", recs.length > 0);
  ok("top rec has positive score", recs[0].score > 0);
  // easyOnly should drop low-ease premium cards
  const easy = E.recommend(wallet, CARDS, LOUNGES, { easyOnly: true });
  ok("easyOnly excludes Infinia (ease 1)", !easy.some((r) => r.card.id === "hdfc-infinia"));
  ok("easyOnly keeps an ease>=4 card", easy.length > 0 && easy[0].card.ease >= 4);
  // never recommend a card you can't apply for anymore
  ok("recommender excludes discontinued cards", !recs.some((r) => r.card.discontinued));
}

console.log("\n[10] railway path works end to end");
{
  const lounge = LOUNGES.find((l) => l.id === "rail-ndls");
  const wallet = ["rupay-select"]; // rupay + railway
  const matches = E.cardsForLounge(lounge, wallet, CARDS, [], {}, NOW);
  ok("rupay select opens railway lounge", matches.length === 1 && matches[0].usable);
}

console.log("\n[11] cities() returns distinct sorted cities with counts");
{
  const cs = E.cities(LOUNGES);
  ok("returns cities", cs.length > 0);
  ok("sorted", cs.map((c) => c.city).join("|") === cs.map((c) => c.city).slice().sort((a, b) => a.localeCompare(b)).join("|"));
  const delhi = cs.find((c) => c.city === "Delhi");
  ok("Delhi has multiple airport lounges", delhi && delhi.airport >= 2);
}

console.log("\n[12] planTrip marks covered / gap / blocked per city");
{
  // wallet opens Delhi (myzone dreamfolks) but NOT a city with only premium-rail lounges
  const wallet = ["axis-myzone"];
  const trip = E.planTrip(["Delhi", "Atlantis"], wallet, CARDS, LOUNGES, [], {}, NOW);
  const delhi = trip.plan.find((p) => p.city === "Delhi");
  const fake = trip.plan.find((p) => p.city === "Atlantis");
  ok("Delhi covered", delhi.status === "covered");
  ok("unknown city => no-lounge", fake.status === "no-lounge");
  ok("covered count >= 1", trip.covered >= 1);
}

console.log("\n[13] planTrip flags a blocked leg (card present but spend gate locked)");
{
  const wallet = ["hdfc-millennia"]; // gated
  const trip = E.planTrip(["Delhi"], wallet, CARDS, LOUNGES, [], { "hdfc-millennia": 0 }, NOW);
  const delhi = trip.plan.find((p) => p.city === "Delhi");
  ok("Delhi blocked when gate unmet", delhi.status === "blocked");
  ok("blocked leg appears in gaps", trip.gaps.some((g) => g.city === "Delhi"));
  // once spend met it becomes covered
  const trip2 = E.planTrip(["Delhi"], wallet, CARDS, LOUNGES, [], { "hdfc-millennia": 100000 }, NOW);
  ok("Delhi covered once gate met", trip2.plan[0].status === "covered");
}

console.log("\n[14] recommendForTrip suggests a card that fixes the trip gap");
{
  const wallet = []; // nothing
  const recs = E.recommendForTrip(["Delhi", "Mumbai"], wallet, CARDS, LOUNGES, {});
  ok("returns trip recs", recs.length > 0);
  ok("top trip rec opens trip lounges", recs[0].marginalCoverage > 0);
}

console.log("\n[15] airports() groups lounges and counts open per airport");
{
  const wallet = ["rupay-select"]; // dreamfolks+rupay opens lots
  const ap = E.airports(LOUNGES, wallet, CARDS, [], {}, NOW);
  ok("returns groups", ap.length > 0);
  const hyd = ap.find((g) => g.code === "HYD" && g.type === "airport");
  ok("HYD group exists", !!hyd);
  ok("HYD has multiple lounges", hyd && hyd.lounges.length >= 2);
  ok("openCount computed", hyd && typeof hyd.openCount === "number");
  ok("railway grouped separately", ap.some((g) => g.type === "railway"));
}

console.log("\n[16] compareCards head-to-head");
{
  const cmp = E.compareCards("hdfc-infinia", "axis-myzone", CARDS, LOUNGES);
  ok("returns comparison", !!cmp);
  ok("has 5 rows", cmp.rows.length === 5);
  ok("infinia (unlimited, more coverage) wins overall", cmp.overall === "A");
  ok("visits row won by infinia", cmp.rows.find((r) => r.key === "visits").winner === "A");
  // no-spend-gate beats spend-gate
  const cmp2 = E.compareCards("axis-myzone", "hdfc-millennia", CARDS, LOUNGES); // myzone no gate, millennia gated
  ok("no-gate card wins spendgate row", cmp2.rows.find((r) => r.key === "spendgate").winner === "A");
  ok("bad ids return null", E.compareCards("nope", "axis-myzone", CARDS, LOUNGES) === null);
}

console.log("\n[17] valueCalc — does the fee pay off?");
{
  // card with 8/year, fee 5000, you take 10 trips, each lounge worth 1500
  const card = CARDS.find((c) => c.id === "amex-plat-travel"); // 8/year
  const v = E.valueCalc(card, 10, 1500, 5000);
  ok("visits capped at allowance (8 not 10)", v.visitsUsed === 8);
  ok("benefit = 8*1500 = 12000", v.benefit === 12000);
  ok("net = 12000-5000 = 7000", v.net === 7000);
  ok("worth it", v.worthIt === true);
  ok("breakeven trips computed", v.breakevenTrips === Math.ceil(5000 / 1500));
  // few trips -> not worth it
  const v2 = E.valueCalc(card, 1, 1000, 5000);
  ok("1 trip vs 5000 fee => not worth it", v2.worthIt === false && v2.net < 0);
  // unlimited card uses trips directly
  const inf = CARDS.find((c) => c.id === "hdfc-infinia");
  const v3 = E.valueCalc(inf, 20, 1000, 12500);
  ok("unlimited uses all trips", v3.visitsUsed === 20 && v3.benefit === 20000);
}

console.log("\n[18] bestCardOrder — which card to use first");
{
  const lounge = LOUNGES.find((l) => l.id === "del-t3-encalm");
  // wallet: unlimited infinia + finite myzone. infinia should be used first.
  const wallet = ["hdfc-infinia", "axis-myzone"];
  const matches = E.cardsForLounge(lounge, wallet, CARDS, [], {}, NOW);
  const order = E.bestCardOrder(matches);
  ok("returns usable cards", order.length === 2);
  ok("unlimited card flagged useFirst", order[0].quota.unlimited === true && order[0].useFirst === true);
  ok("only one useFirst", order.filter((o) => o.useFirst).length === 1);
}

console.log(`\n==== ${pass} passed, ${fail} failed ====\n`);
process.exit(fail === 0 ? 0 : 1);
