"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Logo from "@/components/Logo";

export default function LoginPage() {
  const router = useRouter();
  const [busy, setBusy] = useState<"" | "engineer" | "admin">("");

  async function signIn(role: "engineer" | "admin") {
    setBusy(role);
    try {
      await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      router.push("/quote");
      router.refresh();
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-[var(--color-sidebar)] p-6">
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{ backgroundImage: "repeating-linear-gradient(45deg, #fcb515 0 2px, transparent 2px 22px)" }} />
      <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-[var(--color-brand)] opacity-10 blur-3xl" />

      <div className="relative w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <Logo width={132} />
          <h1 className="mt-6 wordmark text-2xl text-white">Pricing Matrix</h1>
          <p className="mt-1 text-sm text-white/50">Watling JCB · Service pricing portal</p>
        </div>

        <div className="card border-white/10 bg-white/[0.04] p-7 backdrop-blur">
          <h2 className="wordmark text-lg text-white">Sign in</h2>
          <p className="mt-1 text-sm text-white/55">
            Choose how to enter the portal. (Microsoft sign-in is added in the final phase.)
          </p>

          <div className="mt-6 space-y-3">
            <button type="button" onClick={() => signIn("engineer")} disabled={!!busy}
              className="btn-primary w-full text-base disabled:opacity-60">
              {busy === "engineer" ? "Signing in…" : "Sign in as Engineer"}
            </button>
            <button type="button" onClick={() => signIn("admin")} disabled={!!busy}
              className="w-full rounded-[10px] border border-white/20 bg-transparent px-5 py-3 text-base font-semibold text-white transition-colors hover:bg-white/10 disabled:opacity-60">
              {busy === "admin" ? "Signing in…" : "Sign in as Admin (Andy)"}
            </button>
          </div>

          <p className="mt-6 text-center text-xs leading-relaxed text-white/35">
            Interim access for demos. In production this becomes your Watling work-email sign-in.
          </p>
        </div>

        <p className="mt-6 text-center text-[11px] tracking-wide text-white/25">
          Powered by <span className="font-semibold text-[var(--color-brand)]">Optavo</span>
        </p>
      </div>
    </div>
  );
}
