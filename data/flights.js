/*
 * LoungeLens / FlightLens — flight booking providers, deep links, and the
 * card / app / coupon discount layer (India domestic + international booking sites).
 *
 * HONESTY MODEL (same as the lounge data — read this):
 *  - A free static site CANNOT fetch live airfares (CORS + no server). So this
 *    does NOT store fake prices. Instead each provider has a real DEEP LINK that
 *    opens the actual live search on the real site, where you see the real fare.
 *  - linkType "prefilled" = route + date go straight into the URL (you land on
 *    results). "search-page" = opens the booking page, you type the dates (the
 *    airline uses POST search, no stable deep link).
 *  - Offers (card discount / app offer / coupon) are CONFIDENCE-TAGGED with a
 *    lastChecked date and a verify link. India bank offers rotate often, so an
 *    offer here describes the recurring mechanism; tap verify to confirm today's
 *    exact code + cap before you pay. NOTHING here is a guaranteed live price.
 *
 * URL placeholders the engine fills:
 *   {FROM} {TO}        IATA codes, upper (DEL, BOM)
 *   {FROM_L} {TO_L}    IATA codes, lower (del, bom)
 *   {DATE}             YYYY-MM-DD
 *   {DATE_YYMMDD}      260712
 *   {DATE_DDMMYYYY}    12/07/2026
 *   {DATE_TEXT}        12 Jul 2026  (url-encoded by the engine)
 */
