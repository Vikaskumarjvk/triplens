/*
 * TripLens — Trip Cost Optimizer engine. The brain of the trip planner.
 *
 * Pure functions over the existing datasets (LL_FLIGHTS, LL_HOTELS, LL_DEALS,
 * LL_LOUNGES, LL_CARDS) + the user's wallet. NO DOM. Node-testable (tests-trip.js).
 *
 * WHAT IT DOES
 *  Given a trip {from, to, depart, return?, nights?, adults?} and the user's wallet:
 *   - assembles every leg of the journey into one plan
 *   - flights:  best booking sites (meta-first) + which of YOUR cards has an offer
 *   - stay:     best hotel sites for the destination + which card pays best
 *   - lounges:  which lounges your wallet opens at origin + destination airports
 *   - on-trip:  cab / eSIM / dining / activity deep links for the destination
 *   - bestCard: across the whole trip, the single card that wins the most offers
 *   - savings:  a transparent CHECKLIST of real levers (not a fabricated number)
 *
 * HONESTY MODEL (hard rule, same as every data file):
 *   This engine NEVER invents a price or a total. It computes structure, deep
 *   links, and which card+offer applies where. The real numbers live on the real
 *   booking sites the deep links open. Any rupee figure here is a user INPUT
 *   (e.g. "a lounge visit is worth ₹1200 to me"), never a scraped/guessed fare.
 */
