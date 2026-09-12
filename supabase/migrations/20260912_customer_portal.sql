-- UP Health Design phase 4 — customer self-serve portal /my/<token> (SPEC-Health-Design §3.6).
-- No customer accounts yet (Q5 open): a rotatable per-customer token, like /connect and /r.
alter table public.customers
  add column if not exists portal_token text unique,
  add column if not exists portal_token_created_at timestamptz,
  add column if not exists portal_first_opened_at timestamptz;   -- G4: time-to-first-assessment
comment on column public.customers.portal_token is 'UP Health Design customer portal: /my/<token>. Rotatable by the coach; null = no link issued.';
