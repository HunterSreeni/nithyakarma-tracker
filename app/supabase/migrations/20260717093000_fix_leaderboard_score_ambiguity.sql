-- 20260716151620_leaderboard_hide_zero_score.sql added `where score > 0 or is_me`
-- / `order by score desc, streak desc` referencing the outer subquery's column
-- aliases bare. But get_leaderboard's RETURNS TABLE(..., streak int, score
-- bigint, is_me boolean, ...) implicitly declares plpgsql variables with those
-- same names, so every call errors: "column reference is ambiguous". The
-- leaderboard has been fully broken since that migration. Qualify with the
-- subquery alias.
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
          ) d where (not d.is_sandhyavandhanam) or d.n >= 3
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
          ) d where (not d.is_sandhyavandhanam) or d.n >= 3
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
end $$;
