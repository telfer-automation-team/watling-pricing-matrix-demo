"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import Logo from "./Logo";
import type { Role } from "@/lib/auth";

type NavItem = { href: string; label: string; adminOnly?: boolean };

const NAV: NavItem[] = [
  { href: "/quote", label: "Quote" },
  { href: "/admin/upload", label: "Upload data", adminOnly: true },
  { href: "/admin/parts", label: "Parts & fuel", adminOnly: true },
  { href: "/admin/pricing", label: "Pricing", adminOnly: true },
  { href: "/admin/config", label: "Rules & rates", adminOnly: true },
  { href: "/admin/users", label: "Users", adminOnly: true },
  { href: "/admin/history", label: "History", adminOnly: true },
  { href: "/admin/settings", label: "Settings", adminOnly: true },
];

import InstallButton from "@/components/InstallButton";

export default function AppShell({
  role,
  fullName,
  email,
  children,
}: {
  role: Role;
  fullName: string | null;
  email: string | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const items = NAV.filter((n) => !n.adminOnly || role === "admin");

  async function signOut() {
    await fetch("/auth/signout", { method: "POST", cache: "no-store" });
    window.location.replace("/login");
  }

  const initials = (fullName ?? email ?? "?")
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");

  return (
    <div className="flex h-dvh overflow-hidden">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 shrink-0 flex-col bg-[var(--color-sidebar)] text-white transition-transform md:static md:flex md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center gap-3 border-b border-white/10 px-5 py-5">
          <Logo width={64} />
          <div className="leading-tight">
            <div className="wordmark text-sm text-white">Pricing Matrix</div>
            <div className="text-xs text-white/45">Watling JCB</div>
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
          {items.map((n) => {
            const active = pathname === n.href || pathname.startsWith(n.href + "/");
            return (
              <Link
                key={n.href}
                href={n.href}
                onClick={() => setOpen(false)}
                className={`rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  active
                    ? "bg-[var(--color-brand)] text-black"
                    : "text-white/75 hover:bg-white/10 hover:text-white"
                }`}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-white/10 p-3">
          <div className="flex items-center gap-3 rounded-lg px-2 py-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--color-brand)] text-sm font-bold text-black">
              {initials || "?"}
            </div>
            <div className="min-w-0 flex-1 leading-tight">
              <div className="truncate text-sm text-white">{fullName ?? email}</div>
              <div className="truncate text-xs capitalize text-white/45">{role}</div>
            </div>
          </div>
          <InstallButton />
          <button
            onClick={signOut}
            className="mt-1 w-full rounded-lg px-3 py-2 text-left text-sm text-white/70 transition-colors hover:bg-white/10 hover:text-white"
          >
            Sign out
          </button>
          <div className="mt-3 px-2 text-[11px] tracking-wide text-white/30">
            Powered by <span className="font-semibold text-[var(--color-brand)]">Optavo</span>
          </div>
        </div>
      </aside>

      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Main column */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-[var(--color-line)] bg-[var(--color-surface)] px-4 py-3 md:hidden">
          <button
            onClick={() => setOpen(true)}
            className="rounded-md p-1.5 text-[var(--color-ink-2)] hover:bg-black/5"
            aria-label="Open menu"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
            </svg>
          </button>
          <Logo width={54} />
          <span className="wordmark text-sm">Pricing Matrix</span>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto p-5 md:p-8">{children}</main>
      </div>
    </div>
  );
}
