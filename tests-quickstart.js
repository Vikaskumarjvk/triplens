/* Tests for quickstart-engine.js — the one-tap newbie front door. */
const QS = require("./quickstart-engine.js");
const DESTS = require("./data/destinations.js");

let pass = 0, fail = 0;
function ok(name, cond) { if (cond) { pass++; } else { fail++; console.log("FAIL:", name); } }
function eq(name, a, b) { ok(name + " (" + JSON.stringify(a) + " === " + JSON.stringify(b) + ")", a === b); }

// ---- isoPlusDays: deterministic, UTC, no drift ----
eq("isoPlusDays +0", QS.isoPlusDays("2026-06-29", 0), "2026-06-29");
eq("isoPlusDays +1", QS.isoPlusDays("2026-06-29", 1), "2026-06-30");
eq("isoPlusDays +14", QS.isoPlusDays("2026-06-29", 14), "2026-07-13");
eq("isoPlusDays crosses month", QS.isoPlusDays("2026-06-29", 5), "2026-07-04");
eq("isoPlusDays crosses year", QS.isoPlusDays("2026-12-29", 5), "2027-01-03");
eq("isoPlusDays leap day", QS.isoPlusDays("2028-02-28", 1), "2028-02-29");
eq("isoPlusDays bad input", QS.isoPlusDays("nonsense", 3), "");
eq("isoPlusDays empty", QS.isoPlusDays("", 3), "");
// determinism: same inputs, same output, every time
ok("isoPlusDays deterministic", QS.isoPlusDays("2026-06-29", 14) === QS.isoPlusDays("2026-06-29", 14));

// ---- featured chips: only real, profiled places ----
const chips = QS.featured(DESTS);
ok("featured returns a non-empty list", chips.length > 0);
ok("featured is short enough for a newbie (<=8)", chips.length <= 8);
ok("every chip has a real city", chips.every((c) => c.city && c.city.length > 0));
ok("every chip code resolves in DEST", chips.every((c) => DESTS.get(c.code) && DESTS.get(c.code).city));
ok("every chip city matches its DEST profile", chips.every((c) => DESTS.get(c.code).city === c.city));
ok("every chip has a knownFor line (honest character)", chips.every((c) => typeof c.knownFor === "string" && c.knownFor.length > 0));
ok("every chip has an emoji", chips.every((c) => c.emoji && c.emoji.length > 0));
// no duplicate destinations in the band
ok("no duplicate chip codes", new Set(chips.map((c) => c.code)).size === chips.length);

// a destData with no profiles yields no chips (graceful, not a crash)
const emptyDest = { get: () => null };
eq("featured with no profiles is empty", QS.featured(emptyDest).length, 0);
ok("featured with null destData does not throw", (() => { try { QS.featured(null); return true; } catch (e) { return false; } })());

// ---- quickTrip: one tap -> complete, plan-able spec, zero typing ----
const t = QS.quickTrip("GOI", DESTS, "2026-06-29");
eq("quickTrip city", t.city, "Goa");
eq("quickTrip to == city", t.to, "Goa");
eq("quickTrip code", t.code, "GOI");
eq("quickTrip default depart (+14)", t.depart, "2026-07-13");
eq("quickTrip default nights", t.nights, 3);
eq("quickTrip default adults", t.adults, 2);
eq("quickTrip from is blank (origin optional)", t.from, "");
ok("quickTrip marks defaulted (UI shows editable hint)", t.defaulted === true);
ok("quickTrip carries the honest knownFor", t.knownFor === DESTS.get("GOI").knownFor);

// custom opts respected
const t2 = QS.quickTrip("DXB", DESTS, "2026-06-29", { leadDays: 30, nights: 5, adults: 1 });
eq("quickTrip custom depart (+30)", t2.depart, "2026-07-29");
eq("quickTrip custom nights", t2.nights, 5);
eq("quickTrip custom adults", t2.adults, 1);

// guards: never produce nights<1 or adults<1
const t3 = QS.quickTrip("JAI", DESTS, "2026-06-29", { nights: 0, adults: 0 });
ok("quickTrip clamps nights to >=1", t3.nights >= 1);
ok("quickTrip clamps adults to >=1", t3.adults >= 1);

// unknown code: still returns a usable spec (city falls back to the code)
const t4 = QS.quickTrip("ZZZ", DESTS, "2026-06-29");
eq("quickTrip unknown city falls back to code", t4.city, "ZZZ");
ok("quickTrip unknown still has a depart date", t4.depart.length === 10);

// ---- HONESTY: a quick-start spec invents no price/fare/total/venue ----
const banned = ["price", "total", "fare", "cost", "amount", "inr", "venue", "rating", "hours"];
const blob = JSON.stringify(QS.quickTrip("GOI", DESTS, "2026-06-29")).toLowerCase();
ok("quickTrip spec carries no fabricated price/venue fields", !banned.some((b) => blob.includes('"' + b + '"')));

// ---- surprise(): random-but-pure featured pick ----
const sp0 = QS.surprise(DESTS, 0);
ok("surprise returns a real featured place", sp0 && DESTS.get(sp0.code) && DESTS.get(sp0.code).city === sp0.city);
ok("surprise deterministic for same seed", QS.surprise(DESTS, 5).code === QS.surprise(DESTS, 5).code);
ok("surprise varies across seeds", new Set([0,1,2,3,4,5,6,7].map((s) => QS.surprise(DESTS, s).code)).size > 1);
ok("surprise never repeats the avoided code", (() => {
  for (let s = 0; s < 30; s++) { const r = QS.surprise(DESTS, s, "GOI"); if (r.code === "GOI") return false; } return true;
})());
ok("surprise handles negative seed", QS.surprise(DESTS, -3) && QS.surprise(DESTS, -3).code.length === 3);
ok("surprise with no profiles returns null", QS.surprise({ get: () => null }, 0) === null);
ok("surprise picks are all real featured entries", [10,20,30,40].every((s) => { const r = QS.surprise(DESTS, s); return r && r.emoji && r.knownFor; }));

console.log("==== " + pass + " passed, " + fail + " failed ====");
if (fail) process.exit(1);
