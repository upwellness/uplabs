-- Customer-facing BCA result page (/r/bca/<token>): one share token per scan, issued by the
-- coach from /v2/bca. Rotating a customer's portal token does not touch these — a scan link
-- is a one-off "here is your result" message, revocable by clearing the column.
alter table public.measurements add column if not exists share_token text unique;
alter table public.measurements add column if not exists share_opened_at timestamptz;
create index if not exists measurements_share_token on public.measurements (share_token) where share_token is not null;
