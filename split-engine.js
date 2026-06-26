/*
 * TripLens — Split engine (group mode). Pure, no DOM, no clock, Node-testable.
 *
 * Splits a trip's logged spends across travellers and computes who-owes-whom,
 * with the minimum number of settlement transfers. It sits on top of the budget
 * engine's spends: a spend can carry `paidBy` (one member id) and `sharedBy`
 * (array of member ids who split it). Spends without a payer are just logged
 * costs and are NOT part of the settlement (we can't settle money nobody is
 * recorded as having fronted) — they're surfaced separately so you can assign one.
 *
 * HONESTY MODEL: every number is the user's own (the amounts they typed). We only
 * divide and net them. The split is done in INTEGER PAISE so per-person shares sum
 * to the EXACT total (no rounding invents or loses a rupee), and every settlement
 * plan nets to exactly zero. We never guess an amount, a tip, or a "typical" cost.
 *
 * trip.group = { members: [ { id, name } ] }
 */
(function (root) {
  "use strict";

  function round2(n) { return Math.round((Number(n) || 0) * 100) / 100; }
  function paise(n) { return Math.round((Number(n) || 0) * 100); } // -> integer paise
  function rupees(p) { return p / 100; }

  // ---- members ------------------------------------------------------------
  function ensureGroup(trip) {
    if (!trip.group) trip.group = { members: [] };
    if (!Array.isArray(trip.group.members)) trip.group.members = [];
    return trip.group;
  }
  // seed members from the trip's traveller count if the group is empty, so a
  // fresh trip already has "You" + "Traveller 2"... to assign. Never overwrites.
  function seedMembers(trip, seed) {
    const g = ensureGroup(trip);
    if (g.members.length) return g.members;
    const n = Math.max(1, (trip && trip.adults) || 1);
    for (let i = 0; i < n; i++) {
      g.members.push({ id: "m-" + ((seed || 1) + i), name: i === 0 ? "You" : "Traveller " + (i + 1) });
    }
    return g.members;
  }
  function members(trip) { return ensureGroup(trip).members; }
  function addMember(trip, name, seed) {
    const g = ensureGroup(trip);
    const nm = (name || "").trim() || ("Traveller " + (g.members.length + 1));
    const m = { id: "m-" + (seed || (Date_safeCount(g) )), name: nm };
    g.members.push(m);
    return m;
  }
  // a deterministic id helper that never uses Date.now() (engine purity rule):
  // next index above the highest existing m-N, falling back to length+1.
  function Date_safeCount(g) {
    let max = 0;
    g.members.forEach((m) => { const x = /^m-(\d+)$/.exec(m.id || ""); if (x) max = Math.max(max, +x[1]); });
    return max + 1;
  }
  function renameMember(trip, id, name) {
    const m = members(trip).find((x) => x.id === id);
    if (m) m.name = (name || "").trim() || m.name;
    return m || null;
  }
  // removing a member also clears them from every spend's payer/sharer fields,
  // so balances never reference a ghost. Returns true if removed.
  function removeMember(trip, id) {
    const g = ensureGroup(trip);
    const before = g.members.length;
    g.members = g.members.filter((m) => m.id !== id);
    if (g.members.length === before) return false;
    const spends = (trip.budget && trip.budget.spends) || [];
    spends.forEach((s) => {
      if (s.paidBy === id) s.paidBy = null;
      if (Array.isArray(s.sharedBy)) s.sharedBy = s.sharedBy.filter((x) => x !== id);
    });
    return true;
  }

  // ---- exact split --------------------------------------------------------
  // split an amount across n people into integer-paise shares that sum EXACTLY
  // to the amount. The first `remainder` people absorb 1 extra paisa each, so
  // e.g. 100.00 / 3 -> [33.34, 33.33, 33.33] (sums to exactly 100.00).
  function splitEvenly(amount, n) {
    if (n <= 0) return [];
    const total = paise(amount);
    const base = Math.floor(total / n);
    let rem = total - base * n;
    const out = [];
    for (let i = 0; i < n; i++) { out.push(rupees(base + (rem > 0 ? 1 : 0))); if (rem > 0) rem--; }
    return out;
  }

  // which members actually share a spend (validated against the current group).
  // empty/absent sharedBy => everyone in the group shares it.
  function sharersFor(spend, memberIds) {
    const set = new Set(memberIds);
    if (Array.isArray(spend.sharedBy) && spend.sharedBy.length) {
      const valid = spend.sharedBy.filter((id) => set.has(id));
      return valid.length ? valid : memberIds.slice();
    }
    return memberIds.slice();
  }

  // ---- balances -----------------------------------------------------------
  // returns per-member net in rupees: positive = they are OWED money (fronted
  // more than their share), negative = they OWE. Computed in integer paise so
  // the nets sum to EXACTLY zero. Only spends with a known payer are folded in.
  function balances(trip) {
    const ms = members(trip);
    const ids = ms.map((m) => m.id);
    const idSet = new Set(ids);
    const net = {}; ids.forEach((id) => (net[id] = 0)); // paise
    const spends = (trip.budget && trip.budget.spends) || [];
    let attributed = 0, unattributed = 0, unattributedTotal = 0;

    spends.forEach((s) => {
      const amt = paise(s.amount);
      if (!(amt > 0)) return;
      if (!s.paidBy || !idSet.has(s.paidBy)) { unattributed++; unattributedTotal += amt; return; }
      let sharerIds = sharersFor(s, ids);
      if (!sharerIds.length) sharerIds = [s.paidBy]; // paid for self only
      const shares = splitEvenly(s.amount, sharerIds.length).map(paise);
      net[s.paidBy] += amt;                      // payer fronted the whole amount
      sharerIds.forEach((id, i) => { net[id] -= shares[i]; }); // each owes their share back
      attributed++;
    });

    return {
      members: ms.map((m) => ({ id: m.id, name: m.name, net: rupees(net[m.id]) })),
      attributedCount: attributed,
      unattributedCount: unattributed,
      unattributedTotal: rupees(unattributedTotal),
    };
  }

  // ---- settlement ---------------------------------------------------------
  // minimal who-owes-whom transfers. Greedy: largest debtor pays largest
  // creditor, repeat. Produces at most (members-1) transfers and nets to zero.
  // Deterministic (sorts by amount then id, no randomness).
  function settle(bal) {
    const creditors = bal.members.filter((m) => paise(m.net) > 0)
      .map((m) => ({ id: m.id, name: m.name, amt: paise(m.net) }))
      .sort((a, b) => b.amt - a.amt || (a.id < b.id ? -1 : 1));
    const debtors = bal.members.filter((m) => paise(m.net) < 0)
      .map((m) => ({ id: m.id, name: m.name, amt: -paise(m.net) }))
      .sort((a, b) => b.amt - a.amt || (a.id < b.id ? -1 : 1));
    const transfers = [];
    let ci = 0, di = 0;
    while (ci < creditors.length && di < debtors.length) {
      const c = creditors[ci], d = debtors[di];
      const move = Math.min(c.amt, d.amt);
      if (move > 0) transfers.push({ from: d.id, fromName: d.name, to: c.id, toName: c.name, amount: rupees(move) });
      c.amt -= move; d.amt -= move;
      if (c.amt === 0) ci++;
      if (d.amt === 0) di++;
    }
    return transfers;
  }

  // a full view the UI renders in one call.
  function overview(trip) {
    const ms = members(trip);
    const bal = balances(trip);
    return {
      members: ms,
      balances: bal.members,
      transfers: settle(bal),
      attributedCount: bal.attributedCount,
      unattributedCount: bal.unattributedCount,
      unattributedTotal: bal.unattributedTotal,
      settled: bal.members.every((m) => Math.abs(paise(m.net)) === 0),
    };
  }

  // a plain-text settle-up summary the group can paste anywhere (WhatsApp etc).
  // Pure: takes the overview + a money formatter so currency stays consistent.
  // fmt(amount) -> string. title is the trip name.
  function summaryText(o, fmt, title) {
    fmt = fmt || ((n) => String(n));
    const lines = [];
    lines.push("Settle up" + (title ? " — " + title : ""));
    if (!o.transfers.length) {
      lines.push(o.attributedCount === 0
        ? "No spends tagged with who paid yet."
        : "All square — nobody owes anyone.");
    } else {
      o.transfers.forEach((x) => lines.push(x.fromName + " pays " + x.toName + " " + fmt(x.amount)));
    }
    if (o.unattributedCount > 0) {
      lines.push("(" + o.unattributedCount + " spend" + (o.unattributedCount > 1 ? "s" : "") +
        " worth " + fmt(o.unattributedTotal) + " not yet tagged with who paid)");
    }
    lines.push("— split with TripLens");
    return lines.join("\n");
  }

  const Engine = {
    round2, paise, rupees,
    ensureGroup, seedMembers, members, addMember, renameMember, removeMember,
    splitEvenly, sharersFor, balances, settle, overview, summaryText,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = Engine;
  root.LL_SPLIT = Engine;
})(typeof window !== "undefined" ? window : globalThis);
