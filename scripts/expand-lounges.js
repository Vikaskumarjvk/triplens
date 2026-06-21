/* expand-lounges.js — add airports verified present on the Priority Pass India
 * list (2026-06-22) that the dataset was missing. Each gets a generic domestic
 * lounge entry, confidence "med", with a verify pointer — honest: the airport +
 * lounge access is real, the exact operator name is what to confirm. Dedupes by
 * airport code so we never double-add. Run: node scripts/expand-lounges.js
 */
const fs = require("fs");
const path = require("path");
const P = path.join(__dirname, "..", "data", "lounges.js");

global.window = {};
require(P);
const existing = window.LL_LOUNGES;
const haveCodes = new Set(existing.filter((l) => l.type === "airport").map((l) => l.airport));
const haveIds = new Set(existing.map((l) => l.id));

// airports confirmed on Priority Pass India list, with city names
const AIRPORTS = [
  { code: "IXA", city: "Agartala" },
  { code: "AYJ", city: "Ayodhya" },
  { code: "BHO", city: "Bhopal" },
  { code: "DIB", city: "Dibrugarh" },
  { code: "GWL", city: "Gwalior" },
  { code: "IXJ", city: "Jammu" },
  { code: "CNN", city: "Kannur" },
  { code: "IXD", city: "Prayagraj" },
];

const newLounges = [];
AIRPORTS.forEach((a) => {
  if (haveCodes.has(a.code)) return;
  const id = a.code.toLowerCase() + "-dom-lounge";
  if (haveIds.has(id)) return;
  newLounges.push({
    id, name: "Domestic Lounge", airport: a.code, terminal: "Domestic", city: a.city,
    type: "airport", area: "domestic",
    programs: ["dreamfolks", "priority"], confidence: "med",
    notes: "Listed on Priority Pass India network; confirm operator + your card in the DreamFolks/Priority Pass app.",
    verify: "Priority Pass India lounge list (2026-06-22) — confirm operator name + card access before you fly.",
  });
});

function ser(l) {
  return `  { id: ${JSON.stringify(l.id)}, name: ${JSON.stringify(l.name)}, airport: ${JSON.stringify(l.airport)}, terminal: ${JSON.stringify(l.terminal)}, city: ${JSON.stringify(l.city)}, type: ${JSON.stringify(l.type)}, area: ${JSON.stringify(l.area)},\n` +
    `    programs: ${JSON.stringify(l.programs)}, confidence: ${JSON.stringify(l.confidence)},\n` +
    `    notes: ${JSON.stringify(l.notes)}, verify: ${JSON.stringify(l.verify)} },`;
}

let src = fs.readFileSync(P, "utf8");
const block = "\n  // ====  AIRPORTS FROM PRIORITY PASS INDIA LIST (2026-06-22)  ====\n" + newLounges.map(ser).join("\n") + "\n";
const idx = src.lastIndexOf("\n];");
src = src.slice(0, idx) + "\n" + block + "];\n";
fs.writeFileSync(P, src);
console.log(`added ${newLounges.length} airports: ${newLounges.map((l) => l.airport).join(", ")}`);
