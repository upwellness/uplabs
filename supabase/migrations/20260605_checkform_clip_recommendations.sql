-- Check FORM · cache STP clip recommendations on each record
-- so reopening a prospect doesn't re-spend Gemini quota.
-- Mirrors ai_analysis / ai_analyzed_at pattern.

alter table public.checkform_records
  add column if not exists clip_recommendations jsonb,
  add column if not exists clip_generated_at    timestamptz;

comment on column public.checkform_records.clip_recommendations is
  'STP Matcher result · 1-3 ranked clip matches with reasoning · refresh via force flag on API';

comment on column public.checkform_records.clip_generated_at is
  'When clip_recommendations was last generated';
