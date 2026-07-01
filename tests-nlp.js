/* Tests for nlp-engine.js — the natural-language trip parser. node tests-nlp.js
 *
 * This is the crux of the "just type your trip" feature, so it's tested hard:
 *  - city resolution: names, aliases, from/to/in, bare pairs, unknown places
 *  - duration: N days vs N nights vs weeks vs weekend hints
 *  - dates: tomorrow, next week/month, in N days, weekdays, 15 July, DD/MM, ISO
 *  - party size: solo, couple, family of N, "for 2"
 *  - the honesty contract: never invent a city/date the user didn't say; the
 *    `understood` list reflects exactly what was read; missing stays missing
 *  - determinism: same sentence + same today -> identical result
 *
 * A fixed todayISO is passed everywhere so date math is deterministic in tests.
 */
"use strict";
const assert = require("assert");
const NLP = require("./nlp-engine.js");

// the app's real airport set (subset is fine — these are the ones tests touch)
const CITIES = [
  { code: "DEL", city: "Delhi" }, { code: "BOM", city: "Mumbai" },
  { code: "BLR", city: "Bengaluru" }, { code: "HYD", city: "Hyderabad" },
  { code: "GOI", city: "Goa" }, { code: "MAA", city: "Chennai" },
  { code: "CCU", city: "Kolkata" }, { code: "JAI", city: "Jaipur" },
  { code: "COK", city: "Kochi" }, { code: "SXR", city: "Srinagar" },
  { code: "IXZ", city: "Port Blair" }, { code: "VNS", city: "Varanasi" },
  { code: "DXB", city: "Dubai" }, { code: "SIN", city: "Singapore" },
  { code: "BKK", city: "Bangkok" }, { code: "JFK", city: "New York" },
  { code: "VTZ", city: "Visakhapatnam" },
];
const TODAY = "2026-07-02"; // a Thursday
const O = { cities: CITIES, todayISO: TODAY };

let pass = 0, fail = 0;
function ok(n, fn) { try { fn(); pass++; } catch (e) { fail++; console.log("  ✗", n, "\n     " + e.message); } }
function P(text) { return NLP.parseTrip(text, O); }

// ---- the headline sentence -----------------------------------------------
ok("'5 days in Goa from Delhi next month for 2' parses fully", () => {
  const r = P("5 days in Goa from Delhi next month for 2");
  assert.strictEqual(r.to.code, "GOI");
  assert.strictEqual(r.from.code, "DEL");
  assert.strictEqual(r.nights, 4, "5 days -> 4 nights");
  assert.strictEqual(r.adults, 2);
  assert.strictEqual(r.depart, "2026-08-02", "next month");
  assert.ok(r.ready);
  assert.strictEqual(r.missing.length, 0);
});

