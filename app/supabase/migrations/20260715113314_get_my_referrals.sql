-- Referrals tab (formerly "Friends"): a plain tracking list of who you
-- referred and when, rather than a competitive leaderboard. Outbound only -
-- who referred you isn't shown here.
create or replace function public.get_my_referrals()
returns table (referred_id uuid, display_name text, joined_at timestamptz)
language sql security definer set search_path = public as $$
  select p.id, p.display_name, r.created_at
  from referrals r
  join profiles p on p.id = r.referred_id
  where r.referrer_id = (select auth.uid())
  order by r.created_at desc;
$$;

revoke execute on function public.get_my_referrals() from anon, public;
grant execute on function public.get_my_referrals() to authenticated;
