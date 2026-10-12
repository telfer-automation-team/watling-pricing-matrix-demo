import { NextResponse } from "next/server";
import { deletePart } from "@/lib/store";
import { requireAdmin } from "@/lib/guard";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "admin only" }, { status: 403 });
  const { model, variant, service, partNo, isManual } = await request.json();
  if (!model || !variant || !service || !partNo) {
    return NextResponse.json({ error: "model, variant, service and part number are required" }, { status: 400 });
  }
  try {
    await deletePart({ model, variant, service, partNo, isManual: !!isManual, user: admin.fullName });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Could not delete part." }, { status: 500 });
  }
}
