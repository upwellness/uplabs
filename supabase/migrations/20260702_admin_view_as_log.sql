-- Audit log for admin "view as user" (read-only impersonation for testing views).
-- Written only by the service-role client from lib/auth/view-as.ts start/stop actions.

create table if not exists public.admin_view_as_log (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references auth.users(id) on delete set null,
  target_user_id uuid references auth.users(id) on delete set null,
  action text not null check (action in ('start', 'stop')),
  created_at timestamptz not null default now()
);

create index if not exists admin_view_as_log_admin_idx  on public.admin_view_as_log (admin_id);
create index if not exists admin_view_as_log_target_idx on public.admin_view_as_log (target_user_id);

alter table public.admin_view_as_log enable row level security;

drop policy if exists "view_as_log_admin_read" on public.admin_view_as_log;
create policy "view_as_log_admin_read" on public.admin_view_as_log
  for select using (my_role() = 'admin');
