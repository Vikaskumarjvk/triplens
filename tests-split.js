/* Tests for split-engine.js (group mode: who-owes-whom). node tests-split.js
 *
 * The honesty-critical guarantees this pins down:
 *  - per-person shares sum to the EXACT spend total (no paisa invented or lost)
 *  - member net balances sum to EXACTLY zero
 *  - every settlement plan nets to exactly zero, in <= (members-1) transfers
 *  - spends with no recorded payer are NOT settled (we can't settle money nobody
 *    is recorded as fronting) — they're surfaced separately
 *  - removing a member never leaves a ghost in any spend
 */
"use strict";
const assert = require("assert");
const S = require("./split-engine.js");

let pass = 0, fail = 0;
function ok(n, fn) { try { fn(); pass++; } catch (e) { fail++; console.log("  ✗", n, "\n     " + e.message); } }
const sum = (arr) => Math.round(arr.reduce((a, b) => a + b, 0) * 100) / 100;

function tripWith(members, spends) {
  return { adults: members.length, group: { members }, budget: { spends } };
}
const M3 = [{ id: "m-1", name: "You" }, { id: "m-2", name: "Asha" }, { id: "m-3", name: "Ravi" }];

// ---- splitEvenly: exact-sum guarantee ------------------------------------
ok("splitEvenly 100/3 sums to exactly 100 (no lost paisa)", () => {
  const sh = S.splitEvenly(100, 3);
  assert.strictEqual(sum(sh), 100);
  assert.deepStrictEqual(sh, [33.34, 33.33, 33.33]);
});
ok("splitEvenly 0.01/3 -> one person carries the paisa, sum exact", () => {
  const sh = S.splitEvenly(0.01, 3);
  assert.strictEqual(sum(sh), 0.01);
  assert.deepStrictEqual(sh, [0.01, 0, 0]);
});
ok("splitEvenly even amount divides cleanly", () => {
  assert.deepStrictEqual(S.splitEvenly(90, 3), [30, 30, 30]);
});
ok("splitEvenly random-ish amounts always sum exact", () => {
  [1, 7, 99.99, 4200.5, 12345.67].forEach((amt) => {
    [1, 2, 3, 4, 5, 7].forEach((n) => assert.strictEqual(sum(S.splitEvenly(amt, n)), S.round2(amt), amt + "/" + n));
  });
});
ok("splitEvenly n<=0 -> empty", () => assert.deepStrictEqual(S.splitEvenly(100, 0), []));

// ---- members ------------------------------------------------------------
ok("seedMembers creates one per traveller, 'You' first", () => {
  const t = { adults: 3, budget: { spends: [] } };
  const ms = S.seedMembers(t, 1);
  assert.strictEqual(ms.length, 3);
  assert.strictEqual(ms[0].name, "You");
});
ok("seedMembers never overwrites an existing group", () => {
  const t = { adults: 5, group: { members: [{ id: "m-9", name: "Solo" }] }, budget: { spends: [] } };
  assert.strictEqual(S.seedMembers(t, 1).length, 1);
});
ok("addMember gives a unique id above existing", () => {
  const t = tripWith([{ id: "m-1", name: "You" }], []);
  const m = S.addMember(t, "Neha");
  assert.strictEqual(m.name, "Neha");
  assert.notStrictEqual(m.id, "m-1");
});
ok("removeMember strips the member from spends (no ghost)", () => {
  const t = tripWith(M3.slice(), [
    { id: "sp-1", amount: 300, paidBy: "m-2", sharedBy: ["m-1", "m-2", "m-3"] },
  ]);
  assert.strictEqual(S.removeMember(t, "m-2"), true);
  const sp = t.budget.spends[0];
  assert.strictEqual(sp.paidBy, null, "payer cleared");
  assert.ok(!sp.sharedBy.includes("m-2"), "sharer cleared");
});

