-- ════════════════════════════════════════════════════════════════
-- น้องจาน — Plate Planner LINE Bot (Phase 1)
-- Per SPEC-LINE-BOT.md §6 — 1 LINE group : 1 customer · bot hosted in uplabs
--   line_bot_groups    — group ↔ customer mapping + push settings + seed
--   plate_plan_config  — per-customer goal/config/seed for the engine (1 row/customer)
--   supplement_schedule— per-customer vitamins/supplements per meal slot
--   line_bot_logs      — delivery + action audit log
--
-- All bot access is via the SERVICE ROLE (createAdminClient), which BYPASSES RLS.
-- RLS is enabled on every table and policies mirror the repo convention
-- (admin via public.my_role() + owning coach via customers.coach_id) so that
-- a future coach UI in UP Labs can read/write these rows under the user session.
-- DO NOT RUN — SQL only (Phase 1 deliverable).
-- ════════════════════════════════════════════════════════════════

-- ════════════════════════════════════════════════════════════════
-- 1. plate_plan_config — engine inputs per customer (goal + config + seed)
--    1 row per customer (unique customer_id). engine.calcTargets/buildPlan use
--    this + customers.height + latest measurements.weight.
-- ════════════════════════════════════════════════════════════════
create table if not exists public.plate_plan_config (
  id           uuid primary key default gen_random_uuid(),
  customer_id  uuid not null unique references public.customers(id) on delete cascade,
  goal         text not null default 'longevity'
                 check (goal in ('loss','longevity','muscle')),
  config       jsonb not null default '{}'::jsonb,   -- PlanConfig: { diet, noVeg, allergy[], shake, lockW }
  seed         integer not null default 1,           -- fixes the plan so the same day always renders the same menu
  even3        boolean not null default false,
  plan_len     integer not null default 30,          -- plan length before it cycles (7/30/49)
  updated_at   timestamptz not null default now()
);
create index if not exists idx_plate_plan_config_customer
  on public.plate_plan_config(customer_id);

-- ════════════════════════════════════════════════════════════════
-- 2. line_bot_groups — LINE group ↔ customer mapping + push settings
--    line_group_id is unique → 1 group : 1 customer (SPEC non-goal: no multi-customer groups in v1).
-- ════════════════════════════════════════════════════════════════
create table if not exists public.line_bot_groups (
  id                  uuid primary key default gen_random_uuid(),
  line_group_id       text not null unique,
  customer_id         uuid references public.customers(id) on delete set null,
  program_start_date  date not null default current_date,
  push_enabled        boolean not null default true,
  push_time           time not null default '18:00',   -- Asia/Bangkok (scheduling is done by the cron, not stored TZ)
  seed                integer not null default 1,       -- per-group plan seed (stable menu regardless of when pressed)
  created_by          uuid references auth.users(id) on delete set null,
  created_at          timestamptz not null default now()
);
create unique index if not exists idx_line_bot_groups_group_id
  on public.line_bot_groups(line_group_id);
create index if not exists idx_line_bot_groups_customer
  on public.line_bot_groups(customer_id);
create index if not exists idx_line_bot_groups_push
  on public.line_bot_groups(push_enabled) where push_enabled;

-- ════════════════════════════════════════════════════════════════
-- 3. supplement_schedule — vitamins/supplements per meal slot (coach-set)
--    items is a JSON string[] e.g. ["Double X 1 ชุด","Omega 1 เม็ด"].
--    meal_slot is matched against the engine's meal names (see lib/line/meal-plan.ts).
-- ════════════════════════════════════════════════════════════════
create table if not exists public.supplement_schedule (
  id           uuid primary key default gen_random_uuid(),
  customer_id  uuid not null references public.customers(id) on delete cascade,
  meal_slot    text not null,                          -- 'เช้า' | 'กลางวัน' | 'เย็น' | 'ของว่าง' (free text, matched loosely)
  items        jsonb not null default '[]'::jsonb,     -- string[]
  sort         integer not null default 0,
  created_at   timestamptz not null default now(),
  unique (customer_id, meal_slot)
);
create index if not exists idx_supplement_schedule_customer
  on public.supplement_schedule(customer_id, sort);

