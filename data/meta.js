/*
 * LoungeLens — dataset metadata + the honesty banner.
 * Bump `lastReviewed` whenever the dataset is desk-checked against live sources.
 */
window.LL_META = {
  lastReviewed: "2026-06-21",
  // Plain-language disclosure shown to non-technical users.
  honesty:
    "Lounge rules in India change every few months. LoungeLens flags how sure it is " +
    "about each entry (green = solid, amber = double-check, red = verify before you rely on it). " +
    "Always glance at the verify note before a trip.",
  // Common access rails, in plain words (used by the simple-mode explainer).
  railWords: {
    dreamfolks: "DreamFolks (most Indian bank cards route through this)",
    priority: "Priority Pass",
    visa: "Visa lounge program",
    mastercard: "Mastercard lounge program",
    diners: "Diners Club",
    rupay: "RuPay lounge program",
    plaza: "Plaza Premium direct",
    payperuse: "pay at the desk",
  },
};
