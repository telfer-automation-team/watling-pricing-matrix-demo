-- ============================================================
-- Watling Pricing Matrix — manual layer (run once, after schema.sql)
-- These tables are re-applied on top of the uploaded JCB data on every rebuild,
-- so manual parts, deletions and fuel marks are never lost when files are re-uploaded.
-- ============================================================

-- Fuel marks. service_description = '' means "all services" for that part on that
-- machine; a filled service_description means "only this service".
-- model/variant = '' means it applies to every machine.
create table if not exists fuel_rule (
  part_no             text not null,
  model               text not null default '',
  variant             text not null default '',
  service_description text not null default '',
  is_fuel             boolean not null,
  updated_at          timestamptz not null default now(),
  primary key (part_no, model, variant, service_description)
);

-- Parts added by hand to a specific machine + service.
create table if not exists manual_part (
  id                  uuid primary key default gen_random_uuid(),
  model               text not null,
  variant             text not null,
  service_description text not null,
  part_no             text not null,
  description         text not null default '',
  quantity            numeric not null default 1,
  is_fuel             boolean not null default false,
  created_by          text,
  created_at          timestamptz not null default now(),
  unique (model, variant, service_description, part_no)
);

-- Tombstones: uploaded parts an admin removed from a service (so they don't reappear).
create table if not exists deleted_part (
  model               text not null,
  variant             text not null,
  service_description text not null,
  part_no             text not null,
  removed_by          text,
  removed_at          timestamptz not null default now(),
  primary key (model, variant, service_description, part_no)
);

alter table fuel_rule   enable row level security;
alter table manual_part enable row level security;
alter table deleted_part enable row level security;
