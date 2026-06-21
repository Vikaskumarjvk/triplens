# Putting LoungeLens online (free) and sharing it

LoungeLens is a **static site** — just HTML, CSS, and JavaScript, no server, no database.
Everything a visitor saves (their cards, visits) stays in *their own browser* (localStorage).
That makes it cheap and safe to host: a free static host is all you need, and a public
link does **not** leak anyone's saved cards (see the privacy note at the bottom).

## The privacy point first (important)

Because the app never sends anything to a server:
- When a friend opens your link, they start with an **empty** wallet.
- They cannot see cards you saved — your data lives only on your device, theirs on theirs.
- So a "public" link is fine to share. There's no shared account, no central data to expose.

If you still want to limit *who can open the page at all*, see "Restricting to a few members" below.

## Easiest free options (ranked)

### Option 1 — Netlify Drop (recommended: zero setup, drag and drop)
Best when you just want a link in 2 minutes with no account.

1. Open https://app.netlify.com/drop in your browser.
2. Drag the whole `loungelens` folder (the one with `index.html` inside) onto the page.
3. Wait a few seconds. Netlify gives you a public URL like `https://sunny-lounge-1a2b3c.netlify.app`.
4. Share that URL with your friends. HTTPS is automatic.
5. To keep the same link and update it later, create a free Netlify account and "claim" the site.

Pros: trivial, instant, no command line. Cons: random URL unless you make an account.

### Option 2 — GitHub Pages (recommended: permanent, free forever)
Best when you want a stable link and don't mind a few steps.

1. Make a free account at https://github.com if you don't have one.
2. Create a new repository, e.g. `loungelens` (keep it Public — Pages is free for public repos).
3. Upload the files: on the repo page click **Add file → Upload files**, drag in
   `index.html`, `styles.css`, `app.js`, and the `data/` folder, then **Commit**.
   (Or with git: `git add . && git commit -m "loungelens" && git push`.)
4. Go to **Settings → Pages**.
5. Under **Source**, pick branch `main` and folder `/ (root)`, click **Save**.
6. In ~1-2 minutes your site is live at `https://YOURNAME.github.io/loungelens/`.
7. Share that link.

Pros: permanent, reliable, free. Cons: needs a GitHub account; public repo means the *code* is public (the code is fine to be public — no secrets in it).

### Option 3 — Cloudflare Pages (fast global CDN)
1. Sign up free at https://dash.cloudflare.com/sign-up.
2. Go to **Workers & Pages → Create application → Pages → Upload assets**.
3. Name the project, drag in the folder, click **Deploy site**.
4. Live at `https://yourproject.pages.dev`.

### Option 4 — Surge.sh (fastest via command line, needs Node)
1. Install Node from https://nodejs.org if needed.
2. `npm install --global surge`
3. `cd` into the `loungelens` folder, run `surge`.
4. Press Enter through the prompts; pick a name like `loungelens.surge.sh`.
5. Live with free HTTPS.

## Restricting to "a few members"

The data is already private per-device, so usually a plain link is enough. If you want to
gate *opening the page*:

- **Simplest:** just don't post the link publicly. Share it only in your group chat.
  An unguessable Netlify/Pages URL is effectively private-by-obscurity for a few friends.
- **Real password:** Netlify offers password protection / Netlify Identity, but the exact
  free-tier limits change — check current Netlify docs before relying on it. Cloudflare
  Access can gate *preview* URLs on the free tier (not the main domain).
- **If you outgrow this** (you want real accounts, shared data, the "marketplace" idea),
  that's a different build with a backend — see the README phase-2 note.

## Updating after you publish

- Netlify Drop: drag the folder again (or push if you claimed it).
- GitHub Pages: upload/commit changed files; the site rebuilds automatically.
- Surge: re-run `surge` from the folder.

Since each person's data is local, updating the code never touches anyone's saved wallet
unless you change the storage key (`loungelens.v2` in `app.js`).
