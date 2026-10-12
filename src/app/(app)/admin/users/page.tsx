"use client";
import { useEffect, useState } from "react";
type User = { id: string; name: string; email: string; role: string; banned: boolean };

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const load = () => fetch("/api/users", { cache: "no-store" }).then((r) => r.json()).then((d) => setUsers(d.users ?? []));
  useEffect(() => { load(); }, []);

  async function toggle(u: User) {
    await fetch("/api/users", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: u.id, banned: !u.banned }) });
    load();
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl text-[var(--color-ink)]">Users</h1>
      <p className="mt-1 text-sm text-[var(--color-ink-2)]">Who can access the portal. Ban to revoke access immediately.</p>

      <div className="card mt-6 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--color-line)] bg-[var(--color-surface-2)] text-left text-xs uppercase tracking-wide text-[var(--color-ink-3)]">
              <th className="px-5 py-3">Name</th><th className="px-5 py-3">Role</th><th className="px-5 py-3">Status</th><th className="px-5 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-[var(--color-line)]/60">
                <td className="px-5 py-3"><div>{u.name}</div><div className="text-xs text-[var(--color-ink-3)]">{u.email}</div></td>
                <td className="px-5 py-3 capitalize">{u.role}</td>
                <td className="px-5 py-3">
                  <span className={`rounded px-2 py-0.5 text-xs font-medium ${u.banned ? "bg-[var(--color-danger)]/10 text-[var(--color-danger)]" : "bg-[var(--color-ok)]/10 text-[var(--color-ok)]"}`}>
                    {u.banned ? "Banned" : "Active"}
                  </span>
                </td>
                <td className="px-5 py-3 text-right">
                  <button onClick={() => toggle(u)}
                    className="rounded-lg border border-[var(--color-line-strong)] px-3 py-1.5 text-xs font-medium hover:bg-black/5">
                    {u.banned ? "Unban" : "Ban"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