(function (root) {
  "use strict";

  // --- pull sibling engines if present (graceful in Node tests) -----------
  function flightEngine() { return root.LL_FLIGHT_ENGINE || (typeof require !== "undefined" ? safeReq("./flight-engine.js") : null); }
  function loungeEngine() { return root.LL_ENGINE || (typeof require !== "undefined" ? safeReq("./engine.js") : null); }
  function safeReq(p) { try { return require(p); } catch (e) { return null; } }

  // --- date helpers -------------------------------------------------------
  function pad2(n) { return n < 10 ? "0" + n : "" + n; }
  function parseISO(s) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || "");
    return m ? { y: +m[1], mo: +m[2], d: +m[3], iso: s } : null;
  }
  function addDays(iso, days) {
    const p = parseISO(iso); if (!p) return null;
    const dt = new Date(Date.UTC(p.y, p.mo - 1, p.d));
    dt.setUTCDate(dt.getUTCDate() + days);
    return dt.getUTCFullYear() + "-" + pad2(dt.getUTCMonth() + 1) + "-" + pad2(dt.getUTCDate());
  }
  function nightsBetween(checkin, checkout) {
    const a = parseISO(checkin), b = parseISO(checkout);
    if (!a || !b) return null;
    const ms = Date.UTC(b.y, b.mo - 1, b.d) - Date.UTC(a.y, a.mo - 1, a.d);
    const n = Math.round(ms / 86400000);
    return n > 0 ? n : null;
  }
  function ddmmyyyy(iso) { const p = parseISO(iso); return p ? pad2(p.d) + "/" + pad2(p.mo) + "/" + p.y : ""; }

  // --- stay deep-link builder (mirrors flight-engine.buildLink) -----------
  function buildStayLink(provider, city, checkin, checkout, adults) {
    let url = provider.url;
    const needsDate = /\{CHECKIN/.test(url) || /\{CHECKOUT/.test(url);
    const haveDates = parseISO(checkin) && parseISO(checkout);
    if (needsDate && !haveDates) return provider.fallbackUrl || stripToOrigin(url);
    const C = city || "", CL = (city || "").toLowerCase();
    url = url
      .replace(/\{CITY_L\}/g, encodeURIComponent(CL))
      .replace(/\{CITY\}/g, encodeURIComponent(C))
      .replace(/\{ADULTS\}/g, String(adults || 2));
    if (haveDates) {
      url = url
        .replace(/\{CHECKIN_DDMMYYYY\}/g, encodeURIComponent(ddmmyyyy(checkin)))
        .replace(/\{CHECKOUT_DDMMYYYY\}/g, encodeURIComponent(ddmmyyyy(checkout)))
        .replace(/\{CHECKIN\}/g, checkin)
        .replace(/\{CHECKOUT\}/g, checkout);
    }
    return url;
  }
  function buildDealLink(service, city) {
    let url = service.url;
    // a template that searches by city (e.g. "?q={CITY}") is useless with no
    // city — it would open an empty search. Fall back to the working site root.
    const needsCity = /\{CITY/.test(url);
    if (needsCity && !(city && city.trim())) return service.fallbackUrl || stripToOrigin(url);
    const C = city || "", CL = (city || "").toLowerCase();
    return url
      .replace(/\{CITY_L\}/g, encodeURIComponent(CL))
      .replace(/\{CITY\}/g, encodeURIComponent(C));
  }
  function stripToOrigin(url) { try { const u = new URL(url); return u.origin + "/"; } catch (e) { return url; } }

  // --- ordering (meta first, then by confidence) --------------------------
  const TYPE_ORDER = { meta: 0, chain: 1, ota: 2, airline: 1, app: 2, site: 1 };
  const CONF_RANK = { high: 3, med: 2, low: 1 };
  function rankProviders(list) {
    return (list || []).slice().sort((a, b) =>
      ((TYPE_ORDER[a.type] ?? 9) - (TYPE_ORDER[b.type] ?? 9)) ||
      ((CONF_RANK[b.confidence] || 0) - (CONF_RANK[a.confidence] || 0)) ||
      a.name.localeCompare(b.name));
  }

  // --- wallet helpers -----------------------------------------------------
  function walletCards(wallet, allCards) {
    return (wallet || []).map((id) => (allCards || []).find((c) => c.id === id)).filter(Boolean);
  }
  // which wallet cards have a matching-issuer offer on this provider/service?
  function offersForWallet(node, wCards) {
    const out = [];
    (node.offers || []).forEach((o) => {
      if (o.kind === "card" && o.issuer) {
        const matched = wCards.filter((c) => c.issuer === o.issuer);
        if (matched.length) out.push({ offer: o, matchedCards: matched, inWallet: true });
        else out.push({ offer: o, matchedCards: [], inWallet: false });
      } else {
        out.push({ offer: o, matchedCards: [], inWallet: false }); // app/coupon = everyone
      }
    });
    return out;
  }

  // --- city <-> airport code resolution -----------------------------------
  // Accepts a city name OR an IATA code; returns {code, city} using LL_FLIGHTS.
  function resolvePlace(input, flights) {
    const q = (input || "").trim();
    if (!q) return null;
    const up = q.toUpperCase();
    const airports = (flights && flights.airports) || [];
    let hit = airports.find((a) => a.code === up);
    if (hit) return { code: hit.code, city: hit.city };
    hit = airports.find((a) => a.city.toLowerCase() === q.toLowerCase());
    if (hit) return { code: hit.code, city: hit.city };
    // partial city match
    hit = airports.find((a) => a.city.toLowerCase().includes(q.toLowerCase()));
    if (hit) return { code: hit.code, city: hit.city };
    return { code: up.length === 3 ? up : null, city: q }; // unknown: keep raw
  }

  // --- lounge coverage at a place (uses lounge engine if wallet present) ---
  function loungesAtCity(city, wallet, allCards, allLounges, visitLog, spend, now) {
    const LE = loungeEngine();
    const cityLounges = (allLounges || []).filter(
      (l) => l.city && city && l.city.toLowerCase() === city.toLowerCase() && l.type !== "railway"
    );
    if (!LE || !wallet || !wallet.length) {
      return { lounges: cityLounges.map((l) => ({ lounge: l, matches: [], open: false })), openCount: 0, total: cityLounges.length };
    }
    const rows = cityLounges.map((lounge) => {
      const matches = LE.cardsForLounge(lounge, wallet, allCards, visitLog || [], spend || {}, now || new Date());
      return { lounge, matches, open: matches.some((m) => m.usable) };
    });
    return { lounges: rows, openCount: rows.filter((r) => r.open).length, total: rows.length };
  }

  // --- the main builder ---------------------------------------------------
  // trip = { from, to, depart, return (opt), nights (opt), adults (opt) }
  // ctx  = { flights, hotels, deals, lounges, cards, wallet, visitLog, spend, now }
  function planTrip(trip, ctx) {
    trip = trip || {}; ctx = ctx || {};
    const flights = ctx.flights || root.LL_FLIGHTS || {};
    const hotels = ctx.hotels || root.LL_HOTELS || {};
    const deals = ctx.deals || root.LL_DEALS || {};
    const lounges = ctx.lounges || root.LL_LOUNGES || [];
    const cards = ctx.cards || root.LL_CARDS || [];
    const wallet = ctx.wallet || [];
    const wCards = walletCards(wallet, cards);
    const now = ctx.now || new Date();

    const origin = resolvePlace(trip.from, flights);
    const dest = resolvePlace(trip.to, flights);

    // dates: derive checkout from nights or return; default 2 nights
    const depart = parseISO(trip.depart) ? trip.depart : null;
    let checkout = parseISO(trip.return) ? trip.return : null;
    let nights = trip.nights ? Math.max(1, +trip.nights) : null;
    if (depart && !checkout && nights) checkout = addDays(depart, nights);
    if (depart && checkout && !nights) nights = nightsBetween(depart, checkout);
    if (depart && !checkout && !nights) { nights = 2; checkout = addDays(depart, 2); }
    const adults = Math.max(1, +trip.adults || 2);

    // ---- 1. FLIGHTS leg ----
    const FE = flightEngine();
    const flightFrom = origin ? origin.code : (trip.from || "");
    const flightTo = dest ? dest.code : (trip.to || "");
    let flightCompare = [];
    if (FE && flights.providers) {
      flightCompare = FE.comparison(flights, flightFrom, flightTo, depart, wCards, {});
    }

    // ---- 2. STAY leg ----
    const destCity = dest ? dest.city : (trip.to || "");
    const stayCompare = rankProviders(hotels.providers).map((p) => ({
      provider: p,
      link: buildStayLink(p, destCity, depart, checkout, adults),
      prefilled: p.linkType === "prefilled" && !!(parseISO(depart) && parseISO(checkout)),
      offers: offersForWallet(p, wCards),
      walletHits: offersForWallet(p, wCards).filter((o) => o.inWallet).length,
    }));

    // ---- 3. LOUNGES at both ends ----
    const loungeOrigin = origin ? loungesAtCity(origin.city, wallet, cards, lounges, ctx.visitLog, ctx.spend, now) : null;
    const loungeDest = dest ? loungesAtCity(dest.city, wallet, cards, lounges, ctx.visitLog, ctx.spend, now) : null;

    // ---- 4. ON-TRIP deals for the destination city ----
    const dealsByCat = {};
    (deals.categories || []).forEach((cat) => {
      const svcs = (deals.services || []).filter((s) => s.category === cat.id).map((s) => ({
        service: s,
        link: buildDealLink(s, destCity),
        offers: offersForWallet(s, wCards),
      }));
      dealsByCat[cat.id] = { category: cat, services: svcs };
    });

    // ---- 5. BEST CARD across the whole trip ----
    const bestCard = bestCardForTrip({ flightCompare, stayCompare, dealsByCat }, wCards);

    // ---- 6. SAVINGS CHECKLIST (transparent levers, never a fake total) ----
    const savings = savingsChecklist({ flightCompare, stayCompare, loungeOrigin, loungeDest, bestCard, nights }, hotels, deals);

    return {
      route: { origin, dest, from: flightFrom, to: flightTo },
      dates: { depart, checkout, nights, adults },
      flights: flightCompare,
      stay: stayCompare,
      lounges: { origin: loungeOrigin, dest: loungeDest },
      deals: dealsByCat,
      bestCard,
      savings,
      wallet: { count: wCards.length },
    };
  }

  // across flights + stay + deals, which single wallet card wins the most
  // (matching-issuer) offers, weighted by provider confidence?
  function bestCardForTrip(parts, wCards) {
    const score = new Map(); // cardId -> {card, points, where:Set}
    const bump = (node, link, label) => {
      (node.offers || []).forEach((o) => {
        if (!o.offer) return;
        const off = o.offer;
        if (off.kind !== "card" || !off.issuer) return;
        (o.matchedCards || []).forEach((c) => {
          if (!score.has(c.id)) score.set(c.id, { card: c, points: 0, where: new Set() });
          const e = score.get(c.id);
          e.points += (CONF_RANK[off.confidence] || 1);
          e.where.add(label);
        });
      });
    };
    (parts.flightCompare || []).forEach((f) => bump({ offers: f.offers }, f.link, "flights:" + (f.provider && f.provider.name)));
    (parts.stayCompare || []).forEach((s) => bump({ offers: s.offers }, s.link, "stay:" + (s.provider && s.provider.name)));
    Object.values(parts.dealsByCat || {}).forEach((cat) => {
      (cat.services || []).forEach((sv) => bump({ offers: sv.offers }, sv.link, "deal:" + (sv.service && sv.service.name)));
    });
    return Array.from(score.values())
      .map((e) => ({ card: e.card, points: e.points, places: Array.from(e.where) }))
      .sort((a, b) => b.points - a.points || b.places.length - a.places.length);
  }

  // a transparent list of the real money-saving levers on THIS trip. Each item
  // is an action the user can verify — NOT a fabricated savings number.
  function savingsChecklist(parts, hotels, deals) {
    const items = [];
    // flights: compare meta + best card offer
    const metaFlight = (parts.flightCompare || []).find((f) => f.provider && f.provider.type === "meta");
    if (metaFlight) items.push({ icon: "✈️", text: "Compare all airlines at once on " + metaFlight.provider.name + " before booking — it sees every fare." });
    if (parts.bestCard && parts.bestCard[0]) {
      const bc = parts.bestCard[0];
      items.push({ icon: "💳", text: "Pay with your " + bc.card.name + " — it has offers across " + bc.places.length + " of this trip's booking sites." });
    }
    // stay
    const metaStay = (parts.stayCompare || []).find((s) => s.provider && s.provider.type === "meta");
    if (metaStay) items.push({ icon: "🏨", text: "Check " + metaStay.provider.name + " first for the stay — it compares the same hotel across every site." });
    if (parts.nights && parts.nights >= 7) items.push({ icon: "📅", text: "Your stay is " + parts.nights + " nights — Airbnb/Agoda weekly discounts (10-40% off) kick in. Worth checking vs hotels." });
    // free-cancel hedge always applies
    items.push({ icon: "🔁", text: "Book a free-cancellation rate early, then rebook if the price drops before the deadline. Zero-risk." });
    // lounges
    const loungeOpen = (parts.loungeOrigin ? parts.loungeOrigin.openCount : 0) + (parts.loungeDest ? parts.loungeDest.openCount : 0);
    if (loungeOpen > 0) items.push({ icon: "🛋️", text: "Your cards open " + loungeOpen + " lounge(s) on this route — free food + a seat while you wait. Use them." });
    else items.push({ icon: "🛋️", text: "Add the cards you hold to see which airport lounges you can walk into free on this route." });
    // on-trip
    items.push({ icon: "🚕", text: "At the destination, price 2-3 cab apps for each ride — the cheapest flips by city + time." });
    items.push({ icon: "🚆", text: "For a short connecting hop, check a train/bus — often a fraction of a second flight." });
    return items;
  }

  const Engine = {
    parseISO, addDays, nightsBetween, ddmmyyyy,
    buildStayLink, buildDealLink, rankProviders,
    resolvePlace, walletCards, offersForWallet, loungesAtCity,
    planTrip, bestCardForTrip, savingsChecklist,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = Engine;
  root.LL_TRIP_ENGINE = Engine;
})(typeof window !== "undefined" ? window : globalThis);
