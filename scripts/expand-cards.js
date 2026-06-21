/* expand-cards.js — append live-scraped issuer lineups to data/cards.js.
 *
 * Source: official issuer sites scraped 2026-06-22 (HDFC, Axis, ICICI, Kotak,
 * SBI, IDFC FIRST, IndusInd, HSBC, Standard Chartered, BoB, Federal, Yes) +
 * AU from knowledge (site bot-blocks). New cards are confidence "low" unless a
 * tier is well-known; every one carries a verify pointer. Dedupes by id against
 * the existing dataset so nothing is duplicated.
 *
 * Run: node scripts/expand-cards.js   (writes data/cards.js in place)
 */
const fs = require("fs");
const path = require("path");

const CARDS_PATH = path.join(__dirname, "..", "data", "cards.js");

// load existing cards to dedupe
global.window = {};
require(CARDS_PATH);
const existing = window.LL_CARDS;
const existingIds = new Set(existing.map((c) => c.id));
const existingNames = new Set(existing.map((c) => c.name.toLowerCase().replace(/[^a-z0-9]/g, "")));

// ---- tier presets: map a tier keyword to lounge-relevant fields ----
// visits/period/programs/railway. Everything else (ease/ltf/fee) set per card.
function tier(t) {
  switch (t) {
    case "none":       return { domesticVisits: 0, period: "year", spendGate: null, programs: [], railway: false };
    case "entry":      return { domesticVisits: 1, period: "quarter", spendGate: null, programs: ["dreamfolks"], railway: false };
    case "entryGate":  return { domesticVisits: 1, period: "quarter", spendGate: { amount: 50000, per: "quarter", note: "Lounge access typically needs prior-quarter spend on this tier." }, programs: ["dreamfolks"], railway: false };
    case "mid":        return { domesticVisits: 8, period: "year", spendGate: null, programs: ["dreamfolks"], railway: false };
    case "midPP":      return { domesticVisits: 8, period: "year", spendGate: null, programs: ["dreamfolks", "priority"], railway: false };
    case "midRail":    return { domesticVisits: 8, period: "year", spendGate: null, programs: ["dreamfolks"], railway: true };
    case "qtr2":       return { domesticVisits: 2, period: "quarter", spendGate: null, programs: ["dreamfolks"], railway: false };
    case "qtr4":       return { domesticVisits: 4, period: "quarter", spendGate: null, programs: ["dreamfolks", "priority"], railway: false };
    case "unlimited":  return { domesticVisits: "unlimited", period: "year", spendGate: null, programs: ["dreamfolks", "priority"], railway: true };
    case "rupay":      return { domesticVisits: 2, period: "quarter", spendGate: null, programs: ["rupay", "dreamfolks"], railway: true };
    case "rupayLite":  return { domesticVisits: 2, period: "year", spendGate: null, programs: ["rupay", "dreamfolks"], railway: true };
    case "railway":    return { domesticVisits: 4, period: "year", spendGate: null, programs: ["dreamfolks", "rupay"], railway: true };
    default: throw new Error("unknown tier " + t);
  }
}

// helper: build one card. opts overrides any field.
function mk(id, name, issuer, network, t, opts = {}) {
  const base = tier(t);
  return Object.assign({
    id, name, issuer, network,
    domesticVisits: base.domesticVisits, period: base.period, spendGate: base.spendGate,
    programs: base.programs, railway: base.railway,
    ease: 3, ltf: false, fyf: true, approvalSpeed: "normal",
    eligibility: "Scraped from issuer site 2026-06-22; tier estimated.",
    feeNote: base.programs.length ? "Lounge tier estimated, verify exact visits/spend-gate." : "No lounge benefit — baseline.",
    confidence: "low",
    verify: opts.verify || "issuer official site (scraped 2026-06-22)",
  }, opts);
}

