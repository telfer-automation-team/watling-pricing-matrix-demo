import { NextResponse } from "next/server";
import { getActivities } from "@/lib/store";
import { requireAdmin } from "@/lib/guard";
export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "admin only" }, { status: 403 });
  return NextResponse.json({ activities: await getActivities() });
}

export const dynamic = "force-dynamic";
