import { from as copyFrom } from "pg-copy-streams";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { pgPool } from "@/lib/db";
import { buildPriceMap } from "@/lib/pricing/engine";
import { aggregateMachineFull, type DeletedPartRow, type FuelRuleRow, type ManualPartRow } from "@/lib/agg";
import type { PartPrice, ServiceAgg, SqtLine } from "@/lib/pricing/types";

// ---- CSV helpers (strings always quoted; numbers raw) ----
function field(v: string | number): string {
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "0";
  return `"${String(v).replace(/"/g, '""')}"`;
}
const line = (vals: (string | number)[]) => vals.map(field).join(",") + "\n";

async function copyRows(client: import("pg").PoolClient, sql: string, gen: Iterable<string>) {
  const dest = client.query(copyFrom(sql));
  await pipeline(Readable.from(gen), dest);
}

type MachineGroup = { model: string; variant: string; product: string; lines: SqtLine[] };

function groupByMachine(sqt: SqtLine[]): MachineGroup[] {
  const by = new Map<string, MachineGroup>();
  for (const l of sqt) {
    const k = `${l.model}|||${l.variant}`;
    if (!by.has(k)) by.set(k, { model: l.model, variant: l.variant, product: l.product, lines: [] });
    by.get(k)!.lines.push(l);
  }
  return [...by.values()];
}

function* pricesGen(prices: PartPrice[]) {
  for (const p of prices) yield line([p.partNo, p.description ?? "", p.cost, p.retail]);
}
function* machineGen(machines: MachineGroup[]) {
  for (const m of machines) yield line([m.model, m.variant, m.product ?? "", JSON.stringify(m.lines)]);
}
function* aggGen(rows: { agg: ServiceAgg; product: string }[]) {
  for (const { agg: a, product } of rows) {
    yield line([
      a.model, a.variant, a.serviceDescription, product,
      a.serviceHours, a.labourHours, a.lubRetail, a.lubCost, a.otherRetail, a.otherCost,
      JSON.stringify(a.parts),
    ]);
  }
}

/**
 * Fast, crash-safe ingest. Parses are done in the caller; this streams the data into
 * Postgres via COPY inside ONE transaction. If anything fails, the whole thing rolls
 * back and the live tables are untouched (quotes keep serving the previous data).
 */
export async function ingestCopy(opts: { sqt?: SqtLine[]; prices?: PartPrice[]; source: string; user?: string }) {
  const client = await pgPool().connect();
  try {
    // manual layer (re-applied on top of the uploaded data, so it survives uploads)
    const [frRes, mpRes, dpRes] = await Promise.all([
      client.query("select part_no, model, variant, service_description, is_fuel from fuel_rule"),
      client.query("select model, variant, service_description, part_no, description, quantity, is_fuel, cost, retail from manual_part"),
      client.query("select model, variant, service_description, part_no from deleted_part"),
    ]);
    const fuelRules: FuelRuleRow[] = frRes.rows.map((r) => ({ part_no: r.part_no, model: r.model ?? "", variant: r.variant ?? "", service_description: r.service_description ?? "", is_fuel: !!r.is_fuel }));
    const manuals: ManualPartRow[] = mpRes.rows.map((r) => ({ model: r.model, variant: r.variant, service_description: r.service_description, part_no: r.part_no, description: r.description ?? "", quantity: Number(r.quantity) || 0, is_fuel: !!r.is_fuel, cost: r.cost == null ? null : Number(r.cost), retail: r.retail == null ? null : Number(r.retail) }));
    const deletions: DeletedPartRow[] = dpRes.rows.map((r) => ({ model: r.model, variant: r.variant, service_description: r.service_description, part_no: r.part_no }));

    // machines: from the new SQT if uploaded, else the existing ones
    let machines: MachineGroup[];
    if (opts.sqt) {
      machines = groupByMachine(opts.sqt);
    } else {
      const r = await client.query("select model, variant, product, lines from machine");
      machines = r.rows.map((x) => ({ model: x.model, variant: x.variant, product: x.product ?? "", lines: (x.lines as SqtLine[]) ?? [] }));
    }

    // price map: from the new prices if uploaded, else look up the parts we need
    let priceMap: Map<string, PartPrice>;
    if (opts.prices) {
      priceMap = buildPriceMap(opts.prices);
    } else {
      const partNos = [...new Set([...machines.flatMap((m) => m.lines.map((l) => l.partNo)), ...manuals.map((m) => m.part_no)])];
      const r = await client.query(
        "select part_no, description, cost, retail from parts_price where part_no = any($1::text[])",
        [partNos]
      );
      priceMap = new Map(r.rows.map((x) => [x.part_no as string, { partNo: x.part_no, description: x.description, cost: Number(x.cost), retail: Number(x.retail) }]));
    }

    // recompute the pre-aggregated service rows (the ones quotes read), manual layer applied.
    // NOTE: catalogue price edits are intentionally NOT re-applied — a new file wins. They
    // are cleared below so the fresh JCB prices take over. Manual parts keep their own prices.
    const aggRows: { agg: ServiceAgg; product: string }[] = [];
    for (const m of machines) {
      const aggs = aggregateMachineFull({ product: m.product, model: m.model, variant: m.variant, lines: m.lines, priceMap, fuelRules, manuals, deletions });
      for (const agg of aggs) aggRows.push({ agg, product: m.product });
    }

    // one transaction: truncate + COPY each affected table, then commit atomically
    await client.query("BEGIN");
    if (opts.prices) {
      await client.query("truncate parts_price");
      await copyRows(client, "COPY parts_price (part_no,description,cost,retail) FROM STDIN WITH (FORMAT csv)", pricesGen(opts.prices));
    }
    if (opts.sqt) {
      await client.query("truncate machine");
      await copyRows(client, "COPY machine (model,variant,product,lines) FROM STDIN WITH (FORMAT csv)", machineGen(machines));
    }
    await client.query("truncate service_agg");
    await copyRows(
      client,
      "COPY service_agg (model,variant,service_description,product,service_hours,labour_hours,lub_retail,lub_cost,other_retail,other_cost,parts) FROM STDIN WITH (FORMAT csv)",
      aggGen(aggRows)
    );
    await client.query("truncate price_override"); // new file replaces any catalogue price edits
    await client.query('insert into activity_log ("user", kind, summary, detail) values ($1,$2,$3,$4)', [
      opts.user ?? "Admin", "upload", "Uploaded data", opts.source,
    ]);
    await client.query("COMMIT");
  } catch (e) {
    try { await client.query("ROLLBACK"); } catch { /* ignore */ }
    throw e;
  } finally {
    client.release();
  }
}
