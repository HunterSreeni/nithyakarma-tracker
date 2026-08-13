-- Make yesterday's Sandhyavandhanam catch-up a real completion:
-- full punya, streak credit, chronological repair through today, and a refund
-- when today's earlier completion spent a freeze for the day now backfilled.
-- Also records durable streak transitions so push delivery is based on what
-- actually happened, not inferred later from mutable profile state.

create table public.streak_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  family_member_id uuid references public.family_members(id) on delete cascade,
  event_type text not null check (event_type in ('freeze_used', 'streak_restarted', 'streak_reset')),
  event_date date not null,
  missed_date date,
  streak_before int not null,
  streak_after int not null,
  freeze_before int not null,
  freeze_after int not null,
  repaired_at timestamptz,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index streak_events_one_transition_per_subject_day
  on public.streak_events (owner_id, coalesce(family_member_id, '00000000-0000-0000-0000-000000000000'::uuid), event_type, event_date);
create index streak_events_pending_push on public.streak_events (created_at) where processed_at is null;

alter table public.streak_events enable row level security;
create policy "own streak events select" on public.streak_events for select using (owner_id = (select auth.uid()));
grant select, insert, update on public.streak_events to service_role;

-- Event deliveries use event_id for dedupe. Scheduled reminders retain their
-- original one-slot-per-local-day uniqueness.
alter table public.notification_deliveries add column event_id uuid references public.streak_events(id) on delete cascade;
alter table public.notification_deliveries
  drop constraint notification_deliveries_user_id_reminder_date_slot_endpoint_key;
create unique index notification_deliveries_scheduled_unique
  on public.notification_deliveries (user_id, reminder_date, slot, endpoint) where event_id is null;
create unique index notification_deliveries_event_unique
  on public.notification_deliveries (event_id, endpoint) where event_id is not null;
alter table public.notification_deliveries drop constraint notification_deliveries_slot_check;
alter table public.notification_deliveries add constraint notification_deliveries_slot_check
  check (slot = any (array['morning'::text, 'afternoon'::text, 'evening'::text,
    'nudge'::text, 'nudge_morning'::text, 'tharpanam'::text, 'observance'::text,
    'observance_advance'::text, 'freeze_used'::text, 'streak_reset'::text]));

-- Per-practice streaks never use freezes, so they can be reconstructed exactly
-- from their counting logs when an out-of-order yesterday log is inserted.
create or replace function public.recalculate_practice_streak(p_user_practice_id uuid)
returns int language plpgsql security definer set search_path = public as $$
declare
  v_up record; v_pr record; v_date date; v_first date; v_streak int := 0;
begin
  select * into v_up from user_practices where id = p_user_practice_id;
  if not found then return 0; end if;
  select * into v_pr from practices where id = v_up.practice_id;
  select max(log_date), min(log_date) into v_date, v_first from practice_logs
    where user_practice_id = p_user_practice_id and counts_toward_streak;
  if v_date is null then
    update user_practices set current_streak = 0, last_log_date = null where id = p_user_practice_id;
    return 0;
  end if;
  loop
    if is_scheduled(v_pr.cadence, v_pr.weekday, v_date) then
      exit when not exists (
        select 1 from practice_logs where user_practice_id = p_user_practice_id
          and log_date = v_date and counts_toward_streak
      );
      v_streak := v_streak + 1;
    end if;
    v_date := v_date - 1;
    exit when v_date < v_first;
  end loop;
  update user_practices set current_streak = v_streak,
    best_streak = greatest(best_streak, v_streak),
    last_log_date = (select max(log_date) from practice_logs
      where user_practice_id = p_user_practice_id and counts_toward_streak)
    where id = p_user_practice_id;
  return v_streak;
end $$;
revoke execute on function public.recalculate_practice_streak(uuid) from anon, authenticated, public;

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
  v_is_slotted := pr.is_sandhyavandhanam or pr.is_sri_rudram;

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

-- The entire next local day is now a catch-up grace window. Reset only after
-- that window has expired, and record the exact zeroing transition for push.
create or replace function public.decay_stale_streaks() returns void
language plpgsql security definer set search_path = public as $$
begin
  with stale as materialized (
    select p.id, p.current_streak, p.freeze_credits, local_today(p.timezone) as local_date
    from profiles p where p.current_streak > 0
      and p.last_complete_date is distinct from local_today(p.timezone)
      and p.last_complete_date is distinct from local_today(p.timezone) - 1
      and p.last_complete_date is distinct from local_today(p.timezone) - 2
    for update
  ), reset as (
    update profiles p set current_streak = 0 from stale s where p.id = s.id returning p.id
  )
  insert into streak_events(owner_id, event_type, event_date, streak_before, streak_after, freeze_before, freeze_after)
    select s.id, 'streak_reset', s.local_date, s.current_streak, 0, s.freeze_credits, s.freeze_credits
    from stale s join reset r on r.id = s.id on conflict do nothing;

  with stale as materialized (
    select fm.id, fm.parent_id, fm.current_streak, fm.freeze_credits, local_today(p.timezone) as local_date
    from family_members fm join profiles p on p.id = fm.parent_id
    where fm.current_streak > 0
      and fm.last_complete_date is distinct from local_today(p.timezone)
      and fm.last_complete_date is distinct from local_today(p.timezone) - 1
      and fm.last_complete_date is distinct from local_today(p.timezone) - 2
    for update of fm
  ), reset as (
    update family_members fm set current_streak = 0 from stale s where fm.id = s.id returning fm.id
  )
  insert into streak_events(owner_id, family_member_id, event_type, event_date,
      streak_before, streak_after, freeze_before, freeze_after)
    select s.parent_id, s.id, 'streak_reset', s.local_date, s.current_streak, 0,
      s.freeze_credits, s.freeze_credits from stale s join reset r on r.id = s.id on conflict do nothing;

  -- Per-practice counters do not offer backfill except Sandhya. Preserve only
  -- Sandhya across the catch-up day; other practice counters keep their normal cadence.
  update user_practices up set current_streak = 0
  from practices pr, profiles owner
  where pr.id = up.practice_id and owner.id = up.owner_id and up.current_streak > 0
    and up.last_log_date is distinct from local_today(owner.timezone)
    and up.last_log_date is distinct from prev_scheduled(pr.cadence, local_today(owner.timezone))
    and not (pr.is_sandhyavandhanam and up.last_log_date = local_today(owner.timezone) - 2);
end $$;
revoke execute on function public.decay_stale_streaks() from anon, authenticated, public;
