/* Tests for transport-engine.js + data/transport.js. node tests-transport.js */
"use strict";
const assert = require("assert");
global.window = global;
require("./geo-engine.js");
require("./data/transport.js");
const T = require("./transport-engine.js");

let pass = 0, fail = 0;
function ok(n, fn) { try { fn(); pass++; } catch (e) { fail++; console.log("  ✗", n, "\n     " + e.message); } }

// ---- slug ----------------------------------------------------------------
ok("slug lowercases + hyphenates", () => assert.strictEqual(T.slug("New Delhi"), "new-delhi"));
ok("slug strips parens (Goa (Dabolim) -> goa)", () => assert.strictEqual(T.slug("Goa (Dabolim)"), "goa"));
ok("slug handles extra spaces", () => assert.strictEqual(T.slug("  Port  Blair "), "port-blair"));

// ---- ddmmmyyyy -----------------------------------------------------------
ok("ddmmmyyyy formats redBus style", () => assert.strictEqual(T.ddmmmyyyy("2026-10-05"), "05-Oct-2026"));
ok("ddmmmyyyy empty on bad", () => assert.strictEqual(T.ddmmmyyyy("nope"), ""));

// ---- buildLink: TRAIN (verified formats) ---------------------------------
ok("ixigo trains slug link (browser-verified format)", () => {
  const p = window.LL_TRANSPORT.trains.find((x) => x.id === "ixigo-trains");
  const u = T.buildLink(p, "Delhi", "Jaipur", "2026-10-05");
  assert.strictEqual(u, "https://www.ixigo.com/trains/delhi-to-jaipur");
});
ok("confirmtkt slug link", () => {
  const p = window.LL_TRANSPORT.trains.find((x) => x.id === "confirmtkt");
  assert.ok(T.buildLink(p, "Delhi", "Jaipur", "").includes("/delhi-to-jaipur"));
});
ok("irctc search-page returns its url (no placeholders)", () => {
  const p = window.LL_TRANSPORT.trains.find((x) => x.id === "irctc");
  const u = T.buildLink(p, "Delhi", "Jaipur", "2026-10-05");
  assert.strictEqual(u, "https://www.irctc.co.in/nget/train-search");
});

