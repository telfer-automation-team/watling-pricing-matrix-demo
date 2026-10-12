import { supabaseAdmin } from "@/lib/supabase/admin";
import { pgPool } from "@/lib/db";
import { computePackage, computeQuote, nextServiceHours } from "@/lib/pricing/engine";
import { DEFAULT_RULES, type PartPrice, type RuleConfig, type ServiceAgg, type SqtLine } from "@/lib/pricing/types";
import { aggregateMachineFull, type DeletedPartRow, type FuelRuleRow, type ManualPartRow } from "@/lib/agg";

export type DemoUser = { id: string; name: string; email: string; role: "admin" | "engineer"; banned: boolean };
export type Activity = { id: string; at: string; user: string; kind: string; summary: string; detail?: string; link?: string; meta?: Record<string, unknown> | null };

const num = (v: unknown) => (v == null ? 0 : Number(v));
const machineKey = (m: string, v: string) => `${m}|||${v}`;
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

// ---- generic helpers --------------------------------------------------------
async function insertChunked(table: string, rows: Record<string, unknown>[], size: number) {
  const db = supabaseAdmin();
  for (let i = 0; i < rows.length; i += size) {
    const { error } = await db.from(table).insert(rows.slice(i, i + size) as never);
    if (error) throw new Error(`${table} insert failed at row ${i}: ${error.message}`);
  }
}

async function getPricesFor(partNos: string[]): Promise<Map<string, PartPrice>> {
  const db = supabaseAdmin();
  const uniq = [...new Set(partNos)].filter(Boolean);
  const map = new Map<string, PartPrice>();
  for (let i = 0; i < uniq.length; i += 300) {
    const { data, error } = await db.from("parts_price").select("*").in("part_no", uniq.slice(i, i + 300));
    if (error) throw new Error(`parts_price read failed: ${error.message}`);
    for (const r of data ?? []) map.set(r.part_no, { partNo: r.part_no, description: r.description, cost: num(r.cost), retail: num(r.retail) });
  }
  return map;
}

export type PriceOverrideRow = { part_no: string; cost: number; retail: number };

export async function loadManualLayer(): Promise<{
  fuelRules: FuelRuleRow[]; manuals: ManualPartRow[]; deletions: DeletedPartRow[]; priceOverrides: PriceOverrideRow[];
}> {
  const db = supabaseAdmin();
  const [{ data: fr }, { data: mp }, { data: dp }, { data: po }] = await Promise.all([
    db.from("fuel_rule").select("*"),
    db.from("manual_part").select("*"),
    db.from("deleted_part").select("*"),
    db.from("price_override").select("*"),
  ]);
  return {
    fuelRules: (fr ?? []).map((r) => ({ part_no: r.part_no, model: r.model ?? "", variant: r.variant ?? "", service_description: r.service_description ?? "", is_fuel: !!r.is_fuel })),
    manuals: (mp ?? []).map((r) => ({ model: r.model, variant: r.variant, service_description: r.service_description, part_no: r.part_no, description: r.description ?? "", quantity: num(r.quantity), is_fuel: !!r.is_fuel, cost: r.cost == null ? null : num(r.cost), retail: r.retail == null ? null : num(r.retail) })),
    deletions: (dp ?? []).map((r) => ({ model: r.model, variant: r.variant, service_description: r.service_description, part_no: r.part_no })),
    priceOverrides: (po ?? []).map((r) => ({ part_no: r.part_no, cost: num(r.cost), retail: num(r.retail) })),
  };
}

function rowToAgg(r: Record<string, unknown>): ServiceAgg {
  return {
    model: r.model as string, variant: r.variant as string,
    serviceDescription: r.service_description as string, serviceHours: num(r.service_hours),
    labourHours: num(r.labour_hours), lubRetail: num(r.lub_retail), lubCost: num(r.lub_cost),
    otherRetail: num(r.other_retail), otherCost: num(r.other_cost),
    parts: (r.parts as ServiceAgg["parts"]) ?? [],
  };
}
function aggToRow(a: ServiceAgg, product: string) {
  return {
    model: a.model, variant: a.variant, service_description: a.serviceDescription, product,
    service_hours: a.serviceHours, labour_hours: a.labourHours,
    lub_retail: a.lubRetail, lub_cost: a.lubCost, other_retail: a.otherRetail, other_cost: a.otherCost,
    parts: a.parts,
  };
}

async function log(a: Omit<Activity, "id" | "at">) {
  await supabaseAdmin().from("activity_log").insert({ user: a.user, kind: a.kind, summary: a.summary, detail: a.detail ?? null, link: a.link ?? null, meta: a.meta ?? null });
}

