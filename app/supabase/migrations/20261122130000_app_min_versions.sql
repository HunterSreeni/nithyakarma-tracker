-- Update prompts (Sreeni, 2026-11-22). One row per native platform. The app
-- compares its INSTALLED version (Capacitor App.getInfo) with these:
--   below suggested_version -> a dismissible "New version available" card
--   below required_version  -> a blocking "Please update" screen (only for a
--                              build that truly breaks; Apple review risk)
-- Both start at 0.0.0, so nothing shows until an operator raises one with SQL.
-- The client check is a nudge, not enforcement: an old build can still call
-- the API. Anyone may read the row (the check runs before sign-in); nobody but
-- the service role may write it.
create table public.app_min_versions (
  platform text primary key check (platform in ('android', 'ios')),
  suggested_version text not null default '0.0.0' check (suggested_version ~ '^\d+\.\d+\.\d+$'),
  required_version text not null default '0.0.0' check (required_version ~ '^\d+\.\d+\.\d+$'),
  store_url text not null check (store_url ~ '^https://'),
  updated_at timestamptz not null default now()
);

alter table public.app_min_versions enable row level security;
create policy "app_min_versions readable by everyone" on public.app_min_versions
  for select to anon, authenticated using (true);

revoke all on table public.app_min_versions from anon, authenticated;
grant select on table public.app_min_versions to anon, authenticated;
grant all on table public.app_min_versions to service_role;

insert into public.app_min_versions (platform, store_url) values
  ('android', 'https://play.google.com/store/apps/details?id=org.nithyakarma.app'),
  ('ios', 'https://apps.apple.com/app/id6837318179');
