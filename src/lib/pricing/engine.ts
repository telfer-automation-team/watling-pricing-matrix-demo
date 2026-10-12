// ============================================================
// Watling Pricing Matrix — pricing engine (pure, deterministic)
// Rebuilds Peter's Excel logic: SQT (what parts) + Price File (what price).
// ============================================================

import type {
  PartPrice,
  SqtLine,
  RuleConfig,
  PricedPart,
  PartType,
  ServiceAgg,
  QuoteResult,
  PackageResult,
  PackageService,
} from "./types";

// ---- small helpers ----------------------------------------------------------

/** "1,000 Hours Service" -> 1000 ; "100 Hours Service" -> 100 */
export function serviceHoursOf(serviceDescription: string): number {
  const m = String(serviceDescription).match(/([\d,]+)/);
  return m ? parseInt(m[1].replace(/,/g, ""), 10) : 0;
}

/**
 * JCB convention: a "/" in the 5th character position (a 4-digit numeric prefix)
 * marks a lubricant.  "4001/3705D" -> lubricant ; "400/05197" -> other.
 */
export function classifyType(partNo: string): PartType {
  return partNo.length >= 5 && partNo[4] === "/" ? "lubricant" : "other";
}

/** Per-unit items are NOT drum->litre converted (grease, BoomTec, chain lube, sampling kits). */
export function isPerUnit(description: string): boolean {
  const d = description.toLowerCase();
  return (
    d.includes("grease") ||
    d.includes("boomtec") ||
    d.includes("chain lub") ||
    d.includes("sampling") ||
    d.includes("sample kit")
  );
}

/** Best-effort fuel-filter detection from text (overridden by admin fuel marks). */
export function isFuelByText(description: string): boolean {
  const d = description.toLowerCase();
  if (!d.includes("fuel")) return false;
  // exclude obvious non-filters that still contain "fuel"
  if (d.includes("breather") || d.includes("connector") || d.includes("injector") || d.includes("tank")) {
    return false;
  }
  return true;
}

/** Drum size in litres inferred from description; defaults to 20L. */
export function drumSizeOf(description: string): number {
  const d = description.toUpperCase().replace(/\s+/g, "");
  if (d.includes("200L")) return 200;
  if (d.includes("20L")) return 20;
  if (d.includes("5L")) return 5;
  return 20;
}

// ---- pricing a single line --------------------------------------------------

function priceLine(
  price: PartPrice | undefined,
  qty: number,
  type: PartType,
  perUnit: boolean,
  description: string
): { retail: number; cost: number; missing: boolean } {
  if (!price) return { retail: 0, cost: 0, missing: true };
  if (type === "lubricant" && !perUnit) {
    const drum = drumSizeOf(description);
    return {
      retail: (price.retail / drum) * qty,
      cost: (price.cost / drum) * qty,
      missing: false,
    };
  }
  return { retail: price.retail * qty, cost: price.cost * qty, missing: false };
}

// ---- aggregate one machine (model+variant) into per-service buckets ----------

// Resolves whether a part is a fuel filter for a given service.
// Returns true/false to force it (overriding the text guess), or undefined to fall
// back to text detection. Built per-machine so it can honour per-service and
// all-services admin marks.
export type FuelResolver = (partNo: string, serviceDescription: string) => boolean | undefined;

/**
 * Aggregate every service for a single machine (all its SqtLines), applying:
 *  - part classification + drum->litre conversion
 *  - fuel back-fill (missing fuel filter copied from a sibling service; 100hr excluded)
 *  - no hydraulic-fluid change on exact 2,000hr multiples
 */
