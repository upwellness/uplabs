-- Customer-portal usage log (SPEC-Mobile-Portal.md R7): one row per open / metric sheet /
-- AI explanation, so G2/G3 can be measured and the coach can see what the customer
-- asked about. No PII beyond customer_id; `meta` holds metric keys and counts only.
create table if not exists public.portal_events (
  id          uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  kind        text not null check (kind in ('open','metric','explain','food_log','cgm_upload')),
  meta        jsonb,
  at          timestamptz not null default now()
);
create index if not exists portal_events_customer_at on public.portal_events (customer_id, at desc);
create index if not exists portal_events_kind_at on public.portal_events (kind, at desc);
alter table public.portal_events enable row level security;
-- service-role only (portal routes use the admin client); coaches read via server code.
