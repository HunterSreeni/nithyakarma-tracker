-- AI-DEV NOTE: Profiles are never deleted by the client. Account deletion is
-- delete_account (SECURITY DEFINER, deletes auth.users and cascades). The old
-- "own profile delete" policy let a user delete just their profile row, which
-- cascaded away their referrals row (unique on referred_id) - they could then
-- re-onboard and call apply_referral again, re-farming 30 ad-free days + a
-- freeze for both sides. See AGENTS.md "Referrals". Do not re-add a profile
-- DELETE policy or grant; FK cascades from auth.users are unaffected by this.

drop policy if exists "own profile delete" on public.profiles;
revoke delete on public.profiles from anon, authenticated;
