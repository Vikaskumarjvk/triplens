/*
 * TripLens — ground transport (trains + buses) providers + deep links + offers.
 *
 * HONESTY MODEL (same as flights/hotels): no fake prices. Each provider opens the
 * REAL live search on the real site for your route + date. Deep-link formats here
 * were verified in a real browser (redBus + ixigo land on actual results, 2026-06-24).
 *
 * Placeholders the transport engine fills:
 *   {FROM_SLUG} {TO_SLUG}   url-safe lowercase city ("new-delhi")
 *   {FROM} {TO}             raw city, url-encoded
 *   {DATE}                  YYYY-MM-DD
 *   {DATE_DDMMMYYYY}        24-Jun-2026 (redBus style)
 */
window.LL_TRANSPORT = {
  // ---- TRAIN providers (India) -------------------------------------------
  trains: [
    {
      id: "ixigo-trains", name: "ixigo Trains", type: "aggregator", linkType: "prefilled",
      url: "https://www.ixigo.com/trains/{FROM_SLUG}-to-{TO_SLUG}",
      note: "Trains between your cities with live running status + seat availability. IRCTC-authorised partner, so you can book here too.",
      confidence: "high", verify: "ixigo.com/trains",
      offers: [
        { id: "ixt-app", kind: "app", issuer: null, title: "ixigo app shows free cancellation + assured options on trains", code: null, cap: "varies", terms: "App-first features + occasional bank offers on train bookings.", confidence: "low", lastChecked: "2026-06-24", verify: "ixigo.com/trains" },
      ],
    },
    {
      id: "confirmtkt", name: "ConfirmTkt", type: "aggregator", linkType: "prefilled",
      url: "https://www.confirmtkt.com/trains-between-stations/{FROM_SLUG}-to-{TO_SLUG}",
      note: "Best for waitlist prediction — tells you the real chance a waitlisted ticket clears before you book.",
      confidence: "med", verify: "confirmtkt.com", offers: [],
    },
    {
      id: "railyatri", name: "RailYatri", type: "aggregator", linkType: "search-page",
      url: "https://www.railyatri.in/trains-between-stations",
      note: "Trains between stations + live status + intercity buses too. Type your stations on the page.",
      confidence: "med", verify: "railyatri.in", offers: [],
    },
    {
      id: "irctc", name: "IRCTC (official)", type: "official", linkType: "search-page",
      url: "https://www.irctc.co.in/nget/train-search",
      note: "The only OFFICIAL Indian Railways booking site. Cheapest (no convenience fee) but the UI is clunky and needs an IRCTC login. Aggregators above add a small fee for a smoother flow.",
      confidence: "high", verify: "irctc.co.in", offers: [],
    },
  ],

  // ---- BUS providers (India) ---------------------------------------------
  buses: [
    {
      id: "redbus", name: "redBus", type: "ota", linkType: "prefilled",
      url: "https://www.redbus.in/bus-tickets/{FROM_SLUG}-to-{TO_SLUG}",
      note: "India's biggest bus platform — most operators, seat selection, live tracking. Opens straight to buses on your route.",
      confidence: "high", verify: "redbus.in/offers",
      offers: [
        { id: "rb-coupon", kind: "coupon", issuer: null, title: "redBus runs recurring first-booking + flat-off codes", code: "FIRST", cap: "varies", terms: "New-user + flat-off codes rotate; the offers page lists today's. Bank offers stack sometimes.", confidence: "low", lastChecked: "2026-06-24", verify: "redbus.in/offers" },
      ],
    },
    {
      id: "abhibus", name: "AbhiBus", type: "ota", linkType: "search-page",
      url: "https://www.abhibus.com/",
      note: "Alternative bus platform — sometimes different operators + codes than redBus. Worth comparing for the same route.",
      confidence: "med", verify: "abhibus.com/offers",
      offers: [
        { id: "ab-coupon", kind: "coupon", issuer: null, title: "AbhiBus flat-off + wallet cashback codes recur", code: null, cap: "varies", terms: "Codes rotate weekly. Confirm on the offers page.", confidence: "low", lastChecked: "2026-06-24", verify: "abhibus.com/offers" },
      ],
    },
    {
      id: "paytm-bus", name: "Paytm Bus", type: "ota", linkType: "prefilled",
      url: "https://tickets.paytm.com/bus/search/{FROM}/{TO}/{DATE}/1",
      note: "Paytm wallet cashback on buses; app-first. Prefilled to your route + date.",
      confidence: "med", verify: "paytm.com/bus-tickets", offers: [],
    },
    {
      id: "ixigo-bus", name: "ixigo Bus", type: "aggregator", linkType: "search-page",
      url: "https://www.ixigo.com/buses",
      note: "Bus search inside ixigo — handy if you're already comparing its trains/flights for the same route.",
      confidence: "med", verify: "ixigo.com/buses", offers: [],
    },
  ],

  // ---- cross-mode money plays --------------------------------------------
  tips: [
    { id: "tr-tip-tatkal", title: "Tatkal opens 1 day before for last-minute trains", who: "IRCTC / ixigo / ConfirmTkt", note: "If regular quota is full, Tatkal seats open at 10-11 AM one day before travel. ConfirmTkt's prediction tells you if a waitlist is worth holding.", confidence: "med", lastChecked: "2026-06-24", verify: "the train's quota on IRCTC" },
    { id: "tr-tip-class", title: "Pick the right train class for the distance", who: "trains", note: "Sub-6h day journeys: Chair Car (CC) / 2S is cheap + fast. Overnight: 3AC is the value sweet spot; SL is cheapest but books out. A night train also saves a hotel night.", confidence: "high", lastChecked: "2026-06-24", verify: "class availability for your train" },
    { id: "tr-tip-bus-sleeper", title: "Overnight sleeper bus can beat a flight + hotel", who: "redBus / AbhiBus", note: "For 300-700km, an AC sleeper bus overnight saves both a flight fare and a hotel night. Compare the all-in cost, not just the ticket.", confidence: "med", lastChecked: "2026-06-24", verify: "sleeper bus timings on redBus" },
  ],

  lastReviewed: "2026-06-24",
};
