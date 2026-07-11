-- Tier from punya points
create or replace function public.tier_for(p_punya int) returns text
language sql immutable as $$
  select case
    when p_punya >= 2500 then 'Brahmarishi'
    when p_punya >= 1000 then 'Rishi'
    when p_punya >= 400  then 'Tapasvi'
    when p_punya >= 100  then 'Sadhaka'
    else 'Jijnasu'
  end
$$;

-- Is a practice scheduled on a given date?
create or replace function public.is_scheduled(p_cadence text, p_weekday int, p_date date) returns boolean
language sql immutable as $$
  select case
    when p_cadence = 'weekly' then extract(dow from p_date)::int = p_weekday
    else true
  end
$$;

-- Previous date this practice was scheduled (for streak chaining)
create or replace function public.prev_scheduled(p_cadence text, p_date date) returns date
language sql immutable as $$
  select case when p_cadence = 'weekly' then p_date - 7 else p_date - 1 end
$$;

-- Guard: Sandhyavandhanam only for male subjects (upanayanam done for boys)
create or replace function public.check_sandhya_eligibility() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_is_sandhya boolean; v_gender text; v_upanayanam boolean;
begin
  select is_sandhyavandhanam into v_is_sandhya from practices where id = new.practice_id;
  if not v_is_sandhya then return new; end if;
  if new.family_member_id is null then
    select gender into v_gender from profiles where id = new.owner_id;
    if v_gender <> 'male' then
      raise exception 'Sandhyavandhanam is available for male users only';
    end if;
  else
    select gender, upanayanam_done into v_gender, v_upanayanam
      from family_members where id = new.family_member_id;
    if v_gender <> 'male' or not coalesce(v_upanayanam, false) then
      raise exception 'Sandhyavandhanam requires a male child with upanayanam done';
    end if;
  end if;
  return new;
end $$;
create trigger sandhya_eligibility before insert on public.user_practices
  for each row execute function public.check_sandhya_eligibility();

-- Submit a practice log. THE core write path: validates, inserts, updates
-- streaks + punya server-side, returns everything the celebration screen needs.
-- Ad + celebration fire client-side ONLY on {saved: true} from this function.
create or replace function public.submit_practice_log(
  p_user_practice_id uuid,
  p_slot text default null,
  p_count int default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  up record; pr record;
  v_today date := current_date;
  v_done_today boolean;
  v_slots_done int;
  v_new_seq int := null;
  v_subject_streak int; v_subject_best int; v_subject_punya int;
  v_all_done boolean;
  v_last_complete date;
begin
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
      v_new_seq := 1; -- new cycle
    end if;
  end if;

  insert into practice_logs (user_practice_id, owner_id, log_date, slot, count, sequence_position)
  values (p_user_practice_id, auth.uid(), v_today, p_slot, p_count, v_new_seq);
  -- unique index rejects duplicates -> error propagates, nothing saved

  if v_new_seq is not null then
    update user_practices set sequence_position = v_new_seq where id = up.id;
  end if;

  -- Practice done today? (sandhya = all 3 slots)
  if pr.is_sandhyavandhanam then
    select count(*) into v_slots_done from practice_logs
      where user_practice_id = up.id and log_date = v_today;
    v_done_today := v_slots_done >= 3;
  else
    v_done_today := true;
  end if;

  -- Per-practice streak (only when the practice completes for the day)
  if v_done_today then
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

  -- Punya: 5 per log
  if up.family_member_id is null then
    update profiles set punya = punya + 5 where id = auth.uid()
      returning punya into v_subject_punya;
  else
    update family_members set punya = punya + 5 where id = up.family_member_id
      returning punya into v_subject_punya;
  end if;

  -- Subject overall streak: all practices scheduled today are complete
  select bool_and(
    case when p2.is_sandhyavandhanam then
      (select count(*) from practice_logs pl where pl.user_practice_id = up2.id and pl.log_date = v_today) >= 3
    else
      exists (select 1 from practice_logs pl where pl.user_practice_id = up2.id and pl.log_date = v_today)
    end)
  into v_all_done
  from user_practices up2 join practices p2 on p2.id = up2.practice_id
  where up2.owner_id = up.owner_id
    and up2.family_member_id is not distinct from up.family_member_id
    and is_scheduled(p2.cadence, p2.weekday, v_today);

  if coalesce(v_all_done, false) then
    if up.family_member_id is null then
      select last_complete_date into v_last_complete from profiles where id = auth.uid();
      if v_last_complete is distinct from v_today then
        update profiles set
          current_streak = case when v_last_complete = v_today - 1 then current_streak + 1 else 1 end,
          best_streak = greatest(best_streak, case when v_last_complete = v_today - 1 then current_streak + 1 else 1 end),
          last_complete_date = v_today
        where id = auth.uid();
      end if;
      select current_streak, best_streak into v_subject_streak, v_subject_best from profiles where id = auth.uid();
    else
      select last_complete_date into v_last_complete from family_members where id = up.family_member_id;
      if v_last_complete is distinct from v_today then
        update family_members set
          current_streak = case when v_last_complete = v_today - 1 then current_streak + 1 else 1 end,
          best_streak = greatest(best_streak, case when v_last_complete = v_today - 1 then current_streak + 1 else 1 end),
          last_complete_date = v_today
        where id = up.family_member_id;
      end if;
      select current_streak, best_streak into v_subject_streak, v_subject_best from family_members where id = up.family_member_id;
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
    'sequence_position', v_new_seq
  );
