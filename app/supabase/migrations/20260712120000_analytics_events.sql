-- Intent 1.3: first-party analytics. Events live in our own Postgres (no
-- third-party analytics vendor). No PII in props - event names + numeric/flag
-- props only. Users may insert their own events; reads are for the service role
-- (dashboards/queries) only, never exposed to anon/authenticated.
create table if not exists public.analytics_events (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete set null,
  event text not null,
  props jsonb not null default '{}',
  platform text,
  created_at timestamptz not null default now()
);

alter table public.analytics_events enable row level security;

-- Authenticated users can only insert rows attributed to themselves.
create policy "insert own analytics events" on public.analytics_events
  for insert to authenticated
  with check (user_id = auth.uid());

grant insert on public.analytics_events to authenticated;

-- Query helpers for funnel/retention dashboards (run as service role).
create index if not exists idx_analytics_events_event_time
  on public.analytics_events (event, created_at);
create index if not exists idx_analytics_events_user_time
  on public.analytics_events (user_id, created_at);
