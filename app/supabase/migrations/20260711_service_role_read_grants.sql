-- ROOT CAUSE FIX for reminders never sending.
-- The send-reminders edge function authenticates with an sb_secret_ API key
-- that resolves to the service_role Postgres role. Unlike the legacy service_role
-- JWT, this role does NOT bypass table GRANTs. The core app tables were never
-- granted to service_role, so the function got "permission denied for table
-- profiles / user_practices" (HTTP 403), read nothing, and sent 0 reminders.
-- Grant the reads the function needs (writes to notification tables already work).
grant select on
  public.profiles,
  public.user_practices,
  public.practices,
  public.practice_logs
to service_role;
