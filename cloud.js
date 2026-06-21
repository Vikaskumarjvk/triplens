/*
 * LoungeLens — cloud sync adapter (Firebase, free Spark tier). OPTIONAL.
 *
 * ACTIVATION: only runs if window.LL_FIREBASE config exists (see SETUP-LOGIN.md).
 * Without it, this file is inert and the app stays in free DEVICE-login mode.
 *
 * WHAT IT DOES when configured:
 *  - loads the Firebase web SDK from CDN (lazily)
 *  - exposes LL_CLOUD with: available, signUp, signIn, signOut, save, load, onUser
 *  - app.js prefers LL_CLOUD when LL_CLOUD.available is true, else uses local AUTH
 *
 * HONEST NOTE: this path needs the owner's free Firebase project to actually run.
 * It is written to the documented Firebase v10 modular web API. It is wiring-tested
 * (no-config inert path is verified); the live cloud round-trip must be verified by
 * the owner after pasting their config, because it requires their project to exist.
 *
 * Data shape in Firestore: users/{uid} -> { data: <app state blob>, updatedAt }
 */
(function (root) {
  "use strict";

  const cfg = root.LL_FIREBASE;
  const Cloud = {
    available: false,         // becomes true after SDK loads + init succeeds
    _app: null, _auth: null, _db: null, _fns: null,
  };

  // If no config, stay inert. app.js checks Cloud.available and falls back to device auth.
  if (!cfg || !cfg.apiKey) {
    Cloud.reason = "no-config";
    root.LL_CLOUD = Cloud;
    if (typeof module !== "undefined" && module.exports) module.exports = Cloud;
    return;
  }

  // dynamic import of Firebase modular SDK (v10) from the official CDN
  async function init() {
    try {
      const [{ initializeApp }, authMod, fsMod] = await Promise.all([
        import("https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js"),
        import("https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js"),
        import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js"),
      ]);
      Cloud._app = initializeApp(cfg);
      Cloud._auth = authMod.getAuth(Cloud._app);
      Cloud._db = fsMod.getFirestore(Cloud._app);
      Cloud._fns = { ...authMod, ...fsMod };
      Cloud.available = true;
      return true;
    } catch (e) {
      Cloud.reason = "sdk-load-failed: " + (e && e.message);
      Cloud.available = false;
      return false;
    }
  }

  // public API — all return Promises
  Cloud.ready = init();

  Cloud.signUp = async function (email, password) {
    await Cloud.ready;
    const { createUserWithEmailAndPassword } = Cloud._fns;
    const cred = await createUserWithEmailAndPassword(Cloud._auth, email, password);
    return cred.user;
  };
  Cloud.signIn = async function (email, password) {
    await Cloud.ready;
    const { signInWithEmailAndPassword } = Cloud._fns;
    const cred = await signInWithEmailAndPassword(Cloud._auth, email, password);
    return cred.user;
  };
  Cloud.signOut = async function () {
    await Cloud.ready;
    const { signOut } = Cloud._fns;
    return signOut(Cloud._auth);
  };
  Cloud.onUser = async function (cb) {
    await Cloud.ready;
    const { onAuthStateChanged } = Cloud._fns;
    return onAuthStateChanged(Cloud._auth, cb);
  };
  Cloud.save = async function (uid, data) {
    await Cloud.ready;
    const { doc, setDoc } = Cloud._fns;
    return setDoc(doc(Cloud._db, "users", uid), { data, updatedAt: Date.now() });
  };
  Cloud.load = async function (uid) {
    await Cloud.ready;
    const { doc, getDoc } = Cloud._fns;
    const snap = await getDoc(doc(Cloud._db, "users", uid));
    return snap.exists() ? snap.data().data : null;
  };

  root.LL_CLOUD = Cloud;
  if (typeof module !== "undefined" && module.exports) module.exports = Cloud;
})(typeof window !== "undefined" ? window : globalThis);
