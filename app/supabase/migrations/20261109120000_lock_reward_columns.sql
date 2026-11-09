-- AI-DEV NOTE: Protected column allow-list. See AGENTS.md "Punya & tiers" /
-- "Streak & freeze". The owner RLS policies on profiles, family_members and
-- user_practices only scope WHICH ROW a user may write, and Supabase's default
-- table-level grants allowed EVERY column - so a signed-in user could PATCH
-- their own punya, ad_free_until, freeze_credits or streaks straight through
-- PostgREST, or flip practice_id/gender to bypass the Sandhyavandhanam
-- eligibility trigger. Reward/streak columns are now server-only: they are
-- written exclusively by SECURITY DEFINER RPCs/cron (submit_practice_log,
-- submit_yesterday_sandhya, apply_referral, decay_stale_streaks,
-- set_practice_archived), which run as the function owner and are unaffected.
-- Column-level grants only take effect once the table-level grant is revoked.
-- Adding a client-editable column later means adding it to a GRANT below.

revoke insert, update on public.profiles from anon, authenticated;
grant insert (id, display_name, gender, is_married, panchangam_tradition)
  on public.profiles to authenticated;
-- gender is deliberately NOT updatable: changing it after onboarding would
-- bypass check_sandhya_eligibility, which only runs on user_practices writes.
grant update (display_name, is_married, panchangam_tradition, leaderboard_opt_in,
              community_enabled, timezone)
  on public.profiles to authenticated;

revoke insert, update on public.family_members from anon, authenticated;
grant insert (parent_id, name, gender, upanayanam_done, bala_sabha_opt_in)
  on public.family_members to authenticated;
grant update (name, bala_sabha_opt_in) on public.family_members to authenticated;

-- No client UPDATE at all: archive/restore goes through set_practice_archived.
revoke insert, update on public.user_practices from anon, authenticated;
grant insert (owner_id, family_member_id, practice_id) on public.user_practices to authenticated;
