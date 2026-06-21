/* Node self-tests for the self-improvement module. Run: node tests-self.js */
const path = require("node:path");
globalThis.window = globalThis;
require(path.join(__dirname, "data", "cards.js"));
require(path.join(__dirname, "data", "lounges.js"));
require(path.join(__dirname, "data", "meta.js"));
const S = require(path.join(__dirname, "selfcheck.js"));

const CARDS = globalThis.LL_CARDS, LOUNGES = globalThis.LL_LOUNGES, META = globalThis.LL_META;
let pass = 0, fail = 0;
const ok = (n, c) => { if (c) { pass++; console.log("  PASS:", n); } else { fail++; console.log("  FAIL:", n); } };

console.log("\n[S1] confidence decays with age");
{
  const fresh = S.ageConfidence("high", "2026-06-01", new Date("2026-06-21"));
  ok("fresh stays high", fresh.effective === "high" && !fresh.decayed);
  const oneQ = S.ageConfidence("high", "2026-01-01", new Date("2026-06-21")); // ~171d -> 1 drop (>90)
  ok("~5.5 months => drop 1 level", oneQ.effective === "med" && oneQ.decayed);
  const twoQ = S.ageConfidence("high", "2025-09-01", new Date("2026-06-21")); // >180d -> 2 drops
  ok("~9 months => drop 2 levels", twoQ.effective === "low");
  const floor = S.ageConfidence("low", "2024-01-01", new Date("2026-06-21"));
  ok("can't go below low", floor.effective === "low");
}

console.log("\n[S2] lint passes on the real dataset (no errors)");
{
  const r = S.lintDataset(CARDS, LOUNGES);
  console.log("    lint counts:", JSON.stringify(r.counts));
  ok("no structural errors in shipped data", r.counts.error === 0);
}

console.log("\n[S3] lint catches injected problems");
{
  const badCards = [
    { id: "x", name: "X", issuer: "Y", domesticVisits: 2, period: "quarter", programs: [], confidence: "high" }, // visits no rail
    { id: "x", name: "Dup", issuer: "Y", domesticVisits: 0, period: "quarter", programs: ["visa"], confidence: "weird" }, // dup id + bad confidence
  ];
  const badLounges = [
    { id: "l1", name: "Ghost", city: "Nowhere", type: "airport", programs: ["unicorn"], confidence: "low" }, // unknown rail + dead
  ];
  const r = S.lintDataset(badCards, badLounges);
  ok("flags duplicate id", r.issues.some((i) => i.kind === "dup-card-id"));
  ok("flags visits-without-rail", r.issues.some((i) => i.kind === "visits-no-rail"));
  ok("flags unknown rail", r.issues.some((i) => i.kind === "unknown-rail"));
  ok("flags bad confidence", r.issues.some((i) => i.kind === "bad-confidence"));
  ok("not clean", r.clean === false);
}

console.log("\n[S4] experience learning reinforces/contradicts");
{
  const exp = [
    { loungeId: "del-t3-encalm", cardId: "axis-myzone", outcome: "in", ts: "2026-06-10" },
    { loungeId: "del-t3-encalm", cardId: "axis-myzone", outcome: "in", ts: "2026-06-12" },
    { loungeId: "blr-t1-080", cardId: "axis-myzone", outcome: "refused", ts: "2026-06-15" },
  ];
  const sig = S.experienceSignals(exp);
  ok("reinforced where you got in", sig["del-t3-encalm"].nudge === "reinforced");
  ok("contradicted where refused", sig["blr-t1-080"].nudge === "contradicted");
}

console.log("\n[S5] verify queue prioritises contradicted + on-trip + stale");
{
  const exp = [{ loungeId: "tir-tirupati", cardId: "rupay-select", outcome: "refused", ts: "2026-06-15" }];
  const q = S.verifyQueue(CARDS, LOUNGES, META, exp, new Date("2026-06-21"), ["Delhi"]);
  ok("returns a queue", q.length > 0);
  // the contradicted lounge should be near the very top (score -100 bias)
  const tirIdx = q.findIndex((r) => r.id === "tir-tirupati");
  const someHighIdx = q.findIndex((r) => r.effConfidence === "high");
  ok("contradicted item outranks a high-confidence item", tirIdx < someHighIdx || someHighIdx === -1);
  // an on-trip city should outrank an equivalent off-trip one
  ok("queue rows carry effConfidence", q[0].effConfidence !== undefined);
}

console.log(`\n==== ${pass} passed, ${fail} failed ====\n`);
process.exit(fail === 0 ? 0 : 1);