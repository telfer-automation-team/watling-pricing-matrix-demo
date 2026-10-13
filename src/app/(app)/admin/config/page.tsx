"use client";
import { useEffect, useState } from "react";

type Rules = {
  lubricantDiscount: number; otherDiscount: number;
  maxLubricantDiscount: number; maxOtherDiscount: number; minLabourRate: number;
  labourRate: number; labourCostRate: number;
  waste: number; mileageDistance: number; mileageRate: number; mileageTravelHours: number;
  hydraulicTopupEnabled: boolean; hydraulicTopupRetail: number; hydraulicTopupCost: number;
  packageInflation: number;
};
const gbp = (n: number) => new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(n);

export default function ConfigPage() {
  const [rules, setRules] = useState<Rules | null>(null);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState("");
  useEffect(() => { fetch("/api/config", { cache: "no-store" }).then((r) => r.json()).then((d) => setRules(d.rules)); }, []);
  if (!rules) return <div className="text-sm text-[var(--color-ink-3)]">Loading…</div>;

  const set = (k: keyof Rules, v: number | boolean) => { setRules({ ...rules, [k]: v }); setSaved(false); };
  const mileage = rules.mileageDistance * rules.mileageRate + rules.mileageTravelHours * rules.labourRate;
  const capWarn = rules.maxLubricantDiscount < rules.lubricantDiscount || rules.maxOtherDiscount < rules.otherDiscount;

  async function save() {
    setErr("");
    const res = await fetch("/api/config", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(rules) });
    const d = await res.json().catch(() => ({}));
    if (!res.ok || d.error) { setErr(d.error || "Could not save."); return; }
    setRules(d.rules); setSaved(true);
  }

  return (
    <div className="mx-auto max-w-4xl pb-6">
      <h1 className="text-2xl text-[var(--color-ink)]">Rules &amp; rates</h1>
      <p className="mt-1 max-w-3xl text-sm text-[var(--color-ink-2)]">
        Set the prices used on every quote, and the limits for how much a quote can be changed. Press <b>Save</b> when you&apos;re done.
      </p>

      <div className="mt-4 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface-2)] p-4 text-sm text-[var(--color-ink-2)]">
        <b className="text-[var(--color-ink)]">Two kinds of setting on this page:</b>
        <div className="mt-1 flex flex-col gap-1">
          <span><Tag kind="global">Standard</Tag> prices used on every quote automatically.</span>
          <span><Tag kind="limit">Limit</Tag> the most a user can change on a single quote (on the Quote screen). A quote can never go past a limit.</span>
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <Card title="How much staff can discount" tag="limit" desc="A user can give a bigger discount for a customer on the Quote screen — but never more than this.">
          <Row label="Most they can take off lubricants"><Pct value={rules.maxLubricantDiscount} onChange={(v) => set("maxLubricantDiscount", v)} /></Row>
          <Row label="Most they can take off other parts"><Pct value={rules.maxOtherDiscount} onChange={(v) => set("maxOtherDiscount", v)} /></Row>
          
          {capWarn && <Note tone="danger">A limit is lower than the standard discount above — raise it so staff can at least match the standard.</Note>}
        </Card>

        <Card title="Labour" tag="global" desc="Charged per hour of work on the service.">
          <Row label="Labour charge"><Money value={rules.labourRate} onChange={(v) => set("labourRate", v)} suffix="/hr" /></Row>
        </Card>

        <Card title="Call-out (mileage)" tag="global" desc={`The charge for sending someone out — currently ${gbp(mileage)} per visit. Staff can change the distance for a far or close customer on a quote.`}>
          <Row label="Standard distance"><Plain value={rules.mileageDistance} onChange={(v) => set("mileageDistance", v)} /></Row>
          <Row label="Charge per unit of distance"><Money value={rules.mileageRate} onChange={(v) => set("mileageRate", v)} /></Row>
          <Row label="Travel time charged" hint="hours, at the labour rate"><Plain value={rules.mileageTravelHours} onChange={(v) => set("mileageTravelHours", v)} /></Row>
        </Card>

        <Card title="Waste disposal" tag="global" desc="A flat charge added to every service.">
          <Row label="Waste charge"><Money value={rules.waste} onChange={(v) => set("waste", v)} /></Row>
        </Card>

        <Card title="Hydraulic top-up" tag="global" desc="A 10-litre top-up added to every service, if switched on.">
          <label className="flex items-center justify-between gap-3 border-b border-[var(--color-line)] py-2.5 text-sm">
            <span className="text-[var(--color-ink-2)]">Add the 10L top-up to every service</span>
            <input type="checkbox" checked={rules.hydraulicTopupEnabled} onChange={(e) => set("hydraulicTopupEnabled", e.target.checked)} className="h-4 w-4 accent-[var(--color-brand)]" />
          </label>
          <Row label="Top-up price (retail)"><Money value={rules.hydraulicTopupRetail} onChange={(v) => set("hydraulicTopupRetail", v)} /></Row>
          <Row label="Top-up cost"><Money value={rules.hydraulicTopupCost} onChange={(v) => set("hydraulicTopupCost", v)} /></Row>
          <Note>Off by default so quotes match the current spreadsheet. Switch on only if Watling charges this today.</Note>
        </Card>

        <Card title="Service packages" tag="global" desc="When quoting several services ahead, add this much each year.">
          <Row label="Yearly price increase"><Pct value={rules.packageInflation} onChange={(v) => set("packageInflation", v)} /></Row>
        </Card>

       
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] px-4 py-3 card-soft">
        <button onClick={save} className="btn-primary">Save</button>
        {saved && <span className="text-sm text-[var(--color-ok)]">Saved — every new quote now uses these values.</span>}
        {err && <span className="text-sm text-[var(--color-danger)]">{err}</span>}
      </div>
    </div>
  );
}

