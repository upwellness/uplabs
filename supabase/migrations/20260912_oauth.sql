-- OAuth 2.1 authorization server for the MCP endpoint (docs/SPEC-External-API.md §8.9).
-- Access tokens ARE api_tokens rows; these tables only hold clients, one-shot codes and
-- refresh tokens. Service-role only: RLS on, no policies.

create table if not exists public.oauth_clients (
  client_id                  text primary key,
  client_secret_hash         text,                              -- null = public client (PKCE only)
  client_name                text not null,
  redirect_uris              text[] not null,
  token_endpoint_auth_method text not null default 'none',
  grant_types                text[] not null default '{authorization_code,refresh_token}',
  client_uri                 text,
  logo_uri                   text,
  created_ip                 text,
  created_at                 timestamptz not null default now(),
  last_used_at               timestamptz
);

create table if not exists public.oauth_codes (
  code_hash      text primary key,
  client_id      text not null references public.oauth_clients(client_id) on delete cascade,
  user_id        uuid not null references public.profiles(id) on delete cascade,
  redirect_uri   text not null,
  code_challenge text not null,
  scopes         text[] not null,
  resource       text,
  expires_at     timestamptz not null,
  used_at        timestamptz,
  created_at     timestamptz not null default now()
);

create table if not exists public.oauth_refresh_tokens (
  token_hash    text primary key,
  client_id     text not null references public.oauth_clients(client_id) on delete cascade,
  user_id       uuid not null references public.profiles(id) on delete cascade,
  api_token_id  uuid not null references public.api_tokens(id) on delete cascade,
  scopes        text[] not null,
  expires_at    timestamptz not null,
  revoked_at    timestamptz,
  created_at    timestamptz not null default now()
);
create index if not exists oauth_refresh_user_idx on public.oauth_refresh_tokens(user_id, client_id);

alter table public.api_tokens add column if not exists oauth_client_id text references public.oauth_clients(client_id) on delete set null;
create index if not exists api_tokens_oauth_client_idx on public.api_tokens(oauth_client_id) where oauth_client_id is not null;

alter table public.oauth_clients        enable row level security;
alter table public.oauth_codes          enable row level security;
alter table public.oauth_refresh_tokens enable row level security;

comment on table public.oauth_clients is 'MCP clients registered via RFC 7591 (claude.ai, ChatGPT, …). Anyone may register; a user must still log in and consent.';
comment on table public.oauth_codes is 'Authorization codes, hashed, single use, 10-minute TTL.';
comment on table public.oauth_refresh_tokens is 'Rotated on every use. api_token_id is the access token this refresh token can renew.';
