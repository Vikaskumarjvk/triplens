/*
 * TripLens — Explore engine ("Where to?"). Pure, no DOM, no clock, no network.
 *
 * The "inspire me" tool: pick a starting city + what you care about, and it ranks
 * real destinations by OBJECTIVE facts — how far, fly vs train, how many lounges
 * your cards actually open there, domestic vs international. Each result carries a
 * plain-English reason for WHY it ranked where it did. You then open the real live
 * search to see the actual price.
 *
 * HONESTY: this never invents a price, a "deal", or a "from ₹X". It ranks on facts
 * it can prove — distance is real math, lounge counts come from your real wallet,
 * the mode hint is a labelled distance heuristic. The score is a transparent blend
 * of those facts weighted by the priority you picked, not a magic number. Ties break
 * deterministically (no randomness) so the same inputs always give the same order.
 *
 * The engine is injected with the facts it can't compute itself (distance fn, lounge
 * open-count fn) so it stays pure + Node-testable. Caller wires the real engines in.
 */
(function (root) {
  "use strict";

  // distance bands -> a travel-mode lean. Mirrors geo-engine's trainVsFly so the
  // explore view and the plan view never disagree about "should I fly or train".
  function modeFor(km) {
    if (km == null) return { mode: "unknown", label: "" };
    if (km <= 350) return { mode: "train", label: "train/bus territory" };
    if (km <= 700) return { mode: "either", label: "train or flight" };
    return { mode: "fly", label: "a flight" };
  }

  function clamp01(n) { return n < 0 ? 0 : n > 1 ? 1 : n; }

  // build the objective fact sheet for ONE destination from the origin.
  // ctx: { distanceKm(a,b), loungeOpenCount(code) -> int, today, holidayFit(code)? }
  function destFacts(origin, dest, ctx) {
    ctx = ctx || {};
    var oCode = origin && origin.code, dCode = dest && dest.code;
    var km = (oCode && dCode && ctx.distanceKm) ? ctx.distanceKm(oCode, dCode) : null;
    var open = ctx.loungeOpenCount ? (ctx.loungeOpenCount(dCode) || 0) : 0;
    var m = modeFor(km);
    return {
      code: dCode,
      city: dest.city,
      international: !!dest.intl,
      km: km,
      mode: m.mode,
      modeLabel: m.label,
      loungeOpen: open,
    };
  }

  // priority weight tables. Each factor is normalised 0..1 then weighted.
  var WEIGHTS = {
    balanced: { lounge: 0.6, near: 0.5, far: 0.2 },
    lounges:  { lounge: 1.0, near: 0.2, far: 0.0 },
    quick:    { lounge: 0.3, near: 1.0, far: 0.0 },
    far:      { lounge: 0.3, near: 0.0, far: 1.0 },
  };

  // score a fact sheet for a chosen priority. Returns { score, why }.
  // `why` is the honest, dominant reason this destination ranked where it did.
  function scoreDest(f, priority) {
    var w = WEIGHTS[priority] || WEIGHTS.balanced;
    var loungeScore = Math.min(f.loungeOpen, 4) / 4;            // 0..1, capped at 4
    var nearScore = f.km == null ? 0 : clamp01(1 - f.km / 3000); // closer = higher
    var farScore = f.km == null ? 0 : clamp01(f.km / 4000);      // farther = higher
    if (priority === "far" && f.international) farScore = clamp01(farScore + 0.25);
    var score = w.lounge * loungeScore + w.near * nearScore + w.far * farScore;

    // pick the dominant contributor for an honest one-line reason
    var contrib = [
      { k: "lounge", v: w.lounge * loungeScore },
      { k: "near", v: w.near * nearScore },
      { k: "far", v: w.far * farScore },
    ].sort(function (a, b) { return b.v - a.v; });
    var top = contrib[0].v > 0 ? contrib[0].k : "lounge";

    var why;
    if (f.loungeOpen > 0 && (top === "lounge" || priority === "lounges")) {
      why = "your cards open " + f.loungeOpen + " lounge" + (f.loungeOpen > 1 ? "s" : "") + " here";
    } else if (top === "near") {
      why = f.km != null ? "close by (" + f.km + " km, " + f.modeLabel + ")" : "an easy hop";
    } else if (top === "far") {
      why = f.international ? "a bigger trip abroad (" + (f.km != null ? f.km + " km" : "long-haul") + ")" : "farther afield (" + (f.km != null ? f.km + " km" : "long-haul") + ")";
    } else {
      why = f.km != null ? f.km + " km from you" : "worth a look";
    }
    return { score: score, why: why };
  }

  // rank destinations from an origin. Returns up to opts.limit results, each:
  // { code, city, international, km, mode, modeLabel, loungeOpen, score, why }.
  // ctx is passed through to destFacts. Deterministic ordering, no randomness.
  function rank(origin, dests, ctx, opts) {
    opts = opts || {};
    var priority = opts.priority || "balanced";
    var limit = opts.limit || 8;
    var oCode = origin && origin.code;
    var rows = (dests || [])
      .filter(function (d) { return d && d.code && d.code !== oCode; })
      .map(function (d) {
        var f = destFacts(origin, d, ctx);
        var s = scoreDest(f, priority);
        f.score = s.score; f.why = s.why;
        return f;
      });
    // optional filter: only places we can actually measure a distance to
    if (opts.measurableOnly) rows = rows.filter(function (r) { return r.km != null; });
    // deterministic sort: score desc, then lounges desc, then nearer first, then code
    rows.sort(function (a, b) {
      if (b.score !== a.score) return b.score - a.score;
      if (b.loungeOpen !== a.loungeOpen) return b.loungeOpen - a.loungeOpen;
      var ak = a.km == null ? Infinity : a.km, bk = b.km == null ? Infinity : b.km;
      if (ak !== bk) return ak - bk;
      return a.code < b.code ? -1 : a.code > b.code ? 1 : 0;
    });
    return rows.slice(0, limit);
  }

  var PRIORITIES = [
    { id: "balanced", label: "Balanced", hint: "a sensible mix of close + lounge-friendly" },
    { id: "lounges", label: "Lounge-rich", hint: "where your cards open the most lounges" },
    { id: "quick", label: "Quick getaway", hint: "short hops, train-friendly" },
    { id: "far", label: "Go far", hint: "bigger trips + international" },
  ];

  var Engine = {
    modeFor: modeFor, destFacts: destFacts, scoreDest: scoreDest, rank: rank,
    PRIORITIES: PRIORITIES, WEIGHTS: WEIGHTS,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = Engine;
  root.LL_EXPLORE = Engine;
})(typeof window !== "undefined" ? window : globalThis);
