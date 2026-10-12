import { NextResponse } from "next/server";
import { getUsers, setBanned } from "@/lib/store";
import { requireAdmin } from "@/lib/guard";
export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "admin only" }, { status: 403 });
  return NextResponse.json({ users: await getUsers() });
}
export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "admin only" }, { status: 403 });
  const { id, banned } = await request.json();
  const u = await setBanned(id, Boolean(banned), admin.fullName);
  if (!u) return NextResponse.json({ error: "user not found" }, { status: 404 });
  return NextResponse.json({ user: u });
}

export const dynamic = "force-dynamic";