// ---- balances net to zero ------------------------------------------------
ok("one person pays for all three -> they're owed 2/3, others owe 1/3 each", () => {
  const t = tripWith(M3, [{ id: "sp-1", amount: 300, paidBy: "m-1", sharedBy: ["m-1", "m-2", "m-3"] }]);
  const b = S.balances(t);
  const net = {}; b.members.forEach((m) => (net[m.id] = m.net));
  assert.strictEqual(net["m-1"], 200);  // fronted 300, owes 100 share -> +200
  assert.strictEqual(net["m-2"], -100);
  assert.strictEqual(net["m-3"], -100);
});
ok("balances always sum to exactly zero", () => {
  const t = tripWith(M3, [
    { id: "sp-1", amount: 100, paidBy: "m-1" },           // absent sharers => everyone
    { id: "sp-2", amount: 4200.5, paidBy: "m-2", sharedBy: ["m-1", "m-2"] },
    { id: "sp-3", amount: 77.77, paidBy: "m-3", sharedBy: ["m-3"] }, // paid for self only
  ]);
  const b = S.balances(t);
  assert.strictEqual(sum(b.members.map((m) => m.net)), 0);
});
ok("absent sharedBy means everyone splits it", () => {
  const t = tripWith(M3, [{ id: "sp-1", amount: 90, paidBy: "m-1" }]);
  const net = {}; S.balances(t).members.forEach((m) => (net[m.id] = m.net));
  assert.strictEqual(net["m-1"], 60); // paid 90, owes 30 -> +60
  assert.strictEqual(net["m-2"], -30);
});
ok("spend with no payer is unattributed, not settled", () => {
  const t = tripWith(M3, [
    { id: "sp-1", amount: 300, paidBy: null },
    { id: "sp-2", amount: 150, paidBy: "m-1", sharedBy: ["m-1", "m-2", "m-3"] },
  ]);
  const b = S.balances(t);
  assert.strictEqual(b.unattributedCount, 1);
  assert.strictEqual(b.unattributedTotal, 300);
  assert.strictEqual(b.attributedCount, 1);
  // only the attributed 150 affects balances; nets still sum to zero
  assert.strictEqual(sum(b.members.map((m) => m.net)), 0);
});
ok("payer not in group is treated as unattributed (no ghost balance)", () => {
  const t = tripWith(M3, [{ id: "sp-1", amount: 300, paidBy: "m-99" }]);
  const b = S.balances(t);
  assert.strictEqual(b.unattributedCount, 1);
  assert.ok(b.members.every((m) => m.net === 0));
});

// ---- settlement ----------------------------------------------------------
ok("settle nets to zero + minimal transfers", () => {
  const t = tripWith(M3, [{ id: "sp-1", amount: 300, paidBy: "m-1", sharedBy: ["m-1", "m-2", "m-3"] }]);
  const o = S.overview(t);
  // m-2 and m-3 each owe 100 to m-1 -> 2 transfers
  assert.strictEqual(o.transfers.length, 2);
  const intoM1 = o.transfers.filter((x) => x.to === "m-1").reduce((a, x) => a + x.amount, 0);
  assert.strictEqual(intoM1, 200);
  o.transfers.forEach((x) => assert.ok(x.amount > 0, "no zero transfers"));
});
ok("settle transfers sum equals total owed (conserves money)", () => {
  const t = tripWith(M3, [
    { id: "sp-1", amount: 600, paidBy: "m-1" },
    { id: "sp-2", amount: 300, paidBy: "m-2", sharedBy: ["m-2", "m-3"] },
  ]);
  const o = S.overview(t);
  const owed = o.balances.filter((m) => m.net > 0).reduce((a, m) => a + m.net, 0);
  const moved = o.transfers.reduce((a, x) => a + x.amount, 0);
  assert.strictEqual(S.round2(moved), S.round2(owed));
});
ok("all-square trip -> no transfers, settled=true", () => {
  const t = tripWith(M3, [
    { id: "sp-1", amount: 90, paidBy: "m-1", sharedBy: ["m-1", "m-2", "m-3"] },
    { id: "sp-2", amount: 90, paidBy: "m-2", sharedBy: ["m-1", "m-2", "m-3"] },
    { id: "sp-3", amount: 90, paidBy: "m-3", sharedBy: ["m-1", "m-2", "m-3"] },
  ]);
  const o = S.overview(t);
  assert.strictEqual(o.transfers.length, 0);
  assert.strictEqual(o.settled, true);
});
ok("settle is deterministic (same input, same plan)", () => {
  const t = tripWith(M3, [{ id: "sp-1", amount: 300, paidBy: "m-1" }]);
  const a = JSON.stringify(S.overview(t).transfers);
  const b = JSON.stringify(S.overview(t).transfers);
  assert.strictEqual(a, b);
});

