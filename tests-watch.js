/* Tests for watch-engine.js (price-drop watch + fare calendar). node tests-watch.js */
"use strict";
const assert = require("assert");
const W = require("./watch-engine.js");

let pass = 0, fail = 0;
function ok(n, fn) { try { fn(); pass++; } catch (e) { fail++; console.log("  ✗", n, "\n     " + e.message); } }

// ---- newWatch ------------------------------------------------------------
ok("newWatch seeds base + last + history from the first price", () => {
  const w = W.newWatch({ from: "DEL", to: "BOM", date: "2026-10-05", price: 5000, ts: 100 });
  assert.strictEqual(w.basePrice, 5000);
  assert.strictEqual(w.lastPrice, 5000);
  assert.strictEqual(w.history.length, 1);
  assert.strictEqual(w.id, "DEL_BOM_2026-10-05");
});
ok("newWatch with no price has empty history + null base", () => {
  const w = W.newWatch({ from: "DEL", to: "BOM", date: "2026-10-05" });
  assert.strictEqual(w.basePrice, null);
  assert.strictEqual(w.history.length, 0);
});

// ---- recordCheck (pure) --------------------------------------------------
ok("recordCheck appends a new real price + updates lastPrice", () => {
  let w = W.newWatch({ from: "DEL", to: "BOM", date: "2026-10-05", price: 5000, ts: 100 });
  w = W.recordCheck(w, 4700, 200);
  assert.strictEqual(w.lastPrice, 4700);
  assert.strictEqual(w.basePrice, 5000, "base unchanged");
  assert.strictEqual(w.history.length, 2);
});
ok("recordCheck does NOT mutate the input (pure)", () => {
  const w0 = W.newWatch({ from: "DEL", to: "BOM", date: "2026-10-05", price: 5000, ts: 100 });
  W.recordCheck(w0, 4000, 200);
  assert.strictEqual(w0.lastPrice, 5000, "original untouched");
  assert.strictEqual(w0.history.length, 1);
});
ok("recordCheck with null keeps last real price, never invents one", () => {
  let w = W.newWatch({ from: "DEL", to: "BOM", date: "2026-10-05", price: 5000, ts: 100 });
  w = W.recordCheck(w, null, 300);
  assert.strictEqual(w.lastPrice, 5000, "kept last real price");
  assert.strictEqual(w.lastCheckedTs, 300);
});
ok("recordCheck seeds base when watch started price-less", () => {
  let w = W.newWatch({ from: "DEL", to: "BOM", date: "2026-10-05" });
  w = W.recordCheck(w, 6200, 500);
  assert.strictEqual(w.basePrice, 6200);
  assert.strictEqual(w.lastPrice, 6200);
});
ok("recordCheck caps history at 30 entries", () => {
  let w = W.newWatch({ from: "DEL", to: "BOM", date: "2026-10-05", price: 5000, ts: 0 });
  for (let i = 1; i <= 40; i++) w = W.recordCheck(w, 5000 + i, i);
  assert.ok(w.history.length <= 30, "history capped, got " + w.history.length);
});

// ---- delta ---------------------------------------------------------------
ok("delta down when price dropped", () => {
  let w = W.newWatch({ from: "DEL", to: "BOM", date: "2026-10-05", price: 5000, ts: 0 });
  w = W.recordCheck(w, 4500, 1);
  const d = W.delta(w);
  assert.strictEqual(d.dir, "down");
  assert.strictEqual(d.absShown, 500);
  assert.strictEqual(d.pctShown, 10);
});
ok("delta up when price rose", () => {
  let w = W.newWatch({ from: "DEL", to: "BOM", date: "2026-10-05", price: 5000, ts: 0 });
  w = W.recordCheck(w, 5500, 1);
  assert.strictEqual(W.delta(w).dir, "up");
});
ok("delta flat when unchanged", () => {
  let w = W.newWatch({ from: "DEL", to: "BOM", date: "2026-10-05", price: 5000, ts: 0 });
  w = W.recordCheck(w, 5000, 1);
  assert.strictEqual(W.delta(w).dir, "flat");
});
ok("delta null when no base", () => assert.strictEqual(W.delta(W.newWatch({ from: "DEL", to: "BOM" })), null));

// ---- lowestSeen ----------------------------------------------------------
ok("lowestSeen returns the real floor across checks", () => {
  let w = W.newWatch({ from: "DEL", to: "BOM", date: "2026-10-05", price: 5000, ts: 0 });
  w = W.recordCheck(w, 4200, 1);
  w = W.recordCheck(w, 4800, 2);
  assert.strictEqual(W.lowestSeen(w).price, 4200);
});

// ---- heatClass -----------------------------------------------------------
ok("heatClass low when well below median", () => assert.strictEqual(W.heatClass(800, 1000), "low"));
ok("heatClass high when well above median", () => assert.strictEqual(W.heatClass(1200, 1000), "high"));
ok("heatClass mid when near median", () => assert.strictEqual(W.heatClass(1000, 1000), "mid"));
ok("heatClass none when no price/median", () => { assert.strictEqual(W.heatClass(null, 1000), "none"); assert.strictEqual(W.heatClass(900, null), "none"); });

// ---- dowOf + calendarModel ----------------------------------------------
ok("dowOf reads weekday from the date string (no clock)", () => {
  // 2026-10-05 is a Monday
  assert.strictEqual(W.dowOf("2026-10-05"), 1);
  assert.strictEqual(W.DOW[W.dowOf("2026-10-05")], "Mon");
});
ok("calendarModel buckets days + finds cheapest weekday", () => {
  const days = [
    { date: "2026-10-05", minPrice: 5000 }, // Mon
    { date: "2026-10-06", minPrice: 4000 }, // Tue (cheap)
    { date: "2026-10-07", minPrice: 6000 }, // Wed
    { date: "2026-10-13", minPrice: 3800 }, // Tue (cheap)
  ];
  const m = W.calendarModel(days, 5000);
  assert.strictEqual(m.days.length, 4);
  assert.strictEqual(m.days[1].heat, "low", "4000 vs 5000 median is low");
  assert.strictEqual(m.cheapestDow.label, "Tue", "Tuesdays cheapest on this data");
});
ok("calendarModel handles empty + null prices safely", () => {
  const m = W.calendarModel([{ date: "2026-10-05", minPrice: null }], 1000);
  assert.strictEqual(m.days[0].heat, "none");
  assert.strictEqual(m.cheapestDow, null);
});

console.log(`\n==== ${pass} passed, ${fail} failed ====`);
process.exit(fail ? 1 : 0);
