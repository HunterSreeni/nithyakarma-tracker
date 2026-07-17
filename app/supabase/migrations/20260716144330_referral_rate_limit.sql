-- S3: apply_referral had no rate limit - a referrer could be credited an
-- unlimited number of times by throwaway referred accounts, farming
-- ad-free days (the app's only monetization lever) indefinitely. Cap rewards
-- per referrer to 5 per rolling 24h; tune later from real referral data.
create or replace function public.apply_referral(p_code text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_referrer uuid; v_recent_count int;
begin
  select id into v_referrer from profiles where referral_code = p_code;
  if v_referrer is null then raise exception 'Invalid referral code'; end if;
  if v_referrer = auth.uid() then raise exception 'Cannot refer yourself'; end if;

  select count(*) into v_recent_count from referrals
    where referrer_id = v_referrer and created_at > now() - interval '24 hours';
  if v_recent_count >= 5 then
    raise exception 'This referral code has reached its daily limit - try again tomorrow';
  end if;

  insert into referrals (referrer_id, referred_id) values (v_referrer, auth.uid());
  update profiles set ad_free_until = greatest(coalesce(ad_free_until, current_date), current_date) + 30,
    referred_by = v_referrer,
    freeze_credits = least(freeze_credits + 1, freeze_cap_for(punya)) where id = auth.uid();
  update profiles set ad_free_until = greatest(coalesce(ad_free_until, current_date), current_date) + 30,
    freeze_credits = least(freeze_credits + 1, freeze_cap_for(punya)) where id = v_referrer;
  return jsonb_build_object('applied', true);
end $$;
