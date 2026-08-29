-- Bind every API token to a user, and derive its reach from that user's CURRENT
-- standing rather than from text stored beside the credential.
--
-- Before: `customer_scope` was free text an admin typed ('all' / 'coach:<id>' /
-- 'list:<ids>') with nothing tying the token to a person. Three holes followed —
-- a token could have no owner at all, an 'all' token never re-checked whether its
-- owner was still an admin, and a 'list:' could name customers from outside the
-- coach's downline entirely.
--
-- After: reach = whatever `owner_user_id` can reach right now (role + position in
-- the profiles.parent_id tree), recomputed on every request. Moving a coach in the
-- hierarchy or demoting them takes effect on their next API call.

alter table public.api_tokens
  add column if not exists owner_user_id uuid references auth.users(id) on delete cascade;

update public.api_tokens
   set owner_user_id = coalesce(
         nullif(substring(customer_scope from '^coach:(.*)$'), '')::uuid,
         created_by)
 where owner_user_id is null;

-- a credential we cannot attribute to a person is revoked, never left wide open
update public.api_tokens
   set revoked_at = coalesce(revoked_at, now()),
       note = coalesce(note, '') || ' · เพิกถอนอัตโนมัติ: ไม่มีเจ้าของผูกไว้ (migration 20260829b)'
 where owner_user_id is null;

create index if not exists api_tokens_owner_idx on public.api_tokens(owner_user_id);

comment on column public.api_tokens.owner_user_id is
  'The user this token acts as. Reach is derived from this user''s CURRENT role and position in the profiles.parent_id tree on every request — never from the stored scope text alone.';
comment on column public.api_tokens.customer_scope is
  'owner = exactly what the owner can see (own + co-coached + whole downline) · all = every customer, honoured ONLY while the owner is still an admin · list:<uuid,...> = a subset, always intersected with the owner''s live reach';

-- the old coach:<id> form is meaningless now that ownership is explicit
update public.api_tokens set customer_scope = 'owner' where customer_scope like 'coach:%';
