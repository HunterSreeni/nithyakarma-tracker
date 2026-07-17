-- S4: leaderboard was opt-OUT while the Sabha/community feature is opt-IN, so
-- a user who never touched the setting was still publicly listed by default.
-- Flip to explicit opt-in, default hidden.
alter table public.profiles rename column leaderboard_opt_out to leaderboard_opt_in;
alter table public.profiles alter column leaderboard_opt_in set default false;
-- Reset everyone to the new safe default - we can't tell who "false" meant as
-- a deliberate choice vs. who never touched the setting, so default to hidden.
update public.profiles set leaderboard_opt_in = false;

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
    where (pf.leaderboard_opt_in or pf.id = auth.uid())
      and (p_scope = 'global'
       or (p_scope = 'friends' and (pf.id = auth.uid() or exists (
            select 1 from referrals r
            where (r.referrer_id = auth.uid() and r.referred_id = pf.id)
               or (r.referred_id = auth.uid() and r.referrer_id = pf.id)))))
    order by 6 desc, 5 desc limit 50;
  end if;
end $$;