window.LL_FLIGHTS = {
  // ---- airports for the route picker (major India + a few intl hubs) -------
  airports: [
    { code: "DEL", city: "Delhi" }, { code: "BOM", city: "Mumbai" },
    { code: "BLR", city: "Bengaluru" }, { code: "HYD", city: "Hyderabad" },
    { code: "MAA", city: "Chennai" }, { code: "CCU", city: "Kolkata" },
    { code: "GOI", city: "Goa (Dabolim)" }, { code: "GOX", city: "Goa (Mopa)" },
    { code: "COK", city: "Kochi" }, { code: "PNQ", city: "Pune" },
    { code: "AMD", city: "Ahmedabad" }, { code: "JAI", city: "Jaipur" },
    { code: "LKO", city: "Lucknow" }, { code: "PAT", city: "Patna" },
    { code: "GAU", city: "Guwahati" }, { code: "BBI", city: "Bhubaneswar" },
    { code: "IXC", city: "Chandigarh" }, { code: "SXR", city: "Srinagar" },
    { code: "TRV", city: "Thiruvananthapuram" }, { code: "CCJ", city: "Kozhikode" },
    { code: "VNS", city: "Varanasi" }, { code: "NAG", city: "Nagpur" },
    { code: "IXB", city: "Bagdogra" }, { code: "VTZ", city: "Visakhapatnam" },
    { code: "RPR", city: "Raipur" }, { code: "IDR", city: "Indore" },
    { code: "BHO", city: "Bhopal" }, { code: "ATQ", city: "Amritsar" },
    { code: "IXR", city: "Ranchi" }, { code: "IXM", city: "Madurai" },
    { code: "TIR", city: "Tirupati" }, { code: "RJA", city: "Rajahmundry" },
    { code: "DED", city: "Dehradun" }, { code: "JLR", city: "Jabalpur" },
    { code: "STV", city: "Surat" }, { code: "BDQ", city: "Vadodara" },
    { code: "IXZ", city: "Port Blair" }, { code: "DXB", city: "Dubai" },
    { code: "SIN", city: "Singapore" }, { code: "BKK", city: "Bangkok" },
    { code: "LHR", city: "London Heathrow" }, { code: "JFK", city: "New York JFK" },
  ],

  // ---- booking providers ---------------------------------------------------
  // type: meta (compares all, no booking) | airline (book direct) | ota
  providers: [
    {
      id: "google-flights", name: "Google Flights", type: "meta", linkType: "prefilled",
      url: "https://www.google.com/travel/flights?q=Flights%20from%20{FROM}%20to%20{TO}%20on%20{DATE}",
      note: "Sees every airline's fare at once, then sends you to book. Best first stop.",
      confidence: "high", verify: "google.com/travel/flights", offers: [],
    },
    {
      id: "ixigo-meta", name: "ixigo", type: "meta", linkType: "prefilled",
      url: "https://www.ixigo.com/search/result/flight?from={FROM}&to={TO}&date={DATE_DDMMYYYY_PLAIN}&adults=1&class=e",
      note: "India-first flight search + compare; opens straight to results for your route + date.",
      confidence: "high", verify: "ixigo.com/flights", offers: [],
    },
    {
      id: "indigo", name: "IndiGo (6E)", type: "airline", linkType: "search-page",
      url: "https://www.goindigo.in/",
      note: "Book direct, no OTA convenience fee. India's largest network.",
      confidence: "high", verify: "goindigo.in",
      offers: [
        { id: "indigo-hdfc", kind: "card", issuer: "HDFC", title: "HDFC bank card instant discount runs on 6E Rewards bookings", code: null, cap: "varies", terms: "Recurring HDFC tie-up; exact % and cap rotate. Confirm on the offers page.", confidence: "low", lastChecked: "2026-06-22", verify: "goindigo.in/offers.html" },
        { id: "indigo-6erewards", kind: "card", issuer: "Kotak", title: "Ka-ching 6E Rewards co-brand (Kotak) earns 6E points per booking", code: null, cap: "points, not cash", terms: "The IndiGo co-brand card. Points accrue, redeem on fares.", confidence: "med", lastChecked: "2026-06-22", verify: "goindigo.in/ka-ching.html" },
      ],
    },
    {
      id: "airindia", name: "Air India", type: "airline", linkType: "search-page",
      url: "https://www.airindia.com/",
      note: "Full-service, now includes the old Vistara network. Book direct for fewer fees.",
      confidence: "high", verify: "airindia.com",
      offers: [
        { id: "ai-sbi", kind: "card", issuer: "SBI", title: "Air India SBI co-brand earns reward points + tier perks", code: null, cap: "points", terms: "Co-brand card; points on AI bookings. Instant discounts rotate.", confidence: "low", lastChecked: "2026-06-22", verify: "airindia.com/in/en/about-air-india/special-offers.html" },
      ],
    },
    {
      id: "akasa", name: "Akasa Air (QP)", type: "airline", linkType: "search-page",
      url: "https://www.akasaair.com/",
      note: "Newer airline, growing metro + tier-2 network. Book direct.",
      confidence: "high", verify: "akasaair.com", offers: [],
    },
    {
      id: "spicejet", name: "SpiceJet (SG)", type: "airline", linkType: "search-page",
      url: "https://www.spicejet.com/",
      note: "Book direct. Network is smaller than it once was; check it still flies your route.",
      confidence: "med", verify: "spicejet.com", offers: [],
    },
    {
      id: "airindiaexpress", name: "Air India Express (IX)", type: "airline", linkType: "search-page",
      url: "https://www.airindiaexpress.com/",
      note: "Low-cost arm of Air India. Strong on Gulf + south-India routes.",
      confidence: "high", verify: "airindiaexpress.com", offers: [],
    },
    {
      id: "alliance", name: "Alliance Air (9I)", type: "airline", linkType: "search-page",
      url: "https://www.allianceair.in/",
      note: "Regional carrier, smaller airports (UDAN routes).",
      confidence: "med", verify: "allianceair.in", offers: [],
    },
    {
      id: "makemytrip", name: "MakeMyTrip", type: "ota", linkType: "prefilled",
      url: "https://www.makemytrip.com/flight/search?itinerary={FROM}-{TO}-{DATE}&tripType=O&paxType=A-1_C-0_I-0&cabinClass=E",
      note: "Big OTA. Runs the most bank instant-discount offers, but adds a convenience fee.",
      confidence: "med", verify: "makemytrip.com/promos/",
      offers: [
        { id: "mmt-hdfc", kind: "card", issuer: "HDFC", title: "HDFC card instant discount on domestic flights (recurring)", code: "MMTHDFC", cap: "up to a few hundred ₹", terms: "MMT runs a recurring HDFC offer; the code + cap change. Confirm on the offers page before you pay.", confidence: "low", lastChecked: "2026-06-22", verify: "makemytrip.com/promos/" },
        { id: "mmt-icici", kind: "card", issuer: "ICICI", title: "ICICI card flight discount (recurring)", code: null, cap: "varies", terms: "Recurring ICICI tie-up. Exact terms rotate.", confidence: "low", lastChecked: "2026-06-22", verify: "makemytrip.com/promos/" },
        { id: "mmt-mybiz", kind: "app", issuer: null, title: "App-only fares are often a bit cheaper than web", code: null, cap: "varies", terms: "MMT frequently prices the app lower. Worth a check.", confidence: "low", lastChecked: "2026-06-22", verify: "makemytrip.com" },
      ],
    },
    {
      id: "goibibo", name: "Goibibo", type: "ota", linkType: "search-page",
      url: "https://www.goibibo.com/flights/",
      note: "Same group as MakeMyTrip; sometimes different offers + 'gocash' wallet.",
      confidence: "med", verify: "goibibo.com/offers/",
      offers: [
        { id: "gi-axis", kind: "card", issuer: "Axis", title: "Axis card flight offer (recurring)", code: null, cap: "varies", terms: "Recurring Axis tie-up. Confirm current terms.", confidence: "low", lastChecked: "2026-06-22", verify: "goibibo.com/offers/" },
      ],
    },
    {
      id: "cleartrip", name: "Cleartrip", type: "ota", linkType: "search-page",
      url: "https://www.cleartrip.com/flights",
      note: "Owned by Flipkart. Often tied to Flipkart/Axis offers + 'Cleartrip for Business'.",
      confidence: "med", verify: "cleartrip.com/offers",
      offers: [
        { id: "ct-icici", kind: "card", issuer: "ICICI", title: "ICICI / Flipkart Axis card offers run here often", code: null, cap: "varies", terms: "Cleartrip + Flipkart ecosystem offers rotate. Confirm before paying.", confidence: "low", lastChecked: "2026-06-22", verify: "cleartrip.com/offers" },
      ],
    },
    {
      id: "easemytrip", name: "EaseMyTrip", type: "ota", linkType: "search-page",
      url: "https://www.easemytrip.com/flights/",
      note: "Often lower or zero convenience fee. Heavy on coupon codes.",
      confidence: "med", verify: "easemytrip.com/offers/",
      offers: [
        { id: "emt-coupon", kind: "coupon", issuer: null, title: "EaseMyTrip runs frequent flat-off domestic codes", code: "EMTDOM", cap: "varies", terms: "Codes rotate weekly; the offers page lists today's working ones.", confidence: "low", lastChecked: "2026-06-22", verify: "easemytrip.com/offers/" },
      ],
    },
    {
      id: "yatra", name: "Yatra", type: "ota", linkType: "search-page",
      url: "https://www.yatra.com/flights",
      note: "Long-running OTA; bank offers + eCash wallet.",
      confidence: "med", verify: "yatra.com/online/all-deals", offers: [],
    },
    {
      id: "ixigo", name: "ixigo", type: "ota", linkType: "search-page",
      url: "https://www.ixigo.com/flights",
      note: "Aggregates + books. 'assured' refund add-on; app-first pricing.",
      confidence: "med", verify: "ixigo.com/offers", offers: [],
    },
    {
      id: "paytm", name: "Paytm Travel", type: "ota", linkType: "search-page",
      url: "https://tickets.paytm.com/flights/",
      note: "Paytm wallet cashback offers; app-first.",
      confidence: "med", verify: "paytm.com/offer/flights/", offers: [],
    },
    {
      id: "happyfares", name: "HappyFares", type: "ota", linkType: "search-page",
      url: "https://www.happyfares.in/",
      note: "Smaller OTA, sometimes undercuts on domestic. Check reviews before paying.",
      confidence: "low", verify: "happyfares.in", offers: [],
    },
    {
      id: "adanione", name: "Adani One", type: "ota", linkType: "search-page",
      url: "https://www.adanione.com/flights",
      note: "Adani's travel app; bundles airport services at Adani-run airports.",
      confidence: "low", verify: "adanione.com", offers: [],
    },
  ],

  // ---- cross-provider coupons / offer mechanisms ---------------------------
  // NOT guaranteed-working codes (no free site can promise that). Each is a
  // known recurring mechanism, confidence-tagged, with where to confirm today.
  coupons: [
    { id: "cpn-bank-instant", title: "Bank instant-discount days", who: "HDFC / ICICI / Axis / SBI / Kotak", note: "OTAs run rotating 'instant discount with X bank card' offers, usually capped at a few hundred rupees on domestic. Check the OTA's offers page on booking day.", confidence: "med", lastChecked: "2026-06-22", verify: "the OTA's /offers or /promos page" },
    { id: "cpn-app-only", title: "App-only fares", who: "MakeMyTrip / ixigo / Paytm / EaseMyTrip", note: "Several OTAs price the mobile app a little under the website. Quick to check both.", confidence: "low", lastChecked: "2026-06-22", verify: "open the OTA app vs its website for the same search" },
    { id: "cpn-wallet", title: "Wallet / cashback stacking", who: "Paytm / Goibibo goCash / Yatra eCash", note: "Some OTAs let you stack a wallet cashback on top of a card offer. Read the cap.", confidence: "low", lastChecked: "2026-06-22", verify: "the OTA's wallet/cashback terms" },
    { id: "cpn-direct-vs-ota", title: "Book-direct can beat OTA after fees", who: "IndiGo / Air India / Akasa", note: "OTAs add a convenience fee. After a small card discount the airline's own site is sometimes cheaper. Compare both before paying.", confidence: "med", lastChecked: "2026-06-22", verify: "compare the airline site vs the OTA for the same flight" },
    { id: "cpn-fare-error", title: "Fare-error / glitch fares", who: "any airline or OTA", note: "Genuine mistake fares appear and vanish fast. A free static app cannot auto-detect them (needs a price-history server). Communities like deal forums and Telegram channels surface them; book fast and expect possible cancellation.", confidence: "low", lastChecked: "2026-06-22", verify: "deal communities — treat as not-yet-confirmed until ticketed" },
  ],

  lastReviewed: "2026-06-22",
};
