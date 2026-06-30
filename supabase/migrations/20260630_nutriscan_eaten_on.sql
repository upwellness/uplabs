-- ════════════════════════════════════════════════════════════════
-- NutriScan AI · "eaten on" date
-- ----------------------------------------------------------------
-- Optional date the meal was actually eaten (may differ from the scan's
-- created_at). The food log groups/filters by COALESCE(eaten_on, created_at::date).
-- ════════════════════════════════════════════════════════════════

alter table public.nutriscan_scans
  add column if not exists eaten_on date;

-- Speed up day grouping/filtering by the effective eaten date.
create index if not exists nutriscan_scans_eaten_on_idx
  on public.nutriscan_scans (user_id, eaten_on desc);
