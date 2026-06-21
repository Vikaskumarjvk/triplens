/* Node tests for the suggestion layer. Run: node tests-suggest.js */
const path = require("node:path");
globalThis.window = globalThis;
const S = require(path.join(__dirname, "suggest.js"));

let pass = 0, fail = 0;
const ok = (n, c) => { if (c) { pass++; console.log("  PASS:", n); } else { fail++; console.log("  FAIL:", n); } };

console.log("\n[SG1] validate");
ok("rejects empty", !S.validate(null).ok);
ok("rejects bad kind", !S.validate({ kind: "x", name: "a" }).ok);
ok("rejects no name", !S.validate({ kind: "lounge", name: "" }).ok);
ok("accepts good", S.validate({ kind: "lounge", name: "Indore Lounge" }).ok);

console.log("\n[SG2] make builds normalized record");
{
  const s = S.make("lounge", "Indore Domestic Lounge", "Indore", "near gate 3", 1000);
  ok("kind set", s.kind === "lounge");
  ok("id slugified", /^sug-1000-indore/.test(s.id));
  ok("status pending", s.status === "pending");
  ok("where captured", s.where === "Indore");
}

console.log("\n[SG3] add + dedupe");
{
  let list = [];
  const s = S.make("card", "New Card", "SomeBank", "", 1);
  list = S.add(list, s);
  list = S.add(list, s); // same id
  ok("added once", list.length === 1);
  const s2 = S.make("card", "Another", "Bank2", "", 2);
  list = S.add(list, s2);
  ok("second added", list.length === 2);
  let threw = false;
  try { S.add(list, { kind: "bad" }); } catch (e) { threw = true; }
  ok("invalid throws", threw);
}

console.log("\n[SG4] asPendingLounge");
{
  const s = S.make("lounge", "Test Lounge", "Testville", "note", 5);
  const l = S.asPendingLounge(s);
  ok("produces lounge record", l && l.name === "Test Lounge");
  ok("marked pending + low confidence", l.pending === true && l.confidence === "low");
  ok("card suggestion returns null", S.asPendingLounge(S.make("card", "X", "Y", "", 6)) === null);
}

console.log(`\n==== ${pass} passed, ${fail} failed ====\n`);
process.exit(fail === 0 ? 0 : 1);