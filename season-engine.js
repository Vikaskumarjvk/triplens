/*
 * TripLens — season engine. Pure, no DOM, no clock.
 *
 * Answers the layman question "is the time I picked a good time to go there?"
 * for the destinations we curate. Pairs with the edit-dates feature: change
 * your dates, get an honest read on whether that timing makes sense.
 *
 * HONESTY MODEL — this is the strict part:
 *  - We only encode climate windows that are UNAMBIGUOUS common knowledge for
 *    these specific cities (the monsoon / peak-heat / winter-cold windows you
 *    find in any guidebook or Wikipedia climate table). No subjective "best
 *    time" ranking we'd be inventing.
 *  - Everything is QUALITATIVE ("monsoon season, expect a lot of rain"). We do
 *    NOT assert temperatures here — the live forecast already gives real numbers
 *    when the trip is within 2 weeks. Season = rough seasonal context only.
 *  - Every assessment is paired with a real "check the season" search link so
 *    the user can verify. We frame it as a rough guide, never a rule.
 *  - Destinations we're not confident about return { known:false } and the UI
 *    shows only the verify link — we assert nothing.
 *
 * Months are 1-12.
 */
(function (root) {
  "use strict";

  var MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  // plain-language phrase per climate flag. Qualitative only, no numbers.
  var PHRASE = {
    monsoon: "monsoon season, so expect a lot of rain",
    heat: "usually very hot",
    cold: "cold, and it can snow",
    wet: "the wettest part of the year",
    grey: "cold, grey and dark early",
  };

  // Conservative, common-knowledge climate windows per IATA code. Each window:
  // { type, months:[...] }. Only the well-known flags — when unsure, we leave it
  // out (the UI then just links to verify). `positive` is an optional honest
  // common-knowledge note for places famous for easy weather.
  var DATA = {
    // West-coast + Konkan monsoon (Jun-Sep)
    GOI: { windows: [{ type: "monsoon", months: [6, 7, 8, 9] }] },
    GOX: { windows: [{ type: "monsoon", months: [6, 7, 8, 9] }] },
    BOM: { windows: [{ type: "monsoon", months: [6, 7, 8, 9] }] },
    PNQ: { windows: [{ type: "monsoon", months: [6, 7, 8, 9] }] },
    // Kerala monsoon (Jun-Sep)
    COK: { windows: [{ type: "monsoon", months: [6, 7, 8, 9] }] },
    TRV: { windows: [{ type: "monsoon", months: [6, 7, 8, 9] }] },
    // Chennai: hot Apr-Jun, north-east monsoon Oct-Dec
    MAA: { windows: [{ type: "heat", months: [4, 5, 6] }, { type: "monsoon", months: [10, 11, 12] }] },
    // North-Indian plains: peak heat Apr-Jun
    DEL: { windows: [{ type: "heat", months: [4, 5, 6] }] },
    JAI: { windows: [{ type: "heat", months: [4, 5, 6] }] },
    VNS: { windows: [{ type: "heat", months: [4, 5, 6] }] },
    ATQ: { windows: [{ type: "heat", months: [5, 6] }] },
    AMD: { windows: [{ type: "heat", months: [4, 5, 6] }] },
    CCU: { windows: [{ type: "heat", months: [4, 5] }, { type: "monsoon", months: [6, 7, 8, 9] }] },
    HYD: { windows: [{ type: "heat", months: [4, 5] }] },
    DED: { windows: [{ type: "monsoon", months: [7, 8] }] },
    // NE India / Andamans heavy monsoon
    IXB: { windows: [{ type: "monsoon", months: [6, 7, 8, 9] }] },
    IXZ: { windows: [{ type: "monsoon", months: [5, 6, 7, 8, 9] }] },
    // Himalaya: cold winter is the flag, summer is the draw
    SXR: { windows: [{ type: "cold", months: [12, 1, 2] }] },
    // Pleasant most of the year — a confident positive, no caution window
    BLR: { windows: [], positive: "mild and pleasant most of the year" },
    // Gulf: extreme summer heat
    DXB: { windows: [{ type: "heat", months: [6, 7, 8, 9] }] },
    // SE Asia
    SIN: { windows: [{ type: "wet", months: [11, 12, 1] }] },
    BKK: { windows: [{ type: "heat", months: [3, 4] }, { type: "monsoon", months: [6, 7, 8, 9, 10] }] },
    // Temperate
    LHR: { windows: [{ type: "grey", months: [11, 12, 1, 2] }] },
    JFK: { windows: [{ type: "cold", months: [12, 1, 2] }, { type: "heat", months: [7, 8] }] },
    // North + central Indian plains: hot Apr-Jun, then monsoon Jun/Jul-Sep
    LKO: { windows: [{ type: "heat", months: [4, 5, 6] }, { type: "monsoon", months: [7, 8, 9] }] },
    PAT: { windows: [{ type: "heat", months: [4, 5, 6] }, { type: "monsoon", months: [7, 8, 9] }] },
    IXC: { windows: [{ type: "heat", months: [5, 6] }, { type: "monsoon", months: [7, 8] }] },
    NAG: { windows: [{ type: "heat", months: [4, 5, 6] }] },
    RPR: { windows: [{ type: "heat", months: [4, 5, 6] }] },
    IDR: { windows: [{ type: "monsoon", months: [7, 8, 9] }] },
    BHO: { windows: [{ type: "monsoon", months: [7, 8, 9] }] },
    JLR: { windows: [{ type: "heat", months: [4, 5] }, { type: "monsoon", months: [7, 8] }] },
    // Gujarat: hot pre-monsoon
    STV: { windows: [{ type: "heat", months: [4, 5] }, { type: "monsoon", months: [6, 7, 8, 9] }] },
    BDQ: { windows: [{ type: "heat", months: [4, 5, 6] }] },
    // East + NE India: strong monsoon
    GAU: { windows: [{ type: "monsoon", months: [6, 7, 8, 9] }] },
    IXR: { windows: [{ type: "monsoon", months: [6, 7, 8, 9] }] },
    // East coast: hot summer + retreating monsoon later
    BBI: { windows: [{ type: "heat", months: [4, 5] }, { type: "monsoon", months: [6, 7, 8, 9] }] },
    VTZ: { windows: [{ type: "heat", months: [4, 5] }] },
    RJA: { windows: [{ type: "heat", months: [4, 5] }] },
    // South: hot Apr-Jun
    CCJ: { windows: [{ type: "monsoon", months: [6, 7, 8, 9] }] },
    IXM: { windows: [{ type: "heat", months: [4, 5, 6] }] },
    TIR: { windows: [{ type: "heat", months: [4, 5] }] },
  };

  // compress a sorted unique month list into label ranges, handling Dec->Jan wrap.
  // [10,11,12,1,2,3,4,5] -> "Oct-May";  [1,2,3,7,8,9] -> "Jan-Mar, Jul-Sep"
  function monthRanges(months) {
    var set = {}; months.forEach(function (m) { set[m] = true; });
    var present = []; for (var m = 1; m <= 12; m++) if (set[m]) present.push(m);
    if (!present.length) return "";
    // build contiguous runs in 1..12
    var runs = [], start = present[0], prev = present[0];
    for (var i = 1; i < present.length; i++) {
      if (present[i] === prev + 1) { prev = present[i]; continue; }
      runs.push([start, prev]); start = present[i]; prev = present[i];
    }
    runs.push([start, prev]);
    // wrap: if a run ends at 12 and another starts at 1, merge them
    if (runs.length > 1 && runs[0][0] === 1 && runs[runs.length - 1][1] === 12) {
      var first = runs.shift(); var last = runs.pop();
      runs.push([last[0], first[1]]); // e.g. [10,12] + [1,5] -> [10,5]
    }
    return runs.map(function (r) {
      return r[0] === r[1] ? MON[r[0] - 1] : MON[r[0] - 1] + "-" + MON[r[1] - 1];
    }).join(", ");
  }

  function cautionMonths(entry) {
    var s = {};
    (entry.windows || []).forEach(function (w) { (w.months || []).forEach(function (mm) { s[mm] = true; }); });
    return s;
  }
  function clearMonths(entry) {
    var c = cautionMonths(entry), out = [];
    for (var m = 1; m <= 12; m++) if (!c[m]) out.push(m);
    return out;
  }
  function verifyLink(city, code) {
    return "https://www.google.com/search?q=" + encodeURIComponent("best time to visit " + (city || code || ""));
  }

  // assess a specific chosen month for a destination.
  // returns { known, caution|null, clearLabel, positive, verifyLink }
  //   caution = { type, message } when the chosen month hits a known flag.
  function assess(code, month, city) {
    var entry = DATA[String(code || "").toUpperCase()];
    var link = verifyLink(city, code);
    if (!entry) return { known: false, caution: null, clearLabel: "", positive: null, verifyLink: link };
    var hit = null;
    (entry.windows || []).forEach(function (w) { if (!hit && (w.months || []).indexOf(month) !== -1) hit = w; });
    var caution = null;
    if (hit) {
      var nm = (month >= 1 && month <= 12) ? MON[month - 1] : "that month";
      caution = { type: hit.type, message: nm + " is " + PHRASE[hit.type] + " in " + (city || code) + "." };
    }
    return {
      known: true, caution: caution,
      clearLabel: monthRanges(clearMonths(entry)),
      positive: entry.positive || null,
      verifyLink: link,
    };
  }

  // month-agnostic summary for the destination snapshot.
  // returns { known, line, verifyLink } — `line` is a short honest hint or null.
  function summary(code, city) {
    var entry = DATA[String(code || "").toUpperCase()];
    var link = verifyLink(city, code);
    if (!entry) return { known: false, line: null, verifyLink: link };
    if (entry.positive) return { known: true, line: entry.positive, verifyLink: link };
    var clear = monthRanges(clearMonths(entry));
    return { known: true, line: clear ? ("usually easier weather around " + clear) : null, verifyLink: link };
  }

  var Engine = { assess: assess, summary: summary, monthRanges: monthRanges, MON: MON };
  if (typeof module !== "undefined" && module.exports) module.exports = Engine;
  root.LL_SEASON = Engine;
})(typeof window !== "undefined" ? window : globalThis);
