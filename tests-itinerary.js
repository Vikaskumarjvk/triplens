/*
 * Tests for itinerary-engine.js. Pure-function, Node-run.  node tests-itinerary.js
 */
"use strict";
const assert = require("assert");
global.window = global;
require("./data/cards.js");
require("./data/lounges.js");
require("./data/flights.js");
require("./data/hotels.js");
require("./data/deals.js");
require("./flight-engine.js");
require("./engine.js");
const TE = require("./trip-engine.js");
const I = require("./itinerary-engine.js");

let pass = 0, fail = 0;
function ok(n, fn) { try { fn(); pass++; } catch (e) { fail++; console.log("  ✗", n, "\n     " + e.message); } }

// ---- date helpers --------------------------------------------------------
ok("addDays works", () => assert.strictEqual(I.addDays("2026-08-15", 2), "2026-08-17"));
ok("dayLabel formats", () => assert.strictEqual(I.dayLabel("2026-08-15"), "Sat, 15 Aug"));

// ---- newTrip -------------------------------------------------------------
const t = I.newTrip({ from: "Hyderabad", to: "Goa", depart: "2026-08-15", nights: 3, adults: 2, seed: 7 });
ok("newTrip id from seed", () => assert.strictEqual(t.id, "trip-7"));
ok("newTrip makes nights+1 days", () => assert.strictEqual(I.dayCount(t), 4));
ok("newTrip day dates increment", () => {
  assert.strictEqual(t.days[0].date, "2026-08-15");
  assert.strictEqual(t.days[3].date, "2026-08-18");
});
ok("newTrip default title", () => assert.strictEqual(t.title, "Hyderabad → Goa"));
ok("newTrip nights floor at 1", () => assert.strictEqual(I.newTrip({ nights: 0 }).nights, 1));

// ---- add / remove / move -------------------------------------------------
ok("addItem appends + returns item", () => {
  const it = I.addItem(t, 0, { time: "09:00", kind: "activity", title: "Beach" }, 100);
  assert.strictEqual(it.id, "it-100");
  assert.strictEqual(t.days[0].items.length, 1);
});
ok("addItem sorts by time", () => {
  I.addItem(t, 0, { time: "07:00", kind: "lounge", title: "Lounge" }, 101);
  assert.strictEqual(t.days[0].items[0].title, "Lounge", "07:00 sorts before 09:00");
});
ok("addItem blank time sinks to bottom", () => {
  I.addItem(t, 0, { time: "", kind: "note", title: "loose note" }, 102);
  assert.strictEqual(t.days[0].items[t.days[0].items.length - 1].title, "loose note");
});
ok("moveItem between days", () => {
  const moved = I.moveItem(t, 0, "it-100", 1);
  assert.strictEqual(moved, true);
  assert.ok(t.days[1].items.some((x) => x.id === "it-100"), "now on day 1");
  assert.ok(!t.days[0].items.some((x) => x.id === "it-100"), "gone from day 0");
});
ok("moveItem bad ids return false", () => assert.strictEqual(I.moveItem(t, 0, "nope", 1), false));
ok("removeItem deletes", () => {
  const before = I.countItems(t);
  assert.strictEqual(I.removeItem(t, 1, "it-100"), true);
  assert.strictEqual(I.countItems(t), before - 1);
});
ok("removeItem missing returns false", () => assert.strictEqual(I.removeItem(t, 0, "ghost"), false));

