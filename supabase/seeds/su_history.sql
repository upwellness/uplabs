-- ════════════════════════════════════════════════════════════════
-- Seed: พี่สุ — Longitudinal Lab History (Feb 2024 → Feb 2026)
-- ที่มา: ตารางสรุปผลตรวจย้อนหลังจากจิ้น
-- ════════════════════════════════════════════════════════════════
-- Idempotent: ลบ records เดิมที่ note='HISTORICAL_IMPORT_V1' ก่อน insert ใหม่
-- เพื่อกัน duplicate เมื่อ re-run

do $$
declare
  v_customer_id uuid;
  v_coach_id    uuid;
  v_rec uuid;
begin
  select id into v_coach_id from auth.users where email = 'ckawin1184@gmail.com' limit 1;
  select id into v_customer_id from public.customers where name = 'พี่สุ (ขจิตสุข)' limit 1;
  if v_customer_id is null then
    raise exception 'Customer พี่สุ (ขจิตสุข) not found — run su_records.sql first';
  end if;

  -- Clean previous historical import (idempotent)
  delete from public.customer_records
    where customer_id = v_customer_id and notes like 'HISTORICAL_IMPORT_V1%';

  -- ─── Helper: insert record + return id ──────────────────────────
  -- เราจะ inline ทุก record เพราะ PL/pgSQL ไม่มี closure ที่ดี

  -- 1. Before Mar 2024
  insert into public.customer_records (customer_id, recorded_at, source, document_type, notes, created_by)
    values (v_customer_id, '2024-02-01', 'Baseline', 'lab',
            'HISTORICAL_IMPORT_V1 · baseline ก่อนเริ่มดูแล', v_coach_id)
    returning id into v_rec;
  insert into public.customer_lab_values (record_id, customer_id, category, metric_key, metric_label_th, metric_label_en, value, value_num, unit, ref_low, ref_high, status, recorded_at) values
    (v_rec, v_customer_id, 'glucose', 'fbs',          'น้ำตาลในเลือด (FBS)', 'FBS',          '117', 117,  'mg/dL', 70,   99,  'high', '2024-02-01'),
    (v_rec, v_customer_id, 'glucose', 'hba1c',        'น้ำตาลสะสม (HbA1c)',  'HbA1c',        '7.3', 7.3,  '%',     null, 5.7, 'high', '2024-02-01'),
    (v_rec, v_customer_id, 'lipid',   'triglyceride', 'ไตรกลีเซอไรด์',       'Triglyceride', '227', 227,  'mg/dL', null, 150, 'high', '2024-02-01'),
    (v_rec, v_customer_id, 'lipid',   'ldl',          'ไขมันเลว LDL',        'LDL',          '94',  94,   'mg/dL', null, 130, 'normal', '2024-02-01');

  -- 2. 2024-03-15
  insert into public.customer_records (customer_id, recorded_at, source, document_type, notes, created_by)
    values (v_customer_id, '2024-03-15', 'Lab', 'lab', 'HISTORICAL_IMPORT_V1', v_coach_id) returning id into v_rec;
  insert into public.customer_lab_values (record_id, customer_id, category, metric_key, metric_label_th, metric_label_en, value, value_num, unit, ref_low, ref_high, status, recorded_at) values
    (v_rec, v_customer_id, 'glucose', 'fbs',          'น้ำตาลในเลือด (FBS)', 'FBS',          '129', 129, 'mg/dL', 70,   99,  'high',       '2024-03-15'),
    (v_rec, v_customer_id, 'glucose', 'hba1c',        'น้ำตาลสะสม (HbA1c)',  'HbA1c',        '6.3', 6.3, '%',     null, 5.7, 'borderline', '2024-03-15'),
    (v_rec, v_customer_id, 'lipid',   'triglyceride', 'ไตรกลีเซอไรด์',       'Triglyceride', '211', 211, 'mg/dL', null, 150, 'high',       '2024-03-15'),
    (v_rec, v_customer_id, 'lipid',   'ldl',          'ไขมันเลว LDL',        'LDL',          '71',  71,  'mg/dL', null, 130, 'normal',     '2024-03-15');

  -- 3. 2024-05-08
  insert into public.customer_records (customer_id, recorded_at, source, document_type, notes, created_by)
    values (v_customer_id, '2024-05-08', 'Lab', 'lab', 'HISTORICAL_IMPORT_V1', v_coach_id) returning id into v_rec;
  insert into public.customer_lab_values (record_id, customer_id, category, metric_key, metric_label_th, metric_label_en, value, value_num, unit, ref_low, ref_high, status, recorded_at) values
    (v_rec, v_customer_id, 'glucose', 'fbs',          'น้ำตาลในเลือด (FBS)', 'FBS',          '144', 144, 'mg/dL', 70,   99,  'high',       '2024-05-08'),
    (v_rec, v_customer_id, 'glucose', 'hba1c',        'น้ำตาลสะสม (HbA1c)',  'HbA1c',        '7.4', 7.4, '%',     null, 5.7, 'high',       '2024-05-08'),
    (v_rec, v_customer_id, 'lipid',   'triglyceride', 'ไตรกลีเซอไรด์',       'Triglyceride', '191', 191, 'mg/dL', null, 150, 'borderline', '2024-05-08'),
    (v_rec, v_customer_id, 'lipid',   'ldl',          'ไขมันเลว LDL',        'LDL',          '80',  80,  'mg/dL', null, 130, 'normal',     '2024-05-08');

  -- 4. 2024-07-04
  insert into public.customer_records (customer_id, recorded_at, source, document_type, notes, created_by)
    values (v_customer_id, '2024-07-04', 'Lab', 'lab', 'HISTORICAL_IMPORT_V1', v_coach_id) returning id into v_rec;
  insert into public.customer_lab_values (record_id, customer_id, category, metric_key, metric_label_th, metric_label_en, value, value_num, unit, ref_low, ref_high, status, recorded_at) values
    (v_rec, v_customer_id, 'glucose', 'fbs',          'น้ำตาลในเลือด (FBS)', 'FBS',          '144', 144, 'mg/dL', 70,   99,  'high',       '2024-07-04'),
    (v_rec, v_customer_id, 'glucose', 'hba1c',        'น้ำตาลสะสม (HbA1c)',  'HbA1c',        '6.7', 6.7, '%',     null, 5.7, 'high',       '2024-07-04'),
    (v_rec, v_customer_id, 'lipid',   'triglyceride', 'ไตรกลีเซอไรด์',       'Triglyceride', '275', 275, 'mg/dL', null, 150, 'high',       '2024-07-04'),
    (v_rec, v_customer_id, 'lipid',   'ldl',          'ไขมันเลว LDL',        'LDL',          '74',  74,  'mg/dL', null, 130, 'normal',     '2024-07-04');

  -- 5. 2024-09-02
  insert into public.customer_records (customer_id, recorded_at, source, document_type, notes, created_by)
    values (v_customer_id, '2024-09-02', 'Lab', 'lab', 'HISTORICAL_IMPORT_V1', v_coach_id) returning id into v_rec;
  insert into public.customer_lab_values (record_id, customer_id, category, metric_key, metric_label_th, metric_label_en, value, value_num, unit, ref_low, ref_high, status, recorded_at) values
    (v_rec, v_customer_id, 'glucose', 'fbs',          'น้ำตาลในเลือด (FBS)', 'FBS',          '136', 136, 'mg/dL', 70,   99,  'high',       '2024-09-02'),
    (v_rec, v_customer_id, 'glucose', 'hba1c',        'น้ำตาลสะสม (HbA1c)',  'HbA1c',        '6.6', 6.6, '%',     null, 5.7, 'high',       '2024-09-02'),
    (v_rec, v_customer_id, 'lipid',   'triglyceride', 'ไตรกลีเซอไรด์',       'Triglyceride', '243', 243, 'mg/dL', null, 150, 'high',       '2024-09-02'),
    (v_rec, v_customer_id, 'lipid',   'ldl',          'ไขมันเลว LDL',        'LDL',          '78',  78,  'mg/dL', null, 130, 'normal',     '2024-09-02');

  -- 6. 2024-12-24
  insert into public.customer_records (customer_id, recorded_at, source, document_type, notes, created_by)
    values (v_customer_id, '2024-12-24', 'Lab', 'lab', 'HISTORICAL_IMPORT_V1', v_coach_id) returning id into v_rec;
  insert into public.customer_lab_values (record_id, customer_id, category, metric_key, metric_label_th, metric_label_en, value, value_num, unit, ref_low, ref_high, status, recorded_at) values
    (v_rec, v_customer_id, 'glucose', 'fbs',          'น้ำตาลในเลือด (FBS)', 'FBS',          '161', 161, 'mg/dL', 70,   99,  'high', '2024-12-24'),
    (v_rec, v_customer_id, 'glucose', 'hba1c',        'น้ำตาลสะสม (HbA1c)',  'HbA1c',        '7.3', 7.3, '%',     null, 5.7, 'high', '2024-12-24'),
    (v_rec, v_customer_id, 'lipid',   'triglyceride', 'ไตรกลีเซอไรด์',       'Triglyceride', '250', 250, 'mg/dL', null, 150, 'high', '2024-12-24'),
    (v_rec, v_customer_id, 'lipid',   'ldl',          'ไขมันเลว LDL',        'LDL',          '82',  82,  'mg/dL', null, 130, 'normal', '2024-12-24');

  -- 7. 2024-12-27 (Paolo)
  insert into public.customer_records (customer_id, recorded_at, source, document_type, notes, created_by)
    values (v_customer_id, '2024-12-27', 'Paolo Hospital', 'lab', 'HISTORICAL_IMPORT_V1 · ตรวจกรดยูริก', v_coach_id) returning id into v_rec;
  insert into public.customer_lab_values (record_id, customer_id, category, metric_key, metric_label_th, metric_label_en, value, value_num, unit, ref_low, ref_high, status, recorded_at) values
    (v_rec, v_customer_id, 'uric', 'uric_acid', 'กรดยูริค', 'Uric Acid', '6.1', 6.1, 'mg/dL', 2.6, 6, 'high', '2024-12-27');

  -- 8. 2025-01-24
  insert into public.customer_records (customer_id, recorded_at, source, document_type, notes, created_by)
    values (v_customer_id, '2025-01-24', 'Lab', 'lab', 'HISTORICAL_IMPORT_V1', v_coach_id) returning id into v_rec;
  insert into public.customer_lab_values (record_id, customer_id, category, metric_key, metric_label_th, metric_label_en, value, value_num, unit, ref_low, ref_high, status, recorded_at) values
    (v_rec, v_customer_id, 'glucose', 'fbs',          'น้ำตาลในเลือด (FBS)', 'FBS',          '147', 147, 'mg/dL', 70,   99,  'high',       '2025-01-24'),
    (v_rec, v_customer_id, 'glucose', 'hba1c',        'น้ำตาลสะสม (HbA1c)',  'HbA1c',        '6.4', 6.4, '%',     null, 5.7, 'borderline', '2025-01-24'),
    (v_rec, v_customer_id, 'lipid',   'triglyceride', 'ไตรกลีเซอไรด์',       'Triglyceride', '216', 216, 'mg/dL', null, 150, 'high',       '2025-01-24');

  -- 9. 2025-03-19 (ปทุมเวช + uric จากเปาโล)
  insert into public.customer_records (customer_id, recorded_at, source, document_type, notes, created_by)
    values (v_customer_id, '2025-03-19', 'Patumwet Hospital', 'lab', 'HISTORICAL_IMPORT_V1 · ปทุมเวช (Uric Acid 6+ จากเปาโลรอบเดียวกัน)', v_coach_id) returning id into v_rec;
  insert into public.customer_lab_values (record_id, customer_id, category, metric_key, metric_label_th, metric_label_en, value, value_num, unit, ref_low, ref_high, status, recorded_at) values
    (v_rec, v_customer_id, 'glucose', 'fbs',          'น้ำตาลในเลือด (FBS)', 'FBS',          '121', 121, 'mg/dL', 70,   99,  'high',       '2025-03-19'),
    (v_rec, v_customer_id, 'glucose', 'hba1c',        'น้ำตาลสะสม (HbA1c)',  'HbA1c',        '6.7', 6.7, '%',     null, 5.7, 'high',       '2025-03-19'),
    (v_rec, v_customer_id, 'uric',    'uric_acid',    'กรดยูริค',            'Uric Acid',    '6.0', 6.0, 'mg/dL', 2.6,  6,   'borderline', '2025-03-19'),
    (v_rec, v_customer_id, 'lipid',   'triglyceride', 'ไตรกลีเซอไรด์',       'Triglyceride', '199', 199, 'mg/dL', null, 150, 'borderline', '2025-03-19'),
    (v_rec, v_customer_id, 'lipid',   'ldl',          'ไขมันเลว LDL',        'LDL',          '50',  50,  'mg/dL', null, 130, 'normal',     '2025-03-19');

  -- 10. 2025-06-11 (UP Labs day 10)
  insert into public.customer_records (customer_id, recorded_at, source, document_type, notes, created_by)
    values (v_customer_id, '2025-06-11', 'UP Labs', 'lab', 'HISTORICAL_IMPORT_V1 · UP Labs Day 10 ✨ จุดที่ดีที่สุด', v_coach_id) returning id into v_rec;
  insert into public.customer_lab_values (record_id, customer_id, category, metric_key, metric_label_th, metric_label_en, value, value_num, unit, ref_low, ref_high, status, recorded_at) values
    (v_rec, v_customer_id, 'glucose', 'fbs',  'น้ำตาลในเลือด (FBS)',     'FBS',  '100',    100,    'mg/dL',         70,   99,  'borderline', '2025-06-11'),
    (v_rec, v_customer_id, 'kidney',  'cr',   'Creatinine',              'Cr',   '0.58',   0.58,   'mg/dL',         0.55, 1.02,'normal',     '2025-06-11'),
    (v_rec, v_customer_id, 'kidney',  'egfr', 'อัตรากรองของไต (eGFR)',  'eGFR', '101.21', 101.21, 'mL/min/1.73m2', 90,   200, 'normal',     '2025-06-11');

  -- 11. 2025-06-13 (Paolo)
  insert into public.customer_records (customer_id, recorded_at, source, document_type, notes, created_by)
    values (v_customer_id, '2025-06-13', 'Paolo Hospital', 'lab', 'HISTORICAL_IMPORT_V1 · ✨ HbA1c ต่ำสุด · TG ต่ำสุด', v_coach_id) returning id into v_rec;
  insert into public.customer_lab_values (record_id, customer_id, category, metric_key, metric_label_th, metric_label_en, value, value_num, unit, ref_low, ref_high, status, recorded_at) values
    (v_rec, v_customer_id, 'glucose', 'hba1c',        'น้ำตาลสะสม (HbA1c)',  'HbA1c',        '5.8', 5.8, '%',     null, 5.7, 'borderline', '2025-06-13'),
    (v_rec, v_customer_id, 'uric',    'uric_acid',    'กรดยูริค',            'Uric Acid',    '7.2', 7.2, 'mg/dL', 2.6,  6,   'high',       '2025-06-13'),
    (v_rec, v_customer_id, 'lipid',   'triglyceride', 'ไตรกลีเซอไรด์',       'Triglyceride', '88',  88,  'mg/dL', null, 150, 'normal',     '2025-06-13'),
    (v_rec, v_customer_id, 'lipid',   'hdl',          'ไขมันดี HDL',         'HDL',          '38',  38,  'mg/dL', 50,   null,'low',        '2025-06-13'),
    (v_rec, v_customer_id, 'lipid',   'ldl',          'ไขมันเลว LDL',        'LDL',          '47',  47,  'mg/dL', null, 130, 'normal',     '2025-06-13');

  -- 12. 2025-09-03 (Patumwet)
  insert into public.customer_records (customer_id, recorded_at, source, document_type, notes, created_by)
    values (v_customer_id, '2025-09-03', 'Patumwet Hospital', 'lab', 'HISTORICAL_IMPORT_V1', v_coach_id) returning id into v_rec;
  insert into public.customer_lab_values (record_id, customer_id, category, metric_key, metric_label_th, metric_label_en, value, value_num, unit, ref_low, ref_high, status, recorded_at) values
    (v_rec, v_customer_id, 'glucose', 'fbs',   'น้ำตาลในเลือด (FBS)', 'FBS',   '113', 113, 'mg/dL', 70,   99,  'high',       '2025-09-03'),
    (v_rec, v_customer_id, 'glucose', 'hba1c', 'น้ำตาลสะสม (HbA1c)',  'HbA1c', '6.0', 6.0, '%',     null, 5.7, 'borderline', '2025-09-03'),
    (v_rec, v_customer_id, 'lipid',   'ldl',   'ไขมันเลว LDL',        'LDL',   '42',  42,  'mg/dL', null, 130, 'normal',     '2025-09-03');

  -- 13. 2025-09-05 (Paolo)
  insert into public.customer_records (customer_id, recorded_at, source, document_type, notes, created_by)
    values (v_customer_id, '2025-09-05', 'Paolo Hospital', 'lab', 'HISTORICAL_IMPORT_V1', v_coach_id) returning id into v_rec;
  insert into public.customer_lab_values (record_id, customer_id, category, metric_key, metric_label_th, metric_label_en, value, value_num, unit, ref_low, ref_high, status, recorded_at) values
    (v_rec, v_customer_id, 'lipid', 'hdl',          'ไขมันดี HDL',   'HDL',          '38',  38,  'mg/dL', 50,   null,'low',        '2025-09-05'),
    (v_rec, v_customer_id, 'lipid', 'triglyceride', 'ไตรกลีเซอไรด์', 'Triglyceride', '137', 137, 'mg/dL', null, 150, 'normal',     '2025-09-05'),
    (v_rec, v_customer_id, 'uric',  'uric_acid',    'กรดยูริค',      'Uric Acid',    '6.3', 6.3, 'mg/dL', 2.6,  6,   'high',       '2025-09-05');

  -- 14. 2026-02-19
  insert into public.customer_records (customer_id, recorded_at, source, document_type, notes, created_by)
    values (v_customer_id, '2026-02-19', 'Lab', 'lab', 'HISTORICAL_IMPORT_V1', v_coach_id) returning id into v_rec;
  insert into public.customer_lab_values (record_id, customer_id, category, metric_key, metric_label_th, metric_label_en, value, value_num, unit, ref_low, ref_high, status, recorded_at) values
    (v_rec, v_customer_id, 'glucose', 'fbs',   'น้ำตาลในเลือด (FBS)', 'FBS',   '116', 116, 'mg/dL', 70,   99,  'high',       '2026-02-19'),
    (v_rec, v_customer_id, 'glucose', 'hba1c', 'น้ำตาลสะสม (HbA1c)',  'HbA1c', '6.2', 6.2, '%',     null, 5.7, 'borderline', '2026-02-19'),
    (v_rec, v_customer_id, 'lipid',   'ldl',   'ไขมันเลว LDL',        'LDL',   '78',  78,  'mg/dL', null, 130, 'normal',     '2026-02-19');

  -- 15. 2026-02-24 (Thyroid panel + Uric + TG)
  insert into public.customer_records (customer_id, recorded_at, source, document_type, notes, created_by)
    values (v_customer_id, '2026-02-24', 'Lab', 'lab', 'HISTORICAL_IMPORT_V1 · Thyroid panel', v_coach_id) returning id into v_rec;
  insert into public.customer_lab_values (record_id, customer_id, category, metric_key, metric_label_th, metric_label_en, value, value_num, unit, ref_low, ref_high, status, recorded_at) values
    (v_rec, v_customer_id, 'thyroid', 'tsh',          'TSH',           'TSH',          '2.274', 2.274, 'mU/L',  0.35, 4.94, 'normal', '2026-02-24'),
    (v_rec, v_customer_id, 'thyroid', 'ft3',          'Free T3',       'FT3',          '2.49',  2.49,  'pg/mL', 1.58, 3.91, 'normal', '2026-02-24'),
    (v_rec, v_customer_id, 'thyroid', 'ft4',          'Free T4',       'FT4',          '1.11',  1.11,  'ng/dL', 0.7,  1.48, 'normal', '2026-02-24'),
    (v_rec, v_customer_id, 'uric',    'uric_acid',    'กรดยูริค',      'Uric Acid',    '5.3',   5.3,   'mg/dL', 2.6,  6,    'normal', '2026-02-24'),
    (v_rec, v_customer_id, 'lipid',   'triglyceride', 'ไตรกลีเซอไรด์', 'Triglyceride', '132',   132,   'mg/dL', null, 150,  'normal', '2026-02-24');

  raise notice 'Historical import complete for customer %', v_customer_id;
end $$;

-- Verify:
-- select r.recorded_at, r.source, count(v.id) as n_values
--   from customer_records r
--   left join customer_lab_values v on v.record_id = r.id
--   where r.customer_id = (select id from customers where name = 'พี่สุ (ขจิตสุข)')
--   group by r.recorded_at, r.source, r.id
--   order by r.recorded_at;
