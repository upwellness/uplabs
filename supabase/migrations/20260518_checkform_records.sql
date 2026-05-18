-- Check FORM prospect records · per-coach RLS
-- Each ABO sees only their own · admin sees all (via public.my_role())

create table if not exists public.checkform_records (
  id               uuid primary key default gen_random_uuid(),
  coach_id         uuid not null references auth.users(id) on delete cascade,
  prospect_name    text not null,
  meeting_context  text,
  scores           jsonb not null default '{}'::jsonb,  -- { F: 1|2|3, O, R, M }
  notes            jsonb not null default '{}'::jsonb,  -- { F: string, O, R, M }
  verdict_level    text,   -- 'strong' | 'borderline' | 'warm' | 'not_ready'
  verdict_label    text,
  total_score      int not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists checkform_records_coach_idx
  on public.checkform_records (coach_id);

create index if not exists checkform_records_created_idx
  on public.checkform_records (created_at desc);

-- ── RLS ──
alter table public.checkform_records enable row level security;

drop policy if exists "checkform: view own or admin"    on public.checkform_records;
drop policy if exists "checkform: insert own"           on public.checkform_records;
drop policy if exists "checkform: update own or admin"  on public.checkform_records;
drop policy if exists "checkform: delete own or admin"  on public.checkform_records;

create policy "checkform: view own or admin"
  on public.checkform_records for select
  using (coach_id = auth.uid() or public.my_role() = 'admin');

create policy "checkform: insert own"
  on public.checkform_records for insert
  with check (coach_id = auth.uid());

create policy "checkform: update own or admin"
  on public.checkform_records for update
  using (coach_id = auth.uid() or public.my_role() = 'admin');

create policy "checkform: delete own or admin"
  on public.checkform_records for delete
  using (coach_id = auth.uid() or public.my_role() = 'admin');

-- ── updated_at trigger ──
create or replace function public.set_checkform_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_checkform_updated_at on public.checkform_records;
create trigger trg_checkform_updated_at
  before update on public.checkform_records
  for each row execute function public.set_checkform_updated_at();

comment on table public.checkform_records is
  'Check FORM lead-qualification records · per-coach via RLS · scores+notes+verdict stored as JSON';
