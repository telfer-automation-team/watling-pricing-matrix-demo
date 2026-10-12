"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

type Activity = { id: string; at: string; user: string; kind: string; summary: string; detail?: string; link?: string; meta?: Record<string, unknown> | null };

const KIND: Record<string, { label: string; cls: string }> = {
  fuel: { label: "Fuel", cls: "bg-[var(--color-info)]/10 text-[var(--color-info)]" },
  rules: { label: "Rules", cls: "bg-[var(--color-brand-tint)] text-[var(--color-brand-dark)]" },
  upload: { label: "Upload", cls: "bg-black/5 text-[var(--color-ink-2)]" },
  user: { label: "User", cls: "bg-[var(--color-ok)]/10 text-[var(--color-ok)]" },
  wipe: { label: "Wipe", cls: "bg-[var(--color-danger)]/10 text-[var(--color-danger)]" },
  part: { label: "Part", cls: "bg-[var(--color-brand-tint)] text-[var(--color-brand-dark)]" },
  price: { label: "Price", cls: "bg-[var(--color-ok)]/10 text-[var(--color-ok)]" },
};

export default function HistoryPage() {
  const [items, setItems] = useState<Activity[]>([]);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const load = () => fetch("/api/activity", { cache: "no-store" }).then((r) => r.json()).then((d) => setItems(d.activities ?? []));
  useEffect(() => { load(); }, []);

  async function restore(id: string) {
    setBusy(id); setMsg("");
    try {
      const res = await fetch("/api/parts/restore", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || d.error) { setMsg(d.error || "Could not restore."); return; }
      await load();
    } finally { setBusy(""); }
  }

  const isDelete = (a: Activity) => a.meta && (a.meta as Record<string, unknown>).action === "delete";

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl text-[var(--color-ink)]">History</h1>
      <p className="mt-1 text-sm text-[var(--color-ink-2)]">
        Everything admins have changed. Click an entry to jump to where it happened; removed parts can be restored.
      </p>
      {msg && <p className="mt-3 text-sm text-[var(--color-danger)]">{msg}</p>}

      <div className="card card-soft mt-6 divide-y divide-[var(--color-line)]">
        {items.length === 0 && <div className="p-6 text-sm text-[var(--color-ink-3)]">No activity yet.</div>}
        {items.map((a) => {
          const k = KIND[a.kind] ?? KIND.upload;
          return (
            <div key={a.id} className="flex items-start gap-3 p-4">
              <span className={`mt-0.5 rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${k.cls}`}>{k.label}</span>
              <div className="min-w-0 flex-1">
                {a.link ? (
                  <Link href={a.link} className="text-sm text-[var(--color-ink)] hover:underline">{a.summary}</Link>
                ) : (
                  <div className="text-sm text-[var(--color-ink)]">{a.summary}</div>
                )}
                {a.detail && <div className="truncate text-xs text-[var(--color-ink-3)]">{a.detail}</div>}
                <div className="mt-0.5 text-xs text-[var(--color-ink-3)]">{a.user} · {new Date(a.at).toLocaleString("en-GB")}</div>
              </div>
              {isDelete(a) && (
                <button onClick={() => restore(a.id)} disabled={!!busy}
                  className="btn-secondary shrink-0 px-3 py-1.5 text-xs" title="Add this removed part back to its service.">
                  {busy === a.id ? "Restoring…" : "Restore"}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
