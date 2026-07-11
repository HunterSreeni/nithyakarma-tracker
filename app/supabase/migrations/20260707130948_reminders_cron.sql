create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Every 15 minutes; the function's per-timezone windows + deliveries table
-- ensure each user gets each reminder at most once per local day.
select cron.schedule(
  'send-reminders-every-15min',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := 'https://fkrifejzhnhknkuyhjhp.supabase.co/functions/v1/send-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select value from public.app_config where key = 'cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);