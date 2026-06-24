/*
 * TripLens — multi-city / multi-stop trip engine. Pure, no DOM, no clock.
 *
 * You chain stops (Delhi -> Goa -> Bengaluru -> Delhi). For each LEG it works out
 * the real distance and the honest best mode (fly / train / bus) by reusing the
 * transport engine's banding, then totals the trip up. The UI fills the actual
 * booking links per leg from the flight + transport data.
 *
 * HONESTY: distances are real (haversine via geo-engine). Per-leg time is the
 * door-to-door estimate from the transport engine (clearly an estimate). We never
 * invent a fare or a total cost — only the real per-leg search links carry prices.
 *
 * Dependencies are passed/looked-up so this stays unit-testable in Node.
 */
(function (root) {
  "use strict";

  function geo() { return root.LL_GEO || req("./geo-engine.js"); }
  function transport() { return root.LL_TRANSPORT_ENGINE || req("./transport-engine.js"); }
  function req(p) { try { return require(p); } catch (e) { return null; } }

  // legs from an ordered list of stops. Each stop: { city, code }.
  // A trip of N stops has N-1 legs. Returns null if fewer than 2 valid stops.
  function buildLegs(stops) {
    var clean = (stops || []).filter(function (s) { return s && s.code; });
    if (clean.length < 2) return null;
    var legs = [];
    for (var i = 0; i < clean.length - 1; i++) {
      legs.push({ index: i, from: clean[i], to: clean[i + 1] });
    }
    return legs;
  }

  // analyse one leg: distance + the honest mode recommendation + per-mode time.
  function analyzeLeg(leg) {
    var G = geo(), T = transport();
    var km = G ? G.distanceKm(leg.from.code, leg.to.code) : null;
    var cmp = (T && km != null) ? T.compareModes(leg.from.code, leg.to.code) : null;
    // pick the single best mode name from the band, for a compact summary
    var best = null;
    if (cmp) {
      if (cmp.recommend === "fly") best = "flight";
      else if (cmp.recommend === "train_bus") best = "train";       // short hop: rail wins
      else if (cmp.recommend === "fly_or_overnight_train") best = "flight";
      else best = "compare";                                         // genuinely a toss-up
    }
    return Object.assign({}, leg, { km: km, compare: cmp, bestMode: best });
  }

  // whole-trip rollup: total distance, count of legs, and a per-mode "if you took
  // X the whole way" door-to-door time sum (honest estimate, clearly labelled).
  function analyzeTrip(stops) {
    var legs = buildLegs(stops);
    if (!legs) return null;
    var analyzed = legs.map(analyzeLeg);
    var totalKm = 0, known = 0;
    var modeTime = { flight: 0, train: 0, bus: 0 };
    var modeKnown = { flight: true, train: true, bus: true };
    analyzed.forEach(function (l) {
      if (l.km != null) { totalKm += l.km; known++; }
      if (l.compare) {
        l.compare.modes.forEach(function (m) {
          if (m.d2dMin != null) modeTime[m.mode] += m.d2dMin;
          else modeKnown[m.mode] = false;
        });
      } else { modeKnown.flight = modeKnown.train = modeKnown.bus = false; }
    });
    return {
      legs: analyzed,
      legCount: analyzed.length,
      totalKm: known ? totalKm : null,
      knownLegs: known,
      modeTime: modeTime,
      modeKnown: modeKnown,
    };
  }

  var Engine = { buildLegs: buildLegs, analyzeLeg: analyzeLeg, analyzeTrip: analyzeTrip };
  if (typeof module !== "undefined" && module.exports) module.exports = Engine;
  root.LL_MULTICITY = Engine;
})(typeof window !== "undefined" ? window : globalThis);
