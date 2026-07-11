-- 1. RLS initplan: (select auth.uid()) evaluates once per query, not per row
alter policy "own profile select" on public.profiles using (id = (select auth.uid()));
alter policy "own profile insert" on public.profiles with check (id = (select auth.uid()));
alter policy "own profile update" on public.profiles using (id = (select auth.uid()));
alter policy "own profile delete" on public.profiles using (id = (select auth.uid()));
alter policy "own family all" on public.family_members
  using (parent_id = (select auth.uid())) with check (parent_id = (select auth.uid()));
alter policy "own user_practices all" on public.user_practices
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
alter policy "own logs select" on public.practice_logs using (owner_id = (select auth.uid()));
alter policy "own logs delete" on public.practice_logs using (owner_id = (select auth.uid()));
alter policy "own referrals select" on public.referrals
  using (referrer_id = (select auth.uid()) or referred_id = (select auth.uid()));
alter policy "own prefs all" on public.notification_preferences
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
alter policy "own subs all" on public.push_subscriptions
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
alter policy "own deliveries select" on public.notification_deliveries using (user_id = (select auth.uid()));

-- 2. Missing FK indexes
create index idx_family_members_parent on public.family_members(parent_id);
create index idx_practice_logs_owner on public.practice_logs(owner_id);
create index idx_profiles_referred_by on public.profiles(referred_by);
create index idx_referrals_referrer on public.referrals(referrer_id);
create index idx_user_practices_family_member on public.user_practices(family_member_id);
create index idx_user_practices_practice on public.user_practices(practice_id);

-- 3. Platform helper function should not be client-callable
revoke execute on function public.rls_auto_enable() from anon, authenticated, public;

-- 4. pg_net out of public schema
drop extension if exists pg_net;
create extension pg_net schema extensions;

-- 5. Input validation: clamp client-supplied count in the submit RPC
create or replace function public.validate_count(p int) returns int
language sql immutable set search_path = public as $$
  select case when p is null or p < 1 or p > 10000 then null else p end
$$;