-- Keep the last per-data-type errors from a Google Health sync so a "0 readings" result
-- can be diagnosed from the DB (the API returns them, the UI used to drop them).
alter table pulse_connections add column if not exists last_sync_error text;
