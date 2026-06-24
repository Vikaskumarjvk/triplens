/*
 * Tests for trip-engine.js (the Trip Cost Optimizer). Pure-function, Node-run.
 *   node tests-trip.js
 * Loads the real data files into a fake `window` so the engine sees LL_* globals.
 */
"use strict";
const assert = require("assert");

// --- load data + sibling engines into a shared global (window shim) -------
global.window = global;
require("./data/cards.js");
require("./data/lounges.js");
require("./data/flights.js");
require("./data/hotels.js");
require("./data/deals.js");
require("./flight-engine.js");
require("./engine.js");
const T = require("./trip-engine.js");

let pass = 0, fail = 0;
function ok(name, fn) {
  try { fn(); pass++; /* console.log("  ✓", name); */ }
  catch (e) { fail++; console.log("  ✗", name, "\n     " + e.message); }
}

// ---- date helpers --------------------------------------------------------
ok("parseISO valid", () => assert.deepStrictEqual(T.parseISO("2026-07-12"), { y: 2026, mo: 7, d: 12, iso: "2026-07-12" }));
ok("parseISO invalid -> null", () => assert.strictEqual(T.parseISO("nope"), null));
ok("addDays crosses month", () => assert.strictEqual(T.addDays("2026-07-30", 3), "2026-08-02"));
ok("addDays crosses year", () => assert.strictEqual(T.addDays("2026-12-31", 1), "2027-01-01"));
ok("nightsBetween counts", () => assert.strictEqual(T.nightsBetween("2026-07-12", "2026-07-15"), 3));
ok("nightsBetween rejects reverse", () => assert.strictEqual(T.nightsBetween("2026-07-15", "2026-07-12"), null));
ok("ddmmyyyy formats", () => assert.strictEqual(T.ddmmyyyy("2026-07-05"), "05/07/2026"));

// ---- place resolution ----------------------------------------------------
ok("resolvePlace by code", () => assert.deepStrictEqual(T.resolvePlace("DEL", window.LL_FLIGHTS), { code: "DEL", city: "Delhi" }));
ok("resolvePlace by city name", () => assert.strictEqual(T.resolvePlace("Mumbai", window.LL_FLIGHTS).code, "BOM"));
ok("resolvePlace partial city", () => assert.strictEqual(T.resolvePlace("bengal", window.LL_FLIGHTS).code, "BLR"));
ok("resolvePlace unknown keeps raw", () => { const r = T.resolvePlace("Atlantis", window.LL_FLIGHTS); assert.strictEqual(r.city, "Atlantis"); });

