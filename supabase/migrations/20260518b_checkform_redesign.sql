-- Check FORM v2: add structured profile + DISC + cached AI analysis
-- Keeps existing scores/notes/verdict_* columns for back-compat

alter table public.checkform_records
  add column if not exists profile         jsonb not null default '{}'::jsonb,
  add column if not exists disc_primary    text,
  add column if not exists disc_secondary  text,
  add column if not exists ai_analysis     jsonb,
  add column if not exists ai_analyzed_at  timestamptz;

create index if not exists checkform_records_disc_idx
  on public.checkform_records (disc_primary);

comment on column public.checkform_records.profile is
  'Structured profile (demographics · career · lifestyle · family) — see ProfileForm UI';
comment on column public.checkform_records.disc_primary is
  'DISC primary style: D · I · S · C';
comment on column public.checkform_records.ai_analysis is
  'Cached Gemini analysis · {summary, approach, firstMove, dialogSamples, roleplay, ...}';
