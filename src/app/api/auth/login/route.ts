import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, type Role } from "@/lib/auth";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const { role } = await request.json().catch(() => ({ role: "engineer" }));
  const r: Role = role === "admin" ? "admin" : "engineer";
  const session = {
    id: r === "admin" ? "u_andy" : "u_eng1",
    email: r === "admin" ? "andy@watling-jcb.com" : "engineer@watling-jcb.com",
    fullName: r === "admin" ? "Andy Wood" : "Field Engineer",
    role: r,
  };
  const store = await cookies();
  store.set(SESSION_COOKIE, JSON.stringify(session), {
    httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30,
  });
  return NextResponse.json({ ok: true });
}