// Rebuild service_agg for specific machines (applies the manual layer).
// Fetches each machine by exact (model, variant) so large models never return a
// truncated/omitted row — the cause of "works for some models, not others".
async function reaggregateMachines(pairs: { model: string; variant: string }[]) {
  if (!pairs.length) return;
  const db = supabaseAdmin();
  const seen = new Set<string>();
  const unique = pairs.filter((p) => { const k = machineKey(p.model, p.variant); if (seen.has(k)) return false; seen.add(k); return true; });
  const layer = await loadManualLayer();

  for (const pair of unique) {
    const { data: m } = await db.from("machine").select("*").eq("model", pair.model).eq("variant", pair.variant).maybeSingle();
    if (!m) continue;
    const lines = (m.lines as SqtLine[]) ?? [];
    const manualPartNos = layer.manuals.filter((mp) => mp.model === pair.model && mp.variant === pair.variant).map((mp) => mp.part_no);
    const priceMap = await getPricesFor([...lines.map((l) => l.partNo), ...manualPartNos]);
    const overriddenPartNos = new Set<string>();
    for (const o of layer.priceOverrides) {
      priceMap.set(o.part_no, { partNo: o.part_no, description: priceMap.get(o.part_no)?.description ?? "", cost: o.cost, retail: o.retail });
      overriddenPartNos.add(o.part_no);
    }
    const aggs = aggregateMachineFull({
      product: (m.product as string) ?? "", model: pair.model, variant: pair.variant, lines, priceMap,
      fuelRules: layer.fuelRules, manuals: layer.manuals, deletions: layer.deletions, overriddenPartNos,
    });
    await db.from("service_agg").delete().eq("model", pair.model).eq("variant", pair.variant);
    if (aggs.length) await insertChunked("service_agg", aggs.map((a) => aggToRow(a, (m.product as string) ?? "")), 500);
  }
}

// ---- rules ------------------------------------------------------------------
export async function getRules(): Promise<RuleConfig> {
  const { data } = await supabaseAdmin().from("rule_config").select("rules").eq("id", 1).maybeSingle();
  return { ...DEFAULT_RULES, ...(data?.rules ?? {}) };
}
export async function setRules(partial: Partial<RuleConfig>, user = "Admin"): Promise<RuleConfig> {
  const current = await getRules();
  const next = { ...current, ...partial };
  const { error } = await supabaseAdmin().from("rule_config").upsert({ id: 1, rules: next });
  if (error) throw new Error(error.message);
  const changed = Object.keys(partial).filter((k) => (current as Record<string, unknown>)[k] !== (next as Record<string, unknown>)[k]);
  if (changed.length) await log({ user, kind: "rules", summary: "Updated pricing rules", detail: changed.join(", "), link: "/admin/config" });
  return next;
}

// ---- reads for the app ------------------------------------------------------
export async function getDataStatus() {
  const db = supabaseAdmin();
  const [{ count: priceRows }, { count: serviceRows }, { count: machineRows }] = await Promise.all([
    db.from("parts_price").select("*", { count: "exact", head: true }),
    db.from("service_agg").select("*", { count: "exact", head: true }),
    db.from("machine").select("*", { count: "exact", head: true }),
  ]);
  const { data: lastUp } = await db.from("activity_log").select("at,detail").eq("kind", "upload").order("at", { ascending: false }).limit(1).maybeSingle();
  return {
    priceRows: priceRows ?? 0, serviceRows: serviceRows ?? 0, machineRows: machineRows ?? 0,
    lastUpload: lastUp ? { at: lastUp.at as string, source: lastUp.detail as string } : null,
  };
}

export async function getActivities(): Promise<Activity[]> {
  const { data } = await supabaseAdmin().from("activity_log").select("*").order("at", { ascending: false }).limit(200);
  return (data ?? []).map((r) => ({ id: r.id, at: r.at, user: r.user, kind: r.kind, summary: r.summary, detail: r.detail ?? undefined, link: r.link ?? undefined, meta: r.meta ?? null }));
}

export async function getMachineTree() {
  const { data } = await supabaseAdmin().from("machine").select("product,model,variant");
  const tree = new Map<string, Map<string, Set<string>>>();
  for (const r of data ?? []) {
    const product = (r.product as string) ?? "Other";
    if (!tree.has(product)) tree.set(product, new Map());
    const models = tree.get(product)!;
    if (!models.has(r.model)) models.set(r.model, new Set());
    models.get(r.model)!.add(r.variant);
  }
  return [...tree.entries()].map(([product, models]) => ({
    product,
    models: [...models.entries()].map(([model, variants]) => ({ model, variants: [...variants].sort() })),
  }));
}

