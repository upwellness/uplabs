-- ════════════════════════════════════════════════════════════════
-- UP Pulse · WHOOP integration — CSV import (all 4 exports) + OAuth
-- Captures EVERY field from the WHOOP data export:
--   physiological_cycles.csv → whoop_daily
--   sleeps.csv               → whoop_sleeps
--   workouts.csv             → whoop_workouts
--   journal_entries.csv      → whoop_journal
-- ════════════════════════════════════════════════════════════════

-- ── Allow 'whoop' + 'whoop_csv' as connection providers ─────────
alter table public.pulse_connections drop constraint if exists pulse_connections_provider_check;
alter table public.pulse_connections
  add constraint pulse_connections_provider_check
  check (provider in ('google_fit','fitbit','apple_manual','whoop','whoop_csv'));

-- ════════════════════════════════════════════════════════════════
-- 1. whoop_daily — physiological_cycles.csv (one row per cycle/day)
-- ════════════════════════════════════════════════════════════════
create table if not exists public.whoop_daily (
  id                 bigserial primary key,
  customer_id        uuid not null references public.customers(id) on delete cascade,
  connection_id      uuid references public.pulse_connections(id) on delete set null,
  cycle_date         date not null,
  cycle_start        timestamptz,
  cycle_end          timestamptz,
  timezone           text,
  -- recovery + cardiovascular
  recovery           numeric,   -- %
  rhr                numeric,   -- bpm
  hrv                numeric,   -- ms (rmssd)
  spo2               numeric,   -- %
  skin_temp          numeric,   -- celsius
  -- strain + energy + heart rate
  strain             numeric,   -- 0-21
  energy_burned      numeric,   -- cal
  max_hr             numeric,   -- bpm
  avg_hr             numeric,   -- bpm
  -- sleep timing
  sleep_onset        timestamptz,
  wake_onset         timestamptz,
  -- sleep summary
  sleep_perf         numeric,   -- %
  resp_rate          numeric,   -- rpm
  asleep_min         integer,
  in_bed_min         integer,
  light_min          integer,
  deep_min           integer,
  rem_min            integer,
  awake_min          integer,
  sleep_need_min     integer,
  sleep_debt         numeric,   -- min
  sleep_eff          numeric,   -- %
  sleep_consistency  numeric,   -- %
  source             text not null default 'whoop_csv',  -- whoop_csv | whoop_oauth
  raw                jsonb,
  created_at         timestamptz not null default now(),
  unique (customer_id, cycle_date)
);
create index if not exists idx_whoop_daily_customer
  on public.whoop_daily(customer_id, cycle_date desc);

-- ════════════════════════════════════════════════════════════════
-- 2. whoop_sleeps — sleeps.csv (per sleep incl. naps)
-- ════════════════════════════════════════════════════════════════
create table if not exists public.whoop_sleeps (
  id                 bigserial primary key,
  customer_id        uuid not null references public.customers(id) on delete cascade,
  connection_id      uuid references public.pulse_connections(id) on delete set null,
  cycle_start        timestamptz,
  cycle_end          timestamptz,
  timezone           text,
  sleep_onset        timestamptz not null,
  wake_onset         timestamptz,
  is_nap             boolean not null default false,
  sleep_perf         numeric,
  resp_rate          numeric,
  asleep_min         integer,
  in_bed_min         integer,
  light_min          integer,
  deep_min           integer,
  rem_min            integer,
  awake_min          integer,
  sleep_need_min     integer,
  sleep_debt         numeric,
  sleep_eff          numeric,
  sleep_consistency  numeric,
  source             text not null default 'whoop_csv',
  raw                jsonb,
  created_at         timestamptz not null default now(),
  unique (customer_id, sleep_onset)
);
create index if not exists idx_whoop_sleeps_customer
  on public.whoop_sleeps(customer_id, sleep_onset desc);

