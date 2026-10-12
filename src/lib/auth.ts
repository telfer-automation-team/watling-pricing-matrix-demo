import { cookies } from "next/headers";

export type Role = "admin" | "engineer";
export type SessionUser = { id: string; email: string; fullName: string; role: Role };

const COOKIE = "wpm_session";

// NOTE: interim sign-in for the pre-Entra phase. Any click signs you in.
// Swap this for the Supabase Azure/Entra provider in the final phase
// (the Supabase client + middleware files are kept for that).
export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const raw = store.get(COOKIE)?.value;
  if (!raw) return null;
  try {
    const s = JSON.parse(raw) as SessionUser;
    if (!s?.role) return null;
    return s;
  } catch {
    return null;
  }
}

export const SESSION_COOKIE = COOKIE;
