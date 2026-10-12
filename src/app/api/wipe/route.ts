import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/guard";
import { wipeData } from "@/lib/store";
export const dynamic = "force-dynamic";

export const maxDuration = 120;
const WIPE_PASSWORD = process.env.WIPE_PASSWORD || "watling-wipe";

export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "admin only" }, { status: 403 });

  let password = "";
  try { ({ password } = await request.json()); } catch { /* ignore */ }
  if (password !== WIPE_PASSWORD) return NextResponse.json({ error: "Incorrect password." }, { status: 401 });

  try {
    const status = await wipeData(admin.fullName);
    return NextResponse.json({ ok: true, status });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Wipe failed." }, { status: 500 });
  }
}
