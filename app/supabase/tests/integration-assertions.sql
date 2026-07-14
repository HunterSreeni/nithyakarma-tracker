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
  if tier_for(99) <> 'Jijnasu' or tier_for(100) <> 'Sadhaka' or tier_for(400) <> 'Tapasvi'
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

  -- 8. Sandhyavandhanam 3-slot flow through submit_practice_log (the reported area).
  -- Impersonate integtest via the JWT claim auth.uid() reads. 1-2 slots must NOT
  -- complete the day or advance the streak; the 3rd slot completes it (+1 streak,
  -- 15 punya over the three logs). Hanuman-chalisa was already logged today in
  -- section 4, so completing sandhya also completes the day -> overall streak 1.
  insert into user_practices (owner_id, practice_id) values (v_uid, v_sandhya) returning id into v_sup;
  perform set_config('request.jwt.claims', json_build_object('sub', v_uid::text)::text, true);

  r := submit_practice_log(v_sup, 'morning');
  if (r->>'practice_done_today')::boolean then raise exception 'FAIL: sandhya reported done after 1 slot'; end if;
  if (r->>'practice_streak')::int <> 0 then raise exception 'FAIL: sandhya streak advanced on slot 1 (the reported 0-not-1 case)'; end if;
  if (r->>'day_complete')::boolean then raise exception 'FAIL: day complete after 1 sandhya slot'; end if;

  r := submit_practice_log(v_sup, 'afternoon');
  if (r->>'practice_done_today')::boolean then raise exception 'FAIL: sandhya reported done after 2 slots'; end if;
  if (r->>'practice_streak')::int <> 0 then raise exception 'FAIL: sandhya streak advanced on slot 2'; end if;

  r := submit_practice_log(v_sup, 'evening');
  if not (r->>'practice_done_today')::boolean then raise exception 'FAIL: sandhya NOT done after all 3 slots'; end if;
  if (r->>'practice_streak')::int <> 1 then raise exception 'FAIL: sandhya streak not 1 after completing 3 slots'; end if;
  if (r->>'punya')::int <> 15 then raise exception 'FAIL: punya not 15 after 3 sandhya logs (got %)', r->>'punya'; end if;
  if not (r->>'day_complete')::boolean then raise exception 'FAIL: day not complete though hanuman + sandhya both done'; end if;
  if (r->>'overall_streak')::int <> 1 then raise exception 'FAIL: overall streak not 1 on first fully complete day'; end if;

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

  -- 10. daily_count practice: the target count is stored on the log verbatim.
  insert into user_practices (owner_id, practice_id) values (v_uid, 9) returning id into v_upc; -- shiva-panchakshari (108)
  perform submit_practice_log(v_upc, null, 108);
  if (select count from practice_logs where user_practice_id = v_upc and log_date = current_date) <> 108 then
    raise exception 'FAIL: daily_count target not stored on log';
  end if;

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
    -- punya 95 + 1 practice log crosses to Sadhaka (100) -> cap 1->2 tops credits up;
    -- last complete 2 days ago (1-day gap) with a credit -> streak continues and consumes.
    insert into family_members (parent_id, name, gender, punya, current_streak, last_complete_date, freeze_credits)
      values (v_uid, 'Freeze Kid', 'female', 95, 5, current_date - 2, 1) returning id into v_kid2;
    insert into user_practices (owner_id, family_member_id, practice_id) values (v_uid, v_kid2, 2) returning id into v_kup;
    r := submit_practice_log(v_kup);
    if (r->>'overall_streak')::int <> 6 then raise exception 'FAIL: freeze did not continue kid streak (expected 6, got %)', r->>'overall_streak'; end if;
    if not (r->>'freeze_used')::boolean then raise exception 'FAIL: freeze_used not reported true'; end if;
    if (r->>'punya')::int <> 100 then raise exception 'FAIL: kid punya not 100 after tier-up'; end if;
    -- started 1 credit, tier-up tops to 2, consume 1 -> 1 remaining
    if (r->>'freeze_credits')::int <> 1 then raise exception 'FAIL: freeze credits wrong after tier-up+consume (expected 1, got %)', r->>'freeze_credits'; end if;
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

  raise notice 'ALL INTEGRATION ASSERTIONS PASSED';
end $$;
rollback;
