-- Ported from the Sandhyavandhanam push architecture.

create table public.notification_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  enabled boolean not null default false,
  timezone text not null default 'Asia/Kolkata',
  updated_at timestamptz not null default now()
);
alter table public.notification_preferences enable row level security;
create policy "own prefs all" on public.notification_preferences for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text unique not null,
  p256dh text,
  auth_key text,
  platform text not null default 'web' check (platform in ('web', 'android')),
  created_at timestamptz not null default now()
);
create index idx_push_subs_user_platform on public.push_subscriptions(user_id, platform);
alter table public.push_subscriptions enable row level security;
create policy "own subs all" on public.push_subscriptions for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Dedupe: the cron function runs every 15 min; never send the same slot twice per local day.
create table public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  reminder_date date not null,
  slot text not null check (slot in ('morning', 'afternoon', 'evening', 'nudge')),
  endpoint text not null,
  sent_at timestamptz not null default now(),
  unique (user_id, reminder_date, slot, endpoint)
);
alter table public.notification_deliveries enable row level security;
create policy "own deliveries select" on public.notification_deliveries for select
  using (user_id = auth.uid());

-- Private config for the edge function (VAPID keys, cron secret, optional FCM
-- service account). Service-role only: RLS on, zero policies, no grants.
create table public.app_config (
  key text primary key,
  value text not null
);
alter table public.app_config enable row level security;
revoke all on public.app_config from anon, authenticated;

insert into public.app_config (key, value) values
  ('vapid_public_key', 'BPoCr2JjwLJ_Bj3GgPmSJ6Nj47Cg-JrC5fbntgtjxV04wtrq2ZNyAHLbPaiMcw-RYRTCpKmJm_RuBc2U3Z7L2ik'),
  ('vapid_private_key', 'X3QbdHYjMaJ31SBHit7f3Wn7dW5g1Db5YFUSOjfzXcc'),
  ('vapid_email', 'mailto:huntersreenihs@gmail.com'),
  ('cron_secret', 'd36493d87bea98316550e265a027d91cca5f307f29f3ec63');
-- ('fcm_service_account_b64', '<base64 of Firebase service account JSON - user adds later>')

grant select, insert, update, delete on
  public.notification_preferences, public.push_subscriptions,
  public.notification_deliveries, public.app_config to service_role;