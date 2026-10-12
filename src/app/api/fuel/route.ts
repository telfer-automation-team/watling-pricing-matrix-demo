import { NextResponse } from "next/server";
import { setFuelRule } from "@/lib/store";
import { requireAdmin } from "@/lib/guard";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "admin only" }, { status: 403 });
  const { partNo, isFuel, scope, model, variant, service, description } = await request.json();
  if (!partNo || typeof isFuel !== "boolean") return NextResponse.json({ error: "partNo and isFuel required" }, { status: 400 });
  const sc = scope === "all" ? "all" : "service";
  if (sc === "service" && (!model || !variant || !service)) {
    return NextResponse.json({ error: "model, variant and service required for a per-service mark" }, { status: 400 });
  }
  await setFuelRule(partNo, isFuel, sc, { model, variant, service, description, user: admin.fullName });
  return NextResponse.json({ ok: true });
}
