-- Whole-database backup / restore (docs/PRD-UPLabs.md §5.10). Three SECURITY DEFINER
-- helpers callable by the service role only, plus a private Storage bucket for
-- scheduled snapshots. DDL is not backed up here — supabase/migrations/ IS the schema.

create or replace function public.backup_catalog()
returns table(table_name text, est_rows bigint, pk_columns text[], fk_parents text[], columns text[])
language sql security definer set search_path = public as $$
  select c.relname::text,
         greatest(c.reltuples::bigint, 0),
         coalesce((select array_agg(a.attname::text order by k.n)
                   from pg_index i
                   join lateral unnest(i.indkey) with ordinality k(attnum, n) on true
                   join pg_attribute a on a.attrelid = i.indrelid and a.attnum = k.attnum
                   where i.indrelid = c.oid and i.indisprimary), '{}'::text[]),
         coalesce((select array_agg(distinct pc.relname::text)
                   from pg_constraint f join pg_class pc on pc.oid = f.confrelid
                   where f.conrelid = c.oid and f.contype = 'f' and pc.relnamespace = c.relnamespace and pc.oid <> c.oid), '{}'::text[]),
         (select array_agg(a.attname::text order by a.attnum) from pg_attribute a where a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped)
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r','p')
  order by 1;
$$;

-- Replace-mode restore: empty one table. No CASCADE — a table that is still referenced
-- refuses, which is the safe failure.
create or replace function public.backup_clear_table(t text)
returns bigint language plpgsql security definer set search_path = public as $$
declare n bigint;
begin
  if not exists (select 1 from pg_class c join pg_namespace ns on ns.oid = c.relnamespace where ns.nspname = 'public' and c.relname = t and c.relkind in ('r','p')) then
    raise exception 'unknown table %', t;
  end if;
  execute format('delete from public.%I', t);
  get diagnostics n = row_count;
  return n;
end $$;

-- After restoring serial/bigserial tables, move every public sequence past the max id.
create or replace function public.backup_reset_sequences()
returns int language plpgsql security definer set search_path = public as $$
declare r record; n int := 0;
begin
  for r in
    select s.relname as seq, t.relname as tbl, a.attname as col
    from pg_class s
    join pg_depend d on d.objid = s.oid and d.deptype = 'a'
    join pg_class t on t.oid = d.refobjid
    join pg_attribute a on a.attrelid = t.oid and a.attnum = d.refobjsubid
    join pg_namespace ns on ns.oid = s.relnamespace
    where s.relkind = 'S' and ns.nspname = 'public'
  loop
    execute format('select setval(%L, coalesce((select max(%I) from public.%I), 0) + 1, false)', 'public.' || r.seq, r.col, r.tbl);
    n := n + 1;
  end loop;
  return n;
end $$;

revoke all on function public.backup_catalog() from public, anon, authenticated;
revoke all on function public.backup_clear_table(text) from public, anon, authenticated;
revoke all on function public.backup_reset_sequences() from public, anon, authenticated;
grant execute on function public.backup_catalog() to service_role;
grant execute on function public.backup_clear_table(text) to service_role;
grant execute on function public.backup_reset_sequences() to service_role;

insert into storage.buckets (id, name, public, file_size_limit)
values ('db-backups', 'db-backups', false, 209715200)
on conflict (id) do nothing;
