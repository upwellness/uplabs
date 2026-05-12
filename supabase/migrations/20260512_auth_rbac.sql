-- ════════════════════════════════════════════════════════════════
-- UPLABS v2 — Auth & RBAC migration (idempotent, defensive)
-- Safe to run multiple times. Coexists with any existing schema.
-- ════════════════════════════════════════════════════════════════

-- ── 1. profiles table ───────────────────────────────────────────
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade
);

-- Add columns one-by-one so an existing profiles table won't conflict.
alter table public.profiles add column if not exists email         text;
alter table public.profiles add column if not exists display_name  text;
alter table public.profiles add column if not exists role          text;
alter table public.profiles add column if not exists created_at    timestamptz default now();
alter table public.profiles add column if not exists updated_at    timestamptz default now();

-- Ensure role has default + not-null + check constraint.
alter table public.profiles alter column role set default 'other';
update public.profiles set role = 'other' where role is null;
alter table public.profiles alter column role set not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_role_check') then
    alter table public.profiles
      add constraint profiles_role_check check (role in ('member','abo','admin','other'));
  end if;
end $$;

create index if not exists idx_profiles_role on public.profiles(role);

-- If a legacy `name` column exists with NOT NULL, relax it so backfill succeeds.
-- (We populate it from display_name where present, then drop the constraint.)
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='profiles' and column_name='name'
  ) then
    update public.profiles
      set name = coalesce(name, display_name, split_part(coalesce(email,''), '@', 1), 'user')
      where name is null;
    alter table public.profiles alter column name drop not null;
  end if;
end $$;

-- updated_at trigger
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
  for each row execute procedure public.touch_updated_at();

-- ── 2. user_app_grants ─────────────────────────────────────────
create table if not exists public.user_app_grants (
  user_id     uuid not null references auth.users(id) on delete cascade,
  app_slug    text not null,
  granted_at  timestamptz not null default now(),
  granted_by  uuid references auth.users(id),
  primary key (user_id, app_slug)
);

-- ── 3. RLS ─────────────────────────────────────────────────────
alter table public.profiles         enable row level security;
alter table public.user_app_grants  enable row level security;

drop policy if exists profiles_select_own   on public.profiles;
drop policy if exists profiles_select_admin on public.profiles;
drop policy if exists profiles_update_own   on public.profiles;
drop policy if exists profiles_update_admin on public.profiles;

create policy profiles_select_own on public.profiles
  for select using (auth.uid() = id);

create policy profiles_select_admin on public.profiles
  for select using (exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  ));

create policy profiles_update_own on public.profiles
  for update using (auth.uid() = id);
-- (Role escalation prevented at app layer; admin policy below covers admin updates.)

create policy profiles_update_admin on public.profiles
  for update using (exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  ));

drop policy if exists grants_select_own  on public.user_app_grants;
drop policy if exists grants_admin_all   on public.user_app_grants;

create policy grants_select_own on public.user_app_grants
  for select using (auth.uid() = user_id);

create policy grants_admin_all on public.user_app_grants
  for all using (exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  ));

-- ── 4. Auto-create profile on signup ───────────────────────────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_display text := coalesce(new.raw_user_meta_data->>'display_name', split_part(coalesce(new.email,''), '@', 1));
  has_name_col boolean;
begin
  select exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='profiles' and column_name='name'
  ) into has_name_col;

  if has_name_col then
    execute format(
      'insert into public.profiles (id, email, display_name, name) values ($1, $2, $3, $3) on conflict (id) do nothing'
    ) using new.id, new.email, v_display;
  else
    insert into public.profiles (id, email, display_name)
    values (new.id, new.email, v_display)
    on conflict (id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ── 5. Backfill existing auth users ────────────────────────────
insert into public.profiles (id, email, display_name, role)
select
  u.id,
  u.email,
  coalesce(u.raw_user_meta_data->>'display_name', split_part(coalesce(u.email,''), '@', 1)),
  'other'
from auth.users u
on conflict (id) do update
  set email = excluded.email;
-- ↑ Only syncs email for existing rows; preserves role/display_name if already set.

-- ── 6. (Manual) Promote yourself to admin ──────────────────────
-- Uncomment + edit before running, or do separately:
-- update public.profiles set role = 'admin' where email = 'YOUR_ADMIN_EMAIL_HERE';

-- ════════════════════════════════════════════════════════════════
-- Verify with:
--   select email, role, display_name from public.profiles order by role;
-- ════════════════════════════════════════════════════════════════
