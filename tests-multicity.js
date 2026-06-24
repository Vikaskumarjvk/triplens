/* Tests for multicity-engine.js. node tests-multicity.js */
"use strict";
const assert = require("assert");
global.window = global;
require("./geo-engine.js");
require("./data/transport.js");
require("./transport-engine.js");
const M = require("./multicity-engine.js");

let pass = 0, fail = 0;
function ok(n, fn) { try { fn(); pass++; } catch (e) { fail++; console.log("  ✗", n, "\n     " + e.message); } }

const DEL = { city: "New Delhi", code: "DEL" };
const BOM = { city: "Mumbai", code: "BOM" };
const GOI = { city: "Goa (Dabolim)", code: "GOI" };
const JAI = { city: "Jaipur", code: "JAI" };

// ---- buildLegs -----------------------------------------------------------
ok("buildLegs makes N-1 legs from N stops", () => {
  const legs = M.buildLegs([DEL, BOM, GOI]);
  assert.strictEqual(legs.length, 2);
  assert.strictEqual(legs[0].from.code, "DEL");
  assert.strictEqual(legs[0].to.code, "BOM");
  assert.strictEqual(legs[1].from.code, "BOM");
  assert.strictEqual(legs[1].to.code, "GOI");
});
ok("buildLegs null with <2 valid stops", () => {
  assert.strictEqual(M.buildLegs([DEL]), null);
  assert.strictEqual(M.buildLegs([DEL, { city: "x" }]), null); // second has no code
});
ok("buildLegs skips stops missing a code", () => {
  const legs = M.buildLegs([DEL, { city: "blank" }, BOM]);
  assert.strictEqual(legs.length, 1);
  assert.strictEqual(legs[0].to.code, "BOM");
});

// ---- analyzeLeg ----------------------------------------------------------
ok("analyzeLeg short hop (DEL-JAI) recommends train", () => {
  const l = M.analyzeLeg({ from: DEL, to: JAI });
  assert.ok(l.km > 0 && l.km < 350, "real short distance, got " + l.km);
  assert.strictEqual(l.bestMode, "train");
});
ok("analyzeLeg long hop (DEL-BOM) recommends flight", () => {
  const l = M.analyzeLeg({ from: DEL, to: BOM });
  assert.strictEqual(l.bestMode, "flight");
  assert.ok(l.compare && l.compare.modes.length === 3);
});
ok("analyzeLeg carries the 3-mode compare for the UI", () => {
  const l = M.analyzeLeg({ from: DEL, to: GOI });
  assert.deepStrictEqual(l.compare.modes.map((m) => m.mode), ["flight", "train", "bus"]);
});

// ---- analyzeTrip ---------------------------------------------------------
ok("analyzeTrip totals distance across legs", () => {
  const t = M.analyzeTrip([DEL, JAI, BOM]);
  assert.strictEqual(t.legCount, 2);
  const legSum = t.legs.reduce((a, l) => a + (l.km || 0), 0);
  assert.strictEqual(t.totalKm, legSum);
  assert.ok(t.totalKm > 0);
});
ok("analyzeTrip sums door-to-door time per mode (estimate)", () => {
  const t = M.analyzeTrip([DEL, BOM, GOI]);
  assert.ok(t.modeTime.flight > 0 && t.modeTime.train > 0 && t.modeTime.bus > 0);
  // train the whole way should take longer than flying the whole way
  assert.ok(t.modeTime.train > t.modeTime.flight, "train slower overall");
});
ok("analyzeTrip null for a single stop", () => assert.strictEqual(M.analyzeTrip([DEL]), null));
ok("analyzeTrip flags unknown-distance legs without crashing", () => {
  const t = M.analyzeTrip([DEL, { city: "Nowhere", code: "ZZZ" }, BOM]);
  assert.strictEqual(t.legCount, 2);
  // one leg has no coords -> mode totals can't be fully known
  assert.strictEqual(t.modeKnown.flight, false);
});

console.log(`\n==== ${pass} passed, ${fail} failed ====`);
process.exit(fail ? 1 : 0);
