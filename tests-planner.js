/* Tests for itinerary-planner.js + data/destinations.js. node tests-planner.js
 *
 * The planner turns "N days in <place>" into a paced, themed day plan. These pin:
 *  - pacing (arrival light, departure has checkout, full days get multiple slots)
 *  - every explore slot links to a REAL maps search, never a fabricated venue/price
 *  - theme rotation doesn't repeat until the destination's themes are exhausted
 *  - unknown destinations still get an honest generic plan (no place-specific lies)
 *  - determinism (same input -> same plan)
 *  - destinations data integrity (every theme id resolves, every dest well-formed)
 */
"use strict";
const assert = require("assert");
global.window = global;
require("./data/flights.js");
const DEST = require("./data/destinations.js");
const P = require("./itinerary-planner.js");

let pass = 0, fail = 0;
function ok(n, fn) { try { fn(); pass++; } catch (e) { fail++; console.log("  ✗", n, "\n     " + e.message); } }

// ---- pacing --------------------------------------------------------------
ok("day 0 is arrival (light: settle + something)", () => {
  const plan = P.buildPlan({ code: "GOI", city: "Goa" }, 4, DEST);
  const d0 = plan.days[0];
  assert.strictEqual(d0.role, "arrival");
  assert.ok(d0.slots.some((s) => /settle/i.test(s.title)), "arrival settles in");
});
ok("last day is departure with a checkout", () => {
  const plan = P.buildPlan({ code: "GOI", city: "Goa" }, 4, DEST);
  const last = plan.days[plan.days.length - 1];
  assert.strictEqual(last.role, "departure");
  assert.ok(last.slots.some((s) => /check ?out|pack/i.test(s.title)));
});
ok("full days get multiple paced slots (morning/afternoon/evening)", () => {
  const plan = P.buildPlan({ code: "GOI", city: "Goa" }, 5, DEST);
  const fullDays = plan.days.filter((d) => d.role === "full");
  assert.ok(fullDays.length >= 1);
  fullDays.forEach((d) => assert.ok(d.slots.length >= 2, "a full day has 2+ slots"));
});
ok("a 1-day trip is just an arrival day (no departure split)", () => {
  const plan = P.buildPlan({ code: "GOI", city: "Goa" }, 1, DEST);
  assert.strictEqual(plan.days.length, 1);
  assert.strictEqual(plan.days[0].role, "arrival");
});
ok("day count is respected", () => {
  assert.strictEqual(P.buildPlan({ code: "JAI", city: "Jaipur" }, 6, DEST).days.length, 6);
});

// ---- honesty: real links, no fabricated venues ---------------------------
ok("every explore slot links to a real google maps search, never a fake venue", () => {
  const plan = P.buildPlan({ code: "GOI", city: "Goa" }, 5, DEST);
  plan.days.forEach((d) => d.slots.forEach((s) => {
    if (s.theme) {
      assert.ok(/^https:\/\/www\.google\.com\/maps\/search\//.test(s.link), "links to a real maps search: " + s.link);
      // the title is a CATEGORY + city, not a specific named venue with a claim
      assert.ok(s.title.includes(plan.city), "slot names the city, not an invented venue");
      assert.ok(!/₹|\$\d|best price|cheapest|book now for/i.test(s.title), "no price/sales claim in a slot");
    }
  }));
});
ok("maps query is URL-encoded + contains the city", () => {
  const url = P.mapsSearch("beaches in {CITY}", "Goa");
  assert.ok(url.includes(encodeURIComponent("beaches in Goa")));
});

// ---- theme rotation ------------------------------------------------------
ok("themes don't repeat until the destination's list is exhausted", () => {
  // Goa has 6 themes; across the explore slots of a long trip the first 6 distinct
  // themes should all differ before any repeats.
  const plan = P.buildPlan({ code: "GOI", city: "Goa" }, 8, DEST);
  const themeSeq = [];
  plan.days.forEach((d) => d.slots.forEach((s) => { if (s.theme) themeSeq.push(s.theme); }));
  const firstSix = themeSeq.slice(0, 6);
  assert.strictEqual(new Set(firstSix).size, firstSix.length, "first 6 themes are all distinct");
});

// ---- generic fallback for unknown destinations ---------------------------
ok("unknown destination still gets an honest generic plan", () => {
  const plan = P.buildPlan({ code: "ZZZ", city: "Smalltown" }, 4, DEST);
  assert.strictEqual(plan.curated, false);
  assert.strictEqual(plan.city, "Smalltown");
  assert.ok(plan.days.length === 4);
  // generic slots still link to real searches, never invent a "known for"
  assert.strictEqual(plan.knownFor, null, "no fabricated character for an unknown place");
  const someSlot = plan.days[1].slots.find((s) => s.theme);
  assert.ok(/google\.com\/maps/.test(someSlot.link));
});
ok("curated destination carries its real 'known for' character", () => {
  const plan = P.buildPlan({ code: "JAI", city: "Jaipur" }, 3, DEST);
  assert.strictEqual(plan.curated, true);
  assert.ok(/fort|palace|bazaar|pink/i.test(plan.knownFor));
});

// ---- determinism ---------------------------------------------------------
ok("same input -> identical plan (no randomness)", () => {
  const a = JSON.stringify(P.buildPlan({ code: "BOM", city: "Mumbai" }, 5, DEST));
  const b = JSON.stringify(P.buildPlan({ code: "BOM", city: "Mumbai" }, 5, DEST));
  assert.strictEqual(a, b);
});

// ---- summarize -----------------------------------------------------------
ok("summarize reflects day count + city + character", () => {
  const plan = P.buildPlan({ code: "GOI", city: "Goa" }, 4, DEST);
  const s = P.summarize(plan);
  assert.ok(/4 days in Goa/.test(s));
  assert.ok(/beach/i.test(s), "mentions the real character");
});

// ---- destinations data integrity -----------------------------------------
ok("every destination's theme ids resolve to a real theme", () => {
  Object.keys(DEST.DEST).forEach((code) => {
    DEST.DEST[code].themes.forEach((id) => {
      assert.ok(DEST.theme(id), code + " references unknown theme: " + id);
    });
  });
});
ok("every destination is well-formed (city, knownFor, vibe, themes)", () => {
  Object.keys(DEST.DEST).forEach((code) => {
    const d = DEST.DEST[code];
    assert.ok(d.city && d.knownFor && d.vibe && Array.isArray(d.themes) && d.themes.length >= 3, code + " malformed");
  });
});
ok("every theme has a label, icon, kind, and a {CITY} query", () => {
  Object.keys(DEST.THEMES).forEach((id) => {
    const t = DEST.THEMES[id];
    assert.ok(t.label && t.icon && t.kind, id + " missing fields");
    assert.ok(/\{CITY\}/.test(t.q), id + " query missing {CITY} placeholder");
  });
});
ok("generic fallback themes all resolve", () => {
  DEST.GENERIC_THEMES.forEach((id) => assert.ok(DEST.theme(id), "generic theme missing: " + id));
});
// coverage guard: every airport a user can fly to must have a curated profile,
// so a bookable destination never falls back to a characterless generic plan.
ok("every known airport has a destination profile", () => {
  const airports = (global.LL_FLIGHTS && global.LL_FLIGHTS.airports) || [];
  assert.ok(airports.length > 0, "flights data loaded");
  const missing = airports.filter((a) => !DEST.get(a.code)).map((a) => a.code + " " + a.city);
  assert.strictEqual(missing.length, 0, "airports without a destination profile: " + missing.join(", "));
});

console.log(`\n==== ${pass} passed, ${fail} failed ====`);
process.exit(fail ? 1 : 0);
