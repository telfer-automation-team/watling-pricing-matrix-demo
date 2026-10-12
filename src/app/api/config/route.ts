import { NextResponse } from "next/server";
import { getRules, setRules } from "@/lib/store";
import { requireAdmin } from "@/lib/guard";
export async function GET() {
  return NextResponse.json({ rules: await getRules() });
}
export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "admin only" }, { status: 403 });
  const body = await request.json();
  return NextResponse.json({ rules: await setRules(body, admin.fullName) });
}

export const dynamic = "force-dynamic";
