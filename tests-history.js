/* Tests for history-engine.js (recent + saved searches). node tests-history.js */
"use strict";
const assert = require("assert");
const H = require("./history-engine.js");

let pass = 0, fail = 0;
function ok(n, fn) { try { fn(); pass++; } catch (e) { fail++; console.log("  ✗", n, "\n     " + e.message); } }

const fl = (from, to, date) => ({ kind: "flight", from, to, fromCity: from, toCity: to, date: date || "" });

// ---- entryId + labelFor --------------------------------------------------
ok("entryId dedupes same route+kind+date", () => {
  assert.strictEqual(H.entryId(fl("DEL", "BOM", "2026-10-05")), H.entryId(fl("DEL", "BOM", "2026-10-05")));
});
ok("entryId differs by kind", () => {
  assert.notStrictEqual(H.entryId({ kind: "flight", from: "DEL", to: "BOM" }), H.entryId({ kind: "ground", from: "DEL", to: "BOM" }));
});
ok("labelFor multicity joins stops", () => {
  assert.strictEqual(H.labelFor({ kind: "multicity", stops: ["DEL", "JAI", "BOM"] }), "DEL → JAI → BOM");
});

// ---- record (pure) -------------------------------------------------------
ok("record adds to the front + is pure", () => {
  const l0 = [];
  const l1 = H.record(l0, fl("DEL", "BOM"), 100);
  assert.strictEqual(l0.length, 0, "input untouched");
  assert.strictEqual(l1.length, 1);
  assert.strictEqual(l1[0].label, "DEL → BOM");
});
ok("record dedupes + moves existing to front", () => {
  let l = H.record([], fl("DEL", "BOM"), 100);
  l = H.record(l, fl("BLR", "GOI"), 200);
  l = H.record(l, fl("DEL", "BOM"), 300); // repeat -> should move up, not dup
  assert.strictEqual(l.length, 2);
  assert.strictEqual(l[0].label, "DEL → BOM");
});
ok("record caps unpinned recents at the cap", () => {
  let l = [];
  for (let i = 0; i < 20; i++) l = H.record(l, fl("C" + i, "X"), i, 12);
  assert.ok(l.filter((x) => !x.pinned).length <= 12, "capped");
});
ok("record keeps pinned entries beyond the cap", () => {
  let l = H.record([], fl("PIN", "X"), 0);
  l = H.togglePin(l, H.entryId(fl("PIN", "X")));
  for (let i = 0; i < 20; i++) l = H.record(l, fl("C" + i, "X"), i + 1, 5);
  assert.ok(l.some((x) => x.from === "PIN" && x.pinned), "pinned survived");
});
ok("record preserves a prior pin when the same search recurs", () => {
  let l = H.record([], fl("DEL", "BOM"), 1);
  l = H.togglePin(l, H.entryId(fl("DEL", "BOM")));
  l = H.record(l, fl("DEL", "BOM"), 2); // search again
  assert.strictEqual(l.find((x) => x.from === "DEL").pinned, true);
});

// ---- togglePin / remove --------------------------------------------------
ok("togglePin flips + is pure", () => {
  const l = H.record([], fl("DEL", "BOM"), 1);
  const id = H.entryId(fl("DEL", "BOM"));
  const l2 = H.togglePin(l, id);
  assert.strictEqual(l[0].pinned, false, "original untouched");
  assert.strictEqual(l2[0].pinned, true);
});
ok("remove drops the entry", () => {
  let l = H.record([], fl("DEL", "BOM"), 1);
  l = H.remove(l, H.entryId(fl("DEL", "BOM")));
  assert.strictEqual(l.length, 0);
});

// ---- ordered -------------------------------------------------------------
ok("ordered puts pinned first, then recents, each newest-first", () => {
  let l = [];
  l = H.record(l, fl("A", "X"), 10);
  l = H.record(l, fl("B", "X"), 20);
  l = H.record(l, fl("C", "X"), 30);
  l = H.togglePin(l, H.entryId(fl("A", "X"))); // pin the oldest
  const o = H.ordered(l);
  assert.strictEqual(o[0].from, "A", "pinned first even though oldest");
  assert.strictEqual(o[1].from, "C", "then newest recent");
  assert.strictEqual(o[2].from, "B");
});

console.log(`\n==== ${pass} passed, ${fail} failed ====`);
process.exit(fail ? 1 : 0);