// ---- stay deep links -----------------------------------------------------
ok("buildStayLink prefills city+dates", () => {
  const bk = window.LL_HOTELS.providers.find((p) => p.id === "booking");
  const url = T.buildStayLink(bk, "Goa", "2026-07-12", "2026-07-15", 2);
  assert.ok(url.includes("ss=Goa"), "city in url");
  assert.ok(url.includes("checkin=2026-07-12") && url.includes("checkout=2026-07-15"), "dates in url");
});
ok("buildStayLink without dates falls back to origin for date-needing url", () => {
  const bk = window.LL_HOTELS.providers.find((p) => p.id === "booking");
  const url = T.buildStayLink(bk, "Goa", null, null, 2);
  assert.ok(/^https:\/\/www\.booking\.com\/$/.test(url), "stripped to origin when no dates: " + url);
});
ok("buildStayLink search-page provider returns its url untouched-ish", () => {
  const ag = window.LL_HOTELS.providers.find((p) => p.id === "agoda");
  const url = T.buildStayLink(ag, "Goa", "2026-07-12", "2026-07-15", 2);
  assert.strictEqual(url, "https://www.agoda.com/");
});
ok("buildDealLink fills a {CITY}-search deal with the city", () => {
  // getyourguide searches by city via ?q={CITY}; with a city it should appear
  const gyg = window.LL_DEALS.services.find((s) => s.id === "getyourguide");
  const url = T.buildDealLink(gyg, "Goa");
  assert.ok(url.toLowerCase().includes("goa"), "city in deal link: " + url);
});
ok("buildDealLink with no city falls back to a working root (no empty search)", () => {
  const gyg = window.LL_DEALS.services.find((s) => s.id === "getyourguide");
  const url = T.buildDealLink(gyg, "");
  assert.ok(!/\?q=$|\{CITY/.test(url), "no empty query / leftover placeholder: " + url);
});

// ---- offers-for-wallet ---------------------------------------------------
ok("offersForWallet matches issuer in wallet", () => {
  const hdfc = window.LL_CARDS.find((c) => c.issuer === "HDFC");
  assert.ok(hdfc, "have an HDFC card in dataset");
  const mmt = window.LL_HOTELS.providers.find((p) => p.id === "makemytrip-hotels");
  const res = T.offersForWallet(mmt, [hdfc]);
  const hit = res.find((r) => r.offer.issuer === "HDFC");
  assert.ok(hit && hit.inWallet, "HDFC hotel offer marked inWallet");
});
ok("offersForWallet: card offer not held -> inWallet false", () => {
  const mmt = window.LL_HOTELS.providers.find((p) => p.id === "makemytrip-hotels");
  const res = T.offersForWallet(mmt, []); // empty wallet
  assert.ok(res.every((r) => !r.inWallet), "nothing in an empty wallet");
});

// ---- full planTrip -------------------------------------------------------
const plan = T.planTrip(
  { from: "Hyderabad", to: "Goa", depart: "2026-07-12", nights: 3, adults: 2 },
  { wallet: [], visitLog: [], spend: {}, now: new Date("2026-07-01") }
);
ok("planTrip resolves route codes", () => {
  assert.strictEqual(plan.route.from, "HYD");
  assert.strictEqual(plan.route.to, "GOI");
});
ok("planTrip derives checkout from nights", () => {
  assert.strictEqual(plan.dates.nights, 3);
  assert.strictEqual(plan.dates.checkout, "2026-07-15");
});
ok("planTrip returns flight providers", () => assert.ok(plan.flights.length > 0, "has flight options"));
ok("planTrip returns stay providers meta-first", () => {
  assert.ok(plan.stay.length > 0);
  assert.strictEqual(plan.stay[0].provider.type, "meta", "first stay provider is meta");
});
ok("planTrip groups deals by every category", () => {
  const cats = window.LL_DEALS.categories.map((c) => c.id);
  cats.forEach((c) => assert.ok(plan.deals[c] && plan.deals[c].services.length >= 0, "category present: " + c));
  assert.ok(plan.deals.cab.services.length > 0, "cab deals present");
});
ok("planTrip savings checklist is non-empty + has no fabricated rupee total", () => {
  assert.ok(plan.savings.length >= 4, "several levers");
  // honesty: no item should claim a total saved amount (no "₹" followed by digits as a promise)
  const fabricated = plan.savings.find((s) => /₹\s?\d/.test(s.text));
  assert.ok(!fabricated, "no fabricated rupee figure in savings checklist");
});

// ---- bestCard with a real wallet ----------------------------------------
const hdfcCard = window.LL_CARDS.find((c) => c.issuer === "HDFC");
const plan2 = T.planTrip(
  { from: "DEL", to: "BOM", depart: "2026-08-01", nights: 2 },
  { wallet: [hdfcCard.id], now: new Date("2026-07-15") }
);
ok("planTrip bestCard surfaces the held HDFC card", () => {
  assert.ok(plan2.bestCard.length > 0, "has a best card");
  const hasHdfc = plan2.bestCard.some((b) => b.card.issuer === "HDFC");
  assert.ok(hasHdfc, "HDFC card ranked since it has trip offers");
});
ok("planTrip bestCard lists WHERE the card wins", () => {
  assert.ok(plan2.bestCard[0].places.length > 0, "names the booking sites it wins on");
});
ok("planTrip lounges resolve at both ends with a wallet", () => {
  assert.ok(plan2.lounges.origin && plan2.lounges.dest, "both lounge ends present");
  assert.ok(plan2.lounges.origin.total >= 0, "origin lounge total computed");
});

// ---- robustness: missing/garbage input shouldn't throw -------------------
ok("planTrip with empty trip object doesn't throw", () => {
  const p = T.planTrip({}, {});
  assert.ok(p && p.flights && p.stay && p.deals, "returns a shaped plan");
});
ok("planTrip with only cities (no date) defaults 2 nights", () => {
  const p = T.planTrip({ from: "Delhi", to: "Goa", depart: "2026-09-10" }, {});
  assert.strictEqual(p.dates.nights, 2);
  assert.strictEqual(p.dates.checkout, "2026-09-12");
});

console.log(`\n==== ${pass} passed, ${fail} failed ====`);
process.exit(fail ? 1 : 0);