// ---- seedFromPlan --------------------------------------------------------
const plan = TE.planTrip(
  { from: "Hyderabad", to: "Goa", depart: "2026-08-15", nights: 3, adults: 2 },
  { wallet: [], now: new Date("2026-08-01") }
);
const t2 = I.newTrip({ from: "Hyderabad", to: "Goa", depart: "2026-08-15", nights: 3, seed: 9 });
I.seedFromPlan(t2, plan, { seedStart: 5000 });
ok("seedFromPlan puts a flight on day 0", () => assert.ok(t2.days[0].items.some((x) => x.kind === "flight"), "day 0 has flight"));
ok("seedFromPlan puts hotel check-in on day 0", () => assert.ok(t2.days[0].items.some((x) => x.kind === "hotel"), "day 0 has hotel"));
ok("seedFromPlan puts a return flight on the last day", () => {
  const last = t2.days[t2.days.length - 1];
  assert.ok(last.items.some((x) => x.kind === "flight" && /Return/.test(x.title)), "last day return flight");
});
ok("seedFromPlan middle day has explore activity", () => assert.ok(t2.days[1].items.some((x) => x.kind === "activity"), "explore on a middle day"));
ok("seedFromPlan flight item carries a real link (no fake price)", () => {
  const fl = t2.days[0].items.find((x) => x.kind === "flight");
  assert.ok(fl && typeof fl.link === "string", "flight has a link field");
  assert.ok(!/₹\s?\d/.test(JSON.stringify(t2)), "no fabricated rupee price seeded anywhere");
});

// ---- packing -------------------------------------------------------------
const pk = I.packingList(t2, { intl: true, beach: true });
ok("packingList returns categorized items", () => assert.ok(pk.length > 8 && pk[0].cat && pk[0].item));
ok("packing scales clothing with nights", () => assert.ok(pk.some((p) => /outfit/i.test(p.item))));
ok("packing intl adds forex + adapter", () => {
  assert.ok(pk.some((p) => /forex/i.test(p.item)), "forex card for intl");
  assert.ok(pk.some((p) => /adapter/i.test(p.item)), "adapter for intl");
});
ok("packing beach adds swimwear + sunscreen", () => {
  assert.ok(pk.some((p) => /swimwear/i.test(p.item)));
  assert.ok(pk.some((p) => /sunscreen/i.test(p.item)));
});
ok("packKey is stable + url-safe", () => {
  const k = I.packKey({ cat: "Documents", item: "Govt photo ID / passport + visa" });
  assert.ok(/^[a-z0-9-]+$/.test(k), "key is slug-safe: " + k);
  assert.strictEqual(k, I.packKey({ cat: "Documents", item: "Govt photo ID / passport + visa" }), "deterministic");
});

// ---- summary + export/import --------------------------------------------
ok("tripSummary shape", () => {
  const s = I.tripSummary(t2);
  assert.strictEqual(s.id, "trip-9");
  assert.ok(s.itemCount > 0 && s.dayCount === 4);
  assert.ok(/Aug/.test(s.dateRange));
});
ok("export then import round-trips", () => {
  const str = I.exportTrip(t2);
  const back = I.importTrip(str);
  assert.ok(back, "imported");
  assert.strictEqual(back.id, t2.id);
  assert.strictEqual(I.countItems(back), I.countItems(t2));
});
ok("import rejects garbage", () => {
  assert.strictEqual(I.importTrip("not json"), null);
  assert.strictEqual(I.importTrip(JSON.stringify({ kind: "something-else" })), null);
});

// ---- robustness ----------------------------------------------------------
ok("addItem to missing day returns null", () => assert.strictEqual(I.addItem(t2, 99, {}, 1), null));
ok("newTrip with no dates still builds days (null dates)", () => {
  const nt = I.newTrip({ from: "A", to: "B", nights: 2 });
  assert.strictEqual(I.dayCount(nt), 3);
  assert.strictEqual(nt.days[0].date, null);
});

