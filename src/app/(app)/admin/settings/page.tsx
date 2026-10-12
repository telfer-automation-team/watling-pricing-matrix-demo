"use client";
import { useState } from "react";

export default function SettingsPage() {
  const [password, setPassword] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function wipe() {
    setBusy(true); setMsg(null);
    try {
      const res = await fetch("/api/wipe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
      const text = await res.text();
      const d = text ? JSON.parse(text) : {};
      if (!res.ok || d.error) { setMsg({ ok: false, text: d.error || `Wipe failed (HTTP ${res.status})` }); return; }
      setMsg({ ok: true, text: "All pricing data has been wiped. Upload fresh files to rebuild." });
      setPassword(""); setConfirming(false);
    } catch (e) {
      setMsg({ ok: false, text: "Wipe failed — " + (e instanceof Error ? e.message : "unknown error") });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl text-[var(--color-ink)]">Settings</h1>
      <p className="mt-1 text-sm text-[var(--color-ink-2)]">Administrative controls.</p>

      <div className="card mt-6 border-[var(--color-danger)]/30 p-6">
        <div className="wordmark text-sm text-[var(--color-danger)]">Danger zone — wipe all data</div>
        <p className="mt-2 text-sm text-[var(--color-ink-2)]">
          Permanently removes every price, parts line and fuel mark. Quotes won&apos;t work until new
          files are uploaded. This clears the live database and cannot be undone.
        </p>

        {!confirming ? (
          <button onClick={() => { setConfirming(true); setMsg(null); }}
            className="mt-4 rounded-[10px] border border-[var(--color-danger)] px-4 py-2.5 text-sm font-semibold text-[var(--color-danger)] transition-colors hover:bg-[var(--color-danger)] hover:text-white">
            Wipe all data…
          </button>
        ) : (
          <div className="mt-4 space-y-3">
            <label className="block">
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-[var(--color-ink-3)]">Enter admin password to confirm</span>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password"
                className="w-full max-w-xs rounded-lg border border-[var(--color-line-strong)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--color-brand)]" />
            </label>
            <div className="flex items-center gap-3">
              <button onClick={wipe} disabled={busy || !password}
                className="rounded-[10px] bg-[var(--color-danger)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
                {busy ? "Wiping…" : "Confirm wipe"}
              </button>
              <button onClick={() => { setConfirming(false); setPassword(""); }}
                className="rounded-[10px] border border-[var(--color-line-strong)] px-4 py-2.5 text-sm font-medium hover:bg-black/5">
                Cancel
              </button>
            </div>
          </div>
        )}

        {msg && (
          <p className={`mt-4 text-sm ${msg.ok ? "text-[var(--color-ok)]" : "text-[var(--color-danger)]"}`}>{msg.text}</p>
        )}
      </div>

      <p className="mt-3 text-xs text-[var(--color-ink-3)]">
        The wipe password is set via the WIPE_PASSWORD environment variable (demo default: <code>watling-wipe</code>).
      </p>
    </div>
  );
}
