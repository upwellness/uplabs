-- ════════════════════════════════════════════════════════════════
-- Seed: พี่สุ — BCA measurement 17 พ.ค. 2569
-- ════════════════════════════════════════════════════════════════
-- Idempotent: ลบ measurement ของวันเดียวกันก่อน insert ใหม่ · กัน duplicate

do $$
declare
  v_customer_id uuid;
begin
  -- Resolve customer (พี่สุ)
  select id into v_customer_id
    from public.customers
   where name = 'พี่สุ (ขจิตสุข)' or name = 'พี่สุ'
   order by created_at asc
   limit 1;

  if v_customer_id is null then
    raise exception 'Customer พี่สุ not found · run su_records.sql first';
  end if;

  -- Remove existing measurement for same date (idempotent)
  delete from public.measurements
   where customer_id = v_customer_id
     and recorded_at = '2026-05-17'::date;

  -- Insert new measurement
  insert into public.measurements (
    customer_id, recorded_at, weight, fat_pct, muscle_pct, visceral, body_age, bmr
  ) values (
    v_customer_id, '2026-05-17'::date, 59.5, 35.9, 24.4, 8, 63, 1244
  );

  raise notice 'Inserted BCA measurement for พี่สุ on 2026-05-17';
end $$;

-- Verify
-- select recorded_at, weight, fat_pct, muscle_pct, visceral, body_age, bmr
--   from public.measurements
--  where customer_id = (select id from customers where name like 'พี่สุ%' limit 1)
--  order by recorded_at desc
--  limit 5;