export async function listModels(): Promise<string[]> {
  const { data } = await supabaseAdmin().from("machine").select("model");
  return [...new Set((data ?? []).map((r) => r.model as string))].sort();
}

async function servicesFor(model: string, variant: string): Promise<ServiceAgg[]> {
  const { data } = await supabaseAdmin().from("service_agg").select("*").eq("model", model).eq("variant", variant);
  return (data ?? []).map(rowToAgg).sort((a, b) => a.serviceHours - b.serviceHours);
}
export async function getServices(model: string, variant: string) {
  return servicesFor(model, variant);
}

export async function getModelParts(model: string) {
  const { data } = await supabaseAdmin().from("service_agg").select("*").eq("model", model);
  const byVariant = new Map<string, ServiceAgg[]>();
  for (const r of data ?? []) {
    const a = rowToAgg(r);
    const arr = byVariant.get(a.variant) ?? [];
    arr.push(a);
    byVariant.set(a.variant, arr);
  }
  return [...byVariant.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([variant, services]) => ({ variant, services: services.sort((x, y) => x.serviceHours - y.serviceHours) }));
}

export async function getQuote(model: string, variant: string, hours: number, packageCount = 3, overrides?: Partial<RuleConfig>) {
  const rulesBase = await getRules();
  // Guardrails: engineers may flex a single quote, but every lever is clamped to the
  // limits Andy set in Rules & rates. Nothing an engineer sends can breach these.
  const safe: Partial<RuleConfig> = {};
  if (overrides?.lubricantDiscount != null) safe.lubricantDiscount = clamp(overrides.lubricantDiscount, 0, rulesBase.maxLubricantDiscount);
  if (overrides?.otherDiscount != null) safe.otherDiscount = clamp(overrides.otherDiscount, 0, rulesBase.maxOtherDiscount);
  if (overrides?.labourRate != null) safe.labourRate = Math.max(rulesBase.minLabourRate, overrides.labourRate);
  if (overrides?.mileageDistance != null) safe.mileageDistance = Math.max(0, overrides.mileageDistance); // per-customer distance (>= 0)
  if (overrides?.waste != null) safe.waste = clamp(overrides.waste, 0, rulesBase.waste);
  if (overrides?.hydraulicTopupEnabled != null) safe.hydraulicTopupEnabled = overrides.hydraulicTopupEnabled;
  if (overrides?.packageInflation != null) safe.packageInflation = clamp(overrides.packageInflation, 0, 1);
  const rules: RuleConfig = { ...rulesBase, ...safe };

  const services = await servicesFor(model, variant);
  const nh = nextServiceHours(services, hours);
  if (nh == null) return { quote: null, pkg: null };
  const agg = services.find((x) => x.serviceHours === nh)!;
  return { quote: computeQuote(agg, rules, hours), pkg: computePackage(services, rules, hours, packageCount) };
}

// ---- users (profiles) -------------------------------------------------------
export async function getUsers(): Promise<DemoUser[]> {
  const { data, error } = await supabaseAdmin().from("profiles").select("*");
  if (error) return [];
  return (data ?? []).map((r) => ({
    id: String(r.id),
    name: (r.full_name as string) || (r.name as string) || (r.email as string) || String(r.id),
    email: (r.email as string) || "",
    role: (r.role as "admin" | "engineer") || "engineer",
    banned: Boolean(r.banned),
  }));
}
export async function setBanned(userId: string, banned: boolean, user = "Admin") {
  const { data, error } = await supabaseAdmin().from("profiles").update({ banned }).eq("id", userId).select().maybeSingle();
  if (error || !data) return null;
  const u: DemoUser = {
    id: String(data.id), name: (data.full_name as string) || (data.email as string) || String(data.id),
    email: (data.email as string) || "", role: (data.role as "admin" | "engineer") || "engineer", banned: Boolean(data.banned),
  };
  await log({ user, kind: "user", summary: `${banned ? "Banned" : "Unbanned"} ${u.name}`, link: "/admin/users" });
  return u;
}

