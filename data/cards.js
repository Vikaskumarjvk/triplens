/*
 * LoungeLens — credit card lounge-benefit dataset (India), reviewed 2026-06-21.
 *
 * SCOPE: this lists cards that CARRY lounge access (the only ones relevant to a
 * lounge app) across all major Indian issuers, plus a few common no-lounge cards
 * flagged as baseline. India has 500+ card variants; the vast majority have no
 * lounge benefit and are intentionally omitted. This is the lounge-relevant set.
 *
 * PROVENANCE (be honest): a live scrape of the aggregator sites was attempted and
 * BLOCKED (403/bot-protection on Paisabazaar/BankBazaar; DreamFolks confirmed only
 * the issuer list). So these entries are compiled from working knowledge of the
 * 2024-25 lounge overhaul, NOT live-scraped. Every entry is confidence-tagged and
 * carries a `verify` pointer. The app ages confidence over time. DESK-CHECK any
 * specific number against the issuer's T&C before relying on it.
 *
 * THE 2024-25 TRAP: most issuers moved to SPEND-GATED visits (next quarter's free
 * visits unlock only if you spent >= a threshold this quarter). Modeled in `spendGate`.
 *
 * FIELDS: see schema notes in README. domesticVisits = number|"unlimited"|0;
 * period = quarter|year|month; spendGate = null | {amount, per, note};
 * programs = access rails; ease 1..5; approvalSpeed instant|fast|normal|slow.
 */
