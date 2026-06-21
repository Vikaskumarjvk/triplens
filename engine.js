/*
 * LoungeLens engine — the brain.
 *
 * Pure functions over (cards dataset, lounges dataset, user wallet, visit log).
 * No DOM here. Testable in isolation (see tests.js / "node engine.js --selftest").
 */
(function (root) {
  "use strict";

  // ---- period math -------------------------------------------------------
  // We bucket visits into the card's reset period so the quota counter is honest.
  function periodKey(period, date) {
    const d = date ? new Date(date) : new Date();
    const y = d.getFullYear();
    if (period === "year") return `${y}`;
    if (period === "month") return `${y}-M${d.getMonth() + 1}`;
    // default quarter
    const q = Math.floor(d.getMonth() / 3) + 1;
    return `${y}-Q${q}`;
  }

  // ---- quota: how many visits a card still has this period ---------------
  // visitLog: [{ cardId, loungeId, ts }]
  function remainingVisits(card, visitLog, now) {
    if (card.domesticVisits === "unlimited") {
      return { allowance: Infinity, used: 0, left: Infinity, unlimited: true };
    }
    const allowance = Number(card.domesticVisits) || 0;
    const key = periodKey(card.period, now);
    const used = (visitLog || []).filter(
      (v) => v.cardId === card.id && periodKey(card.period, v.ts) === key
    ).length;
    return { allowance, used, left: Math.max(0, allowance - used), unlimited: false, periodKey: key };
  }

  // ---- spend-gate: is this card's allowance actually active? -------------
  // spendThisPeriod: map cardId -> rupees spent in current gating period.
  // Returns { gated, met, needed, shortfall }.
  function spendStatus(card, spendThisPeriod) {
    if (!card.spendGate) return { gated: false, met: true };
    const spent = (spendThisPeriod && spendThisPeriod[card.id]) || 0;
    const needed = card.spendGate.amount;
    return {
      gated: true,
      met: spent >= needed,
      needed,
      spent,
      shortfall: Math.max(0, needed - spent),
      note: card.spendGate.note,
    };
  }

  // ---- lounge access: which of MY cards opens THIS lounge ----------------
  // Returns the cards that share at least one program rail with the lounge,
  // annotated with quota + spend status. This is the "which card avails" answer.
  function cardsForLounge(lounge, wallet, allCards, visitLog, spendThisPeriod, now) {
    const owned = wallet
      .map((id) => allCards.find((c) => c.id === id))
      .filter(Boolean);

    const matches = owned
      .map((card) => {
        const sharedRails = (card.programs || []).filter((p) =>
          (lounge.programs || []).includes(p)
        );
        if (sharedRails.length === 0) return null;
        const quota = remainingVisits(card, visitLog, now);
        const spend = spendStatus(card, spendThisPeriod);
        // usable = has visits left AND (not gated OR gate met)
        const usable = (quota.unlimited || quota.left > 0) && spend.met;
        return { card, sharedRails, quota, spend, usable };
      })
      .filter(Boolean);

    // best card first: usable before blocked, then most visits left
    matches.sort((a, b) => {
      if (a.usable !== b.usable) return a.usable ? -1 : 1;
      const al = a.quota.unlimited ? Infinity : a.quota.left;
      const bl = b.quota.unlimited ? Infinity : b.quota.left;
      return bl - al;
    });
    return matches;
  }

  // ---- wallet rollup: total visits left across whole wallet --------------
  function walletSummary(wallet, allCards, visitLog, spendThisPeriod, now) {
    const owned = wallet.map((id) => allCards.find((c) => c.id === id)).filter(Boolean);
    let totalLeft = 0, hasUnlimited = false, gatedBlocked = 0, gatedAtRisk = [];
    const perCard = owned.map((card) => {
      const quota = remainingVisits(card, visitLog, now);
      const spend = spendStatus(card, spendThisPeriod);
      if (quota.unlimited) hasUnlimited = true;
      else if (spend.met) totalLeft += quota.left;
      if (spend.gated && !spend.met) {
        gatedBlocked++;
        gatedAtRisk.push({ card, spend });
      }
      return { card, quota, spend };
    });
    return { perCard, totalLeft, hasUnlimited, gatedBlocked, gatedAtRisk, cardCount: owned.length };
  }

  // ---- coverage: of all lounges, how many can my wallet open right now ----
  function coverage(wallet, allCards, allLounges, visitLog, spendThisPeriod, now, filter) {
    const list = allLounges
      .filter((l) => !filter || !filter.type || l.type === filter.type)
      .map((lounge) => {
        const matches = cardsForLounge(lounge, wallet, allCards, visitLog, spendThisPeriod, now);
        const open = matches.some((m) => m.usable);
        const blockedOnly = matches.length > 0 && !open;
        return { lounge, matches, open, blockedOnly };
      });
    const openCount = list.filter((x) => x.open).length;
    return { list, openCount, total: list.length };
  }

  // ---- recommender: which card should I get next? -----------------------
  // Scores cards NOT in wallet by marginal new lounge coverage + ease + ltf.
  // This answers "which cards are easy to get / which I might get immediately".
  function recommend(wallet, allCards, allLounges, opts) {
    opts = opts || {};
    const ownedSet = new Set(wallet);
    const ownedCards = wallet.map((id) => allCards.find((c) => c.id === id)).filter(Boolean);

    // which lounges does the current wallet already open (by program, ignoring quota)?
    const railsOwned = new Set();
    ownedCards.forEach((c) => (c.programs || []).forEach((p) => railsOwned.add(p)));
    const alreadyOpenLoungeIds = new Set(
      allLounges
        .filter((l) => (l.programs || []).some((p) => railsOwned.has(p)))
        .map((l) => l.id)
    );

    const candidates = allCards.filter((c) => !ownedSet.has(c.id) && (c.programs || []).length > 0);

    const scored = candidates.map((card) => {
      const newRails = new Set(card.programs);
      const newlyOpened = allLounges.filter(
        (l) =>
          !alreadyOpenLoungeIds.has(l.id) &&
          (l.programs || []).some((p) => newRails.has(p)) &&
          (!opts.type || l.type === opts.type)
      );
      const marginalCoverage = newlyOpened.length;
      const visitScore =
        card.domesticVisits === "unlimited" ? 12 : Number(card.domesticVisits) || 0;
      // weighting: marginal new lounges matter most, then ease (easy to GET),
      // then raw visit volume, with LTF / no-spend-gate bonuses.
      let score =
        marginalCoverage * 3 +
        card.ease * 2 +
        Math.min(visitScore, 12) +
        (card.ltf ? 4 : 0) +
        (card.railway ? 2 : 0) +
        (card.spendGate ? -3 : 0);
      if (opts.easyOnly && card.ease < 4) score = -1; // filter for "get immediately"
      return { card, score, marginalCoverage, newlyOpened, visitScore };
    });

    return scored
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score);
  }

  // ---- cities: distinct list for the trip planner dropdowns --------------
  function cities(allLounges, type) {
    const seen = new Map();
    allLounges
      .filter((l) => !type || l.type === type)
      .forEach((l) => {
        if (!seen.has(l.city)) seen.set(l.city, { city: l.city, airport: 0, railway: 0 });
        const e = seen.get(l.city);
        if (l.type === "railway") e.railway++; else e.airport++;
      });
    return Array.from(seen.values()).sort((a, b) => a.city.localeCompare(b.city));
  }

  // ---- planTrip: the heart of the product --------------------------------
  // legs = ["Hyderabad", "Delhi", ...] (cities the user passes through).
  // For each leg, finds lounges in that city, the best usable card per lounge,
  // and whether the leg is COVERED (any lounge enterable), BLOCKED (card present
  // but gated/empty), or a GAP (no card opens anything there).
  function planTrip(legs, wallet, allCards, allLounges, visitLog, spendThisPeriod, now, type) {
    const plan = legs.map((cityRaw) => {
      const city = (cityRaw || "").trim();
      const cityLounges = allLounges.filter(
        (l) => l.city.toLowerCase() === city.toLowerCase() && (!type || l.type === type)
      );
      const loungeRows = cityLounges.map((lounge) => {
        const matches = cardsForLounge(lounge, wallet, allCards, visitLog, spendThisPeriod, now);
        const best = matches.find((m) => m.usable) || matches[0] || null;
        return { lounge, matches, best, open: matches.some((m) => m.usable) };
      });
      const anyOpen = loungeRows.some((r) => r.open);
      const anyMatchButBlocked = !anyOpen && loungeRows.some((r) => r.matches.length > 0);
      let status = "gap";
      if (anyOpen) status = "covered";
      else if (anyMatchButBlocked) status = "blocked";
      else if (cityLounges.length === 0) status = "no-lounge"; // we have no lounge data for this city
      return { city, loungeRows, status, loungeCount: cityLounges.length };
    });
    const covered = plan.filter((p) => p.status === "covered").length;
    const gaps = plan.filter((p) => p.status === "gap" || p.status === "blocked");
    return { plan, covered, total: plan.length, gaps };
  }

  // ---- recommendForTrip: which card best fixes THIS trip's gaps ----------
  // Like recommend(), but marginal coverage is measured only against the
  // lounges in the trip's gap cities — so the suggestion is trip-relevant.
  function recommendForTrip(legs, wallet, allCards, allLounges, opts) {
    opts = opts || {};
    const gapCities = new Set((legs || []).map((c) => (c || "").trim().toLowerCase()));
    const gapLounges = allLounges.filter(
      (l) => gapCities.has(l.city.toLowerCase()) && (!opts.type || l.type === opts.type)
    );
    const base = recommend(wallet, allCards, gapLounges, opts);
    // re-score using ONLY trip lounges for marginalCoverage (recommend already
    // did this because we passed gapLounges as the universe).
    return base;
  }

  const Engine = {
    periodKey,
    remainingVisits,
    spendStatus,
    cardsForLounge,
    walletSummary,
    coverage,
    recommend,
    cities,
    planTrip,
    recommendForTrip,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = Engine;
  root.LL_ENGINE = Engine;
})(typeof window !== "undefined" ? window : globalThis);
