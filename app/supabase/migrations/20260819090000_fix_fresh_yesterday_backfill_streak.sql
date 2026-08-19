-- AI-DEV NOTE: Yesterday's Sandhya catch-up is protected product logic.
-- Do not change its full-punya, one-day-only, daily-streak, or freeze-refund
-- behavior unless Sreeni explicitly requests it. Update AGENTS.md and the SQL
-- regression cases in the same commit if an authorized change is made.
--
-- Keep the established submit_practice_log state machine untouched. This
-- focused RPC delegates the save to it, then repairs the one missing state:
-- a subject with no live prior streak marks today first (streak 1), then fills
-- yesterday. With no freeze/restart event to repair, the old path stayed at 1
-- even though two consecutive calendar days are now complete.

create or replace function public.submit_yesterday_sandhya(
  p_user_practice_id uuid,
  p_slot text,
  p_count integer,
  p_local_date date
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_up record;
  v_pr record;
  v_owner_tz text;
  v_today date;
  v_result jsonb;
  v_subject_streak int;
  v_subject_best int;
  v_target_counting_logs int;
begin
  -- Serialize catch-up slots for the same practice and verify ownership before
  -- calling the existing authoritative write path.
  select * into v_up from user_practices
    where id = p_user_practice_id and owner_id = auth.uid()
    for update;
  if not found then raise exception 'Practice association not found'; end if;

  select * into v_pr from practices where id = v_up.practice_id;
  if not v_pr.is_sandhyavandhanam then
    raise exception 'Yesterday catch-up is only available for Sandhyavandhanam';
  end if;

  select timezone into v_owner_tz from profiles where id = v_up.owner_id;
  v_today := local_today(v_owner_tz);
  if p_local_date is distinct from v_today - 1 then
    raise exception 'Yesterday catch-up must use exactly the previous local date';
  end if;

  v_result := submit_practice_log(
    p_user_practice_id, p_slot, p_count, p_local_date, true
  );
  if not coalesce((v_result->>'saved')::boolean, false)
     or not coalesce((v_result->>'backdated')::boolean, false) then
    raise exception 'Yesterday Sandhya save could not be verified';
  end if;

  -- Exactly one streak-eligible log means this call completed yesterday for
  -- the first time. Later Sandhya slots and dates already completed by another
  -- practice must never add another overall streak day.
  select count(*) into v_target_counting_logs
    from practice_logs pl
    join user_practices up on up.id = pl.user_practice_id
    join practices pr on pr.id = up.practice_id
    where up.owner_id = v_up.owner_id
      and up.family_member_id is not distinct from v_up.family_member_id
      and pl.log_date = p_local_date
      and pl.counts_toward_streak
      and pr.affects_streak
      and is_scheduled(pr.cadence, pr.weekday, p_local_date);

  if v_up.family_member_id is null then
    select current_streak, best_streak
      into v_subject_streak, v_subject_best
      from profiles
      where id = v_up.owner_id and last_complete_date = v_today
      for update;

    if found and v_subject_streak = 1 and v_target_counting_logs = 1 then
      update profiles set current_streak = 2, best_streak = greatest(best_streak, 2)
        where id = v_up.owner_id
        returning current_streak, best_streak into v_subject_streak, v_subject_best;
      v_result := v_result || jsonb_build_object(
        'overall_streak', v_subject_streak,
        'best_streak', v_subject_best,
        'backfill_streak_repaired', true
      );
    end if;
  else
    select current_streak, best_streak
      into v_subject_streak, v_subject_best
      from family_members
      where id = v_up.family_member_id and last_complete_date = v_today
      for update;

    if found and v_subject_streak = 1 and v_target_counting_logs = 1 then
      update family_members set current_streak = 2, best_streak = greatest(best_streak, 2)
        where id = v_up.family_member_id
        returning current_streak, best_streak into v_subject_streak, v_subject_best;
      v_result := v_result || jsonb_build_object(
        'overall_streak', v_subject_streak,
        'best_streak', v_subject_best,
        'backfill_streak_repaired', true
      );
    end if;
  end if;

  return v_result || jsonb_build_object(
    'backfill_streak_repaired', coalesce((v_result->>'backfill_streak_repaired')::boolean, false)
  );
end;
$$;

revoke execute on function public.submit_yesterday_sandhya(uuid, text, integer, date)
  from public, anon;
grant execute on function public.submit_yesterday_sandhya(uuid, text, integer, date)
  to authenticated;