// ---- city resolution -----------------------------------------------------
ok("a single bare city is the destination", () => {
  const r = P("Goa");
  assert.strictEqual(r.to.code, "GOI");
  assert.strictEqual(r.from, null);
});
ok("'to X' sets destination", () => { assert.strictEqual(P("trip to Jaipur").to.code, "JAI"); });
ok("'in X' sets destination", () => { assert.strictEqual(P("a week in Kochi").to.code, "COK"); });
ok("'from X to Y' splits origin and destination", () => {
  const r = P("from Mumbai to Singapore");
  assert.strictEqual(r.from.code, "BOM");
  assert.strictEqual(r.to.code, "SIN");
});
ok("bare pair 'Delhi Goa' reads first as origin, last as destination", () => {
  const r = P("Delhi Goa 4 days");
  assert.strictEqual(r.from.code, "DEL");
  assert.strictEqual(r.to.code, "GOI");
});
ok("aliases resolve (bombay -> Mumbai, calcutta -> Kolkata, vizag -> Visakhapatnam)", () => {
  assert.strictEqual(P("3 nights in bombay").to.code, "BOM");
  assert.strictEqual(P("trip to calcutta").to.code, "CCU");
  assert.strictEqual(P("vizag for 5 days").to.code, "VTZ");
  assert.strictEqual(P("kashmir next week").to.code, "SXR");
});
ok("multi-word city 'Port Blair' resolves and isn't shadowed", () => {
  assert.strictEqual(P("Port Blair for a week").to.code, "IXZ");
});
ok("unknown destination stays null and is flagged missing (no guessing)", () => {
  const r = P("5 days in Atlantis");
  assert.strictEqual(r.to, null);
  assert.strictEqual(r.ready, false);
  assert.ok(r.missing.indexOf("destination") !== -1);
});
ok("case-insensitive", () => { assert.strictEqual(P("GOA").to.code, "GOI"); assert.strictEqual(P("gOa").to.code, "GOI"); });
// real airport names carry qualifiers ("Goa (Dabolim)", "London Heathrow",
// "New York JFK"). Everyday typing says "goa"/"london"/"new york" — these must
// still resolve, and the label shown back must be the clean base name.
ok("qualified airport names resolve from the plain city (real-data shape)", () => {
  const real = [
    { code: "GOI", city: "Goa (Dabolim)" }, { code: "GOX", city: "Goa (Mopa)" },
    { code: "LHR", city: "London Heathrow" }, { code: "JFK", city: "New York JFK" },
    { code: "DEL", city: "Delhi" },
  ];
  const RO = { cities: real, todayISO: TODAY };
  const g = NLP.parseTrip("5 days in goa from delhi", RO);
  assert.strictEqual(g.to.code, "GOI");
  assert.strictEqual(g.to.city, "Goa", "label is the clean base name, not 'Goa (Dabolim)'");
  assert.strictEqual(g.from.code, "DEL");
  assert.strictEqual(NLP.parseTrip("a week in london", RO).to.code, "LHR");
  const ny = NLP.parseTrip("new york for 4 days", RO);
  assert.strictEqual(ny.to.code, "JFK");
  assert.strictEqual(ny.to.city, "New York");
});
ok("same base name across two airports resolves to the first (no crash/dup)", () => {
  const real = [{ code: "GOI", city: "Goa (Dabolim)" }, { code: "GOX", city: "Goa (Mopa)" }];
  const r = NLP.parseTrip("goa for 3 nights", { cities: real, todayISO: TODAY });
  assert.strictEqual(r.to.code, "GOI", "first Goa airport wins the bare name");
});

// ---- duration ------------------------------------------------------------
ok("'N nights' is literal", () => { assert.strictEqual(P("Goa for 3 nights").nights, 3); });
ok("'N days' -> N-1 nights", () => { assert.strictEqual(P("Goa for 6 days").nights, 5); });
ok("'1 day' -> 1 night floor", () => { assert.strictEqual(P("Goa 1 day").nights, 1); });
ok("'a week' -> 6 nights", () => { assert.strictEqual(P("a week in Kochi").nights, 6); });
ok("'two weeks' -> 13 nights", () => { assert.strictEqual(P("two weeks in Bangkok").nights, 13); });
ok("no duration mentioned -> nights null (not invented)", () => {
  assert.strictEqual(P("Goa next week").nights, null);
});
ok("'in 5 days' is a DATE, never counted as duration", () => {
  const r = P("Goa in 5 days");
  assert.strictEqual(r.nights, null, "no duration typed");
  assert.strictEqual(r.depart, "2026-07-07", "5 days from Thu = Tue");
});

