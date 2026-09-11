-- CGM import via External API — idempotent re-imports.
--
-- cgm_readings had no uniqueness on (profile_name, reading_timestamp). Verified 0
-- duplicates across 52,029 rows before adding this, so it is safe to enforce now.
-- With it in place the import route can upsert with ON CONFLICT DO NOTHING and a
-- re-uploaded Ottai file (which always includes the last few days again) adds only
-- the genuinely new readings instead of doubling the old ones.
create unique index if not exists cgm_readings_profile_ts_uniq
  on public.cgm_readings (profile_name, reading_timestamp);

-- Range reads by day are the common path for metrics.
create index if not exists cgm_readings_profile_date_idx
  on public.cgm_readings (profile_name, date_str);
