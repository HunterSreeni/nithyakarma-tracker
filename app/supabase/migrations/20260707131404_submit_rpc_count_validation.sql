-- Single behavioral change vs previous version: p_count is sanitized
-- (1..10000, else null) before any use.
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

  insert into practice_logs (user_practice_id, owner_id, log_date, slot, count, sequence_position)
  values (p_user_practice_id, auth.uid(), v_today, p_slot, p_count, v_new_seq);

  if v_new_seq is not null then
    update user_practices set sequence_position = v_new_seq where id = up.id;
  end if;

  if pr.is_sandhyavandhanam then
    select count(*) into v_slots_done from practice_logs
      where user_practice_id = up.id and log_date = v_today;
    v_done_today := v_slots_done >= 3;
  else
    v_done_today := true;
  end if;

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

  if up.family_member_id is null then
    update profiles set punya = punya + 5 where id = auth.uid()
      returning punya into v_subject_punya;
  else
    update family_members set punya = punya + 5 where id = up.family_member_id
      returning punya into v_subject_punya;
  end if;

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