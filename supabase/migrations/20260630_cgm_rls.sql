-- ════════════════════════════════════════════════════════════════════════════
-- CGM RLS lockdown + passcode-gated access  (SECURITY FIX)
-- ════════════════════════════════════════════════════════════════════════════
-- PROBLEM (Supabase advisor: rls_disabled_in_public):
--   public.cgm_readings and public.cgm_meals had Row Level Security DISABLED.
--   They hold real patient CGM (glucose) data — PHI — and were therefore
--   readable / writable / DELETABLE by anyone holding the public anon key,
--   which is embedded in the static analyzer served at /cgm-v1.html.
--
-- CONSTRAINT:
--   The CGM Analyzer (/cgm-v1.html) is a STANDALONE static page used outside the
--   logged-in Ops app. It talks to Supabase directly with the anon key and has
--   NO Supabase Auth session — so auth.uid()-based policies (like the sibling
--   customer tables) cannot gate it, and these tables have no customer_id (they
--   key on profile_name, linked loosely via customers.cgm_profile_names[]).
--
-- FIX:
--   1. Enable RLS on both tables. We add NO anon table policies, so raw anon
--      table access is fully BLOCKED. service_role (server 360/master/assess
--      views via createAdminClient) bypasses RLS and is unaffected.
--   2. Add authenticated admin + owner/co-coach SELECT policies — mirrors the
--      sibling customer-table pattern, adapted to the profile_name link.
--   3. Introduce a per-profile PASSCODE (public.cgm_profiles). The standalone
--      analyzer reaches data ONLY through SECURITY DEFINER RPCs that verify
--      (profile, passcode) before any read/write. Anon may EXECUTE those RPCs
--      but cannot touch the tables directly. The published anon key is no longer
--      a data-exposure vector — it can only attempt a passcode.
--
-- Residual (documented, follow-up): profile-name enumeration via
-- cgm_list_profiles(), and passcode brute-force via the RPC oracle — mitigate
-- with strong passcodes and (future) rate-limiting.
-- ════════════════════════════════════════════════════════════════════════════

-- pgcrypto lives in the `extensions` schema on Supabase (verified). Ensure present.
create extension if not exists pgcrypto with schema extensions;

