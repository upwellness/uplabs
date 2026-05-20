-- ════════════════════════════════════════════════════════════════
-- Customer Allergies & Food Sensitivity — IgG/IgE test results
-- ════════════════════════════════════════════════════════════════
-- Pattern follows customer_records + customer_lab_values (proven pattern)
-- Plus a "supplement safety" table for cached allergy-vs-product analysis

-- ─── Table 1: Allergy test rounds (one per test result/report) ─────
create table if not exists public.customer_allergy_tests (
  id              uuid primary key default gen_random_uuid(),
  customer_id     uuid not null references public.customers(id) on delete cascade,
  test_type       text not null,        -- 'IgG' / 'IgE' / 'skin_prick' / 'patch'
  test_lab        text,                  -- 'N Health' / 'ImuPro' / 'ALCAT' / 'Hospital'
  test_name       text,                  -- 'Food Sensitivity 220 panel'
  panel_size      int,                   -- e.g. 220 (foods tested)
  tested_at       date not null,
  source_url      text,                  -- link to scan/photo of report
  raw_text        text,                  -- full OCR / notes
  notes           text,
  created_at      timestamptz not null default now(),
  created_by      uuid references auth.users(id)
);

create index if not exists idx_allergy_tests_customer
  on public.customer_allergy_tests(customer_id, tested_at desc);

-- ─── Table 2: Individual food allergen findings ────────────────────
create table if not exists public.customer_food_allergens (
  id              uuid primary key default gen_random_uuid(),
  test_id         uuid not null references public.customer_allergy_tests(id) on delete cascade,
  customer_id     uuid not null references public.customers(id) on delete cascade,
  food_key        text not null,         -- 'yeast_baker', 'pea', 'milk_cow' (snake_case)
  food_name_th    text,                  -- 'ยีสต์สำหรับทำขนมปัง'
  food_name_en    text,                  -- 'Yeast (Baker''s)'
  food_category   text,                  -- 'grain' / 'dairy' / 'nut' / 'seed' / 'legume' / 'fruit' / 'vegetable' / 'meat' / 'seafood' / 'fungus' / 'spice'
  score           numeric,               -- IgG titer · +/- for IgE
  severity        text,                  -- 'eliminate' (>= 30 IgG) / 'reduce' (20-29) / 'within_limit' (<20) / 'positive' / 'negative'
  recommended_action text,                -- 'avoid 3-6 months' / 'max 1x/week' / 'normal use'
  tested_at       date not null,
  notes           text,
  created_at      timestamptz not null default now()
);

create index if not exists idx_food_allergens_customer
  on public.customer_food_allergens(customer_id, severity, tested_at desc);
create index if not exists idx_food_allergens_food
  on public.customer_food_allergens(food_key, customer_id);

-- ─── Table 3: Supplement safety mapping (per-customer cached) ──────
create table if not exists public.customer_supplement_safety (
  id              uuid primary key default gen_random_uuid(),
  customer_id     uuid not null references public.customers(id) on delete cascade,
  product_key     text not null,         -- 'all_plant_protein' / 'xs_eaa_plus'
  product_th      text,
  product_en      text,
  sku_id          text,
  status          text not null,         -- 'safe' / 'caution' / 'reduce_freq' / 'avoid' / 'unknown'
  conflicting_ingredients text[],         -- ['wheat', 'pea']
  conflict_severity text[],               -- ['eliminate', 'eliminate']
  reason          text,
  alternative_product text,               -- e.g. 'Hemp/Rice protein'
  notes           text,
  verified_at     date not null default current_date,
  verified_by     uuid references auth.users(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_supp_safety_customer
  on public.customer_supplement_safety(customer_id, status);
create unique index if not exists uq_supp_safety_customer_product
  on public.customer_supplement_safety(customer_id, product_key);

-- ─── RLS ───────────────────────────────────────────────────────────
alter table public.customer_allergy_tests       enable row level security;
alter table public.customer_food_allergens      enable row level security;
alter table public.customer_supplement_safety   enable row level security;

drop policy if exists allergy_tests_admin       on public.customer_allergy_tests;
drop policy if exists allergy_tests_own         on public.customer_allergy_tests;
drop policy if exists food_allergens_admin      on public.customer_food_allergens;
drop policy if exists food_allergens_own        on public.customer_food_allergens;
drop policy if exists supp_safety_admin         on public.customer_supplement_safety;
drop policy if exists supp_safety_own           on public.customer_supplement_safety;

create policy allergy_tests_admin       on public.customer_allergy_tests
  for all using (public.my_role() = 'admin');
create policy food_allergens_admin      on public.customer_food_allergens
  for all using (public.my_role() = 'admin');
create policy supp_safety_admin         on public.customer_supplement_safety
  for all using (public.my_role() = 'admin');

create policy allergy_tests_own on public.customer_allergy_tests
  for all using (exists (select 1 from public.customers c where c.id = customer_allergy_tests.customer_id and c.coach_id = auth.uid()));

create policy food_allergens_own on public.customer_food_allergens
  for all using (exists (select 1 from public.customers c where c.id = customer_food_allergens.customer_id and c.coach_id = auth.uid()));

create policy supp_safety_own on public.customer_supplement_safety
  for all using (exists (select 1 from public.customers c where c.id = customer_supplement_safety.customer_id and c.coach_id = auth.uid()));

-- Verify:
--   select count(*) from public.customer_allergy_tests;
--   select count(*) from public.customer_food_allergens;
--   select count(*) from public.customer_supplement_safety;
