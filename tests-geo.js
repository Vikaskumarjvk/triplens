/* Tests for geo-engine.js (the distance foundation under Explore/Plan/Multi-city/
 * Trains&Buses). Run: node tests-geo.js
 *
 * Why this exists: geo-engine had no direct test yet every distance-based feature
 * sits on it. A coordinate typo or a haversine edit could silently skew every
 * ranking + fly/train hint in the app. These tests pin the real behavior:
 *  - haversine accuracy against a KNOWN real-world distance (DEL<->BOM ~1135 km)
 *  - the math invariants (symmetry, self-distance zero, case-insensitivity)
 *  - the honest estimate framing (flight time is an estimate, never a timetable)
 *  - the DATA-COVERAGE invariant: every airport in the flights picker MUST have
 *    coordinates here, or it vanishes from Explore + loses its distance in Plan.
 */
"use strict";
const path = require("path");
const assert = require("assert");
global.window = global;
require(path.join(__dirname, "data", "flights.js")); // for the coverage invariant
const G = require(path.join(__dirname, "geo-engine.js"));
const FL = global.LL_FLIGHTS;

let pass = 0, fail = 0;
function ok(n, fn) { try { fn(); pass++; } catch (e) { fail++; console.log("  ✗", n, "\n     " + e.message); } }

// ---- distanceKm: real haversine accuracy --------------------------------
ok("DEL<->BOM matches the real great-circle distance (~1135 km)", () => {
  const km = G.distanceKm("DEL", "BOM");
  // public DEL-BOM great-circle is ~1135-1150 km; our airport coords give 1137.
  assert.ok(km >= 1120 && km <= 1160, "got " + km + " km, expected ~1135");
});
ok("DEL<->MAA is a long domestic hop (~1760 km)", () => {
  const km = G.distanceKm("DEL", "MAA");
  assert.ok(km >= 1700 && km <= 1820, "got " + km);
});
ok("DEL<->JFK is a long-haul (~11500-11800 km airport-to-airport)", () => {
  const km = G.distanceKm("DEL", "JFK");
  assert.ok(km >= 11400 && km <= 11900, "got " + km);
});

// ---- distanceKm: math invariants ----------------------------------------
ok("self-distance is exactly 0", () => assert.strictEqual(G.distanceKm("DEL", "DEL"), 0));
ok("distance is symmetric (a->b == b->a)", () => {
  assert.strictEqual(G.distanceKm("DEL", "BLR"), G.distanceKm("BLR", "DEL"));
});
ok("case-insensitive (lowercase resolves)", () => {
  assert.strictEqual(G.distanceKm("del", "bom"), G.distanceKm("DEL", "BOM"));
});
ok("unknown code -> null (never a fabricated distance)", () => {
  assert.strictEqual(G.distanceKm("DEL", "ZZZ"), null);
  assert.strictEqual(G.distanceKm("ZZZ", "DEL"), null);
});
ok("null / empty input -> null", () => {
  assert.strictEqual(G.distanceKm(null, "BOM"), null);
  assert.strictEqual(G.distanceKm("", ""), null);
});
ok("result is an integer (rounded km, not a float)", () => {
  const km = G.distanceKm("DEL", "BOM");
  assert.strictEqual(km, Math.round(km));
});

// ---- flightTimeMin: honest estimate, not a timetable ---------------------
ok("flight time grows with distance", () => {
  assert.ok(G.flightTimeMin("DEL", "JFK") > G.flightTimeMin("DEL", "BOM"));
});
ok("flight time includes the fixed overhead (short hop still > overhead)", () => {
  const t = G.flightTimeMin("DEL", "JAI"); // ~230 km
  assert.ok(t > 30, "should include the 30-min taxi/climb overhead, got " + t);
});
ok("flight time unknown route -> null", () => assert.strictEqual(G.flightTimeMin("DEL", "ZZZ"), null));

// ---- fmtDuration ---------------------------------------------------------
ok("fmtDuration formats hours + minutes", () => assert.strictEqual(G.fmtDuration(113), "1h 53m"));
ok("fmtDuration sub-hour drops the hours part", () => assert.strictEqual(G.fmtDuration(45), "45m"));
ok("fmtDuration 0 -> 0m", () => assert.strictEqual(G.fmtDuration(0), "0m"));
ok("fmtDuration null -> empty string", () => assert.strictEqual(G.fmtDuration(null), ""));

// ---- trainVsFly: honest distance-band hint -------------------------------
ok("short hop (<=350) leans train", () => {
  const r = G.trainVsFly("DEL", "JAI");
  assert.strictEqual(r.lean, "train");
  assert.ok(/train|bus/i.test(r.note));
});
ok("long route leans fly", () => assert.strictEqual(G.trainVsFly("DEL", "MAA").lean, "fly"));
ok("trainVsFly carries the real km, never a fabricated one", () => {
  const r = G.trainVsFly("DEL", "BOM");
  assert.strictEqual(r.km, G.distanceKm("DEL", "BOM"));
});
ok("trainVsFly unknown -> null", () => assert.strictEqual(G.trainVsFly("DEL", "ZZZ"), null));

// ---- hasCoords -----------------------------------------------------------
ok("hasCoords true for a known airport", () => assert.strictEqual(G.hasCoords("DEL"), true));
ok("hasCoords case-insensitive", () => assert.strictEqual(G.hasCoords("del"), true));
ok("hasCoords false for junk", () => assert.strictEqual(G.hasCoords("ZZZ"), false));
ok("hasCoords false for empty", () => assert.strictEqual(G.hasCoords(""), false));

// ---- DATA COVERAGE INVARIANT (the high-value guard) ----------------------
// Every airport offered in the flights picker MUST have coordinates here. If one
// doesn't, it silently disappears from "Where to?" and loses its distance + mode
// hint in Plan. This test makes that a build failure instead of a silent gap.
ok("every flights-picker airport has coordinates in geo-engine", () => {
  const missing = (FL.airports || []).map((a) => a.code).filter((c) => !G.hasCoords(c));
  assert.strictEqual(missing.length, 0, "airports missing coords (invisible to Explore): " + missing.join(", "));
});
ok("every coordinate maps to a real picker airport (no dead weight)", () => {
  const pickerCodes = new Set((FL.airports || []).map((a) => a.code));
  const orphans = Object.keys(G.AIRPORT_COORDS).filter((c) => !pickerCodes.has(c));
  assert.strictEqual(orphans.length, 0, "coords with no picker entry: " + orphans.join(", "));
});

// ---- coordinate sanity: every coord is a plausible lat/long --------------
ok("all coordinates are within valid lat/long ranges", () => {
  Object.keys(G.AIRPORT_COORDS).forEach((code) => {
    const [lat, lon] = G.AIRPORT_COORDS[code];
    assert.ok(lat >= -90 && lat <= 90, code + " bad lat " + lat);
    assert.ok(lon >= -180 && lon <= 180, code + " bad lon " + lon);
  });
});

console.log(`\n==== ${pass} passed, ${fail} failed ====`);
process.exit(fail ? 1 : 0);