// ---- buildLink: BUS (verified formats) -----------------------------------
ok("redBus slug link (browser-verified format)", () => {
  const p = window.LL_TRANSPORT.buses.find((x) => x.id === "redbus");
  assert.strictEqual(T.buildLink(p, "Delhi", "Jaipur", "2026-10-05"), "https://www.redbus.in/bus-tickets/delhi-to-jaipur");
});
ok("paytm bus prefilled with date", () => {
  const p = window.LL_TRANSPORT.buses.find((x) => x.id === "paytm-bus");
  const u = T.buildLink(p, "Delhi", "Jaipur", "2026-10-05");
  assert.ok(u.includes("/bus/search/Delhi/Jaipur/2026-10-05/1"), u);
});
ok("paytm bus without date falls back to origin (no broken placeholder)", () => {
  const p = window.LL_TRANSPORT.buses.find((x) => x.id === "paytm-bus");
  const u = T.buildLink(p, "Delhi", "Jaipur", "");
  assert.ok(!/\{/.test(u), "no leftover placeholder: " + u);
  assert.ok(/^https:\/\/tickets\.paytm\.com\/$/.test(u), "origin fallback: " + u);
});

// ---- duration estimates --------------------------------------------------
ok("train time scales with distance", () => {
  const short = T.trainTimeMin(250), long = T.trainTimeMin(1000);
  assert.ok(short < long && short > 200 && short < 360, "250km train ~4-5h, got " + T.fmtDur(short));
});
ok("bus slower than train for same distance", () => assert.ok(T.busTimeMin(500) > T.trainTimeMin(500)));
ok("fmtDur formats", () => { assert.strictEqual(T.fmtDur(305), "5h 5m"); assert.strictEqual(T.fmtDur(40), "40m"); });

// ---- compareModes by REAL distance ---------------------------------------
ok("short route (DEL-JAI ~240km) recommends train/bus over flying", () => {
  const c = T.compareModes("DEL", "JAI");
  assert.ok(c, "got a comparison");
  assert.strictEqual(c.recommend, "train_bus");
  const fly = c.modes.find((m) => m.mode === "flight");
  assert.ok(/rarely worth it/.test(fly.note), "flight flagged not-worth-it short");
});
ok("medium route (DEL-BOM ~1135km) leans fly_or_overnight_train", () => {
  const c = T.compareModes("DEL", "BOM");
  assert.strictEqual(c.recommend, "fly_or_overnight_train");
});
ok("long route (DEL-MAA ~1760km) recommends fly", () => {
  const c = T.compareModes("DEL", "MAA");
  assert.strictEqual(c.recommend, "fly");
});
ok("compareModes returns 3 modes always", () => {
  const c = T.compareModes("DEL", "BOM");
  assert.deepStrictEqual(c.modes.map((m) => m.mode), ["flight", "train", "bus"]);
});
ok("compareModes accepts explicit km override", () => {
  const c = T.compareModes("XXX", "YYY", { km: 200 });
  assert.strictEqual(c.recommend, "train_bus");
});
ok("compareModes null when distance unknown", () => assert.strictEqual(T.compareModes("DEL", "ZZZ"), null));

// ---- options builders ----------------------------------------------------
ok("trainOptions builds every provider link", () => {
  const opts = T.trainOptions(window.LL_TRANSPORT, "Delhi", "Jaipur", "2026-10-05");
  assert.strictEqual(opts.length, window.LL_TRANSPORT.trains.length);
  opts.forEach((o) => { assert.ok(/^https:\/\//.test(o.link)); assert.ok(!/\{/.test(o.link)); });
});
ok("busOptions builds every provider link", () => {
  const opts = T.busOptions(window.LL_TRANSPORT, "Delhi", "Jaipur", "2026-10-05");
  assert.strictEqual(opts.length, window.LL_TRANSPORT.buses.length);
  opts.forEach((o) => { assert.ok(/^https:\/\//.test(o.link)); assert.ok(!/\{/.test(o.link)); });
});

// ---- honesty: every provider + offer tagged ------------------------------
ok("every train/bus provider has confidence + verify", () => {
  [...window.LL_TRANSPORT.trains, ...window.LL_TRANSPORT.buses].forEach((p) => {
    assert.ok(["high", "med", "low"].includes(p.confidence), p.id + " bad confidence");
    assert.ok(p.verify, p.id + " missing verify");
  });
});
ok("no fabricated price anywhere in transport data", () => {
  assert.ok(!/₹\s?\d/.test(JSON.stringify(window.LL_TRANSPORT)), "found a hardcoded rupee price");
});

// ---- door-to-door (honest total time, not just air time) -----------------
ok("door-to-door flight adds airport overhead (slower than raw air time)", () => {
  const air = T.doorToDoorMin("flight", 1135, 110);
  assert.ok(air > 110 + 120, "flight door-to-door should add big airport buffer, got " + T.fmtDur(air));
});
ok("door-to-door train adds only small station overhead", () => {
  const d = T.doorToDoorMin("train", 240);
  assert.ok(d > T.trainTimeMin(240) && d <= T.trainTimeMin(240) + 60, "train overhead small");
});
ok("on a short hop, door-to-door shrinks flying's edge to a small gap (so it's not worth it)", () => {
  const G = require("./geo-engine.js");
  const km = G.distanceKm("DEL", "JAI");
  const air = G.flightTimeMin("DEL", "JAI");
  const flyD2D = T.doorToDoorMin("flight", km, air);
  const trainD2D = T.doorToDoorMin("train", km);
  // honest: flying can be a bit faster even here, but only by a small margin once
  // airport time is counted — which is why the recommendation is still train/bus.
  assert.ok(Math.abs(trainD2D - flyD2D) < 150, "gap should be small on a short hop, got " + T.fmtDur(Math.abs(trainD2D - flyD2D)));
});

// ---- rankModes (cheaper / faster / comfortable) --------------------------
ok("cheap priority puts bus first", () => {
  const r = T.rankModes("DEL", "BOM", "cheap");
  assert.strictEqual(r.ranked[0].mode, "bus");
});
ok("comfort priority puts train first", () => {
  const r = T.rankModes("DEL", "BOM", "comfort");
  assert.strictEqual(r.ranked[0].mode, "train");
});
ok("fast priority over a long route puts flight first (door-to-door)", () => {
  const r = T.rankModes("DEL", "MAA", "fast");
  assert.strictEqual(r.ranked[0].mode, "flight");
});
ok("fast priority always orders by door-to-door time (smallest first)", () => {
  const r = T.rankModes("DEL", "BOM", "fast");
  for (let i = 1; i < r.ranked.length; i++) {
    assert.ok((r.ranked[i - 1].d2d || 1e9) <= (r.ranked[i].d2d || 1e9), "ranked by d2d ascending");
  }
});
ok("rankModes always returns 3 modes with a why each", () => {
  const r = T.rankModes("DEL", "BOM", "cheap");
  assert.strictEqual(r.ranked.length, 3);
  r.ranked.forEach((x) => assert.ok(x.why && x.why.length, x.mode + " missing why"));
});
ok("rankModes null when distance unknown", () => assert.strictEqual(T.rankModes("DEL", "ZZZ", "fast"), null));

// ---- stopsGuidance (non-stop vs connecting, honest) ----------------------
ok("stops guidance short route nudges Non-stop filter", () => {
  const s = T.stopsGuidance(240);
  assert.ok(/non-stop/i.test(s.flight), s.flight);
});
ok("stops guidance long route mentions 1-stop hubs", () => {
  const s = T.stopsGuidance(2200);
  assert.ok(/1-stop|hub|Delhi|Mumbai|Bengaluru/i.test(s.flight), s.flight);
});
ok("stops guidance covers train class + bus directness (no fake schedules)", () => {
  const s = T.stopsGuidance(700);
  assert.ok(/class|express|Vande Bharat|Shatabdi|Rajdhani/i.test(s.train), s.train);
  assert.ok(/direct|sleeper|seater/i.test(s.bus), s.bus);
});
ok("stops guidance null when distance unknown", () => assert.strictEqual(T.stopsGuidance(null), null));

// ---- compareModes now carries door-to-door labels ------------------------
ok("compareModes modes carry a door-to-door label", () => {
  const c = T.compareModes("DEL", "BOM");
  c.modes.forEach((m) => { if (m.mode !== "flight" || m.timeMin != null) assert.ok(m.d2dLabel, m.mode + " missing d2dLabel"); });
});

console.log(`\n==== ${pass} passed, ${fail} failed ====`);
process.exit(fail ? 1 : 0);
