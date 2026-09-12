-- UP Health Design phase 1 — one row per computed assessment, never overwritten
-- (docs/SPEC-Health-Design.md §3.1). Service-role only: RLS on, no policies.
create table if not exists public.health_assessments (
  id             uuid primary key default gen_random_uuid(),
  customer_id    uuid not null references public.customers(id) on delete cascade,
  computed_at    timestamptz not null default now(),
  trigger        text not null,                 -- manual | lab_import | lab_review | bca | cgm_import | wearable_sync | food_log | api
  engine_version text not null,
  confidence     text not null,                 -- high | medium | low
  sources_used   text[] not null default '{}',
  payload        jsonb not null                 -- HealthAssessment (lib/health-design/assess.ts)
);
create index if not exists health_assessments_customer_idx on public.health_assessments(customer_id, computed_at desc);
alter table public.health_assessments enable row level security;
comment on table public.health_assessments is 'UP Health Design — per-domain assessment across labs/BCA/CGM/wearable/food. Domains are never collapsed into one number (decision 12 Sep 2026).';
