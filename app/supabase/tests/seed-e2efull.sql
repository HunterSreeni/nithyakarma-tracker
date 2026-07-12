-- Reseed the disposable destructive-e2e account (e2efull@nithyakarma.test).
-- The Playwright journey (app/e2e/journey.spec.js) deletes this account via the
-- delete_account RPC at the end of each run, so re-run this before the next run.
-- Run via the Supabase MCP execute_sql (never the CLI - see memory). Idempotent.
do $$
declare v_id uuid := gen_random_uuid();
begin
  if exists (select 1 from auth.users where email = 'e2efull@nithyakarma.test') then
    raise notice 'e2efull already exists, skipping';
    return;
  end if;
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    email_change_token_current, reauthentication_token, phone_change, phone_change_token
  ) values (
    '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated',
    'e2efull@nithyakarma.test', crypt('E2eFull#2026', gen_salt('bf')),
    now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    '', '', '', '', '', '', '', ''
  );
  insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (
    v_id::text, v_id,
    json_build_object('sub', v_id::text, 'email', 'e2efull@nithyakarma.test', 'email_verified', true, 'phone_verified', false)::jsonb,
    'email', now(), now(), now()
  );
  raise notice 'e2efull created: %', v_id;
end $$;
