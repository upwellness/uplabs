-- Google Fit REST API ends in 2026 → UP Pulse connects through the Google Health API
-- (Fitbit / Pixel Watch cloud data) as provider 'google_health'. Existing google_fit rows
-- stay readable until Google turns them off.
alter table public.pulse_connections drop constraint if exists pulse_connections_provider_check;
alter table public.pulse_connections add constraint pulse_connections_provider_check
  check (provider in ('google_fit','google_health','fitbit','apple_manual','whoop','whoop_csv'));
