-- Full account deletion. The client previously deleted only the profiles row,
-- leaving the auth.users identity (email) behind - so "Delete my account & all
-- data" was untrue and orphaned auth users accumulated.
-- Deleting the auth user cascades to profiles (profiles.id -> auth.users.id
-- ON DELETE CASCADE) and from there to all owned rows.
--
-- AI-DEV NOTE: Protected deletion logic. See AGENTS.md "Account deletion" -
-- any new owner_id/user_id table needs a cascading FK back here, or this
-- silently orphans rows. Do not change the deletion mechanism without
-- Sreeni's explicit instruction.
create or replace function public.delete_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.delete_account() from public, anon;
grant execute on function public.delete_account() to authenticated;
