/*
 * LoungeLens — Profile / sync (free, serverless "login").
 *
 * HONEST MODEL: a free static site has no server, so there are no real accounts.
 * Instead, the user's whole state (cards, visits, spend, trip, experiences,
 * preferences) lives in localStorage and can be carried between THEIR OWN devices
 * via a portable "sync code" (a compact encoded blob) or a file. This gives the
 * felt benefit of "log in and my stuff is here" without a server, without holding
 * anyone's data, and without privacy/compliance burden.
 *
 * A sync code is just the JSON state, JSON->base64 (URL-safe). Paste it on another
 * device to restore. No password because there's no server to protect — the code IS
 * the data, so treat it like you'd treat the file (don't post it publicly).
 *
 * Pure functions (encode/decode/merge). Node-testable.
 */
(function (root) {
  "use strict";

  // base64 that works in browser AND node
  function b64encode(str) {
    if (typeof btoa === "function") return btoa(unescape(encodeURIComponent(str)));
    return Buffer.from(str, "utf-8").toString("base64");
  }
  function b64decode(b64) {
    if (typeof atob === "function") return decodeURIComponent(escape(atob(b64)));
    return Buffer.from(b64, "base64").toString("utf-8");
  }

  // make code URL-safe + tagged so we can validate on import
  function encodeState(state) {
    const payload = {
      t: "LL1", // tag + version
      name: state.profileName || "",
      wallet: state.wallet || [],
      visitLog: state.visitLog || [],
      spend: state.spend || {},
      trip: state.trip || [],
      experiences: state.experiences || [],
      mode: state.mode || "simple",
    };
    const b = b64encode(JSON.stringify(payload));
    return b.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  function decodeState(code) {
    if (!code || typeof code !== "string") throw new Error("empty code");
    let b = code.trim().replace(/-/g, "+").replace(/_/g, "/");
    while (b.length % 4) b += "=";
    const obj = JSON.parse(b64decode(b));
    if (!obj || obj.t !== "LL1") throw new Error("not a LoungeLens sync code");
    return obj;
  }

  // merge an imported payload into current state.
  // strategy: imported profile REPLACES name/mode/trip; wallet UNION (don't lose
  // either device's cards); visitLog + experiences MERGE+DEDUPE (keep all history);
  // spend takes the higher number per card (you spent at least that much).
  function mergeInto(state, payload) {
    state.profileName = payload.name || state.profileName || "";
    state.mode = payload.mode || state.mode || "simple";
    if (Array.isArray(payload.trip) && payload.trip.length) state.trip = payload.trip;

    const walletSet = new Set([...(state.wallet || []), ...(payload.wallet || [])]);
    state.wallet = [...walletSet];

    const vk = (v) => (v.cardId || "") + "|" + (v.ts || "");
    const seenV = new Set((state.visitLog || []).map(vk));
    (payload.visitLog || []).forEach((v) => { if (!seenV.has(vk(v))) { state.visitLog.push(v); seenV.add(vk(v)); } });

    const ek = (e) => (e.loungeId || "") + "|" + (e.cardId || "") + "|" + (e.ts || "");
    const seenE = new Set((state.experiences || []).map(ek));
    (payload.experiences || []).forEach((e) => { if (!seenE.has(ek(e))) { state.experiences.push(e); seenE.add(ek(e)); } });

    state.spend = state.spend || {};
    Object.keys(payload.spend || {}).forEach((cid) => {
      state.spend[cid] = Math.max(Number(state.spend[cid]) || 0, Number(payload.spend[cid]) || 0);
    });
    return state;
  }

  const Profile = { encodeState, decodeState, mergeInto };
  if (typeof module !== "undefined" && module.exports) module.exports = Profile;
  root.LL_PROFILE = Profile;
})(typeof window !== "undefined" ? window : globalThis);
