/*
 * Deep-link integrity test. Node-run.  node tests-links.js
 *
 * Asserts every booking/deal provider URL is structurally sound: parses as a
 * URL, uses https, has a real-looking domain, and — once filled by the engines
 * with a sample route/city/date — leaves NO unresolved {PLACEHOLDER} behind.
 *
 * It does NOT hit the network (sites WAF-block automation, which would make the
 * test flaky and is not what we're guaranteeing). It guarantees the LINKS WE
 * BUILD ARE WELL-FORMED AND COMPLETE — the part we own. Live reachability is a
 * separate manual probe; every offer is also confidence-tagged with a verify hint.
 */
"use strict";
const assert = require("assert");
global.window = global;
require("./data/cards.js"); require("./data/lounges.js"); require("./data/flights.js");
require("./data/hotels.js"); require("./data/deals.js"); require("./data/transport.js");
require("./flight-engine.js"); require("./engine.js"); require("./geo-engine.js");
const FE = require("./flight-engine.js");
const TE = require("./trip-engine.js");
const TRE = require("./transport-engine.js");

let pass = 0, fail = 0;
function ok(n, fn) { try { fn(); pass++; } catch (e) { fail++; console.log("  ✗", n, "\n     " + e.message); } }

function assertUrlClean(label, url) {
  assert.ok(typeof url === "string" && url.length, label + " -> empty");
  let u;
  try { u = new URL(url); } catch (e) { throw new Error(label + " -> not a URL: " + url); }
  assert.strictEqual(u.protocol, "https:", label + " -> not https: " + url);
  assert.ok(!/\{[A-Z_]+\}/.test(url), label + " -> leftover placeholder: " + url);
  assert.ok(/\.[a-z]{2,}$/i.test(u.hostname), label + " -> odd hostname: " + u.hostname);
  // dangling-route guard: a prefilled route template whose value never got
  // filled can leave a path like "/delhi-to-" (trailing hyphen) or "/-to-x".
  // A trailing "/" is a normal landing page and is fine; a trailing "-" or a
  // "-to-" with an empty side is broken. (caught the broken redbus deal link.)
  assert.ok(!/-$/.test(u.pathname), label + " -> dangling hyphen in path: " + url);
  assert.ok(!/-to-($|\/)|\/-to-|\/to-($|\/)/.test(u.pathname), label + " -> incomplete route slug: " + url);
  // a query param that filled to empty (e.g. "?q=") is a dead search
  u.searchParams.forEach((v, k) => assert.ok(v !== "", label + " -> empty query value for ?" + k + " : " + url));
}

// every flight provider, dated + undated
ok("flight provider URLs build clean (dated + undated)", () => {
  (window.LL_FLIGHTS.providers || []).forEach((p) => {
    assertUrlClean("flight:" + p.id + ":dated", FE.buildLink(p, "DEL", "BOM", "2026-10-05"));
    assertUrlClean("flight:" + p.id + ":undated", FE.buildLink(p, "DEL", "BOM", ""));
    assert.ok(p.verify, "flight:" + p.id + " missing verify hint");
    assert.ok(["high", "med", "low"].includes(p.confidence), "flight:" + p.id + " bad confidence");
  });
});

// every hotel provider, with + without dates
ok("hotel provider URLs build clean", () => {
  (window.LL_HOTELS.providers || []).forEach((p) => {
    assertUrlClean("hotel:" + p.id + ":dated", TE.buildStayLink(p, "Goa", "2026-10-05", "2026-10-08", 2));
    assertUrlClean("hotel:" + p.id + ":nodate", TE.buildStayLink(p, "Goa", "", "", 2));
    assert.ok(p.verify, "hotel:" + p.id + " missing verify");
    assert.ok(["high", "med", "low"].includes(p.confidence), "hotel:" + p.id + " bad confidence");
  });
});

// every deal service, with + without city
ok("deal service URLs build clean", () => {
  (window.LL_DEALS.services || []).forEach((s) => {
    assertUrlClean("deal:" + s.id + ":city", TE.buildDealLink(s, "Goa"));
    assertUrlClean("deal:" + s.id + ":nocity", TE.buildDealLink(s, ""));
    assert.ok(s.verify, "deal:" + s.id + " missing verify");
    assert.ok(["high", "med", "low"].includes(s.confidence), "deal:" + s.id + " bad confidence");
  });
});

// every train + bus provider, dated + undated
ok("transport (train+bus) provider URLs build clean", () => {
  const all = [...(window.LL_TRANSPORT.trains || []), ...(window.LL_TRANSPORT.buses || [])];
  all.forEach((p) => {
    assertUrlClean("transport:" + p.id + ":dated", TRE.buildLink(p, "Delhi", "Mumbai", "2026-10-05"));
    assertUrlClean("transport:" + p.id + ":undated", TRE.buildLink(p, "Delhi", "Mumbai", ""));
    assert.ok(p.verify, "transport:" + p.id + " missing verify");
    assert.ok(["high", "med", "low"].includes(p.confidence), "transport:" + p.id + " bad confidence");
  });
});

// every offer across all sources carries a verify pointer (honesty contract)
ok("every flight/hotel offer is confidence-tagged + has verify", () => {
  const checkOffers = (node, label) => (node.offers || []).forEach((o) => {
    assert.ok(["high", "med", "low"].includes(o.confidence), label + " offer bad confidence: " + (o.id || o.title));
    assert.ok(o.verify, label + " offer missing verify: " + (o.id || o.title));
    assert.ok(o.lastChecked, label + " offer missing lastChecked: " + (o.id || o.title));
  });
  (window.LL_FLIGHTS.providers || []).forEach((p) => checkOffers(p, "flight:" + p.id));
  (window.LL_HOTELS.providers || []).forEach((p) => checkOffers(p, "hotel:" + p.id));
  (window.LL_DEALS.services || []).forEach((s) => checkOffers(s, "deal:" + s.id));
});

// no duplicate provider/service ids (would break offer matching + keys)
ok("no duplicate ids within each dataset", () => {
  const dupes = (arr, label) => {
    const seen = new Set();
    (arr || []).forEach((x) => { assert.ok(!seen.has(x.id), label + " duplicate id: " + x.id); seen.add(x.id); });
  };
  dupes(window.LL_FLIGHTS.providers, "flights");
  dupes(window.LL_HOTELS.providers, "hotels");
  dupes(window.LL_DEALS.services, "deals");
});

// count what we validated (transparency)
const nF = (window.LL_FLIGHTS.providers || []).length;
const nH = (window.LL_HOTELS.providers || []).length;
const nD = (window.LL_DEALS.services || []).length;
console.log(`  (validated ${nF} flight + ${nH} hotel + ${nD} deal link templates, dated + undated)`);

console.log(`\n==== ${pass} passed, ${fail} failed ====`);
process.exit(fail ? 1 : 0);
