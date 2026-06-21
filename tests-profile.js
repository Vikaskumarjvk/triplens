/* Node tests for profile sync + sources links. Run: node tests-profile.js */
const path = require("node:path");
globalThis.window = globalThis;
require(path.join(__dirname, "data", "cards.js"));
require(path.join(__dirname, "data", "lounges.js"));
require(path.join(__dirname, "data", "sources.js"));
const P = require(path.join(__dirname, "profile.js"));

let pass = 0, fail = 0;
const ok = (n, c) => { if (c) { pass++; console.log("  PASS:", n); } else { fail++; console.log("  FAIL:", n); } };

console.log("\n[P1] encode -> decode roundtrip");
{
  const state = { profileName: "Vikas", wallet: ["rupay-select", "axis-myzone"], visitLog: [{ cardId: "axis-myzone", ts: "2026-06-10" }], spend: { "hdfc-millennia": 50000 }, trip: ["Hyderabad", "Delhi"], experiences: [], mode: "advanced" };
  const code = P.encodeState(state);
  ok("code is non-empty string", typeof code === "string" && code.length > 10);
  ok("code is URL-safe (no + / =)", !/[+/=]/.test(code));
  const back = P.decodeState(code);
  ok("name survives", back.name === "Vikas");
  ok("wallet survives", back.wallet.length === 2 && back.wallet.includes("rupay-select"));
  ok("spend survives", back.spend["hdfc-millennia"] === 50000);
  ok("trip survives", back.trip[1] === "Delhi");
}

console.log("\n[P2] decode rejects junk");
{
  let threw = false;
  try { P.decodeState("not-a-real-code!!!"); } catch (e) { threw = true; }
  ok("throws on junk", threw);
  let threw2 = false;
  try { P.decodeState(""); } catch (e) { threw2 = true; }
  ok("throws on empty", threw2);
}

console.log("\n[P3] mergeInto unions wallet, merges history, maxes spend");
{
  const cur = { profileName: "", wallet: ["axis-myzone"], visitLog: [{ cardId: "axis-myzone", ts: "2026-06-01" }], spend: { "hdfc-millennia": 30000 }, trip: ["Hyderabad"], experiences: [], mode: "simple" };
  const incoming = { t: "LL1", name: "Vikas", wallet: ["rupay-select", "axis-myzone"], visitLog: [{ cardId: "rupay-select", ts: "2026-06-05" }, { cardId: "axis-myzone", ts: "2026-06-01" }], spend: { "hdfc-millennia": 80000 }, trip: ["Hyderabad", "Goa"], experiences: [{ loungeId: "del-t3-encalm", cardId: "rupay-select", outcome: "in", ts: "2026-06-09" }], mode: "advanced" };
  P.mergeInto(cur, incoming);
  ok("wallet unioned (no dup)", cur.wallet.length === 2 && cur.wallet.includes("rupay-select"));
  ok("name adopted", cur.profileName === "Vikas");
  ok("visitLog merged + deduped", cur.visitLog.length === 2); // shared axis visit deduped
  ok("spend takes higher", cur.spend["hdfc-millennia"] === 80000);
  ok("experiences merged", cur.experiences.length === 1);
  ok("trip replaced from incoming", cur.trip.length === 2 && cur.trip[1] === "Goa");
}

console.log("\n[P4] sources: link builders produce useful links");
{
  const card = global.LL_CARDS.find((c) => c.id === "hdfc-infinia");
  const cl = global.LL_SOURCE_LINKS.forCard(card);
  ok("card links non-empty", cl.length > 0);
  ok("card links include an official link", cl.some((l) => l.kind === "official"));
  ok("card links include community info", cl.some((l) => l.kind === "info"));
  const lounge = global.LL_LOUNGES.find((l) => l.id === "del-t3-encalm");
  const ll = global.LL_SOURCE_LINKS.forLounge(lounge);
  ok("lounge links non-empty", ll.length > 0);
  ok("lounge links include an access service", ll.some((l) => l.kind === "access"));
  // a dreamfolks lounge should surface DreamFolks
  ok("dreamfolks lounge surfaces DreamFolks", ll.some((l) => /DreamFolks/i.test(l.label)));
}

console.log("\n[P5] sources registry has a disclaimer + ratings");
{
  ok("disclaimer present", typeof global.LL_SOURCES.disclaimer === "string" && global.LL_SOURCES.disclaimer.length > 20);
  ok("every access source has reliability 1-5", global.LL_SOURCES.access.every((s) => s.reliability >= 1 && s.reliability <= 5));
  ok("every info source has a url", global.LL_SOURCES.info.every((s) => !!s.url));
}

console.log(`\n==== ${pass} passed, ${fail} failed ====\n`);
process.exit(fail === 0 ? 0 : 1);