// ---- dates ---------------------------------------------------------------
ok("tomorrow", () => { assert.strictEqual(P("Goa tomorrow").depart, "2026-07-03"); });
ok("day after tomorrow", () => { assert.strictEqual(P("Goa day after tomorrow").depart, "2026-07-04"); });
ok("today / tonight", () => {
  assert.strictEqual(P("Goa today").depart, TODAY);
  assert.strictEqual(P("fly to Goa tonight").depart, TODAY);
});
ok("next week -> next Monday", () => { assert.strictEqual(P("Goa next week").depart, "2026-07-06"); });
ok("next month keeps the day-of-month", () => { assert.strictEqual(P("Goa next month").depart, "2026-08-02"); });
ok("in 2 weeks", () => { assert.strictEqual(P("Goa in 2 weeks").depart, "2026-07-16"); });
ok("in 3 months", () => { assert.strictEqual(P("Goa in 3 months").depart, "2026-10-02"); });
ok("this weekend -> upcoming Saturday + weekend nights hint", () => {
  const r = P("Goa this weekend");
  assert.strictEqual(r.depart, "2026-07-04", "Sat after Thu 2 Jul");
  assert.strictEqual(r.nights, 2, "weekend implies 2 nights when none typed");
});
ok("long weekend -> Friday + 3 nights hint", () => {
  const r = P("Goa long weekend");
  assert.strictEqual(r.depart, "2026-07-03", "Fri after Thu");
  assert.strictEqual(r.nights, 3);
});
ok("explicit nights override a weekend hint", () => {
  const r = P("Goa this weekend for 4 nights");
  assert.strictEqual(r.nights, 4);
});
ok("next friday", () => { assert.strictEqual(P("Goa next friday").depart, "2026-07-10"); });
ok("this saturday", () => { assert.strictEqual(P("Goa this saturday").depart, "2026-07-04"); });
ok("bare weekday 'on monday' -> upcoming Monday", () => { assert.strictEqual(P("Goa on monday").depart, "2026-07-06"); });
ok("15 July -> this year", () => { assert.strictEqual(P("Goa 15 July").depart, "2026-07-15"); });
ok("15th jan -> rolls to next year (already past)", () => { assert.strictEqual(P("Goa 15th jan").depart, "2027-01-15"); });
ok("July 20 (month-first)", () => { assert.strictEqual(P("Goa July 20").depart, "2026-07-20"); });
ok("DD/MM day-first", () => { assert.strictEqual(P("Goa on 15/08").depart, "2026-08-15"); });
ok("DD/MM/YYYY", () => { assert.strictEqual(P("Goa 15/08/2027").depart, "2027-08-15"); });
ok("ISO date passes through", () => { assert.strictEqual(P("Goa 2026-09-01").depart, "2026-09-01"); });
ok("'in July' during a later month -> 1st of July next year", () => {
  const r = NLP.parseTrip("Goa in December", { cities: CITIES, todayISO: TODAY });
  assert.strictEqual(r.depart, "2026-12-01");
});
ok("'in July' during July -> today (doesn't jump forward)", () => {
  const r = NLP.parseTrip("Goa in July", { cities: CITIES, todayISO: TODAY });
  assert.strictEqual(r.depart, TODAY);
});
ok("no date mentioned -> depart null (not invented)", () => {
  assert.strictEqual(P("Goa for 5 days").depart, null);
});

// ---- party size ----------------------------------------------------------
ok("solo", () => { assert.strictEqual(P("solo trip to Goa").adults, 1); });
ok("couple", () => { assert.strictEqual(P("Goa for a couple").adults, 2); });
ok("'me and my wife'", () => { assert.strictEqual(P("Goa with me and my wife").adults, 2); });
ok("family of 4", () => { assert.strictEqual(P("Goa family of 4").adults, 4); });
ok("'2 people'", () => { assert.strictEqual(P("Goa for 2 people").adults, 2); });
ok("'for 3'", () => { assert.strictEqual(P("Goa for 3").adults, 3); });
ok("no party mentioned -> adults null", () => { assert.strictEqual(P("Goa for 5 days").adults, null); });

