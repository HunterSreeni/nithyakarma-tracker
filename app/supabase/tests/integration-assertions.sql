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

  raise notice 'ALL INTEGRATION ASSERTIONS PASSED';
end $$;
rollback;