-- ── Passcode store ──────────────────────────────────────────────────────────
create table if not exists public.cgm_profiles (
  profile_name  text primary key,
  passcode_hash text,                       -- bcrypt (pgcrypto). NULL = not set → profile locked until a passcode is set.
  customer_id   uuid references public.customers(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Backfill one row per already-existing profile (passcode unset → must be set
-- before the analyzer can use it; this also blocks "claim a new profile" from
-- hijacking an existing data profile, since the name already exists here).
insert into public.cgm_profiles (profile_name)
select profile_name from public.cgm_readings
union
select profile_name from public.cgm_meals
on conflict (profile_name) do nothing;

alter table public.cgm_profiles enable row level security;
-- Only an authenticated Ops admin may read/manage the passcode store directly;
-- service_role bypasses RLS. Anon never touches this table (RPCs are definer-run).
drop policy if exists "cgm_profiles_admin_all" on public.cgm_profiles;
create policy "cgm_profiles_admin_all" on public.cgm_profiles
  for all using (public.my_role() = 'admin') with check (public.my_role() = 'admin');

-- ── Enable RLS on the data tables (NO anon policies → anon is blocked) ───────
alter table public.cgm_readings enable row level security;
alter table public.cgm_meals    enable row level security;

-- admin: full access from an authenticated Ops admin session
drop policy if exists "cgm_readings_admin_all" on public.cgm_readings;
create policy "cgm_readings_admin_all" on public.cgm_readings
  for all using (public.my_role() = 'admin') with check (public.my_role() = 'admin');

drop policy if exists "cgm_meals_admin_all" on public.cgm_meals;
create policy "cgm_meals_admin_all" on public.cgm_meals
  for all using (public.my_role() = 'admin') with check (public.my_role() = 'admin');

-- owner / co-coach: read CGM rows for profiles linked to a customer they own or
-- are assigned to (mirrors customer_assignments co-coach pattern, via the
-- profile_name → customers.cgm_profile_names[] link). SELECT only.
drop policy if exists "cgm_readings_coach_select" on public.cgm_readings;
create policy "cgm_readings_coach_select" on public.cgm_readings
  for select using (exists (
    select 1 from public.customers c
    where cgm_readings.profile_name = any(c.cgm_profile_names)
      and ( c.coach_id = auth.uid()
            or exists (select 1 from public.customer_assignments a
                       where a.customer_id = c.id and a.user_id = auth.uid()))));

drop policy if exists "cgm_meals_coach_select" on public.cgm_meals;
create policy "cgm_meals_coach_select" on public.cgm_meals
  for select using (exists (
    select 1 from public.customers c
    where cgm_meals.profile_name = any(c.cgm_profile_names)
      and ( c.coach_id = auth.uid()
            or exists (select 1 from public.customer_assignments a
                       where a.customer_id = c.id and a.user_id = auth.uid()))));

-- ════════════════════════════════════════════════════════════════════════════
-- Passcode-gated RPCs (SECURITY DEFINER → run as table owner, which bypasses RLS).
-- search_path is pinned (public, extensions, pg_temp-last) to prevent hijacking.
-- All values are passed as parameters — no dynamic SQL, no injection surface.
-- ════════════════════════════════════════════════════════════════════════════

-- internal: verify a profile's passcode. NOT granted to anon/authenticated;
-- only the definer-run RPCs below call it.
create or replace function public.cgm_check_passcode(p_profile text, p_passcode text)
returns boolean
language sql stable security definer
set search_path = public, extensions, pg_temp
as $$
  select exists (
    select 1 from public.cgm_profiles
    where profile_name = p_profile
      and passcode_hash is not null
      and passcode_hash = extensions.crypt(p_passcode, passcode_hash)
  );
$$;

-- login check (boolean) — used by the analyzer's "เข้าสู่ระบบ" button
create or replace function public.cgm_verify(p_profile text, p_passcode text)
returns boolean
language sql stable security definer
set search_path = public, extensions, pg_temp
as $$
  select public.cgm_check_passcode(p_profile, p_passcode);
$$;

-- list profile names (names only — no glucose data) to populate the dropdown.
-- Only profiles that already have a passcode set are shown (usable ones).
-- NB: named cgm_login_profiles to avoid colliding with the pre-existing
-- cgm_list_profiles() (a stats RPC used server-side via service_role).
create or replace function public.cgm_login_profiles()
returns jsonb
language sql stable security definer
set search_path = public, pg_temp
as $$
  select coalesce(jsonb_agg(profile_name order by profile_name), '[]'::jsonb)
  from public.cgm_profiles
  where passcode_hash is not null;
$$;

-- claim a BRAND-NEW profile + set its passcode. Fails if the name already exists
-- (existing-data profiles are pre-seeded above, so they cannot be hijacked here).
create or replace function public.cgm_create_profile(p_profile text, p_passcode text)
returns jsonb
language plpgsql security definer
set search_path = public, extensions, pg_temp
as $$
begin
  p_profile := nullif(btrim(p_profile), '');
  if p_profile is null then
    raise exception 'invalid_profile_name' using errcode = '22023';
  end if;
  if length(coalesce(p_passcode, '')) < 4 then
    raise exception 'passcode_too_short' using errcode = '22023';
  end if;
  if exists (select 1 from public.cgm_profiles where profile_name = p_profile) then
    raise exception 'profile_exists' using errcode = '23505';
  end if;
  insert into public.cgm_profiles (profile_name, passcode_hash)
  values (p_profile, extensions.crypt(p_passcode, extensions.gen_salt('bf')));
  return jsonb_build_object('ok', true, 'profile', p_profile);
end;
$$;

-- read all readings for a profile (returns a JSON array → not subject to the
-- PostgREST 1000-row cap, so no client pagination needed)
create or replace function public.cgm_get_readings(p_profile text, p_passcode text)
returns jsonb
language plpgsql stable security definer
set search_path = public, extensions, pg_temp
as $$
begin
  if not public.cgm_check_passcode(p_profile, p_passcode) then
    raise exception 'invalid_passcode' using errcode = '28000';
  end if;
  return coalesce(
    (select jsonb_agg(to_jsonb(r) order by r.reading_timestamp)
     from public.cgm_readings r where r.profile_name = p_profile),
    '[]'::jsonb);
end;
$$;

-- read all meals for a profile
create or replace function public.cgm_get_meals(p_profile text, p_passcode text)
returns jsonb
language plpgsql stable security definer
set search_path = public, extensions, pg_temp
as $$
begin
  if not public.cgm_check_passcode(p_profile, p_passcode) then
    raise exception 'invalid_passcode' using errcode = '28000';
  end if;
  return coalesce(
    (select jsonb_agg(to_jsonb(m) order by m.meal_timestamp)
     from public.cgm_meals m where m.profile_name = p_profile),
    '[]'::jsonb);
end;
$$;

-- bulk upsert readings (CSV import). profile_name is FORCED to p_profile so a
-- caller can never write into another profile via a crafted payload.
create or replace function public.cgm_upsert_readings(p_profile text, p_passcode text, p_rows jsonb)
returns integer
language plpgsql security definer
set search_path = public, extensions, pg_temp
as $$
declare
  n integer;
begin
  if not public.cgm_check_passcode(p_profile, p_passcode) then
    raise exception 'invalid_passcode' using errcode = '28000';
  end if;
  with incoming as (
    select
      p_profile                              as profile_name,
      (e ->> 'original_time')                as original_time,
      (e ->> 'reading_timestamp')::bigint    as reading_timestamp,
      (e ->> 'date_str')::date               as date_str,
      (e ->> 'glucose')::real                as glucose
    from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) e
    where (e ->> 'reading_timestamp') is not null
      and (e ->> 'glucose') is not null
  ),
  upserted as (
    insert into public.cgm_readings (profile_name, original_time, reading_timestamp, date_str, glucose)
    select profile_name, original_time, reading_timestamp, date_str, glucose from incoming
    on conflict (profile_name, reading_timestamp) do update
      set glucose       = excluded.glucose,
          original_time = excluded.original_time,
          date_str      = excluded.date_str
    returning 1
  )
  select count(*) into n from upserted;
  return coalesce(n, 0);
end;
$$;

-- insert (p_id null) or update (p_id given, must belong to p_profile) a meal
create or replace function public.cgm_save_meal(
  p_profile text, p_passcode text, p_id uuid,
  p_meal_timestamp bigint, p_date_str date, p_description text,
  p_carbs real, p_protein real, p_fat real)
returns jsonb
language plpgsql security definer
set search_path = public, extensions, pg_temp
as $$
declare
  rec public.cgm_meals;
begin
  if not public.cgm_check_passcode(p_profile, p_passcode) then
    raise exception 'invalid_passcode' using errcode = '28000';
  end if;
  if p_id is null then
    insert into public.cgm_meals (profile_name, meal_timestamp, date_str, description, carbs, protein, fat)
    values (p_profile, p_meal_timestamp, p_date_str, p_description, p_carbs, p_protein, p_fat)
    returning * into rec;
  else
    update public.cgm_meals
       set meal_timestamp = p_meal_timestamp,
           date_str       = p_date_str,
           description     = p_description,
           carbs           = p_carbs,
           protein         = p_protein,
           fat             = p_fat
     where id = p_id and profile_name = p_profile
    returning * into rec;
    if rec.id is null then
      raise exception 'meal_not_found_or_forbidden' using errcode = '42501';
    end if;
  end if;
  return to_jsonb(rec);
end;
$$;

-- delete a meal (must belong to p_profile)
create or replace function public.cgm_delete_meal(p_profile text, p_passcode text, p_id uuid)
returns boolean
language plpgsql security definer
set search_path = public, extensions, pg_temp
as $$
declare
  affected integer;
begin
  if not public.cgm_check_passcode(p_profile, p_passcode) then
    raise exception 'invalid_passcode' using errcode = '28000';
  end if;
  delete from public.cgm_meals where id = p_id and profile_name = p_profile;
  get diagnostics affected = row_count;
  return affected > 0;
end;
$$;

-- ADMIN: set/reset any profile's passcode. Requires an authenticated Ops admin
-- session (my_role()='admin'). Used to bootstrap existing profiles and for resets.
-- (Note: service_role's auth.uid() is NULL, so service_role calls this via a
--  direct UPDATE in the SQL editor / MCP, not through this function.)
create or replace function public.cgm_admin_set_passcode(p_profile text, p_passcode text)
returns jsonb
language plpgsql security definer
set search_path = public, extensions, pg_temp
as $$
begin
  if public.my_role() is distinct from 'admin' then
    raise exception 'admin_only' using errcode = '42501';
  end if;
  if length(coalesce(p_passcode, '')) < 4 then
    raise exception 'passcode_too_short' using errcode = '22023';
  end if;
  insert into public.cgm_profiles (profile_name, passcode_hash, updated_at)
  values (p_profile, extensions.crypt(p_passcode, extensions.gen_salt('bf')), now())
  on conflict (profile_name) do update
    set passcode_hash = excluded.passcode_hash, updated_at = now();
  return jsonb_build_object('ok', true, 'profile', p_profile);
end;
$$;

-- ── Grants: revoke the default PUBLIC execute, then grant only intended RPCs ──
revoke execute on function
  public.cgm_check_passcode(text, text),
  public.cgm_verify(text, text),
  public.cgm_login_profiles(),
  public.cgm_create_profile(text, text),
  public.cgm_get_readings(text, text),
  public.cgm_get_meals(text, text),
  public.cgm_upsert_readings(text, text, jsonb),
  public.cgm_save_meal(text, text, uuid, bigint, date, text, real, real, real),
  public.cgm_delete_meal(text, text, uuid),
  public.cgm_admin_set_passcode(text, text)
from public;

-- anon (standalone analyzer) + authenticated may call the passcode-gated RPCs
grant execute on function
  public.cgm_verify(text, text),
  public.cgm_login_profiles(),
  public.cgm_create_profile(text, text),
  public.cgm_get_readings(text, text),
  public.cgm_get_meals(text, text),
  public.cgm_upsert_readings(text, text, jsonb),
  public.cgm_save_meal(text, text, uuid, bigint, date, text, real, real, real),
  public.cgm_delete_meal(text, text, uuid)
to anon, authenticated;

-- passcode reset is admin-session only (function body also enforces my_role()='admin')
grant execute on function public.cgm_admin_set_passcode(text, text) to authenticated;

-- Supabase default privileges auto-grant EXECUTE to anon/authenticated on every
-- new function, so the "revoke ... from public" above does NOT remove anon's
-- access. Explicitly revoke anon from the internal helper and the admin-only
-- setter (cgm_check_passcode is invoked only by the definer-run RPCs, as owner;
-- cgm_admin_set_passcode also self-checks my_role()='admin').
revoke execute on function public.cgm_check_passcode(text, text)    from anon, authenticated;
revoke execute on function public.cgm_admin_set_passcode(text, text) from anon;

-- Tighten the PRE-EXISTING stats RPC: it was anon-callable (PUBLIC + anon) and
-- leaked profile names + reading counts + activity timestamps. It is only used
-- server-side (admin.rpc via service_role), so revoke anon/PUBLIC; keep
-- authenticated + service_role.
revoke execute on function public.cgm_list_profiles() from public, anon;
grant  execute on function public.cgm_list_profiles() to authenticated, service_role;

-- ── Verify (run manually) ────────────────────────────────────────────────────
--   set local role anon; select * from public.cgm_readings limit 1;        -- expect 0 rows / blocked
--   select public.cgm_verify('SomeProfile','wrong');                        -- expect false
--   select public.cgm_get_readings('SomeProfile','<correct>');              -- expect JSON array
