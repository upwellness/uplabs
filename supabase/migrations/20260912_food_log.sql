-- UP Health Design phase 2 — food log (docs/SPEC-Health-Design.md §3.2).
-- Decision: extend nutriscan_scans into THE food log rather than migrate to a new
-- table — every existing scan already is a food entry, and the app, the loader and
-- the External API can all read one table.
alter table public.nutriscan_scans
  add column if not exists eaten_at      timestamptz,           -- when the meal was eaten (Bangkok wall-clock stored as instant)
  add column if not exists time_known    boolean not null default true,
  add column if not exists source        text not null default 'photo',   -- photo | text | photo_backfill | api
  add column if not exists estimated_by  text not null default 'gemini',  -- gemini | client_ai | manual
  add column if not exists confirmed_at  timestamptz,           -- when a person accepted the numbers
  add column if not exists confirmed_by  uuid references auth.users(id) on delete set null,
  add column if not exists edited        jsonb,                 -- {field: {from, to}} — what the person changed vs the estimate
  add column if not exists items         text[];

-- Backfill: a date-only entry is "time unknown" at local noon; otherwise the scan time.
update public.nutriscan_scans
   set eaten_at   = coalesce((eaten_on::timestamp + interval '12 hours') at time zone 'Asia/Bangkok', created_at),
       time_known = (eaten_on is null)
 where eaten_at is null;

create index if not exists nutriscan_scans_customer_eaten_idx on public.nutriscan_scans (customer_id, eaten_at desc);
comment on column public.nutriscan_scans.eaten_at is 'Food log time. Never guessed: EXIF suggestion accepted by the person, or typed. time_known=false when only the date was given.';
