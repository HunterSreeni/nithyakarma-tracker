-- Sandhyavandhanam gated the day/streak on all 3 slots being logged. On a
-- genuinely busy day that's an all-or-nothing bar, and it doesn't reflect how
-- the practice actually works - each sandhya stands on its own. Product
-- decision: any 1 of the 3 slots now completes the day; users can still mark
-- all 3 for the extra punya.
--
-- get_leaderboard() independently recomputes "was the sandhya day complete"
-- for scoring (not filtered by counts_toward_streak, a pre-existing quirk
-- left as-is here). It has to move with submit_practice_log or a user's
-- leaderboard score would silently disagree with their own streak.

create or replace function public.submit_practice_log(
  p_user_practice_id uuid,
  p_slot text default null::text,
  p_count integer default null::integer,
  p_local_date date default null::date,
  p_award_streak boolean default true)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  up record; pr record;
  v_today date := case
    when p_local_date is not null and abs(p_local_date - current_date) <= 1
      then p_local_date
    else current_date
  end;
  v_done_today boolean;
  v_slots_done int;
  v_new_seq int := null;
  v_subject_streak int; v_subject_best int; v_subject_punya int;
  v_all_done boolean;
  v_last_complete date;
  v_cur int; v_best int; v_freeze int; v_freeze_used boolean := false;
begin
  p_count := validate_count(p_count);

  select * into up from user_practices where id = p_user_practice_id and owner_id = auth.uid();
  if not found then raise exception 'Practice association not found'; end if;
  select * into pr from practices where id = up.practice_id;

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

  if up.family_member_id is null then
    update profiles set punya = punya + pr.punya_value where id = auth.uid()
      returning punya into v_subject_punya;
  else
    update family_members set punya = punya + pr.punya_value where id = up.family_member_id
      returning punya into v_subject_punya;
  end if;

  -- Tier-up tops freeze credits up to the new tier's cap
  if freeze_cap_for(v_subject_punya) > freeze_cap_for(v_subject_punya - pr.punya_value) then
    if up.family_member_id is null then
      update profiles set freeze_credits = greatest(freeze_credits, freeze_cap_for(v_subject_punya))
        where id = auth.uid();
    else
      update family_members set freeze_credits = greatest(freeze_credits, freeze_cap_for(v_subject_punya))
        where id = up.family_member_id;
    end if;
  end if;

  -- Only logs that count toward streak can complete the day, and only practices
  -- that affect the streak at all are allowed to gate it.
  select bool_and(
    case when p2.is_sandhyavandhanam then
      (select count(*) from practice_logs pl where pl.user_practice_id = up2.id and pl.log_date = v_today and pl.counts_toward_streak) >= 1
    else
      exists (select 1 from practice_logs pl where pl.user_practice_id = up2.id and pl.log_date = v_today and pl.counts_toward_streak)
    end)
  into v_all_done
  from user_practices up2 join practices p2 on p2.id = up2.practice_id
  where up2.owner_id = up.owner_id
    and up2.family_member_id is not distinct from up.family_member_id
    and p2.affects_streak
    and is_scheduled(p2.cadence, p2.weekday, v_today);

  if coalesce(v_all_done, false) then
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

  return jsonb_build_object(
    'saved', true,
    'practice_name', pr.name,
    'practice_done_today', v_done_today,
    'practice_streak', (select current_streak from user_practices where id = up.id),
    'day_complete', coalesce(v_all_done, false),
    'overall_streak', v_subject_streak,
    'best_streak', v_subject_best,
    'punya', v_subject_punya,
    'tier', tier_for(v_subject_punya),
    'sequence_position', v_new_seq,
    'freeze_used', v_freeze_used,
    'freeze_credits', case when up.family_member_id is null
      then (select freeze_credits from profiles where id = auth.uid())
      else (select freeze_credits from family_members where id = up.family_member_id) end
  );
end
$$;

create or replace function public.get_leaderboard(p_period text, p_scope text)
returns table (subject_id uuid, display_name text, punya int, tier text, streak int, score bigint, is_me boolean)
language plpgsql security definer set search_path = public as $$
declare v_start date;
begin
  v_start := case when p_period = 'month' then date_trunc('month', current_date)::date
                  else date_trunc('week', current_date)::date end;
  if p_scope = 'kids' then
    return query
    select * from (
      select fm.id as subject_id, split_part(fm.name, ' ', 1) as display_name, fm.punya, tier_for(fm.punya) as tier, fm.current_streak as streak,
        coalesce((
          select count(*) from (
            select pl.log_date, up.id as upid, p.is_sandhyavandhanam, count(*) as n
            from practice_logs pl
            join user_practices up on up.id = pl.user_practice_id and up.family_member_id = fm.id
            join practices p on p.id = up.practice_id
            where pl.log_date >= v_start
            group by pl.log_date, up.id, p.is_sandhyavandhanam
          ) d where (not d.is_sandhyavandhanam) or d.n >= 1
        ), 0) as score,
        fm.parent_id = auth.uid() as is_me
      from family_members fm
      where fm.bala_sabha_opt_in
    ) t
    where t.score > 0 or t.is_me
    order by t.score desc, t.streak desc limit 50;
  else
    return query
    select * from (
      select pf.id as subject_id, pf.display_name, pf.punya, tier_for(pf.punya) as tier, pf.current_streak as streak,
        coalesce((
          select count(*) from (
            select pl.log_date, up.id as upid, p.is_sandhyavandhanam, count(*) as n
            from practice_logs pl
            join user_practices up on up.id = pl.user_practice_id and up.family_member_id is null and up.owner_id = pf.id
            join practices p on p.id = up.practice_id
            where pl.log_date >= v_start
            group by pl.log_date, up.id, p.is_sandhyavandhanam
          ) d where (not d.is_sandhyavandhanam) or d.n >= 1
        ), 0) as score,
        pf.id = auth.uid() as is_me
      from profiles pf
      where (pf.leaderboard_opt_in or pf.id = auth.uid())
        and (p_scope = 'global'
         or (p_scope = 'friends' and (pf.id = auth.uid() or exists (
              select 1 from referrals r
              where (r.referrer_id = auth.uid() and r.referred_id = pf.id)
                 or (r.referred_id = auth.uid() and r.referrer_id = pf.id)))))
    ) t
    where t.score > 0 or t.is_me
    order by t.score desc, t.streak desc limit 50;
  end if;
end
$$;
