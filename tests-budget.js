/*
 * Tests for budget-engine.js. Pure-function, Node-run.  node tests-budget.js
 */
"use strict";
const assert = require("assert");
global.window = global;
const B = require("./budget-engine.js");

let pass = 0, fail = 0;
function ok(n, fn) { try { fn(); pass++; } catch (e) { fail++; console.log("  ✗", n, "\n     " + e.message); } }

function trip() { return { adults: 2, days: [{}, {}, {}], budget: null }; }

// ---- shape ---------------------------------------------------------------
ok("CATEGORIES + CAT_IDS align", () => assert.strictEqual(B.CATEGORIES.length, B.CAT_IDS.length));
ok("symbol known + unknown", () => { assert.strictEqual(B.symbol("INR"), "₹"); assert.strictEqual(B.symbol("ZZZ"), ""); });
ok("ensure creates blank budget", () => { const t = trip(); const b = B.ensure(t); assert.ok(b.spends && b.byCat && b.currency === "INR"); });

// ---- caps ----------------------------------------------------------------
ok("setTotal accepts positive", () => { const t = trip(); assert.strictEqual(B.setTotal(t, 50000), 50000); });
ok("setTotal blank clears", () => { const t = trip(); B.setTotal(t, 50000); assert.strictEqual(B.setTotal(t, ""), null); });
ok("setTotal rejects negative -> null", () => { const t = trip(); assert.strictEqual(B.setTotal(t, -5), null); });
ok("setCatCap valid cat", () => { const t = trip(); assert.strictEqual(B.setCatCap(t, "stay", 12000), 12000); });
ok("setCatCap invalid cat -> null", () => { const t = trip(); assert.strictEqual(B.setCatCap(t, "spaceship", 100), null); });
ok("setCatCap blank removes", () => { const t = trip(); B.setCatCap(t, "stay", 9000); assert.strictEqual(B.setCatCap(t, "stay", ""), null); });
ok("setCurrency falls back to INR", () => { const t = trip(); assert.strictEqual(B.setCurrency(t, "ZZZ"), "INR"); assert.strictEqual(B.setCurrency(t, "USD"), "USD"); });

// ---- spends --------------------------------------------------------------
ok("addSpend positive logs + ids", () => {
  const t = trip();
  const s = B.addSpend(t, { cat: "flights", label: "IndiGo", amount: 4200, day: 0 }, 1);
  assert.strictEqual(s.id, "sp-1");
  assert.strictEqual(s.amount, 4200);
  assert.strictEqual(t.budget.spends.length, 1);
});
ok("addSpend zero/negative rejected (no phantom spends)", () => {
  const t = trip();
  assert.strictEqual(B.addSpend(t, { cat: "food", amount: 0 }), null);
  assert.strictEqual(B.addSpend(t, { cat: "food", amount: -50 }), null);
  assert.strictEqual(t.budget.spends.length, 0);
});
ok("addSpend unknown cat -> other", () => {
  const t = trip();
  const s = B.addSpend(t, { cat: "bribes", amount: 100 }, 2);
  assert.strictEqual(s.cat, "other");
});
ok("addSpend rounds to 2dp", () => {
  const t = trip();
  const s = B.addSpend(t, { cat: "food", amount: 12.999 }, 3);
  assert.strictEqual(s.amount, 13);
});
ok("removeSpend works + missing false", () => {
  const t = trip();
  B.addSpend(t, { cat: "food", amount: 100 }, 9);
  assert.strictEqual(B.removeSpend(t, "sp-9"), true);
  assert.strictEqual(B.removeSpend(t, "ghost"), false);
});

// ---- rollups -------------------------------------------------------------
function loaded() {
  const t = trip();
  B.addSpend(t, { cat: "flights", amount: 4200, day: 0 }, 1);
  B.addSpend(t, { cat: "flights", amount: 3800, day: 2 }, 2);
  B.addSpend(t, { cat: "stay", amount: 9000, day: 0 }, 3);
  B.addSpend(t, { cat: "food", amount: 1500, day: 1 }, 4);
  B.addSpend(t, { cat: "food", amount: 800 }, 5); // unscheduled
  return t;
}
ok("spentByCat sums per category", () => {
  const t = loaded();
  const c = B.spentByCat(t);
  assert.strictEqual(c.flights, 8000);
  assert.strictEqual(c.stay, 9000);
  assert.strictEqual(c.food, 2300);
  assert.strictEqual(c.activities, 0);
});
ok("totalSpent sums all", () => assert.strictEqual(B.totalSpent(loaded()), 19300));
ok("spentByDay buckets + unscheduled", () => {
  const d = B.spentByDay(loaded());
  assert.strictEqual(d[0], 13200);
  assert.strictEqual(d[1], 1500);
  assert.strictEqual(d[2], 3800);
  assert.strictEqual(d.unscheduled, 800);
});

// ---- summary -------------------------------------------------------------
ok("summary: under-budget math", () => {
  const t = loaded();
  B.setTotal(t, 30000);
  B.setCatCap(t, "stay", 12000);
  const s = B.summary(t);
  assert.strictEqual(s.spent, 19300);
  assert.strictEqual(s.remaining, 10700);
  assert.strictEqual(s.over, false);
  assert.ok(s.pct > 0 && s.pct <= 100);
  const stay = s.cats.find((c) => c.id === "stay");
  assert.strictEqual(stay.cap, 12000);
  assert.strictEqual(stay.used, 9000);
  assert.strictEqual(stay.remaining, 3000);
  assert.strictEqual(stay.over, false);
});
ok("summary: over-budget flagged", () => {
  const t = loaded();
  B.setTotal(t, 15000); // less than 19300 spent
  const s = B.summary(t);
  assert.strictEqual(s.over, true);
  assert.strictEqual(s.remaining, -4300);
});
ok("summary: category over cap flagged", () => {
  const t = loaded();
  B.setCatCap(t, "flights", 5000); // spent 8000
  const s = B.summary(t);
  const fl = s.cats.find((c) => c.id === "flights");
  assert.strictEqual(fl.over, true);
  assert.strictEqual(fl.remaining, -3000);
});
ok("summary: no caps -> null remaining (not fabricated)", () => {
  const t = loaded();
  const s = B.summary(t);
  assert.strictEqual(s.total, null);
  assert.strictEqual(s.remaining, null);
  assert.strictEqual(s.pct, null);
  s.cats.forEach((c) => { if (c.cap == null) { assert.strictEqual(c.remaining, null); assert.strictEqual(c.pct, null); } });
});
ok("summary: per-person divides by travellers", () => {
  const t = loaded(); // adults:2, spent 19300
  const s = B.summary(t);
  assert.strictEqual(s.perPerson, 9650);
});

// ---- honesty guarantee ---------------------------------------------------
ok("HONESTY: engine never invents a number on an empty trip", () => {
  const t = trip();
  const s = B.summary(t);
  assert.strictEqual(s.spent, 0, "empty trip spent is 0, not a guess");
  assert.strictEqual(s.total, null, "no budget unless user set it");
  assert.strictEqual(s.remaining, null, "no remaining without a total");
  s.cats.forEach((c) => assert.strictEqual(c.used, 0, c.id + " used 0 on empty trip"));
});

// ---- format --------------------------------------------------------------
ok("fmt INR uses Indian grouping + symbol", () => assert.strictEqual(B.fmt(125000, "INR"), "₹1,25,000"));
ok("fmt USD uses western grouping", () => assert.strictEqual(B.fmt(125000, "USD"), "$125,000"));

console.log(`\n==== ${pass} passed, ${fail} failed ====`);
process.exit(fail ? 1 : 0);
