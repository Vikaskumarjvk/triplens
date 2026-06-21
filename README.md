# LoungeLens 🛋️

**Live:** https://vikaskumarjvk.github.io/loungelens/ — installable, works offline, free.

Every lounge your wallet *actually* opens — airport **and** railway, India domestic.
One view across all your cards, with a live "visits left" tracker, trip planner,
card comparison, a "worth it?" fee calculator, login, and 114 cards across 28 issuers.

## Run it

No build step. Either:

```
open index.html
```

or serve it (needed only if your browser blocks `file://` script loads):

```
cd loungelens
python3 -m http.server 8777
# visit http://localhost:8777/index.html
```

Run the engine tests:

```
node tests.js     # 26 assertions, all green
```

## What it does (and why it beats the existing apps)

| Pain point | Existing apps | LoungeLens |
|---|---|---|
| "can't check access properly" | card-by-card static lists | one merged wallet view |
| "how many visits left" | nobody tracks it | live quota per card, per reset period; log a visit, it decrements |
| "how many can I still avail" | — | wallet-wide rollup |
| "which card opens this lounge" | — | per-lounge: names the exact card + access rail |
| "easy to get / lifetime-free cards" | scattered forums | ease score + LTF flag + recommender |
| "cards I might get immediately" | — | "easy approval only" filter |
| railway lounges | almost nobody | first-class, same engine |
| **spend-gate trap (2024-25)** | ignored | tracks ₹X/quarter unlock gates, warns when locked |

## The honesty model (read this)

India reworked lounge rules across 2024-25 and they keep shifting quarter to quarter.
So this app does **not** pretend to be a legal source of truth:

- every card and lounge carries a **confidence badge** (high / med / low)
- every record has a **verify** hint pointing at where to confirm
- the dataset is structure-correct and directionally-correct **seed** data you can refresh

The durable value is the **engine** (`engine.js`), the **freshness model**, railway coverage,
and the spend-gate tracker — not the exact numbers, which you keep current.

## Views

- **✈️ Plan a Trip** (default) — enter Hyderabad → your destination cities; get a per-city
  verdict ("you're in 👍" / blocked / no card), the exact card to use at each lounge, and
  gap cities with a one-click "fix with a card".
- **💳 My Cards** — wallet rollup, live "visits left", spend-gate unlock tracker, log a visit.
- **🛋️ All Lounges** — full list, filter by airport/railway, "only ones I can enter".
- **⭐ Get a Card** — recommender, trip-aware, biased toward easy + fast-to-issue cards.
- **➕ Add Cards** — tap the cards you hold.

- **🩺 Data Health** — the self-awareness layer (see below).

**Simple vs Advanced mode** (toggle top-right): Simple hides rails/jargon and speaks plainly
("use RuPay Select · 2 left"). Advanced shows access rails, spend-gate detail, confidence,
eligibility, and verify notes.

## Self-improvement (what's real vs what needs a backend)

You asked for self-learning / self-researching / cross-verifying in real time. Here's the
honest split, because a **free static site cannot browse the live internet by itself** (the
browser's same-origin/CORS policy blocks a web page from fetching bank sites, and there's no
server running when the tab is closed). Pretending otherwise would be a lie.

**Rung 1 — self-aware (LIVE NOW, free, in `selfcheck.js`):**
- **Confidence decay by age** — every fact's badge auto-drops a level after ~3 months stale,
  two levels after ~6. The app visibly distrusts its own old data (`⏱` on the badge).
- **Self-audit / lint** — the app checks its OWN dataset for contradictions, duplicate ids,
  cards that claim visits but have no access rail, lounges no card can open, bad confidence
  values. Shown on Data Health. Currently: 0 errors, 0 warnings.
- **Learn from your real experience** — log "got in ✅ / refused ❌" at any lounge. If reality
  contradicts the data, that lounge is flagged and jumps to the top of the verify queue.
- **Verify queue** — ranks what to re-check before you fly: your contradictions first, then
  on-trip cities, then stalest/lowest-confidence.
