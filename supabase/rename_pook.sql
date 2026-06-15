-- ════════════════════════════════════════════════════════════════
-- เปลี่ยนชื่อ customer · 'พี่ปุ๊ก (พี่ตูน)' → 'พี่ปุ๊ก'
-- รันใน Supabase SQL Editor (แก้ชื่อทันที · ไม่ต้อง re-seed)
-- ════════════════════════════════════════════════════════════════
update public.customers
set name = 'พี่ปุ๊ก'
where name = 'พี่ปุ๊ก (พี่ตูน)';

-- ตรวจสอบ:
select id, name, gender, birth_date,
       (select count(*) from public.whoop_daily w where w.customer_id = c.id) as whoop_days
from public.customers c
where name = 'พี่ปุ๊ก';
