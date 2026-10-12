-- ============================================================
-- Watling Pricing Matrix — restore support (run once, after features-2.sql)
-- Adds the activity metadata column used to restore a deleted part from History.
-- ============================================================

alter table if exists activity_log add column if not exists meta jsonb;
