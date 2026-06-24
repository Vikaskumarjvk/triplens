/*
 * TripLens — on-trip essentials + local deals layer.
 * Cabs, intercity travel, eSIM/forex, dining, activities/attractions, and the
 * card / app / coupon discount mechanisms that recur on each.
 *
 * HONESTY MODEL (same as flights/hotels/lounges):
 *  - No fake prices. Each service has a real DEEP LINK to the live site/app.
 *  - Offers are CONFIDENCE-TAGGED with lastChecked + a verify link. They describe
 *    a RECURRING mechanism, not a guaranteed live code. Confirm before you pay.
 *  - linkType "prefilled" = the city goes into the URL. "search-page" = opens the
 *    app/site home (most cab/eSIM apps need GPS or login, no public deep link).
 *
 * URL placeholders the engine fills (see trip-engine.js buildDealLink):
 *   {CITY}   city name, url-encoded
 *   {CITY_L} city name lower, url-encoded
 */
window.LL_DEALS = {
  // category buckets the UI renders as sections
  categories: [
    { id: "cab", label: "🚕 Cabs & local rides", blurb: "Getting around the city — compare app prices, they differ a lot per ride." },
    { id: "intercity", label: "🚆 Intercity travel", blurb: "Trains, buses, self-drive between cities — often cheaper than a second flight." },
    { id: "connectivity", label: "📶 eSIM, data & forex", blurb: "Stay connected + spend abroad without the airport-counter markup." },
    { id: "dining", label: "🍽️ Dining & food deals", blurb: "Restaurant discounts and food-delivery offers while you travel." },
    { id: "activities", label: "🎟️ Things to do", blurb: "Attractions, tours and experiences — book ahead, skip queues, pay less." },
  ],

  // ---- services ------------------------------------------------------------
  // category matches a categories[].id. type is informational.
  services: [
    // ===== CABS =====
    {
      id: "uber", name: "Uber", category: "cab", type: "app", linkType: "search-page",
      url: "https://m.uber.com/",
      note: "Compare with Ola/Rapido on the same ride — the cheapest flips by city + time of day.",
      confidence: "high", verify: "uber.com",
      offers: [
        { id: "uber-card", kind: "card", issuer: "HDFC", title: "Bank card offers on Uber rotate (HDFC/ICICI/Amex)", code: null, cap: "varies", terms: "Check the Uber app 'Offers' tab + your bank's app on the day.", confidence: "low", lastChecked: "2026-06-24", verify: "Uber app → Offers" },
      ],
    },
    {
      id: "ola", name: "Ola", category: "cab", type: "app", linkType: "search-page",
      url: "https://book.olacabs.com/",
      note: "Often undercuts Uber on outstation + auto. Ola Money wallet cashback stacks.",
      confidence: "high", verify: "olacabs.com", offers: [],
    },
    {
      id: "rapido", name: "Rapido", category: "cab", type: "app", linkType: "search-page",
      url: "https://rapido.bike/",
      note: "Bike taxis + autos — usually the cheapest for short hops + beating traffic.",
      confidence: "med", verify: "rapido.bike", offers: [],
    },
    {
      id: "blusmart", name: "BluSmart", category: "cab", type: "app", linkType: "search-page",
      url: "https://blusmart.com/",
      note: "All-electric, fixed upfront price (no surge), airport runs. Limited to a few metros — check it serves your city.",
      confidence: "med", verify: "blusmart.com", offers: [],
    },
    {
      id: "namma-metro", name: "Metro / city transit", category: "cab", type: "site", linkType: "search-page",
      url: "https://www.google.com/maps",
      note: "In Delhi/Bengaluru/Hyderabad/Mumbai/Kolkata/Chennai the metro beats a cab in traffic and costs a fraction. Most have a QR-ticket app now.",
      confidence: "high", verify: "your city's metro app", offers: [],
    },

    // ===== INTERCITY =====
    {
      id: "irctc", name: "IRCTC (trains)", category: "intercity", type: "site", linkType: "search-page",
      url: "https://www.irctc.co.in/",
      note: "The only official train-ticket source. Often far cheaper than a short flight + reaches non-airport towns.",
      confidence: "high", verify: "irctc.co.in", offers: [],
    },
    {
      id: "redbus", name: "redBus", category: "intercity", type: "ota", linkType: "prefilled",
      url: "https://www.redbus.in/bus-tickets/{CITY_L}-to-",
      note: "Buses across India; frequent flat-off codes + wallet cashback.",
      confidence: "high", verify: "redbus.in/offers",
      offers: [
        { id: "rb-coupon", kind: "coupon", issuer: null, title: "redBus runs recurring first-booking + flat-off codes", code: null, cap: "varies", terms: "Codes rotate; the offers page lists today's. Stack with bank offers when allowed.", confidence: "low", lastChecked: "2026-06-24", verify: "redbus.in/offers" },
      ],
    },
    {
      id: "zoomcar", name: "Zoomcar (self-drive)", category: "intercity", type: "app", linkType: "search-page",
      url: "https://www.zoomcar.com/",
      note: "Self-drive rentals; good value for a group doing a multi-stop trip vs per-head flights.",
      confidence: "med", verify: "zoomcar.com", offers: [],
    },
    {
      id: "abhibus", name: "AbhiBus", category: "intercity", type: "ota", linkType: "search-page",
      url: "https://www.abhibus.com/",
      note: "Alternative bus OTA; sometimes different operators + codes than redBus. Compare both.",
      confidence: "med", verify: "abhibus.com/offers", offers: [],
    },

    // ===== CONNECTIVITY =====
    {
      id: "airalo", name: "Airalo (eSIM)", category: "connectivity", type: "app", linkType: "search-page",
      url: "https://www.airalo.com/",
      note: "Travel eSIM for 190+ countries — buy data before you land, skip the airport SIM counter markup.",
      confidence: "high", verify: "airalo.com",
      offers: [
        { id: "airalo-code", kind: "coupon", issuer: null, title: "Airalo runs recurring first-purchase % codes", code: null, cap: "varies", terms: "Search 'Airalo promo' on the day; new-user codes recur. Confirm validity in-app.", confidence: "low", lastChecked: "2026-06-24", verify: "airalo.com" },
      ],
    },
    {
      id: "niyo", name: "Niyo / Fi (forex card)", category: "connectivity", type: "app", linkType: "search-page",
      url: "https://www.goniyo.com/",
      note: "Zero-markup forex debit cards beat airport money-changers + most credit-card forex markup abroad. Load before you fly.",
      confidence: "med", verify: "goniyo.com", offers: [],
    },
    {
      id: "bookmyforex", name: "BookMyForex", category: "connectivity", type: "ota", linkType: "search-page",
      url: "https://www.bookmyforex.com/",
      note: "Compare live forex-card + currency rates, doorstep delivery. Far better than airport counters.",
      confidence: "med", verify: "bookmyforex.com", offers: [],
    },

    // ===== DINING =====
    {
      id: "eazydiner", name: "EazyDiner", category: "dining", type: "app", linkType: "search-page",
      url: "https://www.eazydiner.com/",
      note: "Restaurant deals + Prime gets up to 50% off bills at partner restaurants. Strong in metros.",
      confidence: "med", verify: "eazydiner.com",
      offers: [
        { id: "eazy-card", kind: "card", issuer: null, title: "Bank-card dining offers run via EazyDiner Prime often", code: null, cap: "up to 25-50%", terms: "Prime + bank tie-ups rotate; check the app for your city + card.", confidence: "low", lastChecked: "2026-06-24", verify: "eazydiner.com" },
      ],
    },
    {
      id: "zomato", name: "Zomato", category: "dining", type: "app", linkType: "search-page",
      url: "https://www.zomato.com/",
      note: "Delivery + dining-out; Gold/District membership + bank offers cut bills. Per-city offers vary.",
      confidence: "high", verify: "zomato.com", offers: [],
    },
    {
      id: "swiggy", name: "Swiggy", category: "dining", type: "app", linkType: "search-page",
      url: "https://www.swiggy.com/",
      note: "Food delivery + Dineout for restaurant discounts. Bank + One membership offers stack.",
      confidence: "high", verify: "swiggy.com",
      offers: [
        { id: "swiggy-card", kind: "card", issuer: "HDFC", title: "HDFC Swiggy co-brand + rotating bank offers", code: null, cap: "up to 10%", terms: "The HDFC Swiggy card earns cashback on Swiggy; other bank offers rotate in-app.", confidence: "low", lastChecked: "2026-06-24", verify: "swiggy.com/offers" },
      ],
    },

    // ===== ACTIVITIES =====
    {
      id: "thrillophilia", name: "Thrillophilia", category: "activities", type: "ota", linkType: "search-page",
      url: "https://www.thrillophilia.com/",
      note: "Tours, day-trips + adventure activities across India; book ahead for better prices than at the gate.",
      confidence: "med", verify: "thrillophilia.com", offers: [],
    },
    {
      id: "getyourguide", name: "GetYourGuide", category: "activities", type: "ota", linkType: "prefilled",
      url: "https://www.getyourguide.com/s/?q={CITY}",
      note: "Skip-the-line tickets + tours worldwide; free cancellation on most. Good for intl legs.",
      confidence: "high", verify: "getyourguide.com", offers: [],
    },
    {
      id: "headout", name: "Headout", category: "activities", type: "ota", linkType: "prefilled",
      url: "https://www.headout.com/?q={CITY}",
      note: "Instant mobile tickets for attractions, shows + experiences; strong in India metros + Dubai/SE-Asia.",
      confidence: "med", verify: "headout.com", offers: [],
    },
    {
      id: "district", name: "District (by Zomato)", category: "activities", type: "app", linkType: "search-page",
      url: "https://www.district.in/",
      note: "Events, movies, comedy + dining-out (the old Paytm Insider + Zomato events). Bank offers on tickets recur.",
      confidence: "med", verify: "district.in", offers: [],
    },
    {
      id: "bookmyshow", name: "BookMyShow", category: "activities", type: "app", linkType: "search-page",
      url: "https://in.bookmyshow.com/",
      note: "Movies + live events; frequent bank-card ticket offers (buy-one-get-one recurs).",
      confidence: "high", verify: "in.bookmyshow.com/offers",
      offers: [
        { id: "bms-card", kind: "card", issuer: null, title: "BookMyShow buy-1-get-1 + flat-off bank-card offers recur", code: null, cap: "varies", terms: "Card BOGO + flat-off rotate by bank; check the Offers page for your card.", confidence: "low", lastChecked: "2026-06-24", verify: "in.bookmyshow.com/offers" },
      ],
    },
  ],

  // ---- cross-cutting on-trip money-saving mechanisms ----------------------
  tips: [
    { id: "dtip-cab-compare", title: "Always price 2-3 cab apps for the same ride", who: "Uber / Ola / Rapido / BluSmart", note: "The cheapest app flips by city, time and surge. 30 seconds of comparing routinely saves 20-40% on airport + city rides.", confidence: "high", lastChecked: "2026-06-24", verify: "open each app for the same pickup/drop" },
    { id: "dtip-forex", title: "Load a zero-markup forex card before you fly", who: "Niyo / Fi / BookMyForex", note: "Airport counters + most credit cards add 2-3.5% forex markup. A zero-markup forex card or a no-forex-fee card saves that on every swipe abroad.", confidence: "med", lastChecked: "2026-06-24", verify: "your card's forex markup vs a zero-markup forex card" },
    { id: "dtip-esim", title: "Buy an eSIM before landing", who: "Airalo / international roaming", note: "An eSIM bought before you travel is far cheaper than airport SIM kiosks or home-network roaming, and works the moment you land.", confidence: "med", lastChecked: "2026-06-24", verify: "Airalo data plan vs your roaming pack" },
    { id: "dtip-train-vs-flight", title: "A train can beat a short second flight", who: "IRCTC", note: "For sub-500km hops, an AC train often costs a fraction of a flight, reaches the city centre, and skips airport time. Worth checking before booking a connecting flight.", confidence: "high", lastChecked: "2026-06-24", verify: "irctc.co.in fare vs the flight fare" },
  ],

  lastReviewed: "2026-06-24",
};
