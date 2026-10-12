import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import AppShell from "@/components/AppShell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) redirect("/login");

  return (
    <AppShell
      role={sessionUser.role}
      fullName={sessionUser.fullName}
      email={sessionUser.email}
    >
      {children}
    </AppShell>
  );
}