// ---- honesty contract ----------------------------------------------------
ok("understood list mirrors exactly what was parsed, nothing more", () => {
  const r = P("Goa");
  const keys = r.understood.map((u) => u.key);
  assert.deepStrictEqual(keys, ["to"], "only the destination was understood");
});
ok("understood carries the destination first", () => {
  const r = P("5 days in Goa from Delhi tomorrow for 2");
  assert.strictEqual(r.understood[0].key, "to");
  const keys = r.understood.map((u) => u.key).sort();
  assert.deepStrictEqual(keys, ["adults", "depart", "from", "nights", "to"]);
});
ok("nothing is understood from an empty / junk string", () => {
  assert.strictEqual(P("").understood.length, 0);
  assert.strictEqual(P("   ").ready, false);
  assert.strictEqual(P("asdf qwerty zzz").to, null);
});

// ---- resolve() fills only physical needs, flagging defaults --------------
ok("resolve fills nights + depart with flagged defaults when missing", () => {
  const parsed = P("Goa");
  const t = NLP.resolve(parsed, { todayISO: TODAY });
  assert.strictEqual(t.to.code, "GOI");
  assert.strictEqual(t.nights, 3, "default nights");
  assert.ok(t.depart, "a depart date is filled");
  assert.strictEqual(t.assumed.length, 2, "both nights and depart flagged as assumed");
  assert.ok(t.assumed.some((a) => a.key === "nights"));
  assert.ok(t.assumed.some((a) => a.key === "depart"));
});
ok("resolve keeps user values and flags nothing when all supplied", () => {
  const parsed = P("Goa for 5 nights on 15 July for 2");
  const t = NLP.resolve(parsed, { todayISO: TODAY });
  assert.strictEqual(t.nights, 5);
  assert.strictEqual(t.depart, "2026-07-15");
  assert.strictEqual(t.adults, 2);
  assert.strictEqual(t.assumed.length, 0, "nothing assumed");
});
ok("resolve default depart is a real upcoming Saturday", () => {
  const t = NLP.resolve(P("Goa"), { todayISO: TODAY });
  assert.strictEqual(t.depart, "2026-07-04");
});

// ---- determinism ---------------------------------------------------------
ok("same sentence + same today -> identical parse", () => {
  const a = JSON.stringify(P("5 days in Goa from Delhi next month for 2"));
  const b = JSON.stringify(P("5 days in Goa from Delhi next month for 2"));
  assert.strictEqual(a, b);
});
ok("no cities list -> resolves no places but doesn't crash", () => {
  const r = NLP.parseTrip("5 days in Goa tomorrow", { todayISO: TODAY });
  assert.strictEqual(r.to, null);
  assert.strictEqual(r.nights, 4);
  assert.strictEqual(r.depart, "2026-07-03");
});
ok("no todayISO -> dates skipped, cities + duration still parse", () => {
  const r = NLP.parseTrip("5 days in Goa tomorrow", { cities: CITIES });
  assert.strictEqual(r.to.code, "GOI");
  assert.strictEqual(r.nights, 4);
  assert.strictEqual(r.depart, null, "no clock -> no date invented");
});

// ---- realistic messy sentences -------------------------------------------
ok("'planning a quick 3 day getaway to goa with the family next weekend'", () => {
  const r = P("planning a quick 3 day getaway to goa with the family next weekend");
  assert.strictEqual(r.to.code, "GOI");
  assert.strictEqual(r.nights, 2, "3 day -> 2 nights");
  assert.strictEqual(r.depart, "2026-07-11", "next weekend Saturday");
});
ok("'me and 3 friends want to go bangalore for a week in august'", () => {
  const r = P("me and 3 friends want to go bangalore for a week in august");
  assert.strictEqual(r.to.code, "BLR");
  assert.strictEqual(r.nights, 6);
  assert.strictEqual(r.depart, "2026-08-01");
});
ok("'srinagar 10 days from delhi'", () => {
  const r = P("srinagar 10 days from delhi");
  assert.strictEqual(r.to.code, "SXR");
  assert.strictEqual(r.from.code, "DEL");
  assert.strictEqual(r.nights, 9);
});

console.log(`\n==== ${pass} passed, ${fail} failed ====`);
process.exit(fail ? 1 : 0);
