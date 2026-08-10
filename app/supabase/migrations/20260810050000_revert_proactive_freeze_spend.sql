-- Reverts the proactive freeze spend added yesterday in 20260809070000.
--
-- Bug it caused: decay_stale_streaks() decremented freeze_credits for every
-- streak it protected, but nothing recorded that the gap had been bridged.
-- streak_after_completion() still decides purely from last_complete_date and
-- still needs a credit to bridge a 2-day gap, so the credit was spent and
-- bought nothing. Reproduced against production data (streak 4, last complete
-- 2026-08-07, credit spent by the 2026-08-09 decay run):
--
--   streak_after_completion(4, 4, '2026-08-07', '2026-08-10', 0)
--     -> new_streak = 1, freeze_used = false
--
-- i.e. the Today card kept displaying "4 days" while the next mark silently
-- reset it to 1, with the freeze already gone. The freeze push that was meant
-- to explain the spend never arrived either (freeze_events had no service_role
-- SELECT grant, and the sender discarded the error), so the whole thing was
-- invisible.
--
-- Correct model, matching Intent 1.1 ("one freeze = one day") and the
-- pre-existing submit_practice_log behaviour: a freeze is consumed when the
-- user actually comes back and completes a day across a 1-day gap. Nothing is
-- spent on behalf of someone who never returns. decay_stale_streaks() goes
-- back to purely deciding alive-vs-reset (its 20260802093000 body), and the
-- "you are about to need a freeze" / "a freeze is holding your streak"
-- messages move into send-reminders, which is already per-user timezone aware
-- and runs every 15 minutes - so they land at 20:00 and 08:00 *local*, not at
-- 02:10 IST like the dedicated cron did.
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
end
$$;

revoke execute on function public.decay_stale_streaks() from anon, authenticated, public;

drop table if exists public.freeze_events;

-- 'freeze_applied' was only ever written by send-freeze-notifications, which is
-- deleted alongside this migration. Zero rows were ever inserted with it
-- (the sender never got that far), so dropping it from the CHECK is safe.
alter table public.notification_deliveries drop constraint notification_deliveries_slot_check;
alter table public.notification_deliveries
  add constraint notification_deliveries_slot_check
  check (slot = any (array['morning'::text, 'afternoon'::text, 'evening'::text, 'nudge'::text,
    'nudge_morning'::text, 'tharpanam'::text, 'observance'::text, 'observance_advance'::text]));

do $$
begin
  if exists (select 1 from cron.job where jobname = 'send-freeze-notifications-daily') then
    perform cron.unschedule('send-freeze-notifications-daily');
  end if;
end $$;

-- decay ran at 20:30 UTC, which is 02:00 IST *the next day* - so Postgres
-- current_date was a full calendar day behind the local date every user's
-- last_complete_date is recorded in (submit_practice_log stores p_local_date).
-- Every branch above was therefore one day too lenient, and a reset landed a
-- day late. 01:00 UTC is 06:30 IST / 05:00 Gulf, early in the local day and
-- comfortably inside the window where the UTC date and the local date agree
-- for this India-centric userbase.
select cron.schedule(
  'decay-stale-streaks-daily',
  '0 1 * * *',
  $$select public.decay_stale_streaks()$$
);
