"use client";
import { useEffect, useState } from "react";
import Combobox from "@/components/Combobox";

type Service = {
  serviceDescription: string; serviceHours: number; labourHours: number;
  lubRetail: number; lubCost: number; otherRetail: number; otherCost: number;
};
type VariantBlock = { variant: string; services: Service[] };
type Rules = {
  lubricantDiscount: number; otherDiscount: number; labourRate: number; labourCostRate: number;
  waste: number; mileageDistance: number; mileageRate: number; mileageTravelHours: number;
};

const gbp = (n: number) => new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(n);

export default function PricingPage() {
  const [models, setModels] = useState<string[]>([]);
  const [model, setModel] = useState("");
  const [variants, setVariants] = useState<VariantBlock[]>([]);
  const [rules, setRules] = useState<Rules | null>(null);

  useEffect(() => {
    fetch("/api/model-parts", { cache: "no-store" }).then((r) => r.json()).then((d) => setModels(d.models ?? []));
    fetch("/api/config", { cache: "no-store" }).then((r) => r.json()).then((d) => setRules(d.rules));
  }, []);

  async function load(m: string) {
    setModel(m);
    const d = await fetch(`/api/model-parts?model=${encodeURIComponent(m)}`, { cache: "no-store" }).then((r) => r.json());
    setVariants(d.variants ?? []);
  }

  function price(s: Service) {
    if (!rules) return { retail: 0, profit: 0, margin: 0 };
    const mileage = rules.mileageDistance * rules.mileageRate + rules.mileageTravelHours * rules.labourRate;
    const retail = s.lubRetail * (1 - rules.lubricantDiscount) + s.otherRetail * (1 - rules.otherDiscount)
      + s.labourHours * rules.labourRate + mileage + rules.waste;
    const cost = s.lubCost + s.otherCost + s.labourHours * rules.labourCostRate;
    const profit = retail - cost;
    return { retail, profit, margin: retail > 0 ? profit / retail : 0 };
  }

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-2xl text-[var(--color-ink)]">Pricing</h1>
      <p className="mt-1 text-sm text-[var(--color-ink-2)]">Every service for a model, priced with the current rules.</p>

      <div className="card mt-6 p-5">
        <label className="block max-w-xs">
          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-[var(--color-ink-3)]">Model</span>
          <Combobox value={model} onChange={load} options={models} placeholder="Search model" />
        </label>
      </div>

      {variants.map((v) => (
        <div key={v.variant} className="card mt-4 overflow-hidden">
          <div className="bg-[var(--color-surface-2)] px-5 py-2.5"><span className="wordmark text-sm text-[var(--color-ink)]">{v.variant}</span></div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-line)] text-left text-xs uppercase tracking-wide text-[var(--color-ink-3)]">
                  <th className="px-5 py-2">Service</th><th className="px-3 py-2 text-right">Labour</th>
                  <th className="px-3 py-2 text-right">Lubricants</th><th className="px-3 py-2 text-right">Other</th>
                  <th className="px-3 py-2 text-right">Retail</th><th className="px-3 py-2 text-right">Profit</th><th className="px-5 py-2 text-right">Margin</th>
                </tr>
              </thead>
              <tbody>
                {v.services.map((s) => {
                  const p = price(s);
                  return (
                    <tr key={s.serviceDescription} className="border-b border-[var(--color-line)]/60">
                      <td className="px-5 py-2">{s.serviceDescription}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{s.labourHours}h</td>
                      <td className="px-3 py-2 text-right tabular-nums text-[var(--color-ink-3)]">{gbp(s.lubRetail)}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-[var(--color-ink-3)]">{gbp(s.otherRetail)}</td>
                      <td className="px-3 py-2 text-right font-semibold tabular-nums">{gbp(p.retail)}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-[var(--color-ok)]">{gbp(p.profit)}</td>
                      <td className="px-5 py-2 text-right tabular-nums">{(p.margin * 100).toFixed(0)}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
