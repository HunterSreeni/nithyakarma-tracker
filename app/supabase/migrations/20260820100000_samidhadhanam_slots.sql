-- Intent 2.9 (docs/UPGRADE-PLAN.md, 2026-08-20): Samidhadhanam gets a
-- morning/evening choice - either completes it, not both required. Same
-- any-1-of-N slot semantics as Sri Rudram's namakam/chamakam/both (see
-- 20260811120446_rudram_slots_and_weekly_gate_removal.sql), just 2 slots
-- instead of 3. 'morning'/'evening' are already valid practice_logs.slot
-- values (shared with Sandhyavandhanam's own slots) - no constraint change
-- needed, slot is scoped per user_practice_id, not globally ambiguous.
--
-- AI-DEV NOTE: Protected streak/completion logic - see AGENTS.md "Streak &
-- freeze". This generalizes every submit_practice_log branch that already
-- keys off is_sandhyavandhanam/is_sri_rudram to also include
-- is_samidhadhanam, mirroring exactly how Sri Rudram was added. Do not
-- change streak_after_completion/decay_stale_streaks semantics here.

alter table public.practices add column is_samidhadhanam boolean not null default false;
update public.practices set is_samidhadhanam = true where slug = 'samidhadhanam';

create or replace function public.submit_practice_log(
  p_user_practice_id uuid,
  p_slot text default null::text,
  p_count integer default null::integer,
  p_local_date date default null::date,
  p_award_streak boolean default true)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  up record; pr record; v_transition record;
  v_owner_tz text; v_actual_today date; v_is_backdate boolean; v_today date;
  v_is_slotted boolean; v_done_today boolean; v_slots_done int;
  v_new_seq int := null; v_punya_award int;
  v_subject_streak int; v_subject_best int; v_subject_punya int;
  v_day_complete boolean; v_day_was_complete boolean := false;
  v_last_complete date; v_cur int; v_best int; v_freeze int;
  v_freeze_before int; v_freeze_used boolean := false; v_freeze_refunded boolean := false;
  v_tier_up boolean;
begin
  p_count := validate_count(p_count);

  select * into up from user_practices where id = p_user_practice_id and owner_id = auth.uid();
  if not found then raise exception 'Practice association not found'; end if;
  select * into pr from practices where id = up.practice_id;
  v_is_slotted := pr.is_sandhyavandhanam or pr.is_sri_rudram or pr.is_samidhadhanam;

  select timezone into v_owner_tz from profiles where id = up.owner_id;
  v_actual_today := local_today(v_owner_tz);
  v_is_backdate := pr.is_sandhyavandhanam and p_local_date is not null and p_local_date = v_actual_today - 1;
  v_today := case when v_is_backdate then v_actual_today - 1 else v_actual_today end;
  -- A valid backfill is always a counting log. The server owns this policy;
  -- callers cannot accidentally or deliberately turn it back into punya-only.
  if v_is_backdate then p_award_streak := true; end if;

  if not is_scheduled(pr.cadence, pr.weekday, v_today) then raise exception 'This practice is not scheduled today'; end if;
  if pr.is_sandhyavandhanam and p_slot is null then raise exception 'Sandhyavandhanam requires a slot (morning/afternoon/evening)'; end if;
  if pr.is_sri_rudram and p_slot is null then raise exception 'Sri Rudram requires a slot (namakam/chamakam/both)'; end if;
  if pr.is_samidhadhanam and p_slot is null then raise exception 'Samidhadhanam requires a slot (morning/evening)'; end if;
  if not v_is_slotted then p_slot := null; end if;

  -- Snapshot whether this subject's target day was already complete. A second
  -- Sandhya slot earns punya but must never advance/refund the day twice.
  select coalesce(bool_or(case when p2.is_sandhyavandhanam or p2.is_sri_rudram then
      exists (select 1 from practice_logs pl where pl.user_practice_id = up2.id
        and pl.log_date = v_today and pl.counts_toward_streak)
    else exists (select 1 from practice_logs pl where pl.user_practice_id = up2.id
        and pl.log_date = v_today and pl.counts_toward_streak) end), false)
    into v_day_was_complete
    from user_practices up2 join practices p2 on p2.id = up2.practice_id
    where up2.owner_id = up.owner_id
      and up2.family_member_id is not distinct from up.family_member_id
      and p2.affects_streak and is_scheduled(p2.cadence, p2.weekday, v_today);

  if pr.cadence = 'sequence' then
    v_new_seq := up.sequence_position + 1;
    if pr.sequence_length is not null and v_new_seq > pr.sequence_length then v_new_seq := 1; end if;
  end if;

  insert into practice_logs (user_practice_id, owner_id, log_date, slot, count, sequence_position, counts_toward_streak)
  values (p_user_practice_id, auth.uid(), v_today, p_slot, p_count, v_new_seq, p_award_streak);
  if v_new_seq is not null then update user_practices set sequence_position = v_new_seq where id = up.id; end if;

  if v_is_slotted then
    select count(*) into v_slots_done from practice_logs where user_practice_id = up.id and log_date = v_today;
    v_done_today := v_slots_done >= 1;
  else v_done_today := true;
  end if;

  if v_is_backdate then
    perform recalculate_practice_streak(up.id);
  elsif v_done_today and p_award_streak then
    if up.last_log_date = prev_scheduled(pr.cadence, v_today) then
      update user_practices set current_streak = current_streak + 1,
        best_streak = greatest(best_streak, current_streak + 1), last_log_date = v_today where id = up.id;
    elsif up.last_log_date is distinct from v_today then
      update user_practices set current_streak = 1, best_streak = greatest(best_streak, 1),
        last_log_date = v_today where id = up.id;
    end if;
  end if;

  -- Every slot now earns the practice's normal configured value (Sandhya = 5).
  v_punya_award := pr.punya_value;
  if up.family_member_id is null then
    update profiles set punya = punya + v_punya_award where id = auth.uid() returning punya into v_subject_punya;
  else
    update family_members set punya = punya + v_punya_award where id = up.family_member_id returning punya into v_subject_punya;
  end if;
  v_tier_up := tier_for(v_subject_punya) is distinct from tier_for(v_subject_punya - v_punya_award);

  -- Preserve the existing earned reward: crossing a tier tops credits to that
  -- tier's cap. A subsequent freeze use consumes exactly one from that balance.
  if freeze_cap_for(v_subject_punya) > freeze_cap_for(v_subject_punya - v_punya_award) then
    if up.family_member_id is null then
      update profiles set freeze_credits = greatest(freeze_credits, freeze_cap_for(v_subject_punya)) where id = auth.uid();
    else
      update family_members set freeze_credits = greatest(freeze_credits, freeze_cap_for(v_subject_punya)) where id = up.family_member_id;
    end if;
  end if;

  select coalesce(bool_or(case when p2.is_sandhyavandhanam or p2.is_sri_rudram then
      exists (select 1 from practice_logs pl where pl.user_practice_id = up2.id
        and pl.log_date = v_today and pl.counts_toward_streak)
    else exists (select 1 from practice_logs pl where pl.user_practice_id = up2.id
        and pl.log_date = v_today and pl.counts_toward_streak) end), false)
    into v_day_complete
    from user_practices up2 join practices p2 on p2.id = up2.practice_id
    where up2.owner_id = up.owner_id
      and up2.family_member_id is not distinct from up.family_member_id
      and p2.affects_streak and is_scheduled(p2.cadence, p2.weekday, v_today);

  if v_day_complete and not v_day_was_complete then
    if up.family_member_id is null then
      select current_streak, best_streak, last_complete_date, freeze_credits
        into v_cur, v_best, v_last_complete, v_freeze from profiles where id = auth.uid() for update;
    else
      select current_streak, best_streak, last_complete_date, freeze_credits
        into v_cur, v_best, v_last_complete, v_freeze from family_members where id = up.family_member_id for update;
    end if;

    if v_is_backdate then
      select * into v_transition from streak_events
        where owner_id = up.owner_id and family_member_id is not distinct from up.family_member_id
          and event_date = v_actual_today and missed_date = v_today
          and event_type in ('freeze_used', 'streak_restarted') and repaired_at is null
        order by created_at desc limit 1 for update;

      if found then
        v_subject_streak := v_transition.streak_before + 2;
        v_subject_best := greatest(v_best, v_subject_streak);
        if v_transition.event_type = 'freeze_used' then
          v_freeze := least(v_freeze + 1, freeze_cap_for(v_subject_punya));
          v_freeze_refunded := true;
        end if;
        if up.family_member_id is null then
          update profiles set current_streak = v_subject_streak, best_streak = v_subject_best,
            freeze_credits = v_freeze where id = auth.uid();
        else
          update family_members set current_streak = v_subject_streak, best_streak = v_subject_best,
            freeze_credits = v_freeze where id = up.family_member_id;
        end if;
        update streak_events set repaired_at = now() where id = v_transition.id;
      elsif v_last_complete is distinct from v_today and v_last_complete is distinct from v_actual_today then
        v_freeze_before := v_freeze;
        select r.new_streak, r.new_best, r.new_freeze, r.freeze_used
          into v_subject_streak, v_subject_best, v_freeze, v_freeze_used
          from streak_after_completion(v_cur, v_best, v_last_complete, v_today, v_freeze) r;
        if up.family_member_id is null then
          update profiles set current_streak = v_subject_streak, best_streak = v_subject_best,
            last_complete_date = v_today, freeze_credits = v_freeze where id = auth.uid();
        else
          update family_members set current_streak = v_subject_streak, best_streak = v_subject_best,
            last_complete_date = v_today, freeze_credits = v_freeze where id = up.family_member_id;
        end if;
        if v_freeze_used then
          insert into streak_events(owner_id, family_member_id, event_type, event_date, missed_date,
            streak_before, streak_after, freeze_before, freeze_after)
          values(up.owner_id, up.family_member_id, 'freeze_used', v_today, v_today - 1,
            v_cur, v_subject_streak, v_freeze_before, v_freeze) on conflict do nothing;
        end if;
      else
        v_subject_streak := v_cur; v_subject_best := v_best;
      end if;
    elsif v_last_complete is distinct from v_today then
      v_freeze_before := v_freeze;
      select r.new_streak, r.new_best, r.new_freeze, r.freeze_used
        into v_subject_streak, v_subject_best, v_freeze, v_freeze_used
        from streak_after_completion(v_cur, v_best, v_last_complete, v_today, v_freeze) r;
      if up.family_member_id is null then
        update profiles set current_streak = v_subject_streak, best_streak = v_subject_best,
          last_complete_date = v_today, freeze_credits = v_freeze where id = auth.uid();
      else
        update family_members set current_streak = v_subject_streak, best_streak = v_subject_best,
          last_complete_date = v_today, freeze_credits = v_freeze where id = up.family_member_id;
      end if;
      if v_freeze_used then
        insert into streak_events(owner_id, family_member_id, event_type, event_date, missed_date,
          streak_before, streak_after, freeze_before, freeze_after)
        values(up.owner_id, up.family_member_id, 'freeze_used', v_today, v_today - 1,
          v_cur, v_subject_streak, v_freeze_before, v_freeze) on conflict do nothing;
      elsif v_last_complete = v_today - 2 and v_cur > 0 and v_subject_streak = 1 then
        insert into streak_events(owner_id, family_member_id, event_type, event_date, missed_date,
          streak_before, streak_after, freeze_before, freeze_after)
        values(up.owner_id, up.family_member_id, 'streak_restarted', v_today, v_today - 1,
          v_cur, v_subject_streak, v_freeze_before, v_freeze) on conflict do nothing;
      end if;
    else
      v_subject_streak := v_cur; v_subject_best := v_best;
    end if;
  else
    if up.family_member_id is null then
      select current_streak, best_streak into v_subject_streak, v_subject_best from profiles where id = auth.uid();
    else
      select current_streak, best_streak into v_subject_streak, v_subject_best from family_members where id = up.family_member_id;
    end if;
  end if;

  return jsonb_build_object(
    'saved', true, 'practice_name', pr.name, 'practice_done_today', v_done_today,
    'practice_streak', (select current_streak from user_practices where id = up.id),
    'day_complete', coalesce(v_day_complete, false), 'overall_streak', v_subject_streak,
    'best_streak', v_subject_best, 'punya', v_subject_punya, 'tier', tier_for(v_subject_punya),
    'tier_up', coalesce(v_tier_up, false), 'sequence_position', v_new_seq,
    'freeze_used', v_freeze_used, 'freeze_refunded', v_freeze_refunded,
    'freeze_credits', case when up.family_member_id is null
      then (select freeze_credits from profiles where id = auth.uid())
      else (select freeze_credits from family_members where id = up.family_member_id) end,
    'backdated', v_is_backdate, 'punya_awarded', v_punya_award
  );
end $$;
