-- SQL integration assertions for the nithyakarma backend.
-- Run in the Supabase SQL editor (or via MCP execute_sql). Requires the
-- dedicated integtest user (integtest@nithyakarma.test) with NO existing profile
-- (kept separate from the e2e UI account, which does have a profile).
-- Everything rolls back - safe to run against production.
begin;
do $$
declare
  v_uid uuid;
  v_sandhya int;
  v_up uuid;
  v_girl uuid;
  v_sup uuid;
  v_upc uuid;
  v_ups uuid;
  v_ups2 uuid;
  v_kid uuid;
  v_up2 uuid;
  v_code text;
  r jsonb;
  v_failed boolean;
  v_lb_score bigint;
begin
  select id into v_uid from auth.users where email = 'integtest@nithyakarma.test';
  if v_uid is null then raise exception 'TEST SETUP: integtest user missing'; end if;

  -- 1. validate_count clamps garbage
  if validate_count(-5) is not null then raise exception 'FAIL: negative count accepted'; end if;
  if validate_count(99999) is not null then raise exception 'FAIL: absurd count accepted'; end if;
  if validate_count(108) <> 108 then raise exception 'FAIL: valid count rejected'; end if;
  if validate_count(null) is not null then raise exception 'FAIL: null count mishandled'; end if;

  -- 2. Sandhyavandhanam trigger blocks female subjects. The integtest profile is
  -- created MALE (so section 8 can exercise the sandhya RPC end-to-end); the
  -- female-block path is asserted against a female family member instead.
  insert into profiles (id, display_name, gender) values (v_uid, 'Integration Test', 'male');
  select id into v_sandhya from practices where is_sandhyavandhanam;
  insert into family_members (parent_id, name, gender) values (v_uid, 'Test Girl', 'female') returning id into v_girl;
  v_failed := false;
  begin
    insert into user_practices (owner_id, family_member_id, practice_id) values (v_uid, v_girl, v_sandhya);
  exception when others then
    v_failed := true;
  end;
  if not v_failed then raise exception 'FAIL: female subject associated Sandhyavandhanam'; end if;

  -- 3. Trigger blocks boys without upanayanam, allows with
  declare v_boy uuid;
  begin
    insert into family_members (parent_id, name, gender, upanayanam_done)
      values (v_uid, 'Test Boy', 'male', false) returning id into v_boy;
    v_failed := false;
    begin
      insert into user_practices (owner_id, family_member_id, practice_id) values (v_uid, v_boy, v_sandhya);
    exception when others then v_failed := true;
    end;
    if not v_failed then raise exception 'FAIL: boy without upanayanam got Sandhyavandhanam'; end if;
    update family_members set upanayanam_done = true where id = v_boy;
    insert into user_practices (owner_id, family_member_id, practice_id) values (v_uid, v_boy, v_sandhya);
  end;

  -- 4. Duplicate same-day log rejected by unique index
  insert into user_practices (owner_id, practice_id)
    values (v_uid, (select id from practices where slug = 'hanuman-chalisa')) returning id into v_up;
  insert into practice_logs (user_practice_id, owner_id, log_date) values (v_up, v_uid, current_date);
  v_failed := false;
  begin
    insert into practice_logs (user_practice_id, owner_id, log_date) values (v_up, v_uid, current_date);
  exception when unique_violation then v_failed := true;
  end;
  if not v_failed then raise exception 'FAIL: duplicate same-day log accepted'; end if;

  -- 5. tier_for boundaries match the client mirror (src/utils/tiers.js)
  if tier_for(99) <> 'Shishya' or tier_for(100) <> 'Sadhaka' or tier_for(400) <> 'Yogi'
     or tier_for(1000) <> 'Rishi' or tier_for(2500) <> 'Brahmarishi' then
    raise exception 'FAIL: tier boundaries drifted from client';
  end if;

  -- 6. notification_deliveries dedup: the edge function relies on a unique
  -- (user_id, reminder_date, slot, endpoint) to avoid double-sending a slot.
  insert into notification_deliveries (user_id, reminder_date, slot, endpoint)
    values (v_uid, current_date, 'morning', 'https://push.test/endpoint-1');
  v_failed := false;
  begin
    insert into notification_deliveries (user_id, reminder_date, slot, endpoint)
      values (v_uid, current_date, 'morning', 'https://push.test/endpoint-1');
  exception when unique_violation then v_failed := true;
  end;
  if not v_failed then raise exception 'FAIL: duplicate notification delivery accepted (dedup broken)'; end if;

  -- 7. delete_account RPC exists, is SECURITY DEFINER, and anon cannot run it
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'delete_account' and p.prosecdef
  ) then raise exception 'FAIL: delete_account RPC missing or not SECURITY DEFINER'; end if;
  if has_function_privilege('anon', 'public.delete_account()', 'execute') then
    raise exception 'FAIL: anon can execute delete_account';
  end if;

  -- 8. Sandhyavandhanam 1-of-3-slot flow through submit_practice_log (2026-07-20:
  -- meet-users-where-they-are change - marking just 1 slot now completes the day
  -- and advances the streak; the 2nd/3rd slots only add punya, they don't
  -- double-advance anything). Impersonate integtest via the JWT claim auth.uid()
  -- reads. Hanuman-chalisa was logged directly in section 4 (bypassing the RPC,
  -- so it earned no punya and has affects_streak=false), so day completion here
  -- depends on sandhya alone.
  insert into user_practices (owner_id, practice_id) values (v_uid, v_sandhya) returning id into v_sup;
  perform set_config('request.jwt.claims', json_build_object('sub', v_uid::text)::text, true);

  -- Leaderboard baseline: hanuman-chalisa (section 4) already logged today, so
  -- score = 1 distinct (date, practice) pair before any sandhya slot is marked.
  select score into v_lb_score from get_leaderboard('week', 'global') where subject_id = v_uid;
  if v_lb_score <> 1 then raise exception 'FAIL: leaderboard baseline score wrong (expected 1, got %)', v_lb_score; end if;

  r := submit_practice_log(v_sup, 'morning');
  if not (r->>'practice_done_today')::boolean then raise exception 'FAIL: sandhya not reported done after 1 slot (1-of-3 should be enough)'; end if;
  if (r->>'practice_streak')::int <> 1 then raise exception 'FAIL: sandhya streak did not advance on slot 1 (expected 1, got %)', r->>'practice_streak'; end if;
  if not (r->>'day_complete')::boolean then raise exception 'FAIL: day not complete after 1 sandhya slot'; end if;
  if (r->>'overall_streak')::int <> 1 then raise exception 'FAIL: overall streak not 1 after completing the day on slot 1'; end if;
  if (r->>'punya')::int <> 5 then raise exception 'FAIL: punya not 5 after 1 sandhya log (got %)', r->>'punya'; end if;
  select score into v_lb_score from get_leaderboard('week', 'global') where subject_id = v_uid;
  if v_lb_score <> 2 then raise exception 'FAIL: leaderboard score did not count the completed sandhya day (expected 2, got %)', v_lb_score; end if;

  r := submit_practice_log(v_sup, 'afternoon');
  if not (r->>'practice_done_today')::boolean then raise exception 'FAIL: sandhya reported not done after 2 slots'; end if;
  if (r->>'practice_streak')::int <> 1 then raise exception 'FAIL: sandhya streak double-advanced on slot 2 (expected still 1, got %)', r->>'practice_streak'; end if;
  if (r->>'punya')::int <> 10 then raise exception 'FAIL: punya not 10 after 2 sandhya logs (got %)', r->>'punya'; end if;
  select score into v_lb_score from get_leaderboard('week', 'global') where subject_id = v_uid;
  if v_lb_score <> 2 then raise exception 'FAIL: leaderboard score double-counted the 2nd sandhya slot (expected still 2, got %)', v_lb_score; end if;

  r := submit_practice_log(v_sup, 'evening');
  if not (r->>'practice_done_today')::boolean then raise exception 'FAIL: sandhya NOT done after all 3 slots'; end if;
  if (r->>'practice_streak')::int <> 1 then raise exception 'FAIL: sandhya streak not still 1 after completing all 3 slots'; end if;
  if (r->>'punya')::int <> 15 then raise exception 'FAIL: punya not 15 after 3 sandhya logs (got %)', r->>'punya'; end if;
  if not (r->>'day_complete')::boolean then raise exception 'FAIL: day not complete on the 3rd slot'; end if;
  if (r->>'overall_streak')::int <> 1 then raise exception 'FAIL: overall streak not still 1 after the 3rd slot'; end if;
  select score into v_lb_score from get_leaderboard('week', 'global') where subject_id = v_uid;
  if v_lb_score <> 2 then raise exception 'FAIL: leaderboard score changed after marking all 3 slots (expected still 2, got %)', v_lb_score; end if;

  -- Re-marking an already-done slot is rejected (unique same-day slot)
  v_failed := false;
  begin
    perform submit_practice_log(v_sup, 'evening');
  exception when others then v_failed := true;
  end;
  if not v_failed then raise exception 'FAIL: duplicate sandhya slot accepted'; end if;

  -- 9. apply_referral: self/invalid rejected; a valid code grants +30 ad-free days.
  -- Referrer = any other existing profile (the e2e account). integtest is referred.
  select referral_code into v_code from profiles where id <> v_uid and referral_code is not null
    order by created_at limit 1;
  if v_code is null then
    raise notice 'SKIP referral test: no other profile to refer from';
  else
    v_failed := false;
    begin perform apply_referral((select referral_code from profiles where id = v_uid));
    exception when others then v_failed := true; end;
    if not v_failed then raise exception 'FAIL: self-referral accepted'; end if;

    v_failed := false;
    begin perform apply_referral('zzzz9999');
    exception when others then v_failed := true; end;
    if not v_failed then raise exception 'FAIL: invalid referral code accepted'; end if;

    update profiles set freeze_credits = 0 where id = v_uid;
    perform apply_referral(v_code);
    if (select ad_free_until from profiles where id = v_uid) is distinct from (current_date + 30) then
      raise exception 'FAIL: valid referral did not grant 30 ad-free days';
    end if;
    if (select freeze_credits from profiles where id = v_uid) <> 1 then
      raise exception 'FAIL: valid referral did not grant +1 freeze credit';
    end if;
  end if;

  -- 9b. apply_referral rate limit (S3): a referrer can only be credited 5 times
  -- per rolling 24h - throwaway accounts referring the same code past that cap
  -- must be rejected, not silently keep stacking ad-free days.
  declare
    v_test_referrer uuid := gen_random_uuid();
    v_test_code text;
    v_throwaway uuid;
    v_i int;
  begin
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
      confirmation_token, recovery_token, email_change_token_new, email_change,
      email_change_token_current, reauthentication_token, phone_change, phone_change_token
    ) values (
      '00000000-0000-0000-0000-000000000000', v_test_referrer, 'authenticated', 'authenticated',
      'ratelimit-referrer@nithyakarma.test', crypt('RateLimitReferrer#2026', gen_salt('bf')),
      now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
      '', '', '', '', '', '', '', ''
    );
    insert into profiles (id, display_name, gender) values (v_test_referrer, 'Rate Limit Referrer', 'male');
    select referral_code into v_test_code from profiles where id = v_test_referrer;

    for v_i in 1..6 loop
      v_throwaway := gen_random_uuid();
      insert into auth.users (
        instance_id, id, aud, role, email, encrypted_password,
        email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
        confirmation_token, recovery_token, email_change_token_new, email_change,
        email_change_token_current, reauthentication_token, phone_change, phone_change_token
      ) values (
        '00000000-0000-0000-0000-000000000000', v_throwaway, 'authenticated', 'authenticated',
        'ratelimit-throwaway-' || v_i || '@nithyakarma.test', crypt('RateLimitThrowaway#2026', gen_salt('bf')),
        now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
        '', '', '', '', '', '', '', ''
      );
      insert into profiles (id, display_name, gender) values (v_throwaway, 'Rate Limit Throwaway ' || v_i, 'male');
      perform set_config('request.jwt.claims', json_build_object('sub', v_throwaway::text)::text, true);

      v_failed := false;
      begin
        perform apply_referral(v_test_code);
      exception when others then v_failed := true;
      end;

      if v_i <= 5 and v_failed then
        raise exception 'FAIL: referral %/5 within the daily cap was rejected', v_i;
      end if;
      if v_i = 6 and not v_failed then
        raise exception 'FAIL: 6th referral within 24h exceeded the cap but was accepted';
      end if;
    end loop;
    -- restore integtest impersonation for the remaining sections
    perform set_config('request.jwt.claims', json_build_object('sub', v_uid::text)::text, true);
  end;

  -- 10. daily_count practice: the target count is stored on the log verbatim.
  insert into user_practices (owner_id, practice_id) values (v_uid, 9) returning id into v_upc; -- shiva-panchakshari (108)
  perform submit_practice_log(v_upc, null, 108);
  if (select count from practice_logs where user_practice_id = v_upc and log_date = current_date) <> 108 then
    raise exception 'FAIL: daily_count target not stored on log';
  end if;

  -- 10b. submit_practice_log honors a client-supplied p_local_date within
  -- +/-1 day of the server date (B1: fixes early-morning IST logs landing on
  -- the wrong UTC date), but ignores a wildly-off date to prevent streak-gaming.
  declare v_up_tz uuid;
  begin
    insert into user_practices (owner_id, practice_id) values (v_uid, 2) returning id into v_up_tz; -- vishnu
    perform submit_practice_log(v_up_tz, null, null, current_date - 1);
    if (select log_date from practice_logs where user_practice_id = v_up_tz) <> current_date - 1 then
      raise exception 'FAIL: p_local_date within bound was not honored';
    end if;
    delete from user_practices where id = v_up_tz;

    insert into user_practices (owner_id, practice_id) values (v_uid, 3) returning id into v_up_tz; -- lalitha
    perform submit_practice_log(v_up_tz, null, null, current_date - 3);
    if (select log_date from practice_logs where user_practice_id = v_up_tz) <> current_date then
      raise exception 'FAIL: an out-of-bound p_local_date was honored instead of falling back to current_date';
    end if;
    delete from user_practices where id = v_up_tz; -- section 12 re-uses practice_id 3 for v_uid
  end;

  -- 11. sequence practice: position increments, then cycles back to 1 at length.
  insert into user_practices (owner_id, practice_id, sequence_position, last_log_date)
    values (v_uid, 6, 5, current_date - 1) returning id into v_ups; -- bhagavad-gita, length 18
  r := submit_practice_log(v_ups);
  if (r->>'sequence_position')::int <> 6 then raise exception 'FAIL: sequence position did not increment (5->6)'; end if;
  insert into user_practices (owner_id, practice_id, sequence_position)
    values (v_uid, 5, 100) returning id into v_ups2; -- narayaneeyam, length 100 -> cycles
  r := submit_practice_log(v_ups2);
  if (r->>'sequence_position')::int <> 1 then raise exception 'FAIL: sequence did not cycle to 1 at length'; end if;

  -- 12. per-practice streak: consecutive-day continuity increments; a gap resets to 1.
  insert into user_practices (owner_id, practice_id, current_streak, last_log_date)
    values (v_uid, 2, 3, current_date - 1) returning id into v_up2; -- vishnu, logged yesterday
  r := submit_practice_log(v_up2);
  if (r->>'practice_streak')::int <> 4 then raise exception 'FAIL: streak did not continue (3->4) on consecutive day'; end if;
  insert into user_practices (owner_id, practice_id, current_streak, last_log_date)
    values (v_uid, 3, 3, current_date - 3) returning id into v_ups; -- lalitha, 2-day gap
  r := submit_practice_log(v_ups);
  if (r->>'practice_streak')::int <> 1 then raise exception 'FAIL: streak did not reset to 1 after a gap'; end if;

  -- 13. Removing a family member cascades their user_practices and logs.
  insert into family_members (parent_id, name, gender) values (v_uid, 'Cascade Kid', 'female') returning id into v_kid;
  insert into user_practices (owner_id, family_member_id, practice_id) values (v_uid, v_kid, 2) returning id into v_up2;
  insert into practice_logs (user_practice_id, owner_id, log_date) values (v_up2, v_uid, current_date);
  delete from family_members where id = v_kid;
  if exists (select 1 from user_practices where id = v_up2) then raise exception 'FAIL: user_practice not cascaded on family delete'; end if;
  if exists (select 1 from practice_logs where user_practice_id = v_up2) then raise exception 'FAIL: logs not cascaded on family delete'; end if;

  -- 14. Streak freeze (Intent 1.1): caps by tier, the pure state machine, and the
  -- full path (tier-up top-up + freeze consume in one submit) via a kid subject.
  if freeze_cap_for(99) <> 1 or freeze_cap_for(100) <> 2 or freeze_cap_for(400) <> 3
     or freeze_cap_for(1000) <> 4 or freeze_cap_for(2500) <> 5 then
    raise exception 'FAIL: freeze_cap_for tiers wrong';
  end if;
  if (select new_streak from streak_after_completion(5,5,current_date-1,current_date,0)) <> 6
     or (select freeze_used from streak_after_completion(5,5,current_date-1,current_date,0)) then
    raise exception 'FAIL: freeze gap-0 (consecutive) wrong';
  end if;
  if (select new_streak from streak_after_completion(5,5,current_date-2,current_date,1)) <> 6
     or (select new_freeze from streak_after_completion(5,5,current_date-2,current_date,1)) <> 0
     or not (select freeze_used from streak_after_completion(5,5,current_date-2,current_date,1)) then
    raise exception 'FAIL: freeze gap-1-with-credit should continue and consume';
  end if;
  if (select new_streak from streak_after_completion(5,5,current_date-2,current_date,0)) <> 1
     or (select freeze_used from streak_after_completion(5,5,current_date-2,current_date,0)) then
    raise exception 'FAIL: freeze gap-1-no-credit should reset';
  end if;
  if (select new_streak from streak_after_completion(5,5,current_date-3,current_date,1)) <> 1
     or (select new_freeze from streak_after_completion(5,5,current_date-3,current_date,1)) <> 1
     or (select freeze_used from streak_after_completion(5,5,current_date-3,current_date,1)) then
    raise exception 'FAIL: freeze gap-2 should reset without consuming';
  end if;
  declare v_kid2 uuid; v_kup uuid;
  begin
    -- punya 95 + 1 practice log (practice_id 2, vishnu-sahasranamam, punya_value 8)
    -- crosses to Sadhaka (100) -> cap 1->2 tops credits up; last complete 2 days
    -- ago (1-day gap) with a credit -> streak continues and consumes.
    insert into family_members (parent_id, name, gender, punya, current_streak, last_complete_date, freeze_credits)
      values (v_uid, 'Freeze Kid', 'female', 95, 5, current_date - 2, 1) returning id into v_kid2;
    insert into user_practices (owner_id, family_member_id, practice_id) values (v_uid, v_kid2, 2) returning id into v_kup;
    r := submit_practice_log(v_kup);
    if (r->>'overall_streak')::int <> 6 then raise exception 'FAIL: freeze did not continue kid streak (expected 6, got %)', r->>'overall_streak'; end if;
    if not (r->>'freeze_used')::boolean then raise exception 'FAIL: freeze_used not reported true'; end if;
    if (r->>'punya')::int <> 103 then raise exception 'FAIL: kid punya not 103 after tier-up (95 + punya_value 8)'; end if;
    -- started 1 credit, tier-up tops to 2, consume 1 -> 1 remaining
    if (r->>'freeze_credits')::int <> 1 then raise exception 'FAIL: freeze credits wrong after tier-up+consume (expected 1, got %)', r->>'freeze_credits'; end if;
  end;

  -- 15. Weekly cadence: prev_scheduled() gives continuity across exactly one
  -- calendar week (not calendar-yesterday), a missed week resets to 1, and the
  -- RPC refuses a weekly practice on a non-matching weekday.
  declare
    v_wd int := extract(dow from current_date)::int;
    v_practice_wa int;
    v_practice_wb int;
    v_practice_wc int;
    v_up_wa uuid;
    v_up_wb uuid;
    v_up_wc uuid;
  begin
    insert into practices (slug, name, icon, cadence, weekday, is_sandhyavandhanam)
      values ('test-weekly-a-' || v_wd, 'Test Weekly A', '🗓️', 'weekly', v_wd, false)
      returning id into v_practice_wa;
    insert into practices (slug, name, icon, cadence, weekday, is_sandhyavandhanam)
      values ('test-weekly-b-' || v_wd, 'Test Weekly B', '🗓️', 'weekly', v_wd, false)
      returning id into v_practice_wb;
    insert into practices (slug, name, icon, cadence, weekday, is_sandhyavandhanam)
      values ('test-weekly-c-' || v_wd, 'Test Weekly C', '🗓️', 'weekly', (v_wd + 1) % 7, false)
      returning id into v_practice_wc;

    -- (a) last logged exactly 7 days ago (same weekday) -> streak continues
    insert into user_practices (owner_id, practice_id, current_streak, last_log_date)
      values (v_uid, v_practice_wa, 3, current_date - 7) returning id into v_up_wa;
    r := submit_practice_log(v_up_wa);
    if (r->>'practice_streak')::int <> 4 then
      raise exception 'FAIL: weekly streak did not continue across exactly one week (3->4)';
    end if;

    -- (b) last logged 14 days ago (missed a whole scheduled week) -> resets to 1
    insert into user_practices (owner_id, practice_id, current_streak, last_log_date)
      values (v_uid, v_practice_wb, 3, current_date - 14) returning id into v_up_wb;
    r := submit_practice_log(v_up_wb);
    if (r->>'practice_streak')::int <> 1 then
      raise exception 'FAIL: weekly streak did not reset after a missed week';
    end if;

    -- (c) weekly practice scheduled on a different weekday cannot be logged today
    insert into user_practices (owner_id, practice_id) values (v_uid, v_practice_wc) returning id into v_up_wc;
    v_failed := false;
    begin
      perform submit_practice_log(v_up_wc);
    exception when others then v_failed := true;
    end;
    if not v_failed then raise exception 'FAIL: weekly practice logged on a non-scheduled weekday'; end if;
  end;

  -- N. push_subscriptions: the unique constraint is (user_id, endpoint) now,
  -- not endpoint alone - two different accounts must each be able to hold a
  -- row for the same physical device/browser endpoint (e.g. shared test
  -- hardware), which is exactly what silently broke push in production.
  -- Reuses the persistent e2e account as a second real profile.
  declare
    v_e2e_uid uuid;
    v_shared_endpoint text := 'test-shared-endpoint-' || gen_random_uuid();
  begin
    select id into v_e2e_uid from auth.users where email = 'e2e@nithyakarma.test';
    if v_e2e_uid is null then raise exception 'TEST SETUP: e2e user missing'; end if;
    insert into push_subscriptions (user_id, endpoint, platform) values (v_uid, v_shared_endpoint, 'android');
    v_failed := false;
    begin
      insert into push_subscriptions (user_id, endpoint, platform) values (v_e2e_uid, v_shared_endpoint, 'android');
    exception when unique_violation then
      v_failed := true;
    end;
    if v_failed then raise exception 'FAIL: two different accounts could not each hold a row for the same endpoint (unique constraint still global)'; end if;
    -- same user + same endpoint must still be rejected - this is what the
    -- client's onConflict:'user_id,endpoint' upsert relies on.
    v_failed := false;
    begin
      insert into push_subscriptions (user_id, endpoint, platform) values (v_uid, v_shared_endpoint, 'android');
    exception when unique_violation then
      v_failed := true;
    end;
    if not v_failed then raise exception 'FAIL: duplicate (user_id, endpoint) was accepted'; end if;
  end;

  -- 16. p_award_streak = false (learning-progress verse marks must not drive
  -- streaks): a log can still award punya and mark the practice done-for-today,
  -- but must not advance the per-practice streak or the subject's overall streak.
  declare
    v_up_award uuid;
    v_overall_before int;
    v_punya_before int;
  begin
    select current_streak, punya into v_overall_before, v_punya_before from profiles where id = v_uid;
    insert into user_practices (owner_id, practice_id, current_streak, last_log_date)
      values (v_uid, 11, 3, current_date - 1) returning id into v_up_award; -- soundarya-lahari, punya_value 8
    r := submit_practice_log(v_up_award, null, null, null, false);
    if not (r->>'practice_done_today')::boolean then
      raise exception 'FAIL: award_streak=false log not marked done today';
    end if;
    if (r->>'practice_streak')::int <> 3 then
      raise exception 'FAIL: award_streak=false advanced the per-practice streak (expected unchanged 3, got %)', r->>'practice_streak';
    end if;
    if (r->>'punya')::int <> v_punya_before + 8 then
      raise exception 'FAIL: award_streak=false did not award punya (expected %, got %)', v_punya_before + 8, r->>'punya';
    end if;
    if (select current_streak from profiles where id = v_uid) <> v_overall_before then
      raise exception 'FAIL: award_streak=false advanced the overall streak (expected unchanged %, got %)',
        v_overall_before, (select current_streak from profiles where id = v_uid);
    end if;
  end;

  -- 17. punya_value: seeded weights differ by tier (light/moderate/demanding),
  -- not the old flat 5-for-everything.
  if (select punya_value from practices where slug = 'hanuman-chalisa') <> 5 then
    raise exception 'FAIL: hanuman-chalisa punya_value drifted from light tier (5)';
  end if;
  if (select punya_value from practices where slug = 'vishnu-sahasranamam') <> 8 then
    raise exception 'FAIL: vishnu-sahasranamam punya_value drifted from moderate tier (8)';
  end if;
  if (select punya_value from practices where slug = 'sri-rudram') <> 12 then
    raise exception 'FAIL: sri-rudram punya_value drifted from demanding tier (12)';
  end if;

  -- 18. notification_deliveries.slot CHECK covers every literal send-reminders
  -- actually uses, including the two added for Phase 3 (tharpanam/observance
  -- calendar notifications). This is the exact regression class that hid the
  -- 'nudge_morning' slot for months (section 6 covers dedup; this covers the
  -- CHECK itself) - one row per slot, distinct endpoints to avoid the dedup
  -- constraint masking a CHECK failure.
  declare
    v_slot text;
  begin
    foreach v_slot in array array['morning','afternoon','evening','nudge','nudge_morning','tharpanam','observance']
    loop
      v_failed := false;
      begin
        insert into notification_deliveries (user_id, reminder_date, slot, endpoint)
          values (v_uid, current_date, v_slot, 'https://push.test/slot-check-' || v_slot);
      exception when others then
        v_failed := true;
      end;
      if v_failed then raise exception 'FAIL: slot % rejected by the notification_deliveries CHECK constraint', v_slot; end if;
    end loop;
  end;

  raise notice 'ALL INTEGRATION ASSERTIONS PASSED';
end $$;
rollback;