// ============================================================
// NEW CARDS — scraped lineups, only entries not already present.
// ============================================================
const NEW = [
  // ---- HDFC (live: hdfc.bank.in) ----
  mk("hdfc-phonepe-uno", "PhonePe HDFC Uno", "HDFC", "rupay", "none", { ease: 4, verify: "hdfc.bank.in" }),
  mk("hdfc-phonepe-ultimo", "PhonePe HDFC Ultimo", "HDFC", "visa", "mid", { ease: 3, verify: "hdfc.bank.in" }),
  mk("hdfc-pixel-go", "HDFC Pixel Go", "HDFC", "visa", "none", { ease: 4, verify: "hdfc.bank.in" }),
  mk("hdfc-swiggy-ornge", "Swiggy Ornge HDFC", "HDFC", "mastercard", "midPP", { ease: 3, verify: "hdfc.bank.in" }),
  mk("hdfc-swiggy-blck", "Swiggy BLCK HDFC", "HDFC", "diners", "unlimited", { ease: 1, approvalSpeed: "slow", verify: "hdfc.bank.in" }),
  mk("hdfc-upi-rupay", "HDFC UPI RuPay Credit Card", "HDFC", "rupay", "none", { ease: 4, verify: "hdfc.bank.in" }),
  mk("hdfc-irctc", "IRCTC HDFC Bank", "HDFC", "rupay", "railway", { ease: 4, verify: "hdfc.bank.in" }),
  mk("hdfc-bizblack", "HDFC BizBlack Metal", "HDFC", "diners", "unlimited", { ease: 1, approvalSpeed: "slow", eligibility: "Business super-premium.", verify: "hdfc.bank.in" }),
  mk("hdfc-bizfirst", "HDFC BizFirst", "HDFC", "visa", "midPP", { ease: 2, eligibility: "Business card.", verify: "hdfc.bank.in" }),

  // ---- Axis (live: axis.bank.in) ----
  mk("axis-select", "Axis Select", "Axis", "visa", "midPP", { ease: 3, verify: "axis.bank.in" }),
  mk("axis-rewards", "Axis Rewards", "Axis", "visa", "none", { ease: 4, verify: "axis.bank.in" }),
  mk("axis-myzone-easy", "Axis MyZone Easy", "Axis", "mastercard", "entry", { ease: 4, eligibility: "Secured/easy variant.", verify: "axis.bank.in" }),
  mk("axis-privilege-easy", "Axis Privilege Easy", "Axis", "visa", "entry", { ease: 4, eligibility: "Secured/easy variant.", verify: "axis.bank.in" }),
  mk("axis-indianoil-easy", "IndianOil Axis Easy", "Axis", "visa", "none", { ease: 4, eligibility: "Secured fuel variant.", verify: "axis.bank.in" }),

  // ---- ICICI (live: icici.bank.in) ----
  mk("icici-emeralde", "ICICI Emeralde", "ICICI", "visa", "unlimited", { ease: 2, approvalSpeed: "slow", verify: "icici.bank.in" }),
  mk("icici-hpcl-super-saver", "ICICI HPCL Super Saver", "ICICI", "visa", "entry", { ease: 3, eligibility: "Fuel co-brand.", verify: "icici.bank.in" }),
  mk("icici-expression", "ICICI Expressions", "ICICI", "visa", "entry", { ease: 4, eligibility: "Customisable design card.", verify: "icici.bank.in" }),
  mk("icici-manchester-united-sig", "ICICI Manchester United Signature", "ICICI", "visa", "midPP", { ease: 3, eligibility: "Football co-brand.", verify: "icici.bank.in" }),
  mk("icici-manchester-united-plat", "ICICI Manchester United Platinum", "ICICI", "visa", "mid", { ease: 3, eligibility: "Football co-brand.", verify: "icici.bank.in" }),
  mk("icici-csk", "ICICI Chennai Super Kings", "ICICI", "visa", "entry", { ease: 4, eligibility: "Cricket co-brand.", verify: "icici.bank.in" }),
  mk("icici-parakram-select", "ICICI Parakram Select", "ICICI", "rupay", "railway", { ease: 3, eligibility: "Defence personnel.", verify: "icici.bank.in" }),
  mk("icici-parakram", "ICICI Parakram", "ICICI", "rupay", "rupayLite", { ease: 3, eligibility: "Defence personnel.", verify: "icici.bank.in" }),
  mk("icici-diamant", "ICICI Diamant", "ICICI", "visa", "unlimited", { ease: 1, approvalSpeed: "slow", eligibility: "Super-premium invite.", verify: "icici.bank.in" }),
  mk("icici-coral-rupay", "ICICI Coral RuPay", "ICICI", "rupay", "rupay", { ease: 4, verify: "icici.bank.in" }),
  mk("icici-emirates-emeralde", "ICICI Emirates Emeralde", "ICICI", "visa", "unlimited", { ease: 1, approvalSpeed: "slow", eligibility: "Premium airline co-brand.", verify: "icici.bank.in" }),
  mk("icici-emirates-sapphiro", "ICICI Emirates Sapphiro", "ICICI", "visa", "midPP", { ease: 2, eligibility: "Airline co-brand.", verify: "icici.bank.in" }),

  // ---- Kotak (live: kotak.bank.in) ----
  mk("kotak-indigo", "IndiGo Kotak", "Kotak", "visa", "mid", { ease: 3, eligibility: "IndiGo flyer co-brand.", verify: "kotak.bank.in" }),
  mk("kotak-indigo-premium", "IndiGo Kotak Premium", "Kotak", "visa", "midPP", { ease: 2, eligibility: "IndiGo premium co-brand.", verify: "kotak.bank.in" }),
  mk("kotak-cashback-prime", "Kotak Cashback+ Prime", "Kotak", "visa", "entry", { ease: 4, verify: "kotak.bank.in" }),
  mk("kotak-cashback", "Kotak Cashback+", "Kotak", "visa", "none", { ease: 4, verify: "kotak.bank.in" }),
  mk("kotak-air-plus", "Kotak Air+", "Kotak", "visa", "midPP", { ease: 3, eligibility: "Travel card.", verify: "kotak.bank.in" }),
  mk("kotak-air-plus-prime", "Kotak Air+ Prime", "Kotak", "visa", "unlimited", { ease: 2, approvalSpeed: "slow", eligibility: "Premium travel.", verify: "kotak.bank.in" }),
  mk("kotak-air", "Kotak Air", "Kotak", "visa", "mid", { ease: 3, eligibility: "Travel card.", verify: "kotak.bank.in" }),
  mk("kotak-pvr-inox", "PVR INOX Kotak", "Kotak", "visa", "entry", { ease: 4, eligibility: "Movie co-brand.", verify: "kotak.bank.in" }),
  mk("kotak-upi-rupay", "Kotak UPI RuPay", "Kotak", "rupay", "none", { ease: 4, verify: "kotak.bank.in" }),
  mk("kotak-zen", "Kotak Zen Signature", "Kotak", "visa", "midPP", { ease: 3, verify: "kotak.bank.in" }),
  mk("kotak-mojo", "Kotak Mojo Platinum", "Kotak", "visa", "entry", { ease: 4, eligibility: "Online-spend card.", verify: "kotak.bank.in" }),
  mk("kotak-white", "Kotak White", "Kotak", "visa", "midPP", { ease: 2, verify: "kotak.bank.in" }),
  mk("kotak-royale", "Kotak Royale Signature", "Kotak", "visa", "mid", { ease: 3, verify: "kotak.bank.in" }),
  mk("kotak-privy-signature", "Kotak Privy League Signature", "Kotak", "visa", "midPP", { ease: 2, eligibility: "Privy League banking.", verify: "kotak.bank.in" }),
  mk("kotak-811", "Kotak 811 / 811 Dream Different", "Kotak", "visa", "entryGate", { ease: 5, approvalSpeed: "fast", eligibility: "811 digital account.", verify: "kotak.bank.in" }),

  // ---- SBI (catalogued via bankbazaar; sbicard.com is JS-only) ----
  mk("sbi-miles-prime", "SBI Card Miles Prime", "SBI", "visa", "mid", { ease: 3, eligibility: "Travel-miles series.", verify: "sbicard.com" }),
  mk("sbi-doctors", "Doctor's SBI Card", "SBI", "visa", "midPP", { ease: 3, eligibility: "Professionals (doctors).", verify: "sbicard.com" }),
  mk("sbi-aditya-birla-select", "Aditya Birla SBI Card SELECT", "SBI", "visa", "mid", { ease: 3, eligibility: "Retail co-brand.", verify: "sbicard.com" }),
  mk("sbi-aditya-birla", "Aditya Birla SBI Card", "SBI", "visa", "entry", { ease: 4, eligibility: "Retail co-brand.", verify: "sbicard.com" }),
  mk("sbi-ola-money", "OLA Money SBI Card", "SBI", "visa", "none", { ease: 4, eligibility: "Mobility co-brand.", verify: "sbicard.com" }),
  mk("sbi-paytm-select", "Paytm SBI Card SELECT", "SBI", "visa", "mid", { ease: 3, eligibility: "Fintech co-brand.", verify: "sbicard.com" }),
  mk("sbi-paytm", "Paytm SBI Card", "SBI", "visa", "none", { ease: 4, eligibility: "Fintech co-brand.", verify: "sbicard.com" }),
  mk("sbi-reliance-prime", "Reliance SBI Card Prime", "SBI", "visa", "mid", { ease: 3, eligibility: "Retail co-brand.", verify: "sbicard.com" }),
  mk("sbi-spar-prime", "SPAR SBI Card PRIME", "SBI", "visa", "mid", { ease: 3, eligibility: "Retail co-brand.", verify: "sbicard.com" }),
  mk("sbi-lifestyle-select", "Lifestyle Home Centre SBI Card SELECT", "SBI", "visa", "mid", { ease: 3, eligibility: "Retail co-brand.", verify: "sbicard.com" }),
  mk("sbi-max-select", "Max SBI Card SELECT", "SBI", "visa", "mid", { ease: 3, eligibility: "Retail co-brand.", verify: "sbicard.com" }),
  mk("sbi-unnati", "SBI Unnati", "SBI", "visa", "none", { ease: 5, approvalSpeed: "fast", ltf: true, eligibility: "FD-backed entry card.", verify: "sbicard.com" }),
  mk("sbi-shaurya-select", "Shaurya SELECT SBI Card", "SBI", "visa", "midPP", { ease: 3, eligibility: "Defence personnel.", verify: "sbicard.com" }),
  mk("sbi-shaurya", "Shaurya SBI Card", "SBI", "visa", "mid", { ease: 3, eligibility: "Defence personnel.", verify: "sbicard.com" }),

  // ---- IDFC FIRST (live: idfcfirst.bank.in; lounge counts deep-fetched) ----
  mk("idfc-private", "IDFC FIRST Private", "IDFC FIRST", "visa", "unlimited", { ease: 1, approvalSpeed: "slow", ltf: true, eligibility: "Top invite-only metal.", verify: "idfcfirst.bank.in" }),
  mk("idfc-classic", "IDFC FIRST Classic", "IDFC FIRST", "visa", "none", { ease: 5, approvalSpeed: "fast", ltf: true, eligibility: "Entry lifetime-free.", verify: "idfcfirst.bank.in (lounge: NA)" }),
  mk("idfc-earn", "IDFC FIRST EARN", "IDFC FIRST", "visa", "none", { ease: 4, ltf: true, verify: "idfcfirst.bank.in" }),
  mk("idfc-wow-black", "IDFC FIRST WOW! Black", "IDFC FIRST", "visa", "entryGate", { ease: 4, approvalSpeed: "fast", ltf: true, eligibility: "FD-backed, approved with thin credit.", verify: "idfcfirst.bank.in" }),
  mk("idfc-indigo-dual", "IndiGo IDFC FIRST Dual Card", "IDFC FIRST", "visa", "mid", { ease: 3, eligibility: "IndiGo flyer co-brand (credit+debit dual).", verify: "idfcfirst.bank.in" }),
  mk("idfc-gaj", "IDFC FIRST Gaj", "IDFC FIRST", "rupay", "rupay", { ease: 3, eligibility: "RuPay (UPI) card.", verify: "idfcfirst.bank.in" }),
  mk("idfc-diamond-reserve", "IDFC FIRST Diamond Reserve", "IDFC FIRST", "visa", "midPP", { ease: 2, verify: "idfcfirst.bank.in" }),
  mk("idfc-lic-select", "LIC IDFC FIRST Select", "IDFC FIRST", "rupay", "railway", { ease: 3, eligibility: "LIC co-brand, RuPay.", verify: "idfcfirst.bank.in" }),
  mk("idfc-lic-classic", "LIC IDFC FIRST Classic", "IDFC FIRST", "rupay", "rupayLite", { ease: 4, eligibility: "LIC co-brand, RuPay.", verify: "idfcfirst.bank.in" }),

  // ---- IndusInd (live: indusind.bank.in) ----
  mk("indusind-nexxt", "IndusInd Nexxt", "IndusInd", "visa", "midPP", { ease: 2, eligibility: "Premium card with on-card buttons.", verify: "indusind.bank.in" }),
  mk("indusind-duo", "IndusInd DUO Card", "IndusInd", "visa", "mid", { ease: 3, eligibility: "Credit + debit combined.", verify: "indusind.bank.in" }),
  mk("indusind-platinum-rupay", "IndusInd Platinum RuPay", "IndusInd", "rupay", "rupay", { ease: 4, verify: "indusind.bank.in" }),
  mk("indusind-platinum-aura", "IndusInd Platinum Aura Edge", "IndusInd", "visa", "mid", { ease: 3, verify: "indusind.bank.in" }),
  mk("indusind-avios", "IndusInd Avios Visa Infinite", "IndusInd", "visa", "unlimited", { ease: 1, approvalSpeed: "slow", eligibility: "Super-premium travel.", verify: "indusind.bank.in" }),
  mk("indusind-eazydiner-platinum", "IndusInd EazyDiner Platinum", "IndusInd", "mastercard", "mid", { ease: 3, eligibility: "Dining co-brand.", verify: "indusind.bank.in" }),

  // ---- HSBC (live: hsbc.co.in) ----
  mk("hsbc-taj", "HSBC Taj Credit Card", "HSBC", "mastercard", "unlimited", { ease: 1, approvalSpeed: "slow", eligibility: "Invite-only luxury (Taj hotels).", verify: "hsbc.co.in" }),
  mk("hsbc-live-plus", "HSBC Live+", "HSBC", "visa", "mid", { ease: 3, eligibility: "Cashback card.", verify: "hsbc.co.in" }),
  mk("hsbc-visa-platinum", "HSBC Visa Platinum", "HSBC", "visa", "entry", { ease: 3, verify: "hsbc.co.in" }),
  mk("hsbc-rupay-platinum", "HSBC RuPay Platinum", "HSBC", "rupay", "rupayLite", { ease: 3, verify: "hsbc.co.in" }),

  // ---- Standard Chartered (live: sc.bank.in) ----
  mk("sc-beyond", "Standard Chartered Beyond", "Standard Chartered", "visa", "unlimited", { ease: 1, approvalSpeed: "slow", eligibility: "Super-premium (2024).", verify: "sc.bank.in" }),
  mk("sc-rewards", "Standard Chartered Rewards", "Standard Chartered", "visa", "mid", { ease: 3, verify: "sc.bank.in" }),
  mk("sc-smart", "Standard Chartered Smart", "Standard Chartered", "visa", "none", { ease: 4, verify: "sc.bank.in" }),
  mk("sc-priority-infinite", "Standard Chartered Priority Visa Infinite", "Standard Chartered", "visa", "unlimited", { ease: 2, approvalSpeed: "slow", eligibility: "Priority banking relationship.", verify: "sc.bank.in" }),
  mk("sc-super-value-titanium", "Standard Chartered Super Value Titanium", "Standard Chartered", "visa", "none", { ease: 3, eligibility: "Fuel/utility cashback.", verify: "sc.bank.in" }),
  mk("sc-digismart", "Standard Chartered DigiSmart", "Standard Chartered", "visa", "none", { ease: 4, verify: "sc.bank.in" }),
  mk("sc-platinum-rewards", "Standard Chartered Platinum Rewards", "Standard Chartered", "visa", "entry", { ease: 3, verify: "sc.bank.in" }),

  // ---- Bank of Baroda (BoBCARD) ----
  mk("bob-vikram", "BoB Vikram", "Bank of Baroda", "rupay", "railway", { ease: 4, eligibility: "RuPay (UPI) card.", verify: "bobcard.co.in" }),
  mk("bob-irctc", "IRCTC BoB", "Bank of Baroda", "rupay", "railway", { ease: 4, eligibility: "Rail co-brand.", verify: "bobcard.co.in" }),
  mk("bob-yoddha", "Indian Army Yoddha BoB", "Bank of Baroda", "rupay", "rupay", { ease: 3, eligibility: "Indian Army personnel.", verify: "bobcard.co.in" }),
  mk("bob-varunah", "Indian Navy Varunah BoB", "Bank of Baroda", "rupay", "rupay", { ease: 3, eligibility: "Indian Navy personnel.", verify: "bobcard.co.in" }),
  mk("bob-rakshamah", "Coast Guard Rakshamah BoB", "Bank of Baroda", "rupay", "rupay", { ease: 3, eligibility: "Coast Guard personnel.", verify: "bobcard.co.in" }),
  mk("bob-hpcl-energie", "HPCL BoB ENERGIE", "Bank of Baroda", "visa", "entry", { ease: 3, eligibility: "Fuel co-brand.", verify: "bobcard.co.in" }),
  mk("bob-snapdeal", "Snapdeal BoB", "Bank of Baroda", "rupay", "none", { ease: 4, eligibility: "Shopping co-brand.", verify: "bobcard.co.in" }),
  mk("bob-prime", "BoB PRIME", "Bank of Baroda", "visa", "mid", { ease: 3, verify: "bobcard.co.in" }),
  mk("bob-easy", "BoB Easy", "Bank of Baroda", "visa", "none", { ease: 4, verify: "bobcard.co.in" }),
  mk("bob-empower", "BoB EMPOWER", "Bank of Baroda", "visa", "entry", { ease: 3, verify: "bobcard.co.in" }),

  // ---- Federal Bank (live + bankbazaar) ----
  mk("federal-signet", "Federal Bank Visa Signet", "Federal Bank", "visa", "entry", { ease: 3, verify: "federalbank.co.in" }),

  // ---- Yes Bank (catalogued via bankbazaar) ----
  mk("yes-reserve", "YES Bank RESERVE", "YES Bank", "visa", "unlimited", { ease: 1, approvalSpeed: "slow", eligibility: "Super-premium.", verify: "yesbank.in" }),
  mk("yes-elite-plus", "YES Bank ELITE+", "YES Bank", "visa", "midPP", { ease: 3, verify: "yesbank.in" }),
  mk("yes-select", "YES Bank SELECT", "YES Bank", "visa", "mid", { ease: 3, verify: "yesbank.in" }),
  mk("yes-ace", "YES Bank ACE", "YES Bank", "visa", "entry", { ease: 4, verify: "yesbank.in" }),
  mk("yes-rio", "YES Bank RIO RuPay", "YES Bank", "rupay", "rupay", { ease: 4, eligibility: "RuPay (UPI) card.", verify: "yesbank.in" }),
  mk("yes-pop-club", "YES Bank POP-CLUB", "YES Bank", "rupay", "rupayLite", { ease: 4, verify: "yesbank.in" }),
  mk("yes-private-prime", "YES Private Prime", "YES Bank", "visa", "unlimited", { ease: 1, approvalSpeed: "slow", eligibility: "Private banking relationship.", verify: "yesbank.in" }),
  mk("yes-klick", "YES Bank Klick RuPay", "YES Bank", "rupay", "none", { ease: 4, verify: "yesbank.in" }),

  // ---- AU Small Finance (site bot-blocks; from knowledge) ----
  mk("au-altura", "AU Altura", "AU Small Finance", "visa", "entry", { ease: 4, approvalSpeed: "fast", verify: "aubank.in (not live-scraped — verify)" }),
  mk("au-zenith-plus", "AU Zenith+", "AU Small Finance", "visa", "unlimited", { ease: 2, approvalSpeed: "slow", eligibility: "Premium AU.", verify: "aubank.in (not live-scraped — verify)" }),
  mk("au-instapay", "AU InstaPay", "AU Small Finance", "rupay", "none", { ease: 5, approvalSpeed: "fast", eligibility: "RuPay UPI line.", verify: "aubank.in (not live-scraped — verify)" }),
  mk("au-spont", "AU SpontMastercard", "AU Small Finance", "mastercard", "entry", { ease: 4, approvalSpeed: "fast", verify: "aubank.in (not live-scraped — verify)" }),
];

