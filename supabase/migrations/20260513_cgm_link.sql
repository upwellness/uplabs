-- ════════════════════════════════════════════════════════════════
-- Link CGM profile_names to customer (legacy CGM schema doesn't have FK)
-- ════════════════════════════════════════════════════════════════

alter table public.customers
  add column if not exists cgm_profile_names text[] default '{}';

-- Optional: backfill exact-name matches as a default link (admin can fix later)
update public.customers c
   set cgm_profile_names = array[c.name]
 where (cgm_profile_names is null or array_length(cgm_profile_names, 1) is null)
   and exists (select 1 from public.cgm_readings r where r.profile_name = c.name);

-- Verify:
--   select id, name, cgm_profile_names from public.customers where cgm_profile_names is not null and array_length(cgm_profile_names, 1) > 0;
