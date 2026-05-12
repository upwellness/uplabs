-- ════════════════════════════════════════════════════════════════
-- UP Pulse v0 — Intake form + Assessment pipeline
-- ════════════════════════════════════════════════════════════════

-- ── pulse_intakes ───────────────────────────────────────────────
create table if not exists public.pulse_intakes (
  id             uuid primary key default gen_random_uuid(),
  customer_id    uuid not null references public.customers(id) on delete cascade,
  coach_id       uuid references auth.users(id),
  token          text unique not null,
  medications    text[],
  conditions     text[],
  pregnant       boolean,
  breastfeeding  boolean,
  goal           text,
  budget_range   text,
  notes          text,
  submitted_at   timestamptz,
  expires_at     timestamptz not null default (now() + interval '14 days'),
  created_at     timestamptz not null default now()
);
create index if not exists idx_pulse_intakes_customer on public.pulse_intakes(customer_id);

-- ── pulse_assessments ───────────────────────────────────────────
create table if not exists public.pulse_assessments (
  id            uuid primary key default gen_random_uuid(),
  customer_id   uuid not null references public.customers(id) on delete cascade,
  intake_id     uuid references public.pulse_intakes(id),
  coach_id      uuid references auth.users(id),
  status        text not null default 'draft',  -- draft / ready / sent / archived
  blocked       boolean not null default false,
  block_reasons text[],
  raw_input     jsonb,
  rule_output   jsonb,
  ai_output     jsonb,
  final_text    text,
  reviewed_by   uuid references auth.users(id),
  reviewed_at   timestamptz,
  sent_at       timestamptz,
  share_token   text unique,
  created_at    timestamptz not null default now()
);
create index if not exists idx_pulse_assessments_customer on public.pulse_assessments(customer_id);
create index if not exists idx_pulse_assessments_token    on public.pulse_assessments(share_token);

-- ── RLS ────────────────────────────────────────────────────────
alter table public.pulse_intakes      enable row level security;
alter table public.pulse_assessments  enable row level security;

drop policy if exists pulse_intakes_admin       on public.pulse_intakes;
drop policy if exists pulse_intakes_own         on public.pulse_intakes;
drop policy if exists pulse_assessments_admin   on public.pulse_assessments;
drop policy if exists pulse_assessments_own     on public.pulse_assessments;

create policy pulse_intakes_admin on public.pulse_intakes
  for all using (public.my_role() = 'admin');
create policy pulse_intakes_own on public.pulse_intakes
  for all using (exists (
    select 1 from public.customers c where c.id = pulse_intakes.customer_id and c.coach_id = auth.uid()
  ));

create policy pulse_assessments_admin on public.pulse_assessments
  for all using (public.my_role() = 'admin');
create policy pulse_assessments_own on public.pulse_assessments
  for all using (exists (
    select 1 from public.customers c where c.id = pulse_assessments.customer_id and c.coach_id = auth.uid()
  ));

-- ════════════════════════════════════════════════════════════════
-- Verify:
--   select count(*) from public.pulse_intakes;
--   select count(*) from public.pulse_assessments;
-- ════════════════════════════════════════════════════════════════
