import type { PartPrice, SqtLine } from "@/lib/pricing/types";

// RFC-ish CSV parser (quoted fields, commas, CRLF).
export function parseCSV(text: string): string[][] {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); // strip UTF-8 BOM
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

const num = (s: string) => parseFloat(String(s ?? "").replace(/,/g, "").trim()) || 0;

export function detectFileKind(headerCells: string[]): "price" | "sqt" | "unknown" {
  const h = headerCells.map((x) => x.trim().toLowerCase());
  if (h.includes("part number") && (h.includes("list price") || h.includes("stock price"))) return "price";
  if (h.includes("service description") && h.includes("part no.")) return "sqt";
  return "unknown";
}

export function parsePriceFile(text: string): PartPrice[] {
  const rows = parseCSV(text);
  const headerIdx = rows.findIndex((r) => r.map((x) => x.trim()).includes("Part number"));
  if (headerIdx < 0) throw new Error("Price file: could not find a 'Part number' header row.");
  const H = rows[headerIdx].map((x) => x.trim());
  const c = (n: string) => H.indexOf(n);
  const cPart = c("Part number"), cDesc = c("Description"), cStock = c("Stock Price"), cList = c("List Price");
  const out: PartPrice[] = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i];
    const pn = (r[cPart] || "").trim();
    if (!pn) continue;
    out.push({ partNo: pn, description: (r[cDesc] || "").trim(), cost: num(r[cStock]), retail: num(r[cList]) });
  }
  return out;
}

export function parseSqtFile(text: string): SqtLine[] {
  const rows = parseCSV(text);
  if (rows.length === 0) return [];
  const H = rows[0].map((x) => x.trim());
  const c = (n: string) => H.indexOf(n);
  const out: SqtLine[] = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const model = r[c("Model")];
    if (!model) continue;
    out.push({
      product: r[c("Product")], model, variant: r[c("Variant")],
      serviceInterval: r[c("Service Interval")], serviceDescription: r[c("Service Description")],
      labourHours: num(r[c("Labour Hours")]), partNo: (r[c("Part No.")] || "").trim(),
      partDescription: r[c("Part Description")], quantity: num(r[c("Quantity")]),
    });
  }
  return out;
}