// ---- dedupe + append ----
const added = [];
const skipped = [];
NEW.forEach((c) => {
  const nameKey = c.name.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (existingIds.has(c.id) || existingNames.has(nameKey)) { skipped.push(c.id); return; }
  existingIds.add(c.id); existingNames.add(nameKey);
  added.push(c);
});

// serialize new card objects in the file's compact style
function ser(c) {
  const sg = c.spendGate ? `{ amount: ${c.spendGate.amount}, per: ${JSON.stringify(c.spendGate.per)}, note: ${JSON.stringify(c.spendGate.note)} }` : "null";
  const dv = c.domesticVisits === "unlimited" ? '"unlimited"' : c.domesticVisits;
  return `  { id: ${JSON.stringify(c.id)}, name: ${JSON.stringify(c.name)}, issuer: ${JSON.stringify(c.issuer)}, network: ${JSON.stringify(c.network)},\n` +
    `    domesticVisits: ${dv}, period: ${JSON.stringify(c.period)}, spendGate: ${sg}, programs: ${JSON.stringify(c.programs)}, railway: ${c.railway},\n` +
    `    ease: ${c.ease}, ltf: ${c.ltf}, fyf: ${c.fyf}, approvalSpeed: ${JSON.stringify(c.approvalSpeed)},\n` +
    `    eligibility: ${JSON.stringify(c.eligibility)}, feeNote: ${JSON.stringify(c.feeNote)}, confidence: ${JSON.stringify(c.confidence)}, verify: ${JSON.stringify(c.verify)} },`;
}

const block = "\n  // ==================================================================\n" +
  "  // ====  LIVE-SCRAPED ISSUER LINEUPS (2026-06-22, best-effort)  ======\n" +
  "  // ==================================================================\n" +
  "  // Pulled from official issuer sites (HDFC/Axis/ICICI/Kotak/IDFC/IndusInd/\n" +
  "  // HSBC/SC/BoB/Federal/Yes live; SBI via catalogue; AU from knowledge).\n" +
  "  // Lounge tiers are ESTIMATED, confidence low, every entry has a verify link.\n" +
  added.map(ser).join("\n") + "\n";

let src = fs.readFileSync(CARDS_PATH, "utf8");
const marker = "\n];";
const lastIdx = src.lastIndexOf(marker);
if (lastIdx < 0) throw new Error("could not find array close in cards.js");
src = src.slice(0, lastIdx) + "\n" + block + "];\n";
fs.writeFileSync(CARDS_PATH, src);

console.log(`added ${added.length} new cards, skipped ${skipped.length} dupes`);
if (skipped.length) console.log("skipped:", skipped.join(", "));
