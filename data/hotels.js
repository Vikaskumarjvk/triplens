/*
 * TripLens — hotel booking providers, deep links, and the card / app / coupon
 * discount layer for hotels (India domestic + a few intl hubs).
 *
 * HONESTY MODEL (identical to flights.js / lounges.js — read this):
 *  - A free static site CANNOT fetch live room rates (CORS + no server). So this
 *    file stores NO fake prices. Each provider has a real DEEP LINK that opens the
 *    actual live search on the real site, where you see today's real rate.
 *  - linkType "prefilled" = city + dates go into the URL (you land on results that
 *    just work with a plain city-name query, e.g. Booking.com / Google Hotels).
 *    "search-page" = opens the hotels home/search page, you type the dates (the
 *    site needs internal city ids or POST search, so no stable public deep link).
 *  - Offers (card discount / app offer / coupon) are CONFIDENCE-TAGGED with a
 *    lastChecked date + a verify link. India bank-hotel offers rotate often, so an
 *    offer here describes the recurring mechanism; tap verify to confirm today's
 *    exact code + cap before you pay. NOTHING here is a guaranteed live rate.
 *
 * URL placeholders the engine fills (see trip-engine.js buildStayLink):
 *   {CITY}            city name, url-encoded ("New Delhi")
 *   {CITY_L}          city name lower, url-encoded
 *   {CHECKIN}         YYYY-MM-DD
 *   {CHECKOUT}        YYYY-MM-DD
 *   {CHECKIN_DDMMYYYY} {CHECKOUT_DDMMYYYY}
 *   {ADULTS}          guest count (defaults 2)
 */
