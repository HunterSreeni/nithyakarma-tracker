-- AI-DEV NOTE: Protected push ownership rule. See AGENTS.md "Notifications &
-- reminders". One physical device/browser endpoint belongs to exactly ONE
-- account - the one that registered it most recently. The client used to
-- "reclaim" a shared endpoint with delete().eq(endpoint).neq(user_id), but RLS
-- ("own subs all") silently scopes that delete to the caller's own rows, so it
-- never removed the previous account's row. Two accounts signed in on one phone
-- then each had a row for the same FCM token, and send-reminders (deduped per
-- user_id+endpoint) delivered every reminder twice to that device.
-- Enforced here, server-side, so already-installed app builds are fixed too.

create or replace function public.push_subscriptions_single_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Runs only after RLS has already accepted the insert as the caller's own
  -- row (with check user_id = auth.uid()), so this can only hand a device to
  -- whoever actually holds its token.
  delete from public.push_subscriptions
   where endpoint = new.endpoint and user_id <> new.user_id;
  return new;
end;
$$;

revoke all on function public.push_subscriptions_single_owner() from public, anon, authenticated;

create trigger push_subscriptions_single_owner
  before insert on public.push_subscriptions
  for each row execute function public.push_subscriptions_single_owner();

-- One-off cleanup of endpoints already shared between accounts: keep the
-- newest row (the account that registered the device last).
delete from public.push_subscriptions p
 using public.push_subscriptions newer
 where newer.endpoint = p.endpoint
   and newer.user_id <> p.user_id
   and (newer.created_at, newer.id) > (p.created_at, p.id);
