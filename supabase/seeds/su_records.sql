-- ════════════════════════════════════════════════════════════════
-- Seed: พี่สุ (ขจิตสุข ประชุมสุข) — Paolo Hospital · 18 พ.ย. 2569
-- HN R-62-031476 — Annual Physical Exam
-- ════════════════════════════════════════════════════════════════
-- Idempotent: re-running creates a NEW record but won't duplicate the customer.

do $$
declare
  v_customer_id uuid;
  v_record_id   uuid;
  v_coach_id    uuid;
begin
  -- ── 1. Resolve coach (default = admin: ckawin1184@gmail.com) ──────
  select id into v_coach_id
    from auth.users where email = 'ckawin1184@gmail.com' limit 1;

  -- ── 2. Customer (create if not exists) ──────────────────────────
  select id into v_customer_id
    from public.customers where name = 'พี่สุ (ขจิตสุข)' limit 1;

  if v_customer_id is null then
    insert into public.customers (name, gender, coach_id)
      values ('พี่สุ (ขจิตสุข)', 'female', v_coach_id)
      returning id into v_customer_id;
  end if;

  -- ── 3. Record ───────────────────────────────────────────────────
  insert into public.customer_records (
    customer_id, recorded_at, source, source_id, document_type, notes, created_by
  ) values (
    v_customer_id, '2026-11-18'::date, 'Paolo Hospital', 'R-62-031476', 'annual_physical',
    E'ตรวจสุขภาพประจำปี Paolo Hospital · พบประเด็นที่ต้องติดตาม:\n' ||
    E'• Pre-diabetes (FBS 116 · HbA1c 6.0 — เริ่มสูง)\n' ||
    E'• ไขมันพอกตับเริ่มมี (Upper Abdomen US ผิดปกติ · FibroScan CAP 259-268 S1)\n' ||
    E'• eGFR 89.51 = ระยะ 2 (เริ่มเสี่ยง)\n' ||
    E'• HDL 46 ต่ำกว่าเกณฑ์ (>50)\n' ||
    E'• CBC: WBC/RBC/Hb/Hct ต่ำเล็กน้อย · Lymphocytes สูง\n' ||
    E'• Mammogram: ซีสต์เต้านมขวา 4.3 มม + จุดหินปูน 2 ข้าง — แนะนำตรวจติดตามทุก 6 เดือน\n' ||
    E'• EKG ก้ำกึ่ง — ถ้ามีอาการเหนื่อยง่าย/แน่นหน้าอก ควรพบแพทย์โรคหัวใจ\n' ||
    E'• พังผืดตับ F1-F2 (Non advance fibrosis)',
    v_coach_id
  ) returning id into v_record_id;

  -- ── 4. Lab values ───────────────────────────────────────────────
  insert into public.customer_lab_values (
    record_id, customer_id, category, metric_key,
    metric_label_th, metric_label_en, value, value_num,
    unit, ref_low, ref_high, ref_text, status, recorded_at
  ) values
  -- CBC ความสมบูรณ์ของเม็ดเลือด
  (v_record_id, v_customer_id, 'cbc', 'wbc',         'จำนวนเม็ดเลือดขาว',          'WBC',          '3.84',  3.84,  '10^3 cells/L',  4,    10,   null, 'low',    '2026-11-18'),
  (v_record_id, v_customer_id, 'cbc', 'rbc',         'จำนวนเม็ดเลือดแดง',          'RBC',          '3.90',  3.90,  '10^6 cells/uL', 4,    5.2,  null, 'low',    '2026-11-18'),
  (v_record_id, v_customer_id, 'cbc', 'hb',          'ฮีโมโกลบิน',                'Hb',           '11.7',  11.7,  'g/dL',          12,   16,   null, 'low',    '2026-11-18'),
  (v_record_id, v_customer_id, 'cbc', 'hct',         'ความเข้มข้นของเลือด',         'Hct',          '35.2',  35.2,  '%',             36,   48,   null, 'low',    '2026-11-18'),
  (v_record_id, v_customer_id, 'cbc', 'mcv',         'ปริมาตรเฉลี่ยเม็ดเลือดแดง',  'MCV',          '90.3',  90.3,  'fL',            80,   100,  null, 'normal', '2026-11-18'),
  (v_record_id, v_customer_id, 'cbc', 'mch',         'Hb เฉลี่ยต่อเม็ด',           'MCH',          '30.0',  30.0,  'pg',            26,   34,   null, 'normal', '2026-11-18'),
  (v_record_id, v_customer_id, 'cbc', 'mchc',        'Hb เฉลี่ย/dL',               'MCHC',         '33.2',  33.2,  'g/dL',          31,   37,   null, 'normal', '2026-11-18'),
  (v_record_id, v_customer_id, 'cbc', 'rdw',         'การกระจายขนาด RBC',          'RDW',          '13.2',  13.2,  '%',             9,    15,   null, 'normal', '2026-11-18'),
  (v_record_id, v_customer_id, 'cbc', 'platelet',    'เกล็ดเลือด',                 'Platelet',     '210',   210,   '10^3/mm3',      150,  450,  null, 'normal', '2026-11-18'),
  (v_record_id, v_customer_id, 'cbc', 'neutrophils', 'นิวโทรฟิล',                  'Neutrophils',  '36.0',  36.0,  '%',             46.5, 75,   null, 'low',    '2026-11-18'),
  (v_record_id, v_customer_id, 'cbc', 'lymphocytes', 'ลิมโฟไซต์',                  'Lymphocytes',  '52.0',  52.0,  '%',             12,   44,   null, 'high',   '2026-11-18'),
  (v_record_id, v_customer_id, 'cbc', 'monocytes',   'โมโนไซต์',                   'Monocytes',    '6.0',   6.0,   '%',             0,    11.2, null, 'normal', '2026-11-18'),
  (v_record_id, v_customer_id, 'cbc', 'eosinophils', 'อีโอซิโนฟิล',                'Eosinophils',  '5.0',   5.0,   '%',             0,    9.5,  null, 'normal', '2026-11-18'),
  (v_record_id, v_customer_id, 'cbc', 'basophils',   'เบโซฟิล',                    'Basophils',    '1.0',   1.0,   '%',             0,    2.5,  null, 'normal', '2026-11-18'),
  (v_record_id, v_customer_id, 'cbc', 'rbc_morphology', 'รูปร่างเม็ดเลือดแดง',     'RBC Morphology','Normochromic Normocytic RBC', null, '', null, null, 'Normal', 'normal', '2026-11-18'),

  -- Lipid ระดับไขมันในเลือด
  (v_record_id, v_customer_id, 'lipid', 'cholesterol',  'คอเลสเตอรอลรวม', 'Total Cholesterol', '127', 127, 'mg/dL', null, 200, null, 'normal',     '2026-11-18'),
  (v_record_id, v_customer_id, 'lipid', 'triglyceride', 'ไตรกลีเซอไรด์',  'Triglyceride',      '90',  90,  'mg/dL', null, 150, null, 'normal',     '2026-11-18'),
  (v_record_id, v_customer_id, 'lipid', 'hdl',          'ไขมันดี HDL',    'HDL',               '46',  46,  'mg/dL', 50,   null, null, 'low',       '2026-11-18'),
  (v_record_id, v_customer_id, 'lipid', 'ldl',          'ไขมันเลว LDL',   'LDL',               '69',  69,  'mg/dL', null, 130, null, 'normal',     '2026-11-18'),

  -- Kidney การทำงานของไต
  (v_record_id, v_customer_id, 'kidney', 'bun',  'BUN',                    'BUN',  '15.90', 15.90, 'mg/dL',           9.8,  20.1, null, 'normal',     '2026-11-18'),
  (v_record_id, v_customer_id, 'kidney', 'cr',   'Creatinine',             'Cr',   '0.73',  0.73,  'mg/dL',           0.55, 1.02, null, 'normal',     '2026-11-18'),
  (v_record_id, v_customer_id, 'kidney', 'egfr', 'อัตรากรองของไต (eGFR)',  'eGFR', '89.51', 89.51, 'mL/min/1.73m2',   90,   200,  null, 'low',        '2026-11-18'),

  -- Glucose ระดับน้ำตาลในเลือด
  (v_record_id, v_customer_id, 'glucose', 'fbs',   'น้ำตาลในเลือด (FBS)',  'FBS',   '116', 116, 'mg/dL', 70,   99,   null, 'high', '2026-11-18'),
  (v_record_id, v_customer_id, 'glucose', 'hba1c', 'น้ำตาลสะสม (HbA1c)',   'HbA1c', '6.0', 6.0, '%',     null, 5.7,  null, 'high', '2026-11-18'),

  -- Thyroid ฮอร์โมนไทรอยด์
  (v_record_id, v_customer_id, 'thyroid', 'tsh', 'TSH',     'TSH', '2.247', 2.247, 'mU/L',  0.35, 4.94, null, 'normal', '2026-11-18'),
  (v_record_id, v_customer_id, 'thyroid', 'ft3', 'Free T3', 'FT3', '2.52',  2.52,  'pg/mL', 1.58, 3.91, null, 'normal', '2026-11-18'),
  (v_record_id, v_customer_id, 'thyroid', 'ft4', 'Free T4', 'FT4', '1.27',  1.27,  'ng/dL', 0.7,  1.48, null, 'normal', '2026-11-18'),

  -- Uric กรดยูริค
  (v_record_id, v_customer_id, 'uric', 'uric_acid', 'กรดยูริค', 'Uric Acid', '5.7', 5.7, 'mg/dL', 2.6, 6, null, 'normal', '2026-11-18'),

  -- Hepatitis B
  (v_record_id, v_customer_id, 'hepatitis', 'hbs_ag', 'HBs-Ag (การติดเชื้อไวรัสตับ B)', 'HBs-Ag', 'Negative',     null, null, null, null, 'Negative', 'normal', '2026-11-18'),
  (v_record_id, v_customer_id, 'hepatitis', 'hbs_ab', 'HBs-Ab (ภูมิคุ้มกัน)',         'HBs-Ab', '>1000.00',     null, 'mIU/mL', 10, null, null, 'high',   '2026-11-18'),

  -- Cancer marker
  (v_record_id, v_customer_id, 'cancer', 'ca125', 'CA-125 (มะเร็งรังไข่)', 'CA-125', '14', 14, 'U/mL', null, 35, null, 'normal', '2026-11-18'),

  -- Imaging
  (v_record_id, v_customer_id, 'imaging', 'chest_xray',
    'เอกซเรย์ทรวงอก', 'Chest X-ray',
    'ไม่พบก้อนผิดปกติ · ปกติ',
    null, '', null, null, 'Normal', 'normal', '2026-11-18'),

  (v_record_id, v_customer_id, 'imaging', 'carotid_duplex',
    'Carotid Duplex Ultrasound', 'Carotid Duplex',
    'ปกติ',
    null, '', null, null, 'Normal', 'normal', '2026-11-18'),

  (v_record_id, v_customer_id, 'imaging', 'upper_abdomen_us',
    'อัลตราซาวด์ช่องท้องส่วนบน', 'Upper Abdomen US',
    'เริ่มมีไขมันพอกตับ — แนะนำตรวจติดตาม · ผิดปกติ',
    null, '', null, null, 'Normal', 'high', '2026-11-18'),

  (v_record_id, v_customer_id, 'imaging', 'mammogram',
    'Mammogram + US Breasts', 'Mammogram + US Breasts',
    E'ท่อน้ำนมบริเวณลานนมขวามีการขยายตัวเล็กน้อย 2.8 มม · ซีสต์ที่เต้านมขวา 4.3 มม · จุดหินปูนที่เต้านมทั้ง 2 ข้าง · แนะนำตรวจติดตามทุก 6 เดือน · ผิดปกติ',
    null, '', null, null, 'Normal', 'high', '2026-11-18'),

  (v_record_id, v_customer_id, 'imaging', 'ekg',
    'คลื่นไฟฟ้าหัวใจ', 'EKG',
    'ก้ำกึ่งระหว่างปกติและไม่ปกติ · ถ้ามีอาการเหนื่อยง่าย แน่นหน้าอก ควรพบแพทย์โรคหัวใจ',
    null, '', null, null, 'Normal', 'borderline', '2026-11-18'),

  (v_record_id, v_customer_id, 'imaging', 'fibroscan_cap',
    'FibroScan CAP (ไขมันตับ)', 'FibroScan CAP',
    '259-268 dB/m (S1 — ปริมาณไขมันในตับน้อย)',
    263.5, 'dB/m', null, 248, null, 'high', '2026-11-18'),

  (v_record_id, v_customer_id, 'imaging', 'fibroscan_e',
    'FibroScan E (พังผืดตับ)', 'FibroScan E',
    '7.1 kPa (F1-F2 — Non advance fibrosis)',
    7.1, 'kPa', null, 7, null, 'high', '2026-11-18');

  raise notice 'Seeded customer % with record %', v_customer_id, v_record_id;
end $$;

-- Verify:
--   select c.name, r.recorded_at, r.source, count(v.id) as values
--     from customers c
--     join customer_records r on r.customer_id = c.id
--     left join customer_lab_values v on v.record_id = r.id
--    where c.name like 'พี่สุ%'
--    group by c.name, r.recorded_at, r.source;
