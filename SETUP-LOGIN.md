# Login: what works now vs. free cross-device cloud login

LoungeLens has **real login/logout, working right now**, in two honest tiers.

## Tier 1 — Device login (LIVE NOW, zero setup, fully tested)

Already working on the live site. A user clicks **👤 Log in → Create a profile**, picks a
username + PIN, and from then on:
- their cards, visits, trip, and preferences are saved under that profile
- **Log out** hides the data; **Log in** brings it all back
- two people sharing one device get separate profiles
- to move to another device today: Profile → generate a **sync code**, paste on the other device

What it is honest about: the data lives in that browser. The PIN stops casual peeking on a
shared device; it is **not** bank-grade security (there's no server to enforce it). The login
modal says this. For real cross-device login, do Tier 2.

## Tier 2 — Free cloud login (cross-device, ~10 min one-time setup)

This makes login sync across phone + laptop automatically, **for free**, using Google
Firebase's free "Spark" tier (genuinely free, no card required for normal personal use).

The app already checks for a Firebase config and switches to cloud mode automatically when
one is present. You just provide it once:

### Steps
1. Go to https://console.firebase.google.com → **Add project** (free). Name it `loungelens`.
2. In the project: **Build → Authentication → Get started → Email/Password → Enable.**
3. **Build → Firestore Database → Create database → Start in production mode.** Then in
   **Rules**, paste this so each user can only read/write their own document:
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{db}/documents {
       match /users/{uid} {
         allow read, write: if request.auth != null && request.auth.uid == uid;
       }
     }
   }
   ```
4. **Project settings → General → Your apps → Web app (</>)** → register → copy the
   `firebaseConfig` object it shows you.
5. Create a file `firebase-config.js` in the loungelens folder with:
   ```js
   window.LL_FIREBASE = {
     apiKey: "…", authDomain: "…", projectId: "…",
     appId: "…" // paste your real values from step 4
   };
   ```
6. Add `<script src="firebase-config.js"></script>` in index.html on the line just
   ABOVE `<script src="cloud.js"></script>`. That's the only wiring needed —
   `cloud.js` is already built and integrated into the login flow (it auto-detects
   the config, loads the Firebase SDK, and the login modal switches from
   username+PIN to email+password automatically).
7. Re-deploy (push, or drag to Netlify). Done — login now syncs across devices.

### Status of the cloud adapter (honest)
- `cloud.js` is **built, integrated, and tested in its no-config state** (verified inert
  + device login unaffected). The login modal, save-on-change, load-on-login, and
  logout all already branch to cloud when `window.LL_CLOUD.available` is true.
- The **live cloud round-trip** (real sign-up → Firestore write → sign-in on another
  device → read back) can only be verified once YOUR Firebase project exists, because
  it needs real credentials. After step 6-7, do one test: sign up on your laptop, add a
  card, then sign in with the same email on your phone — the card should appear.

### Honest notes
- The Firebase **apiKey is safe to expose** in client code (it's an identifier, not a secret);
  the Firestore Rules above are what actually protect data. This is the standard Firebase web pattern.
- Free tier limits (Spark) are generous for a personal/small-group app: ~50k reads, ~20k
  writes per day, 1 GB stored. You'd need thousands of active users to exceed it.
- Storing which cards people hold is **personal data**. Even on Firebase, if you open this to
  the public you should add a short privacy note (the About page already has one) and, in
  India, be mindful of the DPDP Act. For you + friends, the rules above keep each person's
  data private to them.

## Why I built it this way
Tier 1 gives you a real, tested login today with no dependencies and no privacy burden.
Tier 2 is the same login UX promoted to true cloud sync, free, the moment you paste a config.
I did NOT silently bolt on a cloud account system, because that decision (where user data
lives, who's responsible for it) is yours to make deliberately — not mine to assume.
