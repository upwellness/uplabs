-- UP Health Design phase 3 — care plans drafted from an assessment, confirmed by a coach
-- before a customer sees them (docs/SPEC-Health-Design.md §3.3). Service-role only.
create table if not exists public.health_plans (
  id             uuid primary key default gen_random_uuid(),
  customer_id    uuid not null references public.customers(id) on delete cascade,
  assessment_id  uuid references public.health_assessments(id) on delete set null,
  status         text not null default 'draft',   -- draft | confirmed | sent | archived
  origin         text not null default 'engine',  -- engine | coach
  goal           text not null,                   -- loss | longevity | muscle
  draft          jsonb not null,                  -- HealthPlan as the engine produced it
  final          jsonb,                           -- what the coach confirmed (draft + edits)
  edits          jsonb,                           -- {section: {from, to}} — what the coach changed
  coach_note     text,
  share_token    text unique,                     -- set on confirm; /r/plan/<token> once sent
  created_by     uuid references auth.users(id) on delete set null,
  created_at     timestamptz not null default now(),
  confirmed_by   uuid references auth.users(id) on delete set null,
  confirmed_at   timestamptz,
  sent_at        timestamptz,
  sent_via       text                             -- link | line
);
create index if not exists health_plans_customer_idx on public.health_plans(customer_id, created_at desc);
alter table public.health_plans enable row level security;
comment on table public.health_plans is 'UP Health Design plans. One non-archived plan per customer at a time; drafts are archived when a new draft is made.';
