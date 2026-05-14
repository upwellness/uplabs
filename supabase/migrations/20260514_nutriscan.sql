-- ════════════════════════════════════════════════════════════════
-- NutriScan AI · scan history per user
-- ════════════════════════════════════════════════════════════════

create table if not exists public.nutriscan_scans (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references auth.users on delete cascade not null,
  customer_id     uuid references public.customers on delete set null,

  food_identified  text,
  meal_type        text,
  notes            text,

  -- AI analysis (full JSON)
  raw_analysis     jsonb not null,

  -- Filterable extracts
  calories_estimate int,
  carb_g            numeric,
  protein_g         numeric,
  fat_g             numeric,
  fiber_g           numeric,
  glucose_impact_score int,
  health_score      int,

  created_at      timestamptz default now()
);

create index if not exists nutriscan_scans_user_idx     on public.nutriscan_scans (user_id, created_at desc);
create index if not exists nutriscan_scans_customer_idx on public.nutriscan_scans (customer_id, created_at desc);

alter table public.nutriscan_scans enable row level security;

-- Users see their own scans · admins see all
drop policy if exists "nutriscan_select_own" on public.nutriscan_scans;
create policy "nutriscan_select_own" on public.nutriscan_scans
  for select using (
    user_id = auth.uid() or public.my_role() = 'admin'
  );

drop policy if exists "nutriscan_insert_own" on public.nutriscan_scans;
create policy "nutriscan_insert_own" on public.nutriscan_scans
  for insert with check (user_id = auth.uid());

drop policy if exists "nutriscan_update_own" on public.nutriscan_scans;
create policy "nutriscan_update_own" on public.nutriscan_scans
  for update using (user_id = auth.uid() or public.my_role() = 'admin');

drop policy if exists "nutriscan_delete_own" on public.nutriscan_scans;
create policy "nutriscan_delete_own" on public.nutriscan_scans
  for delete using (user_id = auth.uid() or public.my_role() = 'admin');
