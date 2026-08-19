-- Brahmayagnam: one of the panchamahayajnas, daily Veda study/recitation -
-- traditionally a grihastha's (married householder's) obligation, the mirror
-- image of Samidhadhanam's brahmachari-only gate. Reuses the same trigger
-- rather than adding a second one, same reasoning as requires_brahmachari.
--
-- Purusha Suktam: Rigveda 10.90, no gender/marital gate - open to anyone,
-- like Vishnu Sahasranamam and the other general stotrams.

alter table public.practices add column requires_grihastha boolean not null default false;

insert into public.practices (slug, name, icon, cadence, is_sandhyavandhanam, requires_grihastha, punya_value, affects_streak)
values ('brahmayagnam', 'Brahmayagnam', '📖', 'daily', false, true, 8, true);

insert into public.practices (slug, name, icon, cadence, is_sandhyavandhanam, punya_value, affects_streak)
values ('purusha-suktam', 'Purusha Suktam', '📜', 'daily', false, 8, true);

-- AI-DEV NOTE: Protected eligibility-gating logic. See AGENTS.md "Sandhya /
-- Samidhadhanam eligibility gating" - do not change the male/upanayanam/
-- unmarried requirements without Sreeni's explicit instruction. This is the
-- latest definition of check_sandhya_eligibility (supersedes the version in
-- 20260726140000_samidhadhanam_and_marital_status.sql).
create or replace function public.check_sandhya_eligibility() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_is_sandhya boolean; v_requires_brahmachari boolean; v_requires_grihastha boolean;
  v_gender text; v_upanayanam boolean; v_married boolean;
begin
  select is_sandhyavandhanam, requires_brahmachari, requires_grihastha
    into v_is_sandhya, v_requires_brahmachari, v_requires_grihastha
    from practices where id = new.practice_id;
  if not v_is_sandhya and not v_requires_brahmachari and not v_requires_grihastha then return new; end if;

  if v_is_sandhya then
    if new.family_member_id is null then
      select gender into v_gender from profiles where id = new.owner_id;
      if v_gender <> 'male' then
        raise exception 'Sandhyavandhanam is available for male users only';
      end if;
    else
      select gender, upanayanam_done into v_gender, v_upanayanam
        from family_members where id = new.family_member_id;
      if v_gender <> 'male' or not coalesce(v_upanayanam, false) then
        raise exception 'Sandhyavandhanam requires a male child with upanayanam done';
      end if;
    end if;
  end if;

  if v_requires_brahmachari then
    if new.family_member_id is null then
      select gender, is_married into v_gender, v_married from profiles where id = new.owner_id;
      if v_gender <> 'male' or coalesce(v_married, false) then
        raise exception 'Samidhadhanam is available for unmarried male users only';
      end if;
    else
      select gender, upanayanam_done into v_gender, v_upanayanam
        from family_members where id = new.family_member_id;
      if v_gender <> 'male' or not coalesce(v_upanayanam, false) then
        raise exception 'Samidhadhanam requires a male child with upanayanam done';
      end if;
    end if;
  end if;

  if v_requires_grihastha then
    -- A child can never be married - Brahmayagnam is self-only, no exception
    -- to look up on the family_members side the way the other two gates do.
    if new.family_member_id is not null then
      raise exception 'Brahmayagnam is available for married male users only';
    end if;
    select gender, is_married into v_gender, v_married from profiles where id = new.owner_id;
    if v_gender <> 'male' or not coalesce(v_married, false) then
      raise exception 'Brahmayagnam is available for married male users only';
    end if;
  end if;

  return new;
end $$;
