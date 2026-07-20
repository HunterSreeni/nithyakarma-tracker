-- A daily anchor practice open to everyone, not gated by gender/upanayanam
-- like sandhyavandhanam. is_sandhyavandhanam defaults false, so it needs no
-- new trigger or dropdown filter - it's visible to every user automatically.
insert into public.practices (slug, name, icon, cadence, is_sandhyavandhanam, punya_value, affects_streak)
values ('temple-visit', 'Temple Visit', '🛕', 'daily', false, 5, true);
