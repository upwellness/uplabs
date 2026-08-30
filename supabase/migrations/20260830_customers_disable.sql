-- Disable a customer profile instead of deleting it.
--
-- The problem this solves: old / duplicate / test profiles clutter the customer list
-- and make it easy to open the wrong person. Deleting is not the answer — the lab
-- history is the record, and once it is gone it is gone.
--
-- So: hidden from lists and search, still reachable by id (with a clear banner),
-- fully reversible. A timestamp rather than a boolean so "when" comes for free.

alter table public.customers
  add column if not exists disabled_at     timestamptz,
  add column if not exists disabled_by     uuid references auth.users(id) on delete set null,
  add column if not exists disabled_reason text;

create index if not exists customers_active_idx
  on public.customers(coach_id) where disabled_at is null;

comment on column public.customers.disabled_at is
  'Set = profile is retired: hidden from lists and search, still openable by id, all child data intact. Null = active. Reversible.';
comment on column public.customers.disabled_reason is
  'Optional short note from whoever disabled it — e.g. "โปรไฟล์ซ้ำ", "เลิกใช้บริการ".';

-- ── RLS gap found while shipping the disable button ──────────────────────────
-- An upline could SELECT a downline's customer but not UPDATE it. The 2026-07-24
-- RBAC change updated the route-level check (canManageCustomer) but never added the
-- matching UPDATE policy — so the app said yes and Postgres said no: the UPDATE
-- matched zero rows and `.select().single()` failed, surfacing as an unexplained 500.
-- The disable button hit it first because it is the first row-level write an upline
-- had reason to make on a downline's customer.

drop policy if exists "customers_downline_update" on public.customers;
create policy "customers_downline_update" on public.customers
  for update
  using      (coach_id in (select profile_descendant_ids(auth.uid())))
  with check (coach_id in (select profile_descendant_ids(auth.uid())));

drop policy if exists "customers_update_own" on public.customers;
create policy "customers_update_own" on public.customers
  for update
  using      (auth.uid() = coach_id)
  with check (auth.uid() = coach_id);
