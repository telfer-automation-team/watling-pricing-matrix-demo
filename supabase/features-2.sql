-- ============================================================
-- Watling Pricing Matrix — price editing (run once, after features.sql)
-- Admin price edits live in their own layer and are re-applied after every upload,
-- so they survive re-uploads. Manual parts can also carry their own price.
-- ============================================================

-- Per-part catalogue price overrides (admin-edited prices for real JCB part numbers).
create table if not exists price_override (
  part_no    text primary key,
  cost       numeric not null,
  retail     numeric not null,
  updated_by text,
  updated_at timestamptz not null default now()
);
alter table price_override enable row level security;

-- Manual parts can carry their own price (for off-catalogue lines). NULL = look it up.
alter table if exists manual_part add column if not exists cost   numeric;
alter table if exists manual_part add column if not exists retail numeric;
