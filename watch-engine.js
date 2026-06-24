/*
 * TripLens — price-watch + fare-calendar engine. Pure, no DOM, no clock.
 *
 * What it does (honestly, with no backend):
 *  - You "watch" a route+date at the cheapest live fare we actually fetched.
 *  - Next time you open the app it re-checks the live fare and shows the delta
 *    vs what you watched it at ("down ₹300 since you saved it").
 *  - There's no server polling you to bed — the check happens when you're here.
 *    We say that plainly in the UI so it's never oversold.
 *
 * HONESTY: every price stored here is a real fetched fare, never invented. If a
 * re-check returns nothing, we keep the last real price and mark it stale, we do
 * not guess. All timestamps are PASSED IN (keeps it deterministic + testable).
 */
(function (root) {
  "use strict";

  // a watch: { id, from, to, date, basePrice, baseTs, lastPrice, lastTs,
  //            history:[{price, ts}], airline }
  function newWatch(o) {
    o = o || {};
    var p = o.price != null ? Number(o.price) : null;
    return {
      id: o.id || (o.from + "_" + o.to + "_" + (o.date || "any")),
      from: o.from || "", to: o.to || "", date: o.date || "",
      airline: o.airline || null,
      basePrice: p, baseTs: o.ts || 0,
      lastPrice: p, lastTs: o.ts || 0,
      history: p != null ? [{ price: p, ts: o.ts || 0 }] : [],
    };
  }

  // record a fresh live price onto a watch. Returns a NEW watch object (pure).
  // If price is null/invalid we keep the old lastPrice but still stamp the check
  // time so the UI can show "checked X, no fare returned".
  function recordCheck(watch, price, ts) {
    var w = Object.assign({}, watch, { history: (watch.history || []).slice() });
    var p = price != null && price > 0 ? Number(price) : null;
    if (p != null) {
      w.lastPrice = p;
      w.lastTs = ts || 0;
      w.history.push({ price: p, ts: ts || 0 });
      if (w.basePrice == null) { w.basePrice = p; w.baseTs = ts || 0; }
    } else {
      w.lastCheckedTs = ts || 0; // checked, nothing came back
    }
    // cap history so storage stays small
    if (w.history.length > 30) w.history = w.history.slice(w.history.length - 30);
    return w;
  }

  // delta of the latest price vs what you first watched it at.
  // dir: "down" (cheaper, good), "up" (pricier), "flat".
  function delta(watch) {
    if (!watch || watch.basePrice == null || watch.lastPrice == null) return null;
    var abs = watch.lastPrice - watch.basePrice;
    var pct = watch.basePrice ? Math.round((abs / watch.basePrice) * 100) : 0;
    var dir = abs < 0 ? "down" : abs > 0 ? "up" : "flat";
    return { abs: abs, absShown: Math.abs(abs), pct: pct, pctShown: Math.abs(pct), dir: dir };
  }

  // lowest price ever seen on this watch (the real floor we've observed).
  function lowestSeen(watch) {
    if (!watch || !watch.history || !watch.history.length) return null;
    return watch.history.reduce(function (a, b) { return b.price < a.price ? b : a; });
  }

  // ---- fare-calendar heatmap bucketing (pure) ----------------------------
  // Given the cheapest fare per day, bucket each into low/mid/high vs the median
  // so the calendar can color them. Thresholds are relative, so a "good day" is
  // good relative to THIS route's own range, not an absolute number.
  //   <= median*0.85  -> "low"  (green, a genuinely good day)
  //   >= median*1.15  -> "high" (red, avoid)
  //   else            -> "mid"  (neutral)
  function heatClass(price, median) {
    if (price == null || median == null || median <= 0) return "none";
    if (price <= median * 0.85) return "low";
    if (price >= median * 1.15) return "high";
    return "mid";
  }

  // annotate a [{date, minPrice}] list with a heat bucket + day-of-week, and
  // surface the cheapest weekday pattern (e.g. "Tuesdays are cheapest here").
  // dow is derived from the date string only (no clock), Sun=0..Sat=6.
  function dowOf(dateISO) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateISO || "");
    if (!m) return null;
    var t = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return new Date(t).getUTCDay();
  }
  var DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  function calendarModel(days, median) {
    var withHeat = (days || []).map(function (d) {
      return Object.assign({}, d, { heat: heatClass(d.minPrice, median), dow: dowOf(d.date) });
    });
    // average price per weekday across the window, to find the cheapest weekday
    var sums = {}, counts = {};
    withHeat.forEach(function (d) {
      if (d.minPrice == null || d.dow == null) return;
      sums[d.dow] = (sums[d.dow] || 0) + d.minPrice;
      counts[d.dow] = (counts[d.dow] || 0) + 1;
    });
    var bestDow = null, bestAvg = Infinity;
    Object.keys(counts).forEach(function (k) {
      var avg = sums[k] / counts[k];
      if (avg < bestAvg) { bestAvg = avg; bestDow = Number(k); }
    });
    return {
      days: withHeat,
      cheapestDow: bestDow != null ? { dow: bestDow, label: DOW[bestDow], avg: Math.round(bestAvg) } : null,
    };
  }

  var Engine = {
    newWatch: newWatch, recordCheck: recordCheck, delta: delta, lowestSeen: lowestSeen,
    heatClass: heatClass, calendarModel: calendarModel, dowOf: dowOf, DOW: DOW,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = Engine;
  root.LL_WATCH = Engine;
})(typeof window !== "undefined" ? window : globalThis);
