/*
 * TripLens — itinerary engine. Pure logic for saved trips + day-by-day plans.
 * No DOM. Node-testable (tests-itinerary.js).
 *
 * A "trip" is a saved object the user owns:
 *   { id, title, from, to, depart, nights, adults, days:[{items:[...]}],
 *     packing:{checked:{}}, notes, createdTs }
 * Each day item: { id, time, kind, title, note, link }
 *   kind ∈ flight | hotel | lounge | cab | food | activity | note
 *
 * HONESTY MODEL: the itinerary stores the USER'S plan + links to real sites.
 * It never invents a price. Any number here is user-entered (a budget note).
 *
 * Pure, deterministic. IDs are derived from a passed seed/counter — NO Date.now()
 * or Math.random() inside (so it's testable + replayable). Callers pass `now`/seed.
 */
(function (root) {
  "use strict";

  function pad2(n) { return n < 10 ? "0" + n : "" + n; }
  function parseISO(s) { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ""); return m ? { y: +m[1], mo: +m[2], d: +m[3] } : null; }
  function addDays(iso, days) {
    const p = parseISO(iso); if (!p) return null;
    const dt = new Date(Date.UTC(p.y, p.mo - 1, p.d)); dt.setUTCDate(dt.getUTCDate() + days);
    return dt.getUTCFullYear() + "-" + pad2(dt.getUTCMonth() + 1) + "-" + pad2(dt.getUTCDate());
  }
  const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const MO = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  function dayLabel(iso) {
    const p = parseISO(iso); if (!p) return "";
    const dt = new Date(Date.UTC(p.y, p.mo - 1, p.d));
    return WD[dt.getUTCDay()] + ", " + p.d + " " + MO[p.mo - 1];
  }

  // a small deterministic id: prefix + seed counter, so tests are stable.
  function mkId(prefix, seed) { return prefix + "-" + seed; }

  // ---- create a blank trip ------------------------------------------------
  // opts: { title, from, to, depart, nights, adults, id }
  function newTrip(opts) {
    opts = opts || {};
    const nights = Math.max(1, +opts.nights || 1);
    const dayCount = nights + 1; // arrival day ... departure day inclusive
    const days = [];
    for (let i = 0; i < dayCount; i++) {
      days.push({ date: opts.depart ? addDays(opts.depart, i) : null, items: [] });
    }
    return {
      id: opts.id || mkId("trip", opts.seed || 1),
      title: opts.title || ((opts.from || "?") + " → " + (opts.to || "?")),
      from: opts.from || "", to: opts.to || "",
      depart: opts.depart || "", nights, adults: Math.max(1, +opts.adults || 1),
      days, packing: { checked: {} }, notes: opts.notes || "", createdTs: opts.createdTs || 0,
    };
  }

  // ---- day helpers --------------------------------------------------------
  function dayCount(trip) { return (trip && trip.days && trip.days.length) || 0; }

  // add an item to a day (returns the item; mutates trip.days[dayIdx])
  function addItem(trip, dayIdx, item, seed) {
    if (!trip.days[dayIdx]) return null;
    const it = {
      id: (item && item.id) || mkId("it", seed || (countItems(trip) + 1)),
      time: (item && item.time) || "",
      kind: (item && item.kind) || "note",
      title: (item && item.title) || "",
      note: (item && item.note) || "",
      link: (item && item.link) || "",
    };
    trip.days[dayIdx].items.push(it);
    sortDay(trip.days[dayIdx]);
    return it;
  }
  function removeItem(trip, dayIdx, itemId) {
    if (!trip.days[dayIdx]) return false;
    const before = trip.days[dayIdx].items.length;
    trip.days[dayIdx].items = trip.days[dayIdx].items.filter((x) => x.id !== itemId);
    return trip.days[dayIdx].items.length < before;
  }
  // move an item between days (or within). returns true on success.
  function moveItem(trip, fromDay, itemId, toDay) {
    if (!trip.days[fromDay] || !trip.days[toDay]) return false;
    const idx = trip.days[fromDay].items.findIndex((x) => x.id === itemId);
    if (idx < 0) return false;
    const [it] = trip.days[fromDay].items.splice(idx, 1);
    trip.days[toDay].items.push(it);
    sortDay(trip.days[toDay]);
    return true;
  }
  // sort a day's items by time (blank times sink to the bottom, stable-ish)
  function sortDay(day) {
    day.items.sort((a, b) => {
      const at = a.time || "99:99", bt = b.time || "99:99";
      return at < bt ? -1 : at > bt ? 1 : 0;
    });
  }
  function countItems(trip) { return (trip.days || []).reduce((n, d) => n + d.items.length, 0); }

  // ---- seed an itinerary from a Trip-Optimizer plan ----------------------
  // Drops sensible starter items: outbound flight + lounge on day 0, hotel
  // check-in day 0, hotel check-out last day, a "explore" note on middle days.
  // plan = output of LL_TRIP_ENGINE.planTrip. Returns the mutated trip.
  function seedFromPlan(trip, plan, opts) {
    opts = opts || {};
    let seed = (opts.seedStart || 1000);
    const next = () => ++seed;
    if (!trip.days.length) return trip;
    const last = trip.days.length - 1;
    const r = plan && plan.route ? plan.route : {};
    const fromCity = (r.origin && r.origin.city) || trip.from;
    const destCity = (r.dest && r.dest.city) || trip.to;

    // day 0: flight out + origin lounge + check-in
    const topFlight = plan && plan.flights && plan.flights[0];
    addItem(trip, 0, { time: "08:00", kind: "flight", title: "Flight " + (r.from || "") + " → " + (r.to || ""), note: "Compare + book", link: topFlight ? topFlight.link : "" }, next());
    if (plan && plan.lounges && plan.lounges.origin && plan.lounges.origin.openCount > 0) {
      addItem(trip, 0, { time: "06:30", kind: "lounge", title: "Lounge at " + fromCity + " airport", note: plan.lounges.origin.openCount + " your cards open — arrive early, eat free" }, next());
    }
    const topStay = plan && plan.stay && plan.stay[0];
    addItem(trip, 0, { time: "14:00", kind: "hotel", title: "Hotel check-in · " + destCity, note: "Book on " + (topStay ? topStay.provider.name : "a compare site"), link: topStay ? topStay.link : "" }, next());

    // middle days: an explore placeholder
    for (let i = 1; i < last; i++) {
      addItem(trip, i, { time: "10:00", kind: "activity", title: "Explore " + destCity, note: "Add tours / food / sights from On-Trip Deals" }, next());
    }
    // last day: checkout + return flight + dest lounge
    if (last > 0) {
      addItem(trip, last, { time: "11:00", kind: "hotel", title: "Hotel check-out", note: "" }, next());
      if (plan && plan.lounges && plan.lounges.dest && plan.lounges.dest.openCount > 0) {
        addItem(trip, last, { time: "16:00", kind: "lounge", title: "Lounge at " + destCity + " airport", note: plan.lounges.dest.openCount + " your cards open" }, next());
      }
      addItem(trip, last, { time: "18:00", kind: "flight", title: "Return flight " + (r.to || "") + " → " + (r.from || ""), note: "Book the return", link: topFlight ? topFlight.link : "" }, next());
    }
    return trip;
  }

  // ---- packing generator --------------------------------------------------
  // Builds a checklist tailored to nights + a few flags. Deterministic.
  // flags: { intl, cold, beach, business, monsoon }
  function packingList(trip, flags) {
    flags = flags || {};
    const nights = trip.nights || 1;
    const list = [];
    const add = (cat, item) => list.push({ cat, item });
    // essentials always
    add("Documents", "Govt photo ID / passport" + (flags.intl ? " + visa" : ""));
    add("Documents", "Boarding pass / ticket (offline copy)");
    add("Documents", "Hotel booking confirmation");
    add("Money", "Cards you actually use for offers (the trip's best card)");
    if (flags.intl) add("Money", "Zero-markup forex card / some local cash");
    add("Tech", "Phone + charger");
    add("Tech", "Power bank (airport + travel days)");
    if (flags.intl) add("Tech", "Universal travel adapter");
    if (flags.intl) add("Tech", "eSIM activated / roaming pack");
    // clothing scales with nights
    const outfits = Math.min(nights + 1, 10);
    add("Clothing", outfits + " day outfits");
    add("Clothing", "Underwear + socks x" + (nights + 1));
    add("Clothing", "Sleepwear");
    if (flags.cold) { add("Clothing", "Warm jacket / layers"); add("Clothing", "Gloves + beanie"); }
    if (flags.beach) { add("Clothing", "Swimwear + flip-flops"); add("Toiletries", "Sunscreen SPF 50"); }
    if (flags.business) { add("Clothing", "Formal outfit + shoes"); add("Tech", "Laptop + charger"); }
    if (flags.monsoon) { add("Clothing", "Compact umbrella / rain jacket"); add("Misc", "Dry bag for electronics"); }
    add("Toiletries", "Toothbrush + paste, deodorant");
    add("Toiletries", "Any prescription meds + basic first-aid");
    add("Misc", "Reusable water bottle");
    add("Misc", "Headphones");
    if (nights >= 4) add("Misc", "Small laundry bag");
    return list;
  }
  // stable key for a packing item so checked-state survives re-render
  function packKey(p) { return (p.cat + ":" + p.item).toLowerCase().replace(/[^a-z0-9]+/g, "-"); }

  // ---- summary for the My Trips list -------------------------------------
  function tripSummary(trip) {
    return {
      id: trip.id, title: trip.title, from: trip.from, to: trip.to,
      depart: trip.depart, nights: trip.nights, adults: trip.adults,
      dayCount: dayCount(trip), itemCount: countItems(trip),
      dateRange: trip.depart ? (dayLabel(trip.depart) + (trip.nights ? " · " + trip.nights + "n" : "")) : "no dates",
    };
  }

  // ---- export / import (share a trip as a portable code) ------------------
  function exportTrip(trip) { return JSON.stringify({ kind: "triplens-itinerary", v: 1, trip }); }
  function importTrip(str) {
    try {
      const o = JSON.parse(str);
      if (o && o.kind === "triplens-itinerary" && o.trip && o.trip.days) return o.trip;
    } catch (e) {}
    return null;
  }

  const Engine = {
    parseISO, addDays, dayLabel, mkId,
    newTrip, dayCount, addItem, removeItem, moveItem, sortDay, countItems,
    seedFromPlan, packingList, packKey, tripSummary, exportTrip, importTrip,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = Engine;
  root.LL_ITINERARY = Engine;
})(typeof window !== "undefined" ? window : globalThis);
