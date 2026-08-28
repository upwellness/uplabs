-- External API v1 — tokens that let outside AI systems (ChatGPT, n8n, scripts)
-- read and update UP Labs data over HTTP. See docs/SPEC-External-API.md.
--
-- Two tables:
--   api_tokens      — the credential + exactly what it is allowed to touch
--   api_token_logs  — every call, allowed or refused, so any leak is traceable
--
-- Security posture: the full token is NEVER stored. We keep an 8-char prefix to
-- look the row up by, and a SHA-256 hash of the secret to compare against. If this
-- table leaks, the tokens in it cannot be used.
--
-- RLS: admin-only for both tables. The API routes themselves run through the
-- service-role client (they authenticate the caller by token, not by session), so
-- these policies exist to stop a logged-in non-admin from reading tokens via the
-- browser client — not as the API's own access control.

create table if not exists public.api_tokens (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null,
  token_prefix       text not null unique,
  token_hash         text not null,
  scopes             text[] not null default '{}',
  -- 'all' | 'coach:<user_uuid>' | 'list:<uuid,uuid,...>'
  customer_scope     text not null default 'all',
  rate_limit_per_min int  not null default 60,
  expires_at         timestamptz,
  revoked_at         timestamptz,
  last_used_at       timestamptz,
  note               text,
  created_by         uuid references auth.users(id) on delete set null,
  created_at         timestamptz not null default now()
);

create index if not exists api_tokens_prefix_idx on public.api_tokens(token_prefix);
create index if not exists api_tokens_active_idx on public.api_tokens(revoked_at, expires_at);

comment on column public.api_tokens.token_hash is
  'SHA-256 of the secret half. The full token is shown once at creation and never stored.';
comment on column public.api_tokens.customer_scope is
  'all = every customer (admin tokens only) · coach:<uuid> = that coach + their whole downline · list:<uuid,...> = only those customers';

create table if not exists public.api_token_logs (
  id            bigserial primary key,
  token_id      uuid references public.api_tokens(id) on delete set null,
  token_prefix  text,
  ts            timestamptz not null default now(),
  method        text,
  path          text,
  intent        text,
  customer_id   uuid,
  status        int,
  error         text,
  duration_ms   int,
  row_count     int,
  ip            text,
  user_agent    text,
  -- the raw natural-language command, truncated by the app so this table does not
  -- quietly become a second store of health PII
  q             text
);

create index if not exists api_token_logs_token_ts_idx on public.api_token_logs(token_id, ts desc);
create index if not exists api_token_logs_ts_idx       on public.api_token_logs(ts desc);

alter table public.api_tokens     enable row level security;
alter table public.api_token_logs enable row level security;

drop policy if exists "api_tokens_admin_all" on public.api_tokens;
create policy "api_tokens_admin_all" on public.api_tokens
  for all using (my_role() = 'admin') with check (my_role() = 'admin');

drop policy if exists "api_token_logs_admin_all" on public.api_token_logs;
create policy "api_token_logs_admin_all" on public.api_token_logs
  for all using (my_role() = 'admin') with check (my_role() = 'admin');

-- Rate limiting counts rows in the last minute; this index keeps that cheap.
create index if not exists api_token_logs_rate_idx on public.api_token_logs(token_id, ts)
  where token_id is not null;

-- Retention: logs older than 90 days are dropped. Called opportunistically by the
-- API (roughly 1 in 200 requests) so there is no cron dependency.
create or replace function public.prune_api_token_logs()
returns void language sql security definer set search_path = public as $$
  delete from public.api_token_logs where ts < now() - interval '90 days';
$$;
