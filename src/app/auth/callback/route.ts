import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { SESSION_COOKIE } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

// Emails that should be Admins (comma-separated in ADMIN_EMAILS). Everyone else = engineer.
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);

// Build the real public URL. Behind Railway's proxy, request.url is the internal
// localhost:8080 address, so we prefer an explicit env var, then forwarded headers.
function getBaseUrl(request: Request, fallbackOrigin: string) {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto") ?? "https";
  if (forwardedHost) return `${forwardedProto}://${forwardedHost}`;
  return fallbackOrigin;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const baseUrl = getBaseUrl(request, url.origin);
  const code = url.searchParams.get("code");
  if (!code) return NextResponse.redirect(`${baseUrl}/login?error=missing_code`);

  const store = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => store.getAll(),
        setAll: (list: { name: string; value: string; options: CookieOptions }[]) => list.forEach(({ name, value, options }) => store.set(name, value, options)),
      },
    }
  );

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) return NextResponse.redirect(`${baseUrl}/login?error=auth`);

  const user = data.user;
  const email = (user.email ?? "").toLowerCase();
  const fullName = (user.user_metadata?.name as string) || (user.user_metadata?.full_name as string) || email || "User";

  // role: existing profile wins, else admin-email list, else engineer
  let role: "admin" | "engineer" = "engineer";
  let banned = false;
  try {
    const { data: prof } = await supabaseAdmin().from("profiles").select("role,banned").eq("id", user.id).maybeSingle();
    if (prof?.banned) banned = true;
    if (prof?.role === "admin" || ADMIN_EMAILS.includes(email)) role = "admin";
  } catch { /* profiles optional */ }

  if (banned) return NextResponse.redirect(`${baseUrl}/login?error=banned`);

  // record the user so they appear on the admin Users page
  try {
    await supabaseAdmin().from("profiles").upsert({ id: user.id, email, full_name: fullName, role }, { onConflict: "id" });
  } catch { /* best effort — login still works if profiles schema differs */ }

  // our app session cookie (the rest of the app reads this)
  store.set(SESSION_COOKIE, JSON.stringify({ id: user.id, email, fullName, role }), {
    httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30,
  });

  return NextResponse.redirect(`${baseUrl}/quote`);
}

export const dynamic = "force-dynamic";