-- ════════════════════════════════════════════════════════════════
-- 3. whoop_workouts — workouts.csv (per session incl. HR zones)
-- ════════════════════════════════════════════════════════════════
create table if not exists public.whoop_workouts (
  id                 bigserial primary key,
  customer_id        uuid not null references public.customers(id) on delete cascade,
  connection_id      uuid references public.pulse_connections(id) on delete set null,
  cycle_start        timestamptz,
  timezone           text,
  workout_start      timestamptz not null,
  workout_end        timestamptz,
  duration_min       numeric,
  activity_name      text,
  activity_strain    numeric,
  energy_burned      numeric,   -- cal
  max_hr             numeric,
  avg_hr             numeric,
  hr_zone1_pct       numeric,
  hr_zone2_pct       numeric,
  hr_zone3_pct       numeric,
  hr_zone4_pct       numeric,
  hr_zone5_pct       numeric,
  gps_enabled        boolean,
  source             text not null default 'whoop_csv',
  raw                jsonb,
  created_at         timestamptz not null default now(),
  unique (customer_id, workout_start)
);
create index if not exists idx_whoop_workouts_customer
  on public.whoop_workouts(customer_id, workout_start desc);

-- ════════════════════════════════════════════════════════════════
-- 4. whoop_journal — journal_entries.csv (behavior log)
-- ════════════════════════════════════════════════════════════════
create table if not exists public.whoop_journal (
  id                 bigserial primary key,
  customer_id        uuid not null references public.customers(id) on delete cascade,
  connection_id      uuid references public.pulse_connections(id) on delete set null,
  cycle_start        timestamptz,
  cycle_date         date,
  timezone           text,
  question_text      text not null,
  answered_yes       boolean,
  notes              text,
  source             text not null default 'whoop_csv',
  created_at         timestamptz not null default now(),
  unique (customer_id, cycle_start, question_text)
);
create index if not exists idx_whoop_journal_customer
  on public.whoop_journal(customer_id, cycle_date desc);

-- ════════════════════════════════════════════════════════════════
-- RLS — per-coach + admin (mirror pulse_readings) · explicit policies
-- ════════════════════════════════════════════════════════════════
alter table public.whoop_daily     enable row level security;
alter table public.whoop_sleeps    enable row level security;
alter table public.whoop_workouts  enable row level security;
alter table public.whoop_journal   enable row level security;

-- whoop_daily
drop policy if exists whoop_daily_admin on public.whoop_daily;
drop policy if exists whoop_daily_own   on public.whoop_daily;
create policy whoop_daily_admin on public.whoop_daily for all using (public.my_role() = 'admin');
create policy whoop_daily_own   on public.whoop_daily for all using (
  exists (select 1 from public.customers c where c.id = whoop_daily.customer_id and c.coach_id = auth.uid()));

-- whoop_sleeps
drop policy if exists whoop_sleeps_admin on public.whoop_sleeps;
drop policy if exists whoop_sleeps_own   on public.whoop_sleeps;
create policy whoop_sleeps_admin on public.whoop_sleeps for all using (public.my_role() = 'admin');
create policy whoop_sleeps_own   on public.whoop_sleeps for all using (
  exists (select 1 from public.customers c where c.id = whoop_sleeps.customer_id and c.coach_id = auth.uid()));

-- whoop_workouts
drop policy if exists whoop_workouts_admin on public.whoop_workouts;
drop policy if exists whoop_workouts_own   on public.whoop_workouts;
create policy whoop_workouts_admin on public.whoop_workouts for all using (public.my_role() = 'admin');
create policy whoop_workouts_own   on public.whoop_workouts for all using (
  exists (select 1 from public.customers c where c.id = whoop_workouts.customer_id and c.coach_id = auth.uid()));

-- whoop_journal
drop policy if exists whoop_journal_admin on public.whoop_journal;
drop policy if exists whoop_journal_own   on public.whoop_journal;
create policy whoop_journal_admin on public.whoop_journal for all using (public.my_role() = 'admin');
create policy whoop_journal_own   on public.whoop_journal for all using (
  exists (select 1 from public.customers c where c.id = whoop_journal.customer_id and c.coach_id = auth.uid()));

-- ════════════════════════════════════════════════════════════════
-- Verify:
--   select count(*) from public.whoop_daily;
--   select count(*) from public.whoop_sleeps;
--   select count(*) from public.whoop_workouts;
--   select count(*) from public.whoop_journal;
-- ════════════════════════════════════════════════════════════════
