import { NextResponse } from "next/server";
import { getEffectivePrice, setPriceOverride, clearPriceOverride } from "@/lib/store";
import { requireAdmin } from "@/lib/guard";

export async function GET(request: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "admin only" }, { status: 403 });
  const partNo = new URL(request.url).searchParams.get("partNo") ?? "";
  if (!partNo) return NextResponse.json({ error: "partNo required" }, { status: 400 });
  return NextResponse.json(await getEffectivePrice(partNo));
}

export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "admin only" }, { status: 403 });
  const { partNo, cost, retail, clear, model, variant } = await request.json();
  if (!partNo) return NextResponse.json({ error: "partNo required" }, { status: 400 });
  try {
    if (clear) { await clearPriceOverride(partNo, admin.fullName, { model, variant }); return NextResponse.json({ ok: true, cleared: true }); }
    const c = Number(cost); const r = Number(retail);
    if (!Number.isFinite(c) || !Number.isFinite(r) || c < 0 || r < 0) return NextResponse.json({ error: "cost and retail must be valid numbers" }, { status: 400 });
    await setPriceOverride(partNo, c, r, admin.fullName, { model, variant });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Could not save price." }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
