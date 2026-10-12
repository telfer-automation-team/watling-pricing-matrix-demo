"use client";
import { Fragment, useEffect, useMemo, useState } from "react";
import Combobox from "@/components/Combobox";

type Part = { partNo: string; description: string; quantity: number; type: string; isFuel: boolean; manual?: boolean; priceOverridden?: boolean; lineRetail?: number; note?: string };
type Service = { serviceDescription: string; serviceHours: number; labourHours: number; parts: Part[] };
type VariantBlock = { variant: string; services: Service[] };
type ManualRow = { variant: string; service: string; partNo: string; description: string; quantity: number; isFuel: boolean; cost: number | null; retail: number | null };
type Initial = { partNo: string; description: string; quantity: number; isFuel: boolean; cost: number | null; retail: number | null };

const gbp = (n: number) => new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(n);

export default function PartsPage() {
  const [models, setModels] = useState<string[]>([]);
  const [model, setModel] = useState("");
  const [variants, setVariants] = useState<VariantBlock[]>([]);
  const [manualRows, setManualRows] = useState<ManualRow[]>([]);
  const [variant, setVariant] = useState("");
  const [filter, setFilter] = useState("");
  const [manualOnly, setManualOnly] = useState(false);
  const [busy, setBusy] = useState(false);
  const [highlightPart, setHighlightPart] = useState("");
  const [openKey, setOpenKey] = useState("");  // `${service}|${partNo}` whose editor is open
  const [addFor, setAddFor] = useState("");     // service desc for a NEW part
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetch("/api/model-parts", { cache: "no-store" }).then((r) => r.json()).then((d) => setModels(d.models ?? []));
    const q = new URLSearchParams(window.location.search);
    const m = q.get("model"); const p = q.get("part");
    if (p) setHighlightPart(p);
    if (m) loadModel(m);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadModel(m: string) {
    setModel(m); setVariant(""); setOpenKey("");
    const d = await fetch(`/api/model-parts?model=${encodeURIComponent(m)}`, { cache: "no-store" }).then((r) => r.json());
    setVariants(d.variants ?? []); setManualRows(d.manualRows ?? []);
    setVariant(d.variants?.[0]?.variant ?? "");
  }
  async function reload() {
    if (!model) return;
    const d = await fetch(`/api/model-parts?model=${encodeURIComponent(model)}`, { cache: "no-store" }).then((r) => r.json());
    setVariants(d.variants ?? []); setManualRows(d.manualRows ?? []);
  }
  async function post(url: string, body: unknown) {
    setBusy(true); setMsg("");
    try {
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (res.status === 403) { setMsg("Your admin session has expired — please sign in again as Admin, then retry."); return false; }
      const d = await res.json().catch(() => ({}));
      if (!res.ok || d.error) { setMsg(d.error || `Request failed (HTTP ${res.status}).`); return false; }
      await reload(); return true;
    } catch { setMsg("Network error — please try again."); return false; }
    finally { setBusy(false); }
  }

  const setFuel = (part: Part, service: Service, isFuel: boolean, scope: "service" | "all") =>
    post("/api/fuel", { partNo: part.partNo, isFuel, scope, model, variant, service: service.serviceDescription, description: part.description });
  const removePart = (part: Part, service: Service) =>
    post("/api/parts/delete", { model, variant, service: service.serviceDescription, partNo: part.partNo, isManual: !!part.manual });
  const manualInitial = (service: string, partNo: string): Initial | undefined => {
    const r = manualRows.find((x) => x.variant === variant && x.service === service && x.partNo === partNo);
    return r ? { partNo: r.partNo, description: r.description, quantity: r.quantity, isFuel: r.isFuel, cost: r.cost, retail: r.retail } : undefined;
  };

  const block = useMemo(() => variants.find((v) => v.variant === variant), [variants, variant]);
  const f = filter.trim().toLowerCase();

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-2xl text-[var(--color-ink)]">Parts &amp; fuel</h1>
      <p className="mt-1 max-w-3xl text-sm text-[var(--color-ink-2)]">
        Review each service&apos;s parts. Use <b>Edit</b> on a part to set the fuel filter, change its price,
        or remove it. Manual parts, fuel marks and deletions are kept across uploads; edited catalogue prices
        apply only until the next price-file upload replaces them.
      </p>

      <div className="card card-soft mt-6 p-5">
        <div className="grid gap-4 md:grid-cols-3">
          <div><span className="field-label">Model</span><Combobox value={model} onChange={loadModel} options={models} placeholder="Search model" /></div>
          <div><span className="field-label">Variant</span><Combobox value={variant} onChange={setVariant} options={variants.map((v) => v.variant)} placeholder="Search variant" disabled={!variants.length} /></div>
          <div><span className="field-label">Filter parts</span>
            <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="part no. or description" className="input" />
          </div>
        </div>
        <label className="mt-4 inline-flex items-center gap-2 text-sm text-[var(--color-ink-2)]">
          <input type="checkbox" checked={manualOnly} onChange={(e) => setManualOnly(e.target.checked)} className="h-4 w-4 accent-[var(--color-brand)]" />
          Show manual parts only
        </label>
        {msg && (
          <div className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-[var(--color-danger)]/30 bg-[var(--color-danger)]/5 px-3 py-2 text-sm text-[var(--color-danger)]">
            <span>{msg}</span>
            {msg.includes("sign in") && <a href="/login" className="shrink-0 font-semibold underline">Sign in</a>}
          </div>
        )}
      </div>

      {block && (
        <div className="mt-5 space-y-4">
          {block.services.map((s) => {
            let rows = s.parts.filter((p) => !f || p.partNo.toLowerCase().includes(f) || p.description.toLowerCase().includes(f));
            if (manualOnly) rows = rows.filter((p) => p.manual);
            if (manualOnly && rows.length === 0) return null;
            return (
              <div key={s.serviceDescription} className="card card-soft overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--color-line)] bg-[var(--color-surface-2)] px-5 py-3">
                  <span className="wordmark text-sm text-[var(--color-ink)]">{s.serviceDescription}</span>
                  <span className="text-xs text-[var(--color-ink-3)]">{s.labourHours} labour hrs · {s.parts.length} parts</span>
                </div>

                <div className="divide-y divide-[var(--color-line)]">
                  {rows.map((p) => {
                    const key = `${s.serviceDescription}|${p.partNo}`;
                    const open = openKey === key;
                    const backfilled = p.note === "backfilled-fuel";
                    return (
                      <Fragment key={key}>
                        <div className={`grid grid-cols-[minmax(90px,auto)_1fr_auto] items-center gap-x-4 gap-y-1 px-5 py-3 sm:grid-cols-[130px_1fr_70px_90px_auto] ${p.partNo === highlightPart ? "bg-[var(--color-brand-tint)]" : ""}`}>
                          <span className="font-mono text-xs text-[var(--color-ink-2)]">{p.partNo}</span>
                          <span className="min-w-0 text-sm">
                            <span className="text-[var(--color-ink)]">{p.description}</span>
                            {p.isFuel && <Badge kind="fuel">fuel filter</Badge>}
                            {p.manual && <Badge kind="manual">manual</Badge>}
                            {p.priceOverridden && !p.manual && <Badge kind="price">edited price</Badge>}
                            {backfilled && <Badge kind="added">auto-added</Badge>}
                          </span>
                          <span className="hidden text-right text-sm tabular-nums text-[var(--color-ink-3)] sm:block">×{p.quantity}</span>
                          <span className="hidden text-right text-sm font-medium tabular-nums sm:block">{p.lineRetail != null ? gbp(p.lineRetail) : ""}</span>
                          <span className="justify-self-end">
                            {backfilled ? (
                              <span className="text-xs text-[var(--color-ink-3)]">auto-added</span>
                            ) : (
                              <button onClick={() => setOpenKey(open ? "" : key)} disabled={busy}
                                className={`btn-secondary px-3 py-1.5 text-xs ${open ? "border-[var(--color-brand)] bg-[var(--color-brand-tint)]" : ""}`}>
                                {open ? "Close" : "Edit"}
                              </button>
                            )}
                          </span>
                        </div>

                        {open && (
                          <div className="bg-[var(--color-surface-2)] px-5 py-4">
                            {p.manual ? (
                              <ManualEditor initial={manualInitial(s.serviceDescription, p.partNo)!} busy={busy}
                                onSave={async (v) => { if (await post("/api/parts/add", { model, variant, service: s.serviceDescription, ...v })) setOpenKey(""); }}
                                onDelete={async () => { if (confirm(`Delete manual part ${p.partNo}?`) && await removePart(p, s)) setOpenKey(""); }}
                              />
                            ) : (
                              <CatalogueEditor part={p} service={s.serviceDescription} busy={busy}
                                onFuel={(isFuel, scope) => setFuel(p, s, isFuel, scope)}
                                onSavePrice={(cost, retail) => post("/api/price-override", { partNo: p.partNo, cost, retail, model, variant })}
                                onResetPrice={() => post("/api/price-override", { partNo: p.partNo, clear: true, model, variant })}
                                onDelete={async () => { if (confirm(`Remove ${p.partNo} from ${s.serviceDescription}?`) && await removePart(p, s)) setOpenKey(""); }}
                              />
                            )}
                          </div>
                        )}
                      </Fragment>
                    );
                  })}
                </div>

                {!manualOnly && (
                  <div className="border-t border-[var(--color-line)] px-5 py-3">
                    {addFor === s.serviceDescription ? (
                      <ManualEditor adding busy={busy}
                        onSave={async (v) => { if (await post("/api/parts/add", { model, variant, service: s.serviceDescription, ...v })) setAddFor(""); }}
                        onCancel={() => setAddFor("")} />
                    ) : (
                      <button onClick={() => { setAddFor(s.serviceDescription); setOpenKey(""); setMsg(""); }} className="btn-ghost">
                        + Add a part to this service
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ---------- catalogue part editor (fuel + price + remove) ---------- */
function CatalogueEditor({ part, service, busy, onFuel, onSavePrice, onResetPrice, onDelete }: {
  part: Part; service: string; busy: boolean;
  onFuel: (isFuel: boolean, scope: "service" | "all") => void;
  onSavePrice: (cost: number, retail: number) => Promise<boolean>;
  onResetPrice: () => Promise<boolean>;
  onDelete: () => void;
}) {
  const [cost, setCost] = useState(""); const [retail, setRetail] = useState("");
  const [overridden, setOverridden] = useState(false); const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    fetch(`/api/price-override?partNo=${encodeURIComponent(part.partNo)}`, { cache: "no-store" }).then((r) => r.json()).then((d) => {
      if (d && !d.error) { setCost(String(d.cost ?? "")); setRetail(String(d.retail ?? "")); setOverridden(!!d.overridden); }
      setLoaded(true);
    });
  }, [part.partNo]);

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {/* Fuel filter */}
      <Section title="Fuel filter" hint={part.isFuel ? "This part is currently treated as the fuel filter." : "This part is not treated as the fuel filter."}>
        <div className="flex flex-col gap-2">
          {part.isFuel ? (
            <>
              <Action label="Stop using as fuel filter — this service only" sub={`Only "${service}" stops treating it as the fuel filter.`} onClick={() => onFuel(false, "service")} busy={busy} />
              <Action label="Stop using as fuel filter — every service" sub="No service will treat this part as the fuel filter." onClick={() => onFuel(false, "all")} busy={busy} />
            </>
          ) : (
            <>
              <Action label="Use as fuel filter — this service only" sub={`Only "${service}" will treat this part as the fuel filter.`} onClick={() => onFuel(true, "service")} busy={busy} />
              <Action label="Use as fuel filter — every service" sub="Every service that includes this part treats it as the fuel filter." onClick={() => onFuel(true, "all")} busy={busy} />
            </>
          )}
        </div>
      </Section>

      {/* Price */}
      <Section title="Price" hint={overridden ? "This part has an edited price." : "Priced from the JCB file."}>
        {!loaded ? <p className="text-xs text-[var(--color-ink-3)]">Loading current price…</p> : (
          <>
            <div className="flex flex-wrap items-end gap-3">
              <Money label="Cost" value={cost} onChange={setCost} />
              <Money label="Retail (list)" value={retail} onChange={setRetail} />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button className="btn-primary px-4 py-2 text-sm disabled:opacity-50" disabled={busy || cost === "" || retail === ""} onClick={() => onSavePrice(parseFloat(cost) || 0, parseFloat(retail) || 0)}>Save price</button>
              {overridden && <button className="btn-secondary" disabled={busy} onClick={onResetPrice}>Reset to file price</button>}
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-[var(--color-ink-3)]">
              Per-unit cost &amp; retail, applied everywhere this part appears. A stopgap for a wrong file price — the next price-file upload replaces it.
            </p>
          </>
        )}
      </Section>

      {/* Remove */}
      <Section title="Remove" hint="Takes this part off this service only." className="lg:col-span-2">
        <button className="btn-danger" disabled={busy} onClick={onDelete}>Remove this part from {service}</button>
        <p className="mt-2 text-[11px] text-[var(--color-ink-3)]">It stays removed after future uploads, until you add it back.</p>
      </Section>
    </div>
  );
}

/* ---------- manual part editor (also used for Add) ---------- */
function ManualEditor({ initial, adding, busy, onSave, onDelete, onCancel }: {
  initial?: Initial; adding?: boolean; busy: boolean;
  onSave: (v: { partNo: string; description: string; quantity: number; isFuel: boolean; cost: number | null; retail: number | null }) => void;
  onDelete?: () => void; onCancel?: () => void;
}) {
  const editing = !!initial;
  const [partNo, setPartNo] = useState(initial?.partNo ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [quantity, setQuantity] = useState(String(initial?.quantity ?? 1));
  const [isFuel, setIsFuel] = useState(initial?.isFuel ?? false);
  const [cost, setCost] = useState(initial?.cost != null ? String(initial.cost) : "");
  const [retail, setRetail] = useState(initial?.retail != null ? String(initial.retail) : "");
  return (
    <div>
      {adding && <div className="mb-3 wordmark text-xs text-[var(--color-ink)]">Add a manual part</div>}
      <div className="grid gap-3 sm:grid-cols-2">
        <div><span className="field-label">Part number</span>
          <input value={partNo} disabled={editing} onChange={(e) => setPartNo(e.target.value)} placeholder="e.g. 333/W5100" className="input input-sm font-mono" />
        </div>
        <div><span className="field-label">Description</span>
          <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Part description" className="input input-sm" />
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-end gap-4">
        <div><span className="field-label">Quantity</span><input type="number" step="any" min="0" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="input input-sm w-24 text-right" /></div>
        <Money label="Cost (optional)" value={cost} onChange={setCost} />
        <Money label="Retail (optional)" value={retail} onChange={setRetail} />
        <label className="flex h-9 items-center gap-2 text-sm text-[var(--color-ink-2)]">
          <input type="checkbox" checked={isFuel} onChange={(e) => setIsFuel(e.target.checked)} className="h-4 w-4 accent-[var(--color-brand)]" />
          This is the fuel filter
        </label>
      </div>
      <p className="mt-2 text-[11px] text-[var(--color-ink-3)]">Leave cost &amp; retail blank to price from the JCB file. Fill them in for off-catalogue parts (these prices are kept across uploads).</p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button className="btn-primary px-4 py-2 text-sm disabled:opacity-50" disabled={busy || !partNo.trim()}
          onClick={() => onSave({ partNo: partNo.trim(), description, quantity: parseFloat(quantity) || 0, isFuel, cost: cost === "" ? null : parseFloat(cost), retail: retail === "" ? null : parseFloat(retail) })}>
          {editing ? "Save changes" : "Add part"}
        </button>
        {onCancel && <button className="btn-secondary" onClick={onCancel}>Cancel</button>}
        {editing && onDelete && <button className="btn-danger ml-auto" disabled={busy} onClick={onDelete}>Delete manual part</button>}
      </div>
    </div>
  );
}

/* ---------- small building blocks ---------- */
function Section({ title, hint, children, className = "" }: { title: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-4 ${className}`}>
      <div className="wordmark text-xs text-[var(--color-ink)]">{title}</div>
      {hint && <p className="mt-0.5 text-xs text-[var(--color-ink-3)]">{hint}</p>}
      <div className="mt-3">{children}</div>
    </div>
  );
}
function Action({ label, sub, onClick, busy }: { label: string; sub: string; onClick: () => void; busy: boolean }) {
  return (
    <button onClick={onClick} disabled={busy}
      className="group w-full rounded-lg border border-[var(--color-line-strong)] bg-[var(--color-surface)] px-3 py-2 text-left transition-colors hover:border-[var(--color-brand)] hover:bg-[var(--color-brand-tint)] disabled:opacity-50">
      <div className="text-sm font-medium text-[var(--color-ink)]">{label}</div>
      <div className="text-xs text-[var(--color-ink-3)]">{sub}</div>
    </button>
  );
}
function Money({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <span className="field-label">{label}</span>
      <div className="flex items-center gap-1.5">
        <span className="text-sm text-[var(--color-ink-3)]">£</span>
        <input type="number" step="any" min="0" value={value} onChange={(e) => onChange(e.target.value)} placeholder="—" className="input input-sm w-28 text-right" />
      </div>
    </div>
  );
}
function Badge({ children, kind }: { children: React.ReactNode; kind: "fuel" | "manual" | "added" | "price" }) {
  const cls = kind === "fuel" ? "bg-[var(--color-info)]/10 text-[var(--color-info)]"
    : kind === "manual" ? "bg-[var(--color-ok)]/10 text-[var(--color-ok)]"
    : "bg-[var(--color-brand-tint)] text-[var(--color-brand-dark)]";
  return <span className={`ml-2 inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${cls}`}>{children}</span>;
}
