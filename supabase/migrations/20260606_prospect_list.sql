-- Prospect List · lightweight speed-list for memory-dump 100 names
-- Each name can be convert ed to a checkform_record for deeper FORM analysis.
-- Per-coach RLS · mirrors checkform_records.

create table if not exists public.prospect_list (
  id               uuid primary key default gen_random_uuid(),
  coach_id         uuid not null references auth.users(id) on delete cascade,
  name             text not null,
  tier             text not null default 'B'
                     check (tier in ('A','B','C')),
  context          text,                       -- 1-line context (relationship, job, hook)
  source           text,                       -- friend/family/work/referral/customer/cold
  status           text not null default 'lead'
                     check (status in (
                       'lead','messaged','replied','scheduled',
                       'analyzed','closed','not_interested','dropped'
                     )),
  notes            text,                       -- richer internal notes
  converted_record_id uuid references public.checkform_records(id) on delete set null,
  contacted_at     timestamptz,
  replied_at       timestamptz,
  closed_at        timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists prospect_list_coach_idx   on public.prospect_list (coach_id);
create index if not exists prospect_list_status_idx  on public.prospect_list (status);
create index if not exists prospect_list_tier_idx    on public.prospect_list (tier);
create index if not exists prospect_list_created_idx on public.prospect_list (created_at desc);

-- ── RLS ──
alter table public.prospect_list enable row level security;

drop policy if exists "prospects: view own or admin"    on public.prospect_list;
drop policy if exists "prospects: insert own"           on public.prospect_list;
drop policy if exists "prospects: update own or admin"  on public.prospect_list;
drop policy if exists "prospects: delete own or admin"  on public.prospect_list;

create policy "prospects: view own or admin"
  on public.prospect_list for select
  using (coach_id = auth.uid() or public.my_role() = 'admin');

create policy "prospects: insert own"
  on public.prospect_list for insert
  with check (coach_id = auth.uid());

create policy "prospects: update own or admin"
  on public.prospect_list for update
  using (coach_id = auth.uid() or public.my_role() = 'admin');

create policy "prospects: delete own or admin"
  on public.prospect_list for delete
  using (coach_id = auth.uid() or public.my_role() = 'admin');

-- ── updated_at trigger ──
create or replace function public.set_prospect_list_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_prospect_list_updated_at on public.prospect_list;
create trigger trg_prospect_list_updated_at
  before update on public.prospect_list
  for each row execute function public.set_prospect_list_updated_at();

comment on table public.prospect_list is
  'Memory-dump prospect list · feeds into checkform_records · per-coach RLS · tier A/B/C + status pipeline';
