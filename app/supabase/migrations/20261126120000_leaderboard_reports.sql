-- Sabha name reports (Sreeni, 2026-11-26). Apple guideline 1.2 asks apps that
-- show content from users (Sabha shows user-chosen display names and children's
-- first names) for a way to report it. A report only records who reported which
-- leaderboard row and when; Sreeni reviews them in Supabase. Hiding a name is
-- client-side only (per phone), see app/src/utils/sabhaHidden.js.
--
-- AI-DEV NOTE: no name is stored here, only the row's subject id, so a report
-- never keeps a copy of someone's name after they change or delete it. reporter_id
-- cascades on auth.users delete (AGENTS.md "Account deletion"). Clients have no
-- table access; everything goes through report_leaderboard_name.

create table public.leaderboard_reports (
  id bigint generated always as identity primary key,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  -- a profiles.id (adult boards) or family_members.id (Bala Sabha); no FK because
  -- it can be either, and a report on a since-deleted row is simply moot.
  subject_id uuid not null,
  created_at timestamptz not null default now(),
  unique (reporter_id, subject_id)
);
create index leaderboard_reports_created_idx on public.leaderboard_reports (created_at);

alter table public.leaderboard_reports enable row level security;
revoke all on public.leaderboard_reports from anon, authenticated;
grant select, insert, update, delete on public.leaderboard_reports to service_role;

-- AI-DEV NOTE: only rows someone can actually see on a board are reportable (an
-- opted-in adult who is not the caller, or an opted-in child of another parent),
-- so the function cannot be used to probe arbitrary ids. 20 reports per rolling
-- 24 hours per reporter stops it being used to flood the table. Reporting the
-- same row twice is a quiet no-op.
create or replace function public.report_leaderboard_name(p_subject_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Not signed in'; end if;
  if not exists (select 1 from profiles where id = p_subject_id and leaderboard_opt_in and id <> v_uid)
     and not exists (select 1 from family_members where id = p_subject_id and bala_sabha_opt_in and parent_id <> v_uid) then
    raise exception 'This name is not on the Sabha';
  end if;
  if (select count(*) from leaderboard_reports
      where reporter_id = v_uid and created_at > now() - interval '24 hours') >= 20 then
    raise exception 'Too many reports today. Please try again tomorrow.';
  end if;
  insert into leaderboard_reports (reporter_id, subject_id) values (v_uid, p_subject_id)
  on conflict (reporter_id, subject_id) do nothing;
end;
$$;
revoke all on function public.report_leaderboard_name(uuid) from public, anon;
grant execute on function public.report_leaderboard_name(uuid) to authenticated;
