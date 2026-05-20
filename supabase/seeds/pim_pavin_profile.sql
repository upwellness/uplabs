-- ════════════════════════════════════════════════════════════════
-- Seed: คุณพิมพ์ปวีณ์ นิลสุพรรณ — Customer Profile + IgG Allergy Test
-- ════════════════════════════════════════════════════════════════
-- Idempotent: รันซ้ำได้ · ไม่สร้าง duplicate
-- Test source: N Health Food Sensitivity Report (IgG-based · 220 foods panel)

do $$
declare
  v_customer_id uuid;
  v_test_id     uuid;
  v_coach_id    uuid;
begin
  -- ─── Step 0: Resolve coach (default = admin) ─────────────────────
  select id into v_coach_id
    from auth.users where email = 'ckawin1184@gmail.com' limit 1;

  if v_coach_id is null then
    raise exception 'Coach not found · update email or seed an admin first';
  end if;

  -- ─── Step 1: Create or find customer ─────────────────────────────
  select id into v_customer_id
    from public.customers
   where name = 'พิมพ์ปวีณ์ นิลสุพรรณ'
   limit 1;

  if v_customer_id is null then
    insert into public.customers (name, gender, coach_id)
    values ('พิมพ์ปวีณ์ นิลสุพรรณ', 'female', v_coach_id)
    returning id into v_customer_id;
    raise notice 'Created customer พิมพ์ปวีณ์ id=%', v_customer_id;
  else
    raise notice 'Customer พิมพ์ปวีณ์ exists id=%', v_customer_id;
  end if;

  -- ─── Step 2: Delete old test (idempotent) + insert new ───────────
  delete from public.customer_allergy_tests
   where customer_id = v_customer_id
     and test_lab = 'N Health'
     and tested_at = '2026-05-17'::date;

  insert into public.customer_allergy_tests (
    customer_id, test_type, test_lab, test_name, panel_size, tested_at, notes, created_by
  ) values (
    v_customer_id, 'IgG', 'N Health', 'Food Sensitivity Report', 220, '2026-05-17',
    'Image-based · ELIMINATE list (≥30 score · 3-6 months) + REDUCE list (25-29 · max 1×/week)',
    v_coach_id
  ) returning id into v_test_id;

  -- ─── Step 3: Insert 26 food allergen findings ────────────────────

  -- ELIMINATE list (score ≥ 30 · avoid 3-6 months)
  insert into public.customer_food_allergens
    (test_id, customer_id, food_key, food_name_th, food_name_en, food_category, score, severity, recommended_action, tested_at)
  values
  (v_test_id, v_customer_id, 'yeast_baker',  'ยีสต์สำหรับทำขนมปัง', 'Yeast (Baker''s)',     'fungus',    81, 'eliminate', 'หลีกเลี่ยง 3-6 เดือน', '2026-05-17'),
  (v_test_id, v_customer_id, 'ginkgo',       'แปะก๊วย',              'Ginkgo',                'herb',      73, 'eliminate', 'หลีกเลี่ยง 3-6 เดือน', '2026-05-17'),
  (v_test_id, v_customer_id, 'potato',       'มันฝรั่ง',              'Potato',                'vegetable', 56, 'eliminate', 'หลีกเลี่ยง 3-6 เดือน', '2026-05-17'),
  (v_test_id, v_customer_id, 'yeast_brewer', 'บรูเวอร์ยีสต์',         'Yeast (Brewer''s)',     'fungus',    55, 'eliminate', 'หลีกเลี่ยง 3-6 เดือน', '2026-05-17'),
  (v_test_id, v_customer_id, 'cola_nut',     'กั่วโคล่า',             'Cola Nut',              'nut',       52, 'eliminate', 'หลีกเลี่ยง 3-6 เดือน', '2026-05-17'),
  (v_test_id, v_customer_id, 'pistachio',    'กั่วพิสตาชิโอ',         'Pistachio',             'nut',       50, 'eliminate', 'หลีกเลี่ยง 3-6 เดือน', '2026-05-17'),
  (v_test_id, v_customer_id, 'amaranth',     'อมารันท์',              'Amaranth',              'grain',     45, 'eliminate', 'หลีกเลี่ยง 3-6 เดือน', '2026-05-17'),
  (v_test_id, v_customer_id, 'cashew',       'มะม่วงหิมพานต์',        'Cashew Nut',            'nut',       44, 'eliminate', 'หลีกเลี่ยง 3-6 เดือน', '2026-05-17'),
  (v_test_id, v_customer_id, 'milk_cow',     'นมวัว',                 'Milk (Cow)',            'dairy',     43, 'eliminate', 'หลีกเลี่ยง 3-6 เดือน', '2026-05-17'),
  (v_test_id, v_customer_id, 'gliadin',      'แป้งไกลอะดิน',          'Gliadin',               'grain',     42, 'eliminate', 'หลีกเลี่ยง 3-6 เดือน · gluten protein', '2026-05-17'),
  (v_test_id, v_customer_id, 'agar_agar',    'ผงวุ้น',                'Agar Agar',             'algae',     42, 'eliminate', 'หลีกเลี่ยง 3-6 เดือน', '2026-05-17'),
  (v_test_id, v_customer_id, 'oat',          'ข้าวโอ๊ต',              'Oat',                   'grain',     41, 'eliminate', 'หลีกเลี่ยง 3-6 เดือน', '2026-05-17'),
  (v_test_id, v_customer_id, 'pea',          'กั่วลันเตา',            'Pea',                   'legume',    41, 'eliminate', 'หลีกเลี่ยง 3-6 เดือน', '2026-05-17'),
  (v_test_id, v_customer_id, 'winkle',       'หอยโข่ง',               'Winkle',                'seafood',   40, 'eliminate', 'หลีกเลี่ยง 3-6 เดือน', '2026-05-17'),
  (v_test_id, v_customer_id, 'egg_white',    'ไข่ขาว',                'Egg White',             'protein',   39, 'eliminate', 'หลีกเลี่ยง 3-6 เดือน', '2026-05-17'),
  (v_test_id, v_customer_id, 'corn',         'ข้าวโพด',               'Corn (Maize)',          'grain',     38, 'eliminate', 'หลีกเลี่ยง 3-6 เดือน · มัก hidden ใน maltodextrin', '2026-05-17'),
  (v_test_id, v_customer_id, 'celery',       'ผักคื่นช่ายฝรั่ง',       'Celery',                'vegetable', 33, 'eliminate', 'หลีกเลี่ยง 3-6 เดือน', '2026-05-17'),
  (v_test_id, v_customer_id, 'plum',         'ลูกพลัม',               'Plum',                  'fruit',     33, 'eliminate', 'หลีกเลี่ยง 3-6 เดือน', '2026-05-17'),
  (v_test_id, v_customer_id, 'malt',         'ข้าวมอลต์',             'Malt',                  'grain',     32, 'eliminate', 'หลีกเลี่ยง 3-6 เดือน', '2026-05-17'),
  (v_test_id, v_customer_id, 'bean_white',   'กั่วขาว',               'Bean (White Haricot)',  'legume',    30, 'eliminate', 'หลีกเลี่ยง 3-6 เดือน · ใน Calow', '2026-05-17'),
  (v_test_id, v_customer_id, 'squash',       'สควอช',                 'Squash',                'vegetable', 30, 'eliminate', 'หลีกเลี่ยง 3-6 เดือน', '2026-05-17'),

  -- REDUCE list (score 25-29 · max 1×/week)
  (v_test_id, v_customer_id, 'barley',       'ข้าวบาร์เลย์',          'Barley',                'grain',     29, 'reduce',    'ไม่เกิน 1 ครั้ง/สัปดาห์', '2026-05-17'),
  (v_test_id, v_customer_id, 'cranberry',    'แครนเบอร์รี่',          'Cranberry',             'fruit',     29, 'reduce',    'ไม่เกิน 1 ครั้ง/สัปดาห์ · ใน Probiotic W', '2026-05-17'),
  (v_test_id, v_customer_id, 'orange',       'ส้ม',                   'Orange',                'fruit',     27, 'reduce',    'ไม่เกิน 1 ครั้ง/สัปดาห์ · citrus bioflavonoids ใน Bio C/CoQ10', '2026-05-17'),
  (v_test_id, v_customer_id, 'peanut',       'กั่วลิสง',              'Peanut',                'legume',    25, 'reduce',    'ไม่เกิน 1 ครั้ง/สัปดาห์', '2026-05-17'),
  (v_test_id, v_customer_id, 'mussel',       'หอยแมลงภู่',            'Mussel',                'seafood',   25, 'reduce',    'ไม่เกิน 1 ครั้ง/สัปดาห์', '2026-05-17');

  -- ─── Step 4: Supplement safety mapping (Nutrilite TH catalog) ─────
  -- Idempotent · delete old then insert
  delete from public.customer_supplement_safety where customer_id = v_customer_id;

  insert into public.customer_supplement_safety
    (customer_id, product_key, product_th, product_en, sku_id, status, conflicting_ingredients, conflict_severity, reason, alternative_product, verified_at)
  values
  -- 🔴 AVOID
  (v_customer_id, 'all_plant_protein',      'นิวทริไลท์ ออล แพลนท์ โปรตีน (Original)', 'Nutrilite All Plant Protein',       '110415TH',     'avoid',       array['wheat','pea'],          array['eliminate','eliminate'], 'Wheat 2g + Pea 1.5g per scoop · ทั้ง 2 อยู่ใน eliminate list',                'Hemp/Rice/Pumpkin seed protein',                                    '2026-05-17'),
  (v_customer_id, 'all_plant_protein_plus', 'นิวทริไลท์ ออล แพลนท์ โปรตีน พลัส',         'Nutrilite All Plant Protein Plus',  '(new SKU)',    'avoid',       array['wheat'],                 array['eliminate'],             'Wheat 1g per scoop ยังอยู่ใน formula ใหม่',                                'Hemp/Rice protein · BodyKey (verify chia)',                          '2026-05-17'),
  (v_customer_id, 'chewable_fiber',          'นิวทริไลท์ ชูเอเบิ้ล ไฟเบอร์ เบลนด์',         'Nutrilite Chewable Fiber Blend',    '104402TH',     'avoid',       array['oat','wheat','pea','barley'], array['eliminate','eliminate','eliminate','reduce'], 'Multi-fiber: oat+wheat+pea+barley bran+soybean — ทุกตัวมีปัญหา',          'Psyllium husk (Metamucil/Plantago ovata)',                          '2026-05-17'),
  (v_customer_id, 'calow',                   'นิวทริไลท์ แคลโลว์',                       'Nutrilite Calow',                   '100193TH',     'avoid',       array['bean_white'],            array['eliminate'],             'White bean extract 183mg · score 30 eliminate',                              'ACV 1 ช้อนก่อนกิน · Berberine 500mg×3',                              '2026-05-17'),
  (v_customer_id, 'vitamin_b_plus',          'นิวทริไลท์ วิตามินบี พลัส',                 'Nutrilite Vitamin B Plus',          '122304TH',     'avoid',       array['yeast_baker'],           array['eliminate'],             'Yeast powder 75mg/tab · ของเธอ score 81 (highest!)',                         'Methylated B-complex (Thorne, Pure Encapsulations) ไม่ใช่ yeast-derived', '2026-05-17'),

  -- 🟠 REDUCE FREQUENCY
  (v_customer_id, 'probiotic_w',             'นิวทริไลท์ โพรไบโอติก ดับเบิ้ลยู',           'Nutrilite Probiotic W',             '120571TH',     'reduce_freq', array['cranberry'],             array['reduce'],                'Cranberry 60mg/sachet · daily ใช้เกิน 1×/week limit',                       'จำกัด 1-2 ซอง/สัปดาห์ · หรือ Bio-Kult/Yakult (verify ingredients)',  '2026-05-17'),
  (v_customer_id, 'concentrated_fv',         'นิวทริไลท์ คอนเซ็นเทรต ผักและผลไม้รวมเข้มข้น', 'Nutrilite Concentrated F&V',        '102992TH',     'reduce_freq', array['orange'],                array['reduce'],                'Orange + lemon ใน blend · daily ใช้เกิน 1×/week',                            'สลับวัน · กิน 2-3 วัน/สัปดาห์',                                       '2026-05-17'),
  (v_customer_id, 'bio_c_plus',              'นิวทริไลท์ ไบโอซี พลัส',                    'Nutrilite Bio C Plus',              '109745TH',     'reduce_freq', array['orange'],                array['reduce'],                'Citrus bioflavonoids · daily ใช้เกิน 1×/week limit',                         'Liposomal Vit C จากเภสัช',                                          '2026-05-17'),

  -- 🟡 CAUTION (verify before use)
  (v_customer_id, 'xs_eaa_plus',             'เอ็กซ์เอส เอสเซนเชียล อะมิโน แอซิด พลัส+',     'XS Essential Amino Acid Plus',      '(check SKU)',  'caution',     array['corn'],                  array['eliminate'],             'Maltodextrin source ไม่ระบุ — มัก corn-derived (38 eliminate) · Soy isolate 250mg (soy not on list)', 'Verify maltodextrin source กับ Amway TH ก่อน',                       '2026-05-17'),
  (v_customer_id, 'lecithin_e',              'นิวทริไลท์ เลซิติน อี',                     'Nutrilite Lecithin E',              'A4445TH',      'caution',     array[]::text[],                array[]::text[],                'Walnut flavor — ไม่อยู่ใน N Health report · verify walnut ได้ test หรือไม่', 'Sunflower lecithin (non-Nutrilite) · ก่อนใช้ trial dose ครึ่งเม็ดก่อน', '2026-05-17'),
  (v_customer_id, 'bodykey',                 'บอดี้คีย์ บาย นิวทริไลท์',                   'BodyKey Meal Replacement',          'multi SKU',    'caution',     array[]::text[],                array[]::text[],                'มี chia (Lamiaceae · ไม่อยู่ใน list) · verify ว่า panel test chia ด้วย + check fortified vitamins source', 'ถามเธอ — เคยกิน chia โดยไม่มีอาการไหม',                                   '2026-05-17'),

  -- ✅ LIKELY SAFE
  (v_customer_id, 'triple_omega',            'นิวทริไลท์ ทริปเปิล โอเมก้า',                'Nutrilite Triple Omega',            '126132TH',     'safe',        array[]::text[],                array[]::text[],                'Fish oil (salmon/anchovy/sardine/mackerel) + chia oil refined · ไม่มีของใน list', 'ใช้ตามฉลาก 2 caps/day',                                              '2026-05-17'),
  (v_customer_id, 'garlic',                  'นิวทริไลท์ การ์ลิค',                        'Nutrilite Garlic',                  'A5923TH',      'safe',        array[]::text[],                array[]::text[],                'Garlic + Parsley + Watercress + Licorice — ไม่มีของใน list',                'ใช้ตามฉลาก',                                                       '2026-05-17'),
  (v_customer_id, 'spinach_plus',            'นิวทริไลท์ สปิแนช พลัส',                    'Nutrilite Spinach Plus',            'A5924TH',      'safe',        array[]::text[],                array[]::text[],                'Oyster shell + Spinach + Iron + Folate — ไม่มีของใน list',                  'ใช้ตามฉลาก',                                                       '2026-05-17'),
  (v_customer_id, 'mixed_collagen',          'นิวทริไลท์ คอลลาเจน',                       'Nutrilite Mixed Collagen Peptide',  '119293TH',     'safe',        array[]::text[],                array[]::text[],                'Marine collagen + Soybean peptide + Chrysanthemum — ไม่มีของใน list',         'ใช้ตามฉลาก',                                                       '2026-05-17'),
  (v_customer_id, 'cla_500',                 'นิวทริไลท์ CLA 500',                        'Nutrilite CLA 500',                 '102178TH',     'safe',        array[]::text[],                array[]::text[],                'Safflower oil-derived CLA + gelatin capsule · ไม่มีของใน list (Asteraceae family · safflower/sunflower ไม่อยู่ใน list)', 'ใช้ตามฉลาก 1-3 caps/day',                                            '2026-05-17');

  raise notice '✅ Seeded พิมพ์ปวีณ์ profile: customer + 1 test + 26 allergens + 16 supplement safety records';
end $$;

-- Verify:
-- select c.name, t.test_lab, t.tested_at, count(a.id) as allergens
--   from customers c
--   join customer_allergy_tests t on t.customer_id = c.id
--   left join customer_food_allergens a on a.test_id = t.id
--  where c.name = 'พิมพ์ปวีณ์ นิลสุพรรณ'
--  group by c.name, t.test_lab, t.tested_at;

-- select food_name_th, score, severity from customer_food_allergens
--  where customer_id = (select id from customers where name = 'พิมพ์ปวีณ์ นิลสุพรรณ')
--  order by score desc;

-- select product_th, status, conflicting_ingredients, reason from customer_supplement_safety
--  where customer_id = (select id from customers where name = 'พิมพ์ปวีณ์ นิลสุพรรณ')
--  order by case status when 'avoid' then 1 when 'reduce_freq' then 2 when 'caution' then 3 when 'safe' then 4 else 5 end;
