-- ════════════════════════════════════════════════════════════════
-- Customer View Audit Log — PDPA ม.39 compliance
-- Records every time a coach/admin opens a customer profile
-- ════════════════════════════════════════════════════════════════

create table if not exists public.customer_view_log (
  id          uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  viewer_id   uuid references auth.users(id) on delete set null,
  source      text not null default 'profile',  -- '360' | 'profile' | 'records' | 'bca' | 'pulse' | 'cgm'
  viewed_at   timestamptz not null default now()
);

create index if not exists idx_view_log_customer_time
  on public.customer_view_log(customer_id, viewed_at desc);
create index if not exists idx_view_log_viewer_time
  on public.customer_view_log(viewer_id, viewed_at desc);

-- RLS · admin sees all · coach sees own customers' logs
alter table public.customer_view_log enable row level security;

drop policy if exists view_log_admin on public.customer_view_log;
drop policy if exists view_log_own   on public.customer_view_log;

create policy view_log_admin on public.customer_view_log
  for all using (public.my_role() = 'admin');

create policy view_log_own on public.customer_view_log
  for all using (exists (
    select 1 from public.customers c
    where c.id = customer_view_log.customer_id and c.coach_id = auth.uid()
  ));

-- Optional retention helper (run monthly)
-- delete from public.customer_view_log where viewed_at < now() - interval '180 days';
