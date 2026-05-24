-- ════════════════════════════════════════════════════════════════
-- Coach Notes — timestamped log per customer
-- Phase 2 of Customer 360
-- ════════════════════════════════════════════════════════════════

create table if not exists public.coach_notes (
  id          uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  body        text not null,
  pinned      boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid references auth.users(id)
);

create index if not exists idx_coach_notes_customer_pinned_created
  on public.coach_notes(customer_id, pinned desc, created_at desc);

-- updated_at trigger
create or replace function public.coach_notes_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_coach_notes_updated_at on public.coach_notes;
create trigger trg_coach_notes_updated_at
  before update on public.coach_notes
  for each row execute function public.coach_notes_set_updated_at();

-- RLS
alter table public.coach_notes enable row level security;

drop policy if exists coach_notes_admin on public.coach_notes;
drop policy if exists coach_notes_own   on public.coach_notes;

create policy coach_notes_admin on public.coach_notes
  for all using (public.my_role() = 'admin');

create policy coach_notes_own on public.coach_notes
  for all using (exists (
    select 1 from public.customers c
    where c.id = coach_notes.customer_id and c.coach_id = auth.uid()
  ));
