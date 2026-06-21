/*
 * LoungeLens — user suggestions (crowdsource missing lounges/cards).
 *
 * HONEST MODEL: no server, so suggestions are stored locally and can be EXPORTED
 * as a file the user shares (with the maintainer or friends). The maintainer folds
 * good ones into the seed data each refresh. This crowdsources completeness without
 * a backend. Suggestions also immediately appear in the user's OWN app (as
 * "pending, your addition") so they get value right away.
 *
 * A suggestion: { id, kind: "lounge"|"card", name, city/issuer, note, ts }
 * Pure validation + merge helpers. Node-testable.
 */
(function (root) {
  "use strict";

  function validate(s) {
    if (!s || typeof s !== "object") return { ok: false, reason: "empty" };
    if (s.kind !== "lounge" && s.kind !== "card") return { ok: false, reason: "kind must be lounge or card" };
    if (!s.name || !String(s.name).trim()) return { ok: false, reason: "name required" };
    return { ok: true };
  }

  // build a normalized suggestion record (caller supplies ts to keep it pure)
  function make(kind, name, where, note, ts) {
    return {
      id: "sug-" + (ts || 0) + "-" + (name || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 24),
      kind,
      name: String(name || "").trim(),
      where: String(where || "").trim(),   // city for lounge, issuer for card
      note: String(note || "").trim(),
      ts: ts || 0,
      status: "pending",
    };
  }

  function add(list, suggestion) {
    const v = validate(suggestion);
    if (!v.ok) throw new Error(v.reason);
    list = Array.isArray(list) ? list.slice() : [];
    // dedupe on id
    if (!list.some((x) => x.id === suggestion.id)) list.push(suggestion);
    return list;
  }

  // turn a user's lounge suggestion into a real (low-confidence, pending) lounge
  // record so it shows in their own app immediately.
  function asPendingLounge(s) {
    if (s.kind !== "lounge") return null;
    return {
      id: s.id, name: s.name, city: s.where || "Unknown", code: "??",
      airport: "??", station: "??", type: "airport", area: "domestic",
      programs: ["dreamfolks"], confidence: "low",
      notes: "Your suggestion (pending verification). " + (s.note || ""),
      verify: "You added this — confirm at the airport / share it so it can be verified.",
      pending: true,
    };
  }

  const Suggest = { validate, make, add, asPendingLounge };
  if (typeof module !== "undefined" && module.exports) module.exports = Suggest;
  root.LL_SUGGEST = Suggest;
})(typeof window !== "undefined" ? window : globalThis);