// ---- fuel marks (scoped) ----------------------------------------------------
export async function setFuelRule(
  partNo: string,
  isFuel: boolean,
  scope: "service" | "all",
  ctx: { model: string; variant: string; service: string; description?: string; user?: string }
) {
  const db = supabaseAdmin();
  const row =
    scope === "service"
      ? { part_no: partNo, model: ctx.model, variant: ctx.variant, service_description: ctx.service, is_fuel: isFuel }
      : { part_no: partNo, model: "", variant: "", service_description: "", is_fuel: isFuel };
  const { error } = await db.from("fuel_rule").upsert(row);
  if (error) throw new Error(error.message);

  let pairs: { model: string; variant: string }[];
  if (scope === "service") {
    pairs = [{ model: ctx.model, variant: ctx.variant }];
  } else {
    const { data: hits } = await db.from("service_agg").select("model,variant").contains("parts", [{ partNo }]);
    const set = new Map<string, { model: string; variant: string }>();
    for (const h of hits ?? []) set.set(machineKey(h.model as string, h.variant as string), { model: h.model as string, variant: h.variant as string });
    if (ctx.model && ctx.variant) set.set(machineKey(ctx.model, ctx.variant), { model: ctx.model, variant: ctx.variant });
    pairs = [...set.values()];
  }
  await reaggregateMachines(pairs);

  await log({
    user: ctx.user ?? "Admin", kind: "fuel",
    summary: `${isFuel ? "Marked" : "Unmarked"} ${partNo} as fuel (${scope === "service" ? "this service" : "all services"})`,
    detail: [ctx.model, ctx.variant, scope === "service" ? ctx.service : "", ctx.description].filter(Boolean).join(" · ") || undefined,
    link: `/admin/parts?model=${encodeURIComponent(ctx.model)}&part=${encodeURIComponent(partNo)}`,
  });
  return isFuel;
}

// ---- manual parts + deletions ----------------------------------------------
export async function addManualPart(p: {
  model: string; variant: string; service: string; partNo: string;
  description: string; quantity: number; isFuel: boolean;
  cost?: number | null; retail?: number | null; user?: string;
}) {
  const db = supabaseAdmin();
  const { error } = await db.from("manual_part").upsert({
    model: p.model, variant: p.variant, service_description: p.service, part_no: p.partNo,
    description: p.description, quantity: p.quantity, is_fuel: p.isFuel,
    cost: p.cost ?? null, retail: p.retail ?? null, created_by: p.user ?? "Admin",
  }, { onConflict: "model,variant,service_description,part_no" });
  if (error) throw new Error(error.message);
  await reaggregateMachines([{ model: p.model, variant: p.variant }]);
  await log({
    user: p.user ?? "Admin", kind: "part",
    summary: `Saved manual part ${p.partNo}${p.isFuel ? " (fuel)" : ""}${p.retail != null ? ` @ £${p.retail}` : ""}`,
    detail: `${p.model} · ${p.variant} · ${p.service}`,
    link: `/admin/parts?model=${encodeURIComponent(p.model)}&part=${encodeURIComponent(p.partNo)}`,
  });
}

// Catalogue price override (admin-edited price for a real JCB part number).
export async function setPriceOverride(partNo: string, cost: number, retail: number, user = "Admin", ctx?: { model?: string; variant?: string }) {
  const db = supabaseAdmin();
  const { error } = await db.from("price_override").upsert({ part_no: partNo, cost, retail, updated_by: user });
  if (error) throw new Error(error.message);
  await reaggregateForPart(partNo, ctx);
  await log({ user, kind: "price", summary: `Edited price of ${partNo} → £${retail}`, detail: `cost £${cost}`, link: `/admin/parts?part=${encodeURIComponent(partNo)}` });
}
export async function clearPriceOverride(partNo: string, user = "Admin", ctx?: { model?: string; variant?: string }) {
  const db = supabaseAdmin();
  await db.from("price_override").delete().eq("part_no", partNo);
  await reaggregateForPart(partNo, ctx);
  await log({ user, kind: "price", summary: `Reset price of ${partNo} to the file`, link: `/admin/parts?part=${encodeURIComponent(partNo)}` });
}

// Re-aggregate machines that include a part (after a price edit). The current machine
// (from the UI) is always included so the open card refreshes; other machines are a
// best-effort jsonb lookup.
async function reaggregateForPart(partNo: string, ctx?: { model?: string; variant?: string }) {
  const db = supabaseAdmin();
  const pairs: { model: string; variant: string }[] = [];
  if (ctx?.model && ctx?.variant) pairs.push({ model: ctx.model, variant: ctx.variant });
  try {
    const { data: hits } = await db.from("service_agg").select("model,variant").contains("parts", [{ partNo }]);
    for (const h of hits ?? []) pairs.push({ model: h.model as string, variant: h.variant as string });
  } catch { /* best effort */ }
  await reaggregateMachines(pairs);
}

