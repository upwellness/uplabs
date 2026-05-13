-- ════════════════════════════════════════════════════════════════
-- Merge: พี่สุ (ขจิตสุข) → พี่สุ
-- เก็บ "พี่สุ" เป็นหลัก ย้ายทุก child record มา ลบตัวซ้ำ
-- ════════════════════════════════════════════════════════════════
-- Idempotent: ถ้าไม่มีตัวซ้ำแล้วจะข้ามเฉยๆ

do $$
declare
  v_keep_id    uuid;    -- พี่สุ (primary)
  v_remove_id  uuid;    -- พี่สุ (ขจิตสุข) (duplicate)
  v_merged_cgm text[];
begin
  select id into v_keep_id   from public.customers where name = 'พี่สุ'            limit 1;
  select id into v_remove_id from public.customers where name = 'พี่สุ (ขจิตสุข)' limit 1;

  if v_remove_id is null then
    raise notice 'ไม่พบ "พี่สุ (ขจิตสุข)" — ไม่ต้อง merge';
    return;
  end if;

  if v_keep_id is null then
    -- ไม่มี "พี่สุ" อยู่แล้ว → แค่ rename
    update public.customers set name = 'พี่สุ' where id = v_remove_id;
    raise notice 'Rename "พี่สุ (ขจิตสุข)" → "พี่สุ" (% → %)', v_remove_id, v_remove_id;
    return;
  end if;

  if v_keep_id = v_remove_id then
    raise notice 'ID เดียวกัน — ไม่ต้องทำอะไร';
    return;
  end if;

  raise notice 'Merge % → %', v_remove_id, v_keep_id;

  -- ── 1. Merge cgm_profile_names (dedup) ──────────────────────────
  select array(
    select distinct unnest(
      coalesce((select cgm_profile_names from public.customers where id = v_keep_id),   '{}'::text[]) ||
      coalesce((select cgm_profile_names from public.customers where id = v_remove_id), '{}'::text[])
    )
  ) into v_merged_cgm;
  update public.customers set cgm_profile_names = v_merged_cgm where id = v_keep_id;

  -- ── 2. Move child rows — straightforward FKs ────────────────────
  update public.measurements         set customer_id = v_keep_id where customer_id = v_remove_id;
  update public.pulse_invites        set customer_id = v_keep_id where customer_id = v_remove_id;
  update public.pulse_readings       set customer_id = v_keep_id where customer_id = v_remove_id;
  update public.pulse_intakes        set customer_id = v_keep_id where customer_id = v_remove_id;
  update public.pulse_assessments    set customer_id = v_keep_id where customer_id = v_remove_id;
  update public.healthcheck_leads    set customer_id = v_keep_id where customer_id = v_remove_id;
  update public.customer_records     set customer_id = v_keep_id where customer_id = v_remove_id;
  update public.customer_lab_values  set customer_id = v_keep_id where customer_id = v_remove_id;

  -- ── 3. pulse_connections has UNIQUE(customer_id, provider) ──────
  -- ถ้า keep มี connection ของ provider เดียวกันอยู่แล้ว → ลบของ remove ทิ้ง
  -- ถ้าไม่มี → ย้าย
  delete from public.pulse_connections
   where customer_id = v_remove_id
     and provider in (select provider from public.pulse_connections where customer_id = v_keep_id);
  update public.pulse_connections set customer_id = v_keep_id where customer_id = v_remove_id;

  -- ── 4. Delete duplicate customer ────────────────────────────────
  delete from public.customers where id = v_remove_id;

  raise notice 'Merge สำเร็จ — ลบ % เรียบร้อย', v_remove_id;
end $$;

-- Verify:
--   select name, id, cgm_profile_names from public.customers where name like 'พี่สุ%';
--   select count(*) from public.customer_records where customer_id =
--     (select id from public.customers where name = 'พี่สุ');
