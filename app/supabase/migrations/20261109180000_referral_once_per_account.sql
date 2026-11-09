-- Referral hardening (2026-11-09, authorized by Sreeni): apply_referral relied
-- only on referrals.referred_id being unique for "once per referred account".
-- Also refuse when the caller's profile already has referred_by set, so the
-- rule holds even if the referrals row is ever gone (the profile self-delete
-- path that allowed that was closed in 20261109140000).
--
-- AI-DEV NOTE: Protected referral logic. See AGENTS.md "Referrals". Body is
-- byte-identical to 20260716144330_referral_rate_limit.sql (md5 of prod prosrc
-- verified) except the referred_by guard. Rewards, cap and self-referral guard
-- are unchanged.
create or replace function public.apply_referral(p_code text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_referrer uuid; v_recent_count int;
begin
  select id into v_referrer from profiles where referral_code = p_code;
  if v_referrer is null then raise exception 'Invalid referral code'; end if;
  if v_referrer = auth.uid() then raise exception 'Cannot refer yourself'; end if;
  if exists (select 1 from profiles where id = auth.uid() and referred_by is not null) then
    raise exception 'A referral code has already been applied to this account';
  end if;

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
