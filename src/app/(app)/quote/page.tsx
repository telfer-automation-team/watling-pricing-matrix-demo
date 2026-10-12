"use client";

import { useEffect, useMemo, useState } from "react";
import Combobox from "@/components/Combobox";

type Tree = { product: string; models: { model: string; variants: string[] }[] }[];
type Part = {
  partNo: string; description: string; quantity: number;
  type: "lubricant" | "other"; isFuel: boolean; lineRetail: number; note?: string;
};
type Quote = {
  serviceDescription: string; serviceHours: number; labourHours: number;
  currentHours: number; lubCharge: number; otherCharge: number; labourCharge: number; mileage: number; waste: number;
  lubRetail: number; otherRetail: number; retail: number; profit: number; margin: number;
  parts: Part[];
};
type Pkg = {
  years: number; subtotal: number; discount: number; total: number;
  services: { serviceDescription: string; baseRetail: number; inflatedRetail: number }[];
};
type Rules = {
  lubricantDiscount: number; otherDiscount: number;
  maxLubricantDiscount: number; maxOtherDiscount: number; minLabourRate: number;
  labourRate: number; labourCostRate: number;
  waste: number; mileageDistance: number; mileageRate: number; mileageTravelHours: number;
  hydraulicTopupEnabled: boolean; hydraulicTopupRetail: number; hydraulicTopupCost: number;
  packageInflation: number; hydraulicTopupPartNo: string; packageDiscounts: Record<number, number>;
};

const gbp = (n: number) => new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(n);

export default function QuotePage() {
  const [tree, setTree] = useState<Tree>([]);
  const [product, setProduct] = useState("");
  const [model, setModel] = useState("");
  const [variant, setVariant] = useState("");
  const [hours, setHours] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ quote: Quote | null; pkg: Pkg | null } | null>(null);
  const [error, setError] = useState("");

  // per-quote pricing adjustments (prefilled from saved rules; never saved back)
  const [rules, setRules] = useState<Rules | null>(null);
  const [baseRules, setBaseRules] = useState<Rules | null>(null);
  const [showAdjust, setShowAdjust] = useState(false);
  const adjusted = useMemo(
    () => !!rules && !!baseRules && JSON.stringify(rules) !== JSON.stringify(baseRules),
    [rules, baseRules]
  );

  useEffect(() => {
    fetch("/api/machines", { cache: "no-store" }).then((r) => r.json()).then((d) => setTree(d.tree ?? []));
    fetch("/api/config", { cache: "no-store" }).then((r) => r.json()).then((d) => { setRules(d.rules); setBaseRules(d.rules); });
  }, []);

  const models = useMemo(() => tree.find((p) => p.product === product)?.models ?? [], [tree, product]);
  const variants = useMemo(() => models.find((m) => m.model === model)?.variants ?? [], [models, model]);

  async function getPrice(nextRules?: Rules) {
    setError("");
    if (!variant || !hours) { setError("Pick a machine and enter its current hours."); return; }
    setLoading(true); setResult(null);
    const res = await fetch("/api/quote", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model, variant, hours: Number(hours),
        overrides: (() => {
          const r = nextRules ?? rules;
          return r ? {
            lubricantDiscount: r.lubricantDiscount, otherDiscount: r.otherDiscount,
            mileageDistance: r.mileageDistance,
          } : undefined;
        })(),
      }),
    }).then((r) => r.json());
    setLoading(false);
    if (!res.quote) { setError("No further service is due for those hours."); return; }
    setResult(res);
  }

  function setRule<K extends keyof Rules>(k: K, v: Rules[K]) {
    if (!rules) return;
    setRules({ ...rules, [k]: v });
  }
  function resetRules() {
    if (!baseRules) return;
    setRules(baseRules);
    if (result) getPrice(baseRules);
  }

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-2xl text-[var(--color-ink)]">Quote a service</h1>
      <p className="mt-1 text-sm text-[var(--color-ink-2)]">Pick a machine and enter its current hours.</p>

      <div className="card card-soft mt-6 p-5">
        <div className="grid gap-4 md:grid-cols-4">
          <Field label="Product">
            <Select value={product} onChange={(v) => { setProduct(v); setModel(""); setVariant(""); }}
              options={tree.map((p) => p.product)} placeholder="Select product" />
          </Field>
          <Field label="Model">
            <Select value={model} onChange={(v) => { setModel(v); setVariant(""); }}
              options={models.map((m) => m.model)} placeholder="Select model" disabled={!product} />
          </Field>
          <Field label="Variant">
            <Select value={variant} onChange={setVariant} options={variants} placeholder="Select variant" disabled={!model} />
          </Field>
          <Field label="Current hours">
            <input type="number" inputMode="numeric" value={hours} placeholder="e.g. 900"
              onChange={(e) => setHours(e.target.value)} className="input" />
          </Field>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button onClick={() => getPrice()} disabled={loading} className="btn-primary">{loading ? "Calculating…" : "Get price"}</button>
          <button onClick={() => setShowAdjust((s) => !s)}
            className="rounded-[10px] border border-[var(--color-line-strong)] px-4 py-2.5 text-sm font-medium hover:bg-black/5">
            {showAdjust ? "Hide pricing adjustments" : "Adjust pricing"}
          </button>
          {adjusted && <span className="rounded bg-[var(--color-brand-tint)] px-2 py-1 text-xs font-medium text-[var(--color-brand-dark)]">Custom rates applied</span>}
          {error && <span className="text-sm text-[var(--color-danger)]">{error}</span>}
        </div>
      </div>

      {showAdjust && rules && (
        <AdjustPanel
          rules={rules}
          baseRules={baseRules}
          onChange={setRule}
          onApply={() => getPrice()}
          onReset={resetRules}
          canReset={adjusted}
        />
      )}

      {result?.quote && <Result quote={result.quote} pkg={result.pkg} />}
    </div>
  );
}

