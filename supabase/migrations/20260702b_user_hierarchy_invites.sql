-- MLM-style user hierarchy + invitation-based signup.
--
-- 1. profiles.parent_id — each user has one "upline" (parent). Root users have NULL.
-- 2. profile_descendant_ids(root) — all users transitively below `root` (the downline).
-- 3. user_invites — an existing user generates a token; the invitee self-registers
--    (sets their own password + real email) and is attached under the inviter.
-- 4. RLS backstop: an upline may SELECT (read-only) their downline's customers and
--    all child health data. Writes stay owner/admin/co-coach only (unchanged).

-- ── 1. Hierarchy column ────────────────────────────────────────────────────
alter table public.profiles
  add column if not exists parent_id uuid references public.profiles(id) on delete set null;
create index if not exists profiles_parent_idx on public.profiles(parent_id);

-- ── 2. Downline resolver (transitive, excludes the root itself) ─────────────
create or replace function public.profile_descendant_ids(root uuid)
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  with recursive tree as (
    select id from public.profiles where parent_id = root
    union
    select p.id from public.profiles p join tree t on p.parent_id = t.id
  )
  select id from tree;
$$;

-- ── 3. User invites ─────────────────────────────────────────────────────────
create table if not exists public.user_invites (
  token       uuid primary key default gen_random_uuid(),
  created_by  uuid not null references auth.users(id) on delete cascade,
  role        text not null default 'abo' check (role in ('member','abo','admin','other')),
  note        text,
  used_by     uuid references auth.users(id) on delete set null,
  used_at     timestamptz,
  expires_at  timestamptz not null default (now() + interval '14 days'),
  created_at  timestamptz not null default now()
);
create index if not exists user_invites_creator_idx on public.user_invites(created_by);

alter table public.user_invites enable row level security;

-- creator reads their own invites; admin reads all. Writes go through the
-- service-role client (createInvite / /api/join), so no insert/update policy needed.
drop policy if exists "invites_read_own" on public.user_invites;
create policy "invites_read_own" on public.user_invites
  for select using (created_by = auth.uid() or my_role() = 'admin');

-- ── 4. Downline read-only RLS backstop ──────────────────────────────────────
-- customers row: an upline may SELECT their downline's customers (not update/delete)
drop policy if exists "customers_downline_select" on public.customers;
create policy "customers_downline_select" on public.customers
  for select using (coach_id in (select public.profile_descendant_ids(auth.uid())));

-- child tables: SELECT-only downline access (mirrors the co-coach table list)
do $$
declare
  t text;
  tbls text[] := array[
    'customer_records','customer_lab_values','customer_allergy_tests','customer_food_allergens',
    'customer_supplement_safety','coach_notes','measurements','whoop_daily','whoop_sleeps',
    'whoop_workouts','whoop_journal','pulse_readings','pulse_connections','pulse_invites',
    'pulse_assessments','pulse_intakes','biomarker_readings','nutriscan_scans','plate_plan_config',
    'supplement_schedule','wearable_connections','wearable_invites','customer_view_log'];
begin
  foreach t in array tbls loop
    execute format('drop policy if exists "downline_select" on public.%I', t);
    execute format(
      'create policy "downline_select" on public.%I for select using (exists (select 1 from public.customers c where c.id = %I.customer_id and c.coach_id in (select public.profile_descendant_ids(auth.uid()))))',
      t, t);
  end loop;
end $$;
