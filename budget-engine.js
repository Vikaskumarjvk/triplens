/*
 * TripLens — budget engine. Pure logic for a per-trip budget + logged spends.
 * No DOM. Node-testable (tests-budget.js).
 *
 * HONESTY MODEL (the core rule): EVERY number here is the USER'S own input.
 * The engine NEVER invents a price, estimate, or "typical cost". It only does
 * arithmetic on numbers the user typed (their budget, their logged spends).
 * That's the honest line — we organize the user's money, we don't guess it.
 *
 * A budget lives on a trip:
 *   trip.budget = {
 *     total: <number|null>,        // optional overall cap the user set
 *     currency: "INR",
 *     byCat: { flights: n, stay: n, ... },   // optional per-category caps
 *     spends: [ { id, cat, label, amount, day, ts } ]   // logged actuals
 *   }
 * Categories mirror the trip verticals so rollups line up with the planner.
 */
(function (root) {
  "use strict";

  const CATEGORIES = [
    { id: "flights", label: "Flights", icon: "✈️" },
    { id: "stay", label: "Stay", icon: "🏨" },
    { id: "food", label: "Food", icon: "🍽️" },
    { id: "local", label: "Local transport", icon: "🚕" },
    { id: "activities", label: "Activities", icon: "🎟️" },
    { id: "shopping", label: "Shopping", icon: "🛍️" },
    { id: "other", label: "Other", icon: "•" },
  ];
  const CAT_IDS = CATEGORIES.map((c) => c.id);

  // common currencies for the picker (symbol used for display only)
  const CURRENCIES = {
    INR: "₹", USD: "$", EUR: "€", GBP: "£", AED: "د.إ", SGD: "S$", THB: "฿", MYR: "RM", JPY: "¥", LKR: "Rs",
  };
  function symbol(cur) { return CURRENCIES[cur] || ""; }

  function blankBudget(currency) {
    return { total: null, currency: currency || "INR", byCat: {}, spends: [] };
  }
  function ensure(trip) {
    if (!trip.budget) trip.budget = blankBudget();
    if (!trip.budget.byCat) trip.budget.byCat = {};
    if (!trip.budget.spends) trip.budget.spends = [];
    if (!trip.budget.currency) trip.budget.currency = "INR";
    return trip.budget;
  }

  // round to 2dp safely (avoid float noise) — still the user's number, just clean
  function round2(n) { return Math.round((Number(n) || 0) * 100) / 100; }

  // ---- set caps -----------------------------------------------------------
  function setTotal(trip, amount) {
    const b = ensure(trip);
    const n = amount === "" || amount == null ? null : round2(amount);
    b.total = (n != null && n >= 0) ? n : null;
    return b.total;
  }
  function setCatCap(trip, cat, amount) {
    const b = ensure(trip);
    if (!CAT_IDS.includes(cat)) return null;
    const n = amount === "" || amount == null ? null : round2(amount);
    if (n == null || n < 0) delete b.byCat[cat];
    else b.byCat[cat] = n;
    return b.byCat[cat] == null ? null : b.byCat[cat];
  }
  function setCurrency(trip, cur) { const b = ensure(trip); b.currency = CURRENCIES[cur] ? cur : "INR"; return b.currency; }

  // ---- log spends ---------------------------------------------------------
  // spend = { cat, label, amount, day }  (day = day index, optional)
  function addSpend(trip, spend, seed) {
    const b = ensure(trip);
    const amount = round2(spend && spend.amount);
    if (!(amount > 0)) return null; // honest: no zero/negative phantom spends
    const cat = CAT_IDS.includes(spend && spend.cat) ? spend.cat : "other";
    const s = {
      id: (spend && spend.id) || ("sp-" + (seed || (b.spends.length + 1))),
      cat, label: (spend && spend.label) || "",
      amount, day: (spend && spend.day != null) ? spend.day : null,
      ts: (spend && spend.ts) || 0,
    };
    b.spends.push(s);
    return s;
  }
  function removeSpend(trip, id) {
    const b = ensure(trip);
    const before = b.spends.length;
    b.spends = b.spends.filter((s) => s.id !== id);
    return b.spends.length < before;
  }

  // ---- rollups ------------------------------------------------------------
  function spentByCat(trip) {
    const b = ensure(trip);
    const out = {};
    CAT_IDS.forEach((c) => (out[c] = 0));
    b.spends.forEach((s) => { out[s.cat] = round2((out[s.cat] || 0) + s.amount); });
    return out;
  }
  function totalSpent(trip) {
    const b = ensure(trip);
    return round2(b.spends.reduce((n, s) => n + s.amount, 0));
  }
  function spentByDay(trip) {
    const b = ensure(trip);
    const out = {};
    b.spends.forEach((s) => { const k = s.day == null ? "unscheduled" : s.day; out[k] = round2((out[k] || 0) + s.amount); });
    return out;
  }

  // a full summary the UI renders: per-category spent vs cap, overall vs total.
  function summary(trip) {
    const b = ensure(trip);
    const byCat = spentByCat(trip);
    const spent = totalSpent(trip);
    const cats = CATEGORIES.map((c) => {
      const cap = b.byCat[c.id] != null ? b.byCat[c.id] : null;
      const used = byCat[c.id] || 0;
      return {
        id: c.id, label: c.label, icon: c.icon, cap, used,
        remaining: cap != null ? round2(cap - used) : null,
        over: cap != null && used > cap,
        pct: cap != null && cap > 0 ? Math.min(100, Math.round((used / cap) * 100)) : null,
      };
    });
    const total = b.total;
    return {
      currency: b.currency, symbol: symbol(b.currency),
      total, spent,
      remaining: total != null ? round2(total - spent) : null,
      over: total != null && spent > total,
      pct: total != null && total > 0 ? Math.min(100, Math.round((spent / total) * 100)) : null,
      cats,
      perPerson: (trip.adults && trip.adults > 0) ? round2(spent / trip.adults) : spent,
      spendCount: b.spends.length,
    };
  }

  // format a number with the trip's currency symbol + grouping (display helper)
  function fmt(amount, currency) {
    const s = symbol(currency);
    const n = Number(amount) || 0;
    // Indian grouping for INR, western otherwise
    const grouped = currency === "INR"
      ? n.toLocaleString("en-IN")
      : n.toLocaleString("en-US");
    return s + grouped;
  }

  const Engine = {
    CATEGORIES, CAT_IDS, CURRENCIES, symbol,
    blankBudget, ensure, round2,
    setTotal, setCatCap, setCurrency,
    addSpend, removeSpend,
    spentByCat, totalSpent, spentByDay, summary, fmt,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = Engine;
  root.LL_BUDGET = Engine;
})(typeof window !== "undefined" ? window : globalThis);
