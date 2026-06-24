/*
 * TripLens — search history + saved searches. Pure, no DOM, no clock.
 *
 * Every route you look up (flight / trains+buses / multi-city) gets remembered so
 * you can jump back to it in one tap (like the "recent searches" every big travel
 * site has). You can also PIN a search to keep it at the top.
 *
 * HONESTY: this only stores what YOU searched (codes, cities, date, kind) — no
 * prices, no fabricated data. Timestamps are PASSED IN so it stays deterministic
 * and unit-testable.
 *
 * An entry: { id, kind:"flight|ground|multicity", from, to, fromCity, toCity,
 *             date, label, stops?, ts, pinned }
 */
(function (root) {
  "use strict";

  // stable id so the same route+kind+date dedupes instead of piling up.
  function entryId(e) {
    if (e.kind === "multicity") return "mc:" + (e.stops || []).join(">");
    return e.kind + ":" + (e.from || "") + ">" + (e.to || "") + ":" + (e.date || "any");
  }

  // human label for the row
  function labelFor(e) {
    if (e.kind === "multicity") return (e.stops || []).join(" → ");
    var a = e.fromCity || e.from || "?", b = e.toCity || e.to || "?";
    return a + " → " + b;
  }

  // add (or refresh) a search at the front. Pure: returns a NEW array.
  // Keeps pinned entries, caps the unpinned recents at `cap` (default 12).
  function record(list, entry, ts, cap) {
    cap = cap || 12;
    var e = Object.assign({}, entry, { ts: ts || 0 });
    e.id = entryId(e);
    e.label = labelFor(e);
    if (!("pinned" in e)) {
      // preserve a prior pin if this id was already pinned
      var prior = (list || []).find(function (x) { return x.id === e.id; });
      e.pinned = prior ? !!prior.pinned : false;
    }
    var rest = (list || []).filter(function (x) { return x.id !== e.id; });
    var next = [e].concat(rest);
    // cap only the UNPINNED ones; pinned always survive
    var pinned = next.filter(function (x) { return x.pinned; });
    var recents = next.filter(function (x) { return !x.pinned; }).slice(0, cap);
    // keep original order: pinned first (most-recent first), then recents
    return pinned.concat(recents);
  }

  function togglePin(list, id) {
    return (list || []).map(function (x) {
      return x.id === id ? Object.assign({}, x, { pinned: !x.pinned }) : x;
    });
  }

  function remove(list, id) {
    return (list || []).filter(function (x) { return x.id !== id; });
  }

  // ordered for display: pinned first, then recents, each newest-first.
  function ordered(list) {
    var l = (list || []).slice();
    var pinned = l.filter(function (x) { return x.pinned; }).sort(function (a, b) { return (b.ts || 0) - (a.ts || 0); });
    var recents = l.filter(function (x) { return !x.pinned; }).sort(function (a, b) { return (b.ts || 0) - (a.ts || 0); });
    return pinned.concat(recents);
  }

  var Engine = { entryId: entryId, labelFor: labelFor, record: record, togglePin: togglePin, remove: remove, ordered: ordered };
  if (typeof module !== "undefined" && module.exports) module.exports = Engine;
  root.LL_HISTORY = Engine;
})(typeof window !== "undefined" ? window : globalThis);
