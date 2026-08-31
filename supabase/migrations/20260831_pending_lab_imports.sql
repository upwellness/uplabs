-- Lab results read off a document by an AI land here first, not in the patient record.
--
-- Why a queue and not a direct write: an LLM transcribing a lab slip misreads things —
-- scanned or skewed pages, digits that run together (0.83 / 083), Buddhist years in a
-- Gregorian field, mg/dL vs mmol/L, a row read one line off. Written straight into
-- customer_lab_values those numbers become indistinguishable from ones a human typed,
-- and they then flow into the Longevity report, PhenoAge and every trend chart with
-- nobody ever seeing that the read was wrong.
--
-- So: submit → a person compares against the actual slip → approve. Still far faster
-- than typing, because reviewing is not transcribing.

create table if not exists public.pending_lab_imports (
  id            uuid primary key default gen_random_uuid(),
  customer_id   uuid not null references public.customers(id) on delete cascade,
  status        text not null default 'pending'
                check (status in ('pending', 'approved', 'rejected')),
  recorded_at   date,
  source        text,
  notes         text,
  values        jsonb not null default '[]',
  raw_text      text,
  source_file_url text,
  submitted_via text,
  token_id      uuid references public.api_tokens(id) on delete set null,
  submitted_by  uuid references auth.users(id) on delete set null,
  submitted_at  timestamptz not null default now(),
  reviewed_by   uuid references auth.users(id) on delete set null,
  reviewed_at   timestamptz,
  review_note   text,
  record_id     uuid references public.customer_records(id) on delete set null
);

create index if not exists pending_lab_imports_pending_idx
  on public.pending_lab_imports(customer_id, submitted_at desc) where status = 'pending';
create index if not exists pending_lab_imports_status_idx
  on public.pending_lab_imports(status, submitted_at desc);

comment on table public.pending_lab_imports is
  'Lab values awaiting human confirmation before they enter the patient record. Nothing here is part of a customer''s history until approved.';
comment on column public.pending_lab_imports.raw_text is
  'What the submitter read off the document, verbatim. The reviewer compares this against the real slip — structured values alone hide a misread.';

alter table public.pending_lab_imports enable row level security;

-- Same reach as the customer: owner, co-coach, upline, admin.
drop policy if exists "pending_labs_admin_all" on public.pending_lab_imports;
create policy "pending_labs_admin_all" on public.pending_lab_imports
  for all using (my_role() = 'admin') with check (my_role() = 'admin');

drop policy if exists "pending_labs_owner" on public.pending_lab_imports;
create policy "pending_labs_owner" on public.pending_lab_imports
  for all using (exists (select 1 from public.customers c
    where c.id = pending_lab_imports.customer_id and c.coach_id = auth.uid()))
  with check (exists (select 1 from public.customers c
    where c.id = pending_lab_imports.customer_id and c.coach_id = auth.uid()));

drop policy if exists "pending_labs_assigned" on public.pending_lab_imports;
create policy "pending_labs_assigned" on public.pending_lab_imports
  for all using (exists (select 1 from public.customer_assignments a
    where a.customer_id = pending_lab_imports.customer_id and a.user_id = auth.uid()))
  with check (exists (select 1 from public.customer_assignments a
    where a.customer_id = pending_lab_imports.customer_id and a.user_id = auth.uid()));

drop policy if exists "pending_labs_downline" on public.pending_lab_imports;
create policy "pending_labs_downline" on public.pending_lab_imports
  for all using (exists (select 1 from public.customers c
    where c.id = pending_lab_imports.customer_id
      and c.coach_id in (select profile_descendant_ids(auth.uid()))))
  with check (exists (select 1 from public.customers c
    where c.id = pending_lab_imports.customer_id
      and c.coach_id in (select profile_descendant_ids(auth.uid()))));
