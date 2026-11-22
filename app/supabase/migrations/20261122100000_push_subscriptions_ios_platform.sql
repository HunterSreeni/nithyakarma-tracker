-- iOS push (Sreeni, 2026-11-22): iPhones register an FCM token through the same
-- Capacitor push plugin as Android, saved with platform 'ios' so send-reminders
-- and send-test-notification route it through sendFCM. The check otherwise
-- rejected every iPhone row.
alter table public.push_subscriptions drop constraint push_subscriptions_platform_check;
alter table public.push_subscriptions add constraint push_subscriptions_platform_check
  check (platform in ('web', 'android', 'ios'));