end $$;

-- Leaderboard. scope: global | friends | kids. period: week | month.
-- Score = completed practice-days in period (sandhya day counts once when all 3 slots done).
create or replace function public.get_leaderboard(p_period text, p_scope text)
returns table (subject_id uuid, display_name text, punya int, tier text, streak int, score bigint, is_me boolean)
language plpgsql security definer set search_path = public as $$
declare v_start date;
begin
  v_start := case when p_period = 'month' then date_trunc('month', current_date)::date
                  else date_trunc('week', current_date)::date end;
  if p_scope = 'kids' then
    return query
    select fm.id, split_part(fm.name, ' ', 1), fm.punya, tier_for(fm.punya), fm.current_streak,
      coalesce((
        select count(*) from (
          select pl.log_date, up.id as upid, p.is_sandhyavandhanam, count(*) as n
          from practice_logs pl
          join user_practices up on up.id = pl.user_practice_id and up.family_member_id = fm.id
          join practices p on p.id = up.practice_id
          where pl.log_date >= v_start
          group by pl.log_date, up.id, p.is_sandhyavandhanam
        ) d where (not d.is_sandhyavandhanam) or d.n >= 3
      ), 0),
      fm.parent_id = auth.uid()
    from family_members fm
    where fm.bala_sabha_opt_in
    order by 6 desc, 5 desc limit 50;
  else
    return query
    select pf.id, pf.display_name, pf.punya, tier_for(pf.punya), pf.current_streak,
      coalesce((
        select count(*) from (
          select pl.log_date, up.id as upid, p.is_sandhyavandhanam, count(*) as n
          from practice_logs pl
          join user_practices up on up.id = pl.user_practice_id and up.family_member_id is null and up.owner_id = pf.id
          join practices p on p.id = up.practice_id
          where pl.log_date >= v_start
          group by pl.log_date, up.id, p.is_sandhyavandhanam
        ) d where (not d.is_sandhyavandhanam) or d.n >= 3
      ), 0),
      pf.id = auth.uid()
    from profiles pf
    where p_scope = 'global'
       or (p_scope = 'friends' and (pf.id = auth.uid() or exists (
            select 1 from referrals r
            where (r.referrer_id = auth.uid() and r.referred_id = pf.id)
               or (r.referred_id = auth.uid() and r.referrer_id = pf.id))))
    order by 6 desc, 5 desc limit 50;
  end if;
end $$;

-- Apply a referral code at signup: both parties get 1 ad-free month.
create or replace function public.apply_referral(p_code text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_referrer uuid;
begin
  select id into v_referrer from profiles where referral_code = p_code;
  if v_referrer is null then raise exception 'Invalid referral code'; end if;
  if v_referrer = auth.uid() then raise exception 'Cannot refer yourself'; end if;
  insert into referrals (referrer_id, referred_id) values (v_referrer, auth.uid());
  update profiles set ad_free_until = greatest(coalesce(ad_free_until, current_date), current_date) + 30,
    referred_by = v_referrer where id = auth.uid();
  update profiles set ad_free_until = greatest(coalesce(ad_free_until, current_date), current_date) + 30
    where id = v_referrer;
  return jsonb_build_object('applied', true);
end $$;