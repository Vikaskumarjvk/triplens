/* Tests for brief-engine.js (Smart Trip Brief composer). node tests-brief.js */
"use strict";
const assert = require("assert");
const B = require("./brief-engine.js");

let pass = 0, fail = 0;
function ok(n, fn) { try { fn(); pass++; } catch (e) { fail++; console.log("  ✗", n, "\n     " + e.message); } }

// fakes shaped like the real engine outputs
const cmp = (recommend, km) => ({ recommend, km, modes: [] });

// ---- getThereDecision ----------------------------------------------------
ok("short hop -> recommends train", () => {
  const d = B.getThereDecision(240, cmp("train_bus", 240));
  assert.ok(/train or bus/i.test(d.value));
  assert.strictEqual(d.confidence, "high");
});
ok("long hop -> recommends fly", () => {
  const d = B.getThereDecision(1760, cmp("fly", 1760));
  assert.ok(/fly/i.test(d.value));
});
ok("no coords -> low-confidence add-cities prompt", () => {
  const d = B.getThereDecision(null, null);
  assert.strictEqual(d.confidence, "low");
});

// ---- payDecision ---------------------------------------------------------
ok("no wallet -> add-cards action", () => {
  const d = B.payDecision(null, 0);
  assert.strictEqual(d.action, "addcard");
});
ok("best card present -> names it + counts sites", () => {
  const d = B.payDecision({ card: { name: "HDFC Infinia" }, places: ["a", "b"] }, 3);
  assert.ok(/HDFC Infinia/.test(d.value));
  assert.ok(/2 of this trip/.test(d.why));
});
ok("wallet but no match -> honest no-tracked-match", () => {
  const d = B.payDecision(null, 3);
  assert.ok(/no tracked match/i.test(d.value));
});

// ---- timingDecision ------------------------------------------------------
ok("dates already a free long weekend -> celebrates", () => {
  const d = B.timingDecision({ depart: "2026-01-24" }, { assess: { name: "Republic Day", verdict: "free_long_weekend", zeroLeave: { days: 3 } } });
  assert.ok(/long weekend/i.test(d.value));
  assert.strictEqual(d.confidence, "high");
});
ok("bridge available -> tells you how many days off", () => {
  const d = B.timingDecision({ depart: "2026-12-29" }, { assess: { name: "Test", verdict: "one_bridge", best: { leaveCount: 1, days: 4 } } });
  assert.ok(/Take 1 day off/.test(d.value));
});
ok("not on a holiday but one is coming -> suggests smarter dates", () => {
  const d = B.timingDecision({ depart: "2026-07-15" }, { nextLongWeekend: { name: "Gandhi Jayanti", date: "2026-10-02", days: 3 } });
  assert.ok(/Gandhi Jayanti/.test(d.value));
});
ok("no holiday info -> null (no fabricated timing)", () => {
  assert.strictEqual(B.timingDecision({ depart: "2026-07-15" }, null), null);
});

// ---- loungeDecision ------------------------------------------------------
ok("open lounges -> counts what you can walk into", () => {
  const d = B.loungeDecision({ originOpen: 2, destOpen: 1, originTotal: 4, destTotal: 3 }, 3);
  assert.ok(/3 you can walk into/.test(d.value));
});
ok("no wallet -> add-cards action", () => {
  const d = B.loungeDecision({ originTotal: 4, destTotal: 3 }, 0);
  assert.strictEqual(d.action, "addcard");
});
ok("no lounge data -> null", () => assert.strictEqual(B.loungeDecision({ originTotal: 0, destTotal: 0 }, 3), null));

// ---- weatherDecision -----------------------------------------------------
ok("monsoon -> rain layer advice + range", () => {
  const d = B.weatherDecision({ monsoon: true, minC: 24, maxC: 31 }, "Goa");
  assert.ok(/rain/i.test(d.why));
  assert.ok(/24–31°C/.test(d.value));
});
ok("no weather -> null (never invents a forecast)", () => assert.strictEqual(B.weatherDecision(null, "Goa"), null));

// ---- compose -------------------------------------------------------------
ok("compose assembles decisions + a headline + a top move", () => {
  const out = B.compose({
    route: { fromCity: "Delhi", toCity: "Goa" }, km: 1530, transport: cmp("fly_or_overnight_train", 1530),
    bestCard: { card: { name: "Axis Atlas" }, places: ["x"] }, walletCount: 2,
    dates: { depart: "2026-10-05" },
    holiday: { assess: { name: "Gandhi Jayanti", verdict: "free_long_weekend", zeroLeave: { days: 3 } } },
    lounges: { originOpen: 1, destOpen: 0, originTotal: 3, destTotal: 2 },
    weather: { hot: true, minC: 26, maxC: 33 },
  });
  assert.ok(/Delhi to Goa/.test(out.headline));
  assert.ok(out.decisions.length >= 4, "got " + out.decisions.length + " decisions");
  assert.ok(out.topMove && out.topMove.text);
});
ok("compose top move = add cards when wallet empty", () => {
  const out = B.compose({ route: { fromCity: "Delhi", toCity: "Goa" }, km: 1530, transport: cmp("fly", 1530), walletCount: 0, dates: { depart: "2026-10-05" } });
  assert.strictEqual(out.topMove.action, "addcard");
});
ok("compose top move = pick a date when date missing", () => {
  const out = B.compose({ route: { fromCity: "Delhi", toCity: "Goa" }, km: 1530, transport: cmp("fly", 1530), walletCount: 2, dates: {} });
  assert.strictEqual(out.topMove.action, "plan");
  assert.ok(/date/i.test(out.topMove.text));
});
ok("compose never throws on a totally empty input", () => {
  const out = B.compose({});
  assert.ok(out.decisions.length >= 1 && out.topMove);
});

console.log(`\n==== ${pass} passed, ${fail} failed ====`);
process.exit(fail ? 1 : 0);
