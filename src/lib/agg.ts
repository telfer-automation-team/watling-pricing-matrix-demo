import { aggregateMachine } from "@/lib/pricing/engine";
import type { PartPrice, ServiceAgg, SqtLine } from "@/lib/pricing/types";

// Rows from the "manual layer" tables (re-applied on top of uploaded data every rebuild).
export type FuelRuleRow = {
  part_no: string;
  model: string; // "" = applies to all machines
  variant: string; // "" = all variants
  service_description: string; // "" = all services (i.e. the whole part)
  is_fuel: boolean;
};
export type ManualPartRow = {
  model: string;
  variant: string;
  service_description: string;
  part_no: string;
  description: string;
  quantity: number;
  is_fuel: boolean;
  cost?: number | null; // explicit per-unit price (optional; else looked up)
  retail?: number | null;
};
export type DeletedPartRow = {
  model: string;
  variant: string;
  service_description: string;
  part_no: string;
};

const svcKey = (service: string, partNo: string) => `${service}|||${partNo}`;

/**
 * Aggregate one machine with the manual layer applied:
 *   uploaded lines − deletions + manual parts, with per-service / all-services fuel marks,
 *   and admin price edits (catalogue overrides + explicit manual prices) flagged.
 * `priceMap` must already include catalogue price overrides; `overriddenPartNos` lists the
 * part numbers whose price was set by an admin (for the "edited price" flag).
 */
export function aggregateMachineFull(opts: {
  product: string;
  model: string;
  variant: string;
  lines: SqtLine[];
  priceMap: Map<string, PartPrice>;
  fuelRules: FuelRuleRow[];
  manuals: ManualPartRow[];
  deletions: DeletedPartRow[];
  overriddenPartNos?: Set<string>;
}): ServiceAgg[] {
  const { product, model, variant, lines } = opts;

  const deleted = new Set(
    opts.deletions.filter((d) => d.model === model && d.variant === variant).map((d) => svcKey(d.service_description, d.part_no))
  );

  const manuals = opts.manuals.filter((m) => m.model === model && m.variant === variant);
  const manualSet = new Set(manuals.map((m) => svcKey(m.service_description, m.part_no)));
  const manualFuel = new Map<string, boolean>();
  for (const m of manuals) manualFuel.set(svcKey(m.service_description, m.part_no), m.is_fuel);

  const priceMap = opts.priceMap;
  const overridden = new Set(opts.overriddenPartNos ?? []);

  // manual parts become extra lines; an explicit price (if given) is used per-unit directly
  const manualLines: SqtLine[] = manuals.map((m) => {
    const hasPrice = m.cost != null && m.retail != null;
    if (hasPrice) overridden.add(m.part_no);
    return {
      product, model, variant,
      serviceInterval: m.service_description, serviceDescription: m.service_description,
      labourHours: 0, partNo: m.part_no, partDescription: m.description, quantity: m.quantity,
      ...(hasPrice ? { explicitCost: Number(m.cost), explicitRetail: Number(m.retail) } : {}),
    };
  });

  const kept = lines.filter((l) => !deleted.has(svcKey(l.serviceDescription, l.partNo)));
  const finalLines = [...kept, ...manualLines];

  const serviceFuel = new Map<string, boolean>();
  const globalFuel = new Map<string, boolean>();
  for (const r of opts.fuelRules) {
    const machineMatch = (r.model === "" || r.model === model) && (r.variant === "" || r.variant === variant);
    if (!machineMatch) continue;
    if (r.service_description === "") globalFuel.set(r.part_no, r.is_fuel);
    else serviceFuel.set(svcKey(r.service_description, r.part_no), r.is_fuel);
  }
  const resolver = (partNo: string, service: string): boolean | undefined => {
    const sk = svcKey(service, partNo);
    if (serviceFuel.has(sk)) return serviceFuel.get(sk);
    if (globalFuel.has(partNo)) return globalFuel.get(partNo);
    if (manualFuel.has(sk)) return manualFuel.get(sk);
    return undefined;
  };

  const aggs = aggregateMachine(finalLines, priceMap, resolver);

  for (const a of aggs) {
    for (const p of a.parts) {
      if (manualSet.has(svcKey(a.serviceDescription, p.partNo))) p.manual = true;
      if (overridden.has(p.partNo)) p.priceOverridden = true;
    }
  }
  return aggs;
}

export { svcKey };
