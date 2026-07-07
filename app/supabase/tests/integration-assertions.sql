-- SQL integration assertions for the nithyakarma backend.
-- Run in the Supabase SQL editor (or via MCP execute_sql). Requires the
-- seeded e2e user (e2e@nithyakarma.test) with no existing profile.
-- Everything rolls back - safe to run against production.
begin;
do $$
declare
  v_uid uuid;
  v_sandhya int;
  v_up uuid;
  v_failed boolean;
begin
  select id into v_uid from auth.users where email = 'e2e@nithyakarma.test';
  if v_uid is null then raise exception 'TEST SETUP: e2e user missing'; end if;

  -- 1. validate_count clamps garbage
  if validate_count(-5) is not null then raise exception 'FAIL: negative count accepted'; end if;
  if validate_count(99999) is not null then raise exception 'FAIL: absurd count accepted'; end if;
  if validate_count(108) <> 108 then raise exception 'FAIL: valid count rejected'; end if;
  if validate_count(null) is not null then raise exception 'FAIL: null count mishandled'; end if;

  -- 2. Sandhyavandhanam trigger blocks female profiles
  insert into profiles (id, display_name, gender) values (v_uid, 'Integration Test', 'female');
  select id into v_sandhya from practices where is_sandhyavandhanam;
  v_failed := false;
  begin
    insert into user_practices (owner_id, practice_id) values (v_uid, v_sandhya);
  exception when others then
    v_failed := true;
  end;
  if not v_failed then raise exception 'FAIL: female profile associated Sandhyavandhanam'; end if;

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

  raise notice 'ALL INTEGRATION ASSERTIONS PASSED';
end $$;
rollback;