window.LL_HOTELS = {
  // cities the stay picker offers (mirrors flight + lounge city coverage) ----
  cities: [
    "Delhi", "Mumbai", "Bengaluru", "Hyderabad", "Chennai", "Kolkata",
    "Goa", "Kochi", "Pune", "Ahmedabad", "Jaipur", "Udaipur", "Jodhpur",
    "Jaisalmer", "Lucknow", "Varanasi", "Agra", "Guwahati", "Chandigarh",
    "Srinagar", "Leh", "Thiruvananthapuram", "Visakhapatnam", "Indore",
    "Amritsar", "Dehradun", "Port Blair", "Shimla", "Manali", "Rishikesh",
    "Darjeeling", "Gangtok", "Munnar", "Ooty", "Coorg", "Alleppey",
    "Mysuru", "Pondicherry", "Mahabaleshwar", "Nainital", "Mussoorie",
    "Dubai", "Abu Dhabi", "Singapore", "Bangkok", "Phuket", "Bali",
    "Kuala Lumpur", "Kathmandu", "Colombo", "Maldives",
  ],

  // ---- booking providers ---------------------------------------------------
  // type: meta (compares many, no booking) | ota | chain (hotel group direct)
  providers: [
    {
      id: "google-hotels", name: "Google Hotels", type: "meta", linkType: "prefilled",
      url: "https://www.google.com/travel/search?q=hotels%20in%20{CITY}&checkin={CHECKIN}&checkout={CHECKOUT}",
      note: "Compares rates across every booking site at once, then sends you to book. Best first stop.",
      confidence: "high", verify: "google.com/travel/search", offers: [],
    },
    {
      id: "trivago", name: "Trivago", type: "meta", linkType: "search-page",
      url: "https://www.trivago.in/",
      note: "Hotel meta-search — lines up the same hotel's price across sites so you spot the cheapest.",
      confidence: "high", verify: "trivago.in", offers: [],
    },
    {
      id: "booking", name: "Booking.com", type: "ota", linkType: "prefilled",
      url: "https://www.booking.com/searchresults.html?ss={CITY}&checkin={CHECKIN}&checkout={CHECKOUT}&group_adults={ADULTS}&no_rooms=1",
      note: "Huge inventory, free-cancellation filter, Genius loyalty discounts. Prefilled search.",
      confidence: "high", verify: "booking.com/deals",
      offers: [
        { id: "bk-genius", kind: "app", issuer: null, title: "Booking.com Genius levels give 10-20% off select stays (free loyalty)", code: null, cap: "10-20%", terms: "Log in; Genius discount auto-applies on eligible hotels. Free to join.", confidence: "med", lastChecked: "2026-06-24", verify: "booking.com/genius.html" },
      ],
    },
    {
      id: "agoda", name: "Agoda", type: "ota", linkType: "search-page",
      url: "https://www.agoda.com/",
      note: "Strong on Asia + India; aggressive app-only and member prices. Uses internal city ids, so type your dates on its page.",
      confidence: "high", verify: "agoda.com/deals",
      offers: [
        { id: "ag-app", kind: "app", issuer: null, title: "Agoda app/member prices often beat the public web rate", code: null, cap: "varies", terms: "Sign in or open the app for member-only rates on the same room.", confidence: "med", lastChecked: "2026-06-24", verify: "agoda.com" },
      ],
    },
    {
      id: "makemytrip-hotels", name: "MakeMyTrip Hotels", type: "ota", linkType: "search-page",
      url: "https://www.makemytrip.com/hotels/",
      note: "Big India OTA; runs the most bank instant-discount offers on hotels. Adds a fee sometimes — compare net.",
      confidence: "med", verify: "makemytrip.com/promos/",
      offers: [
        { id: "mmth-hdfc", kind: "card", issuer: "HDFC", title: "HDFC card instant discount on hotels (recurring)", code: null, cap: "up to a few thousand ₹", terms: "MMT runs a recurring HDFC hotel offer; code + cap rotate. Confirm on the offers page.", confidence: "low", lastChecked: "2026-06-24", verify: "makemytrip.com/promos/" },
        { id: "mmth-icici", kind: "card", issuer: "ICICI", title: "ICICI card hotel discount (recurring)", code: null, cap: "varies", terms: "Recurring ICICI tie-up on hotels. Terms rotate.", confidence: "low", lastChecked: "2026-06-24", verify: "makemytrip.com/promos/" },
      ],
    },
    {
      id: "goibibo-hotels", name: "Goibibo Hotels", type: "ota", linkType: "search-page",
      url: "https://www.goibibo.com/hotels/",
      note: "Same group as MakeMyTrip; 'gocash' wallet + sometimes different bank offers.",
      confidence: "med", verify: "goibibo.com/offers/",
      offers: [
        { id: "gih-axis", kind: "card", issuer: "Axis", title: "Axis card hotel offer (recurring)", code: null, cap: "varies", terms: "Recurring Axis tie-up on Goibibo hotels. Confirm current terms.", confidence: "low", lastChecked: "2026-06-24", verify: "goibibo.com/offers/" },
      ],
    },
    {
      id: "cleartrip-hotels", name: "Cleartrip Hotels", type: "ota", linkType: "search-page",
      url: "https://www.cleartrip.com/hotels",
      note: "Flipkart-owned; Flipkart/Axis ecosystem offers run here often.",
      confidence: "med", verify: "cleartrip.com/offers",
      offers: [
        { id: "cth-axis", kind: "card", issuer: "Axis", title: "Flipkart Axis card offers run on Cleartrip hotels", code: null, cap: "varies", terms: "Cleartrip + Flipkart ecosystem offers rotate. Confirm before paying.", confidence: "low", lastChecked: "2026-06-24", verify: "cleartrip.com/offers" },
      ],
    },
    {
      id: "easemytrip-hotels", name: "EaseMyTrip Hotels", type: "ota", linkType: "search-page",
      url: "https://www.easemytrip.com/hotels/",
      note: "Heavy on coupon codes + low/zero convenience fee on hotels.",
      confidence: "med", verify: "easemytrip.com/offers/",
      offers: [
        { id: "emth-coupon", kind: "coupon", issuer: null, title: "EaseMyTrip runs frequent flat-off hotel codes", code: "EMTHOTEL", cap: "varies", terms: "Codes rotate; the offers page lists today's working ones.", confidence: "low", lastChecked: "2026-06-24", verify: "easemytrip.com/offers/" },
      ],
    },
    {
      id: "oyo", name: "OYO", type: "ota", linkType: "search-page",
      url: "https://www.oyorooms.com/",
      note: "Budget-focused chain aggregator; app-only OYO Money + frequent codes. Check reviews per property.",
      confidence: "med", verify: "oyorooms.com/offers",
      offers: [
        { id: "oyo-app", kind: "app", issuer: null, title: "OYO app codes + OYO Money wallet stack on budget stays", code: null, cap: "varies", terms: "App routinely cheaper than web; wallet + code stack. Read property reviews first.", confidence: "low", lastChecked: "2026-06-24", verify: "oyorooms.com/offers" },
      ],
    },
    {
      id: "treebo", name: "Treebo", type: "chain", linkType: "search-page",
      url: "https://www.treebo.com/",
      note: "Quality-controlled budget chain; book direct on their site/app for best price guarantee.",
      confidence: "med", verify: "treebo.com", offers: [],
    },
    {
      id: "tajitc", name: "Taj / IHCL (direct)", type: "chain", linkType: "search-page",
      url: "https://www.tajhotels.com/",
      note: "Book Taj / Vivanta / SeleQtions direct for member rates + Tata NeuPass points. Premium.",
      confidence: "high", verify: "tajhotels.com/en-in/offers",
      offers: [
        { id: "taj-neu", kind: "app", issuer: null, title: "Tata Neu / NeuPass earns NeuCoins on direct Taj bookings", code: null, cap: "points", terms: "Book via Tata Neu or direct with NeuPass for points + member rates.", confidence: "low", lastChecked: "2026-06-24", verify: "tataneu.com" },
      ],
    },
    {
      id: "itchotels", name: "ITC Hotels (direct)", type: "chain", linkType: "search-page",
      url: "https://www.itchotels.com/",
      note: "ITC luxury + Welcomhotel/Fortune. Book direct for Club ITC points + member rates.",
      confidence: "high", verify: "itchotels.com/in/en/offers", offers: [],
    },
    {
      id: "marriott", name: "Marriott Bonvoy (direct)", type: "chain", linkType: "search-page",
      url: "https://www.marriott.com/",
      note: "Bonvoy direct beats OTAs for members (points + late checkout). Big India footprint.",
      confidence: "high", verify: "marriott.com/loyalty.mi", offers: [],
    },
    {
      id: "airbnb", name: "Airbnb", type: "ota", linkType: "prefilled",
      url: "https://www.airbnb.co.in/s/{CITY}/homes?checkin={CHECKIN}&checkout={CHECKOUT}&adults={ADULTS}",
      note: "Apartments / homestays / longer stays — often better value than hotels for groups + weekly stays.",
      confidence: "high", verify: "airbnb.co.in", offers: [],
    },
  ],

  // ---- cross-provider hotel coupon / offer mechanisms ---------------------
  // NOT guaranteed codes (no free site can promise that). Each is a recurring
  // mechanism, confidence-tagged, with where to confirm today.
  coupons: [
    { id: "hcpn-bank-instant", title: "Bank instant-discount on hotels", who: "HDFC / ICICI / Axis / SBI", note: "OTAs run rotating 'instant discount with X bank card' on hotels, usually a higher cap than flights (a few thousand rupees). Check the OTA's offers page on booking day.", confidence: "med", lastChecked: "2026-06-24", verify: "the OTA's /offers or /promos page" },
    { id: "hcpn-direct-vs-ota", title: "Book-direct chains beat OTAs for members", who: "Taj / ITC / Marriott / Hyatt", note: "Loyalty members get member rates + points + perks (late checkout, upgrades) booking direct that OTAs don't match. Compare the chain site vs the OTA.", confidence: "med", lastChecked: "2026-06-24", verify: "the chain's loyalty/offers page" },
    { id: "hcpn-app-only", title: "App-only hotel rates", who: "Agoda / OYO / MakeMyTrip", note: "Several apps price hotels under their website for the same room. Quick to check both.", confidence: "low", lastChecked: "2026-06-24", verify: "open the app vs the website for the same search" },
    { id: "hcpn-freecancel", title: "Book free-cancellation, rebook if it drops", who: "Booking.com / Agoda", note: "Lock a free-cancellation rate early, watch the price, rebook cheaper if it falls before the cancellation deadline. Zero-risk hedge.", confidence: "med", lastChecked: "2026-06-24", verify: "the booking's cancellation policy" },
    { id: "hcpn-longstay", title: "Weekly / monthly stay discounts", who: "Airbnb / Agoda", note: "7+ and 28+ night stays unlock built-in weekly/monthly discounts, often 10-40% off the nightly rate.", confidence: "med", lastChecked: "2026-06-24", verify: "the listing's price breakdown for your dates" },
  ],

  lastReviewed: "2026-06-24",
};
