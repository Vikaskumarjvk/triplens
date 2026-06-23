/* apply-batch.js — surgically patch data/cards.js with VERIFIED lounge-term
 * changes from the workflow waves. Reads a JSON array of:
 *   { id, dv, per, gate, clear, src }
 * where:
 *   dv    = domesticVisits (number or "unlimited")
 *   per   = "year" | "quarter"
 *   gate  = null OR { amount, per, note } spendGate object
 *   clear = true to set programs: [] (card with no lounge should open none)
 *   src   = host string for the verify field
 * Every other card stays byte-for-byte unchanged.
 *
 * HONESTY GUARD: only entries carrying a src (verification source) apply.
 * Bounds each card block by BRACE-COUNTING so a nested spendGate object's
 * inner "}" never truncates the block (the silent-partial-apply bug).
 *
 * Run: node scripts/apply-batch.js /tmp/ll-batch8.json
 */
const fs = require("node:fs");
const path = require("node:path");
const CARDS = path.join(__dirname, "..", "data", "cards.js");
const inputPath = process.argv[2];
if (!inputPath) { console.error("usage: node scripts/apply-batch.js <batch.json>"); process.exit(1); }

const changes = JSON.parse(fs.readFileSync(inputPath, "utf8"));
globalThis.window = globalThis;
require(CARDS);
const byId = new Map(globalThis.LL_CARDS.map((c) => [c.id, c]));

let src = fs.readFileSync(CARDS, "utf8");
const applied = [], skipped = [];

function boundBlock(text, id) {
  const start = text.indexOf('id: "' + id + '"');
  if (start < 0) return null;
  const braceStart = text.lastIndexOf("{", start);
  if (braceStart < 0) return null;
  let depth = 0, inStr = false, strCh = "";
  for (let i = braceStart; i < text.length; i++) {
    const c = text[i];
    if (inStr) { if (c === "\\") { i++; continue; } if (c === strCh) inStr = false; continue; }
    if (c === '"' || c === "'") { inStr = true; strCh = c; continue; }
    if (c === "{") depth++;
    else if (c === "}") { depth--; if (depth === 0) return { braceStart, braceEnd: i }; }
  }
  return null;
}

function setField(block, field, valueLiteral) {
  // matches `field: <value>` up to the next `, key:` or closing of the object
  const re = new RegExp("(" + field + ":\\s*)(\\{[^}]*\\}|\"[^\"]*\"|[^,}]*?)(\\s*(?:,\\s*[a-zA-Z]+:|\\s*}))");
  if (re.test(block)) return block.replace(re, (m, p1, _old, p3) => p1 + valueLiteral + p3);
  return block;
}

for (const ch of changes) {
  if (!ch.src) { skipped.push({ id: ch.id, why: "no src (unverified)" }); continue; }
  if (!byId.has(ch.id)) { skipped.push({ id: ch.id, why: "id not in cards.js" }); continue; }
  const b = boundBlock(src, ch.id);
  if (!b) { skipped.push({ id: ch.id, why: "could not bound block" }); continue; }
  let block = src.slice(b.braceStart, b.braceEnd + 1);
  const before = block;

  if (ch.dv !== undefined && ch.dv !== null) {
    block = setField(block, "domesticVisits", ch.dv === "unlimited" ? '"unlimited"' : JSON.stringify(ch.dv));
  }
  if (ch.per) block = setField(block, "period", JSON.stringify(ch.per));
  // spendGate: null OR an object literal
  if (ch.gate === null) {
    block = setField(block, "spendGate", "null");
  } else if (ch.gate) {
    const g = "{ amount: " + JSON.stringify(ch.gate.amount) + ", per: " + JSON.stringify(ch.gate.per) + ", note: " + JSON.stringify(ch.gate.note) + " }";
    block = setField(block, "spendGate", g);
  }
  if (ch.clear) block = setField(block, "programs", "[]");
  block = setField(block, "confidence", '"high"');
  block = setField(block, "verify", JSON.stringify(ch.src + " (verified 2026-06-23)"));

  if (block !== before) {
    src = src.slice(0, b.braceStart) + block + src.slice(b.braceEnd + 1);
    applied.push(ch.id);
  } else {
    skipped.push({ id: ch.id, why: "no field changed" });
  }
}

fs.writeFileSync(CARDS, src);
console.log("APPLIED " + applied.length + ":");
applied.forEach((a) => console.log("  " + a));
console.log("SKIPPED " + skipped.length + ":");
skipped.forEach((s) => console.log("  " + s.id + " — " + s.why));
