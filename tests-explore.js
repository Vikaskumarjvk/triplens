/* Tests for explore-engine.js ("Where to?" destination ranker). node tests-explore.js */
"use strict";
const assert = require("assert");
const X = require("./explore-engine.js");

let pass = 0, fail = 0;
function ok(n, fn) { try { fn(); pass++; } catch (e) { fail++; console.log("  ✗", n, "\n     " + e.message); } }

// fake distance table (km) from DEL
const KM = { "DEL>JAI": 240, "DEL>BOM": 1150, "DEL>GOI": 1500, "DEL>DXB": 2200, "DEL>JFK": 11000, "DEL>BLR": 1700 };
function distanceKm(a, b) { const k = a + ">" + b; return KM[k] != null ? KM[k] : null; }
// fake wallet lounge open-counts per dest
const OPEN = { BOM: 3, BLR: 2, GOI: 1, DXB: 0, JAI: 0, JFK: 0 };
function loungeOpenCount(code) { return OPEN[code] || 0; }

const ORIGIN = { code: "DEL", city: "Delhi" };
const DESTS = [
  { code: "JAI", city: "Jaipur" }, { code: "BOM", city: "Mumbai" },
  { code: "GOI", city: "Goa" }, { code: "DXB", city: "Dubai", intl: true },
  { code: "JFK", city: "New York", intl: true }, { code: "BLR", city: "Bengaluru" },
  { code: "DEL", city: "Delhi" }, // self, must be dropped
];
const CTX = { distanceKm, loungeOpenCount };

// ---- modeFor band boundaries ---------------------------------------------
ok("modeFor: <=350 -> train", () => assert.strictEqual(X.modeFor(240).mode, "train"));
ok("modeFor: 351-700 -> either", () => assert.strictEqual(X.modeFor(500).mode, "either"));
ok("modeFor: >700 -> fly", () => assert.strictEqual(X.modeFor(1500).mode, "fly"));
ok("modeFor: null -> unknown", () => assert.strictEqual(X.modeFor(null).mode, "unknown"));

// ---- destFacts -----------------------------------------------------------
ok("destFacts pulls real km + lounge count + mode", () => {
  const f = X.destFacts(ORIGIN, { code: "BOM", city: "Mumbai" }, CTX);
  assert.strictEqual(f.km, 1150);
  assert.strictEqual(f.loungeOpen, 3);
  assert.strictEqual(f.mode, "fly");
  assert.strictEqual(f.international, false);
});
ok("destFacts marks international", () => {
  const f = X.destFacts(ORIGIN, { code: "DXB", city: "Dubai", intl: true }, CTX);
  assert.strictEqual(f.international, true);
});
ok("destFacts: unknown distance stays null (never faked)", () => {
  const f = X.destFacts(ORIGIN, { code: "ZZZ", city: "Nowhere" }, CTX);
  assert.strictEqual(f.km, null);
  assert.strictEqual(f.loungeOpen, 0);
});

// ---- rank drops self + respects limit ------------------------------------
ok("rank drops the origin itself", () => {
  const r = X.rank(ORIGIN, DESTS, CTX, { priority: "balanced", limit: 20 });
  assert.ok(!r.some((d) => d.code === "DEL"));
});
ok("rank respects limit", () => {
  const r = X.rank(ORIGIN, DESTS, CTX, { priority: "balanced", limit: 3 });
  assert.strictEqual(r.length, 3);
});

// ---- priority: lounges puts the most-lounge city first -------------------
ok("priority=lounges ranks Mumbai (3 open) first", () => {
  const r = X.rank(ORIGIN, DESTS, CTX, { priority: "lounges", limit: 8 });
  assert.strictEqual(r[0].code, "BOM");
  assert.ok(/lounge/i.test(r[0].why));
});

// ---- priority: quick puts the nearest city first -------------------------
ok("priority=quick ranks Jaipur (240km) first", () => {
  const r = X.rank(ORIGIN, DESTS, CTX, { priority: "quick", limit: 8 });
  assert.strictEqual(r[0].code, "JAI");
  assert.ok(/close|km|hop/i.test(r[0].why));
});

// ---- priority: far puts the farthest first (JFK) -------------------------
ok("priority=far ranks New York (11000km) first", () => {
  const r = X.rank(ORIGIN, DESTS, CTX, { priority: "far", limit: 8 });
  assert.strictEqual(r[0].code, "JFK");
});

// ---- honesty: a 0-lounge dest never claims lounges -----------------------
ok("no lounge claim when wallet opens zero there", () => {
  const r = X.rank(ORIGIN, DESTS, CTX, { priority: "balanced", limit: 8 });
  const jai = r.find((d) => d.code === "JAI");
  assert.ok(!/lounge/i.test(jai.why), "Jaipur has 0 open lounges, must not mention lounges");
});

// ---- determinism: same inputs -> identical order -------------------------
ok("ranking is deterministic (no randomness)", () => {
  const a = X.rank(ORIGIN, DESTS, CTX, { priority: "balanced", limit: 8 }).map((d) => d.code).join(",");
  const b = X.rank(ORIGIN, DESTS, CTX, { priority: "balanced", limit: 8 }).map((d) => d.code).join(",");
  assert.strictEqual(a, b);
});

// ---- measurableOnly filter drops null-distance places --------------------
ok("measurableOnly drops places with unknown distance", () => {
  const withGhost = DESTS.concat([{ code: "ZZZ", city: "Nowhere" }]);
  const r = X.rank(ORIGIN, withGhost, CTX, { priority: "balanced", limit: 20, measurableOnly: true });
  assert.ok(!r.some((d) => d.code === "ZZZ"));
});

// ---- no fabricated price anywhere in output ------------------------------
ok("output carries facts only, never a price/total", () => {
  const r = X.rank(ORIGIN, DESTS, CTX, { priority: "balanced", limit: 8 });
  r.forEach((d) => {
    assert.ok(!("price" in d) && !("total" in d) && !("fare" in d), "no price field");
    assert.ok(!/₹|\$\d|from ₹|rs\.?\s*\d/i.test(d.why), "why never quotes a price");
  });
});

// ---- PRIORITIES metadata is well-formed ----------------------------------
ok("PRIORITIES has 4 entries with id+label+hint", () => {
  assert.strictEqual(X.PRIORITIES.length, 4);
  X.PRIORITIES.forEach((p) => assert.ok(p.id && p.label && p.hint));
});

console.log(`\n==== ${pass} passed, ${fail} failed ====`);
process.exit(fail ? 1 : 0);
