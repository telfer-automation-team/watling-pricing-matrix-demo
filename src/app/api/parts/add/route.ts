import { NextResponse } from "next/server";
import { addManualPart } from "@/lib/store";
import { requireAdmin } from "@/lib/guard";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "admin only" }, { status: 403 });
  const { model, variant, service, partNo, description, quantity, isFuel, cost, retail } = await request.json();
  if (!model || !variant || !service || !partNo) {
    return NextResponse.json({ error: "model, variant, service and part number are required" }, { status: 400 });
  }
  const qty = Number(quantity);
  if (!Number.isFinite(qty) || qty <= 0) return NextResponse.json({ error: "quantity must be a positive number" }, { status: 400 });
  const c = cost === "" || cost == null ? null : Number(cost);
  const r = retail === "" || retail == null ? null : Number(retail);
  try {
    await addManualPart({ model, variant, service, partNo: String(partNo).trim(), description: description ?? "", quantity: qty, isFuel: !!isFuel, cost: c, retail: r, user: admin.fullName });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Could not add part." }, { status: 500 });
  }
}
