/* Tests for readiness-engine.js (pre-departure checklist). node tests-readiness.js */
"use strict";
const assert = require("assert");
const R = require("./readiness-engine.js");

let pass = 0, fail = 0;
function ok(n, fn) { try { fn(); pass++; } catch (e) { fail++; console.log("  ✗", n, "\n     " + e.message); } }

const INTL = ["DXB", "SIN", "BKK", "LHR", "JFK"];

// ---- isInternational -----------------------------------------------------
ok("intl code -> international", () => assert.strictEqual(R.isInternational("DXB", INTL), true));
ok("domestic code -> not international", () => assert.strictEqual(R.isInternational("GOI", INTL), false));
ok("missing code -> not international (no guess)", () => assert.strictEqual(R.isInternational("", INTL), false));
ok("case-insensitive", () => assert.strictEqual(R.isInternational("dxb", INTL), true));

// ---- buildChecklist: domestic --------------------------------------------
ok("domestic trip has a photo-ID item, NOT passport/visa", () => {
  const c = R.buildChecklist({ toCode: "GOI", toCity: "Goa", nights: 3 }, { intlCodes: INTL });
  assert.strictEqual(c.international, false);
  const ids = c.items.map((i) => i.id);
  assert.ok(ids.includes("doc-id"));
  assert.ok(!ids.includes("doc-visa"), "no visa item domestic");
  assert.ok(!ids.includes("doc-passport"), "no passport item domestic");
});

// ---- buildChecklist: international ----------------------------------------
ok("international trip surfaces passport + visa-CHECK (never claims need)", () => {
  const c = R.buildChecklist({ toCode: "DXB", toCity: "Dubai", nights: 4 }, { intlCodes: INTL });
  assert.strictEqual(c.international, true);
  const visa = c.items.find((i) => i.id === "doc-visa");
  assert.ok(visa, "has visa item");
  assert.ok(/check/i.test(visa.label), "label says CHECK, not 'you need a visa'");
  assert.ok(visa.link && /^https:\/\//.test(visa.link), "links to official-ish source");
  assert.ok(!/you need|required for you/i.test(visa.label + visa.hint), "never asserts you need one");
});
ok("international includes insurance + forex items", () => {
  const c = R.buildChecklist({ toCode: "LHR", toCity: "London", nights: 5 }, { intlCodes: INTL });
  const ids = c.items.map((i) => i.id);
  assert.ok(ids.includes("doc-insurance") && ids.includes("doc-forex"));
});

// ---- bookings + money ----------------------------------------------------
ok("stay item reflects nights", () => {
  const c = R.buildChecklist({ toCode: "GOI", toCity: "Goa", nights: 2 }, { intlCodes: INTL });
  const stay = c.items.find((i) => i.id === "book-stay");
  assert.ok(/2 nights/.test(stay.label));
});
ok("money item flips on hasCards (auto-tickable)", () => {
  const withCards = R.buildChecklist({ toCode: "GOI", nights: 1 }, { intlCodes: INTL, hasCards: true });
  const m1 = withCards.items.find((i) => i.id === "money-card");
  assert.ok(m1.auto === true && /best/i.test(m1.label));
  const noCards = R.buildChecklist({ toCode: "GOI", nights: 1 }, { intlCodes: INTL, hasCards: false });
  const m2 = noCards.items.find((i) => i.id === "money-card");
  assert.ok(!m2.auto && /add the cards/i.test(m2.label));
});

// ---- packing weather-aware -----------------------------------------------
ok("monsoon weather adds a rain item", () => {
  const c = R.buildChecklist({ toCode: "GOI", nights: 2 }, { intlCodes: INTL, weather: { monsoon: true } });
  assert.ok(c.items.some((i) => i.id === "pack-rain"));
});
ok("no weather -> no weather-specific packing item, essentials still there", () => {
  const c = R.buildChecklist({ toCode: "GOI", nights: 2 }, { intlCodes: INTL });
  assert.ok(!c.items.some((i) => /pack-rain|pack-warm|pack-sun/.test(i.id)));
  assert.ok(c.items.some((i) => i.id === "pack-essentials"));
});

// ---- progress ------------------------------------------------------------
ok("progress counts checked + auto items", () => {
  const c = R.buildChecklist({ toCode: "GOI", nights: 2 }, { intlCodes: INTL, hasCards: true });
  const p0 = R.progress(c.items, {});
  assert.ok(p0.done >= 1, "auto money item counts even unchecked");
  const allChecked = {}; c.items.forEach((i) => allChecked[i.id] = true);
  const p1 = R.progress(c.items, allChecked);
  assert.strictEqual(p1.pct, 100);
  assert.strictEqual(p1.ready, true);
});
ok("progress 0% on empty checked + no auto", () => {
  const c = R.buildChecklist({ toCode: "GOI", nights: 2 }, { intlCodes: INTL, hasCards: false });
  const p = R.progress(c.items, {});
  assert.strictEqual(p.done, 0);
  assert.strictEqual(p.ready, false);
});

// ---- countdown -----------------------------------------------------------
ok("daysToGo computes from today (deterministic)", () => {
  assert.strictEqual(R.daysToGo("2026-07-10", "2026-07-01"), 9);
});
ok("countdownLabel phrasing", () => {
  assert.strictEqual(R.countdownLabel(0), "today!");
  assert.strictEqual(R.countdownLabel(1), "tomorrow");
  assert.ok(/in 5 days/.test(R.countdownLabel(5)));
  assert.ok(/ago/.test(R.countdownLabel(-3)));
});
ok("daysToGo null on bad dates", () => assert.strictEqual(R.daysToGo("nope", "2026-07-01"), null));

console.log(`\n==== ${pass} passed, ${fail} failed ====`);
process.exit(fail ? 1 : 0);
