-- Samidhadhanam: a daily anushtanam performed only by a brahmachari (an
-- unmarried male, or a boy who has had upanayanam). Reuses the sandhya
-- eligibility trigger rather than adding a second one, since it's already
-- the sole insert-guard on user_practices.

alter table public.practices add column requires_brahmachari boolean not null default false;
alter table public.profiles add column is_married boolean not null default false;

insert into public.practices (slug, name, icon, cadence, is_sandhyavandhanam, requires_brahmachari, punya_value, affects_streak)
values ('samidhadhanam', 'Samidhadhanam', '🔥', 'daily', false, true, 5, true);

create or replace function public.check_sandhya_eligibility() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_is_sandhya boolean; v_requires_brahmachari boolean; v_gender text; v_upanayanam boolean; v_married boolean;
begin
  select is_sandhyavandhanam, requires_brahmachari into v_is_sandhya, v_requires_brahmachari
    from practices where id = new.practice_id;
  if not v_is_sandhya and not v_requires_brahmachari then return new; end if;

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

  return new;
end $$;
