/*
 * LoungeLens — self-improvement module (rung 1: free, client-side, honest).
 *
 * WHAT THIS IS (and is NOT):
 *  It does NOT fetch the live internet — a free static page can't (CORS + no server).
 *  It DOES make the app self-AWARE and self-ADAPTIVE within the browser:
 *    1. ageConfidence    - data gets less trusted as it ages (self-doubt by time)
 *    2. lintDataset      - the app audits its OWN data for contradictions/gaps
 *    3. applyExperience  - learns from what actually happened to YOU at a lounge
 *    4. verifyQueue      - ranks what to re-check before a trip (self-troubleshoot)
 *
 * Pure functions. Node-testable. No DOM.
 */
(function (root) {
  "use strict";

  const DAY = 86400000;

  // ---- 1. confidence decay by age ---------------------------------------
  // Indian lounge rules drift quarterly. A "high" fact reviewed 8 months ago is
  // no longer high. We downgrade the STATED confidence by how stale it is.
  // reviewedISO = dataset meta.lastReviewed; now = Date.
  function ageConfidence(stated, reviewedISO, now) {
    const order = ["low", "med", "high"];
    let idx = order.indexOf(stated);
    if (idx < 0) idx = 0;
    const reviewed = new Date(reviewedISO || 0).getTime();
    const ageDays = Math.max(0, ((now ? now.getTime() : Date.now()) - reviewed) / DAY);
    // one quarter (~90d) stale = drop one level; two quarters = drop two.
    let drop = 0;
    if (ageDays > 180) drop = 2;
    else if (ageDays > 90) drop = 1;
    const effIdx = Math.max(0, idx - drop);
    return {
      stated,
      effective: order[effIdx],
      ageDays: Math.round(ageDays),
      decayed: drop > 0,
      reason: drop === 0 ? "fresh" : `data is ~${Math.round(ageDays)} days old; trust lowered ${drop} level(s)`,
    };
  }

  // ---- 2. self-integrity lint -------------------------------------------
  // The app audits its OWN dataset and reports problems it can detect locally:
  //  - duplicate ids, missing required fields, unknown rails, orphan rails
  //  - cards claiming visits but no rails (can never actually enter)
  //  - lounges no card in the dataset can open (dead lounge)
  //  - spend-gated cards missing a gate note
  const KNOWN_RAILS = ["dreamfolks", "priority", "visa", "mastercard", "diners", "rupay", "plaza", "payperuse"];
  function lintDataset(cards, lounges) {
    const issues = [];
    const add = (sev, kind, msg, ref) => issues.push({ sev, kind, msg, ref });

    const cardIds = new Set();
    cards.forEach((c) => {
      if (cardIds.has(c.id)) add("error", "dup-card-id", `Duplicate card id ${c.id}`, c.id);
      cardIds.add(c.id);
      if (!c.name || !c.issuer) add("error", "missing-field", `Card ${c.id} missing name/issuer`, c.id);
      (c.programs || []).forEach((p) => { if (!KNOWN_RAILS.includes(p)) add("warn", "unknown-rail", `Card ${c.name} uses unknown rail "${p}"`, c.id); });
      const hasVisits = c.domesticVisits === "unlimited" || (Number(c.domesticVisits) || 0) > 0;
      if (hasVisits && (c.programs || []).length === 0) add("warn", "visits-no-rail", `${c.name} claims visits but has no access rail — can never actually enter`, c.id);
      if (c.spendGate && !c.spendGate.note) add("info", "gate-no-note", `${c.name} has a spend gate with no explanation`, c.id);
      if (!["high", "med", "low"].includes(c.confidence)) add("warn", "bad-confidence", `${c.name} has invalid confidence "${c.confidence}"`, c.id);
    });

    const loungeIds = new Set();
    const railsCoveredByAnyCard = new Set();
    cards.forEach((c) => (c.programs || []).forEach((p) => railsCoveredByAnyCard.add(p)));
    lounges.forEach((l) => {
      if (loungeIds.has(l.id)) add("error", "dup-lounge-id", `Duplicate lounge id ${l.id}`, l.id);
      loungeIds.add(l.id);
      if ((l.programs || []).length === 0) add("warn", "lounge-no-rail", `${l.name} (${l.city}) lists no access rail`, l.id);
      (l.programs || []).forEach((p) => { if (!KNOWN_RAILS.includes(p)) add("warn", "unknown-rail", `${l.name} uses unknown rail "${p}"`, l.id); });
      const reachable = (l.programs || []).some((p) => railsCoveredByAnyCard.has(p));
      if (!reachable) add("info", "dead-lounge", `${l.name} (${l.city}) can't be opened by ANY card in the dataset`, l.id);
    });

    const counts = { error: 0, warn: 0, info: 0 };
    issues.forEach((i) => counts[i.sev]++);
    return { issues, counts, clean: counts.error === 0 && counts.warn === 0 };
  }

  // ---- 3. learn from the user's real experience -------------------------
  // experiences: [{ loungeId, cardId, outcome: "in"|"refused", ts }]
  // Returns a per-lounge adjustment the UI can surface: if the user (or imported
  // community file) was refused with a card that the data says should work, that
  // lounge+rail combo is flagged "reality disagrees with data".
  function experienceSignals(experiences) {
    const byLounge = {};
    (experiences || []).forEach((e) => {
      const k = e.loungeId;
      byLounge[k] = byLounge[k] || { in: 0, refused: 0, lastTs: 0, cards: {} };
      byLounge[k][e.outcome === "refused" ? "refused" : "in"]++;
      byLounge[k].cards[e.cardId] = byLounge[k].cards[e.cardId] || { in: 0, refused: 0 };
      byLounge[k].cards[e.cardId][e.outcome === "refused" ? "refused" : "in"]++;
      const t = new Date(e.ts || 0).getTime();
      if (t > byLounge[k].lastTs) byLounge[k].lastTs = t;
    });
    // produce a confidence nudge per lounge: net positive => reinforce, net refused => warn
    const signals = {};
    Object.keys(byLounge).forEach((lid) => {
      const b = byLounge[lid];
      const net = b.in - b.refused;
      signals[lid] = {
        in: b.in, refused: b.refused,
        nudge: net > 0 ? "reinforced" : net < 0 ? "contradicted" : "mixed",
        note: net < 0 ? "Your logged experience says this was refused more than it worked — verify before relying."
            : net > 0 ? "Confirmed working from your own visits."
            : "Mixed real-world results — check at the desk.",
      };
    });
    return signals;
  }

  // ---- 4. verify queue (self-troubleshoot: what to check before flying) --
  // Ranks dataset records by how much they need a human eye: low effective
  // confidence first, then stalest, then ones your experience contradicted.
  function verifyQueue(cards, lounges, meta, experiences, now, tripCities) {
    const sig = experienceSignals(experiences);
    const tripSet = new Set((tripCities || []).map((c) => (c || "").toLowerCase()));
    const rank = { low: 0, med: 1, high: 2 };
    const rows = [];

    lounges.forEach((l) => {
      const eff = ageConfidence(l.confidence, meta && meta.lastReviewed, now).effective;
      const contradicted = sig[l.id] && sig[l.id].nudge === "contradicted";
      const onTrip = tripSet.has((l.city || "").toLowerCase());
      // priority score: lower is more urgent
      let score = rank[eff] * 10;
      if (contradicted) score -= 100;       // your own experience disagrees = top priority
      if (onTrip) score -= 50;               // it's on your upcoming trip
      rows.push({
        type: "lounge", id: l.id, label: `${l.name} (${l.city})`,
        effConfidence: eff, contradicted: !!contradicted, onTrip,
        verify: l.verify || "Check the DreamFolks app / lounge desk.",
        score,
      });
    });
    cards.forEach((c) => {
      if ((c.programs || []).length === 0) return; // baseline no-lounge cards: skip
      const eff = ageConfidence(c.confidence, meta && meta.lastReviewed, now).effective;
      let score = rank[eff] * 10 + 5; // cards slightly lower urgency than lounges
      if (c.spendGate) score -= 8;    // spend gates change often, bump up
      rows.push({
        type: "card", id: c.id, label: c.name,
        effConfidence: eff, contradicted: false, onTrip: false,
        verify: c.verify || "Check the issuer's T&C page.",
        score,
      });
    });

    rows.sort((a, b) => a.score - b.score);
    return rows;
  }

  const Self = { ageConfidence, lintDataset, experienceSignals, verifyQueue, KNOWN_RAILS };
  if (typeof module !== "undefined" && module.exports) module.exports = Self;
  root.LL_SELF = Self;
})(typeof window !== "undefined" ? window : globalThis);
