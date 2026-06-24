/*
 * FlightLens engine — pure logic over LL_FLIGHTS. No DOM. Node-testable.
 *
 * What it does (and deliberately does NOT do):
 *  - buildLink(): fills a provider's deep-link template with the user's route+date.
 *  - providersFor(): returns providers ordered meta-first (compare), then airlines
 *    (book direct, fewer fees), then OTAs.
 *  - offersForWallet(): matches the user's WALLET cards to each provider's offers
 *    by issuer, so we can show "your HDFC card has an offer here". This is the
 *    "best way to pay" computation — reuses the lounge app's card dataset.
 *  - bestPay(): across all providers, which of the user's cards has a matching
 *    offer on the most/most-confident providers (a directional hint, not a price).
 *  It does NOT invent prices. Live fares live on the provider's real page.
 */
(function (root) {
  "use strict";

  function pad2(n) { return n < 10 ? "0" + n : "" + n; }

  // dateStr is "YYYY-MM-DD". Returns the placeholder substitutions.
  function dateParts(dateStr) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr || "");
    if (!m) return null;
    const [_, y, mo, d] = m;
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return {
      ymd: y + "-" + mo + "-" + d,
      yymmdd: y.slice(2) + mo + d,
      ddmmyyyy: d + "/" + mo + "/" + y,
      ddmmyyyyplain: d + mo + y,
      text: d + " " + months[Number(mo) - 1] + " " + y,
    };
  }

  // fill a provider url template. Returns null if the template needs a date and
  // we don't have a valid one (so the caller can fall back to the plain site).
  function buildLink(provider, from, to, dateStr) {
    let url = provider.url;
    const dp = dateParts(dateStr);
    // {ON_DATE} is an OPTIONAL date segment: route-only search is still valid, so
    // it never triggers the no-date fallback (it just drops out when undated).
    const onDate = /\{ON_DATE\}/.test(url);
    // a HARD date requirement is a {DATE...} token that is NOT the optional one
    const needsDate = /\{DATE/.test(url);
    if (needsDate && !dp) return provider.fallbackUrl || stripToOrigin(url);
    const F = (from || "").toUpperCase(), T = (to || "").toUpperCase();
    url = url
      .replace(/\{FROM_L\}/g, F.toLowerCase()).replace(/\{TO_L\}/g, T.toLowerCase())
      .replace(/\{FROM\}/g, F).replace(/\{TO\}/g, T);
    if (dp) {
      url = url
        .replace(/\{ON_DATE\}/g, "%20on%20" + dp.ymd)
        .replace(/\{DATE_YYMMDD\}/g, dp.yymmdd)
        .replace(/\{DATE_DDMMYYYY_PLAIN\}/g, dp.ddmmyyyyplain)
        .replace(/\{DATE_DDMMYYYY\}/g, encodeURIComponent(dp.ddmmyyyy))
        .replace(/\{DATE_TEXT\}/g, encodeURIComponent(dp.text))
        .replace(/\{DATE\}/g, dp.ymd);
    } else if (onDate) {
      url = url.replace(/\{ON_DATE\}/g, ""); // undated: route-only search
    }
    return url;
  }

  function stripToOrigin(url) {
    try { const u = new URL(url); return u.origin + "/"; } catch (e) { return url; }
  }

  const TYPE_ORDER = { meta: 0, airline: 1, ota: 2 };
  const CONF_RANK = { high: 3, med: 2, low: 1 };

  function providersFor(flights, opts) {
    opts = opts || {};
    let list = (flights.providers || []).slice();
    if (opts.type) list = list.filter((p) => p.type === opts.type);
    return list.sort((a, b) =>
      (TYPE_ORDER[a.type] - TYPE_ORDER[b.type]) ||
      (CONF_RANK[b.confidence] - CONF_RANK[a.confidence]) ||
      a.name.localeCompare(b.name));
  }

  // which of the user's wallet cards have a matching offer on this provider?
  // walletCards = array of card objects {id, issuer, ...} from LL_CARDS.
  function offersForProvider(provider, walletCards) {
    const offers = provider.offers || [];
    const walletIssuers = new Set((walletCards || []).map((c) => c.issuer));
    return offers.map((o) => {
      const matchedCards = o.kind === "card" && o.issuer
        ? (walletCards || []).filter((c) => c.issuer === o.issuer)
        : [];
      const inWallet = matchedCards.length > 0 || (o.kind !== "card");
      return { offer: o, matchedCards, inWallet: o.kind === "card" ? matchedCards.length > 0 : false, walletRelevant: o.kind === "card" ? walletIssuers.has(o.issuer) : true };
    });
  }

  // full per-provider view for a route: link + offers, wallet-aware.
  function comparison(flights, from, to, dateStr, walletCards, opts) {
    return providersFor(flights, opts).map((p) => {
      const offers = offersForProvider(p, walletCards);
      const walletHits = offers.filter((o) => o.inWallet).length;
      return {
        provider: p,
        link: buildLink(p, from, to, dateStr),
        prefilled: p.linkType === "prefilled" && !!dateParts(dateStr),
        offers,
        walletHits,
      };
    });
  }

  // best way to pay: across all providers, score each wallet card by how many
  // providers it has a (matching-issuer) offer on, weighted by provider confidence.
  function bestPay(flights, walletCards) {
    const score = new Map(); // cardId -> { card, providers:[], points }
    (flights.providers || []).forEach((p) => {
      (p.offers || []).forEach((o) => {
        if (o.kind !== "card" || !o.issuer) return;
        (walletCards || []).filter((c) => c.issuer === o.issuer).forEach((c) => {
          if (!score.has(c.id)) score.set(c.id, { card: c, providers: [], points: 0 });
          const e = score.get(c.id);
          if (!e.providers.includes(p.name)) e.providers.push(p.name);
          e.points += (CONF_RANK[p.confidence] || 1);
        });
      });
    });
    return Array.from(score.values()).sort((a, b) => b.points - a.points || b.providers.length - a.providers.length);
  }

  // all offers + coupons flattened, for the "Coupons & offers" view.
  function allOffers(flights) {
    const out = [];
    (flights.providers || []).forEach((p) => {
      (p.offers || []).forEach((o) => out.push({ ...o, provider: p.name, providerId: p.id, verify: o.verify || p.verify }));
    });
    (flights.coupons || []).forEach((c) => out.push({ ...c, kind: c.kind || "coupon", provider: c.who || "multiple" }));
    return out;
  }

  function airports(flights) {
    return (flights.airports || []).slice().sort((a, b) => a.city.localeCompare(b.city));
  }

  const Engine = { dateParts, buildLink, providersFor, offersForProvider, comparison, bestPay, allOffers, airports };
  if (typeof module !== "undefined" && module.exports) module.exports = Engine;
  root.LL_FLIGHT_ENGINE = Engine;
})(typeof window !== "undefined" ? window : globalThis);
