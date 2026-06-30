/*
 * TripLens — quick-start engine. The one-tap front door for a total newbie.
 *
 * The rest of the app asks you to type a "from" city, a "to" city, a date,
 * nights and travellers before anything happens. That is a wall for a layman.
 * This engine removes the wall: it offers a short list of well-known places as
 * big tappable chips, and turns a single tap into a COMPLETE, ready-to-plan
 * trip spec — no typing required. The caller then creates the trip and
 * auto-plans the days with the existing planner (real Google Maps links).
 *
 * Pure, no DOM, no clock: "today" is passed in so the same inputs always give
 * the same dates. Date math uses Date.UTC so it never drifts by timezone.
 *
 * HONESTY MODEL: a quick-start trip invents NOTHING the user has to trust as a
 * fact. The dates are a sensible default (clearly editable in the UI), the
 * destination character is the same common-knowledge "known for" line already
 * in data/destinations.js, and every downstream idea is a real live search.
 * No price, no fare, no invented venue is ever produced here.
 */
(function (root) {
  "use strict";

  // the curated short list shown as one-tap chips. Kept small on purpose — a
  // newbie wants a few obvious choices, not 24. Each entry is a real IATA code
  // that data/destinations.js has a curated profile for, plus a friendly emoji.
  // Order = what most first-time users in India are likely to want first.
  var FEATURED = [
    { code: "GOI", emoji: "🏖️" },
    { code: "DXB", emoji: "🌆" },
    { code: "JAI", emoji: "🏰" },
    { code: "SIN", emoji: "🌃" },
    { code: "BKK", emoji: "🛕" },
    { code: "SXR", emoji: "🏔️" },
    { code: "COK", emoji: "🌴" },
    { code: "DEL", emoji: "🏛️" },
  ];

  // pad to a 2-digit string (local date formatting, no timezone shift).
  function pad(n) { return (n < 10 ? "0" : "") + n; }

  // ISO yyyy-mm-dd that is `addDays` after `todayISO`, computed in UTC so the
  // result never jumps a day across timezones. todayISO is injected (no clock).
  function isoPlusDays(todayISO, addDays) {
    var parts = String(todayISO || "").split("-");
    if (parts.length !== 3) return "";
    var y = +parts[0], m = +parts[1], d = +parts[2];
    if (!y || !m || !d) return "";
    var t = Date.UTC(y, m - 1, d) + addDays * 86400000;
    var dt = new Date(t);
    return dt.getUTCFullYear() + "-" + pad(dt.getUTCMonth() + 1) + "-" + pad(dt.getUTCDate());
  }

  // build the featured chip list the UI renders. destData = LL_DESTINATIONS
  // (injected so the engine stays decoupled + testable). Each chip carries the
  // real city + the honest "known for" line + the IATA code to start from.
  function featured(destData) {
    var out = [];
    for (var i = 0; i < FEATURED.length; i++) {
      var f = FEATURED[i];
      var d = destData && destData.get ? destData.get(f.code) : null;
      if (!d || !d.city) continue; // only show places we actually have a profile for
      out.push({
        code: f.code, emoji: f.emoji, city: d.city,
        knownFor: d.knownFor || "", vibe: d.vibe || "",
      });
    }
    return out;
  }

  // turn a single tap on a chip into a full trip spec — zero typing.
  //   code     = IATA the user tapped (e.g. "GOI")
  //   todayISO = today's date (injected)
  //   opts     = { leadDays, nights, adults } sensible defaults if omitted
  // returns { from, to, code, city, depart, nights, adults, defaulted:true }
  // `from` is left blank on purpose — the trip is still fully plan-able from the
  // destination alone, and the user can add their origin later. `defaulted`
  // tells the UI to show the "dates are a guess, edit freely" hint.
  function quickTrip(code, destData, todayISO, opts) {
    opts = opts || {};
    var d = destData && destData.get ? destData.get(code) : null;
    var city = (d && d.city) || code;
    var leadDays = opts.leadDays != null ? opts.leadDays : 14; // two weeks out
    var nights = Math.max(1, opts.nights != null ? opts.nights : 3);
    var adults = Math.max(1, opts.adults != null ? opts.adults : 2);
    return {
      from: "",
      to: city,
      code: code,
      city: city,
      knownFor: (d && d.knownFor) || "",
      depart: isoPlusDays(todayISO, leadDays),
      nights: nights,
      adults: adults,
      defaulted: true,
    };
  }

  // "surprise me": pick a featured place from a seed (no Math.random, stays
  // pure + testable). `avoid` (optional IATA) is skipped so two taps in a row
  // don't land on the same place. Returns the chosen featured entry, or null.
  function surprise(destData, seed, avoid) {
    var list = featured(destData);
    if (!list.length) return null;
    if (avoid && list.length > 1) list = list.filter(function (f) { return f.code !== avoid; });
    var idx = Math.abs(seed | 0) % list.length;
    return list[idx];
  }

  var Engine = {
    FEATURED: FEATURED,
    featured: featured,
    quickTrip: quickTrip,
    isoPlusDays: isoPlusDays,
    surprise: surprise,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = Engine;
  root.LL_QUICKSTART = Engine;
})(typeof window !== "undefined" ? window : globalThis);
