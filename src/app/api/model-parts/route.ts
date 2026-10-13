import { NextResponse } from "next/server";
import { getModelParts, getManualRows, listModels } from "@/lib/store";

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

type Occ = { hours: number; label: string; qty: number; cost: number; retail: number };
type CatalogItem = { partNo: string; description: string; isFuel: boolean; varies: boolean; occ: Occ[] };

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const model = searchParams.get("model");
  if (!model) return NextResponse.json({ models: await listModels() });

  const [variants, manualRows] = await Promise.all([getModelParts(model), getManualRows(model)]);

  // Catalogue of every part on this model, with its per-unit price on each service it
  // appears on — so selecting a part can auto-fill the right cost for the target service.
  const map = new Map<string, { partNo: string; description: string; isFuel: boolean; occ: Map<string, Occ> }>();
  for (const v of variants) {
    for (const sv of v.services) {
      for (const p of sv.parts) {
        if (p.note === "backfilled-fuel") continue;
        let e = map.get(p.partNo);
        if (!e) { e = { partNo: p.partNo, description: p.description || "", isFuel: !!p.isFuel, occ: new Map() }; map.set(p.partNo, e); }
        if (p.isFuel) e.isFuel = true;
        if (!e.description && p.description) e.description = p.description;
        const qty = Number(p.quantity) || 0;
        const perCost = qty > 0 ? r2(Number(p.lineCost ?? 0) / qty) : 0;
        const perRetail = qty > 0 ? r2(Number(p.lineRetail ?? 0) / qty) : 0;
        if (!e.occ.has(sv.serviceDescription)) {
          e.occ.set(sv.serviceDescription, { hours: sv.serviceHours, label: sv.serviceDescription, qty, cost: perCost, retail: perRetail });
        }
      }
    }
  }

  const catalog: CatalogItem[] = [...map.values()].map((e) => {
    const occ = [...e.occ.values()].sort((a, b) => a.hours - b.hours);
    const retails = new Set(occ.map((o) => o.retail));
    const costs = new Set(occ.map((o) => o.cost));
    return { partNo: e.partNo, description: e.description, isFuel: e.isFuel, varies: retails.size > 1 || costs.size > 1, occ };
  }).sort((a, b) => a.partNo.localeCompare(b.partNo));

  return NextResponse.json({ model, variants, manualRows, catalog });
}

export const dynamic = "force-dynamic";
