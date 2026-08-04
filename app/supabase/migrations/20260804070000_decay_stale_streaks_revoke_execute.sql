-- decay_stale_streaks() is a maintenance job meant to run only via the
-- decay-stale-streaks-daily pg_cron schedule. It takes no arguments and
-- applies to every user's rows unconditionally (no auth.uid() scoping,
-- unlike submit_practice_log), so unlike the app's normal RPCs it should
-- never be reachable through the public REST API at all. The Postgres
-- default is EXECUTE granted to PUBLIC on function creation - the initial
-- migration (20260802093000) missed the revoke every other internal-only
-- function here already carries (see check_sandhya_eligibility,
-- rls_auto_enable). Caught by mcp__supabase__get_advisors after applying.
revoke execute on function public.decay_stale_streaks() from anon, authenticated, public;
