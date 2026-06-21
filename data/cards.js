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

  // ==================================================================
  // ========================  DEBIT CARDS  ===========================
  // ==================================================================
  // HONESTY: banks CUT debit-card lounge access hard across 2024-25. Most now
  // need a prior-period spend (e.g. ₹25k-₹75k/quarter) or charge per visit, and
  // some removed it entirely. So most debit entries are confidence "low" with a
  // loud verify note. Debit cards are EASIEST to get (you just need the bank
  // account) so ease=5 / approvalSpeed instant-fast. type:"debit".

  { id: "rupay-select-debit", name: "RuPay Select Debit (any bank)", issuer: "Various", network: "rupay", type: "debit",
    domesticVisits: 2, period: "quarter", spendGate: null, programs: ["rupay", "dreamfolks"], railway: true,
    ease: 5, ltf: false, fyf: false, approvalSpeed: "instant", eligibility: "Just need the bank account; issued with savings account.",
    feeNote: "RuPay Select DEBIT tier: ~2 domestic/quarter + railway. The easiest lounge access that exists.",
    confidence: "med", verify: "rupay.co.in debit lounge program + your bank" },
  { id: "rupay-platinum-debit", name: "RuPay Platinum Debit (any bank)", issuer: "Various", network: "rupay", type: "debit",
    domesticVisits: 2, period: "year", spendGate: null, programs: ["rupay", "dreamfolks"], railway: true,
    ease: 5, ltf: false, fyf: false, approvalSpeed: "instant", eligibility: "Common on basic savings accounts.",
    feeNote: "Lower allowance than Select. Often 1/quarter or 2/year.", confidence: "low", verify: "issuing bank debit T&C" },

  { id: "sbi-platinum-debit", name: "SBI Platinum Debit", issuer: "SBI", network: "visa", type: "debit",
    domesticVisits: 2, period: "quarter", spendGate: { amount: 75000, per: "quarter", note: "SBI added a prior-quarter spend requirement for debit lounge access." },
    programs: ["dreamfolks", "visa", "mastercard"], railway: false, ease: 5, ltf: false, fyf: false, approvalSpeed: "instant",
    eligibility: "Issued with eligible SBI savings account.", feeNote: "Annual debit fee applies. Lounge now spend-gated.",
    confidence: "low", verify: "sbi.co.in debit card lounge T&C (changed 2024-25)" },
  { id: "sbi-vishesh-debit", name: "SBI Vishesh / Yuva Debit", issuer: "SBI", network: "mastercard", type: "debit",
    domesticVisits: 1, period: "quarter", spendGate: { amount: 50000, per: "quarter", note: "Spend-gated debit lounge." },
    programs: ["dreamfolks", "mastercard"], railway: false, ease: 5, ltf: false, fyf: false, approvalSpeed: "instant",
    eligibility: "SBI account holders.", feeNote: "Spend-gated debit lounge.", confidence: "low", verify: "sbi.co.in" },

  { id: "hdfc-millennia-debit", name: "HDFC Millennia Debit", issuer: "HDFC", network: "mastercard", type: "debit",
    domesticVisits: 1, period: "quarter", spendGate: { amount: 75000, per: "quarter", note: "HDFC debit lounge requires prior-quarter spend." },
    programs: ["dreamfolks", "mastercard"], railway: false, ease: 5, ltf: false, fyf: false, approvalSpeed: "instant",
    eligibility: "HDFC savings account.", feeNote: "Spend-gated debit lounge.", confidence: "low", verify: "hdfcbank.com debit T&C" },
  { id: "hdfc-imperia-debit", name: "HDFC Imperia / Times Debit", issuer: "HDFC", network: "visa", type: "debit",
    domesticVisits: 1, period: "quarter", spendGate: null, programs: ["dreamfolks", "visa"], railway: false,
    ease: 4, ltf: false, fyf: false, approvalSpeed: "instant", eligibility: "Imperia banking relationship.",
    feeNote: "Premium debit; lounge tied to relationship tier.", confidence: "low", verify: "hdfcbank.com" },

  { id: "icici-coral-debit", name: "ICICI Coral Debit", issuer: "ICICI", network: "visa", type: "debit",
    domesticVisits: 1, period: "quarter", spendGate: { amount: 50000, per: "quarter", note: "Debit lounge spend-gated on newer terms." },
    programs: ["dreamfolks", "visa"], railway: true, ease: 5, ltf: false, fyf: false, approvalSpeed: "instant",
    eligibility: "ICICI savings account.", feeNote: "Spend-gated debit lounge + railway.", confidence: "low", verify: "icici.com debit T&C" },
  { id: "icici-sapphiro-debit", name: "ICICI Sapphiro / Expressions Debit", issuer: "ICICI", network: "visa", type: "debit",
    domesticVisits: 2, period: "quarter", spendGate: { amount: 50000, per: "quarter", note: "Spend-gated." },
    programs: ["dreamfolks", "visa", "mastercard"], railway: true, ease: 4, ltf: false, fyf: false, approvalSpeed: "instant",
    eligibility: "Higher-tier ICICI account.", feeNote: "Spend-gated debit lounge + railway.", confidence: "low", verify: "icici.com" },

  { id: "axis-burgundy-debit", name: "Axis Burgundy Debit", issuer: "Axis", network: "visa", type: "debit",
    domesticVisits: "unlimited", period: "year", spendGate: null, programs: ["dreamfolks", "priority", "visa"], railway: true,
    ease: 3, ltf: false, fyf: false, approvalSpeed: "fast", eligibility: "Axis Burgundy banking (high balance/relationship).",
    feeNote: "Premium debit: domestic + Priority Pass + railway via Burgundy.", confidence: "low", verify: "axisbank.com Burgundy T&C" },
  { id: "axis-priority-debit", name: "Axis Priority / Delight Debit", issuer: "Axis", network: "visa", type: "debit",
    domesticVisits: 2, period: "quarter", spendGate: null, programs: ["dreamfolks", "visa"], railway: false,
    ease: 4, ltf: false, fyf: false, approvalSpeed: "instant", eligibility: "Priority banking / eligible account.",
    feeNote: "Domestic debit lounge.", confidence: "low", verify: "axisbank.com" },

  { id: "kotak-privy-debit", name: "Kotak Privy League Debit", issuer: "Kotak", network: "visa", type: "debit",
    domesticVisits: 2, period: "quarter", spendGate: null, programs: ["dreamfolks", "visa"], railway: false,
    ease: 4, ltf: false, fyf: false, approvalSpeed: "fast", eligibility: "Privy League banking relationship.",
    feeNote: "Premium debit lounge.", confidence: "low", verify: "kotak.com" },

  { id: "yes-debit", name: "YES Bank Premia / Prosperity Debit", issuer: "YES Bank", network: "mastercard", type: "debit",
    domesticVisits: 2, period: "quarter", spendGate: null, programs: ["dreamfolks", "mastercard"], railway: false,
    ease: 4, ltf: false, fyf: false, approvalSpeed: "instant", eligibility: "Eligible YES account.",
    feeNote: "Debit lounge on premium variants.", confidence: "low", verify: "yesbank.in" },

  { id: "federal-debit", name: "Federal Bank Imperio / Celesta Debit", issuer: "Federal Bank", network: "visa", type: "debit",
    domesticVisits: 2, period: "quarter", spendGate: null, programs: ["dreamfolks", "visa"], railway: true,
    ease: 4, ltf: false, fyf: false, approvalSpeed: "instant", eligibility: "Eligible Federal account.",
    feeNote: "Debit lounge + railway on premium variants.", confidence: "low", verify: "federalbank.co.in" },

  { id: "idbi-rupay-debit", name: "PSU RuPay Select Debit (SBI/BoB/PNB/Canara/Union)", issuer: "PSU banks", network: "rupay", type: "debit",
    domesticVisits: 2, period: "quarter", spendGate: null, programs: ["rupay", "dreamfolks"], railway: true,
    ease: 5, ltf: false, fyf: false, approvalSpeed: "instant", eligibility: "Any of these PSU savings accounts.",
    feeNote: "RuPay Select debit: domestic + railway. Easiest broad access.", confidence: "low", verify: "issuing PSU bank + rupay.co.in" },

  { id: "indusind-debit", name: "IndusInd Pioneer / Exclusive Debit", issuer: "IndusInd", network: "visa", type: "debit",
    domesticVisits: 2, period: "quarter", spendGate: null, programs: ["dreamfolks", "visa"], railway: false,
    ease: 4, ltf: false, fyf: false, approvalSpeed: "instant", eligibility: "Eligible IndusInd account.",
    feeNote: "Premium debit lounge.", confidence: "low", verify: "indusind.com" },

  { id: "dbs-debit", name: "DBS Treasures Debit", issuer: "DBS", network: "visa", type: "debit",
    domesticVisits: 2, period: "quarter", spendGate: null, programs: ["dreamfolks", "visa"], railway: false,
    ease: 3, ltf: false, fyf: false, approvalSpeed: "fast", eligibility: "DBS Treasures banking relationship.",
    feeNote: "Premium debit lounge.", confidence: "low", verify: "dbs.com/in" },

  // ==================================================================
  // ============  MORE CREDIT CARDS — co-brand + fintech  ============
  // ==================================================================
  // Travel co-brands, fintech cards, and newer variants. Most are confidence
  // "low" (not live-verified). Co-brand lounge benefits change with the airline/
  // partner deal, so verify especially after any merger (e.g. Vistara->Air India).

  // ---- Fintech / new-age (often free + lounge = great easy picks) ----
  { id: "scapia-federal", name: "Scapia (Federal Bank)", issuer: "Federal Bank", network: "visa",
    domesticVisits: 4, period: "year", spendGate: { amount: 5000, per: "month", note: "Lounge unlocks with small monthly spend (~₹5k) on most terms." },
    programs: ["dreamfolks", "visa"], railway: false, ease: 4, ltf: true, fyf: true, approvalSpeed: "fast",
    eligibility: "Popular free travel card; app-based, fast KYC.", feeNote: "Lifetime free. Domestic lounge + zero forex. Strong easy pick.",
    confidence: "low", verify: "scapia.in" },
  { id: "onecard", name: "OneCard (metal)", issuer: "BoB / SBM / Federal", network: "visa",
    domesticVisits: 0, period: "year", spendGate: null, programs: [], railway: false, ease: 4, ltf: true, fyf: true, approvalSpeed: "fast",
    eligibility: "App-based metal card, fast approval.", feeNote: "Lifetime free. No standard lounge — baseline (verify current offers).",
    confidence: "low", verify: "getonecard.app" },
  { id: "jupiter-edge", name: "Jupiter Edge (CSB/Federal)", issuer: "Federal/CSB", network: "visa",
    domesticVisits: 0, period: "year", spendGate: null, programs: [], railway: false, ease: 4, ltf: true, fyf: true, approvalSpeed: "fast",
    eligibility: "Neobank card.", feeNote: "No lounge on base — baseline.", confidence: "low", verify: "jupiter.money" },
  { id: "idfc-swyp", name: "IDFC FIRST SWYP", issuer: "IDFC FIRST", network: "rupay",
    domesticVisits: 0, period: "year", spendGate: null, programs: [], railway: false, ease: 5, ltf: false, fyf: true, approvalSpeed: "fast",
    eligibility: "EMI-first card, easy.", feeNote: "No lounge — baseline.", confidence: "low", verify: "idfcfirstbank.com" },

  // ---- HDFC co-brands ----
  { id: "hdfc-6e-indigo", name: "6E Rewards IndiGo HDFC (XL)", issuer: "HDFC", network: "visa",
    domesticVisits: 8, period: "year", spendGate: null, programs: ["dreamfolks", "visa"], railway: false,
    ease: 3, ltf: false, fyf: false, approvalSpeed: "normal", eligibility: "IndiGo flyer co-brand; XL variant has lounge.",
    feeNote: "XL variant: domestic lounge + IndiGo benefits.", confidence: "low", verify: "hdfcbank.com" },
  { id: "hdfc-tataneu-plus", name: "Tata Neu Plus HDFC", issuer: "HDFC", network: "rupay",
    domesticVisits: 4, period: "year", spendGate: null, programs: ["dreamfolks", "rupay"], railway: false,
    ease: 4, ltf: false, fyf: true, approvalSpeed: "normal", eligibility: "Entry Tata Neu; RuPay works on UPI.",
    feeNote: "₹499. Some domestic lounge on RuPay tier.", confidence: "low", verify: "hdfcbank.com" },
  { id: "hdfc-indianoil", name: "IndianOil HDFC", issuer: "HDFC", network: "rupay",
    domesticVisits: 0, period: "year", spendGate: null, programs: [], railway: false, ease: 4, ltf: false, fyf: true, approvalSpeed: "normal",
    eligibility: "Fuel co-brand.", feeNote: "Fuel rewards; no standard lounge — baseline.", confidence: "low", verify: "hdfcbank.com" },
  { id: "hdfc-pixel", name: "HDFC Pixel Play", issuer: "HDFC", network: "visa",
    domesticVisits: 0, period: "year", spendGate: null, programs: [], railway: false, ease: 4, ltf: false, fyf: true, approvalSpeed: "fast",
    eligibility: "Digital-first card.", feeNote: "No lounge on base — baseline.", confidence: "low", verify: "hdfcbank.com" },

  // ---- Axis co-brands ----
  { id: "axis-indianoil", name: "IndianOil Axis", issuer: "Axis", network: "visa",
    domesticVisits: 0, period: "year", spendGate: null, programs: [], railway: false, ease: 4, ltf: false, fyf: true, approvalSpeed: "fast",
    eligibility: "Fuel co-brand.", feeNote: "No standard lounge — baseline.", confidence: "low", verify: "axisbank.com" },
  { id: "axis-airtel", name: "Airtel Axis", issuer: "Axis", network: "mastercard",
    domesticVisits: 0, period: "year", spendGate: null, programs: [], railway: false, ease: 4, ltf: false, fyf: true, approvalSpeed: "fast",
    eligibility: "Utility cashback co-brand.", feeNote: "No lounge — baseline.", confidence: "low", verify: "axisbank.com" },
  { id: "axis-horizon", name: "Axis Horizon", issuer: "Axis", network: "visa",
    domesticVisits: 8, period: "year", spendGate: null, programs: ["dreamfolks", "priority", "visa"], railway: false,
    ease: 3, ltf: false, fyf: false, approvalSpeed: "normal", eligibility: "Travel/miles card.",
    feeNote: "Domestic + international lounge, travel miles.", confidence: "low", verify: "axisbank.com" },
  { id: "axis-samsung", name: "Axis Samsung (Infinite/Signature)", issuer: "Axis", network: "visa",
    domesticVisits: 8, period: "year", spendGate: null, programs: ["dreamfolks", "priority", "visa"], railway: false,
    ease: 3, ltf: false, fyf: false, approvalSpeed: "normal", eligibility: "Samsung co-brand; Infinite tier has lounge.",
    feeNote: "Infinite variant: domestic + Priority Pass.", confidence: "low", verify: "axisbank.com" },

  // ---- SBI co-brands ----
  { id: "sbi-air-india", name: "SBI Air India Platinum/Signature", issuer: "SBI", network: "visa",
    domesticVisits: 8, period: "year", spendGate: null, programs: ["dreamfolks", "priority", "visa"], railway: false,
    ease: 3, ltf: false, fyf: false, approvalSpeed: "normal", eligibility: "Air India flyer co-brand.",
    feeNote: "Signature tier: domestic + Priority Pass.", confidence: "low", verify: "sbicard.com" },
  { id: "sbi-irctc", name: "SBI IRCTC (Premier)", issuer: "SBI", network: "rupay",
    domesticVisits: 4, period: "year", spendGate: null, programs: ["dreamfolks", "rupay"], railway: true,
    ease: 4, ltf: false, fyf: true, approvalSpeed: "normal", eligibility: "Rail traveller co-brand; RuPay.",
    feeNote: "Railway lounge focus + some airport.", confidence: "low", verify: "sbicard.com" },
  { id: "sbi-bpcl-octane", name: "SBI BPCL Octane", issuer: "SBI", network: "visa",
    domesticVisits: 4, period: "year", spendGate: null, programs: ["dreamfolks", "visa"], railway: false,
    ease: 3, ltf: false, fyf: false, approvalSpeed: "normal", eligibility: "Fuel premium co-brand.",
    feeNote: "₹1499. Some domestic lounge + fuel rewards.", confidence: "low", verify: "sbicard.com" },
  { id: "sbi-miles", name: "SBI Miles / Miles Elite", issuer: "SBI", network: "visa",
    domesticVisits: 8, period: "year", spendGate: null, programs: ["dreamfolks", "priority", "visa"], railway: false,
    ease: 3, ltf: false, fyf: false, approvalSpeed: "normal", eligibility: "Newer travel-miles series.",
    feeNote: "Travel card: domestic + Priority Pass on higher tier.", confidence: "low", verify: "sbicard.com" },

  // ---- ICICI co-brands / new ----
  { id: "icici-mmt", name: "MakeMyTrip ICICI (Signature)", issuer: "ICICI", network: "visa",
    domesticVisits: 8, period: "year", spendGate: null, programs: ["dreamfolks", "priority", "visa"], railway: false,
    ease: 3, ltf: false, fyf: false, approvalSpeed: "normal", eligibility: "Travel co-brand.",
    feeNote: "Signature: domestic + Priority Pass + travel vouchers.", confidence: "low", verify: "icici.com" },
  { id: "icici-times-black", name: "ICICI Times Black", issuer: "ICICI", network: "visa",
    domesticVisits: "unlimited", period: "year", spendGate: null, programs: ["dreamfolks", "priority", "visa"], railway: true,
    ease: 1, ltf: false, fyf: false, approvalSpeed: "slow", eligibility: "New super-premium, invite/HNW.",
    feeNote: "Premium. Unlimited domestic + Priority Pass + railway.", confidence: "low", verify: "icici.com" },

  // ---- IDFC new metal ----
  { id: "idfc-ashva", name: "IDFC FIRST Ashva (metal)", issuer: "IDFC FIRST", network: "visa",
    domesticVisits: 8, period: "year", spendGate: null, programs: ["dreamfolks", "priority", "visa"], railway: true,
    ease: 2, ltf: false, fyf: false, approvalSpeed: "normal", eligibility: "Newer premium metal.",
    feeNote: "Domestic + Priority Pass + railway.", confidence: "low", verify: "idfcfirstbank.com" },
  { id: "idfc-mayura", name: "IDFC FIRST Mayura (metal)", issuer: "IDFC FIRST", network: "visa",
    domesticVisits: "unlimited", period: "year", spendGate: null, programs: ["dreamfolks", "priority", "visa"], railway: true,
    ease: 1, ltf: false, fyf: false, approvalSpeed: "slow", eligibility: "Top IDFC metal, invite-led.",
    feeNote: "Unlimited domestic + Priority Pass + railway.", confidence: "low", verify: "idfcfirstbank.com" },

  // ---- HSBC / SC new travel ----
  { id: "hsbc-travelone", name: "HSBC TravelOne", issuer: "HSBC", network: "mastercard",
    domesticVisits: 6, period: "year", spendGate: null, programs: ["dreamfolks", "priority", "mastercard"], railway: false,
    ease: 3, ltf: false, fyf: false, approvalSpeed: "normal", eligibility: "Travel-miles card.",
    feeNote: "₹4999. Domestic + international lounge.", confidence: "low", verify: "hsbc.co.in" },
  { id: "sc-easemytrip", name: "Standard Chartered EaseMyTrip", issuer: "Standard Chartered", network: "mastercard",
    domesticVisits: 4, period: "year", spendGate: null, programs: ["dreamfolks", "mastercard"], railway: false,
    ease: 3, ltf: false, fyf: true, approvalSpeed: "normal", eligibility: "Travel co-brand.",
    feeNote: "Domestic lounge + travel discounts.", confidence: "low", verify: "sc.com/in" },

  // ---- AU / Kotak / IndusInd more ----
  { id: "au-lit", name: "AU LIT (customisable)", issuer: "AU Small Finance", network: "visa",
    domesticVisits: 2, period: "quarter", spendGate: null, programs: ["dreamfolks", "visa"], railway: false,
    ease: 4, ltf: true, fyf: true, approvalSpeed: "fast", eligibility: "Feature-toggle card; turn lounge feature on.",
    feeNote: "Lifetime free base; pay only for features you enable (incl. lounge).", confidence: "low", verify: "aubank.in" },
  { id: "au-ixigo", name: "AU Ixigo", issuer: "AU Small Finance", network: "rupay",
    domesticVisits: 4, period: "year", spendGate: null, programs: ["dreamfolks", "rupay"], railway: true,
    ease: 4, ltf: false, fyf: true, approvalSpeed: "fast", eligibility: "Travel co-brand, RuPay (UPI).",
    feeNote: "Domestic + railway, travel rewards.", confidence: "low", verify: "aubank.in" },
  { id: "kotak-indianoil", name: "Kotak IndianOil", issuer: "Kotak", network: "visa",
    domesticVisits: 0, period: "year", spendGate: null, programs: [], railway: false, ease: 4, ltf: false, fyf: true, approvalSpeed: "fast",
    eligibility: "Fuel co-brand.", feeNote: "No standard lounge — baseline.", confidence: "low", verify: "kotak.com" },
  { id: "kotak-solitaire", name: "Kotak Solitaire", issuer: "Kotak", network: "mastercard",
    domesticVisits: 8, period: "year", spendGate: null, programs: ["dreamfolks", "priority", "mastercard"], railway: false,
    ease: 2, ltf: false, fyf: false, approvalSpeed: "normal", eligibility: "Premium banking relationship.",
    feeNote: "Domestic + Priority Pass.", confidence: "low", verify: "kotak.com" },
  { id: "indusind-eazydiner", name: "IndusInd EazyDiner", issuer: "IndusInd", network: "mastercard",
    domesticVisits: 4, period: "year", spendGate: null, programs: ["dreamfolks", "mastercard"], railway: false,
    ease: 3, ltf: false, fyf: true, approvalSpeed: "normal", eligibility: "Dining co-brand.",
    feeNote: "Domestic lounge + dining benefits.", confidence: "low", verify: "indusind.com" },
  { id: "indusind-tiger", name: "IndusInd Tiger / Avios", issuer: "IndusInd", network: "visa",
    domesticVisits: 8, period: "year", spendGate: null, programs: ["dreamfolks", "priority", "visa"], railway: false,
    ease: 3, ltf: true, fyf: false, approvalSpeed: "normal", eligibility: "Some LTF variants.",
    feeNote: "Domestic + Priority Pass.", confidence: "low", verify: "indusind.com" },

  // ---- RBL / BoB / PSU more ----
  { id: "rbl-irctc", name: "RBL IRCTC", issuer: "RBL", network: "rupay",
    domesticVisits: 2, period: "year", spendGate: null, programs: ["dreamfolks", "rupay"], railway: true,
    ease: 3, ltf: false, fyf: true, approvalSpeed: "normal", eligibility: "Rail co-brand.",
    feeNote: "Railway lounge + some airport.", confidence: "low", verify: "rblbank.com" },
  { id: "bob-premier", name: "Bank of Baroda Premier / Select", issuer: "Bank of Baroda", network: "visa",
    domesticVisits: 2, period: "quarter", spendGate: null, programs: ["dreamfolks", "visa"], railway: true,
    ease: 3, ltf: false, fyf: true, approvalSpeed: "normal", eligibility: "Mid income.",
    feeNote: "Domestic + railway.", confidence: "low", verify: "bobcard.co.in" },
  { id: "canara-rupay-cc", name: "Canara / PNB RuPay Select Credit", issuer: "PSU banks", network: "rupay",
    domesticVisits: 2, period: "quarter", spendGate: null, programs: ["rupay", "dreamfolks"], railway: true,
    ease: 4, ltf: false, fyf: true, approvalSpeed: "normal", eligibility: "PSU bank customers.",
    feeNote: "RuPay Select credit: domestic + railway.", confidence: "low", verify: "issuing PSU bank T&C" },

  // ---- Amex more ----
  { id: "amex-smartearn", name: "Amex SmartEarn", issuer: "Amex", network: "amex",
    domesticVisits: 0, period: "year", spendGate: null, programs: [], railway: false, ease: 3, ltf: false, fyf: true, approvalSpeed: "slow",
    eligibility: "Entry Amex.", feeNote: "₹495. No lounge — baseline.", confidence: "low", verify: "americanexpress.com/in" },
  { id: "amex-plat-reserve", name: "Amex Platinum Reserve", issuer: "Amex", network: "amex",
    domesticVisits: 8, period: "year", spendGate: null, programs: ["dreamfolks", "priority"], railway: false,
    ease: 2, ltf: false, fyf: false, approvalSpeed: "slow", eligibility: "Premium.",
    feeNote: "₹10,000. Domestic + Priority Pass.", confidence: "low", verify: "americanexpress.com/in" },

  // ==================================================================
  // ============  MORE DEBIT CARDS — PSU + premium tiers  ============
  // ==================================================================
  // PSU banks issue the bulk of India's debit cards. Most lounge access on debit
  // is now spend-gated or pay-per-use after the 2024-25 cuts. All confidence "low".

  { id: "pnb-rupay-select-debit", name: "PNB RuPay Select Debit", issuer: "Punjab National Bank", network: "rupay", type: "debit",
    domesticVisits: 2, period: "quarter", spendGate: null, programs: ["rupay", "dreamfolks"], railway: true,
    ease: 5, ltf: false, fyf: false, approvalSpeed: "instant", eligibility: "PNB savings account.",
    feeNote: "RuPay Select debit: domestic + railway.", confidence: "low", verify: "pnbindia.in" },
  { id: "canara-rupay-select-debit", name: "Canara RuPay Select Debit", issuer: "Canara Bank", network: "rupay", type: "debit",
    domesticVisits: 2, period: "quarter", spendGate: null, programs: ["rupay", "dreamfolks"], railway: true,
    ease: 5, ltf: false, fyf: false, approvalSpeed: "instant", eligibility: "Canara savings account.",
    feeNote: "RuPay Select debit: domestic + railway.", confidence: "low", verify: "canarabank.com" },
  { id: "union-rupay-select-debit", name: "Union Bank RuPay Select Debit", issuer: "Union Bank", network: "rupay", type: "debit",
    domesticVisits: 2, period: "quarter", spendGate: null, programs: ["rupay", "dreamfolks"], railway: true,
    ease: 5, ltf: false, fyf: false, approvalSpeed: "instant", eligibility: "Union Bank savings account.",
    feeNote: "RuPay Select debit: domestic + railway.", confidence: "low", verify: "unionbankofindia.co.in" },
  { id: "bob-world-debit", name: "Bank of Baroda World Debit", issuer: "Bank of Baroda", network: "visa", type: "debit",
    domesticVisits: 2, period: "quarter", spendGate: { amount: 50000, per: "quarter", note: "Spend-gated debit lounge." },
    programs: ["dreamfolks", "visa", "mastercard"], railway: false, ease: 5, ltf: false, fyf: false, approvalSpeed: "instant",
    eligibility: "BoB savings account.", feeNote: "World debit; spend-gated lounge.", confidence: "low", verify: "bankofbaroda.in" },
  { id: "idbi-visa-signature-debit", name: "IDBI Visa Signature Debit", issuer: "IDBI Bank", network: "visa", type: "debit",
    domesticVisits: 2, period: "quarter", spendGate: null, programs: ["dreamfolks", "visa"], railway: false,
    ease: 5, ltf: false, fyf: false, approvalSpeed: "instant", eligibility: "IDBI savings account.",
    feeNote: "Signature debit lounge.", confidence: "low", verify: "idbibank.in" },
  { id: "indianbank-rupay-debit", name: "Indian Bank RuPay Select Debit", issuer: "Indian Bank", network: "rupay", type: "debit",
    domesticVisits: 2, period: "quarter", spendGate: null, programs: ["rupay", "dreamfolks"], railway: true,
    ease: 5, ltf: false, fyf: false, approvalSpeed: "instant", eligibility: "Indian Bank savings account.",
    feeNote: "RuPay Select debit: domestic + railway.", confidence: "low", verify: "indianbank.in" },
  { id: "boi-rupay-debit", name: "Bank of India RuPay Select Debit", issuer: "Bank of India", network: "rupay", type: "debit",
    domesticVisits: 2, period: "quarter", spendGate: null, programs: ["rupay", "dreamfolks"], railway: true,
    ease: 5, ltf: false, fyf: false, approvalSpeed: "instant", eligibility: "BoI savings account.",
    feeNote: "RuPay Select debit: domestic + railway.", confidence: "low", verify: "bankofindia.co.in" },
  { id: "centralbank-rupay-debit", name: "Central Bank RuPay Select Debit", issuer: "Central Bank of India", network: "rupay", type: "debit",
    domesticVisits: 2, period: "quarter", spendGate: null, programs: ["rupay", "dreamfolks"], railway: true,
    ease: 5, ltf: false, fyf: false, approvalSpeed: "instant", eligibility: "Central Bank savings account.",
    feeNote: "RuPay Select debit: domestic + railway.", confidence: "low", verify: "centralbankofindia.co.in" },
  { id: "rbl-debit", name: "RBL Signature / World Debit", issuer: "RBL", network: "mastercard", type: "debit",
    domesticVisits: 2, period: "quarter", spendGate: null, programs: ["dreamfolks", "mastercard"], railway: false,
    ease: 4, ltf: false, fyf: false, approvalSpeed: "instant", eligibility: "RBL savings account.",
    feeNote: "Premium debit lounge.", confidence: "low", verify: "rblbank.com" },
  { id: "idfc-first-debit", name: "IDFC FIRST Visa Signature Debit", issuer: "IDFC FIRST", network: "visa", type: "debit",
    domesticVisits: 4, period: "year", spendGate: null, programs: ["dreamfolks", "visa"], railway: true,
    ease: 4, ltf: false, fyf: false, approvalSpeed: "instant", eligibility: "IDFC FIRST savings account.",
    feeNote: "Signature debit: domestic + railway.", confidence: "low", verify: "idfcfirstbank.com" },
  { id: "au-debit", name: "AU Bank Visa Signature Debit", issuer: "AU Small Finance", network: "visa", type: "debit",
    domesticVisits: 2, period: "quarter", spendGate: null, programs: ["dreamfolks", "visa"], railway: true,
    ease: 4, ltf: false, fyf: false, approvalSpeed: "instant", eligibility: "AU savings account.",
    feeNote: "Signature debit: domestic + railway.", confidence: "low", verify: "aubank.in" },
  { id: "standard-chartered-debit", name: "Standard Chartered Visa Debit", issuer: "Standard Chartered", network: "visa", type: "debit",
    domesticVisits: 2, period: "quarter", spendGate: null, programs: ["dreamfolks", "visa"], railway: false,
    ease: 3, ltf: false, fyf: false, approvalSpeed: "fast", eligibility: "SC savings account.",
    feeNote: "Premium debit lounge.", confidence: "low", verify: "sc.com/in" },
  { id: "hsbc-debit", name: "HSBC Premier Debit", issuer: "HSBC", network: "visa", type: "debit",
    domesticVisits: 2, period: "quarter", spendGate: null, programs: ["dreamfolks", "visa"], railway: false,
    ease: 3, ltf: false, fyf: false, approvalSpeed: "fast", eligibility: "HSBC Premier relationship.",
    feeNote: "Premier debit lounge.", confidence: "low", verify: "hsbc.co.in" },
  { id: "kotak-811-debit", name: "Kotak 811 / Visa Debit", issuer: "Kotak", network: "visa", type: "debit",
    domesticVisits: 1, period: "quarter", spendGate: { amount: 50000, per: "quarter", note: "Spend-gated on lower-tier debit." },
    programs: ["dreamfolks", "visa"], railway: false, ease: 5, ltf: false, fyf: false, approvalSpeed: "instant",
    eligibility: "Kotak 811 digital account.", feeNote: "Spend-gated debit lounge.", confidence: "low", verify: "kotak.com" },

  // ==================================================================
  // ======  DISCONTINUED / LEGACY CREDIT CARDS (history)  ============
  // ==================================================================
  // You asked for cards from "day 1", including ones no longer issued. These are
  // flagged discontinued:true and named "(discontinued)" so they show clearly.
  // Terms here are HISTORICAL, confidence "low" — you cannot apply for most of
  // these today. Kept so older holders can still check, and for completeness.
  // Big events baked in: Citi retail sold to Axis (2023); Vistara merged into
  // Air India (Nov 2024); Jet Airways defunct (2019); ABN Amro / Barclays /
  // Deutsche exited India retail cards.

  // ---- Citibank (portfolio migrated to Axis Bank, 2023) ----
  { id: "citi-prestige", name: "Citi Prestige (discontinued)", issuer: "Citi (now Axis)", network: "mastercard", discontinued: true,
    domesticVisits: "unlimited", period: "year", spendGate: null, programs: ["priority", "mastercard"], railway: false,
    ease: 1, ltf: false, fyf: false, approvalSpeed: "slow", eligibility: "Was invite/HNW. Migrated to Axis; new applications closed.",
    feeNote: "Was ~₹20,000. Unlimited Priority Pass incl guest. Historical.", confidence: "low", verify: "axisbank.com (Citi migration)" },
  { id: "citi-premiermiles", name: "Citi PremierMiles (discontinued)", issuer: "Citi (now Axis)", network: "visa", discontinued: true,
    domesticVisits: 4, period: "year", spendGate: null, programs: ["dreamfolks", "priority", "visa"], railway: false,
    ease: 3, ltf: false, fyf: false, approvalSpeed: "slow", eligibility: "Popular travel card; folded into Axis lineup.",
    feeNote: "Was ₹3000. Domestic + Priority Pass. Historical terms.", confidence: "low", verify: "axisbank.com (Citi migration)" },
  { id: "citi-rewards", name: "Citi Rewards (discontinued)", issuer: "Citi (now Axis)", network: "visa", discontinued: true,
    domesticVisits: 0, period: "year", spendGate: null, programs: [], railway: false, ease: 3, ltf: false, fyf: false, approvalSpeed: "slow",
    eligibility: "Rewards card, no lounge. Migrated to Axis.", feeNote: "No lounge — baseline. Historical.", confidence: "low", verify: "axisbank.com" },
  { id: "citi-cashback", name: "Citi Cashback (discontinued)", issuer: "Citi (now Axis)", network: "visa", discontinued: true,
    domesticVisits: 0, period: "year", spendGate: null, programs: [], railway: false, ease: 3, ltf: false, fyf: false, approvalSpeed: "slow",
    eligibility: "Cashback card, no lounge.", feeNote: "No lounge — baseline. Historical.", confidence: "low", verify: "axisbank.com" },
  { id: "citi-ultima", name: "Citi Ultima (discontinued)", issuer: "Citi (now Axis)", network: "visa", discontinued: true,
    domesticVisits: "unlimited", period: "year", spendGate: null, programs: ["priority", "visa"], railway: false,
    ease: 1, ltf: false, fyf: false, approvalSpeed: "slow", eligibility: "Was top invite-only Citi card.",
    feeNote: "Unlimited Priority Pass. Historical.", confidence: "low", verify: "axisbank.com" },
  { id: "citi-indianoil", name: "Citi IndianOil (discontinued)", issuer: "Citi (now Axis)", network: "visa", discontinued: true,
    domesticVisits: 0, period: "year", spendGate: null, programs: [], railway: false, ease: 3, ltf: false, fyf: false, approvalSpeed: "slow",
    eligibility: "Fuel co-brand, no lounge.", feeNote: "No lounge — baseline. Historical.", confidence: "low", verify: "axisbank.com" },

  // ---- Jet Airways co-brands (airline defunct 2019) ----
  { id: "jet-citi", name: "Jet Airways Citi (discontinued)", issuer: "Citi", network: "visa", discontinued: true,
    domesticVisits: 4, period: "year", spendGate: null, programs: ["priority", "visa"], railway: false,
    ease: 2, ltf: false, fyf: false, approvalSpeed: "slow", eligibility: "Jet defunct 2019; card discontinued.",
    feeNote: "Was domestic + Priority Pass. Dead airline. Historical only.", confidence: "low", verify: "n/a — airline defunct" },
  { id: "jet-hdfc-intermiles", name: "InterMiles / JetPrivilege HDFC (discontinued)", issuer: "HDFC", network: "diners", discontinued: true,
    domesticVisits: 8, period: "year", spendGate: null, programs: ["dreamfolks", "priority", "diners"], railway: false,
    ease: 2, ltf: false, fyf: false, approvalSpeed: "slow", eligibility: "Rebranded InterMiles after Jet collapse; programme wound down.",
    feeNote: "Was domestic + Priority Pass. Historical.", confidence: "low", verify: "hdfcbank.com" },

  // ---- Vistara co-brands (Vistara merged into Air India Nov 2024) ----
  { id: "axis-vistara-infinite-legacy", name: "Axis Vistara Infinite (legacy, merger)", issuer: "Axis", network: "visa", discontinued: true,
    domesticVisits: "unlimited", period: "year", spendGate: null, programs: ["dreamfolks", "priority", "visa"], railway: false,
    ease: 2, ltf: false, fyf: false, approvalSpeed: "slow", eligibility: "Vistara merged into Air India; benefits transitioning.",
    feeNote: "Was unlimited domestic + Priority Pass. Verify post-merger status.", confidence: "low", verify: "axisbank.com (Air India-Vistara merger)" },
  { id: "sbi-club-vistara-legacy", name: "Club Vistara SBI (legacy, merger)", issuer: "SBI", network: "visa", discontinued: true,
    domesticVisits: 8, period: "year", spendGate: null, programs: ["dreamfolks", "priority", "visa"], railway: false,
    ease: 3, ltf: false, fyf: false, approvalSpeed: "normal", eligibility: "Vistara merged; programme transitioning to Air India.",
    feeNote: "Was domestic + Priority Pass. Verify post-merger.", confidence: "low", verify: "sbicard.com" },
  { id: "idfc-club-vistara-legacy", name: "Club Vistara IDFC FIRST (legacy, merger)", issuer: "IDFC FIRST", network: "visa", discontinued: true,
    domesticVisits: 8, period: "year", spendGate: null, programs: ["dreamfolks", "priority", "visa"], railway: false,
    ease: 3, ltf: false, fyf: false, approvalSpeed: "normal", eligibility: "Vistara merged into Air India.",
    feeNote: "Was domestic + Priority Pass. Verify post-merger.", confidence: "low", verify: "idfcfirstbank.com" },

  // ---- HDFC legacy lines (replaced by newer variants) ----
  { id: "hdfc-regalia-classic", name: "HDFC Regalia (original, legacy)", issuer: "HDFC", network: "visa", discontinued: true,
    domesticVisits: 12, period: "year", spendGate: null, programs: ["dreamfolks", "priority", "visa"], railway: false,
    ease: 3, ltf: false, fyf: false, approvalSpeed: "normal", eligibility: "Replaced by Regalia Gold.",
    feeNote: "Was domestic + Priority Pass. Use Regalia Gold now.", confidence: "low", verify: "hdfcbank.com" },
  { id: "hdfc-diners-rewardz", name: "HDFC Diners Club Rewardz (legacy)", issuer: "HDFC", network: "diners", discontinued: true,
    domesticVisits: 6, period: "year", spendGate: null, programs: ["dreamfolks", "diners"], railway: false,
    ease: 3, ltf: false, fyf: false, approvalSpeed: "normal", eligibility: "Lower Diners line, largely retired.",
    feeNote: "Was some domestic lounge. Historical.", confidence: "low", verify: "hdfcbank.com" },
  { id: "hdfc-world-mastercard-legacy", name: "HDFC World MasterCard (legacy)", issuer: "HDFC", network: "mastercard", discontinued: true,
    domesticVisits: 4, period: "year", spendGate: null, programs: ["dreamfolks", "mastercard"], railway: false,
    ease: 3, ltf: false, fyf: false, approvalSpeed: "normal", eligibility: "Older premium line.",
    feeNote: "Was domestic lounge. Historical.", confidence: "low", verify: "hdfcbank.com" },
  { id: "hdfc-solitaire-legacy", name: "HDFC Solitaire (legacy women's)", issuer: "HDFC", network: "visa", discontinued: true,
    domesticVisits: 0, period: "year", spendGate: null, programs: [], railway: false, ease: 3, ltf: false, fyf: false, approvalSpeed: "normal",
    eligibility: "Discontinued women's card.", feeNote: "No standard lounge — baseline. Historical.", confidence: "low", verify: "hdfcbank.com" },

  // ---- Foreign banks that exited India retail cards ----
  { id: "sc-manhattan-legacy", name: "Standard Chartered Manhattan (legacy)", issuer: "Standard Chartered", network: "mastercard", discontinued: true,
    domesticVisits: 0, period: "year", spendGate: null, programs: [], railway: false, ease: 3, ltf: false, fyf: false, approvalSpeed: "normal",
    eligibility: "Popular cashback card, discontinued.", feeNote: "No lounge — baseline. Historical.", confidence: "low", verify: "sc.com/in" },
  { id: "abn-amro-legacy", name: "ABN AMRO / RBS cards (exited India)", issuer: "ABN AMRO (exited)", network: "visa", discontinued: true,
    domesticVisits: 0, period: "year", spendGate: null, programs: [], railway: false, ease: 2, ltf: false, fyf: false, approvalSpeed: "slow",
    eligibility: "Bank exited Indian retail; cards long gone.", feeNote: "Historical only. No current access.", confidence: "low", verify: "n/a — bank exited" },
  { id: "barclays-legacy", name: "Barclays India cards (exited)", issuer: "Barclays (exited)", network: "visa", discontinued: true,
    domesticVisits: 0, period: "year", spendGate: null, programs: [], railway: false, ease: 2, ltf: false, fyf: false, approvalSpeed: "slow",
    eligibility: "Barclays exited Indian retail cards.", feeNote: "Historical only.", confidence: "low", verify: "n/a — bank exited" },
  { id: "deutsche-legacy", name: "Deutsche Bank India cards (legacy)", issuer: "Deutsche Bank (exited retail)", network: "visa", discontinued: true,
    domesticVisits: 0, period: "year", spendGate: null, programs: [], railway: false, ease: 2, ltf: false, fyf: false, approvalSpeed: "slow",
    eligibility: "Deutsche retail cards in India discontinued.", feeNote: "Historical only.", confidence: "low", verify: "n/a — exited retail" },

  // ---- ICICI / SBI / Kotak / Yes legacy ----
  { id: "icici-jet-airways-legacy", name: "ICICI Jet Airways (discontinued)", issuer: "ICICI", network: "visa", discontinued: true,
    domesticVisits: 4, period: "year", spendGate: null, programs: ["dreamfolks", "visa"], railway: false,
    ease: 3, ltf: false, fyf: false, approvalSpeed: "normal", eligibility: "Jet defunct 2019.",
    feeNote: "Was domestic lounge. Dead airline. Historical.", confidence: "low", verify: "n/a — airline defunct" },
  { id: "icici-instant-platinum-legacy", name: "ICICI Instant Platinum (legacy)", issuer: "ICICI", network: "visa", discontinued: true,
    domesticVisits: 0, period: "year", spendGate: null, programs: [], railway: false, ease: 4, ltf: true, fyf: true, approvalSpeed: "fast",
    eligibility: "FD-backed entry card, largely retired.", feeNote: "No lounge — baseline. Historical.", confidence: "low", verify: "icici.com" },
  { id: "sbi-yatra-legacy", name: "SBI Yatra (legacy)", issuer: "SBI", network: "visa", discontinued: true,
    domesticVisits: 4, period: "year", spendGate: null, programs: ["dreamfolks", "visa"], railway: false,
    ease: 3, ltf: false, fyf: false, approvalSpeed: "normal", eligibility: "Older travel co-brand.",
    feeNote: "Was domestic lounge. Historical.", confidence: "low", verify: "sbicard.com" },
  { id: "kotak-royale-legacy", name: "Kotak Royale Signature (legacy)", issuer: "Kotak", network: "visa", discontinued: true,
    domesticVisits: 4, period: "year", spendGate: null, programs: ["dreamfolks", "visa"], railway: false,
    ease: 3, ltf: false, fyf: false, approvalSpeed: "normal", eligibility: "Older Kotak premium line.",
    feeNote: "Was domestic lounge. Historical.", confidence: "low", verify: "kotak.com" },
  { id: "yes-first-exclusive-legacy", name: "YES First Exclusive (legacy, rebranded)", issuer: "YES Bank", network: "mastercard", discontinued: true,
    domesticVisits: "unlimited", period: "year", spendGate: null, programs: ["dreamfolks", "priority", "mastercard"], railway: false,
    ease: 2, ltf: false, fyf: false, approvalSpeed: "slow", eligibility: "Rebranded into Marquee/Reserv line.",
    feeNote: "Was unlimited domestic + Priority Pass. Use current YES premium.", confidence: "low", verify: "yesbank.in" },

  // ==================================================================
  // ==========  MORE CURRENT CREDIT VARIANTS (round-out)  ============
  // ==================================================================
  // Filling out current lineups across issuers so the list is closer to complete.
  // All confidence "low" unless otherwise noted (not live-verified this session).

  // ---- HDFC more ----
  { id: "swiggy-hdfc", name: "Swiggy HDFC", issuer: "HDFC", network: "mastercard",
    domesticVisits: 0, period: "year", spendGate: null, programs: [], railway: false, ease: 4, ltf: false, fyf: true, approvalSpeed: "fast",
    eligibility: "Food cashback co-brand.", feeNote: "₹500. No lounge — baseline.", confidence: "low", verify: "hdfcbank.com" },
  { id: "hdfc-shoppers-stop", name: "Shoppers Stop HDFC", issuer: "HDFC", network: "visa",
    domesticVisits: 0, period: "year", spendGate: null, programs: [], railway: false, ease: 4, ltf: false, fyf: true, approvalSpeed: "fast",
    eligibility: "Retail co-brand.", feeNote: "No lounge — baseline.", confidence: "low", verify: "hdfcbank.com" },
  { id: "hdfc-freedom", name: "HDFC Freedom", issuer: "HDFC", network: "visa",
    domesticVisits: 0, period: "year", spendGate: null, programs: [], railway: false, ease: 4, ltf: false, fyf: true, approvalSpeed: "fast",
    eligibility: "Entry rewards card.", feeNote: "No lounge — baseline.", confidence: "low", verify: "hdfcbank.com" },

  // ---- Axis more ----
  { id: "axis-olympus", name: "Axis Olympus", issuer: "Axis", network: "visa",
    domesticVisits: "unlimited", period: "year", spendGate: null, programs: ["dreamfolks", "priority", "visa"], railway: true,
    ease: 1, ltf: false, fyf: false, approvalSpeed: "slow", eligibility: "New super-premium (2024), invite-led.",
    feeNote: "Premium. Unlimited domestic + Priority Pass + railway.", confidence: "low", verify: "axisbank.com" },
  { id: "axis-privilege", name: "Axis Privilege", issuer: "Axis", network: "visa",
    domesticVisits: 8, period: "year", spendGate: null, programs: ["dreamfolks", "priority", "visa"], railway: false,
    ease: 3, ltf: false, fyf: false, approvalSpeed: "normal", eligibility: "Mid-tier rewards.",
    feeNote: "Domestic + Priority Pass.", confidence: "low", verify: "axisbank.com" },
  { id: "axis-neo", name: "Axis Neo", issuer: "Axis", network: "visa",
    domesticVisits: 0, period: "year", spendGate: null, programs: [], railway: false, ease: 5, ltf: false, fyf: true, approvalSpeed: "fast",
    eligibility: "Entry youth card.", feeNote: "₹250. No lounge — baseline.", confidence: "low", verify: "axisbank.com" },
  { id: "axis-lic", name: "LIC Axis (Signature)", issuer: "Axis", network: "rupay",
    domesticVisits: 4, period: "year", spendGate: null, programs: ["dreamfolks", "rupay"], railway: false,
    ease: 4, ltf: false, fyf: true, approvalSpeed: "normal", eligibility: "LIC co-brand, RuPay (UPI).",
    feeNote: "Signature tier: some domestic lounge.", confidence: "low", verify: "axisbank.com" },

  // ---- ICICI more ----
  { id: "icici-adani-one", name: "Adani One ICICI (Signature)", issuer: "ICICI", network: "visa",
    domesticVisits: 4, period: "year", spendGate: null, programs: ["dreamfolks", "visa"], railway: false,
    ease: 3, ltf: false, fyf: true, approvalSpeed: "normal", eligibility: "Adani One travel co-brand; useful at Adani-run airports.",
    feeNote: "Signature: domestic lounge + Adani airport perks.", confidence: "low", verify: "icici.com" },
  { id: "icici-emirates", name: "Emirates Skywards ICICI", issuer: "ICICI", network: "visa",
    domesticVisits: 8, period: "year", spendGate: null, programs: ["dreamfolks", "priority", "visa"], railway: false,
    ease: 2, ltf: false, fyf: false, approvalSpeed: "normal", eligibility: "Premium airline co-brand.",
    feeNote: "Domestic + Priority Pass + Skywards miles.", confidence: "low", verify: "icici.com" },
  { id: "icici-platinum-chip", name: "ICICI Platinum Chip", issuer: "ICICI", network: "visa",
    domesticVisits: 0, period: "year", spendGate: null, programs: [], railway: false, ease: 5, ltf: true, fyf: true, approvalSpeed: "fast",
    eligibility: "Entry lifetime-free card.", feeNote: "Lifetime free. No lounge — baseline.", confidence: "low", verify: "icici.com" },

  // ---- SBI more ----
  { id: "sbi-simplysave", name: "SBI SimplySAVE", issuer: "SBI", network: "visa",
    domesticVisits: 0, period: "year", spendGate: null, programs: [], railway: false, ease: 5, ltf: false, fyf: true, approvalSpeed: "normal",
    eligibility: "Entry everyday card.", feeNote: "₹499. No lounge — baseline.", confidence: "low", verify: "sbicard.com" },
  { id: "sbi-etihad", name: "Etihad Guest SBI (Premier)", issuer: "SBI", network: "visa",
    domesticVisits: 8, period: "year", spendGate: null, programs: ["dreamfolks", "priority", "visa"], railway: false,
    ease: 2, ltf: false, fyf: false, approvalSpeed: "normal", eligibility: "Airline co-brand.",
    feeNote: "Premier: domestic + Priority Pass + Etihad miles.", confidence: "low", verify: "sbicard.com" },
  { id: "sbi-apollo", name: "Apollo SBI", issuer: "SBI", network: "visa",
    domesticVisits: 0, period: "year", spendGate: null, programs: [], railway: false, ease: 4, ltf: false, fyf: true, approvalSpeed: "normal",
    eligibility: "Health co-brand.", feeNote: "No standard lounge — baseline.", confidence: "low", verify: "sbicard.com" },
  { id: "sbi-reliance", name: "Reliance SBI (Prime)", issuer: "SBI", network: "visa",
    domesticVisits: 4, period: "year", spendGate: null, programs: ["dreamfolks", "visa"], railway: false,
    ease: 3, ltf: false, fyf: true, approvalSpeed: "normal", eligibility: "Retail co-brand; Prime tier has lounge.",
    feeNote: "Prime tier: some domestic lounge.", confidence: "low", verify: "sbicard.com" },

  // ---- IDFC / Federal / AU / IndusInd / RBL more ----
  { id: "idfc-power", name: "IDFC FIRST Power (HPCL)", issuer: "IDFC FIRST", network: "visa",
    domesticVisits: 0, period: "year", spendGate: null, programs: [], railway: false, ease: 4, ltf: false, fyf: true, approvalSpeed: "fast",
    eligibility: "Fuel co-brand.", feeNote: "No standard lounge — baseline.", confidence: "low", verify: "idfcfirstbank.com" },
  { id: "idfc-millennia", name: "IDFC FIRST Millennia", issuer: "IDFC FIRST", network: "visa",
    domesticVisits: 4, period: "quarter", spendGate: { amount: 20000, per: "month", note: "Lounge tied to ~₹20k monthly spend on FIRST cards." },
    programs: ["dreamfolks", "visa"], railway: true, ease: 4, ltf: true, fyf: true, approvalSpeed: "fast",
    eligibility: "Entry FIRST card, lifetime-free variants.", feeNote: "Lifetime free. Spend-linked domestic + railway.", confidence: "low", verify: "idfcfirstbank.com" },
  { id: "federal-imperio", name: "Federal Bank Imperio (credit)", issuer: "Federal Bank", network: "visa",
    domesticVisits: 4, period: "year", spendGate: null, programs: ["dreamfolks", "visa"], railway: true,
    ease: 3, ltf: false, fyf: true, approvalSpeed: "normal", eligibility: "Mid income.",
    feeNote: "Domestic + railway.", confidence: "low", verify: "federalbank.co.in" },
  { id: "au-vetta", name: "AU Vetta", issuer: "AU Small Finance", network: "visa",
    domesticVisits: 8, period: "year", spendGate: null, programs: ["dreamfolks", "priority", "visa"], railway: true,
    ease: 3, ltf: false, fyf: false, approvalSpeed: "normal", eligibility: "Premium AU line.",
    feeNote: "Domestic + Priority Pass + railway.", confidence: "low", verify: "aubank.in" },
  { id: "au-nomo", name: "AU NoMo", issuer: "AU Small Finance", network: "visa",
    domesticVisits: 0, period: "year", spendGate: null, programs: [], railway: false, ease: 4, ltf: true, fyf: true, approvalSpeed: "fast",
    eligibility: "No-fee everyday card.", feeNote: "No lounge — baseline.", confidence: "low", verify: "aubank.in" },
  { id: "indusind-samman", name: "IndusInd Samman (RuPay)", issuer: "IndusInd", network: "rupay",
    domesticVisits: 2, period: "quarter", spendGate: null, programs: ["rupay", "dreamfolks"], railway: true,
    ease: 4, ltf: false, fyf: true, approvalSpeed: "normal", eligibility: "Govt-employee focused, RuPay (UPI).",
    feeNote: "RuPay: domestic + railway.", confidence: "low", verify: "indusind.com" },
  { id: "rbl-world-prime", name: "RBL World Prime / Insignia", issuer: "RBL", network: "mastercard",
    domesticVisits: "unlimited", period: "year", spendGate: null, programs: ["dreamfolks", "priority", "mastercard"], railway: false,
    ease: 2, ltf: false, fyf: false, approvalSpeed: "slow", eligibility: "RBL premium / invite.",
    feeNote: "Unlimited domestic + Priority Pass.", confidence: "low", verify: "rblbank.com" },

  // ---- Newer fintech / RuPay co-brands ----
  { id: "tiger-fi", name: "Fi / Federal co-brand", issuer: "Federal Bank", network: "visa",
    domesticVisits: 0, period: "year", spendGate: null, programs: [], railway: false, ease: 4, ltf: true, fyf: true, approvalSpeed: "fast",
    eligibility: "Neobank card.", feeNote: "No lounge — baseline.", confidence: "low", verify: "fi.money" },
  { id: "kiwi-rupay", name: "Kiwi (RuPay credit on UPI)", issuer: "Various", network: "rupay",
    domesticVisits: 0, period: "year", spendGate: null, programs: [], railway: false, ease: 4, ltf: true, fyf: true, approvalSpeed: "fast",
    eligibility: "App-based RuPay credit line for UPI.", feeNote: "No lounge — baseline. UPI spending focus.", confidence: "low", verify: "kiwi.com" },

  // ==================================================================
  // ==========  MORE DEBIT CARDS (remaining PSU + small fin)  ========
  // ==================================================================
  { id: "uco-rupay-debit", name: "UCO Bank RuPay Select Debit", issuer: "UCO Bank", network: "rupay", type: "debit",
    domesticVisits: 2, period: "quarter", spendGate: null, programs: ["rupay", "dreamfolks"], railway: true,
    ease: 5, ltf: false, fyf: false, approvalSpeed: "instant", eligibility: "UCO savings account.",
    feeNote: "RuPay Select debit: domestic + railway.", confidence: "low", verify: "ucobank.com" },
  { id: "iob-rupay-debit", name: "Indian Overseas Bank RuPay Select Debit", issuer: "Indian Overseas Bank", network: "rupay", type: "debit",
    domesticVisits: 2, period: "quarter", spendGate: null, programs: ["rupay", "dreamfolks"], railway: true,
    ease: 5, ltf: false, fyf: false, approvalSpeed: "instant", eligibility: "IOB savings account.",
    feeNote: "RuPay Select debit: domestic + railway.", confidence: "low", verify: "iob.in" },
  { id: "federal-rupay-select-debit", name: "Federal Bank RuPay Select Debit", issuer: "Federal Bank", network: "rupay", type: "debit",
    domesticVisits: 2, period: "quarter", spendGate: null, programs: ["rupay", "dreamfolks"], railway: true,
    ease: 5, ltf: false, fyf: false, approvalSpeed: "instant", eligibility: "Federal savings account.",
    feeNote: "RuPay Select debit: domestic + railway.", confidence: "low", verify: "federalbank.co.in" },
  { id: "dcb-rupay-debit", name: "DCB Bank RuPay Select Debit", issuer: "DCB Bank", network: "rupay", type: "debit",
    domesticVisits: 2, period: "quarter", spendGate: null, programs: ["rupay", "dreamfolks"], railway: true,
    ease: 5, ltf: false, fyf: false, approvalSpeed: "instant", eligibility: "DCB savings account.",
    feeNote: "RuPay Select debit: domestic + railway.", confidence: "low", verify: "dcbbank.com" },
];
