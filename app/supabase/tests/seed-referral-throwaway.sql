-- Seed a disposable, pre-confirmed throwaway account for the referral E2E spec
-- (app/e2e/referral.spec.js). Bypasses email-confirmation friction the same way
-- seed-e2efull.sql does. Drop-then-create so it's safe to re-run before every
-- test run regardless of prior state. Run via the Supabase MCP execute_sql
-- (never the CLI - see memory). The spec deletes this account itself at the
-- end (via the in-app delete flow), so this script also exists to clean up
-- after an interrupted run.
do $$
declare v_id uuid := gen_random_uuid();
declare v_password text := 'REPLACE_ME';
begin
  -- AI-DEV NOTE: never commit a real password here. Paste your local
  -- E2E_REFERRAL_THROWAWAY_PASSWORD value into v_password before running, and do not save it.
  if v_password = 'REPLACE_ME' then raise exception 'Set v_password to your local E2E_REFERRAL_THROWAWAY_PASSWORD first'; end if;
  delete from auth.users where email = 'referral-throwaway@nithyakarma.test';

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    email_change_token_current, reauthentication_token, phone_change, phone_change_token
  ) values (
    '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated',
    'referral-throwaway@nithyakarma.test', crypt(v_password, gen_salt('bf')),
    now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    '', '', '', '', '', '', '', ''
  );
  insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (
    v_id::text, v_id,
    json_build_object('sub', v_id::text, 'email', 'referral-throwaway@nithyakarma.test', 'email_verified', true, 'phone_verified', false)::jsonb,
    'email', now(), now(), now()
  );
  raise notice 'referral-throwaway created: %', v_id;
end $$;
