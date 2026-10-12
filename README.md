# Watling Pricing Matrix

Web rebuild of Watling JCB's Excel service-pricing tool. Pick a machine + hours →
service price, profit, parts list, and a multi-service package price. Admins upload
the two JCB files, tune the rules, and manage fuel marks — all persisted in Supabase.

Next.js 15 (App Router, TS) · Tailwind v4 · Supabase (Postgres) · installable PWA.

## Setup

1. **Database** — open the Supabase SQL editor and run `supabase/schema.sql`, then
   `supabase/features.sql` (manual-layer tables), then `supabase/features-2.sql` (price overrides + manual-part prices), then `supabase/features-3.sql` (restore support).
2. **Environment** — copy `.env.local.example` to `.env.local` and fill in:
   ```
   SUPABASE_URL=...                     # https://<project>.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=...        # server only — never NEXT_PUBLIC, never committed
   DATABASE_URL=...                     # Settings → Database → Session string (port 5432)
   WIPE_PASSWORD=...                    # required on Settings → wipe
   ```
   Set the same vars in Railway. **Rotate the service_role key if it was ever shared.**
3. **Run**
   ```bash
   npm install
   npm run dev     # http://localhost:3000
   ```
4. Sign in (one click — Engineer or Admin), go to **Upload data**, and upload the Price
   file and the Parts (SQT) file. The catalogue is empty until that first upload.

## How the data flows (why it's fast)

Quotes never touch the big tables. On upload the server parses the files, writes the raw
data, then **pre-aggregates every service once** into `service_agg` (~15k rows) with the
part classification, drum→litre conversion, fuel back-fill and 2,000-hr rule already
applied. A quote is then a single indexed read of `service_agg` + the master-formula
arithmetic — constant time no matter how big the catalogue is.

Tables: `parts_price` (raw prices) · `machine` (raw SQT grouped per machine, for
re-aggregation) · `service_agg` (what quotes read) · `fuel_override` · `rule_config` ·
`activity_log` · `profiles` (gets a `banned` column for the Users screen).

- **Upload** streams the file(s) into Postgres via `COPY` over a direct connection
  (`DATABASE_URL`), inside a single transaction: it truncates and reloads the affected tables
  and rebuilds `service_agg`, then commits atomically. If the upload fails or the connection
  drops, the whole transaction rolls back and the live tables are untouched — quotes keep
  working on the previous data, and you just retry. 294k rows load in a few seconds.
  Price-only and parts-only uploads each touch just their side.
- **Fuel mark** persists to `fuel_override` and re-aggregates only the affected machines.
- **Wipe** (Settings, password-protected) truncates the data tables via a Postgres function.
- **History** reads `activity_log`; clicking an entry jumps to where it happened.

## The pricing engine (verified)

`src/lib/pricing/engine.ts` is pure and deterministic, and verified against the real files:

```bash
node --experimental-strip-types scripts/verify-engine.ts <sqt.csv> <price.csv>
# PASS TM110 1000hr = £681.72 · PASS TM110 500hr = £582.24
```

Discounts, labour, mileage, waste and the 10L top-up are applied at quote time, so the
per-quote "Adjust pricing" panel (and the admin Rules screen) take effect without
re-aggregating.

## Auth

Interim **skip-Entra** sign-in (any click, Engineer/Admin role). The Supabase client
scaffolding is kept for the final phase, when this swaps to Microsoft Entra work-email SSO.

## Open questions for Andy / JCB
1. Is the 10L hydraulic top-up charged on live quotes today? (off by default)
2. JCB's fuel-filter part number by model (hardens the back-fill).
3. Confirm exact rule values.
