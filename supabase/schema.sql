-- ============================================================
-- Watling Pricing Matrix — Supabase schema
-- Run this once in the Supabase SQL editor.
-- Quotes read ONLY service_agg (small, fast). The big tables are touched
-- only at upload time and when re-aggregating after a fuel change.
-- ============================================================

-- Raw price file (one row per part number). ~294k rows.
create table if not exists parts_price (
  part_no     text primary key,
  description text,
  cost        numeric,
  retail      numeric
);

-- Raw SQT grouped per machine (one row per model+variant). ~580 rows.
-- lines jsonb = SqtLine[] for that machine (kept for re-aggregation on fuel changes).
create table if not exists machine (
  model   text not null,
  variant text not null,
  product text,
  lines   jsonb not null default '[]'::jsonb,
  primary key (model, variant)
);

-- Pre-aggregated per-service pricing (what quotes read). ~15k rows.
create table if not exists service_agg (
  model               text not null,
  variant             text not null,
  service_description text not null,
  product             text,
  service_hours       integer,
  labour_hours        numeric,
  lub_retail          numeric,
  lub_cost            numeric,
  other_retail        numeric,
  other_cost          numeric,
  parts               jsonb not null default '[]'::jsonb,
  primary key (model, variant, service_description)
);
create index if not exists service_agg_model_idx on service_agg (model);

-- Admin fuel marks: overrides the text guess in both directions.
create table if not exists fuel_override (
  part_no text primary key,
  is_fuel boolean not null
);

-- Single-row pricing rules (discounts, labour, mileage, top-up, package).
create table if not exists rule_config (
  id    integer primary key default 1,
  rules jsonb not null
);

insert into rule_config (id, rules) values (1, '{
  "lubricantDiscount": 0.10, "otherDiscount": 0.15,
  "labourRate": 65, "labourCostRate": 57.5, "waste": 10,
  "mileageDistance": 50, "mileageRate": 1.25, "mileageTravelHours": 1,
  "hydraulicTopupEnabled": false, "hydraulicTopupPartNo": "HYD-46-10L",
  "hydraulicTopupRetail": 35.445, "hydraulicTopupCost": 26.585,
  "packageInflation": 0.05, "packageDiscounts": {"2":0.05,"3":0.075,"4":0.10}
}'::jsonb)
on conflict (id) do nothing;

-- Activity / audit log for the History screen.
create table if not exists activity_log (
  id      uuid primary key default gen_random_uuid(),
  at      timestamptz not null default now(),
  "user"  text,
  kind    text,
  summary text,
  detail  text,
  link    text
);
create index if not exists activity_log_at_idx on activity_log (at desc);

-- Existing profiles table: add a banned flag for the Users screen.
alter table if exists profiles add column if not exists banned boolean not null default false;

-- Server-only access via the service_role key (which bypasses RLS).
-- Enable RLS with no policies so the anon key can't read these tables.
alter table parts_price   enable row level security;
alter table machine       enable row level security;
alter table service_agg   enable row level security;
alter table fuel_override enable row level security;
alter table rule_config   enable row level security;
alter table activity_log  enable row level security;

-- Truncation helpers (called from the app with the service role).
create or replace function clear_parts_price() returns void language sql security definer as $$ truncate parts_price; $$;
create or replace function clear_machines()    returns void language sql security definer as $$ truncate machine; $$;
create or replace function clear_service_agg()  returns void language sql security definer as $$ truncate service_agg; $$;
create or replace function wipe_all_data()      returns void language sql security definer as $$
  truncate parts_price, machine, service_agg;
  delete from fuel_override;
$$;

-- Speeds up "which machines include this part" when a fuel mark changes.
create index if not exists service_agg_parts_gin on service_agg using gin (parts);
