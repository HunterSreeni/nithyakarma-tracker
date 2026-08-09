-- Bug: decay_stale_streaks() (20260802093000) protects a streak from
-- resetting when a freeze credit is available, but never actually spends
-- the credit, and nothing tells the user it happened. That leaves
-- freeze_credits and current_streak both looking untouched the morning
-- after a missed day - which reads as "the freeze didn't do anything",
-- and contradicts the Intent 1.1 spec (docs/UPGRADE-PLAN.md): "auto-
-- consumed on a single missed day". Reported as a bug from internal
-- testing 2026-08-09.
--
-- Fix: after the existing decay UPDATEs run (unchanged - they still decide
-- who gets protected vs reset, using freeze_credits as it was before this
-- migration touches it), spend one freeze credit for exactly the rows that
-- got protected and log a freeze_events row so a notification can be sent.
-- Ordering matters: the decay UPDATEs must run first, since they use
-- freeze_credits > 0 as part of deciding what to protect - decrementing
-- first would make a just-protected row look decay-eligible again.

create table public.freeze_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  family_member_id uuid references public.family_members(id) on delete cascade,
  applied_date date not null default current_date,
  streak_preserved int not null,
  created_at timestamptz not null default now()
);
alter table public.freeze_events enable row level security;
create policy "own freeze events select" on public.freeze_events for select
  using (owner_id = auth.uid());

create or replace function public.decay_stale_streaks() returns void
language plpgsql security definer set search_path = public as $$
begin
  update profiles
  set current_streak = 0
  where current_streak > 0
    and last_complete_date is distinct from current_date
    and last_complete_date is distinct from current_date - 1
    and not (last_complete_date = current_date - 2 and freeze_credits > 0);

  update family_members
  set current_streak = 0
  where current_streak > 0
    and last_complete_date is distinct from current_date
    and last_complete_date is distinct from current_date - 1
    and not (last_complete_date = current_date - 2 and freeze_credits > 0);

  update user_practices up
  set current_streak = 0
  from practices pr
  where pr.id = up.practice_id
    and up.current_streak > 0
    and up.last_log_date is distinct from current_date
    and up.last_log_date is distinct from prev_scheduled(pr.cadence, current_date);

  -- Spend a freeze credit for whoever the updates above just protected
  -- (still has a streak, missed exactly one day, had a credit to give).
  insert into freeze_events (owner_id, family_member_id, applied_date, streak_preserved)
  select id, null, current_date, current_streak from profiles
  where current_streak > 0
    and last_complete_date = current_date - 2
    and freeze_credits > 0;

  update profiles
  set freeze_credits = freeze_credits - 1
  where current_streak > 0
    and last_complete_date = current_date - 2
    and freeze_credits > 0;

  insert into freeze_events (owner_id, family_member_id, applied_date, streak_preserved)
  select parent_id, id, current_date, current_streak from family_members
  where current_streak > 0
    and last_complete_date = current_date - 2
    and freeze_credits > 0;

  update family_members
  set freeze_credits = freeze_credits - 1
  where current_streak > 0
    and last_complete_date = current_date - 2
    and freeze_credits > 0;
end
$$;

revoke execute on function public.decay_stale_streaks() from anon, authenticated, public;

-- New push slot for the "your streak was saved" notification.
alter table public.notification_deliveries drop constraint notification_deliveries_slot_check;
alter table public.notification_deliveries
  add constraint notification_deliveries_slot_check
  check (slot = any (array['morning'::text, 'afternoon'::text, 'evening'::text, 'nudge'::text,
    'nudge_morning'::text, 'tharpanam'::text, 'observance'::text, 'observance_advance'::text,
    'freeze_applied'::text]));
