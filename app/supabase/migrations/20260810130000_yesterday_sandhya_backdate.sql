-- Feature: catch up on a missed Sandhyavandhanam slot from yesterday.
--
-- Rules (confirmed by Sreeni 2026-08-10):
-- - Streak / freeze / last_complete_date only ever move because of TODAY's own
--   mark. A backdated slot never bridges a gap, never spends a freeze, never
--   resets one either - it is punya-only.
-- - Punya for a backdated slot is half practices.punya_value, floored.
-- - Only Sandhyavandhanam, only exactly yesterday. Enforced here rather than
--   only in the client, since submit_practice_log is directly callable by any
--   authenticated user - the previous `abs(p_local_date - current_date) <= 1`
--   clamp let ANY practice be backdated by a day; this closes that.
--
-- v_today now resolves off local_today(owner's profiles.timezone) rather than
-- server-UTC current_date. That was the only accurate way to tell "is this
-- exactly yesterday" for the owner - current_date would misidentify yesterday
-- for anyone not on a UTC-adjacent offset, same class of bug fixed for decay
-- in migration 20260810120000.

create or replace function public.submit_practice_log(
  p_user_practice_id uuid,
  p_slot text default null::text,
  p_count integer default null::integer,
  p_local_date date default null::date,
  p_award_streak boolean default true)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  up record; pr record;
  v_owner_tz text;
  v_actual_today date;
  v_is_backdate boolean;
  v_today date;
  v_done_today boolean;
  v_slots_done int;
  v_new_seq int := null;
  v_punya_award int;
  v_subject_streak int; v_subject_best int; v_subject_punya int;
  v_day_complete boolean;
  v_last_complete date;
  v_cur int; v_best int; v_freeze int; v_freeze_used boolean := false;
  v_tier_up boolean;
begin
  p_count := validate_count(p_count);

  select * into up from user_practices where id = p_user_practice_id and owner_id = auth.uid();
  if not found then raise exception 'Practice association not found'; end if;
  select * into pr from practices where id = up.practice_id;

  select timezone into v_owner_tz from profiles where id = up.owner_id;
  v_actual_today := local_today(v_owner_tz);
  v_is_backdate := pr.is_sandhyavandhanam and p_local_date is not null and p_local_date = v_actual_today - 1;
  v_today := case when v_is_backdate then v_actual_today - 1 else v_actual_today end;
  if v_is_backdate then p_award_streak := false; end if;

  if not is_scheduled(pr.cadence, pr.weekday, v_today) then
    raise exception 'This practice is not scheduled today';
  end if;
  if pr.is_sandhyavandhanam and p_slot is null then
    raise exception 'Sandhyavandhanam requires a slot (morning/afternoon/evening)';
  end if;
  if not pr.is_sandhyavandhanam then p_slot := null; end if;

  if pr.cadence = 'sequence' then
    v_new_seq := up.sequence_position + 1;
    if pr.sequence_length is not null and v_new_seq > pr.sequence_length then
      v_new_seq := 1;
    end if;
  end if;

  insert into practice_logs (user_practice_id, owner_id, log_date, slot, count, sequence_position, counts_toward_streak)
  values (p_user_practice_id, auth.uid(), v_today, p_slot, p_count, v_new_seq, p_award_streak);

  if v_new_seq is not null then
    update user_practices set sequence_position = v_new_seq where id = up.id;
  end if;

  if pr.is_sandhyavandhanam then
    select count(*) into v_slots_done from practice_logs
      where user_practice_id = up.id and log_date = v_today;
    v_done_today := v_slots_done >= 1;
  else
    v_done_today := true;
  end if;

  if v_done_today and p_award_streak then
    if up.last_log_date = prev_scheduled(pr.cadence, v_today) then
      update user_practices set current_streak = current_streak + 1,
        best_streak = greatest(best_streak, current_streak + 1),
        last_log_date = v_today where id = up.id;
    elsif up.last_log_date is distinct from v_today then
      update user_practices set current_streak = 1,
        best_streak = greatest(best_streak, 1),
        last_log_date = v_today where id = up.id;
    end if;
  end if;

  v_punya_award := case when v_is_backdate then floor(pr.punya_value / 2.0)::int else pr.punya_value end;

  if up.family_member_id is null then
    update profiles set punya = punya + v_punya_award where id = auth.uid()
      returning punya into v_subject_punya;
  else
    update family_members set punya = punya + v_punya_award where id = up.family_member_id
      returning punya into v_subject_punya;
  end if;

  v_tier_up := tier_for(v_subject_punya) is distinct from tier_for(v_subject_punya - v_punya_award);

  -- Tier-up tops freeze credits up to the new tier's cap
  if freeze_cap_for(v_subject_punya) > freeze_cap_for(v_subject_punya - v_punya_award) then
    if up.family_member_id is null then
      update profiles set freeze_credits = greatest(freeze_credits, freeze_cap_for(v_subject_punya))
        where id = auth.uid();
    else
      update family_members set freeze_credits = greatest(freeze_credits, freeze_cap_for(v_subject_punya))
        where id = up.family_member_id;
    end if;
  end if;

  if v_is_backdate then
    -- Punya-only catch-up: never touches day-completion or the streak chain.
    v_day_complete := false;
    if up.family_member_id is null then
      select current_streak, best_streak into v_subject_streak, v_subject_best from profiles where id = auth.uid();
    else
      select current_streak, best_streak into v_subject_streak, v_subject_best from family_members where id = up.family_member_id;
    end if;
  else
    -- Only logs that count toward streak can complete the day, and only practices
    -- that affect the streak at all are allowed to gate it. ANY one of them
    -- completes the day (bool_or) - not all of them.
    select bool_or(
      case when p2.is_sandhyavandhanam then
        (select count(*) from practice_logs pl where pl.user_practice_id = up2.id and pl.log_date = v_today and pl.counts_toward_streak) >= 1
      else
        exists (select 1 from practice_logs pl where pl.user_practice_id = up2.id and pl.log_date = v_today and pl.counts_toward_streak)
      end)
    into v_day_complete
    from user_practices up2 join practices p2 on p2.id = up2.practice_id
    where up2.owner_id = up.owner_id
      and up2.family_member_id is not distinct from up.family_member_id
      and p2.affects_streak
      and is_scheduled(p2.cadence, p2.weekday, v_today);

    if coalesce(v_day_complete, false) then
      if up.family_member_id is null then
        select current_streak, best_streak, last_complete_date, freeze_credits
          into v_cur, v_best, v_last_complete, v_freeze from profiles where id = auth.uid();
        if v_last_complete is distinct from v_today then
          select r.new_streak, r.new_best, r.new_freeze, r.freeze_used
            into v_subject_streak, v_subject_best, v_freeze, v_freeze_used
            from streak_after_completion(v_cur, v_best, v_last_complete, v_today, v_freeze) r;
          update profiles set current_streak = v_subject_streak, best_streak = v_subject_best,
            last_complete_date = v_today, freeze_credits = v_freeze where id = auth.uid();
        else
          v_subject_streak := v_cur; v_subject_best := v_best;
        end if;
      else
        select current_streak, best_streak, last_complete_date, freeze_credits
          into v_cur, v_best, v_last_complete, v_freeze from family_members where id = up.family_member_id;
        if v_last_complete is distinct from v_today then
          select r.new_streak, r.new_best, r.new_freeze, r.freeze_used
            into v_subject_streak, v_subject_best, v_freeze, v_freeze_used
            from streak_after_completion(v_cur, v_best, v_last_complete, v_today, v_freeze) r;
          update family_members set current_streak = v_subject_streak, best_streak = v_subject_best,
            last_complete_date = v_today, freeze_credits = v_freeze where id = up.family_member_id;
        else
          v_subject_streak := v_cur; v_subject_best := v_best;
        end if;
      end if;
    else
      if up.family_member_id is null then
        select current_streak, best_streak into v_subject_streak, v_subject_best from profiles where id = auth.uid();
      else
        select current_streak, best_streak into v_subject_streak, v_subject_best from family_members where id = up.family_member_id;
      end if;
    end if;
  end if;

  return jsonb_build_object(
    'saved', true,
    'practice_name', pr.name,
    'practice_done_today', v_done_today,
    'practice_streak', (select current_streak from user_practices where id = up.id),
    'day_complete', coalesce(v_day_complete, false),
    'overall_streak', v_subject_streak,
    'best_streak', v_subject_best,
    'punya', v_subject_punya,
    'tier', tier_for(v_subject_punya),
    'tier_up', coalesce(v_tier_up, false),
    'sequence_position', v_new_seq,
    'freeze_used', v_freeze_used,
    'freeze_credits', case when up.family_member_id is null
      then (select freeze_credits from profiles where id = auth.uid())
      else (select freeze_credits from family_members where id = up.family_member_id) end,
    'backdated', v_is_backdate,
    'punya_awarded', v_punya_award
  );
end
$$;
