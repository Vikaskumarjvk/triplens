# How LoungeLens compares to what's in the market

Honest competitor map (researched 2026-06-22). I attempted live fetches of each;
several block bots (Reddit, aggregators) so this combines the one source that
responded — DreamFolks — with established knowledge of the market. Treat the
competitor capabilities as directionally accurate, not freshly scraped from each.

## The landscape

| Product | What it's good at | Where it falls short (our opening) |
|---|---|---|
| **DreamFolks** (app/portal) | The actual access rail; lists lounges, validates entry at the desk | B2B-first. Confirmed via live fetch: **no "which of MY cards opens this", no visit-left tracker, no spend-gate warning, no trip planning** |
| **Priority Pass** | Clean global lounge finder for its own members | Only PP lounges. Useless for figuring out your *bank card* access. Paid/bundled. |
| **LoungeBuddy** (Amex-owned) | Add cards → see lounges, buy passes | Weak/abandoned India coverage, **no railway, US-centric, no spend-gate logic** |
| **CardExpert / Technofino / Paisabazaar / BankBazaar** | Deep written reviews + active forums | **Static articles** — no interactive "my wallet → my lounges", no live visit tracking, no calculators |
| **Individual bank apps** | Show that one bank's benefit | Single-issuer. Nobody aggregates all the cards in your wallet. |

## What no competitor combines (LoungeLens does, free)

1. **All-issuer wallet aggregation** — 100 cards (84 credit + 16 debit), 21 issuers, in one view.
2. **Live per-card visit tracking** — log a visit, quota decrements per reset period.
3. **The 2024-25 spend-gate trap** — warns when free visits are locked behind prior-quarter spend. *Nobody else models this; it's the #1 reason people get surprised at the gate.*
4. **Railway lounges** — first-class, same engine. Almost nobody covers these.
5. **Trip planner** — Hyderabad → your cities → exactly which lounge each card opens.

## Where we now beat each competitor head-on (this build)

- **vs aggregator comparison tables** → **Compare view**: pick 2 cards, get a scored winner across coverage/visits/ease/spend-gate/railway. Wallet-aware, picks a winner — their tables don't.
- **vs LoungeBuddy / Priority Pass finders** → **Airports view**: pick an airport/station, see every lounge AND which of *your* cards opens each. Card-aware, which theirs is not, plus railway.
- **vs everyone** → **"Worth It?" calculator**: given your trips/year and what a lounge is worth to you, computes whether each card's fee pays for itself. No competitor has this.
- **smart "use this card first"** → at any lounge with multiple usable cards, we tell you which to use first (unlimited cards before scarce ones, avoid burning spend-gated visits). Pure logic edge.

## Where we deliberately DON'T pretend to beat them

- **We are not an access provider.** DreamFolks/Priority Pass/Adani validate entry; we link you to their official apps to actually get in. Faking a "tap to enter" button would get users turned away — the opposite of useful.
- **Our data is confidence-tagged, not live-verified.** Aggregators have staff updating tables daily; we have an honest age-decay + verify-queue model instead. For a free tool that's the right trade, but we flag it rather than claim freshness we don't have.

## The honest summary
For *figuring out your own wallet's real lounge access in India, free, including railway and
the spend-gate trap, with trip planning and a value calculator* — nothing in the market does
all of it. LoungeLens does. Where competitors have staffed daily-updated data or are the
actual access rail, we link out to them rather than fake it.