function AdjustPanel({ rules, baseRules, onChange, onApply, onReset, canReset }: {
  rules: Rules; baseRules: Rules | null;
  onChange: <K extends keyof Rules>(k: K, v: Rules[K]) => void;
  onApply: () => void; onReset: () => void; canReset: boolean;
}) {
  const maxLub = Math.round((rules.maxLubricantDiscount ?? 0) * 100);
  const maxOther = Math.round((rules.maxOtherDiscount ?? 0) * 100);
  const stdDistance = baseRules?.mileageDistance ?? rules.mileageDistance;
  const stdWaste = baseRules?.waste ?? rules.waste;
  const mileage = rules.mileageDistance * rules.mileageRate + rules.mileageTravelHours * rules.labourRate;
  return (
    <div className="mt-4 overflow-hidden rounded-xl border-2 border-[var(--color-brand)] bg-[var(--color-surface)] shadow-[0_2px_12px_rgba(252,181,21,0.12)]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--color-brand)]/30 bg-[var(--color-brand-tint)] px-5 py-3">
        <span className="wordmark text-sm text-[var(--color-ink)]">Adjust this quote</span>
        <span className="text-xs text-[var(--color-ink-3)]">Changes apply to this quote only</span>
      </div>
      <div className="grid gap-x-6 gap-y-5 p-5 sm:grid-cols-2 lg:grid-cols-3">
        <Lever label="Lubricants discount" suffix="%" hint={`max ${maxLub}%`} atLimit={Math.round(rules.lubricantDiscount * 100) >= maxLub}
          value={Math.round(rules.lubricantDiscount * 1000) / 10} onChange={(v) => onChange("lubricantDiscount", Math.max(0, Math.min(maxLub, v)) / 100)} />
        <Lever label="Other parts discount" suffix="%" hint={`max ${maxOther}%`} atLimit={Math.round(rules.otherDiscount * 100) >= maxOther}
          value={Math.round(rules.otherDiscount * 1000) / 10} onChange={(v) => onChange("otherDiscount", Math.max(0, Math.min(maxOther, v)) / 100)} />
        <Lever label="Mileage distance" hint="this customer's distance" atLimit={false}
          value={rules.mileageDistance} onChange={(v) => onChange("mileageDistance", Math.max(0, v))} />
        <div className="flex flex-col justify-end rounded-xl border border-[var(--color-brand)]/30 bg-[var(--color-brand-tint)]/50 px-4 py-3 sm:col-span-2 lg:col-span-1">
          <span className="field-label mb-0">Mileage total</span>
          <div className="mt-1 text-xl font-semibold tabular-nums text-[var(--color-ink)]">{gbp(mileage)}</div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3 border-t border-[var(--color-line)] bg-[var(--color-surface-2)] px-5 py-4">
        <button onClick={onApply} className="btn-primary">Apply &amp; recalculate</button>
        {canReset && <button onClick={onReset} className="btn-secondary">Reset to standard</button>}
        <span className="ml-auto max-w-sm text-right text-xs text-[var(--color-ink-3)]">Discounts can&apos;t exceed the limits · set mileage to this customer&apos;s distance.</span>
      </div>
    </div>
  );
}

