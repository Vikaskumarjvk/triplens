/*
 * TripLens — Trip Readiness engine. Pure, no DOM, no clock (today passed in).
 *
 * The last question before you leave: "am I actually ready?" This auto-builds a
 * pre-departure checklist from the trip — documents, money, weather-based packing,
 * booking status — plus a days-to-go countdown. You tick items; progress persists
 * per trip.
 *
 * HONESTY: it never claims you DO or DON'T need a visa (that depends on your
 * passport + destination + current rules, which we can't know). For an
 * international trip it surfaces a "check visa rules" item that links to the
 * official source. Domestic vs international is decided by an explicit list of
 * international airport codes passed in — not guessed. No fabricated requirements.
 *
 * Dates are YYYY-MM-DD; daysToGo takes `todayISO` so it stays deterministic.
 */
(function (root) {
  "use strict";

  function parse(iso) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || ""); return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : null; }
  function daysBetween(a, b) { var pa = parse(a), pb = parse(b); return (pa == null || pb == null) ? null : Math.round((pb - pa) / 86400000); }

  // is this trip international? decided by an explicit intl-code set, never guessed.
  function isInternational(toCode, intlCodes) {
    if (!toCode) return false;
    return (intlCodes || []).indexOf(String(toCode).toUpperCase()) !== -1;
  }

  // build the checklist items for a trip. Each: { id, group, label, hint, link?, auto? }
  // `auto:true` means we can tick it for you from app state (e.g. cards added).
  function buildChecklist(trip, opts) {
    opts = opts || {};
    var intl = isInternational(trip && trip.toCode, opts.intlCodes);
    var weather = opts.weather || null;       // parsed flags or null
    var hasCards = !!opts.hasCards;            // wallet non-empty
    var items = [];

    // ---- DOCUMENTS ----
    if (intl) {
      items.push({ id: "doc-passport", group: "Documents", label: "Passport valid 6+ months", hint: "Most countries need your passport valid at least 6 months past your return date." });
      items.push({ id: "doc-visa", group: "Documents", label: "Check visa rules for " + (trip.toCity || "your destination"), hint: "Visa need depends on your passport + destination. I can't decide it for you — check the official source.", link: "https://www.google.com/search?q=" + encodeURIComponent("visa requirements for Indian passport to " + (trip.toCity || "")) });
      items.push({ id: "doc-insurance", group: "Documents", label: "Travel insurance", hint: "Many countries require it; worth it regardless for medical cover abroad." });
      items.push({ id: "doc-forex", group: "Documents", label: "Forex / int'l card sorted", hint: "Carry some local currency + a card that works abroad with low markup." });
    } else {
      items.push({ id: "doc-id", group: "Documents", label: "Govt photo ID for the airport/station", hint: "Aadhaar / driving licence / passport — needed at security and to board." });
    }

    // ---- BOOKINGS ----
    items.push({ id: "book-transport", group: "Bookings", label: "Travel booked (flight / train / bus)", hint: "Lock the main leg first — fares + seats move fast." });
    if (trip && trip.nights) items.push({ id: "book-stay", group: "Bookings", label: "Stay booked for " + trip.nights + " night" + (trip.nights > 1 ? "s" : ""), hint: "Confirm the dates match your travel days." });
    items.push({ id: "book-firstnight", group: "Bookings", label: "Airport transfer / first-night plan", hint: "Know how you'll get from the airport/station to where you sleep." });

    // ---- MONEY ----
    items.push({ id: "money-card", group: "Money", label: hasCards ? "Best-offer card in your wallet" : "Add the cards you hold", hint: hasCards ? "TripLens already picked the best card to pay with on this trip." : "Add your cards so I can flag the best one to pay with + lounges you open.", auto: hasCards });

    // ---- PACKING (weather-aware) ----
    items.push({ id: "pack-essentials", group: "Packing", label: "Phone, charger, power bank, meds", hint: "The stuff that ruins the trip if forgotten." });
    if (weather) {
      if (weather.monsoon) items.push({ id: "pack-rain", group: "Packing", label: "Rain layer / umbrella", hint: "Forecast shows rain likely at your destination." });
      if (weather.cold) items.push({ id: "pack-warm", group: "Packing", label: "Warm clothes", hint: "It'll be cold there over your dates." });
      if (weather.hot) items.push({ id: "pack-sun", group: "Packing", label: "Light clothes + sunscreen", hint: "It'll be hot there over your dates." });
    }

    return { international: intl, items: items };
  }

  // progress over a checklist given the trip's checked map { id: true }.
  function progress(items, checked) {
    checked = checked || {};
    var total = (items || []).length;
    var done = (items || []).filter(function (i) { return checked[i.id] || (i.auto && checked[i.id] !== false); }).length;
    return { done: done, total: total, pct: total ? Math.round((done / total) * 100) : 0, ready: total > 0 && done >= total };
  }

  // countdown: null if no depart date or it's in the past handled by caller.
  function daysToGo(departISO, todayISO) {
    var n = daysBetween(todayISO, departISO);
    return n;
  }
  function countdownLabel(n) {
    if (n == null) return "";
    if (n < 0) return "trip started " + Math.abs(n) + " day" + (Math.abs(n) > 1 ? "s" : "") + " ago";
    if (n === 0) return "today!";
    if (n === 1) return "tomorrow";
    return "in " + n + " days";
  }

  var Engine = {
    isInternational: isInternational, buildChecklist: buildChecklist, progress: progress,
    daysToGo: daysToGo, countdownLabel: countdownLabel, daysBetween: daysBetween,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = Engine;
  root.LL_READINESS = Engine;
})(typeof window !== "undefined" ? window : globalThis);