-- ════════════════════════════════════════════════════════════════
-- 4. line_bot_logs — delivery + action audit log
--    type:   'today' | 'tomorrow' | 'push' | 'join' | 'bind' | 'setday' | 'error' | 'unbound'
--    status: 'ok' | 'fail' | 'skip'
-- ════════════════════════════════════════════════════════════════
create table if not exists public.line_bot_logs (
  id        uuid primary key default gen_random_uuid(),
  group_id  uuid references public.line_bot_groups(id) on delete set null,
  type      text not null,
  status    text not null default 'ok',
  payload   jsonb not null default '{}'::jsonb,
  sent_at   timestamptz not null default now()
);
create index if not exists idx_line_bot_logs_group
  on public.line_bot_logs(group_id, sent_at desc);
create index if not exists idx_line_bot_logs_type
  on public.line_bot_logs(type, sent_at desc);

-- ════════════════════════════════════════════════════════════════
-- RLS — enable everywhere. Bot uses the service role (bypasses RLS); these
-- policies are for the future coach UI under a user session.
-- Convention mirrors 20260615_whoop_wearable.sql: admin via public.my_role(),
-- owner via customers.coach_id = auth.uid().
-- ════════════════════════════════════════════════════════════════
alter table public.plate_plan_config   enable row level security;
alter table public.line_bot_groups     enable row level security;
alter table public.supplement_schedule enable row level security;
alter table public.line_bot_logs       enable row level security;

-- plate_plan_config
drop policy if exists plate_plan_config_admin on public.plate_plan_config;
drop policy if exists plate_plan_config_own   on public.plate_plan_config;
create policy plate_plan_config_admin on public.plate_plan_config
  for all using (public.my_role() = 'admin');
create policy plate_plan_config_own on public.plate_plan_config
  for all using (
    exists (select 1 from public.customers c
            where c.id = plate_plan_config.customer_id and c.coach_id = auth.uid()));

-- supplement_schedule
drop policy if exists supplement_schedule_admin on public.supplement_schedule;
drop policy if exists supplement_schedule_own   on public.supplement_schedule;
create policy supplement_schedule_admin on public.supplement_schedule
  for all using (public.my_role() = 'admin');
create policy supplement_schedule_own on public.supplement_schedule
  for all using (
    exists (select 1 from public.customers c
            where c.id = supplement_schedule.customer_id and c.coach_id = auth.uid()));

-- line_bot_groups — admin full; coach limited to groups mapped to their own customers
drop policy if exists line_bot_groups_admin on public.line_bot_groups;
drop policy if exists line_bot_groups_own   on public.line_bot_groups;
create policy line_bot_groups_admin on public.line_bot_groups
  for all using (public.my_role() = 'admin');
create policy line_bot_groups_own on public.line_bot_groups
  for all using (
    customer_id is not null
    and exists (select 1 from public.customers c
                where c.id = line_bot_groups.customer_id and c.coach_id = auth.uid()));

-- line_bot_logs — admin full; coach can read logs for their own groups
drop policy if exists line_bot_logs_admin on public.line_bot_logs;
drop policy if exists line_bot_logs_own   on public.line_bot_logs;
create policy line_bot_logs_admin on public.line_bot_logs
  for all using (public.my_role() = 'admin');
create policy line_bot_logs_own on public.line_bot_logs
  for select using (
    exists (
      select 1
      from public.line_bot_groups g
      join public.customers c on c.id = g.customer_id
      where g.id = line_bot_logs.group_id and c.coach_id = auth.uid()));

-- ════════════════════════════════════════════════════════════════
-- Verify:
--   select count(*) from public.line_bot_groups;
--   select count(*) from public.plate_plan_config;
--   select count(*) from public.supplement_schedule;
--   select count(*) from public.line_bot_logs;
-- ════════════════════════════════════════════════════════════════
