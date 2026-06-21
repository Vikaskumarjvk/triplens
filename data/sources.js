/*
 * LoungeLens — sources & integrations registry.
 *
 * HONEST MODEL: LoungeLens cannot programmatically "grant" lounge access — none of
 * DreamFolks / Priority Pass / Adani One / HOI / Plaza Premium expose a public API
 * for a third-party app to open a lounge. Access is granted by YOUR bank's contract
 * and validated at the desk. What LoungeLens DOES is route you to the OFFICIAL source
 * to confirm + use access, and to community/info bases to research + cross-verify.
 *
 * Two groups:
 *   ACCESS_SERVICES  - official apps/sites that actually operate or validate lounges
 *   INFO_SOURCES     - community forums, aggregators, review bases (for cross-checking)
 *
 * `reliability` (1-5): how trustworthy/current for INDIA lounge data, our honest rating.
 *   5 = official primary source, 4 = strong community/expert, 3 = decent aggregator,
 *   2 = crowd/forum (verify), 1 = marketing/SEO-heavy (low trust).
 */
window.LL_SOURCES = {
  // ---- official access services (route here to confirm + use) ----
  access: [
    { id: "dreamfolks", name: "DreamFolks", url: "https://www.dreamfolks.in/", app: "DreamFolks (Play Store / App Store)",
      what: "Dominant Indian aggregator. Most bank-card domestic + railway lounge access routes through DreamFolks. Their app shows live lounge list and your eligibility.",
      rails: ["dreamfolks"], reliability: 5 },
    { id: "prioritypass", name: "Priority Pass", url: "https://www.prioritypass.com/en/lounges", app: "Priority Pass",
      what: "Global lounge program bundled with premium cards. Official lounge finder shows membership-eligible lounges worldwide.",
      rails: ["priority"], reliability: 5 },
    { id: "adanione", name: "Adani One", url: "https://www.adanione.com/", app: "Adani One",
      what: "Adani-operated airports (Mumbai, Ahmedabad, Lucknow, Jaipur, Guwahati, Thiruvananthapuram, Mangaluru, Navi Mumbai). App sells/validates lounge passes at Adani airports.",
      rails: ["plaza", "payperuse"], reliability: 4 },
    { id: "plazapremium", name: "Plaza Premium", url: "https://www.plazapremiumlounge.com/", app: "Plaza Premium",
      what: "Major global lounge operator with India presence. Pay-per-use or via card programs.",
      rails: ["plaza", "dreamfolks"], reliability: 4 },
    { id: "hoi", name: "Encalm / HOI / Travel Food Services", url: "https://www.encalm.com/", app: "operator site",
      what: "Domestic lounge operators (Encalm, TFS, HOI hospitality). Access usually via DreamFolks/Priority Pass or pay-per-use at the desk.",
      rails: ["dreamfolks", "priority", "plaza"], reliability: 3 },
    { id: "rupaylounge", name: "RuPay Lounge Program", url: "https://www.rupay.co.in/rupay-lounge", app: "n/a (eligibility on RuPay site)",
      what: "Official RuPay lounge program: tiered domestic + railway lounge access on RuPay Select/Platinum cards. Check eligibility list here.",
      rails: ["rupay"], reliability: 5 },
    { id: "irctc", name: "IRCTC Executive Lounge", url: "https://www.irctc.co.in/", app: "IRCTC Rail Connect",
      what: "Railway executive lounges. Usually pay-per-use; some bank/RuPay cards comp via DreamFolks. Confirm at station.",
      rails: ["payperuse", "rupay", "dreamfolks"], reliability: 3 },
  ],

  // ---- info / research sources (cross-verify card + lounge claims) ----
  info: [
    { id: "technofino", name: "Technofino (forum + reviews)", url: "https://technofino.in/community/", search: "https://www.google.com/search?q=site:technofino.in+",
      what: "Most active Indian credit-card community + detailed card reviews. Best place to cross-check current lounge rules and spend gates from real users.",
      reliability: 4 },
    { id: "cardexpert", name: "CardExpert", url: "https://www.cardexpert.in/", search: "https://www.google.com/search?q=site:cardexpert.in+",
      what: "Detailed Indian credit-card reviews + lounge access guides. Strong on benefit breakdowns.",
      reliability: 4 },
    { id: "reddit-ccindia", name: "r/CreditCardsIndia (Reddit)", url: "https://www.reddit.com/r/CreditCardsIndia/", search: "https://www.reddit.com/r/CreditCardsIndia/search/?q=",
      what: "Crowd discussion of approvals, lounge changes, devaluations. Recent, but verify — it's anecdotal.",
      reliability: 3 },
    { id: "paisabazaar", name: "Paisabazaar", url: "https://www.paisabazaar.com/credit-card/", search: "https://www.google.com/search?q=site:paisabazaar.com+",
      what: "Aggregator with card comparison + apply links. Decent for fees/eligibility, SEO-heavy so cross-check benefits.",
      reliability: 3 },
    { id: "bankbazaar", name: "BankBazaar", url: "https://www.bankbazaar.com/credit-card.html", search: "https://www.google.com/search?q=site:bankbazaar.com+",
      what: "Aggregator + apply links. Same caveat as Paisabazaar.",
      reliability: 3 },
    { id: "google", name: "Google (latest)", url: "https://www.google.com/search?q=", search: "https://www.google.com/search?q=",
      what: "Catch-all for the freshest news (a devaluation announced last week shows here first).",
      reliability: 2 },
  ],

  // disclaimer surfaced wherever sources appear
  disclaimer:
    "LoungeLens links you to these sources — it does not grant lounge access itself. " +
    "No third-party app can open a lounge for you; access comes from your bank's program " +
    "and is validated at the desk (often by scanning your card in the DreamFolks app). " +
    "Always confirm in the official app before you rely on access.",
};

/*
 * Link builders — given a card or lounge, produce the most useful research links.
 * Pure string functions, no DOM, testable.
 */
window.LL_SOURCE_LINKS = {
  // for a CARD: issuer page (from card.verify if it's a domain) + community searches
  forCard: function (card) {
    const S = window.LL_SOURCES;
    const q = encodeURIComponent(card.name + " lounge access India 2026");
    const links = [];
    // official issuer page if verify looks like a domain
    const dom = (card.verify || "").match(/([a-z0-9.-]+\.[a-z]{2,})/i);
    if (dom) links.push({ label: "Official: " + dom[1], url: "https://" + dom[1], reliability: 5, kind: "official" });
    // community cross-check
    S.info.forEach((src) => {
      links.push({ label: src.name, url: (src.search || src.url) + q, reliability: src.reliability, kind: "info" });
    });
    return links;
  },
  // for a LOUNGE: the access services whose rails match + a finder search
  forLounge: function (lounge) {
    const S = window.LL_SOURCES;
    const railset = new Set(lounge.programs || []);
    const links = S.access
      .filter((svc) => (svc.rails || []).some((r) => railset.has(r)))
      .map((svc) => ({ label: "Open " + svc.name, url: svc.url, app: svc.app, reliability: svc.reliability, kind: "access", what: svc.what }));
    // always offer a fresh search for the specific lounge
    const q = encodeURIComponent((lounge.name || "") + " " + (lounge.city || "") + " lounge access 2026");
    links.push({ label: "Search latest", url: "https://www.google.com/search?q=" + q, reliability: 2, kind: "info" });
    return links;
  },
};
