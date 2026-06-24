/* Node self-test for the flight engine. Run: node tests-flights.js */
const path = require("path");
global.window = global;
require(path.join(__dirname, "data", "cards.js"));
require(path.join(__dirname, "data", "flights.js"));
const FE = require(path.join(__dirname, "flight-engine.js"));

const CARDS = global.LL_CARDS;
const FL = global.LL_FLIGHTS;

let pass = 0, fail = 0;
function ok(name, cond) { if (cond) { pass++; console.log("  PASS:", name); } else { fail++; console.log("  FAIL:", name); } }

console.log("\n[1] dateParts");
{
  const dp = FE.dateParts("2026-07-12");
  ok("ymd", dp.ymd === "2026-07-12");
  ok("yymmdd", dp.yymmdd === "260712");
  ok("ddmmyyyy", dp.ddmmyyyy === "12/07/2026");
  ok("text", dp.text === "12 Jul 2026");
  ok("bad date => null", FE.dateParts("nope") === null);
}

console.log("\n[2] buildLink fills prefilled templates");
{
  const g = FL.providers.find((p) => p.id === "google-flights");
  const url = FE.buildLink(g, "del", "bom", "2026-07-12");
  ok("FROM upper", url.includes("DEL"));
  ok("TO upper", url.includes("BOM"));
  ok("date in url", url.includes("2026-07-12"));
  const ix = FL.providers.find((p) => p.id === "ixigo-meta");
  const iu = FE.buildLink(ix, "DEL", "BOM", "2026-07-12");
  ok("ixigo meta carries route codes", iu.includes("from=DEL") && iu.includes("to=BOM"));
  ok("ixigo meta plain ddmmyyyy date", iu.includes("date=12072026"));
}

console.log("\n[3] buildLink handles search-page (no date placeholder)");
{
  const indigo = FL.providers.find((p) => p.id === "indigo");
  const url = FE.buildLink(indigo, "DEL", "BOM", "2026-07-12");
  ok("returns the site url", url === "https://www.goindigo.in/");
}

console.log("\n[4] buildLink with missing date falls back, never returns a broken template");
{
  const mmt = FL.providers.find((p) => p.id === "makemytrip");
  const url = FE.buildLink(mmt, "DEL", "BOM", "");
  ok("no leftover {DATE} placeholder", !/\{DATE/.test(url));
  ok("falls back to origin", url.startsWith("https://www.makemytrip.com"));
}

console.log("\n[5] providersFor orders meta -> airline -> ota");
{
  const list = FE.providersFor(FL);
  const firstMeta = list.findIndex((p) => p.type === "meta");
  const firstOta = list.findIndex((p) => p.type === "ota");
  const lastAirline = list.map((p) => p.type).lastIndexOf("airline");
  ok("meta comes first", firstMeta === 0);
  ok("ota comes after airlines", firstOta > lastAirline);
  const onlyAir = FE.providersFor(FL, { type: "airline" });
  ok("type filter works", onlyAir.every((p) => p.type === "airline") && onlyAir.length > 0);
}

console.log("\n[6] offersForProvider matches wallet by issuer");
{
  const mmt = FL.providers.find((p) => p.id === "makemytrip");
  const hdfcCard = CARDS.find((c) => c.issuer === "HDFC");
  const offers = FE.offersForProvider(mmt, [hdfcCard]);
  const hdfcOffer = offers.find((o) => o.offer.id === "mmt-hdfc");
  ok("HDFC offer flagged in-wallet when you hold an HDFC card", hdfcOffer.inWallet === true);
  ok("HDFC offer lists the matched card", hdfcOffer.matchedCards.length >= 1);
  // an ICICI-only offer should NOT be in-wallet for an HDFC-only wallet
  const iciciOffer = offers.find((o) => o.offer.id === "mmt-icici");
  ok("ICICI offer not in-wallet for HDFC-only wallet", iciciOffer.inWallet === false);
  // empty wallet => no card offer is in-wallet
  const none = FE.offersForProvider(mmt, []);
  ok("empty wallet => no in-wallet card offers", none.filter((o) => o.inWallet).length === 0);
}

console.log("\n[7] comparison builds per-provider rows with links + wallet hits");
{
  const hdfcCard = CARDS.find((c) => c.issuer === "HDFC");
  const cmp = FE.comparison(FL, "DEL", "BOM", "2026-07-12", [hdfcCard]);
  ok("returns a row per provider", cmp.length === FL.providers.length);
  ok("every row has a link", cmp.every((r) => typeof r.link === "string" && r.link.startsWith("http")));
  const mmtRow = cmp.find((r) => r.provider.id === "makemytrip");
  ok("MMT row counts the HDFC wallet hit", mmtRow.walletHits >= 1);
  const googleRow = cmp.find((r) => r.provider.id === "google-flights");
  ok("google row is prefilled", googleRow.prefilled === true);
}

console.log("\n[8] bestPay ranks wallet cards by provider-offer coverage");
{
  const hdfc = CARDS.find((c) => c.issuer === "HDFC");
  const icici = CARDS.find((c) => c.issuer === "ICICI");
  const ranked = FE.bestPay(FL, [hdfc, icici]);
  ok("returns ranked cards that have offers", ranked.length >= 1);
  ok("each ranked card lists providers", ranked[0].providers.length >= 1);
  ok("points are positive", ranked[0].points > 0);
  // a wallet with no offer-matching issuer returns empty
  const noOffer = CARDS.find((c) => c.issuer === "Various");
  const emptyRank = FE.bestPay(FL, noOffer ? [noOffer] : []);
  ok("no-offer wallet => empty bestPay", emptyRank.length === 0);
}

console.log("\n[9] allOffers flattens provider offers + global coupons");
{
  const all = FE.allOffers(FL);
  ok("returns offers", all.length > 0);
  ok("includes a provider-tagged card offer", all.some((o) => o.kind === "card" && o.provider));
  ok("includes a global coupon", all.some((o) => o.kind === "coupon" || o.id && o.id.startsWith("cpn-")));
  ok("every offer carries a verify hint", all.every((o) => !!o.verify || !!o.note));
}

console.log("\n[10] airports list is sorted + covers majors");
{
  const ap = FE.airports(FL);
  ok("sorted by city", ap.map((a) => a.city).join("|") === ap.map((a) => a.city).slice().sort((a, b) => a.localeCompare(b)).join("|"));
  ok("has Delhi + Mumbai", ap.some((a) => a.code === "DEL") && ap.some((a) => a.code === "BOM"));
}

console.log("\n[11] honesty: no provider stores a fabricated price field");
{
  const hasPrice = FL.providers.some((p) => "price" in p || "fare" in p);
  ok("no provider has a price/fare field", hasPrice === false);
  ok("every offer is confidence-tagged", FE.allOffers(FL).every((o) => ["high", "med", "low"].includes(o.confidence)));
}

console.log(`\n==== ${pass} passed, ${fail} failed ====\n`);
process.exit(fail === 0 ? 0 : 1);