// Current effective price for a part (file price with any override applied).
export async function getEffectivePrice(partNo: string) {
  const db = supabaseAdmin();
  const [{ data: ov }, base] = await Promise.all([
    db.from("price_override").select("*").eq("part_no", partNo).maybeSingle(),
    getPricesFor([partNo]),
  ]);
  if (ov) return { cost: num(ov.cost), retail: num(ov.retail), overridden: true, description: base.get(partNo)?.description ?? "" };
  const b = base.get(partNo);
  return { cost: b?.cost ?? 0, retail: b?.retail ?? 0, overridden: false, description: b?.description ?? "" };
}

// Raw manual-part rows for a model (used to prefill the edit form).
export async function getManualRows(model: string) {
  const { data } = await supabaseAdmin().from("manual_part").select("*").eq("model", model);
  return (data ?? []).map((r) => ({
    variant: r.variant as string, service: r.service_description as string, partNo: r.part_no as string,
    description: (r.description as string) ?? "", quantity: num(r.quantity), isFuel: !!r.is_fuel,
    cost: r.cost == null ? null : num(r.cost), retail: r.retail == null ? null : num(r.retail),
  }));
}

export async function deletePart(p: {
  model: string; variant: string; service: string; partNo: string; isManual: boolean; user?: string;
}) {
  const db = supabaseAdmin();
  let manualData: Record<string, unknown> | null = null;
  if (p.isManual) {
    const { data } = await db.from("manual_part").select("*").match({ model: p.model, variant: p.variant, service_description: p.service, part_no: p.partNo }).maybeSingle();
    if (data) manualData = { description: data.description, quantity: num(data.quantity), isFuel: !!data.is_fuel, cost: data.cost == null ? null : num(data.cost), retail: data.retail == null ? null : num(data.retail) };
    await db.from("manual_part").delete().match({ model: p.model, variant: p.variant, service_description: p.service, part_no: p.partNo });
  } else {
    const { error } = await db.from("deleted_part").upsert({
      model: p.model, variant: p.variant, service_description: p.service, part_no: p.partNo, removed_by: p.user ?? "Admin",
    });
    if (error) throw new Error(error.message);
  }
  await reaggregateMachines([{ model: p.model, variant: p.variant }]);
  await log({
    user: p.user ?? "Admin", kind: "part",
    summary: `Removed part ${p.partNo}`,
    detail: `${p.model} · ${p.variant} · ${p.service}`,
    link: `/admin/parts?model=${encodeURIComponent(p.model)}`,
    meta: { action: "delete", model: p.model, variant: p.variant, service: p.service, partNo: p.partNo, isManual: p.isManual, manualData },
  });
}

// Restore a part that was removed (from a History entry's id).
export async function restorePart(activityId: string, user = "Admin") {
  const db = supabaseAdmin();
  const { data } = await db.from("activity_log").select("meta").eq("id", activityId).maybeSingle();
  const meta = (data?.meta ?? null) as Record<string, unknown> | null;
  if (!meta || meta.action !== "delete") throw new Error("Nothing to restore for this entry.");
  const model = String(meta.model), variant = String(meta.variant), service = String(meta.service), partNo = String(meta.partNo);
  if (meta.isManual) {
    const md = (meta.manualData ?? {}) as Record<string, unknown>;
    const { error } = await db.from("manual_part").upsert({
      model, variant, service_description: service, part_no: partNo,
      description: (md.description as string) ?? "", quantity: (md.quantity as number) ?? 1, is_fuel: !!md.isFuel,
      cost: md.cost ?? null, retail: md.retail ?? null, created_by: user,
    }, { onConflict: "model,variant,service_description,part_no" });
    if (error) throw new Error(error.message);
  } else {
    await db.from("deleted_part").delete().match({ model, variant, service_description: service, part_no: partNo });
  }
  await reaggregateMachines([{ model, variant }]);
  await log({ user, kind: "part", summary: `Restored part ${partNo}`, detail: `${model} · ${variant} · ${service}`, link: `/admin/parts?model=${encodeURIComponent(model)}&part=${encodeURIComponent(partNo)}` });
}

export async function wipeData(user = "Admin") {
  const client = await pgPool().connect();
  try {
    await client.query("truncate parts_price, machine, service_agg");
    // clear the manual layer too (full reset)
    await client.query("truncate fuel_rule, manual_part, deleted_part, price_override");
    await client.query('insert into activity_log ("user", kind, summary) values ($1,$2,$3)', [user, "wipe", "Wiped all data"]);
  } finally {
    client.release();
  }
  return getDataStatus();
}