export function aggregateMachine(
  lines: SqtLine[],
  priceMap: Map<string, PartPrice>,
  fuelResolver?: FuelResolver
): ServiceAgg[] {
  if (lines.length === 0) return [];
  const model = lines[0].model;
  const variant = lines[0].variant;

  // group lines by service
  const byService = new Map<string, SqtLine[]>();
  for (const l of lines) {
    const arr = byService.get(l.serviceDescription) ?? [];
    arr.push(l);
    byService.set(l.serviceDescription, arr);
  }

  const isFuelPart = (partNo: string, desc: string, service: string) => {
    const r = fuelResolver?.(partNo, service);
    return r === undefined ? isFuelByText(desc) : r;
  };

  // Identify this machine's fuel filter part (for back-fill): most common fuel part across services.
  const fuelCounts = new Map<string, { count: number; desc: string }>();
  for (const l of lines) {
    if (isFuelPart(l.partNo, l.partDescription, l.serviceDescription)) {
      const e = fuelCounts.get(l.partNo) ?? { count: 0, desc: l.partDescription };
      e.count += 1;
      fuelCounts.set(l.partNo, e);
    }
  }
  const machineFuel =
    [...fuelCounts.entries()].sort((a, b) => b[1].count - a[1].count)[0] ?? null;

  const out: ServiceAgg[] = [];

  for (const [serviceDescription, svcLines] of byService) {
    const serviceHours = serviceHoursOf(serviceDescription);
    const labourHours = svcLines.reduce((m, l) => Math.max(m, l.labourHours || 0), 0);
    const is2000 = serviceHours > 0 && serviceHours % 2000 === 0;

    const parts: PricedPart[] = [];

    for (const l of svcLines) {
      const type = classifyType(l.partNo);
      const hasExplicit = l.explicitRetail != null;
      const perUnit = hasExplicit ? true : isPerUnit(l.partDescription);

      // Rule: no full hydraulic-fluid change on exact 2,000hr services.
      const isHydraulicChange =
        type === "lubricant" &&
        !perUnit &&
        /hyd/i.test(l.partDescription) &&
        l.quantity >= 5; // a real fluid change, not a tiny top-up line
      if (is2000 && isHydraulicChange) {
        continue; // deducted
      }

      const priceObj = hasExplicit
        ? { partNo: l.partNo, description: l.partDescription, cost: l.explicitCost ?? 0, retail: l.explicitRetail as number }
        : priceMap.get(l.partNo);
      const p = priceLine(priceObj, l.quantity, type, perUnit, l.partDescription);
      parts.push({
        partNo: l.partNo,
        description: l.partDescription,
        quantity: l.quantity,
        type,
        isFuel: isFuelPart(l.partNo, l.partDescription, serviceDescription),
        perUnit,
        lineRetail: p.retail,
        lineCost: p.cost,
      });
    }

    // Rule: fuel filter on every service except 100hr — back-fill if missing.
    const hasFuel = parts.some((p) => p.isFuel);
    if (!hasFuel && serviceHours !== 100 && machineFuel) {
      const [partNo, meta] = machineFuel;
      const p = priceLine(priceMap.get(partNo), 1, "other", false, meta.desc);
      parts.push({
        partNo,
        description: meta.desc,
        quantity: 1,
        type: "other",
        isFuel: true,
        perUnit: false,
        lineRetail: p.retail,
        lineCost: p.cost,
        note: "backfilled-fuel",
      });
    }

    let lubRetail = 0,
      lubCost = 0,
      otherRetail = 0,
      otherCost = 0;
    for (const p of parts) {
      if (p.type === "lubricant") {
        lubRetail += p.lineRetail;
        lubCost += p.lineCost;
      } else {
        otherRetail += p.lineRetail;
        otherCost += p.lineCost;
      }
    }

    out.push({
      model,
      variant,
      serviceDescription,
      serviceHours,
      labourHours,
      lubRetail,
      lubCost,
      otherRetail,
      otherCost,
      parts,
    });
  }

  out.sort((a, b) => a.serviceHours - b.serviceHours);
  return out;
}

// ---- next service + quote ---------------------------------------------------

export function nextServiceHours(services: ServiceAgg[], currentHours: number): number | null {
  const future = services
    .map((s) => s.serviceHours)
    .filter((h) => h > currentHours)
    .sort((a, b) => a - b);
  return future.length ? future[0] : null;
}

export function mileageCharge(rules: RuleConfig): number {
  return rules.mileageDistance * rules.mileageRate + rules.mileageTravelHours * rules.labourRate;
}

