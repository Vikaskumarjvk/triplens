# Go live in one step

LoungeLens is now a production **PWA** (installable, works offline). Everything is static —
no server, no build, no dependencies. Pick ONE path below. All are free.

I can't click deploy for you (it needs YOUR login), but each path is one real action.

---

## Path A — Netlify Drop (fastest, ~2 minutes, no account needed)

1. Open https://app.netlify.com/drop in your browser.
2. Drag the entire `triplens` folder onto the page.
3. You get a live link like `https://lounge-lens-x1y2.netlify.app`. Share it.
4. (Optional) Sign in free → "claim" the site to keep the link and update later.

That's it. HTTPS, install-to-home-screen, and offline all work automatically because
`manifest.webmanifest` and `sw.js` ship in the folder.

---

## Path B — GitHub Pages (permanent link, free forever)

1. Create a free account at https://github.com.
2. New repository, name it `triplens`, keep it **Public**.
3. **Add file → Upload files**, drag in EVERYTHING in the folder (including the `data/` and
   `icons/` folders and the `.nojekyll` file), then **Commit changes**.
4. **Settings → Pages** → Source: branch `main`, folder `/ (root)` → **Save**.
5. Live in ~2 min at `https://YOURNAME.github.io/triplens/`.

The included `.nojekyll` file makes sure GitHub serves all files as-is.

---

## Path C — Local sharing on your own network (no internet host)

To show it on your phone right now, on the same wifi as your computer:

```
cd triplens
python3 -m http.server 8080
```

Find your computer's local IP (`ipconfig getifaddr en0` on Mac), then on your phone open
`http://THAT-IP:8080`. Note: the install/offline PWA features need HTTPS, so they only fully
work once it's on Netlify/GitHub (both give HTTPS free). Local is fine for a quick demo.

---

## After it's live — installing it like an app

- **Android / Chrome:** open the link → menu → "Install app" / "Add to Home screen", or tap
  the green **Install app** button in the header.
- **iPhone / Safari:** open the link → Share → "Add to Home Screen". (iOS doesn't show the
  in-page install button; the Share-sheet route is the iOS way.)
- Once installed it opens full-screen like a native app and works with no internet.

---

## Updating it later

1. Make your changes locally (e.g. refresh `data/cards.js`).
2. Bump `CACHE_VERSION` in `sw.js` (so users get the new files, not the old cache).
3. Re-deploy: drag the folder to Netlify again, or commit+push for GitHub Pages.

---

## What's already production-ready

- ✅ Installable PWA (`manifest.webmanifest` + real icons in `icons/`)
- ✅ Works fully offline (`sw.js` caches the app shell — verified: SW registered, controlling, 12 files cached)
- ✅ First-run onboarding
- ✅ About/Trust page: not-financial-advice + privacy + data provenance (legally important for a finance-adjacent tool)
- ✅ Simple/Advanced modes, Trip planner, Data Health self-audit
- ✅ Link preview metadata (Open Graph) for WhatsApp/chat sharing
- ✅ 52 automated tests green, zero console errors, browser-verified end to end

## What still needs a human before wide release

- 🔲 **Desk-check the card/lounge numbers** against current issuer T&Cs (the data is
  confidence-tagged and directionally correct, but not live-scraped — see README provenance note).
- 🔲 A custom domain (optional, ~₹800/yr) if you want `triplens.in` instead of a `.netlify.app` link.
- 🔲 If you ever add real accounts / shared data / the marketplace idea → that's the paid backend (Rung 3).
