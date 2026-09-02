-- ROOT CAUSE FIX for push notifications (and any downstream streak-freeze
-- logic in send-reminders) silently dying since 2026-08-19.
--
-- The Aug 19 send-reminders deploy added a direct
-- supabase.from("family_members").select("id, name") read (to label
-- streak-event pushes with the family member's name). family_members was
-- created in core_schema (2026-07-07) but, unlike profiles/user_practices/
-- practices/practice_logs (see service_role_read_grants.sql), it was never
-- swept into a service_role grant. Every cron run since has failed with
-- "permission denied for table family_members" (42501) before it could write
-- any notification_deliveries row or send a single push - a total outage
-- across all users, not just one.
grant select on
  public.family_members
to service_role;
