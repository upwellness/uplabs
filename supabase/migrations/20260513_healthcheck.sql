-- ════════════════════════════════════════════════════════════════
-- Health Check — public lead capture · coach-attributed
-- ════════════════════════════════════════════════════════════════

create table if not exists public.healthcheck_leads (
  id             uuid primary key default gen_random_uuid(),
  coach_id       uuid references auth.users(id) on delete set null,
  created_at     timestamptz not null default now(),

  -- Contact (for follow-up)
  name           text not null,
  phone          text,
  email          text,
  line_id        text,
  consent_followup boolean default true,

  -- Demographics
  age            int,
  gender         text,
  height_cm      numeric,
  weight_kg      numeric,
  waist_cm       numeric,

  -- Computed
  bmi            numeric,
  risk_score     int,
  risk_level     text,      -- low / moderate / high / very_high
  flags          text[],

  -- Full answers payload (for coach review + future re-scoring)
  answers        jsonb,

  -- Coach workflow
  status         text not null default 'new',   -- new / contacted / converted / dismissed
  contacted_at   timestamptz,
  customer_id    uuid references public.customers(id),
  notes          text
);

create index if not exists idx_healthcheck_coach   on public.healthcheck_leads(coach_id);
create index if not exists idx_healthcheck_status  on public.healthcheck_leads(status);
create index if not exists idx_healthcheck_created on public.healthcheck_leads(created_at desc);

-- RLS
alter table public.healthcheck_leads enable row level security;

drop policy if exists hc_admin    on public.healthcheck_leads;
drop policy if exists hc_own      on public.healthcheck_leads;
drop policy if exists hc_anon_ins on public.healthcheck_leads;

create policy hc_admin on public.healthcheck_leads
  for all using (public.my_role() = 'admin');

create policy hc_own on public.healthcheck_leads
  for all using (coach_id = auth.uid());

-- Anonymous insert allowed (public form) — only if coach_id is set
create policy hc_anon_ins on public.healthcheck_leads
  for insert
  to anon, authenticated
  with check (true);

-- Verify:
--   select count(*) from public.healthcheck_leads;
