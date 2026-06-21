/* brand.js — visual brand system for LoungeLens.
 * Maps issuers to brand colors + logo initials, and networks to gradients,
 * so every card renders as real card-art (gradient + issuer badge + network
 * mark) instead of a plain text row. Pure data + tiny pure helpers, no DOM.
 * window.LL_BRAND
 */
(function (root) {
  "use strict";

  // ---- issuer brand palettes (primary, secondary, short label) ----
  // colors approximate each bank's real brand; used for the card-art gradient
  // and the round logo badge. Unknown issuers fall back to a neutral violet.
  const ISSUERS = {
    "HDFC": { c1: "#004C8F", c2: "#0a2a4a", short: "HDFC" },
    "ICICI": { c1: "#AE275F", c2: "#7a1b42", short: "ICICI" },
    "Axis": { c1: "#97144D", c2: "#5e0c30", short: "AXIS" },
    "SBI": { c1: "#22409A", c2: "#14265c", short: "SBI" },
    "Kotak": { c1: "#C9252C", c2: "#7d1418", short: "KOTAK" },
    "IDFC FIRST": { c1: "#9C1C2E", c2: "#5c1019", short: "IDFC" },
    "IndusInd": { c1: "#A6093D", c2: "#640624", short: "INDUS" },
    "HSBC": { c1: "#DB0011", c2: "#82000a", short: "HSBC" },
    "Standard Chartered": { c1: "#0473EA", c2: "#0b8a3e", short: "SC" },
    "Amex": { c1: "#1F6FB2", c2: "#16456e", short: "AMEX" },
    "Bank of Baroda": { c1: "#F37021", c2: "#9c4413", short: "BOB" },
    "Federal Bank": { c1: "#0066B3", c2: "#003e6e", short: "FED" },
    "YES Bank": { c1: "#00518F", c2: "#003157", short: "YES" },
    "RBL": { c1: "#7A1F2B", c2: "#48121a", short: "RBL" },
    "AU Small Finance": { c1: "#4C2C92", c2: "#2c1a55", short: "AU" },
    "Citi": { c1: "#003B70", c2: "#002344", short: "CITI" },
    "Citi (now Axis)": { c1: "#003B70", c2: "#002344", short: "CITI" },
    "slice Bank": { c1: "#7A41DC", c2: "#4a2786", short: "SLICE" },
    "DBS": { c1: "#E2231A", c2: "#8a1510", short: "DBS" },
    "Canara Bank": { c1: "#00609C", c2: "#003a5e", short: "CAN" },
    "Punjab National Bank": { c1: "#A6093D", c2: "#640624", short: "PNB" },
    "Union Bank": { c1: "#C8102E", c2: "#780a1c", short: "UBI" },
    "Bank of India": { c1: "#F58220", c2: "#9c4f13", short: "BOI" },
    "Central Bank of India": { c1: "#6A1B9A", c2: "#3f105c", short: "CBI" },
    "Indian Bank": { c1: "#1565C0", c2: "#0d3c73", short: "IB" },
    "Indian Overseas Bank": { c1: "#1B5E20", c2: "#0f3813", short: "IOB" },
    "IDBI Bank": { c1: "#00873C", c2: "#005124", short: "IDBI" },
    "UCO Bank": { c1: "#1A237E", c2: "#10154c", short: "UCO" },
    "DCB Bank": { c1: "#E2231A", c2: "#8a1510", short: "DCB" },
    "CSB Bank": { c1: "#F9A825", c2: "#9c6917", short: "CSB" },
    "SBM Bank": { c1: "#003B70", c2: "#002344", short: "SBM" },
    "Tamilnad Mercantile Bank": { c1: "#00609C", c2: "#003a5e", short: "TMB" },
    "PSU banks": { c1: "#3949AB", c2: "#222c6b", short: "PSU" },
    "Various PSU": { c1: "#3949AB", c2: "#222c6b", short: "PSU" },
    "Various": { c1: "#5b6478", c2: "#363c49", short: "•" },
    "ABN AMRO (exited)": { c1: "#6b7280", c2: "#404654", short: "ABN" },
    "Barclays (exited)": { c1: "#6b7280", c2: "#404654", short: "BARC" },
    "Deutsche Bank (exited retail)": { c1: "#6b7280", c2: "#404654", short: "DB" },
    "Federal/CSB": { c1: "#0066B3", c2: "#003e6e", short: "FED" },
    "Federal Bank ": { c1: "#0066B3", c2: "#003e6e", short: "FED" },
    "BoB / SBM / Federal": { c1: "#F37021", c2: "#9c4413", short: "BOB" },
  };
  const ISSUER_FALLBACK = { c1: "#7b6eff", c2: "#3b3470", short: "" };

  // ---- network marks (gradient + label) ----
  const NETWORKS = {
    visa: { grad: "linear-gradient(135deg,#1a1f71,#2b6cb0)", label: "VISA", color: "#dfe7ff" },
    mastercard: { grad: "linear-gradient(135deg,#eb001b,#f79e1b)", label: "MC", color: "#fff0e6" },
    rupay: { grad: "linear-gradient(135deg,#097b3e,#ff671f)", label: "RuPay", color: "#eafff1" },
    amex: { grad: "linear-gradient(135deg,#006fcf,#2671b9)", label: "AMEX", color: "#e6f2ff" },
    diners: { grad: "linear-gradient(135deg,#0079be,#00a3e0)", label: "Diners", color: "#e6f7ff" },
  };
  const NETWORK_FALLBACK = { grad: "linear-gradient(135deg,#5b6478,#363c49)", label: "", color: "#e6edf3" };

  function issuerBrand(issuer) {
    return ISSUERS[issuer] || Object.assign({}, ISSUER_FALLBACK, { short: initials(issuer) });
  }
  function networkBrand(network) {
    return NETWORKS[network] || NETWORK_FALLBACK;
  }
  // derive up to 4-char initials from an issuer name when no preset exists
  function initials(name) {
    if (!name) return "•";
    const words = String(name).replace(/[^a-zA-Z ]/g, "").trim().split(/\s+/);
    if (words.length === 1) return words[0].slice(0, 4).toUpperCase();
    return words.map((w) => w[0]).join("").slice(0, 4).toUpperCase();
  }

  // tier accent: premium cards get a metallic sheen, lifetime-free a green tag
  function tierClass(card) {
    if (card.discontinued) return "tier-dead";
    if (card.domesticVisits === "unlimited") return "tier-elite";
    if (card.ease <= 2) return "tier-premium";
    if (card.ltf) return "tier-ltf";
    return "tier-std";
  }

  root.LL_BRAND = { issuerBrand, networkBrand, initials, tierClass };
})(window);
