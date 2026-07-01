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

  // reschedule a trip: change the start date and/or number of nights, re-dating
  // every day from the new start. Day count = nights + 1 (arrival .. departure).
  // NON-DESTRUCTIVE: if the trip shrinks, items on the dropped days are MOVED to
  // the new last day rather than deleted — a date change never silently loses a
  // plan the user made. Mutates + returns the trip. Pure (no clock).
  function reschedule(trip, newDepart, newNights) {
    if (!trip || !trip.days) return trip;
    const nights = Math.max(1, +newNights || trip.nights || 1);
    const wantDays = nights + 1;
    const depart = parseISO(newDepart) ? newDepart : (trip.depart || "");
    // shrink: fold dropped days' items into what will become the last kept day
    if (trip.days.length > wantDays) {
      const lastKept = trip.days[wantDays - 1];
      for (let i = wantDays; i < trip.days.length; i++) {
        (trip.days[i].items || []).forEach((it) => lastKept.items.push(it));
      }
      trip.days = trip.days.slice(0, wantDays);
      sortDay(lastKept);
    }
    // grow: append empty days
    while (trip.days.length < wantDays) {
      trip.days.push({ date: null, items: [] });
    }
    // re-date every day from the new start (or clear dates if no valid start)
    trip.days.forEach((day, i) => { day.date = depart ? addDays(depart, i) : null; });
    trip.depart = depart;
    trip.nights = nights;
    return trip;
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
    // graceful label: if we don't know the origin yet (e.g. a quick-start trip
    // before the user set a home city), say "Flight to GOI" rather than
    // "Flight  → GOI" with an empty gap.
    const outLabel = r.from ? ("Flight " + r.from + " → " + (r.to || "")) : ("Flight to " + (destCity || r.to));
    addItem(trip, 0, { time: "08:00", kind: "flight", title: outLabel, note: r.from ? "Compare + book" : "Set your home city up top to fill this in", link: topFlight ? topFlight.link : "" }, next());
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
      // the return flight is its OWN search: dest -> origin on the checkout
      // date. Use the plan's returnFlights link (not the outbound link, which
      // pointed the wrong way on the wrong date).
      const retFlight = plan && plan.returnFlights && plan.returnFlights[0];
      const retLabel = r.from ? ("Return flight " + (r.to || "") + " → " + r.from) : ("Return flight from " + (destCity || r.to));
      addItem(trip, last, { time: "18:00", kind: "flight", title: retLabel, note: r.from ? "Book the return" : "Set your home city up top to fill this in", link: retFlight ? retFlight.link : (topFlight ? topFlight.link : "") }, next());
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

  // pick the trip to greet a returning user with: the one that is happening now
  // or coming up soonest. Ignores trips that already ended and undated ones.
  // Pure — `todayISO` is injected so it stays deterministic + testable.
  //   returns the trip object, or null if none is upcoming/ongoing.
  function nextUpcomingTrip(trips, todayISO) {
    const today = parseISO(todayISO);
    if (!today || !Array.isArray(trips)) return null;
    const todayN = today.y * 10000 + today.mo * 100 + today.d;
    let best = null, bestKey = null;
    trips.forEach((t) => {
      const dp = parseISO(t.depart);
      if (!dp) return;                                   // undated -> skip
      const departN = dp.y * 10000 + dp.mo * 100 + dp.d;
      const nights = Math.max(0, +t.nights || 0);
      const endISO = addDays(t.depart, nights);          // last day of the trip
      const ep = parseISO(endISO);
      const endN = ep ? ep.y * 10000 + ep.mo * 100 + ep.d : departN;
      if (endN < todayN) return;                         // already ended -> skip
      // rank: soonest departure wins (ongoing trips have departN <= today, which
      // naturally sorts them first since their departN is smallest among live ones)
      if (bestKey == null || departN < bestKey) { best = t; bestKey = departN; }
    });
    return best;
  }

  // ---- calendar export (.ics) ---------------------------------------------
  // Turn the trip's day-by-day items into a standard iCalendar file the user can
  // import into Google/Apple/Outlook calendar. This is purely THEIR plan in a
  // standard format — no fabricated data. Items with a time become timed events;
  // items without become all-day events on that day. `stamp` is a fixed
  // "YYYYMMDDTHHMMSSZ" UTC string passed in (engine purity — no Date.now()).
  function icsEscape(s) {
    return String(s == null ? "" : s)
      .replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,")
      .replace(/\r?\n/g, "\\n");
  }
  // fold lines to the 75-octet iCalendar limit (continuation lines start with a space)
  function icsFold(line) {
    if (line.length <= 75) return line;
    var out = line.slice(0, 75), rest = line.slice(75);
    while (rest.length > 74) { out += "\r\n " + rest.slice(0, 74); rest = rest.slice(74); }
    return out + "\r\n " + rest;
  }
  function ymdCompact(iso) { var p = parseISO(iso); return p ? (p.y + pad2(p.mo) + pad2(p.d)) : null; }

  // returns the full .ics text, or null if the trip has no dated days to place events on.
  function toICS(trip, stamp) {
    if (!trip || !trip.days) return null;
    stamp = stamp || "19700101T000000Z";
    var lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//TripLens//Trip//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH"];
    var evCount = 0;
    var safeTitle = trip.title || ((trip.from || "?") + " to " + (trip.to || "?"));
    trip.days.forEach(function (day, di) {
      if (!day.date) return;                 // can't place an event with no date
      var dayYmd = ymdCompact(day.date);
      if (!dayYmd) return;
      (day.items || []).forEach(function (it, ii) {
        var uid = (trip.id || "trip") + "-" + di + "-" + (it.id || ii) + "@triplens";
        var summary = (KIND_PREFIX[it.kind] || "") + (it.title || KIND_WORD[it.kind] || "Plan");
        lines.push("BEGIN:VEVENT");
        lines.push("UID:" + uid);
        lines.push("DTSTAMP:" + stamp);
        var t = parseTime(it.time);
        if (t) {
          // timed, 1-hour default block, written as floating local time (no TZ = local)
          var start = dayYmd + "T" + pad2(t.h) + pad2(t.m) + "00";
          var endMin = t.h * 60 + t.m + 60, eh = Math.floor(endMin / 60) % 24, em = endMin % 60;
          var endDay = endMin >= 1440 ? ymdCompact(addDays(day.date, 1)) : dayYmd;
          lines.push("DTSTART:" + start);
          lines.push("DTEND:" + endDay + "T" + pad2(eh) + pad2(em) + "00");
        } else {
          // all-day event (DATE value type, end = next day per spec)
          lines.push("DTSTART;VALUE=DATE:" + dayYmd);
          lines.push("DTEND;VALUE=DATE:" + ymdCompact(addDays(day.date, 1)));
        }
        lines.push("SUMMARY:" + icsEscape(summary));
        var descBits = [];
        if (it.note) descBits.push(it.note);
        if (it.link) descBits.push(it.link);
        descBits.push("Trip: " + safeTitle);
        lines.push("DESCRIPTION:" + icsEscape(descBits.join("\n")));
        if (it.link) lines.push("URL:" + icsEscape(it.link));
        lines.push("END:VEVENT");
        evCount++;
      });
    });
    lines.push("END:VCALENDAR");
    if (evCount === 0) return null;          // nothing dated to export — honest null
    return lines.map(icsFold).join("\r\n") + "\r\n";
  }
  function parseTime(s) { var m = /^(\d{1,2}):(\d{2})$/.exec(s || ""); if (!m) return null; var h = +m[1], mi = +m[2]; return (h <= 23 && mi <= 59) ? { h: h, m: mi } : null; }
  var KIND_PREFIX = { flight: "Flight: ", hotel: "Hotel: ", lounge: "Lounge: ", cab: "Cab: ", food: "Food: ", activity: "Activity: ", note: "" };
  var KIND_WORD = { flight: "Flight", hotel: "Hotel", lounge: "Lounge visit", cab: "Cab / transfer", food: "Meal", activity: "Activity", note: "Note" };

  // ---- human-readable share text -----------------------------------------
  // Turn the trip into a clean plain-text plan a normal person can read in
  // WhatsApp / Messages / email. Pure: no clock, no DOM. It is ENTIRELY the
  // user's own plan — every line comes from items they kept, every link is the
  // real search link already stored on the item. Nothing is fabricated: no
  // price, no fare, no invented venue. The footer makes the honesty explicit.
  function shareText(trip) {
    if (!trip || !trip.days) return "";
    var title = trip.title || ((trip.from || "?") + " to " + (trip.to || "?"));
    var lines = [];
    lines.push(title + " — my trip plan");
    var meta = [];
    if (trip.depart) meta.push(dayLabel(trip.depart) + (trip.nights ? " for " + trip.nights + " night" + (trip.nights > 1 ? "s" : "") : ""));
    if (trip.adults) meta.push(trip.adults + " traveller" + (trip.adults > 1 ? "s" : ""));
    if (meta.length) lines.push(meta.join(" · "));
    lines.push("");
    trip.days.forEach(function (day, di) {
      var head = "Day " + (di + 1) + (day.date ? " — " + dayLabel(day.date) : "");
      lines.push(head);
      var items = (day.items || []);
      if (!items.length) { lines.push("  (nothing planned yet)"); lines.push(""); return; }
      items.forEach(function (it) {
        var bits = [];
        if (it.time) bits.push(it.time);
        bits.push((KIND_ICON[it.kind] || "•") + " " + (it.title || KIND_WORD[it.kind] || "Plan"));
        lines.push("  " + bits.join("  "));
        if (it.link) lines.push("    " + it.link);
      });
      lines.push("");
    });
    lines.push("Planned with TripLens. Prices and bookings open on the real sites — nothing here is made up.");
    return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
  }
  var KIND_ICON = { flight: "✈️", hotel: "🏨", lounge: "🛋️", cab: "🚕", food: "🍽️", activity: "🎟️", note: "📝" };

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
    seedFromPlan, packingList, packKey, tripSummary, nextUpcomingTrip, exportTrip, importTrip, toICS, shareText, reschedule,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = Engine;
  root.LL_ITINERARY = Engine;
})(typeof window !== "undefined" ? window : globalThis);
