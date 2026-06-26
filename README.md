# TripLens 🧭

**Live:** https://vikaskumarjvk.github.io/triplens/ — installable, works offline, free.

**Plan the whole trip, pay the smart way.** One free app for everything a trip needs —
flights, hotels, airport lounges, cabs and local deals — with the single best card to
swipe on every booking, a day-by-day itinerary, a packing checklist, and an honest budget
tracker. India-first. **No fake prices, ever.**

It started as LoungeLens (which lounges your cards open) and grew into the whole trip.
The lounge wallet is still here — it's now one part of the journey.

**Offline single file:** [`dist/triplens.html`](dist/triplens.html) is the whole app in
one file. Download it, double-click, runs with no server and no internet. AirDrop / WhatsApp it.

## What it does

| Part | What you get |
|---|---|
| 🧭 **Plan a Trip** | Route + dates → flights, hotel, lounges and on-trip deals in one plan, plus the single best card to pay across the whole trip, plus a transparent savings checklist. |
| 🗂️ **My Trips** | Save a plan → a real **day-by-day itinerary** auto-fills (flight + lounge + check-in on day 1, checkout + return on the last day). Add/move/remove items on a timeline. **Packing checklist** tailored to nights + intl/cold/beach/business/monsoon. **Budget tracker** (your numbers). Export to share the whole trip. |
| ✈️ **Flights** | Every booking site lined up compare-first; your card's offer flagged on each; live fares (free, in-browser via Amadeus); 14-day cheapest-day scan. |
| 🏨 **Hotels** | 14 booking sites (Google Hotels, Booking, Agoda, MMT, Taj/ITC/Marriott direct, Airbnb…), grouped, with the best card to pay. |
| 🧳 **On-Trip Deals** | Cabs, intercity travel, eSIM/forex, dining and activities — each with the live app/site and the card/coupon that cuts the bill. |
| 💳 **Lounge wallet** | Every airport + railway lounge your cards actually open, live "visits left", spend-gate tracker, coverage map, card compare, "worth it?" fee calculator. 299 cards / 77 lounges. |

## The honesty model (the core rule)

A free static site **cannot** fetch live airfares, room rates or coupons by itself (the
browser sandboxes it and there's no server). So TripLens **never invents a price or a total.**
Instead:

- Every booking link opens the **real live search** on the real site, where the true price is.
- Every offer (card / app / coupon) is a recurring mechanism, **confidence-tagged**
  (high / med / low) with a `verify` pointer — confirm today's exact terms before you pay.
- The **budget tracker only ever does arithmetic on numbers you typed** (your budget, your
  logged spends). It never guesses a "typical cost".
- Lounge/card data is structure-correct, directionally-correct seed data that ages its own
  confidence and tells you what to re-check.

If a number could be wrong, the app says so rather than faking certainty.

## Run it

No build step.

```
open index.html
# or serve it (if your browser blocks file:// script loads):
python3 -m http.server 8777   # then visit http://localhost:8777/index.html
```

Rebuild the single-file bundle after edits:

```
python3 build-singlefile.py   # -> dist/triplens.html
```

Run the tests (pure engines, Node):

```
node tests.js          # lounge engine
node tests-trip.js     # trip optimizer
node tests-itinerary.js
node tests-geo.js      # distance foundation (haversine accuracy + picker coverage)
node tests-explore.js  # "where to?" destination ranker
# full suite: 526 assertions across 22 files, all green
```

## Architecture

```
data/cards.js        299 cards (visits, spend gates, ease, LTF, rails)
data/lounges.js      77 lounges (airport + railway, access rails, confidence)
data/flights.js      flight booking providers + card/app/coupon offer layer
data/hotels.js       hotel providers (meta/OTA/chain) + offer layer + cities
data/deals.js        on-trip services (cab/intercity/eSIM-forex/dining/activities) + tips
data/meta.js         dataset metadata + honesty banner

engine.js            lounge brain: quota math, spend gates, per-lounge matching, coverage,
                     recommender, planTrip, compareCards, valueCalc, walletScore, coverageMap
flight-engine.js     deep-link builder + wallet-aware offer matching + best-pay
flight-live.js       live fares in-browser (Amadeus, free tier, user key)
trip-engine.js       Trip Cost Optimizer: assembles flights+stay+lounges+deals+best card,
                     transparent savings checklist. Never invents a price.
itinerary-engine.js  saved trips, day-by-day items, seed-from-plan, packing generator,
                     export/import. Pure + deterministic (no Date.now/Math.random).
budget-engine.js     per-trip budget + logged spends, per-category + per-day rollups,
                     currency, over/under flags. Every number is user input.
selfcheck.js         confidence decay, self-audit/lint, learn-from-experience, verify queue

index.html           19 views + hash routing
styles.css           dark fintech UI, card-art system, India tile map, motion polish
app.js               DOM glue + localStorage persistence (nothing leaves your device)
```

Every engine is pure and Node-tested; the UI is glue on top. State (wallet, trips, budget,
visit log, plan inputs) lives in `localStorage` only. No backend, no account, no tracking.

## It's a real installable app (PWA)

- **Installable** — "Add to Home Screen" / "Install app". Opens full-screen.
- **Works offline** — `sw.js` caches the whole app shell, network-first so a fresh version
  always loads online with cache fallback offline.
- **First-run onboarding** + **About/Trust** (not-financial-advice, privacy, data provenance).
- **Shareable link preview** (Open Graph).

## Live flight fares (optional, free)

Flights → "Connect free live fares" → paste a free [Amadeus](https://developers.amadeus.com/register)
key (stored only on your device, only ever sent to Amadeus). Then you get real fares fetched
in-browser, plus a 14-day cheapest-day + price-dip scan. Everything else works without it.

## Keeping data fresh

Edit the `data/*.js` files and bump `lastReviewed` in `data/meta.js`. Each record is one
object literal; the schema is the contract. The app ages its own confidence and surfaces a
verify queue, so stale data is flagged rather than trusted blindly.

> **Provenance:** card/lounge numbers began as best-guess seed data from the 2024-25 Indian
> lounge overhaul, tagged low-confidence; a research+verify pass bumps records to verified as
> it confirms them against issuer pages. Booking-site offers describe recurring mechanisms, not
> guaranteed live codes. **Desk-check spend gates, visit counts and today's offer terms before
> a trip.** The engines and UX are fully verified (526 tests + browser runs).

## Known limitations (tracked, not hidden)

1. Booking links open the right live search, but sites change their URL schemes over time —
   every offer is confidence-tagged with a verify pointer for exactly this reason.
2. Lounge coverage % counts rail-reachable lounges, not visits-in-hand (the per-lounge "N left"
   and wallet rollup ARE visit-accurate; the trip planner uses real quota per lounge).
3. Hotel/deal data is a curated starter set — broad on majors, lighter on long-tail cities.
4. Dataset needs a quarterly desk-check against issuer T&Cs (see provenance).
5. No multi-traveller guest-visit modelling on lounges yet; budget supports per-person split.
6. Railway lounge rules are genuinely murky; those entries are mostly confidence=low.