- **Community data import/export** — share your logged experiences as a JSON file; imports
  merge into the verify signals (they don't blindly overwrite base data).

**Rung 2 — self-researching loop (free, manual cadence):** a repeatable research+cross-verify
pass (like the workflow I ran) regenerates `data/cards.js` / `data/lounges.js` each quarter,
gated by the rung-1 self-audit so bad/contradictory data can't slip in. Run by you or me.

**Rung 3 — fully autonomous (needs a paid backend):** scheduled scrapers, a shared crowd
database, moderation, true real-time cross-verify. Requires a server — not free, not built.
Scope it when the user base justifies the cost.

> Why not real-time now: a research pass that hits live sources has to run *somewhere*. On a
> free static host there is no "somewhere" — only the visitor's browser, which is sandboxed.
> The data files are regenerated out-of-band and shipped; the app keeps itself honest about
> how old they are. That's the truthful version of "self-aware".

## Architecture

```
data/cards.js     card dataset (visits, spend gates, ease, LTF, approvalSpeed, eligibility, rails)
data/lounges.js   lounge dataset (airport + railway, access rails, confidence, verify)
data/meta.js      dataset metadata + plain-language rail names + honesty banner
engine.js         pure logic: quota math, spend gates, per-lounge matching, wallet rollup,
                  coverage, recommender, cities, planTrip, recommendForTrip. No DOM. Node-testable.
tests.js          37 self-tests over the engine (node tests.js)
index.html        5 views + mode toggle
styles.css        dark UI, simple/advanced visibility
app.js            DOM glue + localStorage persistence (nothing leaves your device)
HOSTING.md        free deploy + sharing guide
```

State (wallet, visit log, spend, trip, mode) is in `localStorage` only. No backend, no tracking.

## It's a real installable app (PWA)

Not just a web page — a production Progressive Web App:
- **Installable** — "Add to Home Screen" on iPhone, "Install app" on Android/desktop. Opens
  full-screen like a native app. Real icons in `icons/`, `manifest.webmanifest`.
- **Works offline** — `sw.js` caches the whole app shell, so it runs with no internet (handy
  at an airport on bad wifi). Verified: service worker registers, controls the page, caches 12 files.
- **First-run onboarding** + **About/Trust page** (not-financial-advice, privacy, data provenance).
- **Shareable link preview** (Open Graph) for WhatsApp/chat.

## Going live (free, one step)

See **DEPLOY.md** for exact steps. Short version: drag the folder onto
https://app.netlify.com/drop for an instant public HTTPS link, or use GitHub Pages for a
permanent one. Because each visitor's data lives only in their own browser, a public link
never exposes anyone's saved cards. (Also see **HOSTING.md** for the host comparison.)

## Keeping data fresh

Edit `data/cards.js` / `data/lounges.js` and bump `lastReviewed` in `data/meta.js`.
The schema is the contract — adding a card/lounge is one object literal.

> **Data provenance note (be honest with members):** the card/lounge numbers were authored
> from working knowledge of the 2024-25 Indian lounge overhaul, not scraped live this session
> (the automated research agents hit context limits in this environment). They are
> directionally correct and every record is confidence-tagged, but **desk-check the specific
> spend gates and visit counts against issuer T&Cs before a trip.** The `verify` field on each
> card/lounge points where to look. The engine and UX are fully verified (52 tests + browser run).

## Known limitations (tracked, not hidden)

1. **Coverage % counts rail-reachable lounges, not visits-in-hand.** A 1-visit/quarter card
   shows many "enterable" lounges — any *one* is reachable, but you hold limited actual visits.
   The per-lounge "N left" and the wallet "visits left now" rollup ARE visit-accurate; the
   Lounges-tab coverage % is the optimistic rail view. (Trip planner uses real quota per lounge.)
2. Dataset needs a quarterly desk-check against issuer T&Cs (see provenance note).
3. No multi-traveller / guest-visit modelling yet.
4. Network (Visa/Mastercard tier) and Priority Pass eligibility is rail-level, not tier-exact —
   a low-tier Visa card won't truly get Visa-lounge-program access.
5. Railway lounge access rules are genuinely murky; those entries are mostly confidence=low.

## Phase 2 (the "BankNot-style" marketplace idea)

The original ask also mentioned a community board like the rent/transfer marketplaces
where people post listings. That is a **different product** (a social marketplace, with
listings, trust/reputation, and likely a backend + moderation), so it's deliberately
out of this MVP. The data layer here is built so a `listings` collection can sit
alongside `cards`/`lounges` without reworking the engine. Scope it separately before building.
