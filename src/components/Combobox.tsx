"use client";

import { useEffect, useRef, useState } from "react";

export default function Combobox({
  value,
  onChange,
  options,
  placeholder = "Select…",
  disabled = false,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const filtered = query.trim()
    ? options.filter((o) => o.toLowerCase().includes(query.trim().toLowerCase()))
    : options;

  function pick(v: string) {
    onChange(v);
    setOpen(false);
    setQuery("");
  }

  return (
    <div ref={ref} className="relative">
      <input
        type="text"
        disabled={disabled}
        value={open ? query : value}
        placeholder={value || placeholder}
        onFocus={() => { if (!disabled) { setOpen(true); setQuery(""); setActive(0); } }}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); setActive(0); }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, filtered.length - 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
          else if (e.key === "Enter") { e.preventDefault(); if (filtered[active]) pick(filtered[active]); }
          else if (e.key === "Escape") setOpen(false);
        }}
        className="w-full rounded-lg border border-[var(--color-line-strong)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--color-brand)] disabled:bg-[var(--color-surface-2)] disabled:text-[var(--color-ink-3)]"
      />
      {!open && value && !disabled && (
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-ink-3)]">▾</span>
      )}
      {open && filtered.length > 0 && (
        <ul className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-[var(--color-line-strong)] bg-white py-1 shadow-lg">
          {filtered.map((o, i) => (
            <li
              key={o}
              onMouseDown={(e) => { e.preventDefault(); pick(o); }}
              onMouseEnter={() => setActive(i)}
              className={`cursor-pointer px-3 py-2 text-sm ${
                i === active ? "bg-[var(--color-brand-tint)] text-[var(--color-ink)]" : "text-[var(--color-ink-2)]"
              } ${o === value ? "font-semibold" : ""}`}
            >
              {o}
            </li>
          ))}
        </ul>
      )}
      {open && filtered.length === 0 && (
        <div className="absolute z-30 mt-1 w-full rounded-lg border border-[var(--color-line-strong)] bg-white px-3 py-2 text-sm text-[var(--color-ink-3)] shadow-lg">
          No matches
        </div>
      )}
    </div>
  );
}
