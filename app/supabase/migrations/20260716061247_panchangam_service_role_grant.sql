-- Same root cause as 20260711122657_service_role_read_grants.sql: the
-- sb_secret_ service_role key does not bypass table GRANTs. The seed-table
-- edge function needs insert on panchangam_days to load the generated dataset.
grant select, insert, update on public.panchangam_days to service_role;
