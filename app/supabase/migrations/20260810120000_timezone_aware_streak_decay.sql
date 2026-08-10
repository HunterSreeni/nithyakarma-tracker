-- Make streak decay evaluate each subject against ITS OWN local day.
--
-- The bug: submit_practice_log stores last_complete_date from the client's
-- LOCAL date (p_local_date), but decay_stale_streaks() compared it against
-- Postgres' UTC current_date. Two different calendars, compared as if they were
-- one. No choice of cron hour fixes this - it only moves which offsets are
-- wrong, because at any single UTC instant different zones are on different
-- calendar days. 20:30 UTC was wrong for IST (a day too lenient); 01:00 UTC,
-- which replaced it yesterday, is right for positive offsets but zeroes a live
-- streak a day early for anyone west of UTC.
--
-- The fix is to stop asking "what is today?" globally. profiles.timezone
-- becomes the per-subject source of truth; family_members inherit their
-- parent's and user_practices their owner's, since neither has a device of its
-- own. The cron then has to run HOURLY rather than daily, because local
-- midnights land at different UTC hours - the UPDATEs are idempotent (they only
-- zero streaks that are already stale), so an hourly pass simply catches each
-- subject within an hour of its own threshold.

alter table public.profiles add column if not exists timezone text;

-- Backfill, most specific first. notification_preferences already holds a real
-- device-reported zone for everyone who ever enabled notifications.
update public.profiles p
set timezone = n.timezone
from public.notification_preferences n
where n.user_id = p.id
  and n.timezone is not null and n.timezone <> ''
  and p.timezone is null;

-- Confirmed by Sreeni 2026-08-10: these three are in the UAE. The rest of the
-- accounts with no notification_preferences row are India.
update public.profiles set timezone = 'Asia/Dubai'
where timezone is null
  and id in (select id from auth.users where email in (
    'harirams345@gmail.com',
    'govindaviswanathan@gmail.com',
    'cvrkrishnan@gmail.com'
  ));

update public.profiles set timezone = 'Asia/Kolkata' where timezone is null;

alter table public.profiles alter column timezone set default 'Asia/Kolkata';
alter table public.profiles alter column timezone set not null;

-- Current date in a given IANA zone. plpgsql with a handler rather than plain
-- SQL on purpose: `now() at time zone <garbage>` RAISES, and because decay runs
-- as one set-based UPDATE, a single bad row would abort the run for every user
-- on the platform. A bad zone must degrade to the default, never throw.
create or replace function public.local_today(p_tz text) returns date
language plpgsql stable set search_path = public as $$
begin
  return (now() at time zone coalesce(nullif(p_tz, ''), 'Asia/Kolkata'))::date;
exception when others then
  return (now() at time zone 'Asia/Kolkata')::date;
end $$;

revoke execute on function public.local_today(text) from anon, authenticated, public;

create or replace function public.decay_stale_streaks() returns void
language plpgsql security definer set search_path = public as $$
begin
  update profiles p
  set current_streak = 0
  where p.current_streak > 0
    and p.last_complete_date is distinct from local_today(p.timezone)
    and p.last_complete_date is distinct from local_today(p.timezone) - 1
    and not (p.last_complete_date = local_today(p.timezone) - 2 and p.freeze_credits > 0);

  -- A child has no device of its own; the parent marks on its behalf, so the
  -- parent's zone is the one its local_date was written in.
  update family_members fm
  set current_streak = 0
  from profiles parent
  where parent.id = fm.parent_id
    and fm.current_streak > 0
    and fm.last_complete_date is distinct from local_today(parent.timezone)
    and fm.last_complete_date is distinct from local_today(parent.timezone) - 1
    and not (fm.last_complete_date = local_today(parent.timezone) - 2 and fm.freeze_credits > 0);

  update user_practices up
  set current_streak = 0
  from practices pr, profiles owner
  where pr.id = up.practice_id
    and owner.id = up.owner_id
    and up.current_streak > 0
    and up.last_log_date is distinct from local_today(owner.timezone)
    and up.last_log_date is distinct from prev_scheduled(pr.cadence, local_today(owner.timezone));
end
$$;

revoke execute on function public.decay_stale_streaks() from anon, authenticated, public;

-- Daily can no longer serve every zone from one instant, so go hourly and let
-- each subject fall due on its own local boundary. Renamed off '-daily' so the
-- job name does not lie about its schedule.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'decay-stale-streaks-daily') then
    perform cron.unschedule('decay-stale-streaks-daily');
  end if;
end $$;

select cron.schedule(
  'decay-stale-streaks-hourly',
  '0 * * * *',
  $$select public.decay_stale_streaks()$$
);
