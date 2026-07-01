/*
 * TripLens — natural-language trip parser. Pure, no DOM, no clock, no network.
 *
 * THE IDEA: let a person just TYPE their trip the way they'd say it out loud —
 * "5 days in Goa from Delhi next month for 2" — and turn it into a trip the app
 * can build. 100% deterministic, offline, no LLM. Same sentence always gives the
 * same result.
 *
 * HONESTY MODEL — this is the strict part, same spirit as the rest of the app:
 *  - We only ever RESOLVE what the person typed. We never invent a city, a date,
 *    or a party size they didn't say. Anything we couldn't find stays null.
 *  - The parser returns an `understood` list: exactly what it read back, in plain
 *    words, so the UI can show it and the person can correct it before building.
 *    We would rather show "couldn't tell where to" than silently guess wrong.
 *  - `resolve()` fills only the two things a trip physically needs (nights, a
 *    start date) with clearly-flagged defaults, so nothing is hidden.
 *  - Dates are computed with Date.UTC (no local clock, no ambiguity). `todayISO`
 *    is passed in — the engine never reads the wall clock itself.
 *
 * cities: an array of { code, city } (the app passes its known airports). We match
 * against those names + a small set of everyday aliases (bombay -> Mumbai, etc).
 */
(function (root) {
  "use strict";

  var MON_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var DOW_ABBR = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  var MONTHS = {
    jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4,
    may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9,
    september: 9, oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
  };
  var WEEKDAYS = {
    sun: 0, sunday: 0, mon: 1, monday: 1, tue: 2, tues: 2, tuesday: 2, wed: 3,
    weds: 3, wednesday: 3, thu: 4, thur: 4, thurs: 4, thursday: 4, fri: 5,
    friday: 5, sat: 6, saturday: 6,
  };
  // small number words so "a week", "three nights", "couple of days" work
  var NUMWORDS = {
    a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
    eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, couple: 2, few: 3,
  };
  // everyday aliases -> canonical IATA code. Only well-known, unambiguous names.
  var ALIASES = {
    bombay: "BOM", calcutta: "CCU", madras: "MAA", bangalore: "BLR",
    trivandrum: "TRV", cochin: "COK", vizag: "VTZ", benares: "VNS",
    banaras: "VNS", kashi: "VNS", kashmir: "SXR", andaman: "IXZ",
    andamans: "IXZ", darjeeling: "IXB", nyc: "JFK", manhattan: "JFK",
    calicut: "CCJ", pondy: "MAA", vasco: "GOI", panaji: "GOI", panjim: "GOI",
  };

  // ---- pure date helpers (Date.UTC only — deterministic, no wall clock) -----
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function toISO(y, m, d) { return y + "-" + pad(m) + "-" + pad(d); }
  function daysInMonth(y, m) { return new Date(Date.UTC(y, m, 0)).getUTCDate(); }
  function parseISO(s) {
    if (typeof s !== "string") return null;
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
    if (!m) return null;
    var y = +m[1], mo = +m[2], d = +m[3];
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
    var dt = new Date(Date.UTC(y, mo - 1, d));
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
    return dt;
  }
  function fromDate(dt) { return toISO(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate()); }
  function addDays(iso, n) {
    var dt = parseISO(iso); if (!dt) return null;
    dt.setUTCDate(dt.getUTCDate() + n); return fromDate(dt);
  }
  function addMonths(iso, n) {
    var dt = parseISO(iso); if (!dt) return null;
    var day = dt.getUTCDate();
    dt.setUTCDate(1);
    dt.setUTCMonth(dt.getUTCMonth() + n);
    var dim = daysInMonth(dt.getUTCFullYear(), dt.getUTCMonth() + 1);
    dt.setUTCDate(Math.min(day, dim));
    return fromDate(dt);
  }
  function dow(iso) { var dt = parseISO(iso); return dt ? dt.getUTCDay() : null; }
  function nextDow(todayISO, target, includeToday) {
    var cur = dow(todayISO); if (cur === null) return null;
    var delta = (target - cur + 7) % 7;
    if (delta === 0 && !includeToday) delta = 7;
    return addDays(todayISO, delta);
  }
  function fmtShort(iso) {
    var dt = parseISO(iso); if (!dt) return iso || "";
    return dt.getUTCDate() + " " + MON_ABBR[dt.getUTCMonth()];
  }
  function fmtLong(iso) {
    var dt = parseISO(iso); if (!dt) return iso || "";
    return DOW_ABBR[dt.getUTCDay()] + " " + dt.getUTCDate() + " " + MON_ABBR[dt.getUTCMonth()];
  }

  // ---- city resolver -------------------------------------------------------
  // strip a trailing airport qualifier so real names match everyday typing:
  //   "Goa (Dabolim)" -> "goa",  "London Heathrow" -> "london",  "New York JFK" -> "new york"
  var AIRPORT_WORDS = /\b(heathrow|gatwick|jfk|dabolim|mopa|intl|international|airport)\b/gi;
  function baseName(city) {
    return String(city)
      .replace(/\s*\([^)]*\)\s*/g, " ")   // drop "(Dabolim)" etc
      .replace(AIRPORT_WORDS, " ")         // drop known airport tokens
      .replace(/\s+/g, " ").trim().toLowerCase();
  }
  // "goa" -> "Goa", "new york" -> "New York" for a clean displayed label
  function titleCase(s) {
    return String(s).replace(/\b\w/g, function (c) { return c.toUpperCase(); });
  }
  // build [{ name, code, city }] longest-first so "port blair" wins over "blair".
  // `city` is kept as a clean label; each airport contributes its full name AND a
  // base name (qualifier stripped), deduped by name so "goa" resolves to one code.
  function buildNames(cities) {
    var out = [], seen = {};
    function add(name, code, label) {
      if (!name || name.length < 2) return;
      if (seen[name]) return;         // first airport with this name wins
      seen[name] = true;
      out.push({ name: name, code: code, city: label });
    }
    var byCode = {};
    (cities || []).forEach(function (c) {
      if (!c || !c.code || !c.city) return;
      var full = String(c.city).toLowerCase();
      var base = baseName(c.city);
      // label: prefer the clean base name ("Goa"), fall back to the given city
      var label = base ? titleCase(base) : c.city;
      add(full, c.code, label);
      if (base && base !== full) add(base, c.code, label);
      if (!byCode[c.code]) byCode[c.code] = label;
    });
    Object.keys(ALIASES).forEach(function (alias) {
      var code = ALIASES[alias];
      if (byCode[code]) add(alias, code, byCode[code]);
    });
    out.sort(function (a, b) { return b.name.length - a.name.length; });
    return out;
  }
  function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

  // find every city mention with the preposition (if any) right before it.
  function findCities(text, names) {
    if (!names.length) return [];
    var alt = names.map(function (e) { return escapeRe(e.name); }).join("|");
    var byName = {}; names.forEach(function (e) { if (!byName[e.name]) byName[e.name] = e; });
    var re = new RegExp("(?:\\b(from|to|in|at|via|visiting|visit|towards?|into)\\s+)?\\b(" + alt + ")\\b", "gi");
    var hits = [], m, seenAt = {};
    while ((m = re.exec(text)) !== null) {
      var prep = m[1] ? m[1].toLowerCase() : null;
      var nm = m[2].toLowerCase();
      var e = byName[nm];
      if (!e) continue;
      // don't double-count the same span
      if (seenAt[m.index]) continue;
      seenAt[m.index] = true;
      hits.push({ code: e.code, city: e.city, prep: prep, index: m.index });
      if (re.lastIndex === m.index) re.lastIndex++;
    }
    return hits;
  }

  function pickPlaces(hits) {
    var from = null, to = null;
    // origin = an explicit "from X"
    for (var i = 0; i < hits.length; i++) {
      if (hits[i].prep === "from") { from = hits[i]; break; }
    }
    var destPreps = { to: 1, in: 1, at: 1, via: 1, visiting: 1, visit: 1, toward: 1, towards: 1, into: 1 };
    // destination = an explicit "to/in/at/visit X" that isn't the origin
    for (var j = 0; j < hits.length; j++) {
      if (destPreps[hits[j].prep] && (!from || hits[j].index !== from.index)) { to = hits[j]; break; }
    }
    if (!to) {
      var others = hits.filter(function (h) { return !from || h.index !== from.index; });
      if (from && others.length) {
        to = others[0]; // "from Delhi ... Goa" -> Goa is the destination
      } else if (!from && hits.length === 1) {
        to = hits[0]; // a single bare city is where they're going
      } else if (!from && hits.length >= 2) {
        // "Delhi Goa ..." bare pair, reading order: first is origin, last is dest
        from = hits[0]; to = hits[hits.length - 1];
      }
    }
    return {
      from: from ? { code: from.code, city: from.city } : null,
      to: to ? { code: to.code, city: to.city } : null,
    };
  }

  // ---- date phrase parser --------------------------------------------------
  // returns { iso, label, matched, nightsHint } or null. `matched` is the exact
  // text span so the caller can strip it before reading duration/party size.
  function parseDate(text, todayISO) {
    var t = text.toLowerCase();
    var m;

    // explicit ISO 2026-07-15
    m = /\b(\d{4})-(\d{2})-(\d{2})\b/.exec(t);
    if (m) {
      var iso = m[0];
      if (parseISO(iso)) return { iso: iso, label: fmtShort(iso), matched: m[0] };
    }
    // DD/MM or DD/MM/YYYY or DD-MM-YYYY (Indian day-first order)
    m = /\b(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?\b/.exec(t);
    if (m) {
      var dd = +m[1], mo = +m[2], yy = m[3] ? +m[3] : null;
      if (yy !== null && yy < 100) yy += 2000;
      if (dd >= 1 && dd <= 31 && mo >= 1 && mo <= 12) {
        var year = yy || pickYear(todayISO, mo, dd);
        var isoD = toISO(year, mo, dd);
        if (parseISO(isoD)) return { iso: isoD, label: fmtShort(isoD), matched: m[0] };
      }
    }
    // "15 July", "15th july 2026", "on 15 jul"
    m = /\b(\d{1,2})(?:st|nd|rd|th)?\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t)?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)(?:\s+(\d{4}))?\b/.exec(t);
    if (m) {
      var d1 = +m[1], mn1 = MONTHS[m[2]], y1 = m[3] ? +m[3] : null;
      if (mn1 && d1 >= 1 && d1 <= daysInMonth(y1 || 2000, mn1) + (y1 ? 0 : 1)) {
        var yr1 = y1 || pickYear(todayISO, mn1, d1);
        var iso1 = toISO(yr1, mn1, d1);
        if (parseISO(iso1)) return { iso: iso1, label: fmtShort(iso1), matched: m[0] };
      }
    }
    // "July 15", "jul 15 2026"
    m = /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t)?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?(?:\s+(\d{4}))?\b/.exec(t);
    if (m) {
      var mn2 = MONTHS[m[1]], d2 = +m[2], y2 = m[3] ? +m[3] : null;
      if (mn2 && d2 >= 1 && d2 <= 31) {
        var yr2 = y2 || pickYear(todayISO, mn2, d2);
        var iso2 = toISO(yr2, mn2, d2);
        if (parseISO(iso2)) return { iso: iso2, label: fmtShort(iso2), matched: m[0] };
      }
    }
    // relative words
    if ((m = /\bday after tomorrow\b/.exec(t))) return { iso: addDays(todayISO, 2), label: "in 2 days", matched: m[0] };
    if ((m = /\btomorrow\b/.exec(t))) return { iso: addDays(todayISO, 1), label: "tomorrow", matched: m[0] };
    if ((m = /\b(?:today|tonight)\b/.exec(t))) return { iso: todayISO, label: "today", matched: m[0] };

    // "long weekend" / "this weekend" / "next weekend"
    if ((m = /\bnext weekend\b/.exec(t))) {
      var sat2 = addDays(nextDow(todayISO, 6, false), 7);
      return { iso: sat2, label: "next weekend", matched: m[0], nightsHint: 2 };
    }
    if ((m = /\blong weekend\b/.exec(t))) {
      return { iso: nextDow(todayISO, 5, true), label: "long weekend", matched: m[0], nightsHint: 3 };
    }
    if ((m = /\b(?:this )?weekend\b/.exec(t))) {
      // nearest Saturday including today if today is already Sat/Sun
      var cur = dow(todayISO);
      var satIso = (cur === 0) ? addDays(todayISO, -1) : nextDow(todayISO, 6, true);
      return { iso: satIso, label: "this weekend", matched: m[0], nightsHint: 2 };
    }
    // "in N days / weeks / months", "in a week/month"
    if ((m = /\bin\s+(\d+|a|an|one|two|three|four|five|six|seven|eight|nine|ten)\s+(day|days|week|weeks|month|months)\b/.exec(t))) {
      var n = NUMWORDS[m[1]] != null ? NUMWORDS[m[1]] : +m[1];
      var unit = m[2];
      if (/day/.test(unit)) return { iso: addDays(todayISO, n), label: "in " + n + (n === 1 ? " day" : " days"), matched: m[0] };
      if (/week/.test(unit)) return { iso: addDays(todayISO, n * 7), label: "in " + n + (n === 1 ? " week" : " weeks"), matched: m[0] };
      return { iso: addMonths(todayISO, n), label: "in " + n + (n === 1 ? " month" : " months"), matched: m[0] };
    }
    if ((m = /\bnext month\b/.exec(t))) return { iso: addMonths(todayISO, 1), label: "next month", matched: m[0] };
    if ((m = /\bnext week\b/.exec(t))) return { iso: nextDow(todayISO, 1, false), label: "next week", matched: m[0] };

    // "next friday" / "this saturday" / "on monday" / bare weekday
    var wdRe = /\b(?:(next|this|coming)\s+)?(?:on\s+)?(sun(?:day)?|mon(?:day)?|tue(?:s)?(?:day)?|wed(?:s)?(?:nesday)?|thu(?:r)?(?:s)?(?:day)?|fri(?:day)?|sat(?:urday)?)\b/;
    if ((m = wdRe.exec(t))) {
      var qual = m[1] || "";
      var target = WEEKDAYS[m[2]];
      if (target != null) {
        var base = nextDow(todayISO, target, false); // strictly upcoming
        if (qual === "next") base = addDays(base, 7);
        return { iso: base, label: fmtLong(base), matched: m[0] };
      }
    }
    // bare month name with "in" -> 1st of nearest future month (this month -> today)
    m = /\bin\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t)?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b/.exec(t);
    if (m) {
      var mn3 = MONTHS[m[1]];
      var d = parseISO(todayISO);
      if (mn3 && d) {
        var cy = d.getUTCFullYear(), cm = d.getUTCMonth() + 1;
        var iso3;
        if (mn3 === cm) iso3 = todayISO;               // "in July" during July = now
        else if (mn3 > cm) iso3 = toISO(cy, mn3, 1);   // later this year
        else iso3 = toISO(cy + 1, mn3, 1);             // already past -> next year
        return { iso: iso3, label: MON_ABBR[mn3 - 1], matched: m[0] };
      }
    }
    return null;
  }

  // pick the nearest future year for a bare day+month (roll to next year if past)
  function pickYear(todayISO, mo, dd) {
    var d = parseISO(todayISO); if (!d) return 2000;
    var cy = d.getUTCFullYear();
    var cand = toISO(cy, mo, dd);
    var cd = parseISO(cand);
    if (cd && cd.getTime() >= d.getTime()) return cy;
    return cy + 1;
  }

  // ---- duration + party size ----------------------------------------------
  // read from the date-stripped text so "in 5 days" (a date) can't be miscounted.
  function parseNights(rest, nightsHint) {
    var t = rest.toLowerCase(), m;
    // explicit nights win
    if ((m = /\b(\d+)\s*nights?\b/.exec(t))) { var n = +m[1]; if (n > 0) return { nights: n, label: n + (n === 1 ? " night" : " nights") }; }
    // days -> nights = days - 1 (a 5-day trip = 4 nights), min 1
    if ((m = /\b(\d+)\s*days?\b/.exec(t))) {
      var dcount = +m[1];
      if (dcount >= 1) { var nn = Math.max(1, dcount - 1); return { nights: nn, label: dcount + (dcount === 1 ? " day" : " days") }; }
    }
    // weeks (word or number)
    if ((m = /\b(a|an|one|two|three|four|\d+)\s*weeks?\b/.exec(t))) {
      var w = NUMWORDS[m[1]] != null ? NUMWORDS[m[1]] : +m[1];
      if (w > 0) { var wn = w * 7 - 1; return { nights: wn, label: (w * 7) + " days" }; }
    }
    // fell back to a weekend hint from the date phrase
    if (nightsHint) return { nights: nightsHint, label: nightsHint + " nights" };
    return { nights: null, label: null };
  }

  function parseParty(rest) {
    var t = rest.toLowerCase(), m;
    if (/\b(solo|just me|by myself|myself|alone|on my own)\b/.test(t)) return { adults: 1, label: "solo" };
    if (/\b(couple|two of us|both of us|me and my (?:wife|husband|partner|gf|bf|girlfriend|boyfriend|spouse))\b/.test(t)) return { adults: 2, label: "2 travellers" };
    if ((m = /\bfamily of\s+(\d+)\b/.exec(t))) { var f = +m[1]; if (f > 0) return { adults: f, label: f + " travellers" }; }
    if ((m = /\b(\d+)\s*(?:people|adults|pax|travell?ers|persons?|guests|of us|folks|pple)\b/.exec(t))) { var p = +m[1]; if (p > 0) return { adults: p, label: p + " travellers" }; }
    // "for 3" = party size, but NOT "for 5 days / nights / weeks / months" (that's duration)
    if ((m = /\bfor\s+(\d+)\b(?!\s*(?:nights?|days?|weeks?|months?))/.exec(t))) { var q = +m[1]; if (q > 0 && q < 30) return { adults: q, label: q + " travellers" }; }
    return { adults: null, label: null };
  }

  // ---- main entry ----------------------------------------------------------
  function parseTrip(text, opts) {
    opts = opts || {};
    var todayISO = opts.todayISO || null;
    var names = buildNames(opts.cities || []);
    var raw = String(text || "");

    var places = pickPlaces(findCities(raw, names));

    var dateHit = todayISO ? parseDate(raw, todayISO) : null;
    // strip the matched date span so it can't be re-read as a duration
    var rest = raw;
    if (dateHit && dateHit.matched) {
      var idx = raw.toLowerCase().indexOf(dateHit.matched.toLowerCase());
      if (idx !== -1) rest = raw.slice(0, idx) + " " + raw.slice(idx + dateHit.matched.length);
    }
    var dur = parseNights(rest, dateHit && dateHit.nightsHint);
    var party = parseParty(rest);

    var understood = [];
    if (places.to) understood.push({ key: "to", icon: "📍", label: places.to.city });
    if (places.from) understood.push({ key: "from", icon: "🛫", label: "from " + places.from.city });
    if (dur.nights != null) understood.push({ key: "nights", icon: "🌙", label: dur.label });
    if (dateHit) understood.push({ key: "depart", icon: "📅", label: dateHit.label });
    if (party.adults != null) understood.push({ key: "adults", icon: "👤", label: party.label });

    var missing = [];
    if (!places.to) missing.push("destination");

    return {
      raw: raw,
      to: places.to,
      from: places.from,
      nights: dur.nights,
      adults: party.adults,
      depart: dateHit ? dateHit.iso : null,
      understood: understood,
      missing: missing,
      ready: !!places.to,
    };
  }

  // fill only what a trip physically needs, flagging every default so nothing hides.
  function resolve(parsed, opts) {
    opts = opts || {};
    var todayISO = opts.todayISO || null;
    parsed = parsed || {};
    var assumed = [];
    var nights = parsed.nights;
    if (nights == null) { nights = 3; assumed.push({ key: "nights", label: "3 nights", note: "default" }); }
    var depart = parsed.depart;
    if (!depart && todayISO) {
      depart = nextDow(todayISO, 6, false); // next Saturday as a friendly "soon"
      assumed.push({ key: "depart", label: fmtLong(depart), note: "assumed" });
    }
    return {
      to: parsed.to || null,
      from: parsed.from || null,
      nights: nights,
      adults: parsed.adults || null,
      depart: depart || null,
      assumed: assumed,
    };
  }

  var Engine = {
    parseTrip: parseTrip,
    resolve: resolve,
    // exposed for tests + reuse
    parseDate: parseDate,
    fmtShort: fmtShort,
    fmtLong: fmtLong,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = Engine;
  root.LL_NLP = Engine;
})(typeof window !== "undefined" ? window : globalThis);
