-- Bug: current_streak (profiles/family_members/user_practices) was only ever
-- written from inside submit_practice_log, i.e. only when a day is completed
-- again. Go inactive and it just freezes at its last value forever - nothing
-- ever set it back to 0. Reported as "streak stays at 1 even after 2 days of
-- no input". get_leaderboard() reads the same raw columns, so this fixes the
-- leaderboard's stale streak display too.
--
-- decay_stale_streaks() mirrors the exact same "is this streak still alive"
-- boundary submit_practice_log/streak_after_completion already use, so a user
-- who logs in tomorrow sees consistent behavior either way:
--   - profiles/family_members: alive if last_complete_date is today or
--     yesterday, or exactly 2 days ago with a freeze credit still available
--     (the same gap streak_after_completion would bridge with a freeze).
--     Otherwise decayed to 0. Freeze credits are NOT spent here - only an
--     actual completion consumes a freeze, same as before.
--   - user_practices: alive if last_log_date is today, or the practice's own
--     prev_scheduled(cadence, today) - the same condition submit_practice_log
--     checks to decide whether to increment vs reset to 1.
--
-- Run once daily via pg_cron rather than computed live per-request, matching
-- the "streaks are maintained server-side" convention (useToday.js). A single
-- fixed UTC time is an approximation for a global user base - chosen at
-- 20:30 UTC (~02:00 IST) since the userbase is India-centric, well clear of
-- midnight IST. The existing ±1 day local-date tolerance elsewhere in this
-- RPC already accepts this class of slop.
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

select cron.schedule(
  'decay-stale-streaks-daily',
  '30 20 * * *',
  $$select public.decay_stale_streaks()$$
);