// ---- uneven / subset splits ----------------------------------------------
ok("subset share: a solo cost only burdens the sharers, not everyone", () => {
  // m-1 pays 200 for a museum that only m-1 and m-2 went to
  const t = tripWith(M3, [{ id: "sp-1", amount: 200, paidBy: "m-1", sharedBy: ["m-1", "m-2"] }]);
  const net = {}; S.balances(t).members.forEach((m) => (net[m.id] = m.net));
  assert.strictEqual(net["m-1"], 100);  // paid 200, owes 100 share -> +100
  assert.strictEqual(net["m-2"], -100); // owes their 100 share
  assert.strictEqual(net["m-3"], 0);    // didn't go -> owes nothing
});
ok("subset share still nets to exactly zero", () => {
  const t = tripWith(M3, [
    { id: "sp-1", amount: 999.99, paidBy: "m-2", sharedBy: ["m-1", "m-2"] },
    { id: "sp-2", amount: 100, paidBy: "m-3", sharedBy: ["m-3"] }, // self only -> no effect on others
  ]);
  assert.strictEqual(sum(S.balances(t).members.map((m) => m.net)), 0);
});
ok("a sharedBy that names a non-member is ignored, valid ones still split", () => {
  const t = tripWith(M3, [{ id: "sp-1", amount: 100, paidBy: "m-1", sharedBy: ["m-1", "m-99"] }]);
  // m-99 isn't in the group; only m-1 is a valid sharer -> m-1 paid for self
  const net = {}; S.balances(t).members.forEach((m) => (net[m.id] = m.net));
  assert.strictEqual(net["m-1"], 0);
  assert.strictEqual(sum(S.balances(t).members.map((m) => m.net)), 0);
});

// ---- summaryText (shareable settle-up) -----------------------------------
ok("summaryText lists each transfer with the formatter", () => {
  const t = tripWith(M3, [{ id: "sp-1", amount: 300, paidBy: "m-1", sharedBy: ["m-1", "m-2", "m-3"] }]);
  const txt = S.summaryText(S.overview(t), (n) => "Rs" + n, "Goa trip");
  assert.ok(/Goa trip/.test(txt));
  assert.ok(/Asha pays You Rs100/.test(txt));
  assert.ok(/Ravi pays You Rs100/.test(txt));
});
ok("summaryText says all-square when spends are tagged but balanced", () => {
  // each person pays an equal third-share, so nobody owes anyone
  const t = tripWith(M3, [
    { id: "sp-1", amount: 90, paidBy: "m-1", sharedBy: ["m-1", "m-2", "m-3"] },
    { id: "sp-2", amount: 90, paidBy: "m-2", sharedBy: ["m-1", "m-2", "m-3"] },
    { id: "sp-3", amount: 90, paidBy: "m-3", sharedBy: ["m-1", "m-2", "m-3"] },
  ]);
  const txt = S.summaryText(S.overview(t), (n) => "Rs" + n, "x");
  assert.ok(/all square/i.test(txt));
});
ok("summaryText on an empty trip says nothing tagged (not 'all square')", () => {
  const t = tripWith(M3, []);
  const txt = S.summaryText(S.overview(t), (n) => "Rs" + n, "x");
  assert.ok(/no spends tagged/i.test(txt));
});
ok("summaryText flags untagged spends, never invents who paid", () => {
  const t = tripWith(M3, [{ id: "sp-1", amount: 500, paidBy: null }]);
  const txt = S.summaryText(S.overview(t), (n) => "Rs" + n, "x");
  assert.ok(/not yet tagged|no spends tagged/i.test(txt));
});

// ---- honesty: never invents money ----------------------------------------
ok("empty trip -> zero everything, nothing fabricated", () => {
  const t = tripWith(M3, []);
  const o = S.overview(t);
  assert.strictEqual(o.transfers.length, 0);
  assert.ok(o.balances.every((m) => m.net === 0));
  assert.strictEqual(o.settled, true);
});

console.log(`\n==== ${pass} passed, ${fail} failed ====`);
process.exit(fail ? 1 : 0);