function Tag({ kind, children }: { kind: "global" | "limit"; children?: React.ReactNode }) {
  const c = kind === "limit" ? "bg-[var(--color-brand-tint)] text-[var(--color-brand-dark)]" : "bg-[var(--color-info)]/10 text-[var(--color-info)]";
  return <span className={`mr-1 inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${c}`}>{children ?? (kind === "limit" ? "Limit" : "Standard")}</span>;
}
function Card({ title, tag, desc, children }: { title: string; tag: "global" | "limit"; desc?: string; children: React.ReactNode }) {
  return (
    <div className={`card card-soft p-5 ${tag === "limit" ? "border-[var(--color-brand)]/40" : ""}`}>
      <div className="flex items-center gap-2">
        <Tag kind={tag} />
        <div className="wordmark text-sm text-[var(--color-ink)]">{title}</div>
      </div>
      {desc && <p className="mt-1 text-xs leading-relaxed text-[var(--color-ink-3)]">{desc}</p>}
      <div className="mt-3">{children}</div>
    </div>
  );
}
function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-[var(--color-line)] py-2.5 last:border-b-0">
      <span className="text-sm text-[var(--color-ink-2)]">{label}{hint && <span className="mt-0.5 block text-xs text-[var(--color-ink-3)]">{hint}</span>}</span>
      <div className="flex shrink-0 items-center gap-1.5">{children}</div>
    </div>
  );
}
function Note({ children, tone }: { children: React.ReactNode; tone?: "danger" }) {
  return <p className={`mt-3 text-xs ${tone === "danger" ? "text-[var(--color-danger)]" : "text-[var(--color-ink-3)]"}`}>{children}</p>;
}
function numInput(value: number, onChange: (v: number) => void) {
  return <input type="number" step="any" value={value} onChange={(e) => onChange(parseFloat(e.target.value) || 0)} className="input input-sm w-24 text-right" />;
}
function Pct({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return <>{numInput(Math.round(value * 1000) / 10, (v) => onChange(v / 100))}<span className="w-4 text-sm text-[var(--color-ink-3)]">%</span></>;
}
function Money({ value, onChange, suffix }: { value: number; onChange: (v: number) => void; suffix?: string }) {
  return <><span className="text-sm text-[var(--color-ink-3)]">£</span>{numInput(value, onChange)}{suffix && <span className="w-8 text-sm text-[var(--color-ink-3)]">{suffix}</span>}</>;
}
function Plain({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return <>{numInput(value, onChange)}<span className="w-4" /></>;
}
