"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Logo from "@/components/Logo";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [busy, setBusy] = useState<"" | "ms" | "engineer" | "admin">("");
  const [msg, setMsg] = useState("");

  async function microsoft() {
    setBusy("ms"); setMsg("");
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "azure",
        options: { redirectTo: `${location.origin}/auth/callback`, scopes: "openid email profile" },
      });
      if (error) { setMsg("Microsoft sign-in isn't switched on yet — use guest access below for now."); setBusy(""); }
      // on success the browser is redirected to Microsoft
    } catch {
      setMsg("Microsoft sign-in isn't switched on yet — use guest access below for now.");
      setBusy("");
    }
  }

  async function guest(role: "engineer" | "admin") {
    setBusy(role);
    try {
      await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role }) });
      router.push("/quote"); router.refresh();
    } finally { setBusy(""); }
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
          <p className="mt-1 text-sm text-white/55">Use your Watling work account.</p>

          <button type="button" onClick={microsoft} disabled={!!busy}
            className="mt-5 flex w-full items-center justify-center gap-2.5 rounded-[10px] bg-white px-5 py-3 text-base font-semibold text-[#1b1b1b] transition-opacity hover:opacity-90 disabled:opacity-60">
            <MsLogo /> {busy === "ms" ? "Opening Microsoft…" : "Sign in with Microsoft"}
          </button>

          {msg && <p className="mt-3 rounded-lg border border-[var(--color-brand)]/30 bg-[var(--color-brand)]/10 px-3 py-2 text-xs text-white/80">{msg}</p>}

          <div className="my-6 flex items-center gap-3 text-[11px] uppercase tracking-wide text-white/30">
            <span className="h-px flex-1 bg-white/10" /> Guest access · for testing <span className="h-px flex-1 bg-white/10" />
          </div>

          <div className="space-y-2.5">
            <button type="button" onClick={() => guest("admin")} disabled={!!busy}
              className="w-full rounded-[10px] border border-white/20 bg-transparent px-5 py-2.5 text-sm font-medium text-white/90 transition-colors hover:bg-white/10 disabled:opacity-60">
              {busy === "admin" ? "Signing in…" : "Continue as Guest Admin"}
            </button>
            <button type="button" onClick={() => guest("engineer")} disabled={!!busy}
              className="w-full rounded-[10px] border border-white/20 bg-transparent px-5 py-2.5 text-sm font-medium text-white/90 transition-colors hover:bg-white/10 disabled:opacity-60">
              {busy === "engineer" ? "Signing in…" : "Continue as Guest Engineer"}
            </button>
          </div>
          <p className="mt-4 text-center text-[11px] leading-relaxed text-white/35">
            Guest access is temporary for testing and will be removed once Microsoft sign-in is live.
          </p>
        </div>

        <p className="mt-6 text-center text-[11px] tracking-wide text-white/25">
          Powered by <span className="font-semibold text-[var(--color-brand)]">Optavo</span>
        </p>
      </div>
    </div>
  );
}

function MsLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 23 23" aria-hidden>
      <rect width="10" height="10" x="1" y="1" fill="#F25022" />
      <rect width="10" height="10" x="12" y="1" fill="#7FBA00" />
      <rect width="10" height="10" x="1" y="12" fill="#00A4EF" />
      <rect width="10" height="10" x="12" y="12" fill="#FFB900" />
    </svg>
  );
}
