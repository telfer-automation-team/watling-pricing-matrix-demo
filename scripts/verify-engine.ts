// Run:  node --experimental-strip-types scripts/verify-engine.ts <sqt.csv> <price.csv>
import { readFileSync } from "node:fs";
import { buildPriceMap, quoteMachine, aggregateMachine, computePackage } from "../src/lib/pricing/engine.ts";
import { DEFAULT_RULES, type PartPrice, type SqtLine } from "../src/lib/pricing/types.ts";

// --- tiny CSV parser (handles quoted fields + commas + CRLF) ---
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQ = false;
      } else field += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === ",") { row.push(field); field = ""; }
      else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
      else if (c === "\r") { /* skip */ }
      else field += c;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

const num = (s: string) => parseFloat(String(s).replace(/,/g, "").trim()) || 0;

const [, , sqtPath, pricePath] = process.argv;

// ---- prices: header is the row containing "Part number" ----
const priceRows = parseCSV(readFileSync(pricePath, "utf8"));
const pHeaderIdx = priceRows.findIndex((r) => r.map((x) => x.trim()).includes("Part number"));
const pH = priceRows[pHeaderIdx].map((x) => x.trim());
const col = (name: string) => pH.indexOf(name);
const cPart = col("Part number"), cDesc = col("Description"), cStock = col("Stock Price"), cList = col("List Price");
const prices: PartPrice[] = [];
for (let i = pHeaderIdx + 1; i < priceRows.length; i++) {
  const r = priceRows[i];
  if (!r[cPart]) continue;
  prices.push({ partNo: r[cPart].trim(), description: (r[cDesc] || "").trim(), cost: num(r[cStock]), retail: num(r[cList]) });
}
const priceMap = buildPriceMap(prices);
console.log(`Loaded ${prices.length.toLocaleString()} price rows`);

// ---- SQT ----
const sqtRows = parseCSV(readFileSync(sqtPath, "utf8"));
const sH = sqtRows[0].map((x) => x.trim());
const s = (name: string) => sH.indexOf(name);
const sqt: SqtLine[] = [];
for (let i = 1; i < sqtRows.length; i++) {
  const r = sqtRows[i];
  if (!r[s("Model")]) continue;
  sqt.push({
    product: r[s("Product")], model: r[s("Model")], variant: r[s("Variant")],
    serviceInterval: r[s("Service Interval")], serviceDescription: r[s("Service Description")],
    labourHours: num(r[s("Labour Hours")]), partNo: (r[s("Part No.")] || "").trim(),
    partDescription: r[s("Part Description")], quantity: num(r[s("Quantity")]),
  });
}
console.log(`Loaded ${sqt.length.toLocaleString()} SQT lines`);

// ---- test TM110 ----
const tm110 = sqt.filter((l) => l.model === "TM110");
const rules = DEFAULT_RULES;

function assertClose(label: string, got: number, want: number, tol = 0.05) {
  const ok = Math.abs(got - want) <= tol;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}: got £${got.toFixed(2)}  want £${want.toFixed(2)}`);
  if (!ok) process.exitCode = 1;
}

const q1000 = quoteMachine(tm110, priceMap, rules, 900)!;
console.log(`\nTM110 @ 900h -> ${q1000.serviceDescription}`);
console.log(`  lubRetail £${q1000.lubRetail.toFixed(3)}  otherRetail £${q1000.otherRetail.toFixed(2)}  labour ${q1000.labourHours}`);
assertClose("TM110 1000hr retail", q1000.retail, 681.72);

const q500 = quoteMachine(tm110, priceMap, rules, 300)!;
console.log(`\nTM110 @ 300h -> ${q500.serviceDescription}`);
console.log(`  lubRetail £${q500.lubRetail.toFixed(3)}  otherRetail £${q500.otherRetail.toFixed(2)}  labour ${q500.labourHours}`);
assertClose("TM110 500hr retail", q500.retail, 582.24);

// package: next 3 services from 900h
const services = aggregateMachine(tm110, priceMap);
const pkg = computePackage(services, rules, 900, 3)!;
console.log(`\nPackage (next 3 from 900h): subtotal £${pkg.subtotal} - ${(pkg.discount * 100)}% = £${pkg.total}`);
pkg.services.forEach((s) => console.log(`  ${s.serviceDescription}: base £${s.baseRetail} -> inflated £${s.inflatedRetail}`));

console.log("\nprofit check (1000hr): retail £" + q1000.retail + "  cost £" + q1000.cost + "  profit £" + q1000.profit + "  margin " + (q1000.margin * 100).toFixed(1) + "%");
