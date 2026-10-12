import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";

// Admin area is only for admins. Engineers are bounced back to the quote screen.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) redirect("/login");
  if (sessionUser.role !== "admin") redirect("/quote");
  return <>{children}</>;
}
