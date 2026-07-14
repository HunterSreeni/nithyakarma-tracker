-- Seed a disposable, pre-confirmed, pre-onboarded, AD-FREE throwaway account
-- for the Android sandhya E2E flow (e2e/android-sandhya.sh). Mirrors
-- seed-e2efull.sql / seed-referral-throwaway.sql for the auth user, then also
-- seeds the profile + Sandhyavandhanam user_practice directly so the script
-- can skip onboarding and land straight on the Today page.
--
-- ad_free_until is set to the far future so showInterstitial() (src/utils/ads.js)
-- skips the real AdMob test interstitial entirely - driving taps blind while a
-- live (test) ad overlay is rendering is what made earlier runs occasionally
-- mis-tap into the ad's click-through instead of the app's own Continue button.
--
-- Drop-then-create so it's safe to re-run before every test run. Run via the
-- Supabase MCP execute_sql (never the CLI - see memory). The script deletes
-- this account's auth user itself at the end.
do $$
declare v_id uuid := gen_random_uuid();
declare v_sandhya int;
begin
  delete from auth.users where email = 'android-sandhya-throwaway@nithyakarma.test';

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    email_change_token_current, reauthentication_token, phone_change, phone_change_token
  ) values (
    '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated',
    'android-sandhya-throwaway@nithyakarma.test', crypt('AndroidSandhya2026xyz', gen_salt('bf')),
    now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    '', '', '', '', '', '', '', ''
  );
  insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (
    v_id::text, v_id,
    json_build_object('sub', v_id::text, 'email', 'android-sandhya-throwaway@nithyakarma.test', 'email_verified', true, 'phone_verified', false)::jsonb,
    'email', now(), now(), now()
  );

  insert into profiles (id, display_name, gender, ad_free_until)
    values (v_id, 'Android Sandhya', 'male', current_date + 365);

  select id into v_sandhya from practices where is_sandhyavandhanam;
  insert into user_practices (owner_id, practice_id) values (v_id, v_sandhya);

  raise notice 'android-sandhya-throwaway created: %', v_id;
end $$;
