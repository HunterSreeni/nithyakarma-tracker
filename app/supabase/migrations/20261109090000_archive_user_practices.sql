-- AI-DEV NOTE: Soft archive for user_practices ("remove anushtanam").
-- Removing hides a practice from Today/reminders but keeps the row and every
-- practice_log, because logs feed the leaderboard, history and the streak
-- days already earned - a hard delete would cascade them away (practice_logs
-- FK is on delete cascade). Re-adding the same practice restores the same row
-- (the unique (owner, member, practice) index forbids a second one), so its
-- history comes back with it.
-- Streak/punya RPCs are intentionally NOT changed: an archived practice simply
-- stops getting logs, its own current_streak decays like any unlogged one, and
-- the subject's overall streak is unaffected.

alter table public.user_practices add column archived_at timestamptz;

-- The eligibility gate used to fire on insert only. A restore is effectively a
-- re-add, and the subject may have stopped qualifying meanwhile (e.g. married
-- since adding Samidhadhanam), so re-run the same gate on restore.
create trigger sandhya_eligibility_on_restore
  before update of archived_at on public.user_practices
  for each row
  when (old.archived_at is not null and new.archived_at is null)
  execute function public.check_sandhya_eligibility();

create or replace function public.set_practice_archived(p_user_practice_id uuid, p_archived boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_is_sandhya boolean;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select p.is_sandhyavandhanam into v_is_sandhya
    from public.user_practices up join public.practices p on p.id = up.practice_id
   where up.id = p_user_practice_id and up.owner_id = auth.uid();
  if not found then raise exception 'Practice association not found'; end if;
  -- Sandhyavandhanam is the constant daily practice for eligible males (added
  -- automatically at onboarding / upanayanam) - it is not user-removable.
  if p_archived and v_is_sandhya then
    raise exception 'Sandhyavandhanam cannot be removed';
  end if;
  update public.user_practices
     set archived_at = case when p_archived then coalesce(archived_at, now()) else null end
   where id = p_user_practice_id;
end;
$$;

revoke all on function public.set_practice_archived(uuid, boolean) from public, anon;
grant execute on function public.set_practice_archived(uuid, boolean) to authenticated;