window.LL_CARDS = [
  // ==================================================================
  // RUPAY / NETWORK LOUNGE PROGRAMS (easiest, broadest)
  // ==================================================================
  { id: "rupay-select", name: "RuPay Select (any bank)", issuer: "Various", network: "rupay",
    domesticVisits: 2, period: "quarter", spendGate: null, programs: ["rupay", "dreamfolks"], railway: true,
    ease: 4, ltf: false, fyf: true, approvalSpeed: "fast",
    eligibility: "Easiest lounge route; many banks issue on modest income, sometimes near-instant to existing customers.",
    feeNote: "Varies (often ₹0-₹999). RuPay Select tier: ~2 domestic/quarter + railway. Works on UPI.",
    confidence: "med", verify: "rupay.co.in lounge program + issuing bank T&C" },
  { id: "rupay-platinum", name: "RuPay Platinum (any bank)", issuer: "Various", network: "rupay",
    domesticVisits: 2, period: "year", spendGate: null, programs: ["rupay", "dreamfolks"], railway: true,
    ease: 5, ltf: true, fyf: true, approvalSpeed: "fast",
    eligibility: "Very easy; common on basic bank cards.",
    feeNote: "Often free. Lower lounge allowance than Select.",
    confidence: "low", verify: "rupay.co.in + issuing bank T&C" },

  // ==================================================================
  // HDFC BANK
  // ==================================================================
  { id: "hdfc-millennia", name: "HDFC Millennia", issuer: "HDFC", network: "mastercard",
    domesticVisits: 1, period: "quarter", spendGate: { amount: 100000, per: "quarter", note: "1 lounge/quarter only if ₹1L spent the PRIOR quarter." },
    programs: ["dreamfolks", "mastercard"], railway: false, ease: 4, ltf: false, fyf: true, approvalSpeed: "normal",
    eligibility: "HDFC favours existing customers / salaried.", feeNote: "₹1000, waivable on ₹1L/yr.",
    confidence: "med", verify: "hdfcbank.com" },
  { id: "hdfc-moneyback-plus", name: "HDFC MoneyBack+", issuer: "HDFC", network: "visa",
    domesticVisits: 0, period: "quarter", spendGate: null, programs: [], railway: false, ease: 4, ltf: false, fyf: true, approvalSpeed: "normal",
    eligibility: "Entry card.", feeNote: "₹500. No lounge — baseline.", confidence: "low", verify: "hdfcbank.com" },
  { id: "hdfc-regalia", name: "HDFC Regalia Gold", issuer: "HDFC", network: "visa",
    domesticVisits: 12, period: "year", spendGate: null, programs: ["dreamfolks", "priority", "visa"], railway: false,
    ease: 3, ltf: false, fyf: true, approvalSpeed: "normal", eligibility: "Mid-high income; common HDFC upgrade.",
    feeNote: "₹2500, waivable. 12 domestic/yr + Priority Pass.", confidence: "med", verify: "hdfcbank.com" },
  { id: "hdfc-regalia-first", name: "HDFC Regalia First", issuer: "HDFC", network: "visa",
    domesticVisits: 8, period: "year", spendGate: null, programs: ["dreamfolks", "visa"], railway: false,
    ease: 3, ltf: false, fyf: true, approvalSpeed: "normal", eligibility: "Mid income.", feeNote: "₹1000, waivable.",
    confidence: "low", verify: "hdfcbank.com" },
  { id: "hdfc-diners-privilege", name: "HDFC Diners Club Privilege", issuer: "HDFC", network: "diners",
    domesticVisits: 12, period: "year", spendGate: null, programs: ["dreamfolks", "priority", "diners"], railway: false,
    ease: 3, ltf: false, fyf: true, approvalSpeed: "normal", eligibility: "Mid-high income.",
    feeNote: "₹2500, waivable. Domestic + Priority Pass.", confidence: "low", verify: "hdfcbank.com" },
  { id: "hdfc-diners-black", name: "HDFC Diners Club Black", issuer: "HDFC", network: "diners",
    domesticVisits: "unlimited", period: "year", spendGate: null, programs: ["dreamfolks", "priority", "diners"], railway: true,
    ease: 2, ltf: false, fyf: false, approvalSpeed: "slow", eligibility: "High income (~₹18L+ commonly cited).",
    feeNote: "₹10,000. Unlimited domestic + Priority Pass.", confidence: "med", verify: "hdfcbank.com" },
  { id: "hdfc-infinia", name: "HDFC Infinia", issuer: "HDFC", network: "visa",
    domesticVisits: "unlimited", period: "year", spendGate: null, programs: ["dreamfolks", "priority", "visa", "diners"], railway: true,
    ease: 1, ltf: false, fyf: false, approvalSpeed: "slow", eligibility: "Invite / HNW. Not gettable in under a month for most.",
    feeNote: "₹12,500. Unlimited domestic + Priority Pass (self+guest).", confidence: "high", verify: "hdfcbank.com" },
  { id: "hdfc-tata-neu-infinity", name: "Tata Neu Infinity HDFC", issuer: "HDFC", network: "rupay",
    domesticVisits: 8, period: "year", spendGate: null, programs: ["dreamfolks", "rupay", "visa"], railway: true,
    ease: 3, ltf: false, fyf: true, approvalSpeed: "normal", eligibility: "Mid income; RuPay variant works on UPI.",
    feeNote: "₹1499, waivable. Domestic lounge + railway.", confidence: "low", verify: "hdfcbank.com" },
  { id: "hdfc-marriott", name: "Marriott Bonvoy HDFC", issuer: "HDFC", network: "diners",
    domesticVisits: 12, period: "year", spendGate: null, programs: ["dreamfolks", "priority", "diners"], railway: false,
    ease: 2, ltf: false, fyf: false, approvalSpeed: "normal", eligibility: "Mid-high income, travel card.",
    feeNote: "₹3000. Priority Pass + domestic.", confidence: "low", verify: "hdfcbank.com" },

  // ==================================================================
  // AXIS BANK
  // ==================================================================
  { id: "axis-myzone", name: "Axis MyZone", issuer: "Axis", network: "mastercard",
    domesticVisits: 1, period: "quarter", spendGate: null, programs: ["dreamfolks", "mastercard"], railway: false,
    ease: 5, ltf: false, fyf: true, approvalSpeed: "fast", eligibility: "Popular entry card, quick approval for salaried.",
    feeNote: "₹500. 1 domestic lounge/quarter.", confidence: "med", verify: "axisbank.com" },
  { id: "axis-ace", name: "Axis ACE", issuer: "Axis", network: "visa",
    domesticVisits: 4, period: "year", spendGate: null, programs: ["dreamfolks", "visa"], railway: false,
    ease: 4, ltf: false, fyf: false, approvalSpeed: "fast", eligibility: "Mid income salaried.",
    feeNote: "₹499, waivable. 4 domestic/yr.", confidence: "med", verify: "axisbank.com" },
  { id: "axis-atlas", name: "Axis Atlas", issuer: "Axis", network: "visa",
    domesticVisits: 8, period: "year", spendGate: null, programs: ["dreamfolks", "priority", "visa"], railway: false,
    ease: 3, ltf: false, fyf: false, approvalSpeed: "normal", eligibility: "Travel card; mid-high income.",
    feeNote: "₹5000. Domestic + international lounge on milestones.", confidence: "med", verify: "axisbank.com" },
  { id: "axis-magnus", name: "Axis Magnus / Burgundy", issuer: "Axis", network: "mastercard",
    domesticVisits: "unlimited", period: "year", spendGate: null, programs: ["dreamfolks", "priority", "mastercard"], railway: true,
    ease: 2, ltf: false, fyf: false, approvalSpeed: "slow", eligibility: "High income / Burgundy banking relationship.",
    feeNote: "₹12,500. Unlimited domestic + Priority Pass guest visits.", confidence: "med", verify: "axisbank.com" },
  { id: "axis-reserve", name: "Axis Reserve", issuer: "Axis", network: "mastercard",
    domesticVisits: "unlimited", period: "year", spendGate: null, programs: ["dreamfolks", "priority", "mastercard"], railway: true,
    ease: 1, ltf: false, fyf: false, approvalSpeed: "slow", eligibility: "Super-premium, invite/HNW.",
    feeNote: "₹50,000. Unlimited domestic + Priority Pass.", confidence: "low", verify: "axisbank.com" },
  { id: "axis-vistara", name: "Axis Vistara (legacy)", issuer: "Axis", network: "visa",
    domesticVisits: 8, period: "year", spendGate: null, programs: ["dreamfolks", "priority", "visa"], railway: false,
    ease: 3, ltf: false, fyf: false, approvalSpeed: "normal", eligibility: "Co-brand; note Vistara merged into Air India — verify status.",
    feeNote: "Varies. Verify post Air India-Vistara merger.", confidence: "low", verify: "axisbank.com (Vistara merger affects this)" },
  { id: "axis-flipkart", name: "Flipkart Axis", issuer: "Axis", network: "mastercard",
    domesticVisits: 0, period: "year", spendGate: null, programs: [], railway: false,
    ease: 4, ltf: false, fyf: true, approvalSpeed: "fast", eligibility: "Popular cashback card.",
    feeNote: "₹500. No lounge on base variant — baseline.", confidence: "low", verify: "axisbank.com" },

  // ==================================================================
  // ICICI BANK
  // ==================================================================
  { id: "amazon-icici", name: "Amazon Pay ICICI", issuer: "ICICI", network: "visa",
    domesticVisits: 0, period: "quarter", spendGate: null, programs: [], railway: false, ease: 5, ltf: true, fyf: true, approvalSpeed: "fast",
    eligibility: "Very widely held, lifetime-free.", feeNote: "Lifetime free. No lounge — listed so you know it won't help at the gate.",
    confidence: "high", verify: "icici.com" },
  { id: "icici-coral", name: "ICICI Coral", issuer: "ICICI", network: "visa",
    domesticVisits: 1, period: "quarter", spendGate: { amount: 75000, per: "quarter", note: "Newer variants tie lounge access to quarterly spend." },
    programs: ["dreamfolks", "visa"], railway: true, ease: 4, ltf: false, fyf: false, approvalSpeed: "normal",
    eligibility: "Mid income; faster for existing ICICI customers.", feeNote: "₹500+. 1 domestic/quarter (spend-gated) + railway.",
    confidence: "low", verify: "icici.com (variant + spend rule volatile)" },
  { id: "icici-rubyx", name: "ICICI Rubyx", issuer: "ICICI", network: "visa",
    domesticVisits: 4, period: "year", spendGate: null, programs: ["dreamfolks", "visa", "mastercard"], railway: true,
    ease: 3, ltf: false, fyf: false, approvalSpeed: "normal", eligibility: "Mid income.",
    feeNote: "₹3000, waivable. Dual network, domestic + railway.", confidence: "low", verify: "icici.com" },
  { id: "icici-sapphiro", name: "ICICI Sapphiro", issuer: "ICICI", network: "visa",
    domesticVisits: 8, period: "year", spendGate: null, programs: ["dreamfolks", "priority", "visa"], railway: true,
    ease: 3, ltf: false, fyf: false, approvalSpeed: "normal", eligibility: "Mid-high income.",
    feeNote: "₹3500, waivable. Domestic + Priority Pass + railway.", confidence: "low", verify: "icici.com" },
  { id: "icici-emeralde", name: "ICICI Emeralde Private Metal", issuer: "ICICI", network: "visa",
    domesticVisits: "unlimited", period: "year", spendGate: null, programs: ["dreamfolks", "priority", "visa"], railway: true,
    ease: 1, ltf: false, fyf: false, approvalSpeed: "slow", eligibility: "Super-premium, HNW.",
    feeNote: "₹12,499. Unlimited domestic + Priority Pass.", confidence: "low", verify: "icici.com" },
  { id: "icici-amazon-no2", name: "ICICI HPCL / co-brands", issuer: "ICICI", network: "visa",
    domesticVisits: 1, period: "quarter", spendGate: { amount: 50000, per: "quarter", note: "Co-brand lounge often spend-gated." },
    programs: ["dreamfolks", "visa"], railway: false, ease: 4, ltf: false, fyf: true, approvalSpeed: "normal",
    eligibility: "Fuel co-brand.", feeNote: "Low fee. Spend-gated lounge.", confidence: "low", verify: "icici.com" },

  // ==================================================================
  // SBI CARD
  // ==================================================================
  { id: "sbi-cashback", name: "SBI Cashback", issuer: "SBI", network: "visa",
    domesticVisits: 0, period: "quarter", spendGate: null, programs: [], railway: false, ease: 4, ltf: false, fyf: true, approvalSpeed: "normal",
    eligibility: "Common cashback card.", feeNote: "₹999, waived on ₹2L/yr. No lounge — baseline.", confidence: "high", verify: "sbicard.com" },
  { id: "sbi-simplyclick", name: "SBI SimplyCLICK", issuer: "SBI", network: "visa",
    domesticVisits: 0, period: "year", spendGate: null, programs: [], railway: false, ease: 5, ltf: false, fyf: true, approvalSpeed: "normal",
    eligibility: "Entry online-spend card.", feeNote: "₹499. No lounge — baseline.", confidence: "low", verify: "sbicard.com" },
  { id: "sbi-prime", name: "SBI Prime", issuer: "SBI", network: "visa",
    domesticVisits: 8, period: "year", spendGate: null, programs: ["dreamfolks", "visa", "mastercard"], railway: false,
    ease: 3, ltf: false, fyf: false, approvalSpeed: "normal", eligibility: "Mid income.",
    feeNote: "₹2999, waivable. 8 domestic/yr (2/quarter).", confidence: "med", verify: "sbicard.com" },
  { id: "sbi-elite", name: "SBI Elite", issuer: "SBI", network: "visa",
    domesticVisits: 8, period: "year", spendGate: null, programs: ["dreamfolks", "priority", "visa", "mastercard"], railway: false,
    ease: 3, ltf: false, fyf: false, approvalSpeed: "normal", eligibility: "Mid-high income.",
    feeNote: "₹4999, waivable. Domestic + Priority Pass.", confidence: "med", verify: "sbicard.com" },
  { id: "sbi-aurum", name: "SBI Aurum", issuer: "SBI", network: "visa",
    domesticVisits: "unlimited", period: "year", spendGate: null, programs: ["dreamfolks", "priority", "visa", "mastercard"], railway: false,
    ease: 2, ltf: false, fyf: false, approvalSpeed: "slow", eligibility: "Premium, invite-led.",
    feeNote: "₹9999. Unlimited domestic + Priority Pass.", confidence: "low", verify: "sbicard.com" },
  { id: "sbi-pulse", name: "SBI Pulse", issuer: "SBI", network: "mastercard",
    domesticVisits: 8, period: "year", spendGate: null, programs: ["dreamfolks", "mastercard"], railway: false,
    ease: 3, ltf: false, fyf: false, approvalSpeed: "normal", eligibility: "Lifestyle/fitness co-brand.",
    feeNote: "₹1499. Domestic lounge.", confidence: "low", verify: "sbicard.com" },

  // ==================================================================
  // IDFC FIRST BANK
  // ==================================================================
  { id: "idfc-first-select", name: "IDFC FIRST Select", issuer: "IDFC FIRST", network: "visa",
    domesticVisits: 4, period: "quarter", spendGate: { amount: 20000, per: "month", note: "Lounge unlocks with ~₹20k monthly spend on most FIRST variants." },
    programs: ["dreamfolks", "visa"], railway: true, ease: 4, ltf: true, fyf: true, approvalSpeed: "fast",
    eligibility: "Decent income for Select.", feeNote: "Lifetime-free variants exist. Strong easy-entry pick.",
    confidence: "med", verify: "idfcfirstbank.com (spend condition varies by variant)" },
  { id: "idfc-first-wow", name: "IDFC FIRST WOW", issuer: "IDFC FIRST", network: "visa",
    domesticVisits: 0, period: "year", spendGate: null, programs: [], railway: false, ease: 5, ltf: true, fyf: true, approvalSpeed: "fast",
    eligibility: "FD-backed, approved even with thin credit.", feeNote: "Lifetime free, FD-backed. No lounge on base — baseline easy card.",
    confidence: "low", verify: "idfcfirstbank.com" },
  { id: "idfc-first-wealth", name: "IDFC FIRST Wealth", issuer: "IDFC FIRST", network: "visa",
    domesticVisits: 4, period: "quarter", spendGate: null, programs: ["dreamfolks", "priority", "visa"], railway: true,
    ease: 3, ltf: true, fyf: true, approvalSpeed: "normal", eligibility: "Wealth banking relationship.",
    feeNote: "Lifetime free with relationship. Domestic + Priority Pass + railway.", confidence: "low", verify: "idfcfirstbank.com" },

  // ==================================================================
  // KOTAK MAHINDRA
  // ==================================================================
  { id: "kotak-league", name: "Kotak League Platinum", issuer: "Kotak", network: "visa",
    domesticVisits: 2, period: "quarter", spendGate: null, programs: ["dreamfolks", "visa"], railway: false,
    ease: 4, ltf: false, fyf: true, approvalSpeed: "fast", eligibility: "Mid income; faster for Kotak account holders.",
    feeNote: "₹500-₹999, waivable. ~2 domestic/quarter.", confidence: "low", verify: "kotak.com" },
  { id: "kotak-myntra", name: "Myntra Kotak", issuer: "Kotak", network: "mastercard",
    domesticVisits: 2, period: "quarter", spendGate: null, programs: ["dreamfolks", "mastercard"], railway: false,
    ease: 4, ltf: false, fyf: true, approvalSpeed: "fast", eligibility: "Shopping co-brand.",
    feeNote: "₹500. Domestic lounge.", confidence: "low", verify: "kotak.com" },
  { id: "kotak-white", name: "Kotak White Reserve", issuer: "Kotak", network: "visa",
    domesticVisits: "unlimited", period: "year", spendGate: null, programs: ["dreamfolks", "priority", "visa"], railway: false,
    ease: 2, ltf: false, fyf: false, approvalSpeed: "slow", eligibility: "Premium, relationship-led.",
    feeNote: "Premium. Domestic + Priority Pass.", confidence: "low", verify: "kotak.com" },

  // ==================================================================
  // AU SMALL FINANCE BANK
  // ==================================================================
  { id: "au-altura-plus", name: "AU Altura Plus", issuer: "AU Small Finance", network: "visa",
    domesticVisits: 2, period: "quarter", spendGate: null, programs: ["dreamfolks", "visa"], railway: true,
    ease: 4, ltf: false, fyf: true, approvalSpeed: "fast", eligibility: "AU approves relatively easily.",
    feeNote: "Low fee, waivable. Domestic + some railway.", confidence: "low", verify: "aubank.in" },
  { id: "au-zenith", name: "AU Zenith / Zenith+", issuer: "AU Small Finance", network: "visa",
    domesticVisits: 8, period: "year", spendGate: null, programs: ["dreamfolks", "priority", "visa"], railway: true,
    ease: 3, ltf: false, fyf: false, approvalSpeed: "normal", eligibility: "Mid-high income.",
    feeNote: "Domestic + Priority Pass + railway.", confidence: "low", verify: "aubank.in" },

  // ==================================================================
  // INDUSIND BANK
  // ==================================================================
  { id: "indusind-legend", name: "IndusInd Legend", issuer: "IndusInd", network: "visa",
    domesticVisits: 8, period: "year", spendGate: null, programs: ["dreamfolks", "priority", "visa"], railway: false,
    ease: 3, ltf: true, fyf: false, approvalSpeed: "normal", eligibility: "Mid-high income; some LTF variants.",
    feeNote: "Often lifetime-free via relationship. Domestic + Priority Pass.", confidence: "low", verify: "indusind.com" },
  { id: "indusind-pinnacle", name: "IndusInd Pinnacle", issuer: "IndusInd", network: "mastercard",
    domesticVisits: "unlimited", period: "year", spendGate: null, programs: ["dreamfolks", "priority", "mastercard"], railway: false,
    ease: 2, ltf: false, fyf: false, approvalSpeed: "slow", eligibility: "Premium.",
    feeNote: "Premium. Domestic + Priority Pass.", confidence: "low", verify: "indusind.com" },

  // ==================================================================
  // RBL BANK
  // ==================================================================
  { id: "rbl-icon", name: "RBL World Safari / Icon", issuer: "RBL", network: "mastercard",
    domesticVisits: 8, period: "year", spendGate: null, programs: ["dreamfolks", "priority", "mastercard"], railway: false,
    ease: 3, ltf: false, fyf: false, approvalSpeed: "normal", eligibility: "Travel card.",
    feeNote: "Domestic + Priority Pass, zero forex on Safari.", confidence: "low", verify: "rblbank.com" },

  // ==================================================================
  // YES BANK
  // ==================================================================
  { id: "yes-marquee", name: "YES Bank Marquee", issuer: "YES Bank", network: "visa",
    domesticVisits: "unlimited", period: "year", spendGate: null, programs: ["dreamfolks", "priority", "visa"], railway: true,
    ease: 2, ltf: false, fyf: false, approvalSpeed: "slow", eligibility: "Premium.",
    feeNote: "Unlimited domestic + Priority Pass + railway.", confidence: "low", verify: "yesbank.in" },
  { id: "yes-prosperity", name: "YES Prosperity Edge", issuer: "YES Bank", network: "mastercard",
    domesticVisits: 4, period: "year", spendGate: null, programs: ["dreamfolks", "mastercard"], railway: false,
    ease: 3, ltf: false, fyf: true, approvalSpeed: "normal", eligibility: "Mid income.",
    feeNote: "Mid card. Domestic lounge.", confidence: "low", verify: "yesbank.in" },

  // ==================================================================
  // AMERICAN EXPRESS
  // ==================================================================
  { id: "amex-plat-travel", name: "Amex Platinum Travel", issuer: "Amex", network: "amex",
    domesticVisits: 8, period: "year", spendGate: null, programs: ["dreamfolks", "priority"], railway: false,
    ease: 3, ltf: false, fyf: false, approvalSpeed: "slow", eligibility: "Amex underwriting can be slow; income proof needed. Not ideal in weeks.",
    feeNote: "₹5000. 8 domestic visits/yr.", confidence: "med", verify: "americanexpress.com/in" },
  { id: "amex-mrcc", name: "Amex Membership Rewards (MRCC)", issuer: "Amex", network: "amex",
    domesticVisits: 0, period: "year", spendGate: null, programs: [], railway: false, ease: 3, ltf: false, fyf: true, approvalSpeed: "slow",
    eligibility: "Entry Amex.", feeNote: "₹1500. No lounge — baseline.", confidence: "low", verify: "americanexpress.com/in" },
  { id: "amex-platinum", name: "Amex Platinum Charge", issuer: "Amex", network: "amex",
    domesticVisits: "unlimited", period: "year", spendGate: null, programs: ["dreamfolks", "priority"], railway: false,
    ease: 1, ltf: false, fyf: false, approvalSpeed: "slow", eligibility: "Super-premium charge card, HNW.",
    feeNote: "₹66,000. Unlimited lounge + Priority Pass + Centurion network.", confidence: "low", verify: "americanexpress.com/in" },

  // ==================================================================
  // STANDARD CHARTERED / HSBC / OTHER FOREIGN
  // ==================================================================
  { id: "sc-ultimate", name: "Standard Chartered Ultimate", issuer: "Standard Chartered", network: "visa",
    domesticVisits: "unlimited", period: "year", spendGate: null, programs: ["dreamfolks", "priority", "visa"], railway: false,
    ease: 2, ltf: false, fyf: false, approvalSpeed: "slow", eligibility: "Premium.",
    feeNote: "₹5000. Domestic + Priority Pass.", confidence: "low", verify: "sc.com/in" },
  { id: "hsbc-premier", name: "HSBC Premier", issuer: "HSBC", network: "mastercard",
    domesticVisits: "unlimited", period: "year", spendGate: null, programs: ["dreamfolks", "priority", "mastercard"], railway: false,
    ease: 2, ltf: true, fyf: false, approvalSpeed: "slow", eligibility: "HSBC Premier banking relationship.",
    feeNote: "Lifetime-free with Premier relationship. Domestic + Priority Pass.", confidence: "low", verify: "hsbc.co.in" },

  // ==================================================================
  // PSU / OTHER BANKS (RuPay-heavy)
  // ==================================================================
  { id: "bob-eterna", name: "Bank of Baroda Eterna", issuer: "Bank of Baroda", network: "visa",
    domesticVisits: 4, period: "year", spendGate: null, programs: ["dreamfolks", "visa"], railway: true,
    ease: 3, ltf: false, fyf: true, approvalSpeed: "normal", eligibility: "Mid income.",
    feeNote: "₹2499, waivable. Domestic + railway.", confidence: "low", verify: "bobcard.co.in" },
  { id: "federal-celesta", name: "Federal Bank Celesta", issuer: "Federal Bank", network: "visa",
    domesticVisits: 8, period: "year", spendGate: null, programs: ["dreamfolks", "priority", "visa"], railway: false,
    ease: 3, ltf: false, fyf: false, approvalSpeed: "normal", eligibility: "Mid-high income.",
    feeNote: "Domestic + Priority Pass.", confidence: "low", verify: "federalbank.co.in" },
  { id: "idbi-aspire", name: "IDBI / Union RuPay lounge cards", issuer: "Various PSU", network: "rupay",
    domesticVisits: 2, period: "quarter", spendGate: null, programs: ["rupay", "dreamfolks"], railway: true,
    ease: 4, ltf: false, fyf: true, approvalSpeed: "normal", eligibility: "PSU bank customers.",
    feeNote: "RuPay tiered lounge + railway.", confidence: "low", verify: "issuing PSU bank T&C" },
];
