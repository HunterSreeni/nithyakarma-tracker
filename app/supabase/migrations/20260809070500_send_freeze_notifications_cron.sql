-- 10 minutes after decay-stale-streaks-daily (20:30 UTC) so every
-- freeze_events row from that run is already committed by the time this
-- fires. See migration 20260809070000 and functions/send-freeze-notifications.
select cron.schedule(
  'send-freeze-notifications-daily',
  '40 20 * * *',
  $$
  select net.http_post(
    url := 'https://fkrifejzhnhknkuyhjhp.supabase.co/functions/v1/send-freeze-notifications',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select value from public.app_config where key = 'cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