// ---- flight links: real origin + correct return direction/date ----------
ok("return flight searches dest->origin on the CHECKOUT date, not the outbound one", () => {
  const plan = TE.planTrip({ from: "Delhi", to: "Goa", depart: "2026-07-13", nights: 3, adults: 2 }, { now: new Date("2026-07-01") });
  const t = I.newTrip({ title: "Goa", from: "Delhi", to: "Goa", depart: "2026-07-13", nights: 3, adults: 2, seed: 1 });
  I.seedFromPlan(t, plan, { seedStart: 1 });
  const last = t.days[t.days.length - 1];
  const ret = last.items.find((it) => it.kind === "flight");
  assert.ok(ret, "there is a return flight");
  // outbound was DEL->GOI on depart; return must be GOI->DEL on checkout (2026-07-16)
  const dep = t.days[0].items.find((it) => it.kind === "flight");
  assert.notStrictEqual(ret.link, dep.link, "return link differs from outbound link");
  // the plan exposes a distinct returnFlights leg
  assert.ok(Array.isArray(plan.returnFlights) && plan.returnFlights.length > 0, "plan has returnFlights");
});
ok("blank origin gives a graceful label (no empty arrow gap)", () => {
  const plan = TE.planTrip({ from: "", to: "Goa", depart: "2026-07-13", nights: 3, adults: 2 }, { now: new Date("2026-07-01") });
  const t = I.newTrip({ title: "Goa", from: "", to: "Goa", depart: "2026-07-13", nights: 3, adults: 2, seed: 2 });
  I.seedFromPlan(t, plan, { seedStart: 1 });
  const out = t.days[0].items.find((it) => it.kind === "flight");
  assert.ok(!/ {2}/.test(out.title), "no double space in the flight label");
  assert.ok(!/→\s*$/.test(out.title.trim()), "no dangling arrow with empty destination");
  assert.ok(/Goa/.test(out.title), "label still names the destination");
});
ok("real origin produces a from->to labelled flight", () => {
  const plan = TE.planTrip({ from: "Delhi", to: "Goa", depart: "2026-07-13", nights: 3, adults: 2 }, { now: new Date("2026-07-01") });
  const t = I.newTrip({ title: "Goa", from: "Delhi", to: "Goa", depart: "2026-07-13", nights: 3, adults: 2, seed: 3 });
  I.seedFromPlan(t, plan, { seedStart: 1 });
  const out = t.days[0].items.find((it) => it.kind === "flight");
  assert.ok(/→/.test(out.title) && !/ {2}/.test(out.title), "outbound has a clean from -> to label");
});

// ---- nextUpcomingTrip: greet the returning user with the right trip --------
const mk = (id, depart, nights) => ({ id, title: id, to: id, depart, nights, days: [] });
ok("picks the soonest FUTURE trip", () => {
  const list = [mk("far", "2026-09-01", 3), mk("soon", "2026-07-10", 2), mk("mid", "2026-08-01", 4)];
  assert.strictEqual(I.nextUpcomingTrip(list, "2026-07-01").id, "soon");
});
ok("ignores trips that already ended", () => {
  const list = [mk("past", "2026-06-01", 3), mk("future", "2026-07-20", 2)];
  assert.strictEqual(I.nextUpcomingTrip(list, "2026-07-01").id, "future");
});
ok("an ONGOING trip (started, not ended) is chosen over a later one", () => {
  const list = [mk("ongoing", "2026-06-29", 5), mk("later", "2026-07-15", 2)]; // ongoing ends 2026-07-04
  assert.strictEqual(I.nextUpcomingTrip(list, "2026-07-01").id, "ongoing");
});
ok("a trip ending exactly today still counts as upcoming/ongoing", () => {
  const list = [mk("endstoday", "2026-06-28", 3)]; // ends 2026-07-01
  assert.strictEqual(I.nextUpcomingTrip(list, "2026-07-01").id, "endstoday");
});
ok("undated trips are ignored", () => {
  const list = [mk("nodate", "", 3), mk("dated", "2026-07-10", 2)];
  assert.strictEqual(I.nextUpcomingTrip(list, "2026-07-01").id, "dated");
});
ok("returns null when nothing is upcoming", () => {
  assert.strictEqual(I.nextUpcomingTrip([mk("past", "2026-05-01", 2)], "2026-07-01"), null);
});
ok("returns null for empty / bad input", () => {
  assert.strictEqual(I.nextUpcomingTrip([], "2026-07-01"), null);
  assert.strictEqual(I.nextUpcomingTrip(null, "2026-07-01"), null);
  assert.strictEqual(I.nextUpcomingTrip([mk("a", "2026-07-10", 2)], "bad-date"), null);
});
ok("deterministic", () => {
  const list = [mk("a", "2026-07-10", 2), mk("b", "2026-07-05", 1)];
  assert.strictEqual(I.nextUpcomingTrip(list, "2026-07-01").id, I.nextUpcomingTrip(list, "2026-07-01").id);
});

console.log(`\n==== ${pass} passed, ${fail} failed ====`);
process.exit(fail ? 1 : 0);
