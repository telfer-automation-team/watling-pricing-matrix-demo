import { NextResponse } from "next/server";
import { restorePart } from "@/lib/store";
import { requireAdmin } from "@/lib/guard";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "admin only" }, { status: 403 });
  const { id } = await request.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  try {
    await restorePart(String(id), admin.fullName);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Could not restore." }, { status: 500 });
  }
}
