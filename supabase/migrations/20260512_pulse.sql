-- ════════════════════════════════════════════════════════════════
-- UP Pulse v0 — Google Fit OAuth + biomarker ingestion
-- ════════════════════════════════════════════════════════════════

-- ── 1. pulse_invites ────────────────────────────────────────────
create table if not exists public.pulse_invites (
  token         text primary key,
  customer_id   uuid not null references public.customers(id) on delete cascade,
  coach_id      uuid references auth.users(id),
  provider      text not null default 'google_fit',
  created_at    timestamptz not null default now(),
  expires_at    timestamptz not null default (now() + interval '7 days'),
  used_at       timestamptz
);
create index if not exists idx_pulse_invites_customer on public.pulse_invites(customer_id);

-- ── 2. pulse_connections ────────────────────────────────────────
create table if not exists public.pulse_connections (
  id                  uuid primary key default gen_random_uuid(),
  customer_id         uuid not null references public.customers(id) on delete cascade,
  provider            text not null check (provider in ('google_fit','fitbit','apple_manual')),
  provider_user_id    text,
  access_token_enc    text not null,
  refresh_token_enc   text,
  scopes              text[],
  expires_at          timestamptz,
  status              text not null default 'active',
  connected_at        timestamptz not null default now(),
  last_sync_at        timestamptz,
  unique (customer_id, provider)
);

-- ── 3. pulse_readings ───────────────────────────────────────────
create table if not exists public.pulse_readings (
  id             bigserial primary key,
  customer_id    uuid not null references public.customers(id) on delete cascade,
  connection_id  uuid references public.pulse_connections(id) on delete cascade,
  recorded_at    timestamptz not null,
  metric_type    text not null,           -- hrv_rmssd · rhr · sleep_minutes · steps · spo2
  value          numeric,
  unit           text,
  source_data    jsonb
);
create index if not exists idx_pulse_readings_lookup
  on public.pulse_readings(customer_id, metric_type, recorded_at desc);

-- ── 4. RLS ──────────────────────────────────────────────────────
alter table public.pulse_invites      enable row level security;
alter table public.pulse_connections  enable row level security;
alter table public.pulse_readings     enable row level security;

-- Admin sees all
drop policy if exists pulse_invites_admin     on public.pulse_invites;
drop policy if exists pulse_connections_admin on public.pulse_connections;
drop policy if exists pulse_readings_admin    on public.pulse_readings;

create policy pulse_invites_admin     on public.pulse_invites     for all using (public.my_role() = 'admin');
create policy pulse_connections_admin on public.pulse_connections for all using (public.my_role() = 'admin');
create policy pulse_readings_admin    on public.pulse_readings    for all using (public.my_role() = 'admin');

-- Coach sees own customers' rows
drop policy if exists pulse_invites_own     on public.pulse_invites;
drop policy if exists pulse_connections_own on public.pulse_connections;
drop policy if exists pulse_readings_own    on public.pulse_readings;

create policy pulse_invites_own on public.pulse_invites
  for all using (
    exists (select 1 from public.customers c where c.id = pulse_invites.customer_id and c.coach_id = auth.uid())
  );

create policy pulse_connections_own on public.pulse_connections
  for all using (
    exists (select 1 from public.customers c where c.id = pulse_connections.customer_id and c.coach_id = auth.uid())
  );

create policy pulse_readings_own on public.pulse_readings
  for all using (
    exists (select 1 from public.customers c where c.id = pulse_readings.customer_id and c.coach_id = auth.uid())
  );

-- ════════════════════════════════════════════════════════════════
-- Verify
--   select count(*) from public.pulse_invites;
--   select count(*) from public.pulse_connections;
--   select count(*) from public.pulse_readings;
-- ════════════════════════════════════════════════════════════════