function Lever({ label, value, onChange, prefix, suffix, hint, atLimit }: {
  label: string; value: number; onChange: (v: number) => void;
  prefix?: string; suffix?: string; hint: string; atLimit?: boolean;
}) {
  return (
    <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-3.5 transition-colors focus-within:border-[var(--color-brand)]">
      <div className="flex items-baseline justify-between">
        <span className="field-label mb-0">{label}</span>
        <span className={`text-xs ${atLimit ? "font-semibold text-[var(--color-brand-dark)]" : "text-[var(--color-ink-3)]"}`}>{hint}</span>
      </div>
      <div className="mt-2 flex items-center gap-1.5">
        {prefix && <span className="text-sm font-medium text-[var(--color-ink-2)]">{prefix}</span>}
        <input type="number" step="any" value={value} onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          className="input w-full border-[var(--color-brand)]/45 text-right text-base font-semibold focus:border-[var(--color-brand)]" />
        {suffix && <span className="text-sm font-medium text-[var(--color-ink-2)]">{suffix}</span>}
      </div>
      {atLimit && <div className="mt-1.5 inline-block rounded bg-[var(--color-brand-tint)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-brand-dark)]">at limit</div>}
    </div>
  );
}

function Result({ quote, pkg }: { quote: Quote; pkg: Pkg | null }) {
  return (
    <>
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <div className="card overflow-hidden">
          <div className="bg-[var(--color-sidebar)] px-5 py-2.5">
            <span className="wordmark text-xs text-white/60">{quote.serviceDescription}</span>
          </div>
          <div className="p-5">
            <div className="text-xs uppercase tracking-wide text-[var(--color-ink-3)]">Service price</div>
            <div className="wordmark mt-1 text-4xl text-[var(--color-ink)]">{gbp(quote.retail)}</div>
            <div className="mt-1 text-xs text-[var(--color-ink-3)]">
              at {quote.currentHours.toLocaleString()} hrs &rarr; {quote.serviceHours.toLocaleString()}-hr service
            </div>
          </div>
        </div>
        <Stat label="Expected profit" value={gbp(quote.profit)} accent />
        <Stat label="Margin" value={`${(quote.margin * 100).toFixed(1)}%`} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="card p-5">
          <div className="wordmark text-sm text-[var(--color-ink)]">Breakdown</div>
          <dl className="mt-3 space-y-2 text-sm">
            <Row k="Lubricants (after discount)" v={gbp(quote.lubCharge)} />
            <Row k="Other parts (after discount)" v={gbp(quote.otherCharge)} />
            <Row k={`Labour (${quote.labourHours} hrs)`} v={gbp(quote.labourCharge)} />
            <Row k="Mileage" v={gbp(quote.mileage)} />
            <Row k="Waste" v={gbp(quote.waste)} />
            <div className="mt-2 flex justify-between border-t border-[var(--color-line)] pt-2 font-semibold">
              <span>Total retail</span><span>{gbp(quote.retail)}</span>
            </div>
          </dl>
        </div>

        <div className="card p-5 lg:col-span-2">
          <div className="wordmark text-sm text-[var(--color-ink)]">Parts to fit ({quote.parts.length})</div>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-line)] text-left text-xs uppercase tracking-wide text-[var(--color-ink-3)]">
                  <th className="py-2 pr-3">Part No.</th><th className="py-2 pr-3">Description</th>
                  <th className="py-2 pr-3 text-right">Qty</th><th className="py-2 text-right">Line</th>
                </tr>
              </thead>
              <tbody>
                {quote.parts.map((p, i) => (
                  <tr key={i} className="border-b border-[var(--color-line)]/60">
                    <td className="py-2 pr-3 font-mono text-xs">{p.partNo}</td>
                    <td className="py-2 pr-3">
                      {p.description}
                      {p.isFuel && <Tag>fuel</Tag>}
                      {p.note === "backfilled-fuel" && <Tag amber>added</Tag>}
                      {p.type === "lubricant" && <Tag muted>lube</Tag>}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">{p.quantity}</td>
                    <td className="py-2 text-right tabular-nums">{gbp(p.lineRetail)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {pkg && (
        <div className="card mt-4 p-5">
          <div className="flex items-baseline justify-between">
            <div className="wordmark text-sm text-[var(--color-ink)]">Service package &mdash; next {pkg.years} services</div>
            <div className="text-xs text-[var(--color-ink-3)]">incl. 5% annual inflation, {pkg.discount * 100}% package discount</div>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-4">
            {pkg.services.map((s, i) => (
              <div key={i} className="rounded-lg border border-[var(--color-line)] bg-[var(--color-surface-2)] p-3">
                <div className="text-xs text-[var(--color-ink-3)]">{s.serviceDescription}</div>
                <div className="wordmark mt-1 text-lg text-[var(--color-ink)]">{gbp(s.inflatedRetail)}</div>
              </div>
            ))}
            <div className="rounded-lg border border-[var(--color-brand)] bg-[var(--color-brand-tint)] p-3">
              <div className="text-xs font-medium text-[var(--color-brand-dark)]">Package total</div>
              <div className="wordmark mt-1 text-lg text-[var(--color-ink)]">{gbp(pkg.total)}</div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="field-label">{label}</span>
      {children}
    </label>
  );
}
function Select(props: { value: string; onChange: (v: string) => void; options: string[]; placeholder: string; disabled?: boolean }) {
  return <Combobox {...props} />;
}
function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`card p-5 ${accent ? "border-[var(--color-brand)]/40 bg-[var(--color-brand-tint)]" : ""}`}>
      <div className="text-xs uppercase tracking-wide text-[var(--color-ink-3)]">{label}</div>
      <div className="wordmark mt-1 text-3xl text-[var(--color-ink)]">{value}</div>
    </div>
  );
}
function Row({ k, v }: { k: string; v: string }) {
  return <div className="flex justify-between text-[var(--color-ink-2)]"><span>{k}</span><span className="tabular-nums">{v}</span></div>;
}
function Tag({ children, amber, muted }: { children: React.ReactNode; amber?: boolean; muted?: boolean }) {
  const cls = amber ? "bg-[var(--color-brand-tint)] text-[var(--color-brand-dark)]"
    : muted ? "bg-black/5 text-[var(--color-ink-3)]" : "bg-[var(--color-info)]/10 text-[var(--color-info)]";
  return <span className={`ml-2 rounded px-1.5 py-0.5 text-[10px] font-medium uppercase ${cls}`}>{children}</span>;
}
function Num({ label, value, onChange, prefix, suffix }: {
  label: string; value: number; onChange: (v: number) => void; prefix?: string; suffix?: string;
}) {
  return (
    <label className="flex items-center justify-between gap-3 py-1 text-sm">
      <span className="text-[var(--color-ink-2)]">{label}</span>
      <span className="flex items-center gap-1">
        {prefix && <span className="text-[var(--color-ink-3)]">{prefix}</span>}
        <input type="number" step="any" value={value}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          className="w-24 rounded-lg border border-[var(--color-line-strong)] bg-white px-2 py-1.5 text-right text-sm outline-none focus:border-[var(--color-brand)]" />
        {suffix && <span className="text-[var(--color-ink-3)]">{suffix}</span>}
      </span>
    </label>
  );
}
