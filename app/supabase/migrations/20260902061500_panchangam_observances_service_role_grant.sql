-- ROOT CAUSE FIX, part 2, for the same push-notification outage as
-- 20260902060000_family_members_service_role_grant.sql.
--
-- Fixing the family_members grant let send-reminders get further (it started
-- flushing backlogged retryable deliveries again), but every run still threw
-- 42501 on the very next unaudited table it reads: panchangam_observances,
-- used to match tharpanam/observance-day reminders. Also never swept into a
-- service_role grant since creation.
--
-- Audited every table send-reminders/_shared touches this time
-- (app_config, family_members, notification_deliveries,
-- notification_preferences, panchangam_days, panchangam_observances,
-- practice_logs, profiles, push_subscriptions, streak_events,
-- user_practices) - this was the only one still missing SELECT.
grant select on
  public.panchangam_observances
to service_role;
