-- Add quiz_type to differentiate Health Check vs MetaFlex Quiz leads
alter table public.healthcheck_leads
  add column if not exists quiz_type text not null default 'healthcheck';

create index if not exists idx_healthcheck_type on public.healthcheck_leads(quiz_type);
