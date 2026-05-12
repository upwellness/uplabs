-- ════════════════════════════════════════════════════════════════
-- UPLABS v2 — Auth & RBAC migration
-- Run once on the Supabase project (SQL editor or psql).
-- ════════════════════════════════════════════════════════════════

-- ── 1. profiles ─────────────────────────────────────────────────
create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  email         text,
  display_name  text,
  role          text not null default 'other' check (role in ('member','abo','admin','other')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_profiles_role on public.profiles(role);

-- updated_at trigger
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
  for each row execute procedure public.touch_updated_at();

-- ── 2. user_app_grants (per-user overrides) ─────────────────────
create table if not exists public.user_app_grants (
  user_id     uuid not null references auth.users(id) on delete cascade,
  app_slug    text not null,
  granted_at  timestamptz not null default now(),
  granted_by  uuid references auth.users(id),
  primary key (user_id, app_slug)
);

-- ── 3. RLS ──────────────────────────────────────────────────────
alter table public.profiles enable row level security;
alter table public.user_app_grants enable row level security;

-- Profiles
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select using (auth.uid() = id);

drop policy if exists profiles_select_admin on public.profiles;
create policy profiles_select_admin on public.profiles
  for select using (exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  ));

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update using (auth.uid() = id)
  with check (auth.uid() = id and role = (select role from public.profiles where id = auth.uid()));
-- ↑ regular users can update own profile but NOT change their own role

drop policy if exists profiles_update_admin on public.profiles;
create policy profiles_update_admin on public.profiles
  for update using (exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  ));

-- App grants
drop policy if exists grants_select_own on public.user_app_grants;
create policy grants_select_own on public.user_app_grants
  for select using (auth.uid() = user_id);

drop policy if exists grants_admin_all on public.user_app_grants;
create policy grants_admin_all on public.user_app_grants
  for all using (exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  ));

-- ── 4. Auto-create profile on signup ────────────────────────────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(coalesce(new.email,''), '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ── 5. Backfill existing auth users ─────────────────────────────
insert into public.profiles (id, email, display_name, role)
select
  u.id,
  u.email,
  coalesce(u.raw_user_meta_data->>'display_name', split_part(coalesce(u.email,''), '@', 1)),
  'other'
from auth.users u
on conflict (id) do update set email = excluded.email;

-- ── 6. Optional: promote the first user to admin ────────────────
-- Replace with your own admin email before running, or do it manually:
-- update public.profiles set role = 'admin' where email = 'YOUR_ADMIN_EMAIL_HERE';

-- ════════════════════════════════════════════════════════════════
-- DONE. Verify with: select email, role from public.profiles;
-- ════════════════════════════════════════════════════════════════
