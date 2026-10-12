import { getSessionUser } from "@/lib/auth";

export async function requireAdmin() {
  const u = await getSessionUser();
  if (!u || u.role !== "admin") return null;
  return u;
}
