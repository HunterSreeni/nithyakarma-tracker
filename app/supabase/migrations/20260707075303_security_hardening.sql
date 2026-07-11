alter function public.tier_for(int) set search_path = public;
alter function public.is_scheduled(text, int, date) set search_path = public;
alter function public.prev_scheduled(text, date) set search_path = public;

-- RPCs: signed-in users only
revoke execute on function public.submit_practice_log(uuid, text, int) from anon, public;
revoke execute on function public.get_leaderboard(text, text) from anon, public;
revoke execute on function public.apply_referral(text) from anon, public;
grant execute on function public.submit_practice_log(uuid, text, int) to authenticated;
grant execute on function public.get_leaderboard(text, text) to authenticated;
grant execute on function public.apply_referral(text) to authenticated;

-- Trigger function: not directly callable by anyone
revoke execute on function public.check_sandhya_eligibility() from anon, authenticated, public;