-- Seed a disposable, pre-confirmed throwaway account for the Android referral
-- E2E flow (e2e/android-referral.sh). Deliberately NOT pre-onboarded (unlike
-- seed-android-sandhya-throwaway.sql) - the point of this flow is to exercise
-- the real onboarding UI's manual referral-code entry field, since Android
-- has no ?ref= deep link the way the web app does. Drop-then-create so it's
-- safe to re-run before every test run. Run via the Supabase MCP execute_sql
-- (never the CLI - see memory). The script deletes this account itself at
-- the end via direct SQL (mirrors android-sandhya.sh's cleanup pattern).
do $$
declare v_id uuid := gen_random_uuid();
begin
  delete from auth.users where email = 'android-referral-throwaway@nithyakarma.test';

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    email_change_token_current, reauthentication_token, phone_change, phone_change_token
  ) values (
    '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated',
    'android-referral-throwaway@nithyakarma.test', crypt('AndroidReferral2026xyz', gen_salt('bf')),
    now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    '', '', '', '', '', '', '', ''
  );
  insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (
    v_id::text, v_id,
    json_build_object('sub', v_id::text, 'email', 'android-referral-throwaway@nithyakarma.test', 'email_verified', true, 'phone_verified', false)::jsonb,
    'email', now(), now(), now()
  );
  raise notice 'android-referral-throwaway created: %', v_id;
end $$;