/** Master formula: parts (discounted) + labour + mileage + waste. */
export function computeQuote(agg: ServiceAgg, rules: RuleConfig, currentHours: number): QuoteResult {
  const labourCharge = agg.labourHours * rules.labourRate;
  const mileage = mileageCharge(rules);
  const waste = rules.waste;

  // 10L hydraulic top-up is a pricing rule applied at quote time (not baked into the
  // aggregate), so it can be toggled per quote without re-aggregating.
  const topup = rules.hydraulicTopupEnabled;
  const lubRetail = agg.lubRetail + (topup ? rules.hydraulicTopupRetail : 0);
  const lubCost = agg.lubCost + (topup ? rules.hydraulicTopupCost : 0);
  const parts = topup
    ? [
        ...agg.parts,
        {
          partNo: rules.hydraulicTopupPartNo,
          description: "10L HYD 46 top-up",
          quantity: 10,
          type: "lubricant" as const,
          isFuel: false,
          perUnit: true,
          lineRetail: rules.hydraulicTopupRetail,
          lineCost: rules.hydraulicTopupCost,
          note: "hydraulic-topup" as const,
        },
      ]
    : agg.parts;

  const lubCharge = lubRetail * (1 - rules.lubricantDiscount);
  const otherCharge = agg.otherRetail * (1 - rules.otherDiscount);

  const retail = lubCharge + otherCharge + labourCharge + mileage + waste;

  // Cost side for profit: parts at cost + labour at cost rate. Mileage/waste are
  // treated as margin-neutral pass-through here (refine per Andy if needed).
  const cost = lubCost + agg.otherCost + agg.labourHours * rules.labourCostRate;
  const profit = retail - cost;

  return {
    ...agg,
    parts,
    lubRetail,
    lubCost,
    currentHours,
    lubCharge: round2(lubCharge),
    otherCharge: round2(otherCharge),
    labourCharge,
    mileage,
    waste,
    retail: round2(retail),
    cost: round2(cost),
    profit: round2(profit),
    margin: retail > 0 ? profit / retail : 0,
  };
}

/** Quote directly from raw lines for one machine + hours (convenience). */
export function quoteMachine(
  lines: SqtLine[],
  priceMap: Map<string, PartPrice>,
  rules: RuleConfig,
  currentHours: number,
  fuelResolver?: FuelResolver
): QuoteResult | null {
  const services = aggregateMachine(lines, priceMap, fuelResolver);
  const nh = nextServiceHours(services, currentHours);
  if (nh == null) return null;
  const agg = services.find((s) => s.serviceHours === nh)!;
  return computeQuote(agg, rules, currentHours);
}

// ---- service package calculator --------------------------------------------

export function computePackage(
  services: ServiceAgg[],
  rules: RuleConfig,
  currentHours: number,
  count: number
): PackageResult | null {
  const future = services
    .filter((s) => s.serviceHours > currentHours)
    .sort((a, b) => a.serviceHours - b.serviceHours)
    .slice(0, count);
  if (future.length === 0) return null;

  const pkg: PackageService[] = future.map((s, i) => {
    const base = computeQuote(s, rules, currentHours).retail;
    const inflated = base * Math.pow(1 + rules.packageInflation, i);
    return {
      serviceDescription: s.serviceDescription,
      serviceHours: s.serviceHours,
      yearIndex: i,
      baseRetail: round2(base),
      inflatedRetail: round2(inflated),
    };
  });

  const subtotal = pkg.reduce((t, s) => t + s.inflatedRetail, 0);
  const discount = rules.packageDiscounts[future.length] ?? 0;
  const total = subtotal * (1 - discount);

  return { services: pkg, years: future.length, subtotal: round2(subtotal), discount, total: round2(total) };
}

// ---- utils ------------------------------------------------------------------

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function buildPriceMap(prices: PartPrice[]): Map<string, PartPrice> {
  const m = new Map<string, PartPrice>();
  for (const p of prices) m.set(p.partNo, p);
  return m;
}
