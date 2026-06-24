/*
 * TripLens — transport engine. Trains + buses, multi-modal compare. Pure, no DOM.
 *
 * Builds the browser-verified deep links in data/transport.js, and produces an
 * honest fly-vs-train-vs-bus recommendation from REAL distance (geo-engine).
 *
 * HONESTY: no fake prices or schedules. Distance is real (haversine). Durations
 * are clearly-labelled ESTIMATES from distance + typical speeds (train ~55 km/h
 * effective incl. stops, bus ~45 km/h on Indian highways, flight via geo-engine).
 * Cost direction is a heuristic ("usually cheaper"), never a number. Booking links
 * open the real live search where the true price + timetable live.
 */
(function (root) {
  "use strict";

  function geo() { return root.LL_GEO || (typeof require !== "undefined" ? safeReq("./geo-engine.js") : null); }
  function safeReq(p) { try { return require(p); } catch (e) { return null; } }

  // city -> url slug ("New Delhi" -> "new-delhi", "Goa (Dabolim)" -> "goa")
  function slug(city) {
    return (city || "").toLowerCase()
      .replace(/\(.*?\)/g, " ")              // drop "(Dabolim)" etc
      .replace(/[^a-z0-9]+/g, " ").trim()
      .replace(/\s+/g, "-");
  }

  function pad2(n) { return n < 10 ? "0" + n : "" + n; }
  function ddmmmyyyy(iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || ""); if (!m) return "";
    const mon = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][+m[2] - 1];
    return m[3] + "-" + mon + "-" + m[1];
  }

  // fill a transport provider/template url with route + date
  function buildLink(provider, fromCity, toCity, dateISO) {
    let url = provider.url;
    const fs = slug(fromCity), ts = slug(toCity);
    const F = encodeURIComponent(fromCity || ""), T = encodeURIComponent(toCity || "");
    url = url
      .replace(/\{FROM_SLUG\}/g, fs).replace(/\{TO_SLUG\}/g, ts)
      .replace(/\{FROM\}/g, F).replace(/\{TO\}/g, T);
    if (/\{DATE/.test(url)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateISO || "")) {
        // date-needing template but no date: fall back to the site origin
        try { return new URL(url).origin + "/"; } catch (e) { return url; }
      }
      url = url.replace(/\{DATE_DDMMMYYYY\}/g, ddmmmyyyy(dateISO)).replace(/\{DATE\}/g, dateISO);
    }
    return url;
  }

  // duration estimates (minutes) from distance. Clearly estimates.
  function trainTimeMin(km) { return km == null ? null : Math.round((km / 55) * 60 + 20); }
  function busTimeMin(km) { return km == null ? null : Math.round((km / 45) * 60 + 25); }
  function fmtDur(mins) { if (mins == null) return ""; const h = Math.floor(mins / 60), m = mins % 60; return (h ? h + "h " : "") + m + "m"; }

  // door-to-door overhead (minutes) — the honest "total trip" view, not just the
  // headline number. Flying looks fast on the air time but loses hours to airport
  // buffer + getting to/from airports that sit outside the city. Trains and buses
  // leave from central stations so their overhead is small. All clearly estimates.
  var FLIGHT_OVERHEAD_MIN = 165; // ~2h before + ~45m airport-to-city after, India domestic
  var TRAIN_OVERHEAD_MIN = 40;   // central station, reach a bit early
  var BUS_OVERHEAD_MIN = 30;     // board at a central stand
  function doorToDoorMin(mode, km, flightAirMin) {
    if (km == null) return null;
    if (mode === "flight") return flightAirMin == null ? null : flightAirMin + FLIGHT_OVERHEAD_MIN;
    if (mode === "train") return trainTimeMin(km) + TRAIN_OVERHEAD_MIN;
    if (mode === "bus") return busTimeMin(km) + BUS_OVERHEAD_MIN;
    return null;
  }

  // honest ordinal ranks (1 = best) used for the cheaper / faster / comfortable
  // picks. Cost + comfort are general India heuristics (no fabricated prices);
  // speed is computed from the real door-to-door estimate above.
  // comfort: trains let you walk around + sleep flat overnight, so usually the
  // comfiest; flight is fast but cramped + airport hassle; bus is the least comfy.
  function costRank(mode) { return mode === "bus" ? 1 : mode === "train" ? 2 : 3; }     // bus usually cheapest
  function comfortRank(mode) { return mode === "train" ? 1 : mode === "flight" ? 2 : 3; } // train usually comfiest

  // rank the three modes by what the traveller cares about most.
  // priority: "cheap" | "fast" | "comfort". Returns [{mode, why}] best-first.
  function rankModes(fromCode, toCode, priority, opts) {
    opts = opts || {};
    const G = geo();
    const km = opts.km != null ? opts.km : (G ? G.distanceKm(fromCode, toCode) : null);
    if (km == null) return null;
    const air = opts.flightAirMin != null ? opts.flightAirMin : (G ? G.flightTimeMin(fromCode, toCode) : null);
    const modes = ["flight", "train", "bus"].map((m) => ({
      mode: m,
      d2d: doorToDoorMin(m, km, air),
      cost: costRank(m),
      comfort: comfortRank(m),
    }));
    let scored;
    if (priority === "cheap") {
      scored = modes.slice().sort((a, b) => a.cost - b.cost || (a.d2d || 1e9) - (b.d2d || 1e9));
      scored.forEach((x) => x.why = x.cost === 1 ? "usually the cheapest fare" : x.cost === 2 ? "mid-priced, often cheaper than flying" : "usually the priciest (fares vary)");
    } else if (priority === "fast") {
      scored = modes.slice().sort((a, b) => (a.d2d || 1e9) - (b.d2d || 1e9));
      scored.forEach((x) => x.why = x.d2d == null ? "no estimate (no map data)" : "~" + fmtDur(x.d2d) + " door-to-door (incl. airport/station time)");
    } else { // comfort
      scored = modes.slice().sort((a, b) => a.comfort - b.comfort || (a.d2d || 1e9) - (b.d2d || 1e9));
      scored.forEach((x) => x.why = x.comfort === 1 ? "roomiest — walk around, sleep flat on overnight trains" : x.comfort === 2 ? "fast but cramped + airport hassle" : "tightest seat, but cheap");
    }
    return { km, priority, ranked: scored };
  }

  // honest stops / non-stop guidance. We do NOT have live schedules, so this tells
  // the traveller what to EXPECT and exactly which filter to use on the booking site
  // — never claims a specific flight is non-stop.
  function stopsGuidance(km) {
    if (km == null) return null;
    let flight;
    if (km <= 1000) flight = "Non-stop flights are common on a hop this short. On the booking site set the Stops filter to Non-stop so you don't get routed through a hub.";
    else if (km <= 2000) flight = "Most flights here are non-stop, but some route via a hub. Use the Stops filter: pick Non-stop for speed, or allow 1 stop if it's a lot cheaper.";
    else flight = "Long route — non-stop may exist, but 1-stop connections via Delhi, Mumbai or Bengaluru are common and often cheaper. Compare Non-stop vs 1-stop on the site.";
    return {
      flight,
      train: "Trains don't have stops like flights. Instead pick the class: express trains (Vande Bharat, Shatabdi, Rajdhani) are fastest; passenger trains stop everywhere. Sort by duration on the search.",
      bus: "Buses are direct point-to-point. For comfort pick AC Sleeper over a seater, and check pick-up/drop points — some stop on the outskirts, not the centre.",
    };
  }

  // the headline: fly vs train vs bus for a route, by REAL distance between airports.
  // Returns modes with estimated time + a cost/comfort lean + a "best for" tag.
  // distanceKm can be passed (city-level) or derived from airport codes via geo.
  function compareModes(fromCode, toCode, opts) {
    opts = opts || {};
    const G = geo();
    const km = opts.km != null ? opts.km : (G ? G.distanceKm(fromCode, toCode) : null);
    if (km == null) return null;
    const flightMin = G ? G.flightTimeMin(fromCode, toCode) : null;
    // honest banding
    let recommend, bands;
    if (km <= 300) {
      recommend = "train_bus";
      bands = { train: "fast + cheap", bus: "cheapest", fly: "rarely worth it (airport time > the trip)" };
    } else if (km <= 700) {
      recommend = "compare";
      bands = { train: "overnight train saves a hotel night", bus: "sleeper bus = cheapest overnight", fly: "fastest if fare is low" };
    } else if (km <= 1500) {
      recommend = "fly_or_overnight_train";
      bands = { train: "long but cheap (overnight/day)", bus: "long-haul, only if very cheap", fly: "usually the practical pick" };
    } else {
      recommend = "fly";
      bands = { train: "very long (1+ nights)", bus: "not practical", fly: "the only sensible option" };
    }
    const flightD2D = doorToDoorMin("flight", km, flightMin);
    return {
      km,
      recommend,
      modes: [
        { mode: "flight", icon: "✈️", timeMin: flightMin, timeLabel: flightMin ? "~" + fmtDur(flightMin) + " in air" : "—", d2dMin: flightD2D, d2dLabel: flightD2D ? "~" + fmtDur(flightD2D) + " door-to-door" : "", note: bands.fly, costLean: km <= 300 ? "highest (after airport time)" : "varies" },
        { mode: "train", icon: "🚆", timeMin: trainTimeMin(km), timeLabel: "~" + fmtDur(trainTimeMin(km)), d2dMin: doorToDoorMin("train", km), d2dLabel: "~" + fmtDur(doorToDoorMin("train", km)) + " door-to-door", note: bands.train, costLean: "usually cheaper" },
        { mode: "bus", icon: "🚌", timeMin: busTimeMin(km), timeLabel: "~" + fmtDur(busTimeMin(km)), d2dMin: doorToDoorMin("bus", km), d2dLabel: "~" + fmtDur(doorToDoorMin("bus", km)) + " door-to-door", note: bands.bus, costLean: "often cheapest" },
      ],
    };
  }

  // provider lists with links filled for a route
  function trainOptions(data, fromCity, toCity, dateISO) {
    return (data.trains || []).map((p) => ({ provider: p, link: buildLink(p, fromCity, toCity, dateISO) }));
  }
  function busOptions(data, fromCity, toCity, dateISO) {
    return (data.buses || []).map((p) => ({ provider: p, link: buildLink(p, fromCity, toCity, dateISO) }));
  }

  const Engine = { slug, ddmmmyyyy, buildLink, trainTimeMin, busTimeMin, fmtDur, doorToDoorMin, compareModes, rankModes, stopsGuidance, trainOptions, busOptions };
  if (typeof module !== "undefined" && module.exports) module.exports = Engine;
  root.LL_TRANSPORT_ENGINE = Engine;
})(typeof window !== "undefined" ? window : globalThis);
