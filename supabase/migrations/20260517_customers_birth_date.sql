-- Add birth_date (full DOB) to customers table
-- Keeps existing birth_year for backwards compatibility
-- birth_year is auto-derived from birth_date when both present (via trigger)

alter table public.customers
  add column if not exists birth_date date;

-- Backfill birth_date from birth_year (Jan 1 of that year) where birth_date is null
update public.customers
   set birth_date = make_date(birth_year, 1, 1)
 where birth_date is null
   and birth_year is not null;

-- Trigger: when birth_date is set, sync birth_year
create or replace function public.sync_customer_birth_year()
returns trigger
language plpgsql
as $$
begin
  if new.birth_date is not null then
    new.birth_year := extract(year from new.birth_date)::int;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_customer_birth_year on public.customers;
create trigger trg_sync_customer_birth_year
  before insert or update of birth_date on public.customers
  for each row execute function public.sync_customer_birth_year();

-- Optional index for sorting/filtering by DOB
create index if not exists customers_birth_date_idx
  on public.customers (birth_date);

comment on column public.customers.birth_date is
  'Full date of birth (Gregorian / ค.ศ.). Stored as DATE. UI may display as พ.ศ. (year + 543). birth_year auto-synced via trigger.';
