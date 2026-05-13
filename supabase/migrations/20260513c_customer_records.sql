-- ════════════════════════════════════════════════════════════════
-- Customer Medical Records — lab results + imaging history
-- ════════════════════════════════════════════════════════════════

-- One row per visit/checkup round
create table if not exists public.customer_records (
  id            uuid primary key default gen_random_uuid(),
  customer_id   uuid not null references public.customers(id) on delete cascade,
  recorded_at   date not null,
  source        text,         -- 'Paolo Hospital', 'Bangkok Hospital', etc
  source_id     text,          -- e.g. HN R-62-031476
  document_type text default 'lab',  -- lab / annual_physical / imaging / other
  notes         text,
  raw_text      text,          -- full OCR/raw notes for search
  created_at    timestamptz not null default now(),
  created_by    uuid references auth.users(id)
);

create index if not exists idx_customer_records_customer  on public.customer_records(customer_id, recorded_at desc);

-- Each individual lab value (denormalized customer_id for fast filter)
create table if not exists public.customer_lab_values (
  id              uuid primary key default gen_random_uuid(),
  record_id       uuid not null references public.customer_records(id) on delete cascade,
  customer_id     uuid not null references public.customers(id) on delete cascade,
  category        text not null,        -- cbc / lipid / kidney / glucose / thyroid / uric / hepatitis / cancer / imaging / liver / cardiac / vitamin
  metric_key      text not null,        -- 'wbc', 'hba1c', 'hb', 'ldl', 'chest_xray'
  metric_label_th text,
  metric_label_en text,
  value           text,                  -- text to allow 'Positive', '>1000', 'Normal'
  value_num       numeric,               -- parsed numeric (for trending)
  unit            text,
  ref_low         numeric,
  ref_high        numeric,
  ref_text        text,                  -- non-numeric reference
  status          text,                  -- normal / low / high / borderline / critical / unknown
  recorded_at     date not null,         -- denormalized from record
  created_at      timestamptz not null default now()
);

create index if not exists idx_lab_values_customer_metric  on public.customer_lab_values(customer_id, metric_key, recorded_at desc);
create index if not exists idx_lab_values_customer_cat     on public.customer_lab_values(customer_id, category,   recorded_at desc);

-- RLS
alter table public.customer_records    enable row level security;
alter table public.customer_lab_values enable row level security;

drop policy if exists records_admin     on public.customer_records;
drop policy if exists records_own       on public.customer_records;
drop policy if exists lab_values_admin  on public.customer_lab_values;
drop policy if exists lab_values_own    on public.customer_lab_values;

create policy records_admin    on public.customer_records    for all using (public.my_role() = 'admin');
create policy lab_values_admin on public.customer_lab_values for all using (public.my_role() = 'admin');

create policy records_own on public.customer_records
  for all using (exists (select 1 from public.customers c where c.id = customer_records.customer_id and c.coach_id = auth.uid()));

create policy lab_values_own on public.customer_lab_values
  for all using (exists (select 1 from public.customers c where c.id = customer_lab_values.customer_id and c.coach_id = auth.uid()));

-- Verify:
--   select count(*) from public.customer_records;
--   select count(*) from public.customer_lab_values;
