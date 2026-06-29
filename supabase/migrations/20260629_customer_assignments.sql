-- Customer assignments: share a customer with additional user accounts (co-coach).
-- An assigned user gets the SAME access as the owning coach (see + edit all data),
-- EXCEPT deleting the customer or re-assigning (those stay owner/admin only).
-- Additive RLS — existing owner/admin policies are untouched (Postgres ORs permissive policies).

create table if not exists public.customer_assignments (
  customer_id uuid not null references public.customers(id) on delete cascade,
  user_id     uuid not null references auth.users(id)      on delete cascade,
  assigned_by uuid references auth.users(id)               on delete set null,
  created_at  timestamptz not null default now(),
  primary key (customer_id, user_id)
);
create index if not exists customer_assignments_user_idx on public.customer_assignments(user_id);

alter table public.customer_assignments enable row level security;

-- admins manage every assignment; a user may read their own assignment rows
drop policy if exists "assignments_admin_all" on public.customer_assignments;
create policy "assignments_admin_all" on public.customer_assignments
  for all using (my_role() = 'admin') with check (my_role() = 'admin');

drop policy if exists "assignments_read_own" on public.customer_assignments;
create policy "assignments_read_own" on public.customer_assignments
  for select using (user_id = auth.uid());

-- customers row: assigned users can view + update (NOT insert/delete the customer)
drop policy if exists "customers_assigned_select" on public.customers;
create policy "customers_assigned_select" on public.customers
  for select using (exists (
    select 1 from public.customer_assignments a
    where a.customer_id = customers.id and a.user_id = auth.uid()));

drop policy if exists "customers_assigned_update" on public.customers;
create policy "customers_assigned_update" on public.customers
  for update using (exists (
    select 1 from public.customer_assignments a
    where a.customer_id = customers.id and a.user_id = auth.uid()))
  with check (exists (
    select 1 from public.customer_assignments a
    where a.customer_id = customers.id and a.user_id = auth.uid()));

-- child tables: assigned users get full co-coach access (select/insert/update/delete)
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
    execute format('drop policy if exists "assigned_co_coach" on public.%I', t);
    execute format(
      'create policy "assigned_co_coach" on public.%I for all using (exists (select 1 from public.customer_assignments a where a.customer_id = %I.customer_id and a.user_id = auth.uid())) with check (exists (select 1 from public.customer_assignments a where a.customer_id = %I.customer_id and a.user_id = auth.uid()))',
      t, t, t);
  end loop;
end $$;